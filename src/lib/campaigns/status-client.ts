import { toCanonicalStatus, type CampaignCanonicalStatus } from "@/lib/campaigns/state-machine";

export { toCanonicalStatus, type CampaignCanonicalStatus };

export function isCampaignLiveStatus(status: string): boolean {
  const canonical = toCanonicalStatus(status);
  return canonical === "in_progress" || status === "running" || status === "queued";
}

export function campaignDeleteNeedsRunningConfirm(status: string): boolean {
  return isCampaignLiveStatus(status);
}

export function canShowResults(campaign: {
  started_at?: string | null;
  status: string;
}): boolean {
  if (campaign.started_at) return true;
  const canonical = toCanonicalStatus(campaign.status);
  return (
    canonical === "in_progress" ||
    canonical === "paused_user" ||
    canonical === "paused_system" ||
    canonical === "completed" ||
    canonical === "cancelled" ||
    canonical === "failed_terminal"
  );
}

export function isPausedBySystem(campaign: {
  status: string;
  paused_by?: string | null;
}): boolean {
  const canonical = toCanonicalStatus(campaign.status);
  return canonical === "paused_system" || campaign.paused_by === "system";
}
