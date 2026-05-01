import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type Ctx = { params: { id: string } };

export async function POST(req: Request, ctx: Ctx) {
  const { id } = ctx.params;
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
