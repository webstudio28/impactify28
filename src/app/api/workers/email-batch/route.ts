import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { processDueOutboundEmail } from "@/lib/campaigns/process-email-queue";
import { countDuePendingEmail } from "@/lib/campaigns/pending-outbound";
import { syncQueuedCampaignsToCompleted } from "@/lib/campaigns/sync-status";
import { toCanonicalStatus } from "@/lib/campaigns/state-machine";
import { isQStashConfigured, publishEmailBatch, verifyQStashSignature } from "@/lib/qstash";
import { createSendBatchTickets } from "@/lib/tickets/create-ticket";

export const runtime = "nodejs";
export const maxDuration = 300;

type Body = { campaignId?: string; cursor?: number };

export async function POST(req: Request) {
  const rawBody = await req.text();

  if (isQStashConfigured()) {
    const valid = await verifyQStashSignature(req, rawBody);
    if (!valid) return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  } else if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "QStash not configured" }, { status: 503 });
  }

  let body: Body;
  try {
    body = JSON.parse(rawBody) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const campaignId = body.campaignId?.trim();
  if (!campaignId) {
    return NextResponse.json({ error: "campaignId required" }, { status: 400 });
  }

  const cursor = typeof body.cursor === "number" && body.cursor >= 0 ? body.cursor : 0;

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return NextResponse.json({ error: "Server misconfigured" }, { status: 503 });
  }

  const { data: campaign } = await admin
    .from("campaigns")
    .select("id, status, channel")
    .eq("id", campaignId)
    .maybeSingle();

  if (!campaign) return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
  if ((campaign.channel as string) !== "email") {
    return NextResponse.json({ error: "Not an email campaign" }, { status: 400 });
  }

  const canonical = toCanonicalStatus(campaign.status as string);
  if (canonical !== "in_progress") {
    return NextResponse.json({ ok: true, stopped: true, reason: "not_in_progress" });
  }

  const workerLimitRaw = process.env.EMAIL_WORKER_BATCH_LIMIT?.trim();
  const workerLimit = Math.max(
    1,
    Number.parseInt(workerLimitRaw ?? "400", 10) || 400
  );

  const result = await processDueOutboundEmail(admin, {
    campaignId,
    cursor,
    limit: workerLimit,
  });

  void createSendBatchTickets(result.campaignSummaries, "email");

  const pending = await countDuePendingEmail(admin, campaignId);
  const hasMore = pending > 0;

  if (hasMore && isQStashConfigured()) {
    await publishEmailBatch(campaignId, 0);
  } else if (!hasMore) {
    await syncQueuedCampaignsToCompleted(admin, [campaignId]);
  }

  return NextResponse.json({
    ok: true,
    processed: result.processed,
    errors: result.errors.length,
    hasMorePending: hasMore,
    chained: hasMore && isQStashConfigured(),
  });
}
