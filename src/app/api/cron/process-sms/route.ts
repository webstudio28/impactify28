import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { processDueOutboundEmail } from "@/lib/campaigns/process-email-queue";
import { processDueOutboundSms } from "@/lib/campaigns/process-queue";
import { syncQueuedCampaignsToCompleted } from "@/lib/campaigns/sync-status";
import { createTicket, createSendBatchTickets } from "@/lib/tickets/create-ticket";

/**
 * Vercel Cron / scheduler — same authorization pattern as other server crons.
 * Header: Authorization: Bearer <CRON_SECRET>
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    await createTicket({
      kind: "critical",
      title: "Cron: SUPABASE_SERVICE_ROLE_KEY is not configured",
      message: "The send cron job cannot run because SUPABASE_SERVICE_ROLE_KEY is missing from the environment.",
      context: { source: "cron/process-sms" },
    });
    return NextResponse.json({ error: "SUPABASE_SERVICE_ROLE_KEY is not configured" }, { status: 503 });
  }

  try {
    const sms = await processDueOutboundSms(admin, { limit: 50 });
    const email = await processDueOutboundEmail(admin, { limit: 40 });
    await syncQueuedCampaignsToCompleted(admin, [...sms.campaignIds, ...email.campaignIds]);

    // If SMS provider is globally missing, create one critical ticket (deduped to avoid spam)
    if (sms.providerError) {
      await createTicket({
        kind: "critical",
        title: "Cron: SMS provider not configured — all SMS campaigns stalled",
        message: sms.providerError,
        context: { source: "cron/process-sms", hint: "Set SMS_PROVIDER env var and restart" },
        deduplicate: true,
      });
    }

    // Create per-campaign tickets for delivery failures
    await Promise.all([
      createSendBatchTickets(sms.campaignSummaries, "sms"),
      createSendBatchTickets(email.campaignSummaries, "email"),
    ]);

    return NextResponse.json({
      sms: { processed: sms.processed, errors: sms.errors.length, skippedRateLimit: sms.skippedRateLimit },
      email: { processed: email.processed, errors: email.errors.length },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Process failed";
    await createTicket({
      kind: "critical",
      title: "Cron: Send queue crashed",
      message: msg,
      context: { source: "cron/process-sms", stack: e instanceof Error ? (e.stack ?? "") : "" },
    });
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
