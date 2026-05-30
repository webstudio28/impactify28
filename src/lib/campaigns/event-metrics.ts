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
  const { error } = await supabase.from("campaign_events").insert({
    campaign_id: params.campaignId,
    recipient_id: params.recipientId ?? null,
    event_type: params.eventType,
    provider: params.provider ?? null,
    stage: params.stage ?? null,
    payload: params.payload ?? null,
    event_time: nowIso(),
  });
  if (error) {
    console.error(
      "[logCampaignEvent:metrics]",
      error.message,
      params.eventType,
      params.campaignId
    );
  }
}

export async function incrementLiveMetric(
  supabase: SupabaseClient,
  campaignId: string,
  column: "open_count" | "click_count" | "unique_open_count" | "unique_click_count"
): Promise<void> {
  const { data: row, error: selectError } = await supabase
    .from("campaign_metrics_live")
    .select(
      "campaign_id, sent_count, failed_count, pending_count, delivered_count, open_count, click_count, unique_open_count, unique_click_count"
    )
    .eq("campaign_id", campaignId)
    .maybeSingle();

  if (selectError) {
    console.error("[incrementLiveMetric] select failed:", selectError.message, campaignId);
    return;
  }

  const base = {
    open_count: Number(row?.open_count ?? 0),
    click_count: Number(row?.click_count ?? 0),
    unique_open_count: Number(row?.unique_open_count ?? 0),
    unique_click_count: Number(row?.unique_click_count ?? 0),
  };
  base[column] += 1;

  const { error: upsertError } = await supabase.from("campaign_metrics_live").upsert(
    {
      campaign_id: campaignId,
      sent_count: Number(row?.sent_count ?? 0),
      failed_count: Number(row?.failed_count ?? 0),
      pending_count: Number(row?.pending_count ?? 0),
      delivered_count: Number(row?.delivered_count ?? 0),
      open_count: base.open_count,
      click_count: base.click_count,
      unique_open_count: base.unique_open_count,
      unique_click_count: base.unique_click_count,
      updated_at: nowIso(),
    },
    { onConflict: "campaign_id" }
  );
  if (upsertError) {
    console.error("[incrementLiveMetric] upsert failed:", upsertError.message, campaignId);
  }
}

