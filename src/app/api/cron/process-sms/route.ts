import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { processDueOutboundEmail } from "@/lib/campaigns/process-email-queue";
import { processDueOutboundSms } from "@/lib/campaigns/process-queue";
import { syncQueuedCampaignsToCompleted } from "@/lib/campaigns/sync-status";

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
    return NextResponse.json({ error: "SUPABASE_SERVICE_ROLE_KEY is not configured" }, { status: 503 });
  }

  try {
    const sms = await processDueOutboundSms(admin, { limit: 50 });
    const email = await processDueOutboundEmail(admin, { limit: 40 });
    await syncQueuedCampaignsToCompleted(admin, [...sms.campaignIds, ...email.campaignIds]);
    return NextResponse.json({ sms, email });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Process failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
