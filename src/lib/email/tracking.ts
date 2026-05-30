import { createHmac, createHash, timingSafeEqual } from "crypto";
import { configuredShortLinkHost } from "@/lib/links/short-domain";

export type TrackingKind = "open" | "click" | "unsub" | "view";

type TrackingPayload = {
  v: 1;
  k: TrackingKind;
  rid: string;
  cid: string;
  exp: number | null;
  u?: string;
};

const DEFAULT_BASE = "http://localhost:3000";

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

function hmacSecret(): string {
  const secret = process.env.TRACKING_HMAC_SECRET?.trim();
  if (!secret) {
    throw new Error("TRACKING_HMAC_SECRET is not set");
  }
  return secret;
}

function trackingBaseUrl(): string {
  const raw =
    process.env.TRACKING_BASE_URL?.trim()
    || process.env.NEXT_PUBLIC_SITE_URL?.trim()
    || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "")
    || DEFAULT_BASE;
  return raw.endsWith("/") ? raw.slice(0, -1) : raw;
}

function sign(encodedPayload: string): string {
  return createHmac("sha256", hmacSecret()).update(encodedPayload).digest("hex");
}

export function hashDestination(value: string): string {
  const normalized = value.trim().toLowerCase();
  return createHash("sha256").update(normalized).digest("hex");
}

export function createTrackingToken(params: {
  kind: TrackingKind;
  recipientId: string;
  campaignId: string;
  targetUrl?: string;
  expiresAt?: Date | null;
}): string {
  const payload: TrackingPayload = {
    v: 1,
    k: params.kind,
    rid: params.recipientId,
    cid: params.campaignId,
    exp: params.expiresAt ? params.expiresAt.getTime() : null,
    u: params.targetUrl,
  };
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signature = sign(encodedPayload);
  return `${encodedPayload}.${signature}`;
}

export function verifyTrackingToken(token: string): {
  ok: boolean;
  payload?: TrackingPayload;
  error?: string;
} {
  const parts = token.split(".");
  if (parts.length !== 2) return { ok: false, error: "Invalid token format" };
  const [encodedPayload, providedSignature] = parts;
  const expectedSignature = sign(encodedPayload);
  const provided = Buffer.from(providedSignature, "utf8");
  const expected = Buffer.from(expectedSignature, "utf8");
  if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) {
    return { ok: false, error: "Invalid signature" };
  }

  try {
    const payload = JSON.parse(base64UrlDecode(encodedPayload)) as TrackingPayload;
    if (payload.v !== 1) return { ok: false, error: "Unsupported token version" };
    if (!payload.k || !payload.rid || !payload.cid) return { ok: false, error: "Invalid token payload" };
    if (payload.exp && Date.now() > payload.exp) return { ok: false, error: "Token expired" };
    return { ok: true, payload };
  } catch {
    return { ok: false, error: "Invalid token payload" };
  }
}

export function buildTrackingUrl(path: string): string {
  return `${trackingBaseUrl()}${path.startsWith("/") ? path : `/${path}`}`;
}

export function buildOpenPixelUrl(token: string): string {
  return buildTrackingUrl(`/api/t/o/${encodeURIComponent(token)}`);
}

export function buildClickRedirectUrl(token: string): string {
  return buildTrackingUrl(`/api/t/c/${encodeURIComponent(token)}`);
}

export function buildUnsubscribeUrl(token: string): string {
  return buildTrackingUrl(`/api/u/${encodeURIComponent(token)}`);
}

export function buildViewInBrowserUrl(token: string): string {
  return buildTrackingUrl(`/api/v/${encodeURIComponent(token)}`);
}

export function extractShortCodeFromUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    const shortHost = configuredShortLinkHost().toLowerCase().replace(/^www\./, "");
    const host = parsed.hostname.toLowerCase().replace(/^www\./, "");
    if (host !== shortHost) return null;
    const code = parsed.pathname.replace(/^\/+/, "").split("/")[0] ?? "";
    return code || null;
  } catch {
    return null;
  }
}

