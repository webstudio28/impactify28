import { redirect } from "next/navigation";
import { getAdminUser } from "@/lib/admin/auth";
import { AdminSidebar } from "@/components/admin/AdminSidebar";

export const dynamic = "force-dynamic";

export default async function AdminLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const adminUser = await getAdminUser();

  if (!adminUser) {
    redirect(`/${locale}/dashboard`);
  }

  return (
    <div className="flex min-h-screen bg-zinc-950">
      <AdminSidebar adminEmail={adminUser.email ?? ""} locale={locale} />
      <div className="flex min-h-screen flex-1 flex-col overflow-hidden">
        <div className="flex-1 overflow-auto p-6 md:p-8">{children}</div>
      </div>
    </div>
  );
}
