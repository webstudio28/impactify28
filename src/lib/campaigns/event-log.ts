import type { SupabaseClient } from "@supabase/supabase-js";

export type CampaignEventInsert = {
  campaign_id: string;
  recipient_id?: string | null;
  event_type: string;
  event_time?: string;
  provider?: string | null;
  provider_event_id?: string | null;
  stage?: string | null;
  error_class?: string | null;
  error_code?: string | null;
  error_message?: string | null;
  latency_ms?: number | null;
  payload?: Record<string, unknown> | null;
  correlation_id?: string | null;
};

export function classifySendError(
  message: string,
  options?: { statusCode?: number; provider?: string }
): "contact_invalid" | "provider_transient" | "system_critical" {
  const lower = message.toLowerCase();
  const code = options?.statusCode;

  if (
    !process.env.RESEND_API_KEY?.trim() &&
    options?.provider === "resend"
  ) {
    return "system_critical";
  }
  if (lower.includes("resend_api_key") || lower.includes("api key") || code === 401) {
    return "system_critical";
  }
  if (code === 429 || code === 503 || lower.includes("rate limit") || lower.includes("timeout")) {
    return "provider_transient";
  }
  if (lower.includes("invalid") || lower.includes("bounce") || lower.includes("suppressed")) {
    return "contact_invalid";
  }
  return "provider_transient";
}

/** Non-throwing insert into campaign_events. */
export async function logCampaignEvent(
  supabase: SupabaseClient,
  event: CampaignEventInsert
): Promise<void> {
  try {
    const { error } = await supabase.from("campaign_events").insert({
      campaign_id: event.campaign_id,
      recipient_id: event.recipient_id ?? null,
      event_type: event.event_type,
      event_time: event.event_time ?? new Date().toISOString(),
      provider: event.provider ?? null,
      provider_event_id: event.provider_event_id ?? null,
      stage: event.stage ?? null,
      error_class: event.error_class ?? null,
      error_code: event.error_code ?? null,
      error_message: event.error_message ?? null,
      latency_ms: event.latency_ms ?? null,
      payload: event.payload ?? null,
      correlation_id: event.correlation_id ?? null,
    });
    if (error) {
      console.error("[logCampaignEvent]", error.message, event.event_type, event.campaign_id);
    }
  } catch (e) {
    console.error(
      "[logCampaignEvent] unexpected:",
      e instanceof Error ? e.message : e,
      event.event_type,
      event.campaign_id
    );
  }
}
