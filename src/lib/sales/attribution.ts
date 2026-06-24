import { createCampaignSalesToken } from "@/lib/sales/campaign-token";
import { isOurShortUrl } from "@/lib/links/short-domain";

function isHttpUrl(url: string): boolean {
  const t = url.trim();
  if (!t || t.startsWith("#")) return false;
  const lower = t.toLowerCase();
  if (lower.startsWith("mailto:") || lower.startsWith("tel:") || lower.startsWith("javascript:")) {
    return false;
  }
  return /^https?:\/\//i.test(t) || !t.includes(":");
}

/** Skip Impact28 tracking/unsubscribe endpoints — not store landing pages. */
function isOurTrackingUrl(url: string): boolean {
  try {
    const u = new URL(/^https?:\/\//i.test(url) ? url : `https://${url}`);
    const path = u.pathname;
    return (
      path.startsWith("/api/t/") ||
      path.startsWith("/api/u/") ||
      path.startsWith("/api/v/") ||
      path.startsWith("/api/track/")
    );
  } catch {
    return false;
  }
}

/**
 * Append signed `cmp` for campaign sales attribution (read by tracker.js on the store).
 */
export function appendCampaignSalesParam(url: string, campaignId: string, userId: string): string {
  const raw = url?.trim();
  if (!raw || !isHttpUrl(raw) || isOurTrackingUrl(raw) || isOurShortUrl(raw)) return url;

  try {
    const normalized = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
    const parsed = new URL(normalized);
    if (parsed.searchParams.has("cmp")) return url;

    const token = createCampaignSalesToken(campaignId, userId);
    parsed.searchParams.set("cmp", token);
    return parsed.toString();
  } catch {
    return url;
  }
}
