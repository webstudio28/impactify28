import { localeFromPathname, withLocalePrefix } from "@/lib/i18n/with-locale-path";

export function getClientOrigin(): string {
  if (typeof window === "undefined") return "";
  return window.location.origin;
}

/** Supabase OAuth `redirectTo` — must match an allowed redirect URL in Supabase Auth settings. */
export function buildAuthCallbackUrl(nextPath: string = "/dashboard", pathname?: string): string {
  const origin = getClientOrigin();
  if (!origin) return "";
  const path = nextPath.startsWith("/") && !nextPath.startsWith("//") ? nextPath : "/dashboard";
  const loc = pathname ? localeFromPathname(pathname) : "en";
  const localized = withLocalePrefix(path, loc);
  const encodedNext = encodeURIComponent(localized);
  return `${origin}/auth/callback?next=${encodedNext}`;
}
