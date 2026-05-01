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

export async function processDueOutboundSms(
  supabase: SupabaseClient,
  options?: { limit?: number }
): Promise<{ processed: number; errors: string[] }> {
  const limit = options?.limit ?? 25;
  const nowIso = new Date().toISOString();

  const { data: batch, error } = await supabase
    .from("outbound_sms")
    .select("id, to_phone, body")
    .eq("status", "pending")
    .lte("run_at", nowIso)
    .order("run_at", { ascending: true })
    .limit(limit);

  if (error) throw error;
  if (!batch?.length) return { processed: 0, errors: [] };

  const errors: string[] = [];
  let processed = 0;
  const opts = smsOptions();

  for (const row of batch) {
    try {
      const result = await sendSms(row.to_phone, row.body, opts);
      if (!result.ok) {
        const msg = failureReason(result.data, result.status);
        errors.push(`${row.id}: ${msg}`);
        await supabase
          .from("outbound_sms")
          .update({
            status: "failed",
            error_message: msg,
            provider_message_id: null,
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
        })
        .eq("id", row.id);
      if (upErr) throw upErr;
      processed++;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      errors.push(`${row.id}: ${msg}`);
      await supabase
        .from("outbound_sms")
        .update({ status: "failed", error_message: msg })
        .eq("id", row.id);
    }
  }

  return { processed, errors };
}
