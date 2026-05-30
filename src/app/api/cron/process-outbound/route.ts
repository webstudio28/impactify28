import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { processDueOutboundEmail } from "@/lib/campaigns/process-email-queue";
import { processDueOutboundSms } from "@/lib/campaigns/process-queue";
import { syncQueuedCampaignsToCompleted } from "@/lib/campaigns/sync-status";
import { isQStashConfigured } from "@/lib/qstash";
import { createTicket, createSendBatchTickets } from "@/lib/tickets/create-ticket";

/**
 * Heartbeat cron — picks up stuck campaigns when a QStash message was lost.
 * Same auth as /api/cron/process-sms. Prefer scheduling both routes in production.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return NextResponse.json({ error: "SUPABASE_SERVICE_ROLE_KEY is not configured" }, { status: 503 });
  }

  try {
    const sms = await processDueOutboundSms(admin, { limit: 50 });
    const email = await processDueOutboundEmail(admin, { limit: 40 });
    await syncQueuedCampaignsToCompleted(admin, [...sms.campaignIds, ...email.campaignIds]);

    if (sms.providerError) {
      await createTicket({
        kind: "critical",
        title: "Cron: SMS provider not configured — all SMS campaigns stalled",
        message: sms.providerError,
        context: { source: "cron/process-outbound" },
        deduplicate: true,
      });
    }

    await Promise.all([
      createSendBatchTickets(sms.campaignSummaries, "sms"),
      createSendBatchTickets(email.campaignSummaries, "email"),
    ]);

    return NextResponse.json({
      qstashConfigured: isQStashConfigured(),
      sms: { processed: sms.processed, errors: sms.errors.length, skippedRateLimit: sms.skippedRateLimit },
      email: { processed: email.processed, errors: email.errors.length },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Process failed";
    await createTicket({
      kind: "critical",
      title: "Cron: Outbound queue crashed",
      message: msg,
      context: { source: "cron/process-outbound" },
    });
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
