import { NextResponse } from "next/server";
import { redis } from "@/lib/redis";
import { recordShortLinkClick } from "@/lib/links/record-click";

type Ctx = { params: Promise<{ code: string }> };

const FALLBACK = "https://impactify28.com";

export async function GET(req: Request, ctx: Ctx) {
  const { code } = await ctx.params;
  const destination = await redis.get<string>(`link:${code}`);
  if (!destination || typeof destination !== "string") {
    return NextResponse.redirect(FALLBACK, 302);
  }

  await recordShortLinkClick(code, req);

  return NextResponse.redirect(destination, 302);
}

export async function HEAD(req: Request, ctx: Ctx) {
  const { code } = await ctx.params;
  const destination = await redis.get<string>(`link:${code}`);
  if (!destination || typeof destination !== "string") {
    return new NextResponse(null, { status: 404 });
  }
  return NextResponse.redirect(destination, 302);
}
