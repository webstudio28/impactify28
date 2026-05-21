import type { SupabaseClient } from "@supabase/supabase-js";
import { sendSms } from "@/lib/sms";
import type { CampaignSendSummary } from "@/lib/tickets/create-ticket";

const smsOptions = () => ({
  senderId: process.env.SMS_SENDER_ID || undefined,
  callbackUrl: process.env.SMS_CALLBACK_URL || undefined,
});

function extractProviderMessageRef(data: unknown): string | null {
  if (!data || typeof data !== "object") return null;
  const o = data as Record<string, unknown>;
  if (typeof o.sid === "string") return o.sid;
  if (typeof o["message-id"] === "string") return o["message-id"];
  try {
    return JSON.stringify(data).slice(0, 480);
  } catch {
    return null;
  }
}

function failureReason(data: unknown, status: number): string {
  if (data && typeof data === "object" && "error" in data) {
    const e = (data as { error?: unknown }).error;
    if (typeof e === "string") return e;
  }
  return `SMS failed (${status})`;
}

const nowIso = () => new Date().toISOString();

async function tryReserveRateSlot(
  supabase: SupabaseClient,
  campaignId: string
): Promise<{ ok: boolean; reserved: boolean }> {
  const { data, error } = await supabase.rpc("campaign_rate_try", { p_campaign: campaignId });
  if (error) {
    console.warn("[sms] campaign_rate_try:", error.message);
    return { ok: true, reserved: false };
  }
  if (data === true) return { ok: true, reserved: true };
  return { ok: false, reserved: false };
}

async function rollbackRateSlot(supabase: SupabaseClient, campaignId: string, reserved: boolean) {
  if (!reserved) return;
  const { error } = await supabase.rpc("campaign_rate_rollback", { p_campaign: campaignId });
  if (error) console.warn("[sms] campaign_rate_rollback:", error.message);
}

export type SmsProcessResult = {
  processed: number;
  errors: string[];
  campaignIds: string[];
  skippedRateLimit: number;
  /** Per-campaign summaries — used by cron/routes to create tickets */
  campaignSummaries: CampaignSendSummary[];
  /** Set when the SMS provider is not configured — caller should create a critical ticket */
  providerError: string | null;
};

/**
 * Sends due outbound SMS for campaigns in `running` status (paused campaigns are skipped).
 * Returns per-campaign summaries so callers can create appropriate tickets.
 */
export async function processDueOutboundSms(
  supabase: SupabaseClient,
  options?: { limit?: number }
): Promise<SmsProcessResult> {
  const limit = options?.limit ?? 80;
  const ts = nowIso();

  // Provider config check — fail fast before any DB work
  const smsProvider = process.env.SMS_PROVIDER?.toLowerCase().trim();
  if (!smsProvider) {
    return {
      processed: 0,
      errors: ["SMS_PROVIDER is not set"],
      campaignIds: [],
      skippedRateLimit: 0,
      campaignSummaries: [],
      providerError: "SMS_PROVIDER environment variable is not set. Supported: budgetsms, connectix, twilio, vonage.",
    };
  }

  const { data: running, error: rErr } = await supabase
    .from("campaigns")
    .select("id, name, user_id")
    .in("status", ["running", "queued"]);
  if (rErr) throw rErr;
  if (!running?.length) {
    return { processed: 0, errors: [], campaignIds: [], skippedRateLimit: 0, campaignSummaries: [], providerError: null };
  }

  const runningIds = running.map((r) => r.id as string).filter(Boolean);
  const campaignMeta = new Map(
    running.map((r) => [r.id as string, { name: r.name as string | null, userId: r.user_id as string | null }])
  );

  const { data: batch, error } = await supabase
    .from("outbound_sms")
    .select("id, campaign_id, to_phone, body")
    .eq("status", "pending")
    .lte("run_at", ts)
    .in("campaign_id", runningIds)
    .order("run_at", { ascending: true })
    .limit(limit);

  if (error) throw error;
  if (!batch?.length) {
    return { processed: 0, errors: [], campaignIds: [], skippedRateLimit: 0, campaignSummaries: [], providerError: null };
  }

  const errors: string[] = [];
  let processed = 0;
  let skippedRateLimit = 0;
  const opts = smsOptions();

  // Track per-campaign outcomes
  const perCampaign = new Map<string, { sent: number; failed: number; errors: string[] }>();
  function campaignTrack(id: string) {
    if (!perCampaign.has(id)) perCampaign.set(id, { sent: 0, failed: 0, errors: [] });
    return perCampaign.get(id)!;
  }

  for (const row of batch) {
    const campaignId = row.campaign_id as string | null;
    if (!campaignId) continue;

    const rate = await tryReserveRateSlot(supabase, campaignId);
    if (!rate.ok) {
      skippedRateLimit++;
      continue;
    }

    let reserved = rate.reserved;
    try {
      const result = await sendSms(row.to_phone, row.body, opts);
      if (!result.ok) {
        const msg = failureReason(result.data, result.status);
        errors.push(`${row.id}: ${msg}`);
        campaignTrack(campaignId).failed++;
        campaignTrack(campaignId).errors.push(`${row.to_phone}: ${msg}`);
        await rollbackRateSlot(supabase, campaignId, reserved);
        reserved = false;
        await supabase
          .from("outbound_sms")
          .update({
            status: "failed",
            error_message: msg,
            provider_message_id: null,
            updated_at: nowIso(),
          })
          .eq("id", row.id);
        continue;
      }

      const ref = extractProviderMessageRef(result.data);
      const { error: upErr } = await supabase
        .from("outbound_sms")
        .update({
          status: "sent",
          provider_message_id: ref,
          error_message: null,
          updated_at: nowIso(),
        })
        .eq("id", row.id);
      if (upErr) throw upErr;
      processed++;
      campaignTrack(campaignId).sent++;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      errors.push(`${row.id}: ${msg}`);
      campaignTrack(campaignId).failed++;
      campaignTrack(campaignId).errors.push(`${row.to_phone ?? row.id}: ${msg}`);
      await rollbackRateSlot(supabase, campaignId, reserved);
      reserved = false;
      await supabase
        .from("outbound_sms")
        .update({ status: "failed", error_message: msg, updated_at: nowIso() })
        .eq("id", row.id);
    }
  }

  const campaignIds = Array.from(
    new Set(batch.map((r) => r.campaign_id).filter((id): id is string => typeof id === "string" && id.length > 0))
  );

  const campaignSummaries: CampaignSendSummary[] = Array.from(perCampaign.entries())
    .filter(([, v]) => v.failed > 0)
    .map(([campaignId, v]) => {
      const meta = campaignMeta.get(campaignId);
      return {
        campaignId,
        campaignName: meta?.name ?? undefined,
        userId: meta?.userId ?? null,
        sent: v.sent,
        failed: v.failed,
        sampleErrors: v.errors.slice(0, 5),
      };
    });

  return { processed, errors, campaignIds, skippedRateLimit, campaignSummaries, providerError: null };
}
