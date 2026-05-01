"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { GoogleGlyph } from "@/components/auth/GoogleGlyph";
import { createClient } from "@/lib/supabase/client";
import { startGoogleOAuth } from "@/lib/auth/google";
import { withLocalePrefix } from "@/lib/i18n/with-locale-path";

export function LoginForm() {
  const t = useTranslations("login");
  const router = useRouter();
  const searchParams = useSearchParams();
  const locale = useLocale();
  const raw = searchParams.get("redirect") ?? searchParams.get("next");
  const redirectPath = useMemo(() => {
    const base =
      raw?.startsWith("/") && !raw.startsWith("//") ? raw : `/${locale}/dashboard`;
    return withLocalePrefix(base, locale);
  }, [raw, locale]);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  useEffect(() => {
    if (searchParams.get("error") === "auth") {
      setError(t("googleFailed"));
    }
  }, [searchParams, t]);

  async function onGoogle() {
    setError(null);
    setGoogleLoading(true);
    const { error: oauthError } = await startGoogleOAuth(redirectPath);
    setGoogleLoading(false);
    if (oauthError) {
      setError(oauthError);
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const supabase = createClient();
    const { error: signError } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (signError) {
      setError(signError.message);
      return;
    }
    router.replace(redirectPath);
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <button
        type="button"
        onClick={() => void onGoogle()}
        disabled={googleLoading || loading}
        className="flex w-full items-center justify-center gap-2 rounded-lg border border-zinc-200 bg-white px-4 py-2.5 text-sm font-medium text-ink shadow-sm transition hover:bg-zinc-50 disabled:opacity-60"
      >
        <GoogleGlyph />
        {googleLoading ? t("redirecting") : t("continueGoogle")}
      </button>

      <div className="relative">
        <div className="absolute inset-0 flex items-center" aria-hidden="true">
          <div className="w-full border-t border-zinc-200" />
        </div>
        <div className="relative flex justify-center text-xs uppercase tracking-wide">
          <span className="bg-surface px-2 text-ink-muted">{t("orEmail")}</span>
        </div>
      </div>

      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-ink">{t("email")}</label>
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none ring-accent/30 focus:ring-2"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-ink">{t("password")}</label>
          <input
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none ring-accent/30 focus:ring-2"
          />
        </div>
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        <button
          type="submit"
          disabled={loading || googleLoading}
          className="w-full rounded-lg bg-accent py-2.5 text-sm font-medium text-white transition hover:bg-accent-hover disabled:opacity-60"
        >
          {loading ? t("signingIn") : t("submit")}
        </button>
      </form>
    </div>
  );
}
