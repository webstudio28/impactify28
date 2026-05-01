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
    .select("id, name, status, created_at, scheduled_at, updated_at, user_id")
    .eq("id", id)
    .single();

  if (cErr || !campaign || campaign.user_id !== user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const [{ count: pending }, { count: sent }, { count: failed }] = await Promise.all([
    supabase
      .from("outbound_sms")
      .select("*", { count: "exact", head: true })
      .eq("campaign_id", id)
      .eq("status", "pending"),
    supabase
      .from("outbound_sms")
      .select("*", { count: "exact", head: true })
      .eq("campaign_id", id)
      .eq("status", "sent"),
    supabase
      .from("outbound_sms")
      .select("*", { count: "exact", head: true })
      .eq("campaign_id", id)
      .eq("status", "failed"),
  ]);

  const { data: recent, error: rErr } = await supabase
    .from("outbound_sms")
    .select("id, to_phone, status, step_order, error_message, run_at, updated_at, created_at")
    .eq("campaign_id", id)
    .order("updated_at", { ascending: false })
    .limit(50);

  if (rErr) return NextResponse.json({ error: rErr.message }, { status: 500 });

  return NextResponse.json({
    campaign,
    counts: {
      pending: pending ?? 0,
      sent: sent ?? 0,
      failed: failed ?? 0,
    },
    recent: recent ?? [],
  });
}
