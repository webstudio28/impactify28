import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type Ctx = { params: { id: string } };

type Body = { action?: string };

export async function POST(req: Request, ctx: Ctx) {
  const { id } = ctx.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: campaign, error: cErr } = await supabase
    .from("campaigns")
    .select("id, status, user_id")
    .eq("id", id)
    .single();

  if (cErr || !campaign || campaign.user_id !== user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  let body: Body = {};
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const action = body.action;
  if (action === "pause") {
    if (campaign.status !== "running") {
      return NextResponse.json({ error: "Only running campaigns can be paused" }, { status: 400 });
    }
    const { error } = await supabase
      .from("campaigns")
      .update({ status: "paused", updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, status: "paused" });
  }

  if (action === "resume") {
    if (campaign.status !== "paused") {
      return NextResponse.json({ error: "Only paused campaigns can be resumed" }, { status: 400 });
    }
    const { error } = await supabase
      .from("campaigns")
      .update({ status: "running", updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, status: "running" });
  }

  return NextResponse.json({ error: "action must be pause or resume" }, { status: 400 });
}
