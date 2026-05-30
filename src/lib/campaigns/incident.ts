import type { SupabaseClient } from "@supabase/supabase-js";
import { logCampaignEvent } from "@/lib/campaigns/event-log";
import { pauseCampaignSystem } from "@/lib/campaigns/state-machine";

export async function createIncident(
  supabase: SupabaseClient,
  campaignId: string,
  triggerType: string,
  summary: string,
  details?: Record<string, unknown>,
  severity = "high"
): Promise<{ id: string } | null> {
  const { data, error } = await supabase
    .from("campaign_incidents")
    .insert({
      campaign_id: campaignId,
      status: "open",
      severity,
      trigger_type: triggerType,
      summary,
      details: details ?? null,
    })
    .select("id")
    .single();

  if (error) {
    console.error("[createIncident]", error.message, campaignId);
    return null;
  }

  await logCampaignEvent(supabase, {
    campaign_id: campaignId,
    event_type: "paused_system",
    error_class: "system_critical",
    error_message: summary,
    payload: { trigger_type: triggerType, incident_id: data.id, ...(details ?? {}) },
  });

  return { id: data.id as string };
}

export async function resolveIncident(
  supabase: SupabaseClient,
  incidentId: string,
  resolvedBy: string
): Promise<boolean> {
  const { error } = await supabase
    .from("campaign_incidents")
    .update({
      status: "resolved",
      resolved_at: new Date().toISOString(),
      resolved_by: resolvedBy,
    })
    .eq("id", incidentId)
    .eq("status", "open");

  if (error) {
    console.error("[resolveIncident]", error.message, incidentId);
    return false;
  }
  return true;
}

export async function resolveOpenIncidentsForCampaign(
  supabase: SupabaseClient,
  campaignId: string,
  resolvedBy: string
): Promise<number> {
  const { data: open, error: fetchErr } = await supabase
    .from("campaign_incidents")
    .select("id")
    .eq("campaign_id", campaignId)
    .eq("status", "open");

  if (fetchErr || !open?.length) return 0;

  let resolved = 0;
  for (const row of open) {
    const ok = await resolveIncident(supabase, row.id as string, resolvedBy);
    if (ok) resolved++;
  }
  return resolved;
}

const ERROR_RATE_THRESHOLD = 0.2;
const MIN_BATCH_FOR_RATE_CHECK = 50;

export async function evaluateBatchAndMaybePause(
  supabase: SupabaseClient,
  campaignId: string,
  batchSent: number,
  batchFailed: number,
  channel: "email" | "sms"
): Promise<boolean> {
  const batchTotal = batchSent + batchFailed;
  if (batchTotal < MIN_BATCH_FOR_RATE_CHECK) return false;

  const errorRate = batchFailed / batchTotal;
  if (errorRate <= ERROR_RATE_THRESHOLD) return false;

  const summary = `${Math.round(errorRate * 100)}% failure rate in last ${channel} batch (${batchFailed}/${batchTotal})`;
  const paused = await pauseCampaignSystem(supabase, campaignId, "high_error_rate", summary);
  if (!paused.ok) {
    console.error("[evaluateBatchAndMaybePause] pause failed:", paused.error);
    return false;
  }

  await createIncident(supabase, campaignId, "high_error_rate", summary, {
    channel,
    batch_sent: batchSent,
    batch_failed: batchFailed,
    batch_total: batchTotal,
    error_rate: errorRate,
  });

  return true;
}

export async function handleCriticalProviderFailure(
  supabase: SupabaseClient,
  campaignId: string,
  channel: "email" | "sms",
  message: string,
  triggerType = "provider_auth_failure"
): Promise<boolean> {
  const paused = await pauseCampaignSystem(supabase, campaignId, triggerType, message);
  if (!paused.ok) {
    console.error("[handleCriticalProviderFailure] pause failed:", paused.error);
    return false;
  }

  await createIncident(supabase, campaignId, triggerType, message, { channel });
  return true;
}
