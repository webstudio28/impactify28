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

  const [
    { data: profile },
    { data: campaigns },
    { data: audiences },
    { count: smsSent },
    { count: smsFailed },
    { count: smsPending },
    { count: emailSent },
    { count: emailFailed },
    { count: emailPending },
  ] = await Promise.all([
    db
      .from("profiles")
      .select("id, business_name, role, logo_url, sender_email, sender_display_name, created_at, updated_at")
      .eq("id", id)
      .single(),
    db
      .from("campaigns")
      .select(
        "id, name, status, channel, scheduled_at, send_immediately, created_at, updated_at, audience_id, email_subject"
      )
      .eq("user_id", id)
      .order("created_at", { ascending: false }),
    db
      .from("audiences")
      .select("id, name, audience_type, created_at, audience_members(count)")
      .eq("user_id", id)
      .order("created_at", { ascending: false }),
    db.from("outbound_sms").select("*", { count: "exact", head: true }).eq("user_id", id).eq("status", "sent"),
    db.from("outbound_sms").select("*", { count: "exact", head: true }).eq("user_id", id).eq("status", "failed"),
    db.from("outbound_sms").select("*", { count: "exact", head: true }).eq("user_id", id).eq("status", "pending"),
    db.from("outbound_email").select("*", { count: "exact", head: true }).eq("user_id", id).eq("status", "sent"),
    db.from("outbound_email").select("*", { count: "exact", head: true }).eq("user_id", id).eq("status", "failed"),
    db.from("outbound_email").select("*", { count: "exact", head: true }).eq("user_id", id).eq("status", "pending"),
  ]);

  if (!profile) return NextResponse.json({ error: "User not found" }, { status: 404 });

  // Get auth user info
  const { data: authUser } = await db.auth.admin.getUserById(id);

  // Enrich audiences with member counts
  const enrichedAudiences = (audiences ?? []).map((a) => ({
    ...a,
    member_count: Array.isArray((a as Record<string, unknown>).audience_members)
      ? ((a as Record<string, unknown>).audience_members as { count: number }[])[0]?.count ?? 0
      : 0,
  }));

  return NextResponse.json({
    user: {
      ...profile,
      email: authUser?.user?.email ?? null,
      phone: authUser?.user?.phone ?? null,
      last_sign_in: authUser?.user?.last_sign_in_at ?? null,
      providers: authUser?.user?.app_metadata?.providers ?? [],
    },
    campaigns: campaigns ?? [],
    audiences: enrichedAudiences,
    stats: {
      sms: { sent: smsSent ?? 0, failed: smsFailed ?? 0, pending: smsPending ?? 0 },
      email: { sent: emailSent ?? 0, failed: emailFailed ?? 0, pending: emailPending ?? 0 },
    },
  });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  let db: Awaited<ReturnType<typeof requireAdminApi>>["db"];
  try {
    ({ db } = await requireAdminApi());
  } catch (err) {
    return err as NextResponse;
  }

  const body = (await req.json()) as { role?: string };
  if (!body.role || !["user", "admin"].includes(body.role)) {
    return NextResponse.json({ error: "Invalid role" }, { status: 400 });
  }

  const { data, error } = await db
    .from("profiles")
    .update({ role: body.role, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("id, role")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ user: data });
}
