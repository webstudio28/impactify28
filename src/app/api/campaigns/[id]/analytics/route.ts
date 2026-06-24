import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redis } from "@/lib/redis";
import { shortLinkPublicUrl } from "@/lib/links/short-domain";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: campaign, error: cErr } = await supabase
    .from("campaigns")
    .select(
      "id, name, status, channel, created_at, scheduled_at, user_id, started_at, paused_by, paused_reason_code, paused_reason_message"
    )
    .eq("id", id)
    .single();

  if (cErr || !campaign || campaign.user_id !== user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const table = campaign.channel === "email" ? "outbound_email" : "outbound_sms";

  const [{ count: sent }, { count: failed }, { count: pending }] = await Promise.all([
    supabase.from(table).select("*", { count: "exact", head: true }).eq("campaign_id", id).eq("status", "sent"),
    supabase.from(table).select("*", { count: "exact", head: true }).eq("campaign_id", id).eq("status", "failed"),
    supabase.from(table).select("*", { count: "exact", head: true }).eq("campaign_id", id).eq("status", "pending"),
  ]);

  const total = (sent ?? 0) + (failed ?? 0) + (pending ?? 0);

  const { data: links } = await supabase
    .from("short_links")
    .select("code, original_url, created_at")
    .eq("campaign_id", id)
    .order("created_at", { ascending: true });

  const linksWithClicks = await Promise.all(
    (links ?? []).map(async (link) => {
      const clicks = await redis.get<number>(`clicks:${link.code}`);
      return {
        code: link.code,
        original_url: link.original_url,
        short_url: shortLinkPublicUrl(link.code),
        clicks: clicks ?? 0,
        created_at: link.created_at,
      };
    })
  );

  const shortLinkClicks = linksWithClicks.reduce((sum, l) => sum + l.clicks, 0);

  // Metrics are written by the service role (tracking workers). Read via admin after
  // ownership check — the user-scoped client is often blocked by RLS on this table.
  let liveMetrics: {
    sent_count: number;
    failed_count: number;
    pending_count: number;
    open_count: number;
    click_count: number;
    unique_click_count: number;
    updated_at: string;
  } | null = null;

  try {
    const admin = createAdminClient();
    const { data } = await admin
      .from("campaign_metrics_live")
      .select("sent_count, failed_count, pending_count, open_count, click_count, unique_click_count, updated_at")
      .eq("campaign_id", id)
      .maybeSingle();
    liveMetrics = data;
  } catch {
    liveMetrics = null;
  }

  const sentCount = sent ?? 0;
  const failedCount = failed ?? 0;
  const pendingCount = pending ?? 0;
  const openCount = Number(liveMetrics?.open_count ?? 0);
  const liveClickCount = Number(liveMetrics?.click_count ?? 0);
  const clickCount = linksWithClicks.length > 0 ? shortLinkClicks : liveClickCount;
  const ctrDenominator = sentCount;
  const ctrRaw = ctrDenominator > 0 ? (clickCount / ctrDenominator) * 100 : 0;
  const ctr = Math.min(100, Math.round(ctrRaw * 10) / 10);

  return NextResponse.json({
    campaign,
    counts: {
      sent: sentCount,
      failed: failedCount,
      pending: pendingCount,
      total,
      opened: openCount,
    },
    links: linksWithClicks,
    totalClicks: clickCount,
    ctr,
    live: liveMetrics
      ? {
          open_count: openCount,
          click_count: clickCount,
          unique_click_count: Number(liveMetrics.unique_click_count ?? 0),
          updated_at: liveMetrics.updated_at,
        }
      : null,
  });
}
