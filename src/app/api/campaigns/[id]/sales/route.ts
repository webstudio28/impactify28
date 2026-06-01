import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
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

  // Events are ingested with the service role; read via admin after ownership check.
  let live: Awaited<ReturnType<typeof aggregateSalesForCampaign>> = null;
  try {
    const admin = createAdminClient();
    live = await aggregateSalesForCampaign(admin, id, user.id);
  } catch (e) {
    console.error("[campaigns/sales]", e instanceof Error ? e.message : e);
  }

  let conversionCount = 0;
  let revenueTotal = 0;
  let currency = "BGN";
  let windowEnd: string | null = null;

  if (live) {
    conversionCount = live.conversionCount;
    revenueTotal = live.revenueTotal;
    currency = live.currency;
    windowEnd = new Date().toISOString();
  }

  let rollup: {
    conversion_count: number | null;
    revenue_total: number | null;
    window_end: string | null;
    updated_at: string | null;
  } | null = null;

  try {
    const admin = createAdminClient();
    const { data } = await admin
      .from("campaign_sales_rollups")
      .select("conversion_count, revenue_total, window_end, updated_at")
      .eq("campaign_id", id)
      .order("window_end", { ascending: false })
      .limit(1)
      .maybeSingle();
    rollup = data;
  } catch {
    /* optional staleness hint */
  }

  if (rollup?.window_end && !windowEnd) {
    windowEnd = rollup.window_end as string;
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
