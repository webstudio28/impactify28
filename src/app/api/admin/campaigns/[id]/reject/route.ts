import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin/auth";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  let db: Awaited<ReturnType<typeof requireAdminApi>>["db"];
  try {
    ({ db } = await requireAdminApi());
  } catch (err) {
    return err as NextResponse;
  }

  let note = "";
  try {
    const body = (await req.json()) as { note?: string };
    note = typeof body.note === "string" ? body.note.trim() : "";
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!note) {
    return NextResponse.json({ error: "Rejection note is required" }, { status: 400 });
  }

  const { data: row, error: fErr } = await db.from("campaigns").select("id, status").eq("id", id).single();
  if (fErr || !row) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (row.status !== "pending_approval") {
    return NextResponse.json({ error: "Campaign is not awaiting approval" }, { status: 400 });
  }

  const { error: upErr } = await db
    .from("campaigns")
    .update({
      status: "rejected",
      moderation_note: note,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });
  return NextResponse.json({ ok: true, status: "rejected" });
}
