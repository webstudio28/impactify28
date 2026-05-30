import type { SupabaseClient } from "@supabase/supabase-js";

const nowIso = () => new Date().toISOString();

export async function countDuePendingEmail(
  supabase: SupabaseClient,
  campaignId: string
): Promise<number> {
  const { count, error } = await supabase
    .from("outbound_email")
    .select("*", { count: "exact", head: true })
    .eq("campaign_id", campaignId)
    .eq("status", "pending")
    .lte("run_at", nowIso());
  if (error) throw error;
  return count ?? 0;
}

export async function countDuePendingSms(
  supabase: SupabaseClient,
  campaignId: string
): Promise<number> {
  const { count, error } = await supabase
    .from("outbound_sms")
    .select("*", { count: "exact", head: true })
    .eq("campaign_id", campaignId)
    .eq("status", "pending")
    .lte("run_at", nowIso());
  if (error) throw error;
  return count ?? 0;
}
