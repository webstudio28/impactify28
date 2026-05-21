"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";

// ─── Types ───────────────────────────────────────────────────────────────────

type Tab = "general" | "business" | "security";

type ProfileData = {
  business_name: string | null;
  logo_url: string | null;
  sender_email: string | null;
  sender_display_name: string | null;
};

// ─── Small helpers ────────────────────────────────────────────────────────────

function TabBtn({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full rounded-md px-3 py-2 text-left text-sm transition ${
        active
          ? "bg-white font-medium text-ink shadow-sm"
          : "text-ink-muted hover:bg-zinc-100 hover:text-ink"
      }`}
    >
      {children}
    </button>
  );
}

function SuccessBanner({ message }: { message: string }) {
  return (
    <p className="rounded-lg border border-green-200 bg-green-50 px-3.5 py-2.5 text-sm text-green-700">
      {message}
    </p>
  );
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <p className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700">
      {message}
    </p>
  );
}

// ─── General tab ─────────────────────────────────────────────────────────────

function GeneralTab({ profile, onProfileChange }: { profile: ProfileData; onProfileChange: (p: Partial<ProfileData>) => void }) {
  const t = useTranslations("profileSettings");
  const router = useRouter();

  const [displayName, setDisplayName] = useState(profile.sender_display_name ?? "");
  const [replyEmail, setReplyEmail] = useState(profile.sender_email ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    setSaving(true);
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sender_display_name: displayName.trim() || null,
          sender_email: replyEmail.trim().toLowerCase() || null,
        }),
      });
      const json = (await res.json()) as { profile?: ProfileData; error?: string };
      if (!res.ok) { setError(json.error ?? t("saveFailed")); return; }
      onProfileChange({
        sender_display_name: json.profile?.sender_display_name ?? null,
        sender_email: json.profile?.sender_email ?? null,
      });
      setSuccess(true);
      router.refresh();
    } catch { setError(t("saveFailed")); }
    finally { setSaving(false); }
  }

  return (
    <div className="space-y-8">
      <div>
        <h3 className="text-base font-semibold text-ink">{t("generalTitle")}</h3>
        <p className="mt-1 text-sm text-ink-muted">{t("generalSubtitle")}</p>
      </div>

      <form onSubmit={handleSubmit(handleSave)} className="space-y-4">
        <div>
          <label htmlFor="ps-name" className="mb-1.5 block text-sm font-medium text-ink">
            {t("displayNameLabel")} <span className="text-red-500">*</span>
          </label>
          <input
            id="ps-name"
            type="text"
            autoFocus
            maxLength={100}
            placeholder={t("displayNamePlaceholder")}
            value={displayName}
            onChange={(e) => { setDisplayName(e.target.value); setSuccess(false); }}
            className="w-full rounded-lg border border-zinc-300 px-3.5 py-2.5 text-sm text-ink placeholder:text-zinc-400 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
          />
          <p className="mt-1.5 text-xs text-ink-muted">{t("displayNameHint")}</p>
        </div>
        <div>
          <label htmlFor="ps-reply" className="mb-1.5 block text-sm font-medium text-ink">
            {t("replyEmailLabel")}
          </label>
          <input
            id="ps-reply"
            type="email"
            autoComplete="off"
            placeholder={t("replyEmailPlaceholder")}
            value={replyEmail}
            onChange={(e) => { setReplyEmail(e.target.value); setSuccess(false); }}
            className="w-full rounded-lg border border-zinc-300 px-3.5 py-2.5 text-sm text-ink placeholder:text-zinc-400 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
          />
          <p className="mt-1.5 text-xs text-ink-muted">{t("replyEmailHint")}</p>
        </div>
        {error && <ErrorBanner message={error} />}
        {success && <SuccessBanner message={t("saveSuccess")} />}
        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-accent-hover disabled:opacity-50"
        >
          {saving ? t("saving") : t("saveChanges")}
        </button>
      </form>
    </div>
  );
}

// helper to allow passing the event to the save handler
function handleSubmit(fn: (e: React.FormEvent) => Promise<void>) {
  return (e: React.FormEvent) => { void fn(e); };
}

// ─── Business tab ─────────────────────────────────────────────────────────────

function BusinessTab({ profile, onProfileChange }: { profile: ProfileData; onProfileChange: (p: Partial<ProfileData>) => void }) {
  const t = useTranslations("profileSettings");
  const [businessName, setBusinessName] = useState(profile.business_name ?? "");
  const [logoUrl, setLogoUrl] = useState<string | null>(profile.logo_url);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleSaveBusinessName(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    setSaving(true);
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ business_name: businessName.trim() || null }),
      });
      const json = (await res.json()) as { profile?: ProfileData; error?: string };
      if (!res.ok) { setError(json.error ?? t("saveFailed")); return; }
      onProfileChange({ business_name: json.profile?.business_name ?? null });
      setSuccess(true);
    } catch { setError(t("saveFailed")); }
    finally { setSaving(false); }
  }

  async function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/profile/logo", { method: "POST", body: form });
      const json = (await res.json()) as { logo_url?: string; error?: string };
      if (!res.ok) { setError(json.error ?? t("saveFailed")); return; }
      setLogoUrl(json.logo_url ?? null);
      onProfileChange({ logo_url: json.logo_url ?? null });
    } catch { setError(t("saveFailed")); }
    finally { setUploading(false); if (fileRef.current) fileRef.current.value = ""; }
  }

  return (
    <div className="space-y-8">
      <div>
        <h3 className="text-base font-semibold text-ink">{t("businessTitle")}</h3>
        <p className="mt-1 text-sm text-ink-muted">{t("businessSubtitle")}</p>
      </div>

      {/* Logo */}
      <div>
        <p className="mb-3 text-sm font-medium text-ink">{t("logoLabel")}</p>
        <div className="flex items-center gap-4">
          <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl border border-zinc-200 bg-zinc-50">
            {logoUrl ? (
              <img src={logoUrl} alt="Logo" className="h-full w-full object-contain p-1" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-2xl text-zinc-300">
                🏢
              </div>
            )}
          </div>
          <div>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="rounded-lg border border-zinc-300 px-3.5 py-2 text-sm font-medium text-ink transition hover:bg-zinc-50 disabled:opacity-50"
            >
              {uploading ? t("uploading") : t("changeLogo")}
            </button>
            <p className="mt-1 text-xs text-ink-muted">{t("logoHint")}</p>
          </div>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          className="hidden"
          onChange={(e) => void handleLogoChange(e)}
        />
      </div>

      {/* Business name */}
      <form onSubmit={handleSubmit(handleSaveBusinessName)} className="space-y-4">
        <div>
          <label htmlFor="ps-biz" className="mb-1.5 block text-sm font-medium text-ink">
            {t("businessNameLabel")}
          </label>
          <input
            id="ps-biz"
            type="text"
            maxLength={120}
            placeholder={t("businessNamePlaceholder")}
            value={businessName}
            onChange={(e) => { setBusinessName(e.target.value); setSuccess(false); }}
            className="w-full rounded-lg border border-zinc-300 px-3.5 py-2.5 text-sm text-ink placeholder:text-zinc-400 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
          />
        </div>
        {error && <ErrorBanner message={error} />}
        {success && <SuccessBanner message={t("saveSuccess")} />}
        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-accent-hover disabled:opacity-50"
        >
          {saving ? t("saving") : t("saveChanges")}
        </button>
      </form>
    </div>
  );
}

// ─── Security tab ─────────────────────────────────────────────────────────────

function SecurityTab({ userEmail }: { userEmail: string }) {
  const t = useTranslations("profileSettings");
  const router = useRouter();
  const [step, setStep] = useState<"idle" | "confirm">("idle");
  const [confirmInput, setConfirmInput] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canDelete = confirmInput.trim().toLowerCase() === userEmail.toLowerCase();

  async function handleDelete() {
    if (!canDelete) return;
    setError(null);
    setDeleting(true);
    try {
      const res = await fetch("/api/account/delete", { method: "DELETE" });
      if (!res.ok) {
        const json = (await res.json()) as { error?: string };
        setError(json.error ?? t("deleteFailed"));
        return;
      }
      // Sign out locally and redirect
      const supabase = createClient();
      await supabase.auth.signOut();
      router.replace("/");
      router.refresh();
    } catch { setError(t("deleteFailed")); }
    finally { setDeleting(false); }
  }

  return (
    <div className="space-y-8">
      <div>
        <h3 className="text-base font-semibold text-ink">{t("securityTitle")}</h3>
        <p className="mt-1 text-sm text-ink-muted">{t("securitySubtitle")}</p>
      </div>

      {/* Danger zone */}
      <div className="rounded-xl border border-red-200 p-5">
        <h4 className="text-sm font-semibold text-red-700">{t("dangerZoneTitle")}</h4>
        <p className="mt-1.5 text-sm text-ink-muted">{t("deleteAccountDesc")}</p>

        {step === "idle" && (
          <button
            type="button"
            onClick={() => setStep("confirm")}
            className="mt-4 rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-700 transition hover:bg-red-50"
          >
            {t("deleteAccountBtn")}
          </button>
        )}

        {step === "confirm" && (
          <div className="mt-4 space-y-3">
            <p className="text-sm text-ink">
              {t("deleteConfirmPrompt")}{" "}
              <span className="font-mono font-semibold text-ink">{userEmail}</span>
            </p>
            <input
              type="email"
              autoComplete="off"
              placeholder={userEmail}
              value={confirmInput}
              onChange={(e) => setConfirmInput(e.target.value)}
              className="w-full rounded-lg border border-zinc-300 px-3.5 py-2.5 text-sm text-ink placeholder:text-zinc-400 focus:border-red-400 focus:outline-none focus:ring-2 focus:ring-red-200"
            />
            {error && <ErrorBanner message={error} />}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => { setStep("idle"); setConfirmInput(""); setError(null); }}
                className="rounded-lg border border-zinc-200 px-4 py-2 text-sm font-medium text-ink-muted transition hover:bg-zinc-50"
              >
                {t("cancel")}
              </button>
              <button
                type="button"
                onClick={() => void handleDelete()}
                disabled={!canDelete || deleting}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {deleting ? t("deleting") : t("deleteConfirmBtn")}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main modal ───────────────────────────────────────────────────────────────

interface Props {
  onClose: () => void;
  userEmail: string;
}

export function ProfileSettingsModal({ onClose, userEmail }: Props) {
  const t = useTranslations("profileSettings");
  const [tab, setTab] = useState<Tab>("general");
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);

  const loadProfile = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/profile");
      if (!res.ok) return;
      const json = (await res.json()) as { profile?: ProfileData };
      if (json.profile) setProfile(json.profile);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadProfile(); }, [loadProfile]);

  // Close on Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  function handleProfileChange(patch: Partial<ProfileData>) {
    setProfile((prev) => (prev ? { ...prev, ...patch } : prev));
  }

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    {
      id: "general",
      label: t("tabGeneral"),
      icon: (
        <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.75} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 9v.906a2.25 2.25 0 0 1-1.183 1.981l-6.478 3.488M2.25 9v.906a2.25 2.25 0 0 0 1.183 1.981l6.478 3.488m8.839 2.51-4.66-2.51m0 0-1.023-.55a2.25 2.25 0 0 0-2.134 0l-1.022.55m0 0-4.661 2.51" />
        </svg>
      ),
    },
    {
      id: "business",
      label: t("tabBusiness"),
      icon: (
        <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.75} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 21v-7.5a.75.75 0 0 1 .75-.75h3a.75.75 0 0 1 .75.75V21m-4.5 0H2.36m11.14 0H18m0 0h3.64m-1.39 0V9.349M3.75 21V9.349m0 0a3.001 3.001 0 0 0 3.75-.615A2.993 2.993 0 0 0 9.75 9.75c.896 0 1.7-.393 2.25-1.016a2.993 2.993 0 0 0 2.25 1.016 2.993 2.993 0 0 0 2.25-1.016 3.001 3.001 0 0 0 3.75.614m-16.5 0a3.004 3.004 0 0 1-.621-4.72l1.189-1.19A1.5 1.5 0 0 1 5.378 3h13.243a1.5 1.5 0 0 1 1.06.44l1.19 1.189a3 3 0 0 1-.621 4.72M6.75 18h3.75a.75.75 0 0 0 .75-.75V13.5a.75.75 0 0 0-.75-.75H6.75a.75.75 0 0 0-.75.75v3.75c0 .414.336.75.75.75Z" />
        </svg>
      ),
    },
    {
      id: "security",
      label: t("tabSecurity"),
      icon: (
        <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.75} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z" />
        </svg>
      ),
    },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="ps-title"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      <div className="relative flex w-full max-w-3xl overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-2xl"
        style={{ maxHeight: "85vh" }}>

        {/* Sidebar */}
        <aside className="flex w-44 shrink-0 flex-col border-r border-zinc-100 bg-zinc-50 py-5 px-2.5">
          <p id="ps-title" className="mb-4 px-2.5 text-xs font-semibold uppercase tracking-wider text-zinc-400">
            {t("modalTitle")}
          </p>
          <nav className="flex flex-1 flex-col gap-0.5">
            {tabs.map((tb) => (
              <TabBtn key={tb.id} active={tab === tb.id} onClick={() => setTab(tb.id)}>
                <span className="flex items-center gap-2">
                  {tb.icon}
                  {tb.label}
                </span>
              </TabBtn>
            ))}
          </nav>
          <div className="mt-3 border-t border-zinc-200 pt-3">
            <SignOutInSidebar />
          </div>
        </aside>

        {/* Content */}
        <div className="flex min-h-0 flex-1 flex-col">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-zinc-100 px-6 py-4">
            <div>
              <p className="text-sm font-semibold text-ink">
                {tabs.find((tb) => tb.id === tab)?.label}
              </p>
              <p className="text-xs text-ink-muted">{userEmail}</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-md p-1.5 text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-700"
              aria-label="Close"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Tab content */}
          <div className="flex-1 overflow-y-auto px-6 py-6">
            {loading ? (
              <div className="flex items-center justify-center py-16">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-zinc-200 border-t-accent" />
              </div>
            ) : profile ? (
              <>
                {tab === "general" && (
                  <GeneralTab profile={profile} onProfileChange={handleProfileChange} />
                )}
                {tab === "business" && (
                  <BusinessTab profile={profile} onProfileChange={handleProfileChange} />
                )}
                {tab === "security" && <SecurityTab userEmail={userEmail} />}
              </>
            ) : (
              <p className="py-8 text-center text-sm text-ink-muted">{t("loadFailed")}</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Sign out inside modal sidebar ───────────────────────────────────────────

function SignOutInSidebar() {
  const t = useTranslations("profileSettings");
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
      className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm text-ink-muted transition hover:bg-zinc-100 hover:text-ink"
    >
      <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.75} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15M12 9l-3 3m0 0 3 3m-3-3h12.75" />
      </svg>
      {t("signOut")}
    </button>
  );
}
