import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { injectLogoIntoHtml } from "@/lib/openai/generate-campaign-email";
import { wrapEmailPreviewDocument } from "@/lib/email/preview-document";
import { renderEmailTemplate, parseTemplateData } from "@/lib/email/templates/render";
import { DEFAULT_THEME_KEY } from "@/lib/email/themes";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const { searchParams } = new URL(req.url);
  const narrow = searchParams.get("viewport") === "mobile";

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: campaign, error: cErr } = await supabase
    .from("campaigns")
    .select("id, user_id, email_html, email_template_data, email_color_theme, channel")
    .eq("id", id)
    .single();

  if (cErr || !campaign) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (campaign.user_id !== user.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("logo_url")
    .eq("id", user.id)
    .single();

  let htmlRaw: string;

  const templateData = parseTemplateData(campaign.email_template_data);
  if (templateData) {
    const colorTheme =
      typeof campaign.email_color_theme === "string" && campaign.email_color_theme.trim()
        ? campaign.email_color_theme
        : DEFAULT_THEME_KEY;
    const { html } = renderEmailTemplate(templateData, colorTheme);
    htmlRaw = html;
  } else {
    htmlRaw = typeof campaign.email_html === "string" ? campaign.email_html : "";
    if (!htmlRaw.trim()) {
      return NextResponse.json({ error: "No email content yet" }, { status: 400 });
    }
  }

  const merged = injectLogoIntoHtml(htmlRaw, profile?.logo_url ?? null);
  const doc = wrapEmailPreviewDocument(merged, narrow);

  return new NextResponse(doc, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "private, no-store",
    },
  });
}
