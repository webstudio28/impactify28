import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin/auth";

export async function GET(
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

  const { searchParams } = req.nextUrl;
  const channel = searchParams.get("channel") ?? "sms";
  const status = searchParams.get("status") ?? "";
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const limit = 50;
  const offset = (page - 1) * limit;

  if (channel === "sms") {
    let q = db
      .from("outbound_sms")
      .select(
        "id, to_phone, body, status, run_at, created_at, updated_at, error_message, campaign_id, step_order",
        { count: "exact" }
      )
      .eq("user_id", id)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (status) q = q.eq("status", status);

    const { data, count, error } = await q;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ messages: data ?? [], total: count ?? 0, page, limit });
  } else {
    let q = db
      .from("outbound_email")
      .select(
        "id, to_email, subject, status, run_at, created_at, updated_at, error_message, campaign_id",
        { count: "exact" }
      )
      .eq("user_id", id)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (status) q = q.eq("status", status);

    const { data, count, error } = await q;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ messages: data ?? [], total: count ?? 0, page, limit });
  }
}
