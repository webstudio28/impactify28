import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { toCanonicalStatus, transitionCampaign } from "@/lib/campaigns/state-machine";

type Ctx = { params: Promise<{ id: string }> };

type Body = { action?: string };

export async function POST(req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
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
    const canonical = toCanonicalStatus(campaign.status as string);
    if (canonical !== "in_progress") {
      return NextResponse.json({ error: "Only active sends can be paused" }, { status: 400 });
    }
    const t = await transitionCampaign(supabase, id, "paused_user", { actor: "user" });
    if (!t.ok) return NextResponse.json({ error: t.error }, { status: 400 });
    return NextResponse.json({ ok: true, status: "paused_user" });
  }

  if (action === "resume") {
    const canonical = toCanonicalStatus(campaign.status as string);
    if (canonical !== "paused_user") {
      return NextResponse.json({ error: "Only paused campaigns can be resumed" }, { status: 400 });
    }
    const t = await transitionCampaign(supabase, id, "in_progress", { actor: "user" });
    if (!t.ok) return NextResponse.json({ error: t.error }, { status: 400 });
    return NextResponse.json({ ok: true, status: "in_progress" });
  }

  return NextResponse.json({ error: "action must be pause or resume" }, { status: 400 });
}
