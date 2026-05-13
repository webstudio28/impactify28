import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin/auth";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(_req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  let db: Awaited<ReturnType<typeof requireAdminApi>>["db"];
  try {
    ({ db } = await requireAdminApi());
  } catch (err) {
    return err as NextResponse;
  }

  const { data: row, error: fErr } = await db.from("campaigns").select("id, status").eq("id", id).single();
  if (fErr || !row) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (row.status !== "pending_approval") {
    return NextResponse.json({ error: "Campaign is not awaiting approval" }, { status: 400 });
  }

  const { error: upErr } = await db
    .from("campaigns")
    .update({
      status: "ready_to_launch",
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });
  return NextResponse.json({ ok: true, status: "ready_to_launch" });
}
