import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { EMAIL_FONTS } from "@/lib/email/fonts";
import { toCanonicalStatus, transitionCampaign } from "@/lib/campaigns/state-machine";

type Ctx = { params: Promise<{ id: string }> };

const CAMPAIGN_SELECT =
  "id, name, status, audience_id, send_immediately, scheduled_at, created_at, channel, email_subject, email_html, email_include_all, email_selected_member_ids, email_generation_input, email_template_type, email_template_data, email_color_theme, email_font_family, email_emphasis_preset, email_layout_style, moderation_note";

export async function GET(_req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: campaign, error: cErr } = await supabase.from("campaigns").select(CAMPAIGN_SELECT).eq("id", id).single();

  if (cErr || !campaign) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { data: steps, error: sErr } = await supabase
    .from("campaign_steps")
    .select("id, step_order, body, link_url, delay_after_previous_hours")
    .eq("campaign_id", id)
    .order("step_order", { ascending: true });

  if (sErr) return NextResponse.json({ error: sErr.message }, { status: 500 });

  const { data: profile } = await supabase.from("profiles").select("logo_url, business_name").eq("id", user.id).single();

  return NextResponse.json({ campaign, steps: steps ?? [], profile: profile ?? null });
}

async function validateMemberIdsBelongToAudience(
  supabase: Awaited<ReturnType<typeof createClient>>,
  audienceId: string,
  ids: string[]
): Promise<{ ok: true } | { ok: false; message: string }> {
  if (!ids.length) return { ok: true };
  const { data, error } = await supabase
    .from("audience_members")
    .select("id")
    .eq("audience_id", audienceId)
    .in("id", ids);

  if (error) return { ok: false, message: error.message };
  if ((data?.length ?? 0) !== ids.length) {
    return { ok: false, message: "One or more selected contacts are not in this audience" };
  }
  return { ok: true };
}

export async function PATCH(req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: existing, error: exErr } = await supabase
    .from("campaigns")
    .select("id, status, audience_id")
    .eq("id", id)
    .single();

  if (exErr || !existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (existing.status !== "draft" && existing.status !== "rejected") {
    return NextResponse.json({ error: "Only draft or rejected campaigns can be edited" }, { status: 400 });
  }

  let payload: Record<string, unknown> = {};
  try {
    const body = (await req.json()) as {
      name?: string;
      audience_id?: string | null;
      send_immediately?: boolean;
      scheduled_at?: string | null;
      channel?: string;
      email_include_all?: boolean;
      email_selected_member_ids?: string[];
      email_generation_input?: Record<string, unknown> | null;
      email_subject?: string | null;
      email_html?: string | null;
      email_template_type?: string | null;
      email_template_data?: Record<string, unknown> | null;
      email_color_theme?: string | null;
      email_font_family?: string | null;
      email_emphasis_preset?: string | null;
      email_layout_style?: string | null;
    };
    if (typeof body.name === "string") payload.name = body.name.trim() || "Untitled campaign";
    if ("audience_id" in body) payload.audience_id = body.audience_id;
    if (typeof body.send_immediately === "boolean") payload.send_immediately = body.send_immediately;
    if ("scheduled_at" in body) payload.scheduled_at = body.scheduled_at;

    if (body.channel === "sms" || body.channel === "email") {
      payload.channel = body.channel;
    }
    if (typeof body.email_include_all === "boolean") {
      payload.email_include_all = body.email_include_all;
    }
    if (Array.isArray(body.email_selected_member_ids)) {
      const ids = body.email_selected_member_ids.filter((x): x is string => typeof x === "string");
      const audienceId =
        typeof body.audience_id === "string" ? body.audience_id : (existing.audience_id as string | null);
      if (body.email_include_all === false && ids.length > 0 && audienceId) {
        const v = await validateMemberIdsBelongToAudience(supabase, audienceId, ids);
        if (!v.ok) return NextResponse.json({ error: v.message }, { status: 400 });
      }
      payload.email_selected_member_ids = ids;
    }
    if ("email_generation_input" in body) {
      payload.email_generation_input = body.email_generation_input;
    }
    if (typeof body.email_subject === "string") payload.email_subject = body.email_subject.trim();
    if (body.email_subject === "") payload.email_subject = null;
    if (typeof body.email_html === "string") payload.email_html = body.email_html;
    if (body.email_html === "" || body.email_html === null) payload.email_html = null;

    if (
      body.email_template_type === "promotional" ||
      body.email_template_type === "product_launch" ||
      body.email_template_type === "seasonal" ||
      body.email_template_type === "discount_coupon" ||
      body.email_template_type === null
    ) {
      payload.email_template_type = body.email_template_type;
    }
    if ("email_template_data" in body) {
      payload.email_template_data = body.email_template_data;
    }
    if (typeof body.email_color_theme === "string" && body.email_color_theme.trim()) {
      payload.email_color_theme = body.email_color_theme.trim();
    }
    if (typeof body.email_font_family === "string" && body.email_font_family.trim()) {
      const fk = body.email_font_family.trim();
      if (fk in EMAIL_FONTS) payload.email_font_family = fk;
    }
    if (typeof body.email_emphasis_preset === "string" && body.email_emphasis_preset.trim()) {
      const ek = body.email_emphasis_preset.trim();
      if (ek === "balanced" || ek === "bold") payload.email_emphasis_preset = ek;
    }
    if (typeof body.email_layout_style === "string" && body.email_layout_style.trim()) {
      const lk = body.email_layout_style.trim();
      if (lk === "standard" || lk === "paper" || lk === "dark" || lk === "split" || lk === "spotlight") {
        payload.email_layout_style = lk;
      }
    }

    payload.updated_at = new Date().toISOString();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { data, error } = await supabase.from("campaigns").update(payload).eq("id", id).select("*").single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ campaign: data });
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  const isAdmin = profile?.role === "admin";

  const { data: campaign, error: campaignErr } = await supabase
    .from("campaigns")
    .select("id, user_id, status")
    .eq("id", id)
    .maybeSingle();
  if (campaignErr || !campaign) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!isAdmin && campaign.user_id !== user.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const canonical = toCanonicalStatus(campaign.status as string);
  if (canonical === "paused_user") {
    const transitioned = await transitionCampaign(supabase, id, "cancelled", { actor: isAdmin ? "admin" : "user" });
    if (!transitioned.ok) return NextResponse.json({ error: transitioned.error }, { status: 400 });
    return NextResponse.json({ ok: true, status: transitioned.status });
  }

  // Backward compatibility: allow hard delete for draft/rejected via existing endpoint.
  if (canonical !== "draft" && campaign.status !== "rejected") {
    return NextResponse.json(
      { error: "Only draft/rejected campaigns can be deleted directly. Pause campaign first to cancel it." },
      { status: 400 }
    );
  }

  let data: { id: string }[] | null = null;
  let error: { message: string } | null = null;

  try {
    const client = isAdmin ? createAdminClient() : supabase;
    const res = await client.from("campaigns").delete().eq("id", id).select("id");
    data = res.data;
    error = res.error;
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Server error";
    if (isAdmin && msg.includes("SUPABASE_SERVICE_ROLE_KEY")) {
      return NextResponse.json(
        { error: "Admin campaign delete requires SUPABASE_SERVICE_ROLE_KEY on the server." },
        { status: 503 }
      );
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data?.length) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({ ok: true });
}
