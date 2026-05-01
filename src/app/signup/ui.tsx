"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { GoogleGlyph } from "@/components/auth/GoogleGlyph";
import { createClient } from "@/lib/supabase/client";
import { startGoogleOAuth } from "@/lib/auth/google";

export function SignupForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const raw = searchParams.get("redirect") ?? searchParams.get("next");
  const redirectPath =
    raw?.startsWith("/") && !raw.startsWith("//") ? raw : "/dashboard";
  const [businessName, setBusinessName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

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
    const { error: signError } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { business_name: businessName || "My business" } },
    });
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
        {googleLoading ? "Redirecting…" : "Continue with Google"}
      </button>

      <div className="relative">
        <div className="absolute inset-0 flex items-center" aria-hidden="true">
          <div className="w-full border-t border-zinc-200" />
        </div>
        <div className="relative flex justify-center text-xs uppercase tracking-wide">
          <span className="bg-surface px-2 text-ink-muted">Or email</span>
        </div>
      </div>

      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-ink">Business name</label>
          <input
            type="text"
            value={businessName}
            onChange={(e) => setBusinessName(e.target.value)}
            placeholder="e.g. Northwind Shop"
            className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none ring-accent/30 focus:ring-2"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-ink">Work email</label>
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
          <label className="block text-sm font-medium text-ink">Password</label>
          <input
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none ring-accent/30 focus:ring-2"
          />
          <p className="mt-1 text-xs text-ink-muted">At least 8 characters.</p>
        </div>
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        <button
          type="submit"
          disabled={loading || googleLoading}
          className="w-full rounded-lg bg-accent py-2.5 text-sm font-medium text-white transition hover:bg-accent-hover disabled:opacity-60"
        >
          {loading ? "Creating…" : "Create account"}
        </button>
      </form>
    </div>
  );
}
