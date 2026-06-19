import type { SupabaseClient } from "@supabase/supabase-js";
import { explainResendSendFailure } from "@/lib/email/resend-errors";
import type { CampaignSendSummary } from "@/lib/tickets/create-ticket";
import { redis } from "@/lib/redis";
import { hashDestination } from "@/lib/email/tracking";
import { injectTrackingForEmail } from "@/lib/email/inject-tracking";
import { injectLogoIntoHtml } from "@/lib/openai/generate-campaign-email";
import {
  evaluateBatchAndMaybePause,
  handleCriticalProviderFailure,
} from "@/lib/campaigns/incident";
import { classifySendError, logCampaignEvent } from "@/lib/campaigns/event-log";
import { toCanonicalStatus } from "@/lib/campaigns/state-machine";

const nowIso = () => new Date().toISOString();
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const EMAIL_CLAIM_TIMEOUT_MS = 15 * 60 * 1000;

type ResendBatchItemResult =
  | { ok: true; id: string | null; to: string }
  | { ok: false; error: string; statusCode?: number };
type ResendBatchResult =
  | { ok: true; items: ResendBatchItemResult[] }
  | { ok: false; error: string; statusCode?: number; retryAfterMs?: number };

type BatchSendInput = {
  rowId: string;
  userId: string;
  campaignId: string;
  to: string;
  subject: string;
  html: string;
};

async function waitForEmailRateSlot(): Promise<void> {
  const effectiveRpsRaw = process.env.EMAIL_EFFECTIVE_RPS?.trim();
  const effectiveRps = Math.max(1, Number.parseInt(effectiveRpsRaw ?? "4", 10) || 4);
  const secondWindow = Math.floor(Date.now() / 1000);
  const key = `email:rps:${secondWindow}`;
  const count = await redis.incr(key);
  if (count === 1) {
    await redis.expire(key, 2);
  }
  if (count > effectiveRps) {
    const waitMs = Math.max(50, (secondWindow + 1) * 1000 - Date.now());
    await sleep(waitMs);
  }
}

async function sendBatchWithResend(
  rows: BatchSendInput[],
  from: string,
  replyTo?: string
): Promise<ResendBatchResult> {
  const key = process.env.RESEND_API_KEY?.trim();
  if (!key) return { ok: false, error: "RESEND_API_KEY is not set", statusCode: 0, retryAfterMs: undefined };
  if (!from) return { ok: false, error: "Sender address is not configured", statusCode: 0 };

  const emails = rows.map((row) => {
    const payload: Record<string, unknown> = {
      from,
      to: [row.to],
      subject: row.subject,
      html: row.html,
    };
    if (replyTo) payload.reply_to = [replyTo];
    return payload;
  });

  await waitForEmailRateSlot();

  const res = await fetch("https://api.resend.com/emails/batch", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(emails),
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
    const retryAfterSec = Number.parseInt(res.headers.get("retry-after") ?? "", 10);
    const retryAfterMs = Number.isFinite(retryAfterSec) && retryAfterSec > 0 ? retryAfterSec * 1000 : undefined;
    return { ok: false, error: msg, statusCode: res.status, retryAfterMs };
  }

  let parsed: unknown = null;
  try {
    parsed = JSON.parse(text);
  } catch {
    parsed = null;
  }

  const data = (
    parsed &&
    typeof parsed === "object" &&
    "data" in parsed &&
    Array.isArray((parsed as { data?: unknown[] }).data)
  )
    ? (parsed as { data: unknown[] }).data
    : [];

  const items: ResendBatchItemResult[] = rows.map((row, idx) => {
    const entry = data[idx];
    if (entry && typeof entry === "object") {
      const item = entry as { id?: unknown; error?: unknown };
      const maybeId = typeof item.id === "string" ? item.id : null;
      if (maybeId) {
        return { ok: true, id: maybeId, to: row.to };
      }
      if (typeof item.error === "string" && item.error.trim()) {
        return { ok: false, error: item.error };
      }
      if (item.error && typeof item.error === "object" && "message" in item.error) {
        const message = (item.error as { message?: unknown }).message;
        if (typeof message === "string" && message.trim()) {
          return { ok: false, error: message };
        }
      }
    }
    return { ok: true, id: null, to: row.to };
  });

  return { ok: true, items };
}

export type EmailProcessOptions = {
  limit?: number;
  /** When set, only process this campaign (QStash worker mode). */
  campaignId?: string;
  /** Offset into due pending rows (ordered by run_at, id). */
  cursor?: number;
};

export type EmailProcessResult = {
  processed: number;
  errors: string[];
  campaignIds: string[];
  /** Per-campaign summaries — used by cron/routes to create tickets */
  campaignSummaries: CampaignSendSummary[];
  nextCursor?: number;
};

/**
 * Sends due outbound_email for running campaigns (same pattern as SMS queue).
 * Returns per-campaign summaries so callers can create appropriate tickets.
 */
export async function processDueOutboundEmail(
  supabase: SupabaseClient,
  options?: EmailProcessOptions
): Promise<EmailProcessResult> {
  const limit = options?.limit ?? 400;
  const cursor = options?.cursor ?? 0;
  const singleCampaignId = options?.campaignId?.trim();
  const batchSizeRaw = process.env.EMAIL_BATCH_SIZE?.trim();
  const batchSize = Math.min(100, Math.max(1, Number.parseInt(batchSizeRaw ?? "100", 10) || 100));
  const ts = nowIso();
  const staleClaimCutoff = new Date(Date.now() - EMAIL_CLAIM_TIMEOUT_MS).toISOString();

  let staleClaimQuery = supabase
    .from("outbound_email")
    .update({ status: "pending", updated_at: ts })
    .eq("status", "sending")
    .lt("updated_at", staleClaimCutoff);
  if (singleCampaignId) staleClaimQuery = staleClaimQuery.eq("campaign_id", singleCampaignId);
  const { error: staleClaimErr } = await staleClaimQuery;
  if (staleClaimErr) throw staleClaimErr;

  let running: { id: string; name: string | null; user_id: string | null }[] = [];

  if (singleCampaignId) {
    const { data: row, error: cErr } = await supabase
      .from("campaigns")
      .select("id, name, user_id, status")
      .eq("id", singleCampaignId)
      .maybeSingle();
    if (cErr) throw cErr;
    if (!row || toCanonicalStatus(row.status as string) !== "in_progress") {
      return { processed: 0, errors: [], campaignIds: [], campaignSummaries: [], nextCursor: cursor };
    }
    running = [
      {
        id: row.id as string,
        name: row.name as string | null,
        user_id: row.user_id as string | null,
      },
    ];
  } else {
    const { data: rows, error: rErr } = await supabase
      .from("campaigns")
      .select("id, name, user_id")
      .in("status", ["running", "in_progress", "queued"]);
    if (rErr) throw rErr;
    running = (rows ?? []) as typeof running;
  }

  if (!running.length) {
    return { processed: 0, errors: [], campaignIds: [], campaignSummaries: [], nextCursor: cursor };
  }

  const runningIds = running.map((r) => r.id).filter(Boolean);
  const campaignMeta = new Map(
    running.map((r) => [r.id, { name: r.name, userId: r.user_id }])
  );

  let batchQuery = supabase
    .from("outbound_email")
    .select("id, user_id, campaign_id, to_email, status")
    .eq("status", "pending")
    .lte("run_at", ts)
    .in("campaign_id", runningIds)
    .order("run_at", { ascending: true })
    .order("id", { ascending: true });

  batchQuery = batchQuery.limit(limit);

  const { data: batch, error } = await batchQuery;

  if (error) throw error;
  if (!batch?.length) {
    return { processed: 0, errors: [], campaignIds: [], campaignSummaries: [], nextCursor: cursor };
  }

  const candidateIds = batch.map((row) => row.id as string);
  const { data: claimedBatch, error: claimErr } = await supabase
    .from("outbound_email")
    .update({ status: "sending", updated_at: ts })
    .in("id", candidateIds)
    .eq("status", "pending")
    .select("id, user_id, campaign_id, to_email, status");

  if (claimErr) throw claimErr;
  if (!claimedBatch?.length) {
    return { processed: 0, errors: [], campaignIds: [], campaignSummaries: [], nextCursor: cursor };
  }

  const nextCursor = singleCampaignId ? cursor + claimedBatch.length : undefined;

  const userIds = Array.from(
    new Set(claimedBatch.map((r) => r.user_id as string).filter((id): id is string => typeof id === "string" && id.length > 0))
  );

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, sender_email, sender_display_name, business_name, logo_url")
    .in("id", userIds);

  // Platform sending domain — all emails go out from this address.
  // The user's display name is shown in the inbox; their sender_email becomes Reply-To.
  const platformFrom = process.env.RESEND_FROM_EMAIL?.trim() || null;

  type ProfileRow = { replyTo: string | null; fromHeader: string | null; logoUrl: string | null };
  const profileByUser = new Map<string, ProfileRow>(
    (profiles ?? []).map((p) => {
      const displayName = (p.sender_display_name as string | null)?.trim()
        || (p.business_name as string | null)?.trim()
        || null;
      const fromHeader = platformFrom
        ? displayName ? `${displayName} <${platformFrom}>` : platformFrom
        : null;
      const replyTo = (p.sender_email as string | null)?.trim() || null;
      const logoUrl = (p.logo_url as string | null)?.trim() || null;
      return [p.id as string, { fromHeader, replyTo, logoUrl }];
    })
  );

  const errors: string[] = [];
  let processed = 0;
  const campaignContentCache = new Map<string, { subject: string; html: string }>();

  // Per-campaign outcome tracking
  const perCampaign = new Map<string, { sent: number; failed: number; errors: string[] }>();
  function campaignTrack(id: string) {
    if (!perCampaign.has(id)) perCampaign.set(id, { sent: 0, failed: 0, errors: [] });
    return perCampaign.get(id)!;
  }

  const byCampaign = new Map<string, typeof claimedBatch>();
  for (const row of claimedBatch) {
    const campaignId = row.campaign_id as string;
    if (!byCampaign.has(campaignId)) byCampaign.set(campaignId, []);
    byCampaign.get(campaignId)!.push(row);
  }

  for (const [campaignId, rows] of byCampaign.entries()) {
    const { data: statusRow } = await supabase
      .from("campaigns")
      .select("status")
      .eq("id", campaignId)
      .maybeSingle();
    const canonical = statusRow ? toCanonicalStatus(statusRow.status as string) : null;
    if (canonical !== "in_progress") {
      await supabase
        .from("outbound_email")
        .update({ status: "pending", updated_at: nowIso() })
        .in("id", rows.map((row) => row.id as string))
        .eq("status", "sending");
      continue;
    }

    const first = rows[0];
    const uid = first.user_id as string;
    const profile = profileByUser.get(uid);
    const fromHeader = profile?.fromHeader ?? null;
    const replyTo = profile?.replyTo ?? undefined;

    if (!fromHeader) {
      const msg = "RESEND_FROM_EMAIL is not configured on the server. Contact the platform administrator.";
      for (const row of rows) {
        errors.push(`${row.id}: ${msg}`);
        campaignTrack(campaignId).failed++;
        campaignTrack(campaignId).errors.push(`${row.to_email}: Sender not configured`);
        await supabase
          .from("outbound_email")
          .update({ status: "failed", error_message: msg, updated_at: nowIso() })
          .eq("id", row.id);
      }
      continue;
    }

    if (!campaignContentCache.has(campaignId)) {
      const { data: campaignContent, error: cErr } = await supabase
        .from("campaigns")
        .select("email_subject, email_html")
        .eq("id", campaignId)
        .maybeSingle();
      if (cErr || !campaignContent) {
        const errMsg = cErr?.message ?? "Campaign content not found";
        for (const row of rows) {
          errors.push(`${row.id}: ${errMsg}`);
          campaignTrack(campaignId).failed++;
          campaignTrack(campaignId).errors.push(`${row.to_email}: ${errMsg}`);
          await supabase
            .from("outbound_email")
            .update({ status: "failed", error_message: errMsg, updated_at: nowIso() })
            .eq("id", row.id);
        }
        continue;
      }
      const subject = typeof campaignContent.email_subject === "string" ? campaignContent.email_subject.trim() : "";
      const htmlRaw = typeof campaignContent.email_html === "string" ? campaignContent.email_html.trim() : "";
      const html = injectLogoIntoHtml(htmlRaw, profile?.logoUrl ?? null);
      if (!subject || !html) {
        const errMsg = "Campaign email content is empty";
        for (const row of rows) {
          errors.push(`${row.id}: ${errMsg}`);
          campaignTrack(campaignId).failed++;
          campaignTrack(campaignId).errors.push(`${row.to_email}: ${errMsg}`);
          await supabase
            .from("outbound_email")
            .update({ status: "failed", error_message: errMsg, updated_at: nowIso() })
            .eq("id", row.id);
        }
        continue;
      }
      campaignContentCache.set(campaignId, { subject, html });
    }

    const content = campaignContentCache.get(campaignId)!;
    let campaignPaused = false;
    for (let i = 0; i < rows.length; i += batchSize) {
      if (campaignPaused) break;
      const slice = rows.slice(i, i + batchSize);
      let batchSent = 0;
      let batchFailed = 0;
      const ids = slice.map((row) => row.id as string);
      const { data: pendingRows, error: pendingErr } = await supabase
        .from("outbound_email")
        .select("id, to_email, status")
        .in("id", ids);
      if (pendingErr) {
        for (const row of slice) {
          errors.push(`${row.id}: ${pendingErr.message}`);
          campaignTrack(campaignId).failed++;
          campaignTrack(campaignId).errors.push(`${row.to_email}: DB check failed - ${pendingErr.message}`);
        }
        continue;
      }
      const stillClaimed = (pendingRows ?? []).filter((row) => row.status === "sending");
      if (!stillClaimed.length) continue;
      const suppressionHashes = stillClaimed.map((row) => hashDestination(row.to_email as string));
      const { data: suppressionRows, error: suppressionErr } = await supabase
        .from("suppression_list")
        .select("destination_hash")
        .eq("user_id", uid)
        .eq("channel", "email")
        .in("destination_hash", suppressionHashes);
      if (suppressionErr) {
        for (const row of stillClaimed) {
          errors.push(`${row.id}: suppression check failed: ${suppressionErr.message}`);
          campaignTrack(campaignId).failed++;
          campaignTrack(campaignId).errors.push(`${row.to_email}: suppression check failed`);
        }
        continue;
      }
      const suppressed = new Set((suppressionRows ?? []).map((r) => r.destination_hash as string));

      const sendRows: BatchSendInput[] = [];
      for (const row of stillClaimed) {
        const email = row.to_email as string;
        const digest = hashDestination(email);
        if (suppressed.has(digest)) {
          await supabase
            .from("outbound_email")
            .update({
              status: "failed",
              error_message: "Recipient unsubscribed/suppressed",
              updated_at: nowIso(),
            })
            .eq("id", row.id);
          continue;
        }
        sendRows.push({
          rowId: row.id as string,
          userId: uid,
          campaignId,
          to: row.to_email as string,
          subject: content.subject,
          html: injectTrackingForEmail({
            html: content.html,
            recipientId: row.id as string,
            campaignId,
            userId: uid,
          }),
        });
      }
      if (!sendRows.length) continue;

      let result = await sendBatchWithResend(
        sendRows,
        fromHeader,
        replyTo
      );
      if (!result.ok && result.statusCode === 429) {
        await sleep(result.retryAfterMs ?? 1500);
        result = await sendBatchWithResend(
          sendRows,
          fromHeader,
          replyTo
        );
      }

      if (!result.ok) {
        const clearError = explainResendSendFailure(result.error, {
          platformFrom,
          fromHeader,
          replyTo: replyTo ?? null,
        });
        const errorClass = classifySendError(clearError, {
          statusCode: result.statusCode,
          provider: "resend",
        });
        const isCritical =
          errorClass === "system_critical" ||
          !process.env.RESEND_API_KEY?.trim() ||
          result.statusCode === 401;

        for (const row of sendRows) {
          errors.push(`${row.rowId}: ${clearError}`);
          campaignTrack(campaignId).failed++;
          campaignTrack(campaignId).errors.push(`${row.to}: ${clearError}`);
          batchFailed++;
          await logCampaignEvent(supabase, {
            campaign_id: campaignId,
            recipient_id: row.rowId,
            event_type: "failed",
            provider: "resend",
            error_class: errorClass,
            error_code: result.statusCode ? String(result.statusCode) : null,
            error_message: clearError,
          });
          await supabase
            .from("outbound_email")
            .update({ status: "failed", error_message: clearError, updated_at: nowIso() })
            .eq("id", row.rowId);
        }

        if (isCritical) {
          await handleCriticalProviderFailure(supabase, campaignId, "email", clearError);
          campaignPaused = true;
          break;
        }

        const paused = await evaluateBatchAndMaybePause(
          supabase,
          campaignId,
          batchSent,
          batchFailed,
          "email"
        );
        if (paused) {
          campaignPaused = true;
          break;
        }
        continue;
      }

      for (const [idx, item] of result.items.entries()) {
        const row = sendRows[idx];
        if (!row) continue;
        if (!item.ok) {
          const clearError = explainResendSendFailure(item.error, {
            platformFrom,
            fromHeader,
            replyTo: replyTo ?? null,
          });
          const errorClass = classifySendError(clearError, { provider: "resend" });
          errors.push(`${row.rowId}: ${clearError}`);
          campaignTrack(campaignId).failed++;
          campaignTrack(campaignId).errors.push(`${row.to}: ${clearError}`);
          batchFailed++;
          await logCampaignEvent(supabase, {
            campaign_id: campaignId,
            recipient_id: row.rowId,
            event_type: "failed",
            provider: "resend",
            error_class: errorClass,
            error_message: clearError,
          });
          await supabase
            .from("outbound_email")
            .update({ status: "failed", error_message: clearError, updated_at: nowIso() })
            .eq("id", row.rowId);
          continue;
        }

        const { error: upErr } = await supabase
          .from("outbound_email")
          .update({
            status: "sent",
            provider_message_id: item.id,
            error_message: null,
            updated_at: nowIso(),
          })
          .eq("id", row.rowId);

        if (upErr) {
          errors.push(`${row.rowId}: ${upErr.message}`);
          campaignTrack(campaignId).failed++;
          campaignTrack(campaignId).errors.push(`${row.to}: DB update failed - ${upErr.message}`);
          batchFailed++;
          continue;
        }

        processed++;
        campaignTrack(campaignId).sent++;
        batchSent++;
        await logCampaignEvent(supabase, {
          campaign_id: campaignId,
          recipient_id: row.rowId,
          event_type: "sent",
          provider: "resend",
          provider_event_id: item.id,
        });
      }

      if (!campaignPaused) {
        const paused = await evaluateBatchAndMaybePause(
          supabase,
          campaignId,
          batchSent,
          batchFailed,
          "email"
        );
        if (paused) campaignPaused = true;
      }
    }
  }

  const campaignIds = Array.from(
    new Set(claimedBatch.map((r) => r.campaign_id).filter((id): id is string => typeof id === "string" && id.length > 0))
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

  return { processed, errors, campaignIds, campaignSummaries, nextCursor };
}
