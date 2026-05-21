import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin/auth";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  let db: Awaited<ReturnType<typeof requireAdminApi>>["db"];
  let userId: string;
  try {
    ({ db, userId } = await requireAdminApi());
  } catch (err) {
    return err as NextResponse;
  }

  const body = (await req.json()) as { resolved?: boolean };
  if (typeof body.resolved !== "boolean") {
    return NextResponse.json({ error: "resolved must be a boolean" }, { status: 400 });
  }

  const { error } = await db
    .from("tickets")
    .update({
      resolved: body.resolved,
      resolved_at: body.resolved ? new Date().toISOString() : null,
      resolved_by: body.resolved ? userId : null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, resolved: body.resolved });
}
