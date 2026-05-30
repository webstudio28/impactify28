import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { aggregateSalesForCampaign } from "@/lib/sales/rollup";
import { createCampaignSalesToken } from "@/lib/sales/campaign-token";

type Ctx = { params: Promise<{ id: string }> };

const STALE_MS = 13 * 60 * 60 * 1000;

export async function GET(_req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: campaign, error: cErr } = await supabase
    .from("campaigns")
    .select("id, user_id")
    .eq("id", id)
    .single();

  if (cErr || !campaign || campaign.user_id !== user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { data: rollup } = await supabase
    .from("campaign_sales_rollups")
    .select("conversion_count, revenue_total, window_end, updated_at")
    .eq("campaign_id", id)
    .order("window_end", { ascending: false })
    .limit(1)
    .maybeSingle();

  let conversionCount = 0;
  let revenueTotal = 0;
  let currency = "BGN";
  let windowEnd: string | null = null;

  if (rollup) {
    conversionCount = Number(rollup.conversion_count ?? 0);
    revenueTotal = Number(rollup.revenue_total ?? 0);
    windowEnd = (rollup.window_end as string) ?? null;
  } else {
    const live = await aggregateSalesForCampaign(supabase, id);
    if (live) {
      conversionCount = live.conversionCount;
      revenueTotal = live.revenueTotal;
      currency = live.currency;
      windowEnd = new Date().toISOString();
    }
  }

  if (rollup) {
    const { data: sample } = await supabase
      .from("campaign_sales_events")
      .select("currency")
      .eq("campaign_id", id)
      .limit(1)
      .maybeSingle();
    if (sample?.currency) currency = sample.currency as string;
  }

  const windowEndMs = windowEnd ? new Date(windowEnd).getTime() : 0;
  const isStale = !windowEndMs || Date.now() - windowEndMs > STALE_MS;

  let campaignToken: string | null = null;
  try {
    campaignToken = createCampaignSalesToken(id, user.id);
  } catch {
    campaignToken = null;
  }

  return NextResponse.json({
    conversionCount,
    revenueTotal,
    currency,
    windowEnd,
    isStale,
    campaignToken,
  });
}
