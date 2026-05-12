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
    { count: totalUsers },
    { count: totalCampaigns },
    { count: activeCampaigns },
    { count: smsSent },
    { count: smsFailed },
    { count: smsPending },
    { count: emailSent },
    { count: emailFailed },
    { count: emailPending },
    { count: totalAudiences },
    { count: totalContacts },
    { data: recentUsers },
    { data: recentCampaigns },
  ] = await Promise.all([
    db.from("profiles").select("*", { count: "exact", head: true }),
    db.from("campaigns").select("*", { count: "exact", head: true }),
    db
      .from("campaigns")
      .select("*", { count: "exact", head: true })
      .in("status", ["running", "paused"]),
    db
      .from("outbound_sms")
      .select("*", { count: "exact", head: true })
      .eq("status", "sent"),
    db
      .from("outbound_sms")
      .select("*", { count: "exact", head: true })
      .eq("status", "failed"),
    db
      .from("outbound_sms")
      .select("*", { count: "exact", head: true })
      .eq("status", "pending"),
    db
      .from("outbound_email")
      .select("*", { count: "exact", head: true })
      .eq("status", "sent"),
    db
      .from("outbound_email")
      .select("*", { count: "exact", head: true })
      .eq("status", "failed"),
    db
      .from("outbound_email")
      .select("*", { count: "exact", head: true })
      .eq("status", "pending"),
    db.from("audiences").select("*", { count: "exact", head: true }),
    db.from("audience_members").select("*", { count: "exact", head: true }),
    db
      .from("profiles")
      .select("id, business_name, role, created_at")
      .order("created_at", { ascending: false })
      .limit(5),
    db
      .from("campaigns")
      .select(
        "id, name, status, channel, created_at, user_id, profiles!inner(business_name)"
      )
      .order("created_at", { ascending: false })
      .limit(5),
  ]);

  return NextResponse.json({
    stats: {
      totalUsers: totalUsers ?? 0,
      totalCampaigns: totalCampaigns ?? 0,
      activeCampaigns: activeCampaigns ?? 0,
      totalAudiences: totalAudiences ?? 0,
      totalContacts: totalContacts ?? 0,
      sms: {
        sent: smsSent ?? 0,
        failed: smsFailed ?? 0,
        pending: smsPending ?? 0,
      },
      email: {
        sent: emailSent ?? 0,
        failed: emailFailed ?? 0,
        pending: emailPending ?? 0,
      },
      totalMessagesSent: (smsSent ?? 0) + (emailSent ?? 0),
      totalMessagesFailed: (smsFailed ?? 0) + (emailFailed ?? 0),
      totalMessagesPending: (smsPending ?? 0) + (emailPending ?? 0),
    },
    recentUsers: recentUsers ?? [],
    recentCampaigns: recentCampaigns ?? [],
  });
}
