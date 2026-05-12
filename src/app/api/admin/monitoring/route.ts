import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin/auth";

export async function GET() {
  let db: Awaited<ReturnType<typeof requireAdminApi>>["db"];
  try {
    ({ db } = await requireAdminApi());
  } catch (err) {
    return err as NextResponse;
  }

  const [
    { count: smsPending },
    { count: emailPending },
    { count: smsFailed },
    { count: emailFailed },
    { data: activeCampaigns },
    { data: recentFailedSms },
    { data: recentFailedEmail },
    { data: overdueSmsTasks },
  ] = await Promise.all([
    db.from("outbound_sms").select("*", { count: "exact", head: true }).eq("status", "pending"),
    db.from("outbound_email").select("*", { count: "exact", head: true }).eq("status", "pending"),
    db.from("outbound_sms").select("*", { count: "exact", head: true }).eq("status", "failed"),
    db.from("outbound_email").select("*", { count: "exact", head: true }).eq("status", "failed"),
    db
      .from("campaigns")
      .select(
        "id, name, status, channel, user_id, send_rate_count, updated_at, profiles!inner(business_name)"
      )
      .in("status", ["running", "paused"])
      .order("updated_at", { ascending: false }),
    db
      .from("outbound_sms")
      .select("id, to_phone, body, error_message, updated_at, campaign_id, user_id")
      .eq("status", "failed")
      .order("updated_at", { ascending: false })
      .limit(20),
    db
      .from("outbound_email")
      .select("id, to_email, subject, error_message, updated_at, campaign_id, user_id")
      .eq("status", "failed")
      .order("updated_at", { ascending: false })
      .limit(20),
    // Overdue: pending items where run_at is in the past by more than 5 minutes
    db
      .from("outbound_sms")
      .select("id, to_phone, run_at, campaign_id, user_id")
      .eq("status", "pending")
      .lt("run_at", new Date(Date.now() - 5 * 60 * 1000).toISOString())
      .order("run_at", { ascending: true })
      .limit(20),
  ]);

  return NextResponse.json({
    queue: {
      smsPending: smsPending ?? 0,
      emailPending: emailPending ?? 0,
      smsFailed: smsFailed ?? 0,
      emailFailed: emailFailed ?? 0,
    },
    activeCampaigns: (activeCampaigns ?? []).map((c) => ({
      id: c.id,
      name: c.name,
      status: c.status,
      channel: c.channel,
      user_id: c.user_id,
      send_rate_count: c.send_rate_count,
      updated_at: c.updated_at,
      business_name: (Array.isArray(c.profiles) ? (c.profiles as { business_name: string }[])[0] : c.profiles as { business_name: string } | null)?.business_name ?? "—",
    })),
    recentFailedSms: recentFailedSms ?? [],
    recentFailedEmail: recentFailedEmail ?? [],
    overdueSmsTasks: overdueSmsTasks ?? [],
  });
}
