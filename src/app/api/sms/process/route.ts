import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { processDueOutboundSms } from "@/lib/campaigns/process-queue";
import { syncQueuedCampaignsToCompleted } from "@/lib/campaigns/sync-status";

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
    await syncQueuedCampaignsToCompleted(supabase, result.campaignIds);
    return NextResponse.json({
      processed: result.processed,
      errors: result.errors,
      skippedRateLimit: result.skippedRateLimit,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Process failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
