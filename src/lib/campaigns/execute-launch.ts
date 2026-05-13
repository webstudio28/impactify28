import type { SupabaseClient } from "@supabase/supabase-js";
import { enqueueCampaignEmail, enqueueCampaignSms } from "@/lib/campaigns/queue";
import { injectLogoIntoHtml } from "@/lib/openai/generate-campaign-email";

/**
 * Enqueues outbound messages and sets campaign to `running`.
 * Used after admin approval (`ready_to_launch`) or trusted server paths.
 * Caller must ensure the campaign is in `ready_to_launch` (or otherwise safe to launch).
 */
export async function executeCampaignLaunch(
  supabase: SupabaseClient,
  campaignId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { data: campaign, error: cErr } = await supabase.from("campaigns").select("*").eq("id", campaignId).single();

  if (cErr || !campaign) return { ok: false, error: "Campaign not found" };
  if (campaign.status !== "ready_to_launch") {
    return { ok: false, error: "Campaign is not approved for launch" };
  }
  if (!campaign.audience_id) {
    return { ok: false, error: "Select an audience first" };
  }

  const ownerId = campaign.user_id as string;

  const { data: audience, error: aErr } = await supabase
    .from("audiences")
    .select("id, audience_type")
    .eq("id", campaign.audience_id)
    .single();

  if (aErr || !audience) return { ok: false, error: "Audience not found" };

  const channel = (campaign.channel as string) || "sms";

  if (channel === "sms") {
    if (audience.audience_type !== "phone") {
      return { ok: false, error: "SMS campaigns require a phone-number audience" };
    }

    const { data: steps, error: sErr } = await supabase
      .from("campaign_steps")
      .select("step_order, body, link_url, delay_after_previous_hours")
      .eq("campaign_id", campaignId)
      .order("step_order", { ascending: true });

    if (sErr) return { ok: false, error: sErr.message };
    if (!steps?.length) return { ok: false, error: "Add at least one SMS step" };

    const { data: members, error: mErr } = await supabase
      .from("audience_members")
      .select("value")
      .eq("audience_id", campaign.audience_id);

    if (mErr) return { ok: false, error: mErr.message };
    const phones = (members ?? []).map((m) => m.value.trim()).filter(Boolean);
    if (!phones.length) return { ok: false, error: "Audience has no phone numbers" };

    const { error: delErr } = await supabase
      .from("outbound_sms")
      .delete()
      .eq("campaign_id", campaignId)
      .eq("status", "pending");
    if (delErr) return { ok: false, error: delErr.message };

    const startAt = new Date();
    try {
      const { inserted } = await enqueueCampaignSms(supabase, {
        userId: ownerId,
        campaignId,
        phones,
        steps,
        startAt,
      });
      if (inserted === 0) {
        return { ok: false, error: "No messages to send (empty bodies?)" };
      }
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : "Enqueue failed" };
    }
  } else {
    if (audience.audience_type !== "email") {
      return { ok: false, error: "Email campaigns require an email audience" };
    }

    const subject = typeof campaign.email_subject === "string" ? campaign.email_subject.trim() : "";
    const htmlRaw = typeof campaign.email_html === "string" ? campaign.email_html.trim() : "";
    if (!subject || !htmlRaw) {
      return { ok: false, error: "Generate the email before launching" };
    }

    const { data: profile } = await supabase.from("profiles").select("logo_url").eq("id", ownerId).single();
    const htmlBody = injectLogoIntoHtml(htmlRaw, profile?.logo_url ?? null);

    const includeAll = Boolean(campaign.email_include_all);
    const selectedIds = Array.isArray(campaign.email_selected_member_ids)
      ? (campaign.email_selected_member_ids as string[])
      : [];

    let memberQuery = supabase.from("audience_members").select("value").eq("audience_id", campaign.audience_id);
    if (!includeAll) {
      if (!selectedIds.length) {
        return { ok: false, error: "Select at least one recipient" };
      }
      memberQuery = memberQuery.in("id", selectedIds);
    }

    const { data: members, error: mErr } = await memberQuery;
    if (mErr) return { ok: false, error: mErr.message };
    const emails = (members ?? []).map((m) => m.value.trim()).filter(Boolean);
    if (!emails.length) return { ok: false, error: "No recipient emails" };

    const { error: delErr } = await supabase
      .from("outbound_email")
      .delete()
      .eq("campaign_id", campaignId)
      .eq("status", "pending");
    if (delErr) return { ok: false, error: delErr.message };

    const startAt = new Date();
    try {
      const { inserted } = await enqueueCampaignEmail(supabase, {
        userId: ownerId,
        campaignId,
        recipients: emails,
        subject,
        htmlBody,
        startAt,
      });
      if (inserted === 0) {
        return { ok: false, error: "No emails to send" };
      }
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : "Enqueue failed" };
    }
  }

  const { error: upErr } = await supabase
    .from("campaigns")
    .update({
      status: "running",
      send_rate_minute: null,
      send_rate_count: 0,
      updated_at: new Date().toISOString(),
    })
    .eq("id", campaignId);

  if (upErr) return { ok: false, error: upErr.message };

  return { ok: true };
}
