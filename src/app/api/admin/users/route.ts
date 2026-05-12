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
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const limit = 20;
  const offset = (page - 1) * limit;

  // Fetch profiles with aggregated counts using subqueries
  let query = db
    .from("profiles")
    .select(
      `
      id,
      business_name,
      role,
      logo_url,
      sender_email,
      created_at,
      updated_at,
      campaigns(count),
      audiences(count)
    `,
      { count: "exact" }
    )
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (search) {
    query = query.ilike("business_name", `%${search}%`);
  }

  const { data: profiles, count, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Fetch auth users to get emails
  const { data: authData } = await db.auth.admin.listUsers({
    page,
    perPage: 200,
  });

  const emailMap = new Map(
    (authData?.users ?? []).map((u) => [u.id, { email: u.email, lastSignIn: u.last_sign_in_at }])
  );

  const enriched = (profiles ?? []).map((p) => {
    const auth = emailMap.get(p.id);
    const campaignCount = Array.isArray((p as Record<string, unknown>).campaigns)
      ? ((p as Record<string, unknown>).campaigns as { count: number }[])[0]?.count ?? 0
      : 0;
    const audienceCount = Array.isArray((p as Record<string, unknown>).audiences)
      ? ((p as Record<string, unknown>).audiences as { count: number }[])[0]?.count ?? 0
      : 0;
    return {
      id: p.id,
      business_name: p.business_name,
      role: p.role,
      logo_url: p.logo_url,
      sender_email: p.sender_email,
      created_at: p.created_at,
      updated_at: p.updated_at,
      email: auth?.email ?? null,
      last_sign_in: auth?.lastSignIn ?? null,
      campaign_count: campaignCount,
      audience_count: audienceCount,
    };
  });

  return NextResponse.json({
    users: enriched,
    total: count ?? 0,
    page,
    limit,
  });
}
