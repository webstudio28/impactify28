import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { incrementLiveMetric } from "@/lib/campaigns/event-metrics";
import { redis } from "@/lib/redis";

const PREVIEW_AGENTS =
  /facebookexternalhit|twitterbot|slackbot|discordbot|whatsapp|telegrambot|linkedinbot|googlebot|bingpreview|applebot|embedly|quora link preview|redditbot|rogerbot|showyoubot|outbrain|vkshare|w3c_validator/i;

/** Ignore rapid repeat hits (link preview + tap) from the same client. */
const DEDUPE_TTL_SECONDS = 45;

function clientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return req.headers.get("x-real-ip")?.trim() || "unknown";
}

function shouldCountRequest(req: Request): boolean {
  if (req.method === "HEAD") return false;

  const ua = req.headers.get("user-agent") ?? "";
  if (PREVIEW_AGENTS.test(ua)) return false;

  const mode = req.headers.get("sec-fetch-mode");
  if (mode && mode !== "navigate") return false;

  return true;
}

/**
 * Record one short-link click (Redis per-link counter + campaign live metrics).
 * Dedupes preview scanners and back-to-back requests from the same IP.
 */
export async function recordShortLinkClick(
  code: string,
  req: Request,
  supabase?: SupabaseClient
): Promise<void> {
  if (!shouldCountRequest(req)) return;

  const dedupeKey = `click_dedupe:${code}:${clientIp(req)}`;
  const firstInWindow = await redis.set(dedupeKey, "1", { nx: true, ex: DEDUPE_TTL_SECONDS });
  if (!firstInWindow) return;

  await redis.incr(`clicks:${code}`);

  try {
    const db = supabase ?? createAdminClient();
    const { data: link } = await db
      .from("short_links")
      .select("campaign_id")
      .eq("code", code)
      .maybeSingle();

    if (link?.campaign_id) {
      await incrementLiveMetric(db, link.campaign_id as string, "click_count");
    }
  } catch (e) {
    console.error("[recordShortLinkClick]", e instanceof Error ? e.message : e);
  }
}
