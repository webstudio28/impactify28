import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("profiles")
    .select("id, business_name, logo_url, sender_email, sender_display_name")
    .eq("id", user.id)
    .single();

  if (error || !data) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ profile: data });
}

export async function PATCH(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { sender_email?: unknown; sender_display_name?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const payload: Record<string, unknown> = { updated_at: new Date().toISOString() };
  let touched = false;

  if ("sender_email" in body) {
    touched = true;
    if (body.sender_email === null || body.sender_email === "") {
      payload.sender_email = null;
    } else if (typeof body.sender_email === "string") {
      const e = body.sender_email.trim().toLowerCase();
      if (!EMAIL_RE.test(e)) {
        return NextResponse.json({ error: "Invalid sender email address" }, { status: 400 });
      }
      payload.sender_email = e;
    } else {
      return NextResponse.json({ error: "Invalid sender_email" }, { status: 400 });
    }
  }

  if ("sender_display_name" in body) {
    touched = true;
    if (body.sender_display_name === null || body.sender_display_name === "") {
      payload.sender_display_name = null;
    } else if (typeof body.sender_display_name === "string") {
      const n = body.sender_display_name.replace(/[\r\n<>]/g, " ").replace(/\s+/g, " ").trim().slice(0, 100);
      payload.sender_display_name = n || null;
    } else {
      return NextResponse.json({ error: "Invalid sender_display_name" }, { status: 400 });
    }
  }

  if (!touched) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  const { data, error } = await supabase.from("profiles").update(payload).eq("id", user.id).select("*").single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ profile: data });
}
