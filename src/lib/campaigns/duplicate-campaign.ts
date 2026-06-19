import type { SupabaseClient } from "@supabase/supabase-js";
import { nextDuplicateCampaignName } from "@/lib/campaigns/duplicate-campaign-name";

type DuplicateResult =
  | { ok: true; campaign: { id: string; name: string; status: string } }
  | { ok: false; error: string; httpStatus?: number };

const SOURCE_SELECT =
  "id, user_id, name, audience_id, send_immediately, scheduled_at, channel, email_subject, email_html, email_include_all, email_selected_member_ids, email_generation_input, email_template_type, email_template_data, email_color_theme, email_font_family, email_emphasis_preset, email_layout_style";

export async function duplicateUserCampaign(
  supabase: SupabaseClient,
  sourceId: string,
  userId: string
): Promise<DuplicateResult> {
  const { data: source, error: sourceErr } = await supabase
    .from("campaigns")
    .select(SOURCE_SELECT)
    .eq("id", sourceId)
    .maybeSingle();

  if (sourceErr) return { ok: false, error: sourceErr.message, httpStatus: 500 };
  if (!source) return { ok: false, error: "Not found", httpStatus: 404 };
  if (source.user_id !== userId) return { ok: false, error: "Forbidden", httpStatus: 403 };

  const { data: nameRows, error: namesErr } = await supabase
    .from("campaigns")
    .select("name")
    .eq("user_id", userId);

  if (namesErr) return { ok: false, error: namesErr.message, httpStatus: 500 };

  const nextName = nextDuplicateCampaignName(
    source.name as string,
    (nameRows ?? []).map((row) => row.name as string)
  );

  const { data: created, error: insertErr } = await supabase
    .from("campaigns")
    .insert({
      user_id: userId,
      name: nextName,
      status: "draft",
      moderation_note: null,
      audience_id: source.audience_id,
      send_immediately: source.send_immediately,
      scheduled_at: source.scheduled_at,
      channel: source.channel,
      email_subject: source.email_subject,
      email_html: source.email_html,
      email_include_all: source.email_include_all,
      email_selected_member_ids: source.email_selected_member_ids,
      email_generation_input: source.email_generation_input,
      email_template_type: source.email_template_type,
      email_template_data: source.email_template_data,
      email_color_theme: source.email_color_theme,
      email_font_family: source.email_font_family,
      email_emphasis_preset: source.email_emphasis_preset,
      email_layout_style: source.email_layout_style,
      started_at: null,
      paused_by: null,
      paused_reason_code: null,
      paused_reason_message: null,
      send_rate_minute: null,
      send_rate_count: 0,
    })
    .select("id, name, status")
    .single();

  if (insertErr || !created) {
    return { ok: false, error: insertErr?.message ?? "Could not duplicate campaign", httpStatus: 500 };
  }

  const { data: steps, error: stepsErr } = await supabase
    .from("campaign_steps")
    .select("step_order, body, link_url, delay_after_previous_hours")
    .eq("campaign_id", sourceId)
    .order("step_order", { ascending: true });

  if (stepsErr) {
    await supabase.from("campaigns").delete().eq("id", created.id);
    return { ok: false, error: stepsErr.message, httpStatus: 500 };
  }

  if (steps?.length) {
    const { error: copyStepsErr } = await supabase.from("campaign_steps").insert(
      steps.map((step) => ({
        campaign_id: created.id,
        step_order: step.step_order,
        body: step.body,
        link_url: step.link_url,
        delay_after_previous_hours: step.delay_after_previous_hours,
      }))
    );

    if (copyStepsErr) {
      await supabase.from("campaigns").delete().eq("id", created.id);
      return { ok: false, error: copyStepsErr.message, httpStatus: 500 };
    }
  }

  return {
    ok: true,
    campaign: {
      id: created.id as string,
      name: created.name as string,
      status: created.status as string,
    },
  };
}
