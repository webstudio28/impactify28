import type { SupabaseClient } from "@supabase/supabase-js";
import { sendSms } from "@/lib/sms";

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

/**
 * Sends due outbound SMS for campaigns in `running` status (paused campaigns are skipped).
 * Max 50 SMS per UTC minute per campaign via DB RPC (after migration).
 */
export async function processDueOutboundSms(
  supabase: SupabaseClient,
  options?: { limit?: number }
): Promise<{ processed: number; errors: string[]; campaignIds: string[]; skippedRateLimit: number }> {
  const limit = options?.limit ?? 80;
  const ts = nowIso();

  const { data: running, error: rErr } = await supabase.from("campaigns").select("id").eq("status", "running");
  if (rErr) throw rErr;
  const runningIds = (running ?? []).map((r) => r.id).filter(Boolean);
  if (!runningIds.length) {
    return { processed: 0, errors: [], campaignIds: [], skippedRateLimit: 0 };
  }

  const { data: batch, error } = await supabase
    .from("outbound_sms")
    .select("id, campaign_id, to_phone, body")
    .eq("status", "pending")
    .lte("run_at", ts)
    .in("campaign_id", runningIds)
    .order("run_at", { ascending: true })
    .limit(limit);

  if (error) throw error;
  if (!batch?.length) return { processed: 0, errors: [], campaignIds: [], skippedRateLimit: 0 };

  const errors: string[] = [];
  let processed = 0;
  let skippedRateLimit = 0;
  const opts = smsOptions();

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
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      errors.push(`${row.id}: ${msg}`);
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

  return { processed, errors, campaignIds, skippedRateLimit };
}
