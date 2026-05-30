import { createHmac, timingSafeEqual } from "crypto";

type SalesTokenPayload = {
  v: 1;
  cid: string;
  uid: string;
};

function secret(): string {
  const s = process.env.TRACKING_HMAC_SECRET?.trim();
  if (!s) throw new Error("TRACKING_HMAC_SECRET is not set");
  return s;
}

function base64UrlEncode(input: string): string {
  return Buffer.from(input, "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function base64UrlDecode(input: string): string {
  const normalized = input.replace(/-/g, "+").replace(/_/g, "/");
  const pad = normalized.length % 4;
  const padded = pad ? normalized + "=".repeat(4 - pad) : normalized;
  return Buffer.from(padded, "base64").toString("utf8");
}

function sign(encoded: string): string {
  return createHmac("sha256", secret()).update(encoded).digest("hex");
}

/** Public ?cmp= token for landing-page attribution (append to store URLs). */
export function createCampaignSalesToken(campaignId: string, userId: string): string {
  const payload: SalesTokenPayload = { v: 1, cid: campaignId, uid: userId };
  const encoded = base64UrlEncode(JSON.stringify(payload));
  return `${encoded}.${sign(encoded)}`;
}

export function verifyCampaignSalesToken(
  token: string
): { ok: true; campaignId: string; userId: string } | { ok: false } {
  const parts = token.trim().split(".");
  if (parts.length !== 2) return { ok: false };
  const [encoded, providedSignature] = parts;
  const expected = sign(encoded);
  const a = Buffer.from(providedSignature, "utf8");
  const b = Buffer.from(expected, "utf8");
  if (a.length !== b.length || !timingSafeEqual(a, b)) return { ok: false };

  try {
    const payload = JSON.parse(base64UrlDecode(encoded)) as SalesTokenPayload;
    if (payload.v !== 1 || !payload.cid || !payload.uid) return { ok: false };
    return { ok: true, campaignId: payload.cid, userId: payload.uid };
  } catch {
    return { ok: false };
  }
}
