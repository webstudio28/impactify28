import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type Ctx = { params: { id: string } };

type StepInput = {
  step_order: number;
  body: string;
  link_url?: string | null;
  delay_after_previous_hours?: number;
};

export async function PUT(req: Request, ctx: Ctx) {
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

  let steps: StepInput[] = [];
  try {
    const body = (await req.json()) as { steps?: StepInput[] };
    if (!Array.isArray(body.steps)) {
      return NextResponse.json({ error: "steps[] required" }, { status: 400 });
    }
    steps = body.steps;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { error: delErr } = await supabase.from("campaign_steps").delete().eq("campaign_id", id);
  if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 });

  const rows = steps.map((s, idx) => ({
    campaign_id: id,
    step_order: typeof s.step_order === "number" ? s.step_order : idx + 1,
    body: s.body ?? "",
    link_url: s.link_url ?? null,
    delay_after_previous_hours: Math.max(0, Math.floor(s.delay_after_previous_hours ?? 0)),
  }));

  if (rows.length) {
    const { error: insErr } = await supabase.from("campaign_steps").insert(rows);
    if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 });
  }

  await supabase.from("campaigns").update({ updated_at: new Date().toISOString() }).eq("id", id);

  const { data: out } = await supabase
    .from("campaign_steps")
    .select("*")
    .eq("campaign_id", id)
    .order("step_order", { ascending: true });

  return NextResponse.json({ steps: out ?? [] });
}
