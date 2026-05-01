import type { SupabaseClient } from "@supabase/supabase-js";
import { composeSmsBody } from "@/lib/sms/body";

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
      const body = composeSmsBody(step.body, step.link_url);
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
