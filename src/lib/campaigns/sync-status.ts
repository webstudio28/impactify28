import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Mark `running` / `paused` campaigns as `completed` when they have no pending outbound rows left.
 * Pass `campaignIds` from a send batch so admin/cron never scans unrelated campaigns.
 */
export async function syncQueuedCampaignsToCompleted(
  supabase: SupabaseClient,
  campaignIds: string[]
): Promise<void> {
  const unique = Array.from(new Set(campaignIds.filter(Boolean)));
  if (!unique.length) return;

  for (const id of unique) {
    const { data: camp } = await supabase.from("campaigns").select("channel").eq("id", id).maybeSingle();
    const channel = (camp?.channel as string | undefined) ?? "sms";

    const pendingQuery =
      channel === "email"
        ? supabase.from("outbound_email").select("*", { count: "exact", head: true })
        : supabase.from("outbound_sms").select("*", { count: "exact", head: true });

    const { count, error } = await pendingQuery.eq("campaign_id", id).eq("status", "pending");

    if (error) continue;
    if ((count ?? 0) === 0) {
      await supabase
        .from("campaigns")
        .update({ status: "completed", updated_at: new Date().toISOString() })
        .eq("id", id)
        .in("status", ["running", "paused", "queued"]);
    }
  }
}
