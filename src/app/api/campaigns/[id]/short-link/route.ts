import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isOurShortUrl, shortLinkPublicUrl } from "@/lib/links/short-domain";
import { shortenUrl } from "@/lib/links/shorten";

type Ctx = { params: Promise<{ id: string }> };

function normalizeUrl(raw: string): string | null {
  const t = raw.trim();
  if (!t) return null;
  return /^https?:\/\//i.test(t) ? t : `https://${t}`;
}

export async function POST(req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: campaign, error: cErr } = await supabase
    .from("campaigns")
    .select("id, user_id, status")
    .eq("id", id)
    .single();

  if (cErr || !campaign || campaign.user_id !== user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (campaign.status !== "draft" && campaign.status !== "rejected") {
    return NextResponse.json({ error: "Only draft or rejected campaigns can create links" }, { status: 400 });
  }

  let body: { url?: string };
  try {
    body = (await req.json()) as { url?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const normalized = normalizeUrl(typeof body.url === "string" ? body.url : "");
  if (!normalized) {
    return NextResponse.json({ error: "URL required" }, { status: 400 });
  }

  if (!URL.canParse(normalized)) {
    return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
  }

  if (isOurShortUrl(normalized)) {
    return NextResponse.json({ error: "Already a short link" }, { status: 400 });
  }

  try {
    const code = await shortenUrl(normalized, id, user.id);
    return NextResponse.json({ shortUrl: shortLinkPublicUrl(code) });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Shorten failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
