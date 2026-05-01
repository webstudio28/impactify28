import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

/**
 * Guestcap-style admin client — service role, no session persistence.
 * Required for cron / trusted server paths that bypass RLS.
 */
export function createAdminClient() {
  if (!supabaseServiceKey?.trim()) {
    throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY (required for admin DB operations).");
  }
  if (!supabaseUrl?.trim()) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL is missing");
  }
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
