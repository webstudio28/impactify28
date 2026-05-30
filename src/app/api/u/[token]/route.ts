import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { hashDestination, verifyTrackingToken } from "@/lib/email/tracking";
import { logCampaignEvent } from "@/lib/campaigns/event-metrics";

type Ctx = { params: Promise<{ token: string }> };

function htmlPage(body: string): string {
  return `<!doctype html><html><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width,initial-scale=1" /><title>Unsubscribe</title></head><body style="font-family:Arial,sans-serif;background:#f8fafc;margin:0;padding:24px;"><div style="max-width:560px;margin:40px auto;background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:24px;"><h1 style="margin:0 0 8px;font-size:20px;">Unsubscribe</h1><p style="margin:0;color:#334155;">${body}</p></div></body></html>`;
}

export async function GET(_req: Request, ctx: Ctx) {
  const { token } = await ctx.params;
  const parsed = verifyTrackingToken(token);
  if (!parsed.ok || !parsed.payload || parsed.payload.k !== "unsub") {
    return new NextResponse(htmlPage("Invalid or expired unsubscribe link."), {
      headers: { "Content-Type": "text/html; charset=utf-8" },
      status: 400,
    });
  }

  try {
    const supabase = createAdminClient();
    const { payload } = parsed;
    const { data: row } = await supabase
      .from("outbound_email")
      .select("id, user_id, to_email")
      .eq("id", payload.rid)
      .maybeSingle();

    if (!row?.user_id || !row?.to_email) {
      return new NextResponse(htmlPage("Recipient not found for this unsubscribe link."), {
        headers: { "Content-Type": "text/html; charset=utf-8" },
        status: 404,
      });
    }

    await supabase.from("suppression_list").upsert({
      user_id: row.user_id,
      channel: "email",
      destination_hash: hashDestination(row.to_email),
      reason: "unsubscribe",
      source: "email_link",
    });

    await logCampaignEvent(supabase, {
      campaignId: payload.cid,
      recipientId: payload.rid,
      eventType: "unsubscribed",
      provider: "tracking",
      stage: "unsubscribe",
    });

    return new NextResponse(htmlPage("You have been unsubscribed successfully."), {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  } catch {
    return new NextResponse(htmlPage("Unsubscribe failed. Please try again later."), {
      headers: { "Content-Type": "text/html; charset=utf-8" },
      status: 500,
    });
  }
}

