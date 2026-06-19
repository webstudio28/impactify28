const BCP47: Record<string, string> = { en: "en-GB", bg: "bg-BG" };

/** Same output on server and client when `appLocale` comes from `[locale]`. */
export function formatAppDate(iso: string, appLocale: string, preset: "date" | "datetime"): string {
  const tag = BCP47[appLocale] ?? "en-GB";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  try {
    const opts: Intl.DateTimeFormatOptions =
      preset === "datetime"
        ? { dateStyle: "short", timeStyle: "short" }
        : { dateStyle: "short" };
    return new Intl.DateTimeFormat(tag, opts).format(date);
  } catch {
    return iso;
  }
}
