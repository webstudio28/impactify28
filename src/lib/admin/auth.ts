import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Verifies the current user is an admin.
 * Returns the admin Supabase client and the user id on success.
 * Throws a NextResponse with 401/403 on failure (catch and return it in route handlers).
 */
export async function requireAdminApi(): Promise<{
  userId: string;
  db: ReturnType<typeof createAdminClient>;
}> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") {
    throw NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return { userId: user.id, db: createAdminClient() };
}

/**
 * Used in server components (pages/layouts).
 * Returns { userId, email } if the current session belongs to an admin user, otherwise null.
 * Errors are logged so intermittent auth failures are visible in server logs.
 */
export async function getAdminUser(): Promise<{
  userId: string;
  email: string | undefined;
} | null> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authErr,
    } = await supabase.auth.getUser();
    if (authErr) {
      console.error("[getAdminUser] auth.getUser error:", authErr.message);
      return null;
    }
    if (!user) return null;

    const { data: profile, error: profileErr } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profileErr) {
      console.error("[getAdminUser] profile fetch error:", profileErr.message);
      return null;
    }

    if (profile?.role !== "admin") return null;
    return { userId: user.id, email: user.email };
  } catch (e) {
    console.error("[getAdminUser] unexpected error:", e);
    return null;
  }
}
