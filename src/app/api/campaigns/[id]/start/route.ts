import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { executeCampaignLaunch } from "@/lib/campaigns/execute-launch";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(_req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: row, error: qErr } = await supabase.from("campaigns").select("id, status, user_id").eq("id", id).single();

  if (qErr || !row) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (row.user_id !== user.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (row.status !== "ready_to_launch") {
    return NextResponse.json({ error: "Campaign is not ready to start" }, { status: 400 });
  }

  const result = await executeCampaignLaunch(supabase, id);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({ ok: true, status: "running" });
}
