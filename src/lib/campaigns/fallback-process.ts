import type { SupabaseClient } from "@supabase/supabase-js";
import { processDueOutboundEmail } from "@/lib/campaigns/process-email-queue";
import { processDueOutboundSms } from "@/lib/campaigns/process-queue";
import { syncQueuedCampaignsToCompleted } from "@/lib/campaigns/sync-status";
import { createSendBatchTickets } from "@/lib/tickets/create-ticket";

/**
 * When QStash is not configured, process one batch inline (dev / cron fallback).
 */
export async function processCampaignBatchFallback(
  supabase: SupabaseClient,
  campaignId: string,
  channel: "email" | "sms"
): Promise<{ processed: number }> {
  if (channel === "email") {
    const email = await processDueOutboundEmail(supabase, { campaignId, limit: 50 });
    await syncQueuedCampaignsToCompleted(supabase, email.campaignIds);
    void createSendBatchTickets(email.campaignSummaries, "email");
    return { processed: email.processed };
  }

  const sms = await processDueOutboundSms(supabase, { campaignId, limit: 50 });
  await syncQueuedCampaignsToCompleted(supabase, sms.campaignIds);
  void createSendBatchTickets(sms.campaignSummaries, "sms");
  return { processed: sms.processed };
}
