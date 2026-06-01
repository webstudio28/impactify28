"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";

type Platform = "generic" | "woocommerce" | "shopify";

type TrackerPayload = {
  workspaceId: string;
  scriptUrl: string;
  loaderSnippet: string;
  checkoutSnippet: string;
  lastEvent: {
    order_id: string;
    order_value: number;
    currency: string;
    event_time: string;
    source: string;
    campaign_id: string | null;
  } | null;
};

function CopyBlock({
  label,
  code,
  copyLabel,
  copiedLabel,
}: {
  label: string;
  code: string;
  copyLabel: string;
  copiedLabel: string;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium text-ink">{label}</p>
        <button
          type="button"
          onClick={() => void copy()}
          className="shrink-0 rounded-md border border-zinc-200 px-2.5 py-1 text-xs font-medium text-ink-muted hover:bg-zinc-50"
        >
          {copied ? copiedLabel : copyLabel}
        </button>
      </div>
      <pre className="overflow-x-auto rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-xs text-ink">{code}</pre>
    </div>
  );
}

export function SalesTrackerClient() {
  const t = useTranslations("salesTracker");
  const [data, setData] = useState<TrackerPayload | null>(null);
  const [platform, setPlatform] = useState<Platform>("generic");
  const [testCurrency, setTestCurrency] = useState("BGN");
  const [testBusy, setTestBusy] = useState(false);
  const [testMsg, setTestMsg] = useState<string | null>(null);
  const [testErr, setTestErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/tracker", { cache: "no-store" });
      const json = (await res.json()) as TrackerPayload & { error?: string };
      if (res.ok) setData(json);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function runTest() {
    setTestBusy(true);
    setTestMsg(null);
    setTestErr(null);
    try {
      const res = await fetch("/api/tracker/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currency: testCurrency }),
      });
      const json = (await res.json()) as { ok?: boolean; message?: string; error?: string };
      if (!res.ok) {
        setTestErr(json.error ?? t("testFailed"));
        return;
      }
      setTestMsg(json.message ?? t("testOk"));
      await load();
    } catch {
      setTestErr(t("testFailed"));
    } finally {
      setTestBusy(false);
    }
  }

  if (loading && !data) {
    return <p className="text-sm text-ink-muted">{t("loading")}</p>;
  }

  if (!data) {
    return <p className="text-sm text-red-600">{t("loadFailed")}</p>;
  }

  const platforms: Platform[] = ["generic", "woocommerce", "shopify"];

  const platformHelp: Record<Platform, string> = {
    generic: t("platformHelp_generic"),
    woocommerce: t("platformHelp_woocommerce"),
    shopify: t("platformHelp_shopify"),
  };

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm space-y-4">
        <h2 className="text-sm font-semibold text-ink">{t("snippetTitle")}</h2>
        <CopyBlock
          label={t("loaderLabel")}
          code={data.loaderSnippet}
          copyLabel={t("copy")}
          copiedLabel={t("copied")}
        />
        <CopyBlock
          label={t("checkoutLabel")}
          code={data.checkoutSnippet}
          copyLabel={t("copy")}
          copiedLabel={t("copied")}
        />
        <p className="text-xs text-ink-muted">{t("currencyNote")}</p>
      </section>

      <section className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm space-y-3">
        <h2 className="text-sm font-semibold text-ink">{t("platformTitle")}</h2>
        <div className="flex flex-wrap gap-2">
          {platforms.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPlatform(p)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                platform === p ?
                  "bg-accent text-white"
                : "border border-zinc-200 text-ink-muted hover:bg-zinc-50"
              }`}
            >
              {t(`platform_${p}`)}
            </button>
          ))}
        </div>
        <p className="text-sm text-ink-muted whitespace-pre-line">{platformHelp[platform]}</p>
      </section>

      <section className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm space-y-3">
        <h2 className="text-sm font-semibold text-ink">{t("testTitle")}</h2>
        <p className="text-sm text-ink-muted">{t("testDesc")}</p>
        <div className="flex flex-wrap items-end gap-3">
          <label className="block text-xs font-medium text-ink-muted">
            {t("testCurrency")}
            <select
              value={testCurrency}
              onChange={(e) => setTestCurrency(e.target.value)}
              className="mt-1 block rounded-md border border-zinc-200 px-2 py-1.5 text-sm text-ink"
            >
              <option value="BGN">BGN</option>
              <option value="EUR">EUR</option>
              <option value="USD">USD</option>
              <option value="GBP">GBP</option>
            </select>
          </label>
          <button
            type="button"
            disabled={testBusy}
            onClick={() => void runTest()}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-50"
          >
            {testBusy ? t("testRunning") : t("testButton")}
          </button>
        </div>
        {testMsg ? <p className="text-sm text-emerald-700">{testMsg}</p> : null}
        {testErr ? <p className="text-sm text-red-600">{testErr}</p> : null}
        {data.lastEvent ? (
          <p className="text-xs text-ink-muted">
            {t("lastEvent", {
              orderId: data.lastEvent.order_id,
              value: Number(data.lastEvent.order_value).toFixed(2),
              currency: data.lastEvent.currency,
              time: new Date(data.lastEvent.event_time).toLocaleString(),
            })}
          </p>
        ) : (
          <p className="text-xs text-ink-muted">{t("noEvents")}</p>
        )}
      </section>
    </div>
  );
}
