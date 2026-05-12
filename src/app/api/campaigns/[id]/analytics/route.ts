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
    .select("id, name, status, channel, created_at, scheduled_at, user_id")
    .eq("id", id)
    .single();

  if (cErr || !campaign || campaign.user_id !== user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const [{ count: sent }, { count: failed }, { count: pending }] = await Promise.all([
    supabase.from("outbound_sms").select("*", { count: "exact", head: true }).eq("campaign_id", id).eq("status", "sent"),
    supabase.from("outbound_sms").select("*", { count: "exact", head: true }).eq("campaign_id", id).eq("status", "failed"),
    supabase.from("outbound_sms").select("*", { count: "exact", head: true }).eq("campaign_id", id).eq("status", "pending"),
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

  const totalClicks = linksWithClicks.reduce((sum, l) => sum + l.clicks, 0);
  const ctr = total > 0 ? Math.round((totalClicks / total) * 1000) / 10 : 0;

  return NextResponse.json({
    campaign,
    counts: { sent: sent ?? 0, failed: failed ?? 0, pending: pending ?? 0, total },
    links: linksWithClicks,
    totalClicks,
    ctr,
  });
}
