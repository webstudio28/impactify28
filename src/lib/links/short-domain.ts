/** Host only, e.g. rvo5.com — works on server and client (NEXT_PUBLIC_ on client). */
export function configuredShortLinkHost(): string {
  const raw = (process.env.SHORT_DOMAIN ?? process.env.NEXT_PUBLIC_SHORT_DOMAIN ?? "rvo5.com").trim();
  return raw.replace(/^https?:\/\//i, "").split("/")[0] || "rvo5.com";
}

export function shortLinkPublicUrl(code: string): string {
  return `https://${configuredShortLinkHost()}/${code}`;
}

/** True if URL already points at our short-link host (avoid double-shortening). */
export function isOurShortUrl(url: string): boolean {
  const t = url.trim();
  if (!t) return false;
  try {
    const normalized = /^https?:\/\//i.test(t) ? t : `https://${t}`;
    const h = new URL(normalized).hostname.toLowerCase().replace(/^www\./, "");
    const d = configuredShortLinkHost().toLowerCase().replace(/^www\./, "");
    return h === d;
  } catch {
    return false;
  }
}
