import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { checkAiImprovementsRateLimit } from "@/lib/openai/ai-improvements-rate-limit";
import { analyzeEmailImprovements } from "@/lib/openai/email-improvements";

type Ctx = { params: Promise<{ id: string }> };

type Body = {
  subject?: string;
  preheader?: string;
  bodyText?: string;
  ctaText?: string;
};

export async function POST(req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: campaign, error: cErr } = await supabase
    .from("campaigns")
    .select("id, user_id, channel")
    .eq("id", id)
    .single();

  if (cErr || !campaign || campaign.user_id !== user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if ((campaign.channel as string) !== "email") {
    return NextResponse.json({ error: "Only email campaigns support AI improvements" }, { status: 400 });
  }

  const allowed = await checkAiImprovementsRateLimit(user.id);
  if (!allowed) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const subject = typeof body.subject === "string" ? body.subject.trim() : "";
  const preheader = typeof body.preheader === "string" ? body.preheader.trim() : "";
  const bodyText = typeof body.bodyText === "string" ? body.bodyText.trim() : "";
  const ctaText = typeof body.ctaText === "string" ? body.ctaText.trim() : "";

  if (!subject && !bodyText && !ctaText) {
    return NextResponse.json({ error: "Add some email content before checking" }, { status: 400 });
  }

  try {
    const issues = await analyzeEmailImprovements({ subject, preheader, bodyText, ctaText });
    return NextResponse.json({ issues });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Analysis failed";
    if (msg.includes("OPENAI_API_KEY")) {
      return NextResponse.json({ error: "AI is not configured on the server" }, { status: 503 });
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
