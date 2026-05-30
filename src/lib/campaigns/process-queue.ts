import type { SupabaseClient } from "@supabase/supabase-js";
import { sendSms } from "@/lib/sms";
import type { CampaignSendSummary } from "@/lib/tickets/create-ticket";
import {
  evaluateBatchAndMaybePause,
  handleCriticalProviderFailure,
} from "@/lib/campaigns/incident";
import { classifySendError, logCampaignEvent } from "@/lib/campaigns/event-log";
import { toCanonicalStatus } from "@/lib/campaigns/state-machine";

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

export type SmsProcessOptions = {
  limit?: number;
  campaignId?: string;
  cursor?: number;
};

export type SmsProcessResult = {
  processed: number;
  errors: string[];
  campaignIds: string[];
  skippedRateLimit: number;
  /** Per-campaign summaries — used by cron/routes to create tickets */
  campaignSummaries: CampaignSendSummary[];
  /** Set when the SMS provider is not configured — caller should create a critical ticket */
  providerError: string | null;
  nextCursor?: number;
};

/**
 * Sends due outbound SMS for campaigns in `running` status (paused campaigns are skipped).
 * Returns per-campaign summaries so callers can create appropriate tickets.
 */
export async function processDueOutboundSms(
  supabase: SupabaseClient,
  options?: SmsProcessOptions
): Promise<SmsProcessResult> {
  const limit = options?.limit ?? 80;
  const cursor = options?.cursor ?? 0;
  const singleCampaignId = options?.campaignId?.trim();
  const ts = nowIso();

  // Provider config check — fail fast before any DB work
  const smsProvider = process.env.SMS_PROVIDER?.toLowerCase().trim();
  if (!smsProvider) {
    const providerError =
      "SMS_PROVIDER environment variable is not set. Supported: budgetsms, connectix, twilio, vonage.";
    const { data: activeCampaigns } = await supabase
      .from("campaigns")
      .select("id")
      .in("status", ["running", "queued", "in_progress"]);
    for (const c of activeCampaigns ?? []) {
      await handleCriticalProviderFailure(
        supabase,
        c.id as string,
        "sms",
        providerError,
        "sms_provider_not_configured"
      );
    }
    return {
      processed: 0,
      errors: ["SMS_PROVIDER is not set"],
      campaignIds: [],
      skippedRateLimit: 0,
      campaignSummaries: [],
      providerError,
    };
  }

  let running: { id: string; name: string | null; user_id: string | null }[] = [];

  if (singleCampaignId) {
    const { data: row, error: cErr } = await supabase
      .from("campaigns")
      .select("id, name, user_id, status")
      .eq("id", singleCampaignId)
      .maybeSingle();
    if (cErr) throw cErr;
    if (!row || toCanonicalStatus(row.status as string) !== "in_progress") {
      return {
        processed: 0,
        errors: [],
        campaignIds: [],
        skippedRateLimit: 0,
        campaignSummaries: [],
        providerError: null,
        nextCursor: cursor,
      };
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
      .in("status", ["running", "queued", "in_progress"]);
    if (rErr) throw rErr;
    running = (rows ?? []) as typeof running;
  }

  if (!running.length) {
    return {
      processed: 0,
      errors: [],
      campaignIds: [],
      skippedRateLimit: 0,
      campaignSummaries: [],
      providerError: null,
      nextCursor: cursor,
    };
  }

  const runningIds = running.map((r) => r.id).filter(Boolean);
  const campaignMeta = new Map(
    running.map((r) => [r.id, { name: r.name, userId: r.user_id }])
  );

  let batchQuery = supabase
    .from("outbound_sms")
    .select("id, campaign_id, to_phone, body")
    .eq("status", "pending")
    .lte("run_at", ts)
    .in("campaign_id", runningIds)
    .order("run_at", { ascending: true })
    .order("id", { ascending: true });

  batchQuery = batchQuery.limit(limit);

  const { data: batch, error } = await batchQuery;

  if (error) throw error;
  if (!batch?.length) {
    return {
      processed: 0,
      errors: [],
      campaignIds: [],
      skippedRateLimit: 0,
      campaignSummaries: [],
      providerError: null,
      nextCursor: cursor,
    };
  }

  const nextCursor = singleCampaignId ? cursor + batch.length : undefined;

  const errors: string[] = [];
  let processed = 0;
  let skippedRateLimit = 0;
  const opts = smsOptions();

  // Track per-campaign outcomes
  const perCampaign = new Map<string, { sent: number; failed: number; errors: string[] }>();
  const batchWindow = new Map<string, { sent: number; failed: number }>();
  const pausedCampaigns = new Set<string>();
  function campaignTrack(id: string) {
    if (!perCampaign.has(id)) perCampaign.set(id, { sent: 0, failed: 0, errors: [] });
    return perCampaign.get(id)!;
  }
  function batchTrack(id: string) {
    if (!batchWindow.has(id)) batchWindow.set(id, { sent: 0, failed: 0 });
    return batchWindow.get(id)!;
  }

  for (const row of batch) {
    const campaignId = row.campaign_id as string | null;
    if (!campaignId) continue;
    if (pausedCampaigns.has(campaignId)) continue;

    const { data: statusRow } = await supabase
      .from("campaigns")
      .select("status")
      .eq("id", campaignId)
      .maybeSingle();
    if (toCanonicalStatus((statusRow?.status as string) ?? "") !== "in_progress") continue;

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
        const errorClass = classifySendError(msg, { statusCode: result.status, provider: "sms" });
        errors.push(`${row.id}: ${msg}`);
        campaignTrack(campaignId).failed++;
        campaignTrack(campaignId).errors.push(`${row.to_phone}: ${msg}`);
        batchTrack(campaignId).failed++;
        await logCampaignEvent(supabase, {
          campaign_id: campaignId,
          recipient_id: row.id as string,
          event_type: "failed",
          provider: "sms",
          error_class: errorClass,
          error_code: String(result.status),
          error_message: msg,
        });
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

        if (errorClass === "system_critical" || result.status === 401) {
          await handleCriticalProviderFailure(supabase, campaignId, "sms", msg);
          pausedCampaigns.add(campaignId);
          continue;
        }

        const w = batchTrack(campaignId);
        const paused = await evaluateBatchAndMaybePause(
          supabase,
          campaignId,
          w.sent,
          w.failed,
          "sms"
        );
        if (paused) pausedCampaigns.add(campaignId);
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
      batchTrack(campaignId).sent++;
      await logCampaignEvent(supabase, {
        campaign_id: campaignId,
        recipient_id: row.id as string,
        event_type: "sent",
        provider: "sms",
        provider_event_id: ref,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      const errorClass = classifySendError(msg, { provider: "sms" });
      errors.push(`${row.id}: ${msg}`);
      campaignTrack(campaignId).failed++;
      campaignTrack(campaignId).errors.push(`${row.to_phone ?? row.id}: ${msg}`);
      batchTrack(campaignId).failed++;
      await logCampaignEvent(supabase, {
        campaign_id: campaignId,
        recipient_id: row.id as string,
        event_type: "failed",
        provider: "sms",
        error_class: errorClass,
        error_message: msg,
      });
      await rollbackRateSlot(supabase, campaignId, reserved);
      reserved = false;
      await supabase
        .from("outbound_sms")
        .update({ status: "failed", error_message: msg, updated_at: nowIso() })
        .eq("id", row.id);

      const w = batchTrack(campaignId);
      const paused = await evaluateBatchAndMaybePause(
        supabase,
        campaignId,
        w.sent,
        w.failed,
        "sms"
      );
      if (paused) pausedCampaigns.add(campaignId);
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

  return {
    processed,
    errors,
    campaignIds,
    skippedRateLimit,
    campaignSummaries,
    providerError: null,
    nextCursor,
  };
}
