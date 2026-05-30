import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin/auth";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  let db: Awaited<ReturnType<typeof requireAdminApi>>["db"];
  try {
    ({ db } = await requireAdminApi());
  } catch (err) {
    return err as NextResponse;
  }

  const eventsLimit = 50;

  const [
    { data: campaign },
    { data: steps },
    { data: smsSummary },
    { data: emailSummary },
    { data: recentSms },
    { data: recentEmail },
    { data: incidents },
    { data: campaignEvents },
  ] = await Promise.all([
    db
      .from("campaigns")
      .select(
        `
        id, name, status, channel, scheduled_at, send_immediately,
        created_at, updated_at, user_id, email_subject, email_html,
        email_include_all, email_generation_input, send_rate_minute,
        send_rate_count, audience_id,
        paused_by, paused_reason_code, paused_reason_message,
        profiles!inner(id, business_name, sender_email, sender_display_name),
        audiences(id, name, audience_type, audience_members(count))
      `
      )
      .eq("id", id)
      .single(),
    db
      .from("campaign_steps")
      .select("id, step_order, body, link_url, delay_after_previous_hours, created_at")
      .eq("campaign_id", id)
      .order("step_order"),
    db
      .from("outbound_sms")
      .select("status, count:id")
      .eq("campaign_id", id),
    db
      .from("outbound_email")
      .select("status, count:id")
      .eq("campaign_id", id),
    db
      .from("outbound_sms")
      .select("id, to_phone, body, status, run_at, updated_at, error_message, step_order")
      .eq("campaign_id", id)
      .order("created_at", { ascending: false })
      .limit(100),
    db
      .from("outbound_email")
      .select("id, to_email, subject, status, run_at, updated_at, error_message")
      .eq("campaign_id", id)
      .order("created_at", { ascending: false })
      .limit(100),
    db
      .from("campaign_incidents")
      .select(
        "id, status, severity, trigger_type, summary, details, opened_at, resolved_at, resolved_by"
      )
      .eq("campaign_id", id)
      .order("opened_at", { ascending: false }),
    db
      .from("campaign_events")
      .select(
        "id, recipient_id, event_type, event_time, provider, error_class, error_code, error_message, latency_ms"
      )
      .eq("campaign_id", id)
      .order("event_time", { ascending: false })
      .limit(eventsLimit),
  ]);

  if (!campaign) return NextResponse.json({ error: "Campaign not found" }, { status: 404 });

  // Aggregate SMS delivery stats
  const smsStats = { sent: 0, failed: 0, pending: 0 };
  (smsSummary ?? []).forEach((row: { status: string; count: unknown }) => {
    const count = typeof row.count === "number" ? row.count : 0;
    if (row.status === "sent") smsStats.sent = count;
    else if (row.status === "failed") smsStats.failed = count;
    else if (row.status === "pending") smsStats.pending = count;
  });

  const emailStats = { sent: 0, failed: 0, pending: 0 };
  (emailSummary ?? []).forEach((row: { status: string; count: unknown }) => {
    const count = typeof row.count === "number" ? row.count : 0;
    if (row.status === "sent") emailStats.sent = count;
    else if (row.status === "failed") emailStats.failed = count;
    else if (row.status === "pending") emailStats.pending = count;
  });

  type ProfilesJoin = { business_name: string; sender_email: string | null };
  type AudienceJoin = { name: string; audience_type: string; audience_members: { count: number }[] };

  const profilesRaw = campaign.profiles as unknown;
  const audienceRaw = campaign.audiences as unknown;
  const profileData: ProfilesJoin | null = Array.isArray(profilesRaw)
    ? (profilesRaw as ProfilesJoin[])[0] ?? null
    : (profilesRaw as ProfilesJoin | null);
  const audienceData: AudienceJoin | null = Array.isArray(audienceRaw)
    ? (audienceRaw as AudienceJoin[])[0] ?? null
    : (audienceRaw as AudienceJoin | null);

  const audienceMemberCount = Array.isArray(audienceData?.audience_members)
    ? audienceData!.audience_members[0]?.count ?? 0
    : 0;

  return NextResponse.json({
    campaign: {
      ...campaign,
      audience_name: audienceData?.name ?? null,
      audience_type: audienceData?.audience_type ?? null,
      audience_member_count: audienceMemberCount,
      business_name: profileData?.business_name ?? "—",
      sender_email: profileData?.sender_email ?? null,
    },
    steps: steps ?? [],
    delivery: {
      sms: smsStats,
      email: emailStats,
    },
    messages: {
      sms: recentSms ?? [],
      email: recentEmail ?? [],
    },
    incidents: incidents ?? [],
    events: campaignEvents ?? [],
    openIncidentCount: (incidents ?? []).filter((i) => i.status === "open").length,
  });
}
