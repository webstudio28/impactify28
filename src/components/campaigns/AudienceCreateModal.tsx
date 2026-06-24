"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { parseEmailInput } from "@/lib/audiences/parse-emails";
import { parsePhoneInput } from "@/lib/audiences/parse-phones";
import { ButtonSpinner } from "@/components/ui/ButtonSpinner";

type AudienceType = "phone" | "email";
type MiniStep = "name" | "contacts" | "done";

export type AudienceCreateResult = {
  id: string;
  name: string;
  memberCount: number;
};

type Props = {
  open: boolean;
  audienceType: AudienceType;
  onClose: () => void;
  onComplete: (result: AudienceCreateResult) => void;
};

export function AudienceCreateModal({ open, audienceType, onClose, onComplete }: Props) {
  const t = useTranslations("wizard");
  const [miniStep, setMiniStep] = useState<MiniStep>("name");
  const [listName, setListName] = useState("");
  const [bulkText, setBulkText] = useState("");
  const [audienceId, setAudienceId] = useState<string | null>(null);
  const [createdName, setCreatedName] = useState("");
  const [memberCount, setMemberCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setMiniStep("name");
    setListName("");
    setBulkText("");
    setAudienceId(null);
    setCreatedName("");
    setMemberCount(0);
    setError(null);
    setBusy(false);
  }, [open, audienceType]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, busy, onClose]);

  async function createList() {
    setError(null);
    const name = listName.trim();
    if (!name) {
      setError(t("audienceCreateNameRequired"));
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/audiences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, audience_type: audienceType }),
      });
      const json = (await res.json()) as { audience?: { id: string; name: string }; error?: string };
      if (!res.ok || !json.audience) throw new Error(json.error ?? t("audienceCreateFailed"));
      setAudienceId(json.audience.id);
      setCreatedName(json.audience.name);
      setMiniStep("contacts");
    } catch (e) {
      setError(e instanceof Error ? e.message : t("audienceCreateFailed"));
    } finally {
      setBusy(false);
    }
  }

  async function addContacts() {
    setError(null);
    if (!audienceId) return;
    const values =
      audienceType === "email" ? parseEmailInput(bulkText) : parsePhoneInput(bulkText);
    if (!values.length) {
      setError(
        audienceType === "email" ? t("audienceCreatePasteEmails") : t("audienceCreatePastePhones")
      );
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`/api/audiences/${audienceId}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ values }),
      });
      const json = (await res.json()) as { error?: string; count?: number };
      if (!res.ok) throw new Error(json.error ?? t("audienceCreateAddFailed"));
      setMemberCount(json.count ?? values.length);
      setBulkText("");
      setMiniStep("done");
    } catch (e) {
      setError(e instanceof Error ? e.message : t("audienceCreateAddFailed"));
    } finally {
      setBusy(false);
    }
  }

  function startAnother() {
    setMiniStep("name");
    setListName("");
    setBulkText("");
    setAudienceId(null);
    setCreatedName("");
    setMemberCount(0);
    setError(null);
  }

  function useForCampaign() {
    if (!audienceId) return;
    onComplete({ id: audienceId, name: createdName, memberCount });
  }

  if (!open) return null;

  const stepIndex = miniStep === "name" ? 1 : miniStep === "contacts" ? 2 : 3;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="audience-create-title"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !busy) onClose();
      }}
    >
      <div className="flex max-h-[min(90vh,640px)] w-full max-w-lg flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-xl">
        <div className="shrink-0 border-b border-zinc-100 px-5 py-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 id="audience-create-title" className="text-base font-semibold text-ink">
                {t("audienceCreateTitle")}
              </h2>
              <p className="mt-1 text-xs text-ink-muted">
                {audienceType === "email" ? t("audienceCreateSubtitleEmail") : t("audienceCreateSubtitlePhone")}
              </p>
            </div>
            <button
              type="button"
              disabled={busy}
              onClick={onClose}
              className="shrink-0 rounded-md px-2 py-1 text-sm text-ink-muted hover:bg-zinc-100 hover:text-ink disabled:opacity-50"
              aria-label={t("audienceCreateClose")}
            >
              ×
            </button>
          </div>
          <div className="mt-3 flex items-center gap-2 text-[11px] font-medium text-ink-muted">
            {[1, 2, 3].map((n) => (
              <span
                key={n}
                className={`rounded-full px-2 py-0.5 ${n === stepIndex ? "bg-ink text-white" : "bg-zinc-100"}`}
              >
                {n}
              </span>
            ))}
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {miniStep === "name" ? (
            <div className="space-y-3">
              <label className="block text-sm font-medium text-ink">{t("audienceCreateStepName")}</label>
              <input
                value={listName}
                onChange={(e) => setListName(e.target.value)}
                placeholder={t("audienceCreateNamePlaceholder")}
                className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none ring-accent/30 focus:ring-2"
                autoFocus
              />
            </div>
          ) : null}

          {miniStep === "contacts" ? (
            <div className="space-y-3">
              <div>
                <p className="text-sm font-medium text-ink">{t("audienceCreateStepContacts")}</p>
                <p className="mt-1 text-xs text-ink-muted">
                  {audienceType === "email"
                    ? t("audienceCreateContactsHintEmail")
                    : t("audienceCreateContactsHintPhone")}
                </p>
              </div>
              <textarea
                value={bulkText}
                onChange={(e) => setBulkText(e.target.value)}
                rows={10}
                placeholder={
                  audienceType === "email"
                    ? t("audienceCreateContactsPlaceholderEmail")
                    : t("audienceCreateContactsPlaceholderPhone")
                }
                className="w-full rounded-lg border border-zinc-200 px-3 py-2 font-mono text-sm outline-none ring-accent/30 focus:ring-2"
                autoFocus
              />
            </div>
          ) : null}

          {miniStep === "done" ? (
            <div className="space-y-3 rounded-lg border border-emerald-200 bg-emerald-50/60 px-4 py-4">
              <p className="text-sm font-medium text-ink">{t("audienceCreateStepDone")}</p>
              <p className="text-sm text-ink-muted">
                {t("audienceCreateDoneSummary", { name: createdName, count: memberCount })}
              </p>
            </div>
          ) : null}

          {error ? (
            <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          ) : null}
        </div>

        <div className="shrink-0 flex flex-wrap justify-end gap-2 border-t border-zinc-100 px-5 py-4">
          {miniStep === "name" ? (
            <>
              <button
                type="button"
                disabled={busy}
                onClick={onClose}
                className="rounded-lg border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-ink hover:bg-surface-muted disabled:opacity-50"
              >
                {t("audienceCreateClose")}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void createList()}
                className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-50"
              >
                {busy ? (
                  <span className="inline-flex items-center gap-1.5">
                    <ButtonSpinner />
                    {t("audienceCreateCreating")}
                  </span>
                ) : (
                  t("next")
                )}
              </button>
            </>
          ) : null}

          {miniStep === "contacts" ? (
            <>
              <button
                type="button"
                disabled={busy}
                onClick={onClose}
                className="rounded-lg border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-ink hover:bg-surface-muted disabled:opacity-50"
              >
                {t("audienceCreateClose")}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void addContacts()}
                className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-50"
              >
                {busy ? (
                  <span className="inline-flex items-center gap-1.5">
                    <ButtonSpinner />
                    {t("audienceCreateAdding")}
                  </span>
                ) : (
                  t("next")
                )}
              </button>
            </>
          ) : null}

          {miniStep === "done" ? (
            <>
              <button
                type="button"
                disabled={busy}
                onClick={startAnother}
                className="rounded-lg border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-ink hover:bg-surface-muted"
              >
                {t("audienceCreateAnother")}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={useForCampaign}
                className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover"
              >
                {t("audienceCreateUseList")}
              </button>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
