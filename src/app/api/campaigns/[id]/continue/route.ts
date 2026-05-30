import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { processCampaignBatchFallback } from "@/lib/campaigns/fallback-process";
import { toCanonicalStatus, transitionCampaign } from "@/lib/campaigns/state-machine";
import { kickoffCampaignProcessing } from "@/lib/qstash";
import { createAdminClient } from "@/lib/supabase/admin";

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
    .select("id, user_id, status, channel")
    .eq("id", id)
    .maybeSingle();
  if (error || !campaign || campaign.user_id !== user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const status = toCanonicalStatus(campaign.status as string);
  if (status === "paused_system") {
    return NextResponse.json(
      { error: "Campaign was paused automatically. Only admin can resume after resolving the issue." },
      { status: 400 }
    );
  }
  if (status !== "paused_user") {
    return NextResponse.json({ error: "Only user-paused campaigns can be continued" }, { status: 400 });
  }

  const transitioned = await transitionCampaign(supabase, id, "in_progress", { actor: "user" });
  if (!transitioned.ok) return NextResponse.json({ error: transitioned.error }, { status: 400 });

  const ch = (campaign.channel as string) === "email" ? "email" : "sms";
  const { published } = await kickoffCampaignProcessing(id, ch);
  if (!published) {
    try {
      const admin = createAdminClient();
      await processCampaignBatchFallback(admin, id, ch);
    } catch (e) {
      console.error("[continue] fallback process failed:", e);
    }
  }

  return NextResponse.json({ ok: true, status: transitioned.status, qstash: published });
}

