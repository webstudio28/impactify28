"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { useState } from "react";

export function SendDueMessages({ show }: { show: boolean }) {
  const t = useTranslations("campaigns.sendDue");
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  if (!show) return null;

  async function run() {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch("/api/sms/process", { method: "POST" });
      const json = (await res.json()) as { processed?: number; errors?: string[]; error?: string };
      if (!res.ok) {
        setMessage(json.error ?? t("errorGeneric"));
        return;
      }
      const n = json.processed ?? 0;
      const errs = json.errors?.length ?? 0;
      setMessage(
        n > 0
          ? t("sent", { count: n }) + (errs ? ` ${t("sentErrors", { count: errs })}` : "")
          : errs
            ? `${t("nothingSent")} ${json.errors?.[0] ?? t("checkProvider")}`
            : t("noneDue")
      );
      router.refresh();
    } catch {
      setMessage(t("requestFailed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50/80 px-4 py-3 text-sm text-amber-950">
      <p className="font-medium text-amber-950">{t("title")}</p>
      <p
        className="mt-1 text-amber-900/90"
        dangerouslySetInnerHTML={{ __html: t.raw("body") }}
      />
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={busy}
          onClick={() => void run()}
          className="rounded-lg bg-amber-900 px-3 py-2 text-xs font-medium text-white hover:bg-amber-950 disabled:opacity-60"
        >
          {busy ? t("sending") : t("button")}
        </button>
        {message ? <span className="text-xs text-amber-900">{message}</span> : null}
      </div>
    </div>
  );
}
