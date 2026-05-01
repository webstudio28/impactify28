"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function SignOutButton() {
  const router = useRouter();

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={() => void signOut()}
      className="mt-4 rounded-md px-2 py-2 text-left text-sm text-ink-muted hover:bg-surface-muted hover:text-ink"
    >
      Sign out
    </button>
  );
}
