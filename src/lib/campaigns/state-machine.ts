import type { SupabaseClient } from "@supabase/supabase-js";

export type CampaignCanonicalStatus =
  | "draft"
  | "ready"
  | "in_progress"
  | "paused_user"
  | "paused_system"
  | "completed"
  | "cancelled"
  | "failed_terminal";

export type CampaignActor = "user" | "admin" | "system";

type TransitionOptions = {
  actor: CampaignActor;
  reasonCode?: string | null;
  reasonMessage?: string | null;
};

const LEGACY_TO_CANONICAL: Record<string, CampaignCanonicalStatus> = {
  ready_to_launch: "ready",
  running: "in_progress",
  paused: "paused_user",
};

const CANONICAL_TO_LEGACY: Partial<Record<CampaignCanonicalStatus, string>> = {
  ready: "ready_to_launch",
  in_progress: "running",
  paused_user: "paused",
};

const ALLOWED_TRANSITIONS: Record<CampaignCanonicalStatus, CampaignCanonicalStatus[]> = {
  draft: ["ready"],
  ready: ["in_progress"],
  in_progress: ["paused_user", "paused_system", "completed", "failed_terminal"],
  paused_user: ["in_progress", "cancelled"],
  paused_system: ["in_progress"],
  completed: [],
  cancelled: [],
  failed_terminal: [],
};

export function toCanonicalStatus(status: string): CampaignCanonicalStatus | null {
  if (!status) return null;
  if (status in LEGACY_TO_CANONICAL) return LEGACY_TO_CANONICAL[status];
  switch (status) {
    case "draft":
    case "ready":
    case "in_progress":
    case "paused_user":
    case "paused_system":
    case "completed":
    case "cancelled":
    case "failed_terminal":
      return status;
    default:
      return null;
  }
}

export function toStoredStatus(status: CampaignCanonicalStatus): string {
  // Keep legacy statuses until UI and dashboards are fully migrated.
  // Flip CAMPAIGN_STATUS_V2=true once the frontend/admin layers are updated.
  const useV2 = process.env.CAMPAIGN_STATUS_V2 === "true";
  if (useV2) return status;
  return CANONICAL_TO_LEGACY[status] ?? status;
}

export async function transitionCampaign(
  supabase: SupabaseClient,
  campaignId: string,
  target: CampaignCanonicalStatus,
  options: TransitionOptions
): Promise<{ ok: true; status: CampaignCanonicalStatus } | { ok: false; error: string }> {
  const { data: row, error } = await supabase
    .from("campaigns")
    .select("id, status, started_at")
    .eq("id", campaignId)
    .maybeSingle();
  if (error || !row) return { ok: false, error: "Campaign not found" };

  const current = toCanonicalStatus(row.status as string);
  if (!current) return { ok: false, error: "Unknown campaign status" };

  if (current === target) {
    return { ok: true, status: target };
  }

  if (!(ALLOWED_TRANSITIONS[current] ?? []).includes(target)) {
    return { ok: false, error: `Invalid transition: ${current} -> ${target}` };
  }

  const patch: Record<string, unknown> = {
    status: toStoredStatus(target),
    updated_at: new Date().toISOString(),
  };

  if (target === "in_progress" && !row.started_at) {
    patch.started_at = new Date().toISOString();
  }

  if (target === "paused_user") {
    patch.paused_by = "user";
    patch.paused_reason_code = null;
    patch.paused_reason_message = null;
  }

  if (target === "paused_system") {
    patch.paused_by = "system";
    patch.paused_reason_code = options.reasonCode ?? "system_error";
    patch.paused_reason_message = options.reasonMessage ?? "Campaign was paused automatically due to system errors.";
  }

  if (target === "in_progress" || target === "completed" || target === "cancelled") {
    patch.paused_by = null;
    patch.paused_reason_code = null;
    patch.paused_reason_message = null;
  }

  const { error: upErr } = await supabase.from("campaigns").update(patch).eq("id", campaignId);
  if (upErr) return { ok: false, error: upErr.message };

  return { ok: true, status: target };
}

export async function pauseCampaignSystem(
  supabase: SupabaseClient,
  campaignId: string,
  reasonCode: string,
  reasonMessage: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  return transitionCampaign(supabase, campaignId, "paused_system", {
    actor: "system",
    reasonCode,
    reasonMessage,
  });
}

