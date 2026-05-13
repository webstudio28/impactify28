"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { composeSmsBody } from "@/lib/sms/body";
import { isOurShortUrl } from "@/lib/links/short-domain";
import type { EmailTemplateType, ProductItem } from "@/lib/email/templates/types";
import { DEFAULT_THEME_KEY } from "@/lib/email/themes";

type Audience = { id: string; name: string; audience_type: string };

type StepDraft = {
  body: string;
  link_url: string;
  delay_after_previous_hours: number;
};

type CampaignChannel = "sms" | "email";

type MemberRow = { id: string; value: string };

const SMS_HINT = 160;

const TEMPLATE_CONFIGS: Record<
  EmailTemplateType,
  { maxProducts: number; hasProducts: boolean; icon: string }
> = {
  promotional: { maxProducts: 4, hasProducts: true, icon: "🏷️" },
  product_launch: { maxProducts: 0, hasProducts: false, icon: "🚀" },
  seasonal: { maxProducts: 4, hasProducts: true, icon: "🎄" },
  discount_coupon: { maxProducts: 3, hasProducts: true, icon: "🎟️" },
};

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

type WizardTranslate = (key: string, values?: Record<string, string | number>) => string;

function ShortenSplitButton({
  onShorten,
  shortenDisabled,
  busy,
  t,
}: {
  onShorten: () => void;
  shortenDisabled: boolean;
  busy: boolean;
  t: WizardTranslate;
}) {
  const [infoOpen, setInfoOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const hoverCloseRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancelHoverClose = useCallback(() => {
    if (hoverCloseRef.current) {
      clearTimeout(hoverCloseRef.current);
      hoverCloseRef.current = null;
    }
  }, []);

  const scheduleHoverClose = useCallback(() => {
    cancelHoverClose();
    hoverCloseRef.current = setTimeout(() => setInfoOpen(false), 280);
  }, [cancelHoverClose]);

  useEffect(() => {
    if (!infoOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setInfoOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setInfoOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [infoOpen]);

  return (
    <div ref={wrapRef} className="relative min-w-0 flex-1">
      <div className="flex min-h-[2.5rem] overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-sm">
        <button
          type="button"
          disabled={shortenDisabled || busy}
          onClick={() => void onShorten()}
          className="min-w-0 flex-1 border-0 bg-transparent px-2 py-2 text-center text-xs font-medium text-ink transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? t("linkShortenBusy") : t("linkShortenButton")}
        </button>
        <button
          type="button"
          aria-label={t("linkShortenWhyAria")}
          aria-expanded={infoOpen}
          aria-haspopup="dialog"
          onClick={(e) => {
            e.preventDefault();
            cancelHoverClose();
            setInfoOpen((o) => !o);
          }}
          onMouseEnter={() => {
            cancelHoverClose();
            setInfoOpen(true);
          }}
          onMouseLeave={scheduleHoverClose}
          className="inline-flex w-10 shrink-0 items-center justify-center border-l border-zinc-200 bg-zinc-50/90 text-[13px] font-semibold text-ink-muted transition hover:bg-zinc-100 hover:text-ink"
        >
          ?
        </button>
      </div>

      {infoOpen ? (
        <div
          className="absolute left-0 top-full z-30 w-[min(20rem,calc(100vw-2.5rem))] max-w-[calc(100vw-2.5rem)] pt-1.5"
          onMouseEnter={cancelHoverClose}
          onMouseLeave={scheduleHoverClose}
        >
          <div
            role="dialog"
            aria-labelledby="shorten-info-heading"
            className="relative rounded-xl border border-zinc-200/80 bg-white p-4 shadow-[0_10px_40px_-10px_rgba(0,0,0,0.25)] ring-1 ring-black/[0.04]"
          >
            <button
              type="button"
              onClick={() => setInfoOpen(false)}
              className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-md text-zinc-400 transition hover:bg-zinc-100 hover:text-ink"
              aria-label={t("linkShortenInfoCloseAria")}
            >
              <span className="text-lg leading-none" aria-hidden>
                ×
              </span>
            </button>
            <h3 id="shorten-info-heading" className="pr-8 text-sm font-semibold tracking-tight text-ink">
              {t("linkShortenInfoTitle")}
            </h3>
            <p className="mt-2 text-xs leading-relaxed text-ink-muted">{t("linkShortenInfoBody")}</p>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function SmsMessageStep({
  draft,
  onChange,
  campaignId,
  t,
}: {
  draft: StepDraft;
  onChange: (next: StepDraft) => void;
  campaignId: string;
  t: WizardTranslate;
}) {
  const patch = (p: Partial<StepDraft>) =>
    onChange({ ...draft, delay_after_previous_hours: 0, ...p });

  const [linkInput, setLinkInput] = useState(draft.link_url);
  const [added, setAdded] = useState(draft.link_url.trim().length > 0);
  const [shortenBusy, setShortenBusy] = useState(false);
  const [shortenError, setShortenError] = useState<string | null>(null);

  const linkTrim = linkInput.trim();
  const isShortened = linkTrim ? isOurShortUrl(linkTrim) : false;
  const charCount = draft.body.length + (added && linkTrim ? 1 + linkTrim.length : 0);

  function addToSms() {
    if (!linkTrim) return;
    patch({ link_url: linkTrim });
    setAdded(true);
    setShortenError(null);
  }

  function resetLink() {
    setLinkInput("");
    setAdded(false);
    setShortenError(null);
    patch({ link_url: "" });
  }

  async function shortenLink() {
    setShortenError(null);
    if (!linkTrim) { setShortenError(t("linkShortenErrorEmpty")); return; }
    if (isShortened) { setShortenError(t("linkShortenErrorAlready")); return; }
    setShortenBusy(true);
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/short-link`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: linkTrim }),
      });
      const json = (await res.json()) as { shortUrl?: string; error?: string };
      if (!res.ok) {
        const err = json.error ?? "";
        if (err === "URL required") setShortenError(t("linkShortenErrorEmpty"));
        else if (err === "Invalid URL") setShortenError(t("linkShortenErrorInvalid"));
        else if (err === "Already a short link") setShortenError(t("linkShortenErrorAlready"));
        else setShortenError(t("linkShortenErrorFailed"));
        return;
      }
      if (json.shortUrl) {
        setLinkInput(json.shortUrl);
        if (added) patch({ link_url: json.shortUrl });
      }
    } catch {
      setShortenError(t("linkShortenErrorFailed"));
    } finally {
      setShortenBusy(false);
    }
  }

  return (
    <div className="space-y-6 rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
      <h2 className="text-sm font-semibold text-ink">{t("step3Title")}</h2>
      <div className="space-y-3">
        <div>
          <label className="block text-xs text-ink-muted">{t("linkOptional")}</label>
          <input
            value={linkInput}
            onChange={(e) => { setShortenError(null); setLinkInput(e.target.value); }}
            disabled={added}
            className={`mt-1 w-full rounded-lg border px-3 py-2 text-sm outline-none ring-accent/30 focus:ring-2 ${
              added ? "cursor-not-allowed border-zinc-200 bg-zinc-50 text-ink-muted" : "border-zinc-200"
            }`}
            placeholder={t("linkPlaceholder")}
          />
          <div className="mt-2 flex w-full gap-2">
            {!added ? (
              <>
                <ShortenSplitButton onShorten={shortenLink} shortenDisabled={!linkTrim || isShortened} busy={shortenBusy} t={t} />
                <button type="button" disabled={!linkTrim} onClick={addToSms} className="min-w-0 flex-1 rounded-lg bg-accent px-2 py-2 text-center text-xs font-medium text-white shadow-sm transition hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50">
                  {t("linkAddToSms")}
                </button>
              </>
            ) : (
              <>
                <ShortenSplitButton onShorten={shortenLink} shortenDisabled={isShortened} busy={shortenBusy} t={t} />
                <button type="button" onClick={resetLink} className="min-w-0 flex-1 rounded-lg border border-zinc-200 bg-white px-2 py-2 text-center text-xs font-medium text-ink shadow-sm transition hover:bg-surface-muted">
                  {t("linkAddNew")}
                </button>
              </>
            )}
          </div>
          {shortenError ? <p className="mt-1 text-xs text-red-600">{shortenError}</p> : null}
        </div>
        <div>
          <label className="text-xs text-ink-muted">{t("message")}</label>
          <div className="mt-1 overflow-hidden rounded-lg border border-zinc-200 focus-within:ring-2 focus-within:ring-accent/30">
            <textarea
              value={draft.body}
              onChange={(e) => patch({ body: e.target.value })}
              rows={5}
              className="w-full resize-none bg-transparent px-3 py-2 text-sm outline-none"
              placeholder={t("messagePlaceholder")}
            />
            {added && linkTrim ? (
              <div className="px-3 pb-2">
                <span className="inline-block rounded bg-blue-100 px-2 py-0.5 font-mono text-xs text-blue-700">{linkTrim}</span>
              </div>
            ) : null}
          </div>
          <p className="mt-1 text-xs text-ink-muted">{t("charsHint", { count: charCount, max: SMS_HINT })}</p>
        </div>
      </div>
    </div>
  );
}

function ProductsEditor({
  products,
  onChange,
  max,
  tEmail,
}: {
  products: ProductItem[];
  onChange: (products: ProductItem[]) => void;
  max: number;
  tEmail: WizardTranslate;
}) {
  function addProduct() {
    if (products.length >= max) return;
    onChange([...products, { imageUrl: "", productUrl: "", name: "", description: "" }]);
  }
  function removeProduct(i: number) {
    onChange(products.filter((_, idx) => idx !== i));
  }
  function updateProduct(i: number, field: keyof ProductItem, value: string) {
    onChange(products.map((p, idx) => (idx === i ? { ...p, [field]: value } : p)));
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-xs font-medium text-ink-muted">
          {tEmail("products")} ({tEmail("productsMax", { max })})
        </label>
        {products.length < max && (
          <button
            type="button"
            onClick={addProduct}
            className="text-xs font-medium text-accent hover:text-accent-hover"
          >
            + {tEmail("addProduct")}
          </button>
        )}
      </div>
      {products.map((p, i) => (
        <div key={i} className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-ink-muted">{tEmail("productN", { n: i + 1 })}</p>
            <button type="button" onClick={() => removeProduct(i)} className="text-xs text-red-500 hover:text-red-700">
              {tEmail("removeProduct")}
            </button>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <div>
              <label className="text-xs text-ink-muted">{tEmail("productName")}</label>
              <input
                value={p.name}
                onChange={(e) => updateProduct(i, "name", e.target.value)}
                className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm"
                placeholder={tEmail("productNamePh")}
              />
            </div>
            <div>
              <label className="text-xs text-ink-muted">{tEmail("productUrl")}</label>
              <input
                value={p.productUrl}
                onChange={(e) => updateProduct(i, "productUrl", e.target.value)}
                className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm"
                placeholder="https://"
              />
            </div>
            <div>
              <label className="text-xs text-ink-muted">{tEmail("productImageUrl")}</label>
              <input
                value={p.imageUrl}
                onChange={(e) => updateProduct(i, "imageUrl", e.target.value)}
                className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm"
                placeholder="https://..."
              />
            </div>
            <div>
              <label className="text-xs text-ink-muted">{tEmail("productDesc")}</label>
              <input
                value={p.description}
                onChange={(e) => updateProduct(i, "description", e.target.value)}
                className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm"
                placeholder={tEmail("productDescPh")}
              />
            </div>
          </div>
        </div>
      ))}
      {products.length === 0 && (
        <p className="text-xs text-ink-muted">{tEmail("noProductsYet")}</p>
      )}
    </div>
  );
}

function ListEditor({
  items,
  onChange,
  max,
  label,
  placeholder,
}: {
  items: string[];
  onChange: (items: string[]) => void;
  max: number;
  label: string;
  placeholder: string;
}) {
  const ensured = items.length ? items : [""];
  function update(i: number, val: string) {
    const next = [...ensured];
    next[i] = val;
    onChange(next);
  }
  function add() {
    if (ensured.length >= max) return;
    onChange([...ensured, ""]);
  }
  function remove(i: number) {
    if (ensured.length <= 1) {
      onChange([""]);
    } else {
      onChange(ensured.filter((_, idx) => idx !== i));
    }
  }

  return (
    <div className="space-y-2">
      <label className="text-xs font-medium text-ink-muted">{label}</label>
      {ensured.map((item, i) => (
        <div key={i} className="flex gap-2">
          <input
            value={item}
            onChange={(e) => update(i, e.target.value)}
            className="flex-1 rounded-lg border border-zinc-200 px-3 py-2 text-sm"
            placeholder={placeholder}
          />
          <button
            type="button"
            onClick={() => remove(i)}
            className="px-2 text-zinc-400 hover:text-red-500"
            aria-label="Remove"
          >
            ×
          </button>
        </div>
      ))}
      {ensured.length < max && (
        <button type="button" onClick={add} className="text-xs font-medium text-accent hover:text-accent-hover">
          + Add
        </button>
      )}
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
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [emailIncludeAll, setEmailIncludeAll] = useState(true);
  const [emailSelectedIds, setEmailSelectedIds] = useState<Set<string>>(new Set());
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [membersTotal, setMembersTotal] = useState(0);
  const [membersPage, setMembersPage] = useState(1);
  const membersLimit = 25;

  // Email template selection (step 4 for email)
  const [emailTemplateType, setEmailTemplateType] = useState<EmailTemplateType | null>(null);

  // Email template fields (step 5 for email)
  const [senderEmail, setSenderEmail] = useState("");
  const [senderDisplayName, setSenderDisplayName] = useState("");
  const [subjectLine, setSubjectLine] = useState("");
  const [language, setLanguage] = useState("en");
  // Shared fields
  const [heroHeadline, setHeroHeadline] = useState("");
  const [supportingLine, setSupportingLine] = useState("");
  const [ctaText, setCtaText] = useState("");
  const [ctaUrl, setCtaUrl] = useState("");
  const [offerDescription, setOfferDescription] = useState("");
  const [products, setProducts] = useState<ProductItem[]>([]);
  // Product launch
  const [productName, setProductName] = useState("");
  const [productImageUrl, setProductImageUrl] = useState("");
  const [launchHeadline, setLaunchHeadline] = useState("");
  const [story, setStory] = useState("");
  const [features, setFeatures] = useState<string[]>(["", "", ""]);
  const [benefits, setBenefits] = useState<string[]>(["", ""]);
  // Seasonal
  const [urgencyMessage, setUrgencyMessage] = useState("");
  const [countdownText, setCountdownText] = useState("");
  // Discount/Coupon
  const [discountAmount, setDiscountAmount] = useState("");
  const [couponCode, setCouponCode] = useState("");
  const [redemptionSteps, setRedemptionSteps] = useState<string[]>(["", "", ""]);

  const maxStep = channel === "email" ? 5 : 4;

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
          email_template_type?: string | null;
          email_template_data?: Record<string, unknown> | null;
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
      const ch: CampaignChannel = c.channel === "email" ? "email" : "sms";
      setChannel(ch);
      setEmailIncludeAll(c.email_include_all !== false);
      const ids = Array.isArray(c.email_selected_member_ids) ? c.email_selected_member_ids : [];
      setEmailSelectedIds(new Set(ids.filter(Boolean)));

      const hasEmailContent =
        ch === "email" && (c.email_template_data ?? c.email_html) &&
        (c.status === "draft" || c.status === "rejected");

      if (hasEmailContent) {
        router.replace(`/dashboard/campaigns/${id}/email-ready`);
        return;
      }

      if (data.steps?.length) {
        const mapped = data.steps.map((s) => ({
          body: s.body,
          link_url: s.link_url ?? "",
          delay_after_previous_hours: s.delay_after_previous_hours ?? 0,
        }));
        if (ch === "sms") {
          const first = mapped[0]!;
          setSteps([{ body: first.body ?? "", link_url: first.link_url ?? "", delay_after_previous_hours: 0 }]);
        } else {
          setSteps(mapped);
        }
      }
    },
    [router, t]
  );

  useEffect(() => { setHydrated(true); }, []);

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
    return () => { cancelled = true; };
  }, [hydrated, idParam, loadCampaign, t]);

  useEffect(() => {
    if (step !== 2) return;
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
    return () => { cancelled = true; };
  }, [step, audienceId, channel]);

  useEffect(() => {
    const found = audiences.find((a) => a.id === audienceId);
    setAudienceLabel(found?.name ?? "");
  }, [audienceId, audiences]);

  useEffect(() => {
    if (channel !== "sms") return;
    setSteps((prev) => {
      const head = prev[0] ?? { body: "", link_url: "", delay_after_previous_hours: 0 };
      const one: StepDraft = { body: head.body, link_url: head.link_url, delay_after_previous_hours: 0 };
      if (prev.length === 1 && prev[0].body === one.body && prev[0].link_url === one.link_url && prev[0].delay_after_previous_hours === 0) return prev;
      return [one];
    });
  }, [channel]);

  useEffect(() => {
    if (channel !== "email" || step !== 3 || !audienceId) return;
    let cancelled = false;
    async function loadMembers() {
      const res = await fetch(`/api/audiences/${audienceId}/members?page=${membersPage}&limit=${membersLimit}`);
      const json = (await res.json()) as { members?: MemberRow[]; total?: number; error?: string };
      if (cancelled) return;
      if (!res.ok) { setError(json.error ?? tEmail("membersLoadFailed")); return; }
      setMembers(json.members ?? []);
      setMembersTotal(json.total ?? 0);
    }
    void loadMembers();
    return () => { cancelled = true; };
  }, [channel, step, audienceId, membersPage, tEmail]);

  useEffect(() => {
    if (channel !== "email" || step !== 5) return;
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
    return () => { cancelled = true; };
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
    const only = steps[0] ?? { body: "", link_url: "", delay_after_previous_hours: 0 };
    const payload = {
      steps: [{ step_order: 1, body: only.body, link_url: only.link_url.trim() || null, delay_after_previous_hours: 0 }],
    };
    const res = await fetch(`/api/campaigns/${idParam}/steps`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const json = (await res.json()) as { error?: string };
    if (!res.ok) throw new Error(json.error ?? t("saveMessagesFailed"));
  }

  const buildTemplateData = useMemo(() => {
    if (!emailTemplateType) return null;
    switch (emailTemplateType) {
      case "promotional":
        return {
          templateType: "promotional" as const,
          subjectLine: subjectLine.trim(),
          language,
          heroHeadline: heroHeadline.trim(),
          supportingLine: supportingLine.trim(),
          ctaText: ctaText.trim(),
          ctaUrl: ctaUrl.trim(),
          offerDescription: offerDescription.trim(),
          products,
        };
      case "product_launch":
        return {
          templateType: "product_launch" as const,
          subjectLine: subjectLine.trim(),
          language,
          productName: productName.trim(),
          productImageUrl: productImageUrl.trim(),
          launchHeadline: launchHeadline.trim(),
          ctaText: ctaText.trim(),
          ctaUrl: ctaUrl.trim(),
          story: story.trim(),
          features: features.filter(Boolean),
          benefits: benefits.filter(Boolean),
        };
      case "seasonal":
        return {
          templateType: "seasonal" as const,
          subjectLine: subjectLine.trim(),
          language,
          seasonalHeadline: heroHeadline.trim(),
          urgencyMessage: urgencyMessage.trim(),
          ctaText: ctaText.trim(),
          ctaUrl: ctaUrl.trim(),
          countdownText: countdownText.trim(),
          offerDescription: offerDescription.trim(),
          products,
        };
      case "discount_coupon":
        return {
          templateType: "discount_coupon" as const,
          subjectLine: subjectLine.trim(),
          language,
          discountAmount: discountAmount.trim(),
          couponCode: couponCode.trim(),
          heroHeadline: heroHeadline.trim(),
          ctaText: ctaText.trim(),
          ctaUrl: ctaUrl.trim(),
          redemptionSteps: redemptionSteps.filter(Boolean),
          products,
        };
    }
  }, [
    emailTemplateType, subjectLine, language, heroHeadline, supportingLine, ctaText, ctaUrl,
    offerDescription, products, productName, productImageUrl, launchHeadline, story, features, benefits,
    urgencyMessage, countdownText, discountAmount, couponCode, redemptionSteps,
  ]);

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
        const first = steps[0];
        const valid = Boolean(composeSmsBody(first?.body ?? "", first?.link_url ?? "").trim());
        if (!valid) throw new Error(t("addMessage"));
        await saveSteps();
      }
      if (step === 3 && channel === "email") {
        if (!emailIncludeAll && emailSelectedIds.size === 0) throw new Error(tEmail("pickRecipients"));
        await patchCampaign({
          email_include_all: emailIncludeAll,
          email_selected_member_ids: emailIncludeAll ? [] : Array.from(emailSelectedIds),
        });
      }
      if (step === 4 && channel === "email") {
        if (!emailTemplateType) throw new Error(tEmail("selectTemplate"));
        await patchCampaign({ email_template_type: emailTemplateType });
      }
      setStep((s) => Math.min(maxStep, s + 1));
    } catch (e) {
      setError(e instanceof Error ? e.message : t("errorGeneric"));
    } finally {
      setBusy(false);
    }
  }

  async function buildEmailAndOpen() {
    if (!idParam) return;
    setError(null);
    setBusy(true);
    try {
      const templateData = buildTemplateData;
      if (!templateData) throw new Error(tEmail("templateDataRequired"));

      if (!templateData.subjectLine) throw new Error(tEmail("subjectRequired"));
      if (!templateData.ctaUrl) throw new Error(tEmail("ctaUrlRequired"));
      if (!templateData.ctaText) throw new Error(tEmail("ctaTextRequired"));

      if (emailTemplateType === "promotional" || emailTemplateType === "seasonal") {
        if (!(templateData as { heroHeadline?: string }).heroHeadline) {
          throw new Error(tEmail("headlineRequired"));
        }
      }
      if (emailTemplateType === "product_launch") {
        const d = templateData as { productName?: string; launchHeadline?: string };
        if (!d.productName) throw new Error(tEmail("productNameRequired"));
        if (!d.launchHeadline) throw new Error(tEmail("launchHeadlineRequired"));
      }
      if (emailTemplateType === "discount_coupon") {
        const d = templateData as { discountAmount?: string; couponCode?: string };
        if (!d.discountAmount) throw new Error(tEmail("discountAmountRequired"));
        if (!d.couponCode) throw new Error(tEmail("couponCodeRequired"));
      }

      const se = senderEmail.trim().toLowerCase();
      if (!se || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(se)) throw new Error(tEmail("senderEmailInvalid"));

      const patchProfile = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sender_email: se,
          sender_display_name: senderDisplayName.trim() || null,
        }),
      });
      const pe = (await patchProfile.json()) as { error?: string };
      if (!patchProfile.ok) throw new Error(pe.error ?? tEmail("senderSaveFailed"));

      const gen = await fetch(`/api/campaigns/${idParam}/generate-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ templateData, colorTheme: DEFAULT_THEME_KEY }),
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
      try { await fetch("/api/sms/process", { method: "POST" }); } catch { /* optional */ }
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
      if (checked) next.add(id); else next.delete(id);
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
        <Link href="/dashboard/campaigns/new" className="text-accent hover:text-accent-hover">{t("startAgain")}</Link>.
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
          <Link href="/dashboard/campaigns" className="text-sm text-ink-muted hover:text-ink">{t("backCampaigns")}</Link>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">{t("title")}</h1>
        </div>
        <StepIndicator step={step} max={maxStep} />
      </div>

      {error ? <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}

      {/* Step 1 — Name + Channel */}
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
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => { if (channel !== "sms") setAudienceId(""); setChannel("sms"); }}
                className={`rounded-xl border-2 px-4 py-4 text-left transition ${channel === "sms" ? "border-accent bg-accent/5" : "border-zinc-200 hover:border-zinc-300"}`}
              >
                <p className="text-sm font-semibold text-ink">{t("channelSms")}</p>
                <p className="mt-1 text-xs text-ink-muted">{t("channelSmsDesc")}</p>
              </button>
              <button
                type="button"
                onClick={() => { if (channel !== "email") setAudienceId(""); setChannel("email"); }}
                className={`rounded-xl border-2 px-4 py-4 text-left transition ${channel === "email" ? "border-accent bg-accent/5" : "border-zinc-200 hover:border-zinc-300"}`}
              >
                <p className="text-sm font-semibold text-ink">{t("channelEmail")}</p>
                <p className="mt-1 text-xs text-ink-muted">{t("channelEmailDesc")}</p>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Step 2 — Audience */}
      {step === 2 && (
        <div className="space-y-4 rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
          <h2 className="text-sm font-semibold text-ink">{channel === "email" ? tEmail("step2Title") : t("step2Title")}</h2>
          <p className="text-sm text-ink-muted">{channel === "email" ? tEmail("step2Hint") : t("step2Hint")}</p>
          <select
            value={audienceId}
            onChange={(e) => setAudienceId(e.target.value)}
            className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm"
          >
            <option value="">{t("selectAudiencePlaceholder")}</option>
            {audiences.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
          <Link
            href={channel === "email" ? "/dashboard/audience/emails" : "/dashboard/audience/phones"}
            className="inline-block text-sm font-medium text-accent hover:text-accent-hover"
          >
            {channel === "email" ? tEmail("manageEmails") : t("managePhones")}
          </Link>
        </div>
      )}

      {/* Step 3 — SMS message or email recipients */}
      {step === 3 && channel === "sms" && (
        <SmsMessageStep
          draft={steps[0] ?? { body: "", link_url: "", delay_after_previous_hours: 0 }}
          onChange={(next) => setSteps([next])}
          campaignId={idParam}
          t={t as WizardTranslate}
        />
      )}

      {step === 3 && channel === "email" && (
        <div className="space-y-4 rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
          <h2 className="text-sm font-semibold text-ink">{tEmail("step3Title")}</h2>
          <p className="text-sm text-ink-muted">{tEmail("step3Hint")}</p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => { setEmailIncludeAll(true); setEmailSelectedIds(new Set()); }}
              className={`rounded-lg border px-3 py-2 text-xs font-medium ${emailIncludeAll ? "border-accent bg-accent/10 text-ink" : "border-zinc-200 bg-white"}`}
            >
              {tEmail("entireAudience")}
            </button>
            <button
              type="button"
              onClick={() => setEmailIncludeAll(false)}
              className={`rounded-lg border px-3 py-2 text-xs font-medium ${!emailIncludeAll ? "border-accent bg-accent/10 text-ink" : "border-zinc-200 bg-white"}`}
            >
              {tEmail("pickRecipients")}
            </button>
          </div>
          {emailIncludeAll ? (
            <p className="text-sm text-ink">{tEmail("entireAudienceCount", { count: membersTotal })}</p>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <button type="button" onClick={selectAllOnPage} className="text-accent hover:underline">{tEmail("selectPage")}</button>
                <span className="text-ink-muted">·</span>
                <button type="button" onClick={clearPageSelection} className="text-accent hover:underline">{tEmail("clearPage")}</button>
                <span className="text-ink-muted">·</span>
                <button type="button" onClick={() => setEmailSelectedIds(new Set())} className="text-accent hover:underline">{tEmail("clearAll")}</button>
              </div>
              <p className="text-xs text-ink-muted">{tEmail("selectedCount", { count: emailSelectedIds.size })}</p>
              <ul className="max-h-72 divide-y divide-zinc-100 overflow-y-auto rounded-lg border border-zinc-200">
                {members.map((m) => (
                  <li key={m.id} className="flex items-center gap-3 px-3 py-2 text-sm">
                    <input type="checkbox" checked={emailSelectedIds.has(m.id)} onChange={(e) => toggleMember(m.id, e.target.checked)} />
                    <span className="font-mono text-xs text-ink">{m.value}</span>
                  </li>
                ))}
              </ul>
              <div className="flex items-center justify-between text-xs text-ink-muted">
                <button type="button" disabled={membersPage <= 1} onClick={() => setMembersPage((p) => Math.max(1, p - 1))} className="rounded border border-zinc-200 px-2 py-1 disabled:opacity-40">{tEmail("prev")}</button>
                <span>{tEmail("page", { page: membersPage, pages: Math.max(1, Math.ceil(membersTotal / membersLimit)) })}</span>
                <button type="button" disabled={membersPage * membersLimit >= membersTotal} onClick={() => setMembersPage((p) => p + 1)} className="rounded border border-zinc-200 px-2 py-1 disabled:opacity-40">{tEmail("next")}</button>
              </div>
            </>
          )}
        </div>
      )}

      {/* Step 4 (email) — Template type selection */}
      {step === 4 && channel === "email" && (
        <div className="space-y-6 rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
          <div>
            <h2 className="text-sm font-semibold text-ink">{tEmail("step4Title")}</h2>
            <p className="mt-1 text-sm text-ink-muted">{tEmail("step4Hint")}</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {(["promotional", "product_launch", "seasonal", "discount_coupon"] as EmailTemplateType[]).map((type) => {
              const cfg = TEMPLATE_CONFIGS[type];
              const selected = emailTemplateType === type;
              return (
                <button
                  key={type}
                  type="button"
                  onClick={() => setEmailTemplateType(type)}
                  className={`rounded-xl border-2 p-4 text-left transition ${selected ? "border-accent bg-accent/5" : "border-zinc-200 hover:border-zinc-300 hover:bg-zinc-50"}`}
                >
                  <span className="text-2xl">{cfg.icon}</span>
                  <p className="mt-2 text-sm font-semibold text-ink">{tEmail(`template_${type}_title`)}</p>
                  <p className="mt-1 text-xs text-ink-muted leading-relaxed">{tEmail(`template_${type}_desc`)}</p>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Step 4 (sms) — Review */}
      {step === 4 && channel === "sms" && (
        <div className="space-y-4 rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
          <h2 className="text-sm font-semibold text-ink">{t("step4Title")}</h2>
          <p className="text-sm text-ink-muted">{t("reviewModerationHint")}</p>
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
              <dt className="text-ink-muted">{t("message")}</dt>
              <dd className="max-w-[60%] break-words text-right font-medium text-ink">
                {(() => {
                  const b = composeSmsBody(steps[0]?.body ?? "", steps[0]?.link_url ?? "").trim();
                  if (b) return b.length > 120 ? `${b.slice(0, 120)}…` : b;
                  return t("dash");
                })()}
              </dd>
            </div>
          </dl>
          <p className="text-xs text-ink-muted">{t("compliance")}</p>
        </div>
      )}

      {/* Step 5 (email) — Template fields form */}
      {step === 5 && channel === "email" && emailTemplateType && (
        <div className="space-y-6 rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
          <div>
            <h2 className="text-sm font-semibold text-ink">{tEmail("step5Title")}</h2>
            <p className="mt-1 text-sm text-ink-muted">
              {TEMPLATE_CONFIGS[emailTemplateType].icon}{" "}
              {tEmail(`template_${emailTemplateType}_title`)}
            </p>
          </div>

          {/* Sender identity */}
          <div className="space-y-3 rounded-lg border border-zinc-100 bg-zinc-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">{tEmail("senderSection")}</p>
            <p className="text-xs text-ink-muted">{tEmail("senderSectionHint")}</p>
            <div>
              <label className="text-xs font-medium text-ink-muted">{tEmail("senderDisplayName")}</label>
              <input value={senderDisplayName} onChange={(e) => setSenderDisplayName(e.target.value)} className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm" placeholder={tEmail("senderDisplayPlaceholder")} maxLength={100} />
            </div>
            <div>
              <label className="text-xs font-medium text-ink-muted">{tEmail("senderEmail")} *</label>
              <input type="email" value={senderEmail} onChange={(e) => setSenderEmail(e.target.value)} className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm" placeholder={tEmail("senderEmailPlaceholder")} autoComplete="email" />
            </div>
          </div>

          {/* Common fields */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="text-xs font-medium text-ink-muted">{tEmail("subjectLine")} *</label>
              <input value={subjectLine} onChange={(e) => setSubjectLine(e.target.value)} className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm" placeholder={tEmail("subjectLinePh")} />
            </div>
            <div>
              <label className="text-xs font-medium text-ink-muted">{tEmail("language")}</label>
              <select value={language} onChange={(e) => setLanguage(e.target.value)} className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm">
                <option value="en">English</option>
                <option value="bg">Български</option>
                <option value="de">Deutsch</option>
                <option value="fr">Français</option>
              </select>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="text-xs font-medium text-ink-muted">{tEmail("ctaText")} *</label>
              <input value={ctaText} onChange={(e) => setCtaText(e.target.value)} className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm" placeholder={tEmail("ctaTextPh")} />
            </div>
            <div>
              <label className="text-xs font-medium text-ink-muted">{tEmail("ctaUrl")} *</label>
              <input value={ctaUrl} onChange={(e) => setCtaUrl(e.target.value)} className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm" placeholder="https://" />
            </div>
          </div>

          {/* Promotional / Seasonal fields */}
          {(emailTemplateType === "promotional" || emailTemplateType === "seasonal") && (
            <>
              <div>
                <label className="text-xs font-medium text-ink-muted">
                  {emailTemplateType === "seasonal" ? tEmail("seasonalHeadline") : tEmail("heroHeadline")} *
                </label>
                <input value={heroHeadline} onChange={(e) => setHeroHeadline(e.target.value)} className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm" placeholder={tEmail("heroHeadlinePh")} />
              </div>
              {emailTemplateType === "promotional" && (
                <div>
                  <label className="text-xs font-medium text-ink-muted">{tEmail("supportingLine")}</label>
                  <input value={supportingLine} onChange={(e) => setSupportingLine(e.target.value)} className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm" placeholder={tEmail("supportingLinePh")} />
                </div>
              )}
              {emailTemplateType === "seasonal" && (
                <>
                  <div>
                    <label className="text-xs font-medium text-ink-muted">{tEmail("urgencyMessage")}</label>
                    <input value={urgencyMessage} onChange={(e) => setUrgencyMessage(e.target.value)} className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm" placeholder={tEmail("urgencyMessagePh")} />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-ink-muted">{tEmail("countdownText")}</label>
                    <input value={countdownText} onChange={(e) => setCountdownText(e.target.value)} className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm" placeholder={tEmail("countdownTextPh")} />
                  </div>
                </>
              )}
              <div>
                <label className="text-xs font-medium text-ink-muted">{tEmail("offerDescription")}</label>
                <textarea value={offerDescription} onChange={(e) => setOfferDescription(e.target.value)} rows={3} className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm" placeholder={tEmail("offerDescriptionPh")} />
              </div>
              <ProductsEditor
                products={products}
                onChange={setProducts}
                max={TEMPLATE_CONFIGS[emailTemplateType].maxProducts}
                tEmail={tEmail as WizardTranslate}
              />
            </>
          )}

          {/* Product Launch fields */}
          {emailTemplateType === "product_launch" && (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="text-xs font-medium text-ink-muted">{tEmail("productName")} *</label>
                  <input value={productName} onChange={(e) => setProductName(e.target.value)} className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm" placeholder={tEmail("productNamePh")} />
                </div>
                <div>
                  <label className="text-xs font-medium text-ink-muted">{tEmail("productImageUrl")}</label>
                  <input value={productImageUrl} onChange={(e) => setProductImageUrl(e.target.value)} className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm" placeholder="https://..." />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-ink-muted">{tEmail("launchHeadline")} *</label>
                <input value={launchHeadline} onChange={(e) => setLaunchHeadline(e.target.value)} className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm" placeholder={tEmail("launchHeadlinePh")} />
              </div>
              <div>
                <label className="text-xs font-medium text-ink-muted">{tEmail("story")}</label>
                <textarea value={story} onChange={(e) => setStory(e.target.value)} rows={3} className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm" placeholder={tEmail("storyPh")} />
              </div>
              <ListEditor
                items={features}
                onChange={setFeatures}
                max={5}
                label={tEmail("features")}
                placeholder={tEmail("featuresPh")}
              />
              <ListEditor
                items={benefits}
                onChange={setBenefits}
                max={3}
                label={tEmail("benefits")}
                placeholder={tEmail("benefitsPh")}
              />
            </>
          )}

          {/* Discount / Coupon fields */}
          {emailTemplateType === "discount_coupon" && (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="text-xs font-medium text-ink-muted">{tEmail("discountAmount")} *</label>
                  <input value={discountAmount} onChange={(e) => setDiscountAmount(e.target.value)} className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm" placeholder={tEmail("discountAmountPh")} />
                </div>
                <div>
                  <label className="text-xs font-medium text-ink-muted">{tEmail("couponCode")} *</label>
                  <input value={couponCode} onChange={(e) => setCouponCode(e.target.value.toUpperCase())} className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm font-mono" placeholder="SAVE20" />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-ink-muted">{tEmail("heroHeadline")}</label>
                <input value={heroHeadline} onChange={(e) => setHeroHeadline(e.target.value)} className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm" placeholder={tEmail("couponHeroHeadlinePh")} />
              </div>
              <ListEditor
                items={redemptionSteps}
                onChange={setRedemptionSteps}
                max={5}
                label={tEmail("redemptionSteps")}
                placeholder={tEmail("redemptionStepsPh")}
              />
              <ProductsEditor
                products={products}
                onChange={setProducts}
                max={TEMPLATE_CONFIGS.discount_coupon.maxProducts}
                tEmail={tEmail as WizardTranslate}
              />
            </>
          )}
        </div>
      )}

      {/* Navigation buttons */}
      <div className="flex justify-between gap-3">
        <button
          type="button"
          onClick={goBack}
          disabled={step === 1 || busy}
          className="rounded-lg border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-ink disabled:opacity-40"
        >
          {t("back")}
        </button>

        {channel === "email" && step === 5 ? (
          <button
            type="button"
            onClick={() => void buildEmailAndOpen()}
            disabled={busy}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-60"
          >
            {busy ? tEmail("building") : tEmail("buildEmail")}
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
