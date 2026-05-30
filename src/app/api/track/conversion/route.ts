import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyCampaignSalesToken } from "@/lib/sales/campaign-token";
import { checkSalesIngestRateLimit } from "@/lib/sales/rate-limit";

export const runtime = "nodejs";

function corsHeaders(): HeadersInit {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

function okResponse(): NextResponse {
  return NextResponse.json({ ok: true }, { headers: corsHeaders() });
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders() });
}

type Body = {
  workspaceId?: string;
  orderId?: string;
  value?: number;
  currency?: string;
  campaignToken?: string | null;
};

export async function POST(req: Request) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return okResponse();
  }

  const workspaceId = body.workspaceId?.trim();
  const orderId = body.orderId?.trim();
  const value = body.value;
  const currency = (body.currency?.trim() || "BGN").toUpperCase().slice(0, 8);

  if (!workspaceId || !orderId || typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    return okResponse();
  }

  if (!currency) return okResponse();

  try {
    const allowed = await checkSalesIngestRateLimit(workspaceId);
    if (!allowed) return okResponse();

    const admin = createAdminClient();

    const { data: profile } = await admin.from("profiles").select("id").eq("id", workspaceId).maybeSingle();
    if (!profile) return okResponse();

    let campaignId: string | null = null;
    const token = body.campaignToken?.trim();
    if (token) {
      const parsed = verifyCampaignSalesToken(token);
      if (parsed.ok && parsed.userId === workspaceId) {
        const { data: camp } = await admin
          .from("campaigns")
          .select("id")
          .eq("id", parsed.campaignId)
          .eq("user_id", workspaceId)
          .maybeSingle();
        if (camp) campaignId = camp.id as string;
      }
    }

    await admin.from("campaign_sales_events").upsert(
      {
        user_id: workspaceId,
        order_id: orderId,
        campaign_id: campaignId,
        recipient_token: token || null,
        order_value: value,
        currency,
        event_time: new Date().toISOString(),
        source: "snippet",
      },
      { onConflict: "user_id,order_id" }
    );
  } catch (e) {
    console.error("[track/conversion]", e instanceof Error ? e.message : e);
  }

  return okResponse();
}
