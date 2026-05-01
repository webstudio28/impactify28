import { createClient } from "@/lib/supabase/client";
import { buildAuthCallbackUrl } from "./redirect";

export const OAUTH_NEXT_KEY = "impact28_oauth_next";

export async function startGoogleOAuth(redirectPath: string): Promise<{ error: string | null }> {
  try {
    if (typeof window !== "undefined") {
      sessionStorage.setItem(OAUTH_NEXT_KEY, redirectPath);
    }
    const callbackUrl = buildAuthCallbackUrl(redirectPath);
    if (!callbackUrl) {
      return { error: "Could not build sign-in URL. Try again." };
    }
    const supabase = createClient();
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: callbackUrl },
    });
    if (error) {
      return { error: error.message };
    }
    if (data?.url) {
      window.location.href = data.url;
      return { error: null };
    }
    return { error: "No redirect URL returned. Check Supabase Google provider settings." };
  } catch {
    return { error: "Google sign-in failed. Try again." };
  }
}
