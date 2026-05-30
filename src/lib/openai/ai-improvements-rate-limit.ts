import { redis } from "@/lib/redis";

const HOURLY_LIMIT = 10;

export async function checkAiImprovementsRateLimit(userId: string): Promise<boolean> {
  const hour = Math.floor(Date.now() / (60 * 60 * 1000));
  const key = `ai:improve:${userId}:${hour}`;
  const count = await redis.incr(key);
  if (count === 1) {
    await redis.expire(key, 60 * 60 * 2);
  }
  return count <= HOURLY_LIMIT;
}
