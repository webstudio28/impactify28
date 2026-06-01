import type { SupabaseClient } from "@supabase/supabase-js";
import { composeSmsBody } from "@/lib/sms/body";
import { appendCampaignSalesParam } from "@/lib/sales/attribution";

export type CampaignStepRow = {
  step_order: number;
  body: string;
  link_url: string | null;
  delay_after_previous_hours: number;
};

function addHours(d: Date, hours: number): Date {
  return new Date(d.getTime() + hours * 60 * 60 * 1000);
}

/**
 * Enqueue one outbound row per (recipient × step). Caller must own the campaign (RLS).
 */
export async function enqueueCampaignSms(
  supabase: SupabaseClient,
  params: {
    userId: string;
    campaignId: string;
    phones: string[];
    steps: CampaignStepRow[];
    startAt: Date;
  }
): Promise<{ inserted: number }> {
  const { userId, campaignId, phones, steps, startAt } = params;
  const ordered = [...steps].sort((a, b) => a.step_order - b.step_order);

  const rows: {
    user_id: string;
    campaign_id: string;
    step_order: number;
    to_phone: string;
    body: string;
    run_at: string;
  }[] = [];

  for (const phone of phones) {
    let runAt = new Date(startAt.getTime());
    for (const step of ordered) {
      runAt = addHours(runAt, step.delay_after_previous_hours ?? 0);
      const link =
        step.link_url?.trim() ?
          appendCampaignSalesParam(step.link_url.trim(), campaignId, userId)
        : null;
      const body = composeSmsBody(step.body, link);
      if (!body.trim()) continue;
      rows.push({
        user_id: userId,
        campaign_id: campaignId,
        step_order: step.step_order,
        to_phone: phone,
        body,
        run_at: runAt.toISOString(),
      });
    }
  }

  if (rows.length === 0) {
    return { inserted: 0 };
  }

  const { error } = await supabase.from("outbound_sms").insert(rows);
  if (error) throw error;
  return { inserted: rows.length };
}

/**
 * One outbound email row per recipient (same HTML + subject for all).
 */
export async function enqueueCampaignEmail(
  supabase: SupabaseClient,
  params: {
    userId: string;
    campaignId: string;
    recipients: string[];
    subject: string;
    htmlBody: string;
    startAt: Date;
  }
): Promise<{ inserted: number }> {
  const { userId, campaignId, recipients, startAt } = params;
  const runAt = startAt.toISOString();
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const e of recipients) {
    const t = e.trim();
    if (!t) continue;
    const k = t.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    unique.push(t);
  }
  const rows = unique.map((to_email) => ({
    user_id: userId,
    campaign_id: campaignId,
    to_email,
    // Transitional: canonical subject/html lives in campaigns.email_subject/email_html.
    // Keep these placeholders until the DB columns are dropped in the next migration step.
    subject: "",
    html_body: "",
    run_at: runAt,
  }));
  if (!rows.length) return { inserted: 0 };

  const INSERT_BATCH = 500;
  let inserted = 0;
  for (let i = 0; i < rows.length; i += INSERT_BATCH) {
    const chunk = rows.slice(i, i + INSERT_BATCH);
    const { error } = await supabase.from("outbound_email").insert(chunk);
    if (error) throw error;
    inserted += chunk.length;
  }
  return { inserted };
}
