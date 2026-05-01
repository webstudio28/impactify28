import { routing } from "@/i18n/routing";

export function withLocalePrefix(path: string, locale: string): string {
  if (!path.startsWith("/") || path.startsWith("//")) return `/${locale}/dashboard`;
  const segment = path.split("/").filter(Boolean)[0];
  if (segment && routing.locales.includes(segment as "en" | "bg")) {
    return path;
  }
  return `/${locale}${path === "/" ? "" : path}`;
}

export function localeFromPathname(pathname: string): string {
  const segment = pathname.split("/").filter(Boolean)[0];
  if (segment && routing.locales.includes(segment as "en" | "bg")) {
    return segment;
  }
  return routing.defaultLocale;
}
