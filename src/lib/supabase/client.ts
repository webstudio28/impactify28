import { createBrowserClient } from "@supabase/ssr";

/**
 * Browser-only Supabase client (Guestcap-aligned env keys).
 * Throws only when invoked without env vars — safe to import during static prerender.
 */
export function createClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!supabaseUrl?.trim()) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL is missing");
  }
  if (!supabaseKey?.trim()) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_ANON_KEY or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"
    );
  }

  return createBrowserClient(supabaseUrl, supabaseKey);
}
