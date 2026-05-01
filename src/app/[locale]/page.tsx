import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { LocaleSwitcher } from "@/components/LocaleSwitcher";

export default async function HomePage() {
  const t = await getTranslations("home");

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col justify-center gap-10 px-6 py-20">
      <div className="flex justify-end">
        <LocaleSwitcher />
      </div>
      <div className="space-y-4">
        <p className="text-sm font-medium uppercase tracking-wide text-ink-muted">{t("badge")}</p>
        <h1 className="text-4xl font-semibold tracking-tight text-ink md:text-5xl">{t("headline")}</h1>
        <p className="max-w-xl text-lg text-ink-muted">{t("sub")}</p>
      </div>
      <div className="flex flex-wrap gap-3">
        <Link
          href="/signup"
          className="rounded-lg bg-accent px-5 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-accent-hover"
        >
          {t("createAccount")}
        </Link>
        <Link
          href="/login"
          className="rounded-lg border border-zinc-200 bg-white px-5 py-2.5 text-sm font-medium text-ink shadow-sm transition hover:bg-zinc-50"
        >
          {t("signIn")}
        </Link>
      </div>
    </main>
  );
}
