const DEFAULT = "http://localhost:3000";

/** Public app origin for tracker script, callbacks, and snippets. */
export function publicAppOrigin(): string {
  const raw =
    process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "") ||
    DEFAULT;
  return raw.endsWith("/") ? raw.slice(0, -1) : raw;
}
