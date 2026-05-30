import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin/auth";
import { logCampaignEvent } from "@/lib/campaigns/event-log";
import { resolveOpenIncidentsForCampaign } from "@/lib/campaigns/incident";
import { processCampaignBatchFallback } from "@/lib/campaigns/fallback-process";
import { toCanonicalStatus, transitionCampaign } from "@/lib/campaigns/state-machine";
import { isQStashConfigured, kickoffCampaignProcessing } from "@/lib/qstash";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  let db: Awaited<ReturnType<typeof requireAdminApi>>["db"];
  let userId: string;
  try {
    ({ db, userId } = await requireAdminApi());
  } catch (err) {
    return err as NextResponse;
  }

  const { data: campaign, error } = await db
    .from("campaigns")
    .select("id, status, paused_by, channel")
    .eq("id", id)
    .maybeSingle();
  if (error || !campaign) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const status = toCanonicalStatus(campaign.status as string);
  const isSystemPaused =
    status === "paused_system" ||
    (campaign.status === "paused" && campaign.paused_by === "system");
  if (!isSystemPaused) {
    return NextResponse.json({ error: "Only system-paused campaigns can be resumed by admin" }, { status: 400 });
  }

  const resolvedCount = await resolveOpenIncidentsForCampaign(db, id, userId);

  const transitioned = await transitionCampaign(db, id, "in_progress", { actor: "admin" });
  if (!transitioned.ok) return NextResponse.json({ error: transitioned.error }, { status: 400 });

  await logCampaignEvent(db, {
    campaign_id: id,
    event_type: "resumed",
    payload: { resolved_incidents: resolvedCount, actor: "admin" },
  });

  const ch = (campaign.channel as string) === "email" ? "email" : "sms";
  const { published } = await kickoffCampaignProcessing(id, ch);
  if (!published && !isQStashConfigured()) {
    await processCampaignBatchFallback(db, id, ch);
  }

  return NextResponse.json({
    ok: true,
    status: transitioned.status,
    resolvedIncidents: resolvedCount,
    qstash: published,
  });
}

