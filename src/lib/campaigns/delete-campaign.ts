import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { isCampaignLiveStatus } from "@/lib/campaigns/status-client";
import { toCanonicalStatus, transitionCampaign } from "@/lib/campaigns/state-machine";

type DeleteResult =
  | { ok: true; action: "deleted" | "cancelled"; status?: string }
  | { ok: false; error: string; httpStatus?: number };

function canHardDelete(rawStatus: string, canonical: ReturnType<typeof toCanonicalStatus>): boolean {
  if (rawStatus === "draft" || rawStatus === "rejected" || rawStatus === "pending_approval") return true;
  if (canonical === "ready") return true;
  if (canonical === "completed" || canonical === "cancelled" || canonical === "failed_terminal") return true;
  if (rawStatus === "failed") return true;
  return false;
}

async function hardDeleteCampaign(
  supabase: SupabaseClient,
  id: string,
  isAdmin: boolean
): Promise<DeleteResult> {
  let data: { id: string }[] | null = null;
  let error: { message: string } | null = null;

  try {
    const client = isAdmin ? createAdminClient() : supabase;
    const res = await client.from("campaigns").delete().eq("id", id).select("id");
    data = res.data;
    error = res.error;
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Server error";
    if (isAdmin && msg.includes("SUPABASE_SERVICE_ROLE_KEY")) {
      return {
        ok: false,
        error: "Admin campaign delete requires SUPABASE_SERVICE_ROLE_KEY on the server.",
        httpStatus: 503,
      };
    }
    return { ok: false, error: msg, httpStatus: 500 };
  }

  if (error) return { ok: false, error: error.message, httpStatus: 500 };
  if (!data?.length) return { ok: false, error: "Not found", httpStatus: 404 };
  return { ok: true, action: "deleted" };
}

async function cancelCampaign(
  supabase: SupabaseClient,
  id: string,
  actor: "user" | "admin"
): Promise<DeleteResult> {
  const cancelled = await transitionCampaign(supabase, id, "cancelled", { actor });
  if (!cancelled.ok) return { ok: false, error: cancelled.error, httpStatus: 400 };
  return { ok: true, action: "cancelled", status: cancelled.status };
}

/** Stop a live campaign (pause if needed) then mark cancelled. */
async function stopAndCancelCampaign(
  supabase: SupabaseClient,
  id: string,
  canonical: ReturnType<typeof toCanonicalStatus>
): Promise<DeleteResult> {
  if (canonical === "in_progress") {
    const paused = await transitionCampaign(supabase, id, "paused_user", { actor: "user" });
    if (!paused.ok) return { ok: false, error: paused.error, httpStatus: 400 };
  }

  return cancelCampaign(supabase, id, "user");
}

export async function deleteUserCampaign(
  supabase: SupabaseClient,
  id: string,
  options: { isAdmin: boolean }
): Promise<DeleteResult> {
  const { data: campaign, error: campaignErr } = await supabase
    .from("campaigns")
    .select("id, user_id, status")
    .eq("id", id)
    .maybeSingle();

  if (campaignErr || !campaign) return { ok: false, error: "Not found", httpStatus: 404 };

  const rawStatus = campaign.status as string;
  const canonical = toCanonicalStatus(rawStatus);

  if (isCampaignLiveStatus(rawStatus) || canonical === "in_progress") {
    return stopAndCancelCampaign(supabase, id, canonical);
  }

  if (canonical === "paused_user" || canonical === "paused_system") {
    return cancelCampaign(supabase, id, options.isAdmin ? "admin" : "user");
  }

  if (canHardDelete(rawStatus, canonical)) {
    return hardDeleteCampaign(supabase, id, options.isAdmin);
  }

  return {
    ok: false,
    error: "This campaign cannot be deleted in its current state.",
    httpStatus: 400,
  };
}
