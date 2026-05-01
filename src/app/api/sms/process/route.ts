import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { processDueOutboundSms } from "@/lib/campaigns/process-queue";

/**
 * Process this account's due outbound SMS (respects RLS). Useful for local dev without cron + service role.
 */
export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const result = await processDueOutboundSms(supabase, { limit: 25 });
    return NextResponse.json(result);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Process failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
