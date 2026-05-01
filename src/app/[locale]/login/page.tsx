import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Suspense } from "react";
import { LoginForm } from "./ui";
import { LocaleSwitcher } from "@/components/LocaleSwitcher";

export default async function LoginPage() {
  const t = await getTranslations("login");

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-8 px-6 py-16">
      <div className="flex justify-end">
        <LocaleSwitcher />
      </div>
      <div>
        <Link href="/" className="text-sm text-ink-muted hover:text-ink">
          {t("back")}
        </Link>
        <h1 className="mt-6 text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="mt-2 text-sm text-ink-muted">{t("subtitle")}</p>
      </div>
      <Suspense fallback={<p className="text-sm text-ink-muted">{t("loading")}</p>}>
        <LoginForm />
      </Suspense>
      <p className="text-center text-sm text-ink-muted">
        {t("noAccount")}{" "}
        <Link href="/signup" className="font-medium text-accent hover:text-accent-hover">
          {t("signUp")}
        </Link>
      </p>
    </main>
  );
}
