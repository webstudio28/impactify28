import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyTrackingToken } from "@/lib/email/tracking";
import { incrementLiveMetric, logCampaignEvent } from "@/lib/campaigns/event-metrics";
import { redis } from "@/lib/redis";

const PIXEL_GIF = Buffer.from("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7", "base64");

type Ctx = { params: Promise<{ token: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const { token } = await ctx.params;
  const parsed = verifyTrackingToken(token);
  if (!parsed.ok || !parsed.payload || parsed.payload.k !== "open") {
    return new NextResponse(PIXEL_GIF, {
      headers: { "Content-Type": "image/gif", "Cache-Control": "no-store" },
    });
  }

  try {
    const supabase = createAdminClient();
    const { payload } = parsed;
    await logCampaignEvent(supabase, {
      campaignId: payload.cid,
      recipientId: payload.rid,
      eventType: "opened",
      provider: "tracking",
      stage: "pixel",
    });
    await incrementLiveMetric(supabase, payload.cid, "open_count");
    const uniqueKey = `open_unique:${payload.rid}`;
    const first = await redis.set(uniqueKey, "1", { nx: true, ex: 60 * 60 * 24 * 90 });
    if (first) {
      await incrementLiveMetric(supabase, payload.cid, "unique_open_count");
    }
  } catch {
    // Never break pixel response for tracking errors.
  }

  return new NextResponse(PIXEL_GIF, {
    headers: { "Content-Type": "image/gif", "Cache-Control": "no-store" },
  });
}

