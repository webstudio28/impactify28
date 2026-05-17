import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { composeSmsBody } from "@/lib/sms/body";
import { renderEmailTemplate, parseTemplateData } from "@/lib/email/templates/render";
import { DEFAULT_THEME_KEY } from "@/lib/email/themes";

type Ctx = { params: Promise<{ id: string }> };

const SUBMITTABLE = new Set(["draft", "rejected"]);

export async function POST(_req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: campaign, error: cErr } = await supabase.from("campaigns").select("*").eq("id", id).single();

  if (cErr || !campaign) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!SUBMITTABLE.has(campaign.status as string)) {
    return NextResponse.json({ error: "Campaign cannot be submitted for approval in its current state" }, { status: 400 });
  }
  if (!campaign.audience_id) {
    return NextResponse.json({ error: "Select an audience first" }, { status: 400 });
  }

  const { data: audience, error: aErr } = await supabase
    .from("audiences")
    .select("id, audience_type")
    .eq("id", campaign.audience_id)
    .single();

  if (aErr || !audience) return NextResponse.json({ error: "Audience not found" }, { status: 400 });

  const channel = (campaign.channel as string) || "sms";

  if (channel === "sms") {
    if (audience.audience_type !== "phone") {
      return NextResponse.json({ error: "SMS campaigns require a phone-number audience" }, { status: 400 });
    }

    const { data: steps, error: sErr } = await supabase
      .from("campaign_steps")
      .select("step_order, body, link_url")
      .eq("campaign_id", id)
      .order("step_order", { ascending: true });

    if (sErr) return NextResponse.json({ error: sErr.message }, { status: 500 });
    if (!steps?.length) return NextResponse.json({ error: "Add at least one SMS step" }, { status: 400 });

    const hasContent = steps.some((s) => composeSmsBody(s.body ?? "", s.link_url ?? "").trim().length > 0);
    if (!hasContent) {
      return NextResponse.json({ error: "Add message text or a link for at least one step" }, { status: 400 });
    }

    const { data: members, error: mErr } = await supabase
      .from("audience_members")
      .select("value")
      .eq("audience_id", campaign.audience_id);

    if (mErr) return NextResponse.json({ error: mErr.message }, { status: 500 });
    const phones = (members ?? []).map((m) => m.value.trim()).filter(Boolean);
    if (!phones.length) return NextResponse.json({ error: "Audience has no phone numbers" }, { status: 400 });
  } else {
    if (audience.audience_type !== "email") {
      return NextResponse.json({ error: "Email campaigns require an email audience" }, { status: 400 });
    }

    const templateData = parseTemplateData(campaign.email_template_data);
    let emailSubject: string;
    let emailHtml: string;

    if (templateData) {
      const colorTheme =
        typeof campaign.email_color_theme === "string" && campaign.email_color_theme.trim()
          ? (campaign.email_color_theme as string)
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
      const rendered = renderEmailTemplate(templateData, colorTheme, fontKey, emphasisKey, layoutKey);
      emailSubject = rendered.subject;
      emailHtml = rendered.html;

      const { error: upHtml } = await supabase
        .from("campaigns")
        .update({
          email_subject: emailSubject,
          email_html: emailHtml,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id);
      if (upHtml) return NextResponse.json({ error: upHtml.message }, { status: 500 });
    } else {
      emailSubject = typeof campaign.email_subject === "string" ? campaign.email_subject.trim() : "";
      emailHtml = typeof campaign.email_html === "string" ? campaign.email_html.trim() : "";
      if (!emailSubject || !emailHtml) {
        return NextResponse.json({ error: "Build the email before submitting" }, { status: 400 });
      }
    }

    const includeAll = Boolean(campaign.email_include_all);
    const selectedIds = Array.isArray(campaign.email_selected_member_ids)
      ? (campaign.email_selected_member_ids as string[])
      : [];

    let memberQuery = supabase.from("audience_members").select("id").eq("audience_id", campaign.audience_id);
    if (!includeAll) {
      if (!selectedIds.length) {
        return NextResponse.json({ error: "Select at least one recipient" }, { status: 400 });
      }
      memberQuery = memberQuery.in("id", selectedIds);
    }

    const { data: memberRows, error: mErr } = await memberQuery;
    if (mErr) return NextResponse.json({ error: mErr.message }, { status: 500 });
    if (!memberRows?.length) return NextResponse.json({ error: "No recipient emails" }, { status: 400 });
  }

  const { error: upErr } = await supabase
    .from("campaigns")
    .update({
      status: "pending_approval",
      moderation_note: null,
      send_immediately: true,
      scheduled_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });

  return NextResponse.json({ ok: true, campaignId: id, status: "pending_approval" });
}
