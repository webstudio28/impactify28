"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { OAUTH_NEXT_KEY } from "@/lib/auth/google";

const exchangeKeyFor = (code: string) => `impact28_oauth_exchanged_${code}`;

function localeFromNextPath(path: string): string {
  const m = path.match(/^\/(en|bg)(\/|$)/);
  return m?.[1] ?? "en";
}

function loginPath(pathForLocale: string, error?: boolean) {
  const base = `/${localeFromNextPath(pathForLocale)}/login`;
  return error ? `${base}?error=auth` : base;
}

function AuthCallbackHandler() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<"exchanging" | "done" | "error">("exchanging");

  useEffect(() => {
    const supabase = createClient();
    const code = searchParams.get("code");
    const storedNext =
      typeof window !== "undefined" ? sessionStorage.getItem(OAUTH_NEXT_KEY) : null;
    const nextParam = searchParams.get("next");
    const next =
      (nextParam?.startsWith("/") && !nextParam.startsWith("//") ? nextParam : null) ??
      (storedNext?.startsWith("/") && !storedNext.startsWith("//") ? storedNext : null) ??
      "/en/dashboard";
    const errorParam = searchParams.get("error");

    if (errorParam) {
      router.replace(loginPath(next, true));
      return;
    }

    if (!code) {
      router.replace(loginPath(next));
      return;
    }

    let cancelled = false;

    void (async () => {
      const exchangeKey = exchangeKeyFor(code);
      if (sessionStorage.getItem(exchangeKey) === "1") {
        if (!cancelled) {
          setStatus("done");
          sessionStorage.removeItem(OAUTH_NEXT_KEY);
          router.replace(next);
          router.refresh();
        }
        return;
      }

      const {
        data: { session: existingSession },
      } = await supabase.auth.getSession();
      if (existingSession) {
        if (!cancelled) {
          setStatus("done");
          sessionStorage.removeItem(OAUTH_NEXT_KEY);
          router.replace(next);
          router.refresh();
        }
        return;
      }

      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (error) {
        const msg = String(error.message || "");
        if (msg.toLowerCase().includes("pkce code verifier not found")) {
          const {
            data: { session: after },
          } = await supabase.auth.getSession();
          if (after) {
            if (!cancelled) {
              setStatus("done");
              sessionStorage.removeItem(OAUTH_NEXT_KEY);
              router.replace(next);
              router.refresh();
            }
            return;
          }
        }
        if (!cancelled) {
          console.error("[auth/callback]", msg);
          setStatus("error");
          router.replace(loginPath(next, true));
        }
        return;
      }

      sessionStorage.setItem(exchangeKey, "1");
      if (!cancelled) {
        setStatus("done");
        sessionStorage.removeItem(OAUTH_NEXT_KEY);
        router.replace(next);
        router.refresh();
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [searchParams, router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface px-6">
      <p className="text-sm text-ink-muted">
        {status === "exchanging" && "Signing you in…"}
        {status === "done" && "Redirecting…"}
        {status === "error" && "Something went wrong. Redirecting…"}
      </p>
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-surface">
          <p className="text-sm text-ink-muted">Loading…</p>
        </div>
      }
    >
      <AuthCallbackHandler />
    </Suspense>
  );
}
