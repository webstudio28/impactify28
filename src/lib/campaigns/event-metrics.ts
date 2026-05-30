import type { SupabaseClient } from "@supabase/supabase-js";

const nowIso = () => new Date().toISOString();

export async function logCampaignEvent(
  supabase: SupabaseClient,
  params: {
    campaignId: string;
    recipientId?: string | null;
    eventType: string;
    provider?: string | null;
    stage?: string | null;
    payload?: Record<string, unknown> | null;
  }
): Promise<void> {
  await supabase.from("campaign_events").insert({
    campaign_id: params.campaignId,
    recipient_id: params.recipientId ?? null,
    event_type: params.eventType,
    provider: params.provider ?? null,
    stage: params.stage ?? null,
    payload: params.payload ?? null,
    event_time: nowIso(),
  });
}

export async function incrementLiveMetric(
  supabase: SupabaseClient,
  campaignId: string,
  column: "open_count" | "click_count" | "unique_open_count" | "unique_click_count"
): Promise<void> {
  const { data: row } = await supabase
    .from("campaign_metrics_live")
    .select("campaign_id, open_count, click_count, unique_open_count, unique_click_count")
    .eq("campaign_id", campaignId)
    .maybeSingle();

  const base = {
    open_count: Number(row?.open_count ?? 0),
    click_count: Number(row?.click_count ?? 0),
    unique_open_count: Number(row?.unique_open_count ?? 0),
    unique_click_count: Number(row?.unique_click_count ?? 0),
  };
  base[column] += 1;

  await supabase.from("campaign_metrics_live").upsert({
    campaign_id: campaignId,
    open_count: base.open_count,
    click_count: base.click_count,
    unique_open_count: base.unique_open_count,
    unique_click_count: base.unique_click_count,
    updated_at: nowIso(),
  });
}

