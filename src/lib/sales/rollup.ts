import type { SupabaseClient } from "@supabase/supabase-js";

const WINDOW_MS = 12 * 60 * 60 * 1000;

export async function rollupCampaignSales(supabase: SupabaseClient): Promise<{
  campaignsProcessed: number;
}> {
  const windowEnd = new Date();
  const windowStart = new Date(windowEnd.getTime() - WINDOW_MS);

  const { data: campaigns, error } = await supabase
    .from("campaign_sales_events")
    .select("campaign_id")
    .not("campaign_id", "is", null)
    .gte("event_time", windowStart.toISOString());

  if (error) throw error;

  const campaignIds = Array.from(
    new Set(
      (campaigns ?? [])
        .map((r) => r.campaign_id as string)
        .filter((id) => typeof id === "string" && id.length > 0)
    )
  );

  for (const campaignId of campaignIds) {
    const { data: events, error: evErr } = await supabase
      .from("campaign_sales_events")
      .select("order_value, currency")
      .eq("campaign_id", campaignId)
      .gte("event_time", windowStart.toISOString())
      .lte("event_time", windowEnd.toISOString());

    if (evErr || !events?.length) continue;

    let revenueTotal = 0;
    for (const row of events) {
      revenueTotal += Number(row.order_value ?? 0);
    }

    const currency = (events[0]?.currency as string) || "BGN";

    await supabase.from("campaign_sales_rollups").insert({
      campaign_id: campaignId,
      window_start: windowStart.toISOString(),
      window_end: windowEnd.toISOString(),
      conversion_count: events.length,
      revenue_total: revenueTotal,
      updated_at: windowEnd.toISOString(),
    });
  }

  return { campaignsProcessed: campaignIds.length };
}

export async function aggregateSalesForCampaign(
  supabase: SupabaseClient,
  campaignId: string
): Promise<{
  conversionCount: number;
  revenueTotal: number;
  currency: string;
} | null> {
  const { data: events, error } = await supabase
    .from("campaign_sales_events")
    .select("order_value, currency")
    .eq("campaign_id", campaignId);

  if (error || !events?.length) return null;

  let revenueTotal = 0;
  for (const row of events) {
    revenueTotal += Number(row.order_value ?? 0);
  }

  return {
    conversionCount: events.length,
    revenueTotal,
    currency: (events[0]?.currency as string) || "BGN",
  };
}
