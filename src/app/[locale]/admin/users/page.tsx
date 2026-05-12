import { redirect } from "next/navigation";
import { getAdminUser } from "@/lib/admin/auth";
import { UsersTable } from "@/components/admin/UsersTable";

export const dynamic = "force-dynamic";

export default async function AdminUsersPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const adminUser = await getAdminUser();
  if (!adminUser) redirect(`/${locale}/dashboard`);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white">Users</h1>
        <p className="mt-1 text-sm text-zinc-500">
          All registered platform users. Click a user to see full details.
        </p>
      </div>
      <UsersTable locale={locale} />
    </div>
  );
}
