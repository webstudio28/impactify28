import type { SupabaseClient } from "@supabase/supabase-js";

const nowIso = () => new Date().toISOString();

export async function countDuePendingEmail(
  supabase: SupabaseClient,
  campaignId: string
): Promise<number> {
  const staleClaimCutoff = new Date(Date.now() - 15 * 60 * 1000).toISOString();
  const { error: staleClaimErr } = await supabase
    .from("outbound_email")
    .update({ status: "pending", updated_at: nowIso() })
    .eq("campaign_id", campaignId)
    .eq("status", "sending")
    .lt("updated_at", staleClaimCutoff);
  if (staleClaimErr) throw staleClaimErr;

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
