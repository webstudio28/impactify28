import { redis } from "@/lib/redis";

const HOURLY_LIMIT = 1000;

export async function checkSalesIngestRateLimit(workspaceId: string): Promise<boolean> {
  const hour = Math.floor(Date.now() / (60 * 60 * 1000));
  const key = `sales:ingest:${workspaceId}:${hour}`;
  const count = await redis.incr(key);
  if (count === 1) {
    await redis.expire(key, 60 * 60 * 2);
  }
  return count <= HOURLY_LIMIT;
}
