import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  generateCampaignEmailHtml,
  type EmailGenerationBrief,
} from "@/lib/openai/generate-campaign-email";

type Ctx = { params: Promise<{ id: string }> };

function parseBrief(raw: unknown): EmailGenerationBrief | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const purpose = typeof o.purpose === "string" ? o.purpose.trim() : "";
  const targetUrl = typeof o.targetUrl === "string" ? o.targetUrl.trim() : "";
  const language = typeof o.language === "string" ? o.language.trim() : "";
  const hasPromo = Boolean(o.hasPromo);
  const promoPercent =
    typeof o.promoPercent === "number" && !Number.isNaN(o.promoPercent) ? Math.max(0, o.promoPercent) : null;
  const promoCode = typeof o.promoCode === "string" ? o.promoCode.trim() || null : null;
  const freeText = typeof o.freeText === "string" ? o.freeText : "";
  if (!purpose || !targetUrl || !language) return null;
  return { purpose, targetUrl, language, hasPromo, promoPercent, promoCode, freeText };
}

export async function POST(req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: campaign, error: cErr } = await supabase
    .from("campaigns")
    .select("id, status, channel, email_generation_input")
    .eq("id", id)
    .single();

  if (cErr || !campaign) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (campaign.status !== "draft") {
    return NextResponse.json({ error: "Only draft campaigns can be edited" }, { status: 400 });
  }
  if (campaign.channel !== "email") {
    return NextResponse.json({ error: "Not an email campaign" }, { status: 400 });
  }

  let brief: EmailGenerationBrief | null = null;
  try {
    const body = (await req.json()) as { brief?: unknown };
    if (body.brief) brief = parseBrief(body.brief);
  } catch {
    /* use stored */
  }

  if (!brief) {
    brief = parseBrief(campaign.email_generation_input);
  }
  if (!brief) {
    return NextResponse.json({ error: "Missing or invalid brief (purpose, target URL, language required)" }, { status: 400 });
  }

  const { data: profile } = await supabase.from("profiles").select("business_name").eq("id", user.id).single();

  try {
    const { subject, html } = await generateCampaignEmailHtml(brief, {
      businessName: profile?.business_name ?? null,
    });

    const { error: upErr } = await supabase
      .from("campaigns")
      .update({
        email_subject: subject,
        email_html: html,
        email_generation_input: JSON.parse(JSON.stringify(brief)) as Record<string, unknown>,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });

    return NextResponse.json({ ok: true, subject, html });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Generation failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
