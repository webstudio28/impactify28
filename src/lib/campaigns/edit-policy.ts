/** Campaign statuses where the owner may change content (wizard / builder). */
export const CAMPAIGN_CONTENT_EDITABLE_STATUSES = new Set([
  "draft",
  "rejected",
  "pending_approval",
  "ready_to_launch",
]);

/** Campaign statuses that may be (re)submitted for moderation. */
export const CAMPAIGN_SUBMITTABLE_STATUSES = new Set([
  "draft",
  "rejected",
  "pending_approval",
  "ready_to_launch",
]);

export function canEditCampaignContent(status: string): boolean {
  return CAMPAIGN_CONTENT_EDITABLE_STATUSES.has(status);
}

export function canSubmitCampaignForApproval(status: string): boolean {
  return CAMPAIGN_SUBMITTABLE_STATUSES.has(status);
}

/** Edit flow: resubmit from wizard steps (not first-time draft creation). */
export function isCampaignWizardEditMode(status: string): boolean {
  return status !== "draft" && canEditCampaignContent(status);
}
