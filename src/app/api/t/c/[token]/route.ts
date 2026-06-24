import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { extractShortCodeFromUrl, verifyTrackingToken } from "@/lib/email/tracking";
import { incrementLiveMetric, logCampaignEvent } from "@/lib/campaigns/event-metrics";
import { appendCampaignSalesParam } from "@/lib/sales/attribution";
import { redis } from "@/lib/redis";

type Ctx = { params: Promise<{ token: string }> };

function fallbackRedirect(): NextResponse {
  return NextResponse.redirect("https://impactify28.com", 302);
}

export async function GET(_req: Request, ctx: Ctx) {
  const { token } = await ctx.params;
  const parsed = verifyTrackingToken(token);
  if (!parsed.ok || !parsed.payload || parsed.payload.k !== "click" || !parsed.payload.u) {
    return fallbackRedirect();
  }

  let target = parsed.payload.u;
  if (!URL.canParse(target)) return fallbackRedirect();

  try {
    const supabase = createAdminClient();
    const { payload } = parsed;

    const { data: camp } = await supabase
      .from("campaigns")
      .select("user_id")
      .eq("id", payload.cid)
      .maybeSingle();
    if (camp?.user_id) {
      target = appendCampaignSalesParam(target, payload.cid, camp.user_id as string);
    }
    await logCampaignEvent(supabase, {
      campaignId: payload.cid,
      recipientId: payload.rid,
      eventType: "clicked",
      provider: "tracking",
      stage: "redirect",
      payload: { target },
    });

    const shortCode = extractShortCodeFromUrl(target);
    if (!shortCode) {
      await incrementLiveMetric(supabase, payload.cid, "click_count");
      try {
        const uniqueKey = `click_unique:${payload.rid}`;
        const first = await redis.set(uniqueKey, "1", { nx: true, ex: 60 * 60 * 24 * 90 });
        if (first) {
          await incrementLiveMetric(supabase, payload.cid, "unique_click_count");
        }
      } catch (e) {
        console.error("[tracking/click] redis:", e instanceof Error ? e.message : e);
      }
    }
  } catch (e) {
    console.error("[tracking/click]", e instanceof Error ? e.message : e);
  }

  return NextResponse.redirect(target, 302);
}

