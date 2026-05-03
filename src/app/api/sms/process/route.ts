import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { processDueOutboundEmail } from "@/lib/campaigns/process-email-queue";
import { processDueOutboundSms } from "@/lib/campaigns/process-queue";
import { syncQueuedCampaignsToCompleted } from "@/lib/campaigns/sync-status";

/**
 * Process due outbound SMS and email for this account (RLS). Useful for local dev without cron + service role.
 */
export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const sms = await processDueOutboundSms(supabase, { limit: 25 });
    const email = await processDueOutboundEmail(supabase, { limit: 20 });
    await syncQueuedCampaignsToCompleted(supabase, [...sms.campaignIds, ...email.campaignIds]);
    return NextResponse.json({
      sms: {
        processed: sms.processed,
        errors: sms.errors,
        skippedRateLimit: sms.skippedRateLimit,
      },
      email: { processed: email.processed, errors: email.errors },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Process failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
