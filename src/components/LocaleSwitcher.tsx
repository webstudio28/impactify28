"use client";

import { useLocale, useTranslations } from "next-intl";
import { usePathname, useRouter } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";

export function LocaleSwitcher() {
  const t = useTranslations("locale");
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();

  return (
    <label className="flex items-center gap-2 text-xs text-ink-muted">
      <span className="sr-only">Language</span>
      <select
        value={locale}
        aria-label="Language"
        onChange={(e) => {
          const next = e.target.value;
          router.replace(pathname, { locale: next });
          router.refresh();
        }}
        className="rounded-md border border-zinc-200 bg-white px-2 py-1 text-xs text-ink"
      >
        {routing.locales.map((loc) => (
          <option key={loc} value={loc}>
            {t(loc)}
          </option>
        ))}
      </select>
    </label>
  );
}
