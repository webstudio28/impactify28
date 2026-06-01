import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { SignOutButton } from "@/components/dashboard/SignOutButton";
import { LocaleSwitcher } from "@/components/LocaleSwitcher";
import { DomainSetupGate } from "@/components/dashboard/DomainSetupGate";
import { ProfileButton } from "@/components/dashboard/ProfileButton";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const t = await getTranslations("nav");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let hasSenderEmail = false;
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("sender_display_name")
      .eq("id", user.id)
      .single();
    hasSenderEmail = Boolean(profile?.sender_display_name?.trim());
  }

  const nav = [
    { href: "/dashboard" as const, label: t("overview") },
    { href: "/dashboard/audience" as const, label: t("audience") },
    { href: "/dashboard/campaigns" as const, label: t("campaigns") },
    { href: "/dashboard/tracker" as const, label: t("salesTracker") },
    { href: "/dashboard/campaigns/new" as const, label: t("newCampaign") },
  ];

  return (
    <div className="flex min-h-screen">
      <aside className="hidden w-56 shrink-0 border-r border-zinc-200 bg-white md:block">
        <div className="flex h-full flex-col px-4 py-6">
          <Link href="/dashboard" className="px-2 text-sm font-semibold tracking-tight text-ink">
            {t("brand")}
          </Link>
          <nav className="mt-8 flex flex-1 flex-col gap-1">
            {nav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-md px-2 py-2 text-sm text-ink-muted transition hover:bg-surface-muted hover:text-ink"
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="mt-4 border-t border-zinc-100 pt-4">
            <LocaleSwitcher />
          </div>
          <div className="mt-3 border-t border-zinc-100 pt-3">
            <ProfileButton userEmail={user?.email ?? ""} />
          </div>
        </div>
      </aside>
      <div className="flex min-h-screen flex-1 flex-col">
        <header className="flex items-center justify-between gap-3 border-b border-zinc-200 bg-white px-4 py-3 md:hidden">
          <Link href="/dashboard" className="text-sm font-semibold">
            {t("brand")}
          </Link>
          <div className="flex items-center gap-2">
            <LocaleSwitcher />
            <SignOutButton />
          </div>
        </header>
        <div className="flex-1 bg-surface p-6 md:p-10">
          <DomainSetupGate hasSenderEmail={hasSenderEmail}>{children}</DomainSetupGate>
        </div>
      </div>
    </div>
  );
}
