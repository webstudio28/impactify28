"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";

type Audience = { id: string; name: string; audience_type: string };

type StepDraft = {
  body: string;
  link_url: string;
  delay_after_previous_hours: number;
};

type CampaignChannel = "sms" | "email";

type MemberRow = { id: string; value: string };

const SMS_HINT = 160;

function StepIndicator({ step, max }: { step: number; max: number }) {
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-ink-muted">
      {Array.from({ length: max }, (_, i) => i + 1).map((n) => (
        <span
          key={n}
          className={`rounded-full px-2 py-1 ${n === step ? "bg-ink text-white" : "bg-zinc-200 text-ink-muted"}`}
        >
          {n}
        </span>
      ))}
    </div>
  );
}

export function CampaignWizard() {
  const t = useTranslations("wizard");
  const tEmail = useTranslations("emailWizard");
  const router = useRouter();
  const searchParams = useSearchParams();
  const idParam = searchParams.get("id");

  const [hydrated, setHydrated] = useState(false);
  const [step, setStep] = useState(1);
  const [channel, setChannel] = useState<CampaignChannel>("sms");
  const [name, setName] = useState("");
  const [audiences, setAudiences] = useState<Audience[]>([]);
  const [audienceId, setAudienceId] = useState<string>("");
  const [audienceLabel, setAudienceLabel] = useState("");
  const [steps, setSteps] = useState<StepDraft[]>([
    { body: "", link_url: "", delay_after_previous_hours: 0 },
  ]);
  const [sendNow, setSendNow] = useState(true);
  const [scheduledLocal, setScheduledLocal] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [emailIncludeAll, setEmailIncludeAll] = useState(true);
  const [emailSelectedIds, setEmailSelectedIds] = useState<Set<string>>(new Set());
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [membersTotal, setMembersTotal] = useState(0);
  const [membersPage, setMembersPage] = useState(1);
  const membersLimit = 25;

  const [briefPurpose, setBriefPurpose] = useState("");
  const [briefTargetUrl, setBriefTargetUrl] = useState("");
  const [briefLanguage, setBriefLanguage] = useState("en");
  const [briefHasPromo, setBriefHasPromo] = useState(false);
  const [briefPromoPercent, setBriefPromoPercent] = useState("");
  const [briefPromoCode, setBriefPromoCode] = useState("");
  const [briefFreeText, setBriefFreeText] = useState("");
  const [senderEmail, setSenderEmail] = useState("");
  const [senderDisplayName, setSenderDisplayName] = useState("");

  const maxStep = channel === "sms" ? 5 : 4;

  const loadCampaign = useCallback(
    async (id: string) => {
      const res = await fetch(`/api/campaigns/${id}`);
      if (!res.ok) throw new Error(t("loadFailed"));
      const data = (await res.json()) as {
        campaign: {
          name: string;
          status: string;
          audience_id: string | null;
          send_immediately: boolean;
          scheduled_at: string | null;
          channel?: CampaignChannel | null;
          email_include_all?: boolean | null;
          email_selected_member_ids?: string[] | null;
          email_html?: string | null;
        };
        steps: {
          step_order: number;
          body: string;
          link_url: string | null;
          delay_after_previous_hours: number;
        }[];
      };
      const c = data.campaign;
      setName(c.name);
      setAudienceId(c.audience_id ?? "");
      setSendNow(Boolean(c.send_immediately));
      const ch: CampaignChannel = c.channel === "email" ? "email" : "sms";
      setChannel(ch);
      setEmailIncludeAll(c.email_include_all !== false);
      const ids = Array.isArray(c.email_selected_member_ids) ? c.email_selected_member_ids : [];
      setEmailSelectedIds(new Set(ids.filter(Boolean)));

      if (ch === "email" && c.email_html && c.status === "draft") {
        router.replace(`/dashboard/campaigns/${id}/email-ready`);
        return;
      }

      if (c.scheduled_at) {
        const d = new Date(c.scheduled_at);
        const pad = (n: number) => String(n).padStart(2, "0");
        setScheduledLocal(
          `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
        );
      }
      if (data.steps?.length) {
        setSteps(
          data.steps.map((s) => ({
            body: s.body,
            link_url: s.link_url ?? "",
            delay_after_previous_hours: s.delay_after_previous_hours ?? 0,
          }))
        );
      }
    },
    [router, t]
  );

  useEffect(() => {
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated || !idParam) return;
    const campaignId = idParam;
    let cancelled = false;
    async function load() {
      setBusy(true);
      setError(null);
      try {
        await loadCampaign(campaignId);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : t("loadFailed"));
      } finally {
        if (!cancelled) setBusy(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [hydrated, idParam, loadCampaign, t]);

  useEffect(() => {
    if (step !== 2 && step !== 5) return;
    const type = channel === "email" ? "email" : "phone";
    let cancelled = false;
    async function loadAudiences() {
      const res = await fetch(`/api/audiences?type=${type}`);
      const json = (await res.json()) as { audiences?: Audience[] };
      if (!cancelled && json.audiences) {
        setAudiences(json.audiences);
        if (audienceId) {
          const found = json.audiences.find((a) => a.id === audienceId);
          if (found) setAudienceLabel(found.name);
        }
      }
    }
    void loadAudiences();
    return () => {
      cancelled = true;
    };
  }, [step, audienceId, channel]);

  useEffect(() => {
    const found = audiences.find((a) => a.id === audienceId);
    setAudienceLabel(found?.name ?? "");
  }, [audienceId, audiences]);

  useEffect(() => {
    if (channel !== "email" || step !== 3 || !audienceId) return;
    let cancelled = false;
    async function loadMembers() {
      const res = await fetch(`/api/audiences/${audienceId}/members?page=${membersPage}&limit=${membersLimit}`);
      const json = (await res.json()) as { members?: MemberRow[]; total?: number; error?: string };
      if (cancelled) return;
      if (!res.ok) {
        setError(json.error ?? tEmail("membersLoadFailed"));
        return;
      }
      setMembers(json.members ?? []);
      setMembersTotal(json.total ?? 0);
    }
    void loadMembers();
    return () => {
      cancelled = true;
    };
  }, [channel, step, audienceId, membersPage, tEmail]);

  useEffect(() => {
    if (channel !== "email" || step !== 4) return;
    let cancelled = false;
    async function loadSenderProfile() {
      const res = await fetch("/api/profile");
      if (!res.ok || cancelled) return;
      const j = (await res.json()) as {
        profile?: { sender_email?: string | null; sender_display_name?: string | null };
      };
      const p = j.profile;
      if (!p || cancelled) return;
      if (typeof p.sender_email === "string" && p.sender_email.trim()) {
        setSenderEmail((prev) => (prev.trim() ? prev : p.sender_email!.trim()));
      }
      if (typeof p.sender_display_name === "string" && p.sender_display_name.trim()) {
        setSenderDisplayName((prev) => (prev.trim() ? prev : p.sender_display_name!.trim()));
      }
    }
    void loadSenderProfile();
    return () => {
      cancelled = true;
    };
  }, [channel, step]);

  async function patchCampaign(body: Record<string, unknown>) {
    if (!idParam) return;
    const res = await fetch(`/api/campaigns/${idParam}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = (await res.json()) as { error?: string };
    if (!res.ok) throw new Error(json.error ?? t("saveFailed"));
  }

  async function saveSteps() {
    if (!idParam) return;
    const payload = {
      steps: steps.map((s, i) => ({
        step_order: i + 1,
        body: s.body,
        link_url: s.link_url || null,
        delay_after_previous_hours: s.delay_after_previous_hours,
      })),
    };
    const res = await fetch(`/api/campaigns/${idParam}/steps`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const json = (await res.json()) as { error?: string };
    if (!res.ok) throw new Error(json.error ?? t("saveMessagesFailed"));
  }

  const emailBriefPayload = useMemo(
    () => ({
      purpose: briefPurpose.trim(),
      targetUrl: briefTargetUrl.trim(),
      language: briefLanguage.trim(),
      hasPromo: briefHasPromo,
      promoPercent: briefPromoPercent.trim() ? Number(briefPromoPercent) : null,
      promoCode: briefPromoCode.trim() || null,
      freeText: briefFreeText.trim(),
    }),
    [briefPurpose, briefTargetUrl, briefLanguage, briefHasPromo, briefPromoPercent, briefPromoCode, briefFreeText]
  );

  async function goNext() {
    if (!idParam) return;
    setError(null);
    setBusy(true);
    try {
      if (step === 1) {
        if (!name.trim()) throw new Error(t("nameRequired"));
        await patchCampaign({ name: name.trim(), channel });
      }
      if (step === 2) {
        if (!audienceId) throw new Error(channel === "email" ? tEmail("selectEmailAudience") : t("selectAudience"));
        await patchCampaign({ audience_id: audienceId });
      }
      if (step === 3 && channel === "sms") {
        const valid = steps.some((s) => s.body.trim() || s.link_url.trim());
        if (!valid) throw new Error(t("addMessage"));
        await saveSteps();
      }
      if (step === 3 && channel === "email") {
        if (!emailIncludeAll && emailSelectedIds.size === 0) {
          throw new Error(tEmail("pickRecipients"));
        }
        await patchCampaign({
          email_include_all: emailIncludeAll,
          email_selected_member_ids: emailIncludeAll ? [] : Array.from(emailSelectedIds),
        });
      }
      if (step === 4 && channel === "sms") {
        let scheduled_at: string | null = null;
        if (!sendNow) {
          if (!scheduledLocal) throw new Error(t("pickDateTime"));
          scheduled_at = new Date(scheduledLocal).toISOString();
        }
        await patchCampaign({
          send_immediately: sendNow,
          scheduled_at: sendNow ? null : scheduled_at,
        });
      }
      setStep((s) => Math.min(maxStep, s + 1));
    } catch (e) {
      setError(e instanceof Error ? e.message : t("errorGeneric"));
    } finally {
      setBusy(false);
    }
  }

  async function createEmailAndOpen() {
    if (!idParam) return;
    setError(null);
    setBusy(true);
    try {
      if (!briefPurpose.trim() || !briefTargetUrl.trim() || !briefLanguage.trim()) {
        throw new Error(tEmail("briefRequired"));
      }
      const se = senderEmail.trim().toLowerCase();
      if (!se || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(se)) {
        throw new Error(tEmail("senderEmailInvalid"));
      }
      const patchProfile = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sender_email: se,
          sender_display_name: senderDisplayName.trim() ? senderDisplayName.trim() : null,
        }),
      });
      const pe = (await patchProfile.json()) as { error?: string };
      if (!patchProfile.ok) throw new Error(pe.error ?? tEmail("senderSaveFailed"));

      const brief = {
        ...emailBriefPayload,
        promoPercent:
          briefHasPromo && briefPromoPercent.trim()
            ? Number(briefPromoPercent)
            : briefHasPromo
              ? null
              : null,
      };
      const gen = await fetch(`/api/campaigns/${idParam}/generate-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brief }),
      });
      const gj = (await gen.json()) as { error?: string };
      if (!gen.ok) throw new Error(gj.error ?? tEmail("generateFailed"));
      router.push(`/dashboard/campaigns/${idParam}/email-ready`);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : t("errorGeneric"));
    } finally {
      setBusy(false);
    }
  }

  function goBack() {
    setError(null);
    setStep((s) => Math.max(1, s - 1));
  }

  async function finalize() {
    if (!idParam) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/campaigns/${idParam}/finalize`, { method: "POST" });
      const json = (await res.json()) as { error?: string; ok?: boolean };
      if (!res.ok) throw new Error(json.error ?? t("finalizeFailed"));
      try {
        await fetch("/api/sms/process", { method: "POST" });
      } catch {
        /* optional: dev send */
      }
      router.push("/dashboard/campaigns");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : t("finalizeError"));
    } finally {
      setBusy(false);
    }
  }

  function toggleMember(id: string, checked: boolean) {
    setEmailSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function selectAllOnPage() {
    setEmailIncludeAll(false);
    setEmailSelectedIds((prev) => {
      const next = new Set(prev);
      for (const m of members) next.add(m.id);
      return next;
    });
  }

  function clearPageSelection() {
    setEmailSelectedIds((prev) => {
      const next = new Set(prev);
      for (const m of members) next.delete(m.id);
      return next;
    });
  }

  if (!idParam) {
    return (
      <div className="mx-auto max-w-xl text-sm text-ink-muted">
        {t("missingCampaign")}{" "}
        <Link href="/dashboard/campaigns/new" className="text-accent hover:text-accent-hover">
          {t("startAgain")}
        </Link>
        .
      </div>
    );
  }

  if (busy && step === 1 && !name) {
    return (
      <div className="mx-auto max-w-xl space-y-4">
        <p className="text-sm text-ink-muted">{t("loadingCampaign")}</p>
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <Link href="/dashboard/campaigns" className="text-sm text-ink-muted hover:text-ink">
            {t("backCampaigns")}
          </Link>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">{t("title")}</h1>
        </div>
        <StepIndicator step={step} max={maxStep} />
      </div>

      {error ? <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}

      {step === 1 && (
        <div className="space-y-6 rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
          <h2 className="text-sm font-semibold text-ink">{t("step1Title")}</h2>
          <label className="block text-sm text-ink-muted">{t("campaignName")}</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none ring-accent/30 focus:ring-2"
            placeholder={t("namePlaceholder")}
          />
          <div>
            <p className="text-sm font-medium text-ink">{t("channelTitle")}</p>
            <p className="mt-1 text-xs text-ink-muted">{t("channelHint")}</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => {
                  if (channel !== "sms") setAudienceId("");
                  setChannel("sms");
                }}
                className={`rounded-xl border-2 px-4 py-4 text-left transition ${
                  channel === "sms" ? "border-accent bg-accent/5" : "border-zinc-200 hover:border-zinc-300"
                }`}
              >
                <p className="text-sm font-semibold text-ink">{t("channelSms")}</p>
                <p className="mt-1 text-xs text-ink-muted">{t("channelSmsDesc")}</p>
              </button>
              <button
                type="button"
                onClick={() => {
                  if (channel !== "email") setAudienceId("");
                  setChannel("email");
                }}
                className={`rounded-xl border-2 px-4 py-4 text-left transition ${
                  channel === "email" ? "border-accent bg-accent/5" : "border-zinc-200 hover:border-zinc-300"
                }`}
              >
                <p className="text-sm font-semibold text-ink">{t("channelEmail")}</p>
                <p className="mt-1 text-xs text-ink-muted">{t("channelEmailDesc")}</p>
              </button>
            </div>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4 rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
          <h2 className="text-sm font-semibold text-ink">{channel === "email" ? tEmail("step2Title") : t("step2Title")}</h2>
          <p className="text-sm text-ink-muted">
            {channel === "email" ? tEmail("step2Hint") : t("step2Hint")}
          </p>
          <select
            value={audienceId}
            onChange={(e) => setAudienceId(e.target.value)}
            className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm"
          >
            <option value="">{t("selectAudiencePlaceholder")}</option>
            {audiences.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
          <Link
            href={channel === "email" ? "/dashboard/audience/emails" : "/dashboard/audience/phones"}
            className="inline-block text-sm font-medium text-accent hover:text-accent-hover"
          >
            {channel === "email" ? tEmail("manageEmails") : t("managePhones")}
          </Link>
        </div>
      )}

      {step === 3 && channel === "sms" && (
        <div className="space-y-6 rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-ink">{t("step3Title")}</h2>
            <button
              type="button"
              onClick={() =>
                setSteps((prev) => [...prev, { body: "", link_url: "", delay_after_previous_hours: 0 }])
              }
              className="text-sm font-medium text-accent hover:text-accent-hover"
            >
              {t("addStep")}
            </button>
          </div>
          {steps.map((s, idx) => (
            <div key={idx} className="space-y-3 border-t border-zinc-100 pt-4 first:border-t-0 first:pt-0">
              <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">
                {t("smsLabel", { n: idx + 1 })}
              </p>
              <div>
                <label className="text-xs text-ink-muted">{t("message")}</label>
                <textarea
                  value={s.body}
                  onChange={(e) => {
                    const v = e.target.value;
                    setSteps((prev) => prev.map((p, i) => (i === idx ? { ...p, body: v } : p)));
                  }}
                  rows={4}
                  className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none ring-accent/30 focus:ring-2"
                  placeholder={t("messagePlaceholder")}
                />
                <p className="mt-1 text-xs text-ink-muted">
                  {t("charsHint", { count: s.body.length, max: SMS_HINT })}
                </p>
              </div>
              <div>
                <label className="text-xs text-ink-muted">{t("linkOptional")}</label>
                <input
                  value={s.link_url}
                  onChange={(e) => {
                    const v = e.target.value;
                    setSteps((prev) => prev.map((p, i) => (i === idx ? { ...p, link_url: v } : p)));
                  }}
                  className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none ring-accent/30 focus:ring-2"
                  placeholder={t("linkPlaceholder")}
                />
              </div>
              <div>
                <label className="text-xs text-ink-muted">
                  {idx === 0 ? t("delayFirst") : t("delayAfter")}
                </label>
                <input
                  type="number"
                  min={0}
                  value={s.delay_after_previous_hours}
                  onChange={(e) => {
                    const v = Math.max(0, Number(e.target.value) || 0);
                    setSteps((prev) => prev.map((p, i) => (i === idx ? { ...p, delay_after_previous_hours: v } : p)));
                  }}
                  className="mt-1 w-32 rounded-lg border border-zinc-200 px-3 py-2 text-sm"
                />
              </div>
              {steps.length > 1 ? (
                <button
                  type="button"
                  onClick={() => setSteps((prev) => prev.filter((_, i) => i !== idx))}
                  className="text-xs text-red-600 hover:underline"
                >
                  {t("removeStep")}
                </button>
              ) : null}
            </div>
          ))}
        </div>
      )}

      {step === 3 && channel === "email" && (
        <div className="space-y-4 rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
          <h2 className="text-sm font-semibold text-ink">{tEmail("step3Title")}</h2>
          <p className="text-sm text-ink-muted">{tEmail("step3Hint")}</p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                setEmailIncludeAll(true);
                setEmailSelectedIds(new Set());
              }}
              className={`rounded-lg border px-3 py-2 text-xs font-medium ${
                emailIncludeAll ? "border-accent bg-accent/10 text-ink" : "border-zinc-200 bg-white"
              }`}
            >
              {tEmail("entireAudience")}
            </button>
            <button
              type="button"
              onClick={() => setEmailIncludeAll(false)}
              className={`rounded-lg border px-3 py-2 text-xs font-medium ${
                !emailIncludeAll ? "border-accent bg-accent/10 text-ink" : "border-zinc-200 bg-white"
              }`}
            >
              {tEmail("pickRecipients")}
            </button>
          </div>
          {emailIncludeAll ? (
            <p className="text-sm text-ink">
              {tEmail("entireAudienceCount", { count: membersTotal })}
            </p>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <button type="button" onClick={selectAllOnPage} className="text-accent hover:underline">
                  {tEmail("selectPage")}
                </button>
                <span className="text-ink-muted">·</span>
                <button type="button" onClick={clearPageSelection} className="text-accent hover:underline">
                  {tEmail("clearPage")}
                </button>
                <span className="text-ink-muted">·</span>
                <button
                  type="button"
                  onClick={() => setEmailSelectedIds(new Set())}
                  className="text-accent hover:underline"
                >
                  {tEmail("clearAll")}
                </button>
              </div>
              <p className="text-xs text-ink-muted">
                {tEmail("selectedCount", { count: emailSelectedIds.size })}
              </p>
              <ul className="max-h-72 divide-y divide-zinc-100 overflow-y-auto rounded-lg border border-zinc-200">
                {members.map((m) => (
                  <li key={m.id} className="flex items-center gap-3 px-3 py-2 text-sm">
                    <input
                      type="checkbox"
                      checked={emailSelectedIds.has(m.id)}
                      onChange={(e) => toggleMember(m.id, e.target.checked)}
                    />
                    <span className="font-mono text-xs text-ink">{m.value}</span>
                  </li>
                ))}
              </ul>
              <div className="flex items-center justify-between text-xs text-ink-muted">
                <button
                  type="button"
                  disabled={membersPage <= 1}
                  onClick={() => setMembersPage((p) => Math.max(1, p - 1))}
                  className="rounded border border-zinc-200 px-2 py-1 disabled:opacity-40"
                >
                  {tEmail("prev")}
                </button>
                <span>
                  {tEmail("page", { page: membersPage, pages: Math.max(1, Math.ceil(membersTotal / membersLimit)) })}
                </span>
                <button
                  type="button"
                  disabled={membersPage * membersLimit >= membersTotal}
                  onClick={() => setMembersPage((p) => p + 1)}
                  className="rounded border border-zinc-200 px-2 py-1 disabled:opacity-40"
                >
                  {tEmail("next")}
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {step === 4 && channel === "sms" && (
        <div className="space-y-4 rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
          <h2 className="text-sm font-semibold text-ink">{t("step4Title")}</h2>
          <label className="flex items-center gap-2 text-sm">
            <input type="radio" checked={sendNow} onChange={() => setSendNow(true)} />
            {t("startNow")}
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="radio" checked={!sendNow} onChange={() => setSendNow(false)} />
            {t("scheduleLater")}
          </label>
          {!sendNow ? (
            <input
              type="datetime-local"
              value={scheduledLocal}
              onChange={(e) => setScheduledLocal(e.target.value)}
              className="w-full max-w-xs rounded-lg border border-zinc-200 px-3 py-2 text-sm"
            />
          ) : null}
        </div>
      )}

      {step === 4 && channel === "email" && (
        <div className="space-y-4 rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
          <h2 className="text-sm font-semibold text-ink">{tEmail("step4Title")}</h2>
          <p className="text-sm text-ink-muted">{tEmail("step4Hint")}</p>
          <div className="space-y-3 rounded-lg border border-zinc-100 bg-zinc-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">{tEmail("senderSection")}</p>
            <p className="text-xs text-ink-muted">{tEmail("senderSectionHint")}</p>
            <div>
              <label className="text-xs font-medium text-ink-muted">{tEmail("senderDisplayName")}</label>
              <input
                value={senderDisplayName}
                onChange={(e) => setSenderDisplayName(e.target.value)}
                className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm"
                placeholder={tEmail("senderDisplayPlaceholder")}
                maxLength={100}
              />
            </div>
            <div>
              <label className="text-xs font-medium text-ink-muted">{tEmail("senderEmail")} *</label>
              <input
                type="email"
                value={senderEmail}
                onChange={(e) => setSenderEmail(e.target.value)}
                className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm"
                placeholder={tEmail("senderEmailPlaceholder")}
                autoComplete="email"
              />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-ink-muted">{tEmail("purpose")} *</label>
            <textarea
              value={briefPurpose}
              onChange={(e) => setBriefPurpose(e.target.value)}
              rows={3}
              className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm"
              placeholder={tEmail("purposePh")}
            />
          </div>
          <div>
            <label className="text-xs font-medium text-ink-muted">{tEmail("targetUrl")} *</label>
            <input
              value={briefTargetUrl}
              onChange={(e) => setBriefTargetUrl(e.target.value)}
              className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm"
              placeholder="https://"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-ink-muted">{tEmail("language")} *</label>
            <select
              value={briefLanguage}
              onChange={(e) => setBriefLanguage(e.target.value)}
              className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm"
            >
              <option value="en">English</option>
              <option value="bg">Български</option>
              <option value="de">Deutsch</option>
              <option value="fr">Français</option>
            </select>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={briefHasPromo} onChange={(e) => setBriefHasPromo(e.target.checked)} />
            {tEmail("hasPromo")}
          </label>
          {briefHasPromo ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="text-xs text-ink-muted">{tEmail("promoPercent")}</label>
                <input
                  type="number"
                  min={0}
                  value={briefPromoPercent}
                  onChange={(e) => setBriefPromoPercent(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-ink-muted">{tEmail("promoCode")}</label>
                <input
                  value={briefPromoCode}
                  onChange={(e) => setBriefPromoCode(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm"
                />
              </div>
            </div>
          ) : null}
          <div>
            <label className="text-xs font-medium text-ink-muted">{tEmail("freeText")}</label>
            <textarea
              value={briefFreeText}
              onChange={(e) => setBriefFreeText(e.target.value)}
              rows={3}
              className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm"
              placeholder={tEmail("freeTextPh")}
            />
          </div>
        </div>
      )}

      {step === 5 && channel === "sms" && (
        <div className="space-y-4 rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
          <h2 className="text-sm font-semibold text-ink">{t("step5Title")}</h2>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-ink-muted">{t("reviewName")}</dt>
              <dd className="font-medium text-ink">{name}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-ink-muted">{t("reviewAudience")}</dt>
              <dd className="font-medium text-ink">{audienceLabel || audienceId || t("dash")}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-ink-muted">{t("reviewSteps")}</dt>
              <dd className="text-right font-medium text-ink">{t("smsCount", { count: steps.length })}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-ink-muted">{t("reviewTiming")}</dt>
              <dd className="text-right font-medium text-ink">
                {sendNow ? t("timingNow") : scheduledLocal ? new Date(scheduledLocal).toLocaleString() : t("dash")}
              </dd>
            </div>
          </dl>
          <p className="text-xs text-ink-muted">{t("compliance")}</p>
        </div>
      )}

      <div className="flex justify-between gap-3">
        <button
          type="button"
          onClick={goBack}
          disabled={step === 1 || busy}
          className="rounded-lg border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-ink disabled:opacity-40"
        >
          {t("back")}
        </button>
        {channel === "email" && step === 4 ? (
          <button
            type="button"
            onClick={() => void createEmailAndOpen()}
            disabled={busy}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-60"
          >
            {busy ? tEmail("generating") : tEmail("createEmail")}
          </button>
        ) : step < maxStep ? (
          <button
            type="button"
            onClick={() => void goNext()}
            disabled={busy}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-60"
          >
            {busy ? t("saving") : t("next")}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => void finalize()}
            disabled={busy}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-60"
          >
            {busy ? t("creating") : t("createCampaign")}
          </button>
        )}
      </div>
    </div>
  );
}
