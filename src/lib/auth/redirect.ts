export function getClientOrigin(): string {
  if (typeof window === "undefined") return "";
  return window.location.origin;
}

/** Supabase OAuth `redirectTo` — must match an allowed redirect URL in Supabase Auth settings. */
export function buildAuthCallbackUrl(nextPath: string = "/dashboard"): string {
  const origin = getClientOrigin();
  if (!origin) return "";
  const path = nextPath.startsWith("/") && !nextPath.startsWith("//") ? nextPath : "/dashboard";
  const encodedNext = encodeURIComponent(path);
  return `${origin}/auth/callback?next=${encodedNext}`;
}
