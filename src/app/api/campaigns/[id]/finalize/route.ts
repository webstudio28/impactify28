import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { enqueueCampaignEmail, enqueueCampaignSms } from "@/lib/campaigns/queue";
import { injectLogoIntoHtml } from "@/lib/openai/generate-campaign-email";
import { isOurShortUrl, shortLinkPublicUrl } from "@/lib/links/short-domain";
import { shortenUrl } from "@/lib/links/shorten";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(_req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: campaign, error: cErr } = await supabase
    .from("campaigns")
    .select("*")
    .eq("id", id)
    .single();

  if (cErr || !campaign) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (campaign.status !== "draft") {
    return NextResponse.json({ error: "Campaign is not a draft" }, { status: 400 });
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
      .select("step_order, body, link_url, delay_after_previous_hours")
      .eq("campaign_id", id)
      .order("step_order", { ascending: true });

    if (sErr) return NextResponse.json({ error: sErr.message }, { status: 500 });
    if (!steps?.length) return NextResponse.json({ error: "Add at least one SMS step" }, { status: 400 });

    // Shorten link_url for each step that has one
    const shortenedSteps = await Promise.all(
      steps.map(async (step) => {
        const link = typeof step.link_url === "string" ? step.link_url.trim() : "";
        if (!link) return step;
        if (isOurShortUrl(link)) return step;
        try {
          const code = await shortenUrl(link, id, user.id);
          return { ...step, link_url: shortLinkPublicUrl(code) };
        } catch {
          return step;
        }
      })
    );

    const { data: members, error: mErr } = await supabase
      .from("audience_members")
      .select("value")
      .eq("audience_id", campaign.audience_id);

    if (mErr) return NextResponse.json({ error: mErr.message }, { status: 500 });
    const phones = (members ?? []).map((m) => m.value.trim()).filter(Boolean);
    if (!phones.length) return NextResponse.json({ error: "Audience has no phone numbers" }, { status: 400 });

    const { error: delErr } = await supabase.from("outbound_sms").delete().eq("campaign_id", id).eq("status", "pending");
    if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 });

    const sendImmediately = Boolean(campaign.send_immediately);
    const scheduledAt = campaign.scheduled_at ? new Date(campaign.scheduled_at as string) : null;

    let startAt = new Date();
    if (!sendImmediately) {
      if (!scheduledAt || Number.isNaN(scheduledAt.getTime())) {
        return NextResponse.json({ error: "Pick a schedule or choose Start now" }, { status: 400 });
      }
      startAt = scheduledAt;
    }

    try {
      const { inserted } = await enqueueCampaignSms(supabase, {
        userId: user.id,
        campaignId: id,
        phones,
        steps: shortenedSteps,
        startAt,
      });
      if (inserted === 0) {
        return NextResponse.json({ error: "No messages to send (empty bodies?)" }, { status: 400 });
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Enqueue failed";
      return NextResponse.json({ error: msg }, { status: 500 });
    }
  } else {
    if (audience.audience_type !== "email") {
      return NextResponse.json({ error: "Email campaigns require an email audience" }, { status: 400 });
    }

    const subject = typeof campaign.email_subject === "string" ? campaign.email_subject.trim() : "";
    const htmlRaw = typeof campaign.email_html === "string" ? campaign.email_html.trim() : "";
    if (!subject || !htmlRaw) {
      return NextResponse.json({ error: "Generate the email before launching" }, { status: 400 });
    }

    const { data: profile } = await supabase.from("profiles").select("logo_url").eq("id", user.id).single();
    const htmlBody = injectLogoIntoHtml(htmlRaw, profile?.logo_url ?? null);

    const includeAll = Boolean(campaign.email_include_all);
    const selectedIds = Array.isArray(campaign.email_selected_member_ids)
      ? (campaign.email_selected_member_ids as string[])
      : [];

    let memberQuery = supabase.from("audience_members").select("value").eq("audience_id", campaign.audience_id);
    if (!includeAll) {
      if (!selectedIds.length) {
        return NextResponse.json({ error: "Select at least one recipient" }, { status: 400 });
      }
      memberQuery = memberQuery.in("id", selectedIds);
    }

    const { data: members, error: mErr } = await memberQuery;
    if (mErr) return NextResponse.json({ error: mErr.message }, { status: 500 });
    const emails = (members ?? []).map((m) => m.value.trim()).filter(Boolean);
    if (!emails.length) return NextResponse.json({ error: "No recipient emails" }, { status: 400 });

    const { error: delErr } = await supabase
      .from("outbound_email")
      .delete()
      .eq("campaign_id", id)
      .eq("status", "pending");
    if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 });

    const sendImmediately = Boolean(campaign.send_immediately);
    const scheduledAt = campaign.scheduled_at ? new Date(campaign.scheduled_at as string) : null;

    let startAt = new Date();
    if (!sendImmediately) {
      if (!scheduledAt || Number.isNaN(scheduledAt.getTime())) {
        return NextResponse.json({ error: "Pick a schedule or choose Start now" }, { status: 400 });
      }
      startAt = scheduledAt;
    }

    try {
      const { inserted } = await enqueueCampaignEmail(supabase, {
        userId: user.id,
        campaignId: id,
        recipients: emails,
        subject,
        htmlBody,
        startAt,
      });
      if (inserted === 0) {
        return NextResponse.json({ error: "No emails to send" }, { status: 400 });
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Enqueue failed";
      return NextResponse.json({ error: msg }, { status: 500 });
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
    .eq("id", id);

  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });

  return NextResponse.json({ ok: true, campaignId: id });
}
