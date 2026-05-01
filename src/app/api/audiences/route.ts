import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type");

  let query = supabase.from("audiences").select("id, name, audience_type, created_at").order("created_at", {
    ascending: false,
  });

  if (type === "phone" || type === "email") {
    query = query.eq("audience_type", type);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ audiences: data ?? [] });
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let name = "New list";
  let audience_type: "phone" | "email" = "phone";
  try {
    const body = (await req.json()) as { name?: string; audience_type?: string };
    if (typeof body.name === "string" && body.name.trim()) name = body.name.trim();
    if (body.audience_type === "email" || body.audience_type === "phone") {
      audience_type = body.audience_type;
    }
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("audiences")
    .insert({ user_id: user.id, name, audience_type })
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ audience: data });
}
