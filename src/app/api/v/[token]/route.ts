import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyTrackingToken } from "@/lib/email/tracking";
import { incrementLiveMetric, logCampaignEvent } from "@/lib/campaigns/event-metrics";
import { redis } from "@/lib/redis";

type Ctx = { params: Promise<{ token: string }> };

function htmlPage(body: string): string {
  return `<!doctype html><html><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width,initial-scale=1" /><title>Email View</title></head><body style="font-family:Arial,sans-serif;background:#f8fafc;margin:0;padding:24px;"><div style="max-width:560px;margin:40px auto;background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:24px;"><p style="margin:0;color:#334155;">${body}</p></div></body></html>`;
}

export async function GET(_req: Request, ctx: Ctx) {
  const { token } = await ctx.params;
  const parsed = verifyTrackingToken(token);
  if (!parsed.ok || !parsed.payload || parsed.payload.k !== "view") {
    return new NextResponse(htmlPage("Invalid or expired view link."), {
      headers: { "Content-Type": "text/html; charset=utf-8" },
      status: 400,
    });
  }

  try {
    const supabase = createAdminClient();
    const { payload } = parsed;
    const { data: campaign } = await supabase
      .from("campaigns")
      .select("email_html")
      .eq("id", payload.cid)
      .maybeSingle();
    if (!campaign?.email_html) {
      return new NextResponse(htmlPage("Email content not found."), {
        headers: { "Content-Type": "text/html; charset=utf-8" },
        status: 404,
      });
    }

    await logCampaignEvent(supabase, {
      campaignId: payload.cid,
      recipientId: payload.rid,
      eventType: "opened",
      provider: "tracking",
      stage: "browser_view",
    });
    await incrementLiveMetric(supabase, payload.cid, "open_count");
    const uniqueKey = `open_unique:${payload.rid}`;
    const first = await redis.set(uniqueKey, "1", { nx: true, ex: 60 * 60 * 24 * 90 });
    if (first) {
      await incrementLiveMetric(supabase, payload.cid, "unique_open_count");
    }

    return new NextResponse(campaign.email_html, {
      headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
    });
  } catch {
    return new NextResponse(htmlPage("Unable to load email content right now."), {
      headers: { "Content-Type": "text/html; charset=utf-8" },
      status: 500,
    });
  }
}

