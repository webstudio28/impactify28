import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type Ctx = { params: { id: string } };

export async function GET(_req: Request, ctx: Ctx) {
  const { id } = ctx.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: campaign, error: cErr } = await supabase
    .from("campaigns")
    .select("id, name, status, audience_id, send_immediately, scheduled_at, created_at")
    .eq("id", id)
    .single();

  if (cErr || !campaign) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { data: steps, error: sErr } = await supabase
    .from("campaign_steps")
    .select("id, step_order, body, link_url, delay_after_previous_hours")
    .eq("campaign_id", id)
    .order("step_order", { ascending: true });

  if (sErr) return NextResponse.json({ error: sErr.message }, { status: 500 });

  return NextResponse.json({ campaign, steps: steps ?? [] });
}

export async function PATCH(req: Request, ctx: Ctx) {
  const { id } = ctx.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: existing, error: exErr } = await supabase
    .from("campaigns")
    .select("id, status")
    .eq("id", id)
    .single();

  if (exErr || !existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (existing.status !== "draft") {
    return NextResponse.json({ error: "Only draft campaigns can be edited" }, { status: 400 });
  }

  let payload: Record<string, unknown> = {};
  try {
    const body = (await req.json()) as {
      name?: string;
      audience_id?: string | null;
      send_immediately?: boolean;
      scheduled_at?: string | null;
    };
    if (typeof body.name === "string") payload.name = body.name.trim() || "Untitled campaign";
    if ("audience_id" in body) payload.audience_id = body.audience_id;
    if (typeof body.send_immediately === "boolean") payload.send_immediately = body.send_immediately;
    if ("scheduled_at" in body) payload.scheduled_at = body.scheduled_at;
    payload.updated_at = new Date().toISOString();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { data, error } = await supabase.from("campaigns").update(payload).eq("id", id).select("*").single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ campaign: data });
}
