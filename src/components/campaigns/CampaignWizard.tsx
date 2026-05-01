"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";

type Audience = { id: string; name: string; audience_type: string };

type StepDraft = {
  body: string;
  link_url: string;
  delay_after_previous_hours: number;
};

const SMS_HINT = 160;

function StepIndicator({ step }: { step: number }) {
  return (
    <div className="flex items-center gap-2 text-xs font-medium text-ink-muted">
      {[1, 2, 3, 4, 5].map((n) => (
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
  const router = useRouter();
  const searchParams = useSearchParams();
  const idParam = searchParams.get("id");

  const [hydrated, setHydrated] = useState(false);
  const [step, setStep] = useState(1);
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

  const loadCampaign = useCallback(
    async (id: string) => {
      const res = await fetch(`/api/campaigns/${id}`);
      if (!res.ok) throw new Error(t("loadFailed"));
      const data = (await res.json()) as {
        campaign: {
          name: string;
          audience_id: string | null;
          send_immediately: boolean;
          scheduled_at: string | null;
        };
        steps: {
          step_order: number;
          body: string;
          link_url: string | null;
          delay_after_previous_hours: number;
        }[];
      };
      setName(data.campaign.name);
      setAudienceId(data.campaign.audience_id ?? "");
      setSendNow(Boolean(data.campaign.send_immediately));
      if (data.campaign.scheduled_at) {
        const d = new Date(data.campaign.scheduled_at);
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
    [t]
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
    let cancelled = false;
    async function loadAudiences() {
      const res = await fetch("/api/audiences?type=phone");
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
  }, [step, audienceId]);

  useEffect(() => {
    const found = audiences.find((a) => a.id === audienceId);
    setAudienceLabel(found?.name ?? "");
  }, [audienceId, audiences]);

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

  async function goNext() {
    if (!idParam) return;
    setError(null);
    setBusy(true);
    try {
      if (step === 1) {
        if (!name.trim()) throw new Error(t("nameRequired"));
        await patchCampaign({ name: name.trim() });
      }
      if (step === 2) {
        if (!audienceId) throw new Error(t("selectAudience"));
        await patchCampaign({ audience_id: audienceId });
      }
      if (step === 3) {
        const valid = steps.some((s) => s.body.trim() || s.link_url.trim());
        if (!valid) throw new Error(t("addMessage"));
        await saveSteps();
      }
      if (step === 4) {
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
      setStep((s) => Math.min(5, s + 1));
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
        <StepIndicator step={step} />
      </div>

      {error ? <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}

      {step === 1 && (
        <div className="space-y-4 rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
          <h2 className="text-sm font-semibold text-ink">{t("step1Title")}</h2>
          <label className="block text-sm text-ink-muted">{t("campaignName")}</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none ring-accent/30 focus:ring-2"
            placeholder={t("namePlaceholder")}
          />
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4 rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
          <h2 className="text-sm font-semibold text-ink">{t("step2Title")}</h2>
          <p className="text-sm text-ink-muted">{t("step2Hint")}</p>
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
          <Link href="/dashboard/audience/phones" className="inline-block text-sm font-medium text-accent hover:text-accent-hover">
            {t("managePhones")}
          </Link>
        </div>
      )}

      {step === 3 && (
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

      {step === 4 && (
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

      {step === 5 && (
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
        {step < 5 ? (
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
