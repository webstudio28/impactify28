import Link from "next/link";
import { SignOutButton } from "@/components/dashboard/SignOutButton";

export const dynamic = "force-dynamic";

const nav = [
  { href: "/dashboard", label: "Overview" },
  { href: "/dashboard/audience/phones", label: "Phone numbers" },
  { href: "/dashboard/audience/emails", label: "Emails" },
  { href: "/dashboard/campaigns", label: "Campaigns" },
  { href: "/dashboard/campaigns/new", label: "Create campaign" },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <aside className="hidden w-56 shrink-0 border-r border-zinc-200 bg-white md:block">
        <div className="flex h-full flex-col px-4 py-6">
          <Link href="/dashboard" className="px-2 text-sm font-semibold tracking-tight text-ink">
            Impact28
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
          <SignOutButton />
        </div>
      </aside>
      <div className="flex min-h-screen flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-zinc-200 bg-white px-4 py-3 md:hidden">
          <Link href="/dashboard" className="text-sm font-semibold">
            Impact28
          </Link>
          <SignOutButton />
        </header>
        <div className="flex-1 bg-surface p-6 md:p-10">{children}</div>
      </div>
    </div>
  );
}
