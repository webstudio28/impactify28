import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
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

  const { data: liveMetrics } = await supabase
    .from("campaign_metrics_live")
    .select("sent_count, failed_count, pending_count, open_count, click_count, unique_click_count, updated_at")
    .eq("campaign_id", id)
    .maybeSingle();

  const sentCount = sent ?? 0;
  const failedCount = failed ?? 0;
  const pendingCount = pending ?? 0;
  const openCount = Number(liveMetrics?.open_count ?? 0);
  const clickCount = Math.max(Number(liveMetrics?.click_count ?? 0), shortLinkClicks);
  const ctrDenominator = campaign.channel === "email" ? sentCount : total;
  const ctr = ctrDenominator > 0 ? Math.round((clickCount / ctrDenominator) * 1000) / 10 : 0;

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
