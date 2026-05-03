import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type Ctx = { params: { id: string } };

const STATUS_FILTERS = new Set(["all", "pending", "sent", "failed"]);
const MAX_LIMIT = 200;

export async function GET(req: Request, ctx: Ctx) {
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

  const url = new URL(req.url);
  const rawLimit = Number(url.searchParams.get("limit") ?? "75");
  const rawOffset = Number(url.searchParams.get("offset") ?? "0");
  const statusParam = url.searchParams.get("status") ?? "all";
  const statusFilter = STATUS_FILTERS.has(statusParam) ? statusParam : "all";
  const limit = Number.isFinite(rawLimit) ? Math.min(Math.max(1, rawLimit), MAX_LIMIT) : 75;
  const offset = Number.isFinite(rawOffset) ? Math.max(0, rawOffset) : 0;

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

  let filteredCount = supabase
    .from("outbound_sms")
    .select("*", { count: "exact", head: true })
    .eq("campaign_id", id);
  if (statusFilter !== "all") filteredCount = filteredCount.eq("status", statusFilter);
  const { count: filteredTotal } = await filteredCount;

  let rowsQuery = supabase
    .from("outbound_sms")
    .select(
      "id, to_phone, status, step_order, body, error_message, provider_message_id, run_at, updated_at, created_at"
    )
    .eq("campaign_id", id)
    .order("updated_at", { ascending: false })
    .range(offset, offset + limit - 1);
  if (statusFilter !== "all") rowsQuery = rowsQuery.eq("status", statusFilter);

  const { data: messages, error: rErr } = await rowsQuery;

  if (rErr) return NextResponse.json({ error: rErr.message }, { status: 500 });

  return NextResponse.json({
    campaign,
    counts: {
      pending: pending ?? 0,
      sent: sent ?? 0,
      failed: failed ?? 0,
    },
    total: filteredTotal ?? 0,
    offset,
    limit,
    statusFilter,
    messages: messages ?? [],
  });
}
