import { redirect } from "next/navigation";
import Link from "next/link";
import { getAdminUser } from "@/lib/admin/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { StatusBadge } from "@/components/admin/StatusBadge";

export const dynamic = "force-dynamic";

function StatCard({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string | number;
  sub?: string;
  accent?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border p-5 ${
        accent
          ? "border-blue-500/30 bg-blue-500/10"
          : "border-zinc-800 bg-zinc-900"
      }`}
    >
      <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">{label}</p>
      <p className={`mt-2 text-3xl font-bold tabular-nums ${accent ? "text-blue-400" : "text-white"}`}>
        {value}
      </p>
      {sub && <p className="mt-1 text-xs text-zinc-500">{sub}</p>}
    </div>
  );
}

export default async function AdminOverviewPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const adminUser = await getAdminUser();
  if (!adminUser) redirect(`/${locale}/dashboard`);

  const db = createAdminClient();

  const [
    { count: totalUsers },
    { count: totalCampaigns },
    { count: activeCampaigns },
    { count: smsSent },
    { count: smsFailed },
    { count: smsPending },
    { count: emailSent },
    { count: emailFailed },
    { count: emailPending },
    { count: totalContacts },
    { data: recentUsers },
    { data: recentCampaigns },
  ] = await Promise.all([
    db.from("profiles").select("*", { count: "exact", head: true }),
    db.from("campaigns").select("*", { count: "exact", head: true }),
    db.from("campaigns").select("*", { count: "exact", head: true }).in("status", ["running", "paused"]),
    db.from("outbound_sms").select("*", { count: "exact", head: true }).eq("status", "sent"),
    db.from("outbound_sms").select("*", { count: "exact", head: true }).eq("status", "failed"),
    db.from("outbound_sms").select("*", { count: "exact", head: true }).eq("status", "pending"),
    db.from("outbound_email").select("*", { count: "exact", head: true }).eq("status", "sent"),
    db.from("outbound_email").select("*", { count: "exact", head: true }).eq("status", "failed"),
    db.from("outbound_email").select("*", { count: "exact", head: true }).eq("status", "pending"),
    db.from("audience_members").select("*", { count: "exact", head: true }),
    db
      .from("profiles")
      .select("id, business_name, role, created_at")
      .order("created_at", { ascending: false })
      .limit(8),
    db
      .from("campaigns")
      .select("id, name, status, channel, created_at, user_id, profiles!inner(business_name)")
      .order("created_at", { ascending: false })
      .limit(8),
  ]);

  const totalSent = (smsSent ?? 0) + (emailSent ?? 0);
  const totalFailed = (smsFailed ?? 0) + (emailFailed ?? 0);
  const totalPending = (smsPending ?? 0) + (emailPending ?? 0);

  return (
    <div className="mx-auto max-w-6xl space-y-10">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white">Platform Overview</h1>
        <p className="mt-1 text-sm text-zinc-500">Real-time data across all tenants</p>
      </div>

      {/* Platform stats */}
      <section>
        <h2 className="mb-4 text-xs font-semibold uppercase tracking-widest text-zinc-600">
          Platform
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Total Users" value={totalUsers ?? 0} accent />
          <StatCard label="Total Campaigns" value={totalCampaigns ?? 0} />
          <StatCard
            label="Active Campaigns"
            value={activeCampaigns ?? 0}
            sub="running or paused"
          />
          <StatCard label="Total Contacts" value={(totalContacts ?? 0).toLocaleString()} />
        </div>
      </section>

      {/* Messaging stats */}
      <section>
        <h2 className="mb-4 text-xs font-semibold uppercase tracking-widest text-zinc-600">
          Messaging
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <StatCard
            label="Total Sent"
            value={totalSent.toLocaleString()}
            sub={`SMS: ${(smsSent ?? 0).toLocaleString()} · Email: ${(emailSent ?? 0).toLocaleString()}`}
            accent
          />
          <StatCard
            label="Pending Queue"
            value={totalPending.toLocaleString()}
            sub={`SMS: ${(smsPending ?? 0).toLocaleString()} · Email: ${(emailPending ?? 0).toLocaleString()}`}
          />
          <StatCard
            label="Failed Messages"
            value={totalFailed.toLocaleString()}
            sub={`SMS: ${(smsFailed ?? 0).toLocaleString()} · Email: ${(emailFailed ?? 0).toLocaleString()}`}
          />
        </div>
      </section>

      {/* Two-column: recent users + recent campaigns */}
      <div className="grid gap-8 lg:grid-cols-2">
        {/* Recent users */}
        <section>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-zinc-300">Recent Sign-ups</h2>
            <Link
              href={`/${locale}/admin/users`}
              className="text-xs text-zinc-500 transition hover:text-zinc-300"
            >
              View all →
            </Link>
          </div>
          <div className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900">
            {(recentUsers ?? []).length === 0 ? (
              <p className="p-5 text-sm text-zinc-600">No users yet.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-800">
                    <th className="px-4 py-3 text-left text-xs font-medium text-zinc-600">Business</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-zinc-600">Role</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-zinc-600">Joined</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800">
                  {(recentUsers ?? []).map((u) => (
                    <tr key={u.id} className="transition hover:bg-zinc-800/50">
                      <td className="px-4 py-3">
                        <Link
                          href={`/${locale}/admin/users/${u.id}`}
                          className="font-medium text-zinc-200 hover:text-white"
                        >
                          {u.business_name || "—"}
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        <RoleBadge role={(u as { role: string }).role} />
                      </td>
                      <td className="px-4 py-3 text-xs text-zinc-500">
                        {new Date(u.created_at).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>

        {/* Recent campaigns */}
        <section>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-zinc-300">Recent Campaigns</h2>
            <Link
              href={`/${locale}/admin/campaigns`}
              className="text-xs text-zinc-500 transition hover:text-zinc-300"
            >
              View all →
            </Link>
          </div>
          <div className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900">
            {(recentCampaigns ?? []).length === 0 ? (
              <p className="p-5 text-sm text-zinc-600">No campaigns yet.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-800">
                    <th className="px-4 py-3 text-left text-xs font-medium text-zinc-600">Name</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-zinc-600">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-zinc-600">Created</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800">
                  {(recentCampaigns ?? []).map((c) => (
                    <tr key={c.id} className="transition hover:bg-zinc-800/50">
                      <td className="px-4 py-3">
                        <Link
                          href={`/${locale}/admin/campaigns/${c.id}`}
                          className="font-medium text-zinc-200 hover:text-white"
                        >
                          {c.name}
                        </Link>
                        <p className="text-xs text-zinc-600">
                          {(Array.isArray(c.profiles) ? (c.profiles as { business_name: string }[])[0] : c.profiles as { business_name: string } | null)?.business_name ?? "—"}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={c.status} />
                      </td>
                      <td className="px-4 py-3 text-xs text-zinc-500">
                        {new Date(c.created_at).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

function RoleBadge({ role }: { role: string }) {
  if (role === "admin") {
    return (
      <span className="inline-flex items-center rounded-full bg-purple-500/15 px-2 py-0.5 text-xs font-medium text-purple-400">
        admin
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-full bg-zinc-700/50 px-2 py-0.5 text-xs font-medium text-zinc-400">
      user
    </span>
  );
}
