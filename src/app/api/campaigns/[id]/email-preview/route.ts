import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { injectLogoIntoHtml } from "@/lib/openai/generate-campaign-email";
import { wrapEmailPreviewDocument } from "@/lib/email/preview-document";
import { renderEmailTemplate, parseTemplateData } from "@/lib/email/templates/render";
import { DEFAULT_THEME_KEY } from "@/lib/email/themes";
import { getEmailFont } from "@/lib/email/fonts";

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
    .select("id, user_id, email_html, email_template_data, email_color_theme, email_font_family, email_emphasis_preset, email_layout_style, channel")
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
    const fontKey =
      typeof campaign.email_font_family === "string" && campaign.email_font_family.trim()
        ? campaign.email_font_family.trim()
        : undefined;
    const emphasisKey =
      typeof campaign.email_emphasis_preset === "string" && campaign.email_emphasis_preset.trim()
        ? campaign.email_emphasis_preset.trim()
        : undefined;
    const layoutKey =
      typeof campaign.email_layout_style === "string" && campaign.email_layout_style.trim()
        ? campaign.email_layout_style.trim()
        : undefined;
    const { html } = renderEmailTemplate(templateData, colorTheme, fontKey, emphasisKey, layoutKey);
    htmlRaw = html;
  } else {
    htmlRaw = typeof campaign.email_html === "string" ? campaign.email_html : "";
    if (!htmlRaw.trim()) {
      return NextResponse.json({ error: "No email content yet" }, { status: 400 });
    }
  }

  const merged = injectLogoIntoHtml(htmlRaw, profile?.logo_url ?? null);
  const fontDef = getEmailFont(
    typeof campaign.email_font_family === "string" && campaign.email_font_family.trim()
      ? campaign.email_font_family
      : undefined
  );
  const doc = wrapEmailPreviewDocument(merged, narrow, {
    googleFontsCssHref: fontDef.googleFontsCssHref,
    stackCss: fontDef.stackCss,
  });

  return new NextResponse(doc, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "private, no-store",
    },
  });
}
