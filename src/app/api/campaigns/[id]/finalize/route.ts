import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { enqueueCampaignSms } from "@/lib/campaigns/queue";

type Ctx = { params: { id: string } };

export async function POST(_req: Request, ctx: Ctx) {
  const { id } = ctx.params;
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
      steps,
      startAt,
    });
    if (inserted === 0) {
      return NextResponse.json({ error: "No messages to send (empty bodies?)" }, { status: 400 });
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Enqueue failed";
    return NextResponse.json({ error: msg }, { status: 500 });
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
