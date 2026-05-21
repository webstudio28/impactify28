import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin/auth";

export async function GET(req: Request) {
  let db: Awaited<ReturnType<typeof requireAdminApi>>["db"];
  try {
    ({ db } = await requireAdminApi());
  } catch (err) {
    return err as NextResponse;
  }

  const { searchParams } = new URL(req.url);
  const resolved = searchParams.get("resolved");        // "true" | "false" | null (all)
  const kind = searchParams.get("kind");                // "critical" | "error" | "warning" | "info" | null
  const dateFrom = searchParams.get("dateFrom");        // ISO string
  const dateTo = searchParams.get("dateTo");            // ISO string
  const search = searchParams.get("search")?.trim();    // free-text search in title/message
  const page = Math.max(0, Number(searchParams.get("page") ?? "0"));
  const pageSize = 50;

  let query = db
    .from("tickets")
    .select(
      "id, kind, title, message, context, resolved, resolved_at, created_at, updated_at, user_id, campaign_id, profiles!tickets_user_id_fkey ( business_name, sender_email )",
      { count: "exact" }
    )
    .order("created_at", { ascending: false })
    .range(page * pageSize, page * pageSize + pageSize - 1);

  if (resolved === "true") query = query.eq("resolved", true);
  else if (resolved === "false") query = query.eq("resolved", false);

  if (kind) query = query.eq("kind", kind);

  if (dateFrom) query = query.gte("created_at", dateFrom);
  if (dateTo) query = query.lte("created_at", dateTo);

  if (search) {
    // Supabase supports ilike on text columns
    query = query.or(`title.ilike.%${search}%,message.ilike.%${search}%`);
  }

  const { data, error, count } = await query;

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ tickets: data ?? [], total: count ?? 0, page, pageSize });
}
