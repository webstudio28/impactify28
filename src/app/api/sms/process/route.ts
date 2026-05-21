import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { processDueOutboundEmail } from "@/lib/campaigns/process-email-queue";
import { processDueOutboundSms } from "@/lib/campaigns/process-queue";
import { syncQueuedCampaignsToCompleted } from "@/lib/campaigns/sync-status";
import { createTicket, createSendBatchTickets } from "@/lib/tickets/create-ticket";

/**
 * Process due outbound SMS and email for this account (RLS).
 * Useful for local dev without cron + service role.
 * Also instruments failures as tickets visible in the admin panel.
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

    // Silent ticket creation — errors here should never fail the user response
    void (async () => {
      try {
        if (sms.providerError) {
          await createTicket({
            kind: "critical",
            title: "SMS provider not configured — campaigns stalled",
            message: sms.providerError,
            userId: user.id,
            context: { source: "api/sms/process", hint: "Set SMS_PROVIDER env var" },
            deduplicate: true,
          });
        }
        await Promise.all([
          createSendBatchTickets(sms.campaignSummaries, "sms"),
          createSendBatchTickets(email.campaignSummaries, "email"),
        ]);
      } catch (ticketErr) {
        console.error("[sms/process] ticket creation failed:", ticketErr);
      }
    })();

    return NextResponse.json({
      sms: { processed: sms.processed, errors: sms.errors.length, skippedRateLimit: sms.skippedRateLimit },
      email: { processed: email.processed, errors: email.errors.length },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Process failed";
    void createTicket({
      kind: "error",
      title: "Send queue processing failed",
      message: msg,
      userId: user.id,
      context: { source: "api/sms/process" },
    });
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
