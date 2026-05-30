import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { toCanonicalStatus, transitionCampaign } from "@/lib/campaigns/state-machine";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(_req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: campaign, error } = await supabase
    .from("campaigns")
    .select("id, user_id, status")
    .eq("id", id)
    .maybeSingle();
  if (error || !campaign || campaign.user_id !== user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const status = toCanonicalStatus(campaign.status as string);
  if (status !== "in_progress") {
    return NextResponse.json({ error: "Only in-progress campaigns can be paused" }, { status: 400 });
  }

  const transitioned = await transitionCampaign(supabase, id, "paused_user", { actor: "user" });
  if (!transitioned.ok) return NextResponse.json({ error: transitioned.error }, { status: 400 });

  return NextResponse.json({ ok: true, status: transitioned.status });
}

