import type { SupabaseClient } from "@supabase/supabase-js";
import { formatResendFrom } from "@/lib/email/resend-from";

const nowIso = () => new Date().toISOString();

async function sendWithResend(
  to: string,
  subject: string,
  html: string,
  from: string
): Promise<{ ok: true; id: string | null } | { ok: false; error: string }> {
  const key = process.env.RESEND_API_KEY?.trim();
  if (!key) return { ok: false, error: "RESEND_API_KEY is not set" };
  if (!from) return { ok: false, error: "Sender address is not configured" };

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from, to: [to], subject, html }),
  });

  const text = await res.text();
  if (!res.ok) {
    let msg = text.slice(0, 300);
    try {
      const j = JSON.parse(text) as { message?: string };
      if (j.message) msg = j.message;
    } catch {
      /* */
    }
    return { ok: false, error: msg };
  }

  let id: string | null = null;
  try {
    const j = JSON.parse(text) as { id?: string };
    if (typeof j.id === "string") id = j.id;
  } catch {
    /* */
  }
  return { ok: true, id };
}

/**
 * Sends due outbound_email for running campaigns (same pattern as SMS queue).
 */
export async function processDueOutboundEmail(
  supabase: SupabaseClient,
  options?: { limit?: number }
): Promise<{ processed: number; errors: string[]; campaignIds: string[] }> {
  const limit = options?.limit ?? 40;
  const ts = nowIso();

  const { data: running, error: rErr } = await supabase
    .from("campaigns")
    .select("id")
    .in("status", ["running", "paused"]);
  if (rErr) throw rErr;
  const runningIds = (running ?? []).map((r) => r.id).filter(Boolean);
  if (!runningIds.length) {
    return { processed: 0, errors: [], campaignIds: [] };
  }

  const { data: batch, error } = await supabase
    .from("outbound_email")
    .select("id, user_id, campaign_id, to_email, subject, html_body")
    .eq("status", "pending")
    .lte("run_at", ts)
    .in("campaign_id", runningIds)
    .order("run_at", { ascending: true })
    .limit(limit);

  if (error) throw error;
  if (!batch?.length) return { processed: 0, errors: [], campaignIds: [] };

  const userIds = Array.from(
    new Set(batch.map((r) => r.user_id as string).filter((id): id is string => typeof id === "string" && id.length > 0))
  );

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, sender_email, sender_display_name")
    .in("id", userIds);

  const profileByUser = new Map(
    (profiles ?? []).map((p) => [
      p.id as string,
      formatResendFrom(p.sender_email as string | null, p.sender_display_name as string | null),
    ])
  );

  const envFrom = process.env.RESEND_FROM_EMAIL?.trim() || null;

  const errors: string[] = [];
  let processed = 0;

  for (const row of batch) {
    const uid = row.user_id as string;
    const fromHeader = profileByUser.get(uid) || envFrom;
    if (!fromHeader) {
      const msg =
        "Set your business sender email in the campaign wizard (or configure RESEND_FROM_EMAIL for the whole app).";
      errors.push(`${row.id}: ${msg}`);
      await supabase
        .from("outbound_email")
        .update({
          status: "failed",
          error_message: msg,
          updated_at: nowIso(),
        })
        .eq("id", row.id);
      continue;
    }

    const result = await sendWithResend(
      row.to_email as string,
      row.subject as string,
      row.html_body as string,
      fromHeader
    );
    if (!result.ok) {
      errors.push(`${row.id}: ${result.error}`);
      await supabase
        .from("outbound_email")
        .update({
          status: "failed",
          error_message: result.error,
          updated_at: nowIso(),
        })
        .eq("id", row.id);
      continue;
    }

    const { error: upErr } = await supabase
      .from("outbound_email")
      .update({
        status: "sent",
        provider_message_id: result.id,
        error_message: null,
        updated_at: nowIso(),
      })
      .eq("id", row.id);
    if (upErr) {
      errors.push(`${row.id}: ${upErr.message}`);
      continue;
    }
    processed++;
  }

  const campaignIds = Array.from(
    new Set(batch.map((r) => r.campaign_id).filter((id): id is string => typeof id === "string" && id.length > 0))
  );

  return { processed, errors, campaignIds };
}
