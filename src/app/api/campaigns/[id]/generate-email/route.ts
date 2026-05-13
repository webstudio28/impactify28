import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { renderEmailTemplate, parseTemplateData } from "@/lib/email/templates/render";
import { DEFAULT_THEME_KEY } from "@/lib/email/themes";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: campaign, error: cErr } = await supabase
    .from("campaigns")
    .select("id, status, channel, email_template_data, email_template_type, email_color_theme")
    .eq("id", id)
    .single();

  if (cErr || !campaign) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (campaign.status !== "draft" && campaign.status !== "rejected") {
    return NextResponse.json({ error: "Only draft or rejected campaigns can be edited" }, { status: 400 });
  }
  if (campaign.channel !== "email") {
    return NextResponse.json({ error: "Not an email campaign" }, { status: 400 });
  }

  let rawTemplateData: unknown = null;
  let colorTheme: string = (campaign.email_color_theme as string | null) ?? DEFAULT_THEME_KEY;

  try {
    const body = (await req.json()) as {
      templateData?: unknown;
      colorTheme?: string;
    };
    if (body.templateData) rawTemplateData = body.templateData;
    if (typeof body.colorTheme === "string" && body.colorTheme.trim()) {
      colorTheme = body.colorTheme.trim();
    }
  } catch {
    /* use stored */
  }

  if (!rawTemplateData) {
    rawTemplateData = campaign.email_template_data;
  }

  const templateData = parseTemplateData(rawTemplateData);
  if (!templateData) {
    return NextResponse.json(
      { error: "Missing or invalid template data. Complete all required fields." },
      { status: 400 }
    );
  }

  try {
    const { html, subject } = renderEmailTemplate(templateData, colorTheme);

    const { error: upErr } = await supabase
      .from("campaigns")
      .update({
        email_subject: subject,
        email_html: html,
        email_template_type: templateData.templateType,
        email_template_data: JSON.parse(JSON.stringify(templateData)) as Record<string, unknown>,
        email_color_theme: colorTheme,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });

    return NextResponse.json({ ok: true, subject });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Generation failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
