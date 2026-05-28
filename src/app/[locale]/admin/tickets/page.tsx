import { redirect } from "next/navigation";
import { getAdminUser } from "@/lib/admin/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { TicketsClient } from "@/components/admin/TicketsClient";

export const dynamic = "force-dynamic";

export default async function AdminTicketsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const adminUser = await getAdminUser();
  if (!adminUser) redirect(`/${locale}/dashboard`);

  const db = createAdminClient();
  const { count: openCount } = await db
    .from("tickets")
    .select("id", { count: "exact", head: true })
    .eq("resolved", false);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-white">Tickets</h1>
            {(openCount ?? 0) > 0 ? (
              <span className="rounded-full bg-red-600 px-2 py-0.5 text-xs font-bold text-white">
                {openCount} open
              </span>
            ) : null}
          </div>
          <p className="mt-1 text-sm text-zinc-500">
            Platform errors reported by the system. Resolve them once you have fixed the underlying issue.
          </p>
        </div>
      </div>

      <TicketsClient locale={locale} />
    </div>
  );
}
