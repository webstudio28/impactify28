import { redis } from "@/lib/redis";
import { createClient } from "@/lib/supabase/server";

const ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789";
const CODE_LENGTH = 6;

function generateCode(): string {
  let code = "";
  for (let i = 0; i < CODE_LENGTH; i++) {
    code += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  }
  return code;
}

export async function shortenUrl(
  originalUrl: string,
  campaignId: string,
  userId: string
): Promise<string> {
  const supabase = await createClient();

  // Reuse existing short link for the same campaign + destination URL.
  // This keeps per-link analytics and avoids deleting older campaign links.
  const { data: existing, error: existingErr } = await supabase
    .from("short_links")
    .select("code")
    .eq("campaign_id", campaignId)
    .eq("original_url", originalUrl)
    .limit(1)
    .maybeSingle();
  if (existingErr) throw existingErr;
  if (existing?.code) {
    await redis.set(`link:${existing.code}`, originalUrl);
    return existing.code as string;
  }

  let code = generateCode();

  // Ensure uniqueness — retry up to 20 times on collision
  for (let attempt = 0; attempt < 20; attempt++) {
    const taken = await redis.get(`link:${code}`);
    if (!taken) break;
    code = generateCode();
  }

  // Write to Redis — no expiry, links are permanent
  await redis.set(`link:${code}`, originalUrl);

  // Write to Supabase for analytics
  const { error: insErr } = await supabase.from("short_links").insert({
    code,
    original_url: originalUrl,
    campaign_id: campaignId,
    user_id: userId,
  });
  if (insErr) throw insErr;

  return code;
}
