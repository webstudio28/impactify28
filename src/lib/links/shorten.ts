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

  // Remove previous short_links rows for this campaign from the DB so only one
  // appears in analytics. We intentionally leave the Redis redirect keys intact
  // — old codes already sent in SMS messages must keep resolving.
  await supabase.from("short_links").delete().eq("campaign_id", campaignId);

  let code = generateCode();

  // Ensure uniqueness — retry up to 5 times on collision
  for (let attempt = 0; attempt < 5; attempt++) {
    const taken = await redis.get(`link:${code}`);
    if (!taken) break;
    code = generateCode();
  }

  // Write to Redis — no expiry, links are permanent
  await redis.set(`link:${code}`, originalUrl);

  // Write to Supabase for analytics
  await supabase.from("short_links").insert({
    code,
    original_url: originalUrl,
    campaign_id: campaignId,
    user_id: userId,
  });

  return code;
}
