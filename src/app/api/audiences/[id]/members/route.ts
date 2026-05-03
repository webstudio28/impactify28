import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: Request, ctx: Ctx) {
  const { id: audienceId } = await ctx.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: aud, error: aErr } = await supabase
    .from("audiences")
    .select("id, audience_type")
    .eq("id", audienceId)
    .single();

  if (aErr || !aud) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (aud.audience_type !== "email") {
    return NextResponse.json({ error: "Member listing is only supported for email audiences" }, { status: 400 });
  }

  const { searchParams } = new URL(req.url);
  const page = Math.max(1, Math.floor(Number(searchParams.get("page")) || 1));
  const limit = Math.min(100, Math.max(1, Math.floor(Number(searchParams.get("limit")) || 40)));
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  const { count, error: cErr } = await supabase
    .from("audience_members")
    .select("*", { count: "exact", head: true })
    .eq("audience_id", audienceId);

  if (cErr) return NextResponse.json({ error: cErr.message }, { status: 500 });

  const { data: members, error: mErr } = await supabase
    .from("audience_members")
    .select("id, value, created_at")
    .eq("audience_id", audienceId)
    .order("created_at", { ascending: false })
    .range(from, to);

  if (mErr) return NextResponse.json({ error: mErr.message }, { status: 500 });

  return NextResponse.json({
    members: members ?? [],
    total: count ?? 0,
    page,
    limit,
  });
}

export async function POST(req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: audience, error: aErr } = await supabase
    .from("audiences")
    .select("id")
    .eq("id", id)
    .single();

  if (aErr || !audience) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let values: string[] = [];
  try {
    const body = (await req.json()) as { values?: string[] };
    if (!Array.isArray(body.values)) {
      return NextResponse.json({ error: "values[] required" }, { status: 400 });
    }
    values = body.values.map((v) => String(v).trim()).filter(Boolean);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!values.length) return NextResponse.json({ error: "No values" }, { status: 400 });

  const rows = values.map((value) => ({ audience_id: id, value }));
  const { error } = await supabase.from("audience_members").upsert(rows, { onConflict: "audience_id,value" });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const { count } = await supabase
    .from("audience_members")
    .select("*", { count: "exact", head: true })
    .eq("audience_id", id);

  return NextResponse.json({ ok: true, count: count ?? values.length });
}
