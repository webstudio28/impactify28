import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin/auth";

export async function GET(req: NextRequest) {
  let db: Awaited<ReturnType<typeof requireAdminApi>>["db"];
  try {
    ({ db } = await requireAdminApi());
  } catch (err) {
    return err as NextResponse;
  }

  const { searchParams } = req.nextUrl;
  const search = searchParams.get("search")?.trim() ?? "";
  const status = searchParams.get("status") ?? "";
  const channel = searchParams.get("channel") ?? "";
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const limit = 20;
  const offset = (page - 1) * limit;

  let query = db
    .from("campaigns")
    .select(
      `
      id,
      name,
      status,
      channel,
      scheduled_at,
      send_immediately,
      created_at,
      updated_at,
      user_id,
      email_subject,
      profiles!inner(id, business_name),
      outbound_sms(count),
      outbound_email(count)
    `,
      { count: "exact" }
    )
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (search) query = query.ilike("name", `%${search}%`);
  if (status) query = query.eq("status", status);
  if (channel) query = query.eq("channel", channel);

  const { data, count, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const enriched = (data ?? []).map((c) => ({
    id: c.id,
    name: c.name,
    status: c.status,
    channel: c.channel,
    scheduled_at: c.scheduled_at,
    send_immediately: c.send_immediately,
    created_at: c.created_at,
    updated_at: c.updated_at,
    user_id: c.user_id,
    email_subject: c.email_subject,
    business_name: (Array.isArray(c.profiles) ? (c.profiles as { business_name: string }[])[0] : c.profiles as { business_name: string } | null)?.business_name ?? "—",
    sms_count: Array.isArray((c as Record<string, unknown>).outbound_sms)
      ? ((c as Record<string, unknown>).outbound_sms as { count: number }[])[0]?.count ?? 0
      : 0,
    email_count: Array.isArray((c as Record<string, unknown>).outbound_email)
      ? ((c as Record<string, unknown>).outbound_email as { count: number }[])[0]?.count ?? 0
      : 0,
  }));

  return NextResponse.json({ campaigns: enriched, total: count ?? 0, page, limit });
}
