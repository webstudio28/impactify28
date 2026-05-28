import type { SupabaseClient } from "@supabase/supabase-js";
import { explainResendSendFailure } from "@/lib/email/resend-errors";
import type { CampaignSendSummary } from "@/lib/tickets/create-ticket";

const nowIso = () => new Date().toISOString();

type ResendSendResult =
  | { ok: true; id: string | null }
  | { ok: false; error: string; statusCode?: number };

async function sendWithResend(
  to: string,
  subject: string,
  html: string,
  from: string,
  replyTo?: string
): Promise<ResendSendResult> {
  const key = process.env.RESEND_API_KEY?.trim();
  if (!key) return { ok: false, error: "RESEND_API_KEY is not set", statusCode: 0 };
  if (!from) return { ok: false, error: "Sender address is not configured", statusCode: 0 };

  const body: Record<string, unknown> = { from, to: [to], subject, html };
  if (replyTo) body.reply_to = [replyTo];

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const text = await res.text();
  if (!res.ok) {
    let msg = text.slice(0, 400);
    try {
      const j = JSON.parse(text) as { message?: string; name?: string };
      if (j.message) msg = j.name ? `${j.name}: ${j.message}` : j.message;
    } catch {
      /* */
    }
    return { ok: false, error: msg, statusCode: res.status };
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

export type EmailProcessResult = {
  processed: number;
  errors: string[];
  campaignIds: string[];
  /** Per-campaign summaries — used by cron/routes to create tickets */
  campaignSummaries: CampaignSendSummary[];
};

/**
 * Sends due outbound_email for running campaigns (same pattern as SMS queue).
 * Returns per-campaign summaries so callers can create appropriate tickets.
 */
export async function processDueOutboundEmail(
  supabase: SupabaseClient,
  options?: { limit?: number }
): Promise<EmailProcessResult> {
  const limit = options?.limit ?? 40;
  const ts = nowIso();

  const { data: running, error: rErr } = await supabase
    .from("campaigns")
    .select("id, name, user_id")
    .in("status", ["running", "paused"]);
  if (rErr) throw rErr;
  if (!running?.length) {
    return { processed: 0, errors: [], campaignIds: [], campaignSummaries: [] };
  }

  const runningIds = running.map((r) => r.id as string).filter(Boolean);
  const campaignMeta = new Map(
    running.map((r) => [r.id as string, { name: r.name as string | null, userId: r.user_id as string | null }])
  );

  const { data: batch, error } = await supabase
    .from("outbound_email")
    .select("id, user_id, campaign_id, to_email, subject, html_body")
    .eq("status", "pending")
    .lte("run_at", ts)
    .in("campaign_id", runningIds)
    .order("run_at", { ascending: true })
    .limit(limit);

  if (error) throw error;
  if (!batch?.length) {
    return { processed: 0, errors: [], campaignIds: [], campaignSummaries: [] };
  }

  const userIds = Array.from(
    new Set(batch.map((r) => r.user_id as string).filter((id): id is string => typeof id === "string" && id.length > 0))
  );

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, sender_email, sender_display_name, business_name")
    .in("id", userIds);

  // Platform sending domain — all emails go out from this address.
  // The user's display name is shown in the inbox; their sender_email becomes Reply-To.
  const platformFrom = process.env.RESEND_FROM_EMAIL?.trim() || null;

  type ProfileRow = { replyTo: string | null; fromHeader: string | null };
  const profileByUser = new Map<string, ProfileRow>(
    (profiles ?? []).map((p) => {
      const displayName = (p.sender_display_name as string | null)?.trim()
        || (p.business_name as string | null)?.trim()
        || null;
      const fromHeader = platformFrom
        ? displayName ? `${displayName} <${platformFrom}>` : platformFrom
        : null;
      const replyTo = (p.sender_email as string | null)?.trim() || null;
      return [p.id as string, { fromHeader, replyTo }];
    })
  );

  const errors: string[] = [];
  let processed = 0;

  // Per-campaign outcome tracking
  const perCampaign = new Map<string, { sent: number; failed: number; errors: string[] }>();
  function campaignTrack(id: string) {
    if (!perCampaign.has(id)) perCampaign.set(id, { sent: 0, failed: 0, errors: [] });
    return perCampaign.get(id)!;
  }

  for (const row of batch) {
    const uid = row.user_id as string;
    const campaignId = row.campaign_id as string;
    const profile = profileByUser.get(uid);
    const fromHeader = profile?.fromHeader ?? null;
    const replyTo = profile?.replyTo ?? undefined;

    if (!fromHeader) {
      const msg = "RESEND_FROM_EMAIL is not configured on the server. Contact the platform administrator.";
      errors.push(`${row.id}: ${msg}`);
      campaignTrack(campaignId).failed++;
      campaignTrack(campaignId).errors.push(`${row.to_email}: Sender not configured`);
      await supabase
        .from("outbound_email")
        .update({ status: "failed", error_message: msg, updated_at: nowIso() })
        .eq("id", row.id);
      continue;
    }

    const result = await sendWithResend(
      row.to_email as string,
      row.subject as string,
      row.html_body as string,
      fromHeader,
      replyTo
    );

    if (!result.ok) {
      const clearError = explainResendSendFailure(result.error, {
        platformFrom,
        fromHeader,
        replyTo: replyTo ?? null,
      });
      errors.push(`${row.id}: ${clearError}`);
      campaignTrack(campaignId).failed++;
      campaignTrack(campaignId).errors.push(`${row.to_email}: ${clearError}`);
      await supabase
        .from("outbound_email")
        .update({ status: "failed", error_message: clearError, updated_at: nowIso() })
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
      campaignTrack(campaignId).failed++;
      campaignTrack(campaignId).errors.push(`${row.to_email}: DB update failed — ${upErr.message}`);
      continue;
    }

    processed++;
    campaignTrack(campaignId).sent++;
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

  return { processed, errors, campaignIds, campaignSummaries };
}
