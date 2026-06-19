import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { duplicateUserCampaign } from "@/lib/campaigns/duplicate-campaign";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(_req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const result = await duplicateUserCampaign(supabase, id, user.id);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.httpStatus ?? 400 });
  }

  return NextResponse.json({ ok: true, campaign: result.campaign });
}
