import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";

export default async function AudienceHubPage() {
  const t = await getTranslations("audienceHub");

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="mt-1 text-sm text-ink-muted">{t("subtitle")}</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Link
          href="/dashboard/audience/phones"
          className="rounded-xl border-2 border-zinc-200 bg-white p-6 shadow-sm transition hover:border-accent hover:bg-accent/5"
        >
          <h2 className="text-lg font-semibold text-ink">{t("phonesTitle")}</h2>
          <p className="mt-2 text-sm text-ink-muted">{t("phonesDesc")}</p>
          <span className="mt-4 inline-block text-sm font-medium text-accent">{t("open")} →</span>
        </Link>
        <Link
          href="/dashboard/audience/emails"
          className="rounded-xl border-2 border-zinc-200 bg-white p-6 shadow-sm transition hover:border-accent hover:bg-accent/5"
        >
          <h2 className="text-lg font-semibold text-ink">{t("emailsTitle")}</h2>
          <p className="mt-2 text-sm text-ink-muted">{t("emailsDesc")}</p>
          <span className="mt-4 inline-block text-sm font-medium text-accent">{t("open")} →</span>
        </Link>
      </div>
    </div>
  );
}
