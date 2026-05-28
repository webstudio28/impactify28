import type { SupabaseClient } from "@supabase/supabase-js";
import { enqueueCampaignEmail, enqueueCampaignSms } from "@/lib/campaigns/queue";
import { getInvalidPlatformFromWarning } from "@/lib/email/resend-errors";
import { injectLogoIntoHtml } from "@/lib/openai/generate-campaign-email";
import { createTicket } from "@/lib/tickets/create-ticket";

const AUDIENCE_PAGE_SIZE = 1000;

/** Load all audience member emails/phones (Supabase returns max ~1000 rows per request). */
async function fetchAudienceValues(
  supabase: SupabaseClient,
  audienceId: string,
  memberIds?: string[]
): Promise<{ values: string[]; error?: string }> {
  const values: string[] = [];
  let offset = 0;

  while (true) {
    let q = supabase
      .from("audience_members")
      .select("value")
      .eq("audience_id", audienceId)
      .order("id", { ascending: true })
      .range(offset, offset + AUDIENCE_PAGE_SIZE - 1);

    if (memberIds?.length) {
      q = q.in("id", memberIds);
    }

    const { data, error } = await q;
    if (error) return { values: [], error: error.message };
    if (!data?.length) break;

    for (const row of data) {
      const v = (row.value as string).trim();
      if (v) values.push(v);
    }
    if (data.length < AUDIENCE_PAGE_SIZE) break;
    offset += AUDIENCE_PAGE_SIZE;
  }

  return { values };
}

export type ExecuteCampaignLaunchOptions = {
  /** When the HTTP handler already set status to `running` before background enqueue. */
  skipReadyCheck?: boolean;
  /** Skip the final `running` update (status already set). */
  skipStatusUpdate?: boolean;
};

/**
 * Enqueues outbound messages and sets campaign to `running`.
 * Used after admin approval (`ready_to_launch`) or trusted server paths.
 */
export async function executeCampaignLaunch(
  supabase: SupabaseClient,
  campaignId: string,
  options?: ExecuteCampaignLaunchOptions
): Promise<{ ok: true; queued?: number } | { ok: false; error: string; ticketed?: boolean }> {
  const { data: campaign, error: cErr } = await supabase.from("campaigns").select("*").eq("id", campaignId).single();

  if (cErr || !campaign) return { ok: false, error: "Campaign not found" };
  const allowedStatus = options?.skipReadyCheck
    ? ["ready_to_launch", "running"]
    : ["ready_to_launch"];
  if (!allowedStatus.includes(campaign.status as string)) {
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

    // Validate SMS provider is configured before enqueueing
    const smsProvider = process.env.SMS_PROVIDER?.toLowerCase().trim();
    if (!smsProvider) {
      await resetCampaignToReadyToLaunch(supabase, campaignId);
      await createTicket({
        kind: "critical",
        title: "SMS campaign cannot launch — SMS_PROVIDER not configured",
        message: "A campaign could not be launched because SMS_PROVIDER is not set on the server.",
        userId: ownerId,
        campaignId,
        context: {
          campaignId,
          campaignName: campaign.name ?? "",
          hint: "Set SMS_PROVIDER to one of: budgetsms, connectix, twilio, vonage",
        },
      });
      return {
        ok: false,
        error: "SMS provider is not configured. The platform administrator has been notified.",
        ticketed: true,
      };
    }

    const { data: steps, error: sErr } = await supabase
      .from("campaign_steps")
      .select("step_order, body, link_url, delay_after_previous_hours")
      .eq("campaign_id", campaignId)
      .order("step_order", { ascending: true });

    if (sErr) return { ok: false, error: sErr.message };
    if (!steps?.length) return { ok: false, error: "Add at least one SMS step" };

    const { values: phones, error: mErr } = await fetchAudienceValues(supabase, campaign.audience_id as string);
    if (mErr) return { ok: false, error: mErr };
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
    // ── Email channel ──────────────────────────────────────────────────────────

    if (audience.audience_type !== "email") {
      return { ok: false, error: "Email campaigns require an email audience" };
    }

    if (!process.env.RESEND_API_KEY?.trim()) {
      await resetCampaignToReadyToLaunch(supabase, campaignId);
      await createTicket({
        kind: "error",
        title: "Email campaign cannot launch — RESEND_API_KEY missing",
        message: "A campaign could not be sent because RESEND_API_KEY is not configured on the server.",
        userId: ownerId,
        campaignId,
        context: { campaignId, campaignName: campaign.name ?? "" },
      });
      return {
        ok: false,
        error: "RESEND_API_KEY is not set. The platform administrator has been notified.",
        ticketed: true,
      };
    }

    const platformFrom = process.env.RESEND_FROM_EMAIL?.trim() || null;
    const platformFromProblem = getInvalidPlatformFromWarning(platformFrom);
    if (platformFromProblem) {
      await resetCampaignToReadyToLaunch(supabase, campaignId);
      await createTicket({
        kind: "critical",
        title: `Invalid platform sender (RESEND_FROM_EMAIL) — ${campaign.name ?? campaignId}`,
        message: platformFromProblem,
        userId: ownerId,
        campaignId,
        context: {
          campaignName: campaign.name ?? "",
          platformFromEmail: platformFrom ?? "(not set)",
          fixHint: "Use hello@impactify28.com (or similar) on a domain verified in Resend — not @gmail.com.",
        },
      });
      return {
        ok: false,
        error: platformFromProblem,
        ticketed: true,
      };
    }

    const { data: senderProfile } = await supabase
      .from("profiles")
      .select("sender_display_name, business_name")
      .eq("id", ownerId)
      .single();

    const displayName =
      (senderProfile?.sender_display_name as string | null)?.trim() ||
      (senderProfile?.business_name as string | null)?.trim() ||
      null;

    if (!displayName) {
      await resetCampaignToReadyToLaunch(supabase, campaignId);
      return {
        ok: false,
        error: "Set your business display name in Profile → Settings before launching an email campaign.",
      };
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

    if (!includeAll && !selectedIds.length) {
      return { ok: false, error: "Select at least one recipient" };
    }

    const { values: allEmails, error: mErr } = await fetchAudienceValues(
      supabase,
      campaign.audience_id as string,
      includeAll ? undefined : selectedIds
    );
    if (mErr) return { ok: false, error: mErr };

    const maxRaw = process.env.EMAIL_LAUNCH_MAX_RECIPIENTS?.trim();
    const maxRecipients = maxRaw ? Number.parseInt(maxRaw, 10) : 0;
    const emails =
      Number.isFinite(maxRecipients) && maxRecipients > 0
        ? allEmails.slice(0, maxRecipients)
        : allEmails;

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

      if (!options?.skipStatusUpdate) {
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
      }

      return { ok: true, queued: inserted };
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

async function resetCampaignToReadyToLaunch(
  supabase: SupabaseClient,
  campaignId: string
): Promise<void> {
  await supabase
    .from("campaigns")
    .update({ status: "ready_to_launch", updated_at: new Date().toISOString() })
    .eq("id", campaignId);
}
