import { redirect } from "next/navigation";
import Link from "next/link";
import { getAdminUser } from "@/lib/admin/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { StatusBadge, ChannelBadge } from "@/components/admin/StatusBadge";

export const dynamic = "force-dynamic";

function QueueCard({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: "green" | "yellow" | "red" | "blue";
}) {
  const colors = {
    green: "border-green-500/30 bg-green-500/10 text-green-400",
    yellow: "border-yellow-500/30 bg-yellow-500/10 text-yellow-400",
    red: "border-red-500/30 bg-red-500/10 text-red-400",
    blue: "border-blue-500/30 bg-blue-500/10 text-blue-400",
  };
  return (
    <div className={`rounded-xl border p-5 ${colors[color]}`}>
      <p className="text-xs font-medium uppercase tracking-wider opacity-70">{label}</p>
      <p className="mt-2 text-4xl font-bold tabular-nums">{value.toLocaleString()}</p>
    </div>
  );
}

export default async function AdminMonitoringPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const adminUser = await getAdminUser();
  if (!adminUser) redirect(`/${locale}/dashboard`);

  const db = createAdminClient();

  const now = new Date();
  const overdueThreshold = new Date(now.getTime() - 5 * 60 * 1000).toISOString();

  const [
    { count: smsPending },
    { count: emailPending },
    { count: smsFailed },
    { count: emailFailed },
    { count: overdueCount },
    { data: activeCampaigns },
    { data: recentFailedSms },
    { data: recentFailedEmail },
    { data: overdueTasks },
  ] = await Promise.all([
    db.from("outbound_sms").select("*", { count: "exact", head: true }).eq("status", "pending"),
    db.from("outbound_email").select("*", { count: "exact", head: true }).eq("status", "pending"),
    db.from("outbound_sms").select("*", { count: "exact", head: true }).eq("status", "failed"),
    db.from("outbound_email").select("*", { count: "exact", head: true }).eq("status", "failed"),
    db
      .from("outbound_sms")
      .select("*", { count: "exact", head: true })
      .eq("status", "pending")
      .lt("run_at", overdueThreshold),
    db
      .from("campaigns")
      .select("id, name, status, channel, user_id, send_rate_count, updated_at, profiles!inner(business_name)")
      .in("status", ["running", "paused"])
      .order("updated_at", { ascending: false }),
    db
      .from("outbound_sms")
      .select("id, to_phone, body, error_message, updated_at, campaign_id, user_id")
      .eq("status", "failed")
      .order("updated_at", { ascending: false })
      .limit(25),
    db
      .from("outbound_email")
      .select("id, to_email, subject, error_message, updated_at, campaign_id, user_id")
      .eq("status", "failed")
      .order("updated_at", { ascending: false })
      .limit(25),
    db
      .from("outbound_sms")
      .select("id, to_phone, run_at, campaign_id, user_id")
      .eq("status", "pending")
      .lt("run_at", overdueThreshold)
      .order("run_at", { ascending: true })
      .limit(25),
  ]);

  return (
    <div className="mx-auto max-w-6xl space-y-10">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Monitoring</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Live system health. Data refreshes on page load.
          </p>
        </div>
        <p className="text-xs text-zinc-600">
          As of {now.toLocaleTimeString()}
        </p>
      </div>

      {/* Queue overview */}
      <section>
        <h2 className="mb-4 text-xs font-semibold uppercase tracking-widest text-zinc-600">
          Queue Status
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <QueueCard label="SMS Pending" value={smsPending ?? 0} color="yellow" />
          <QueueCard label="Email Pending" value={emailPending ?? 0} color="blue" />
          <QueueCard label="SMS Failed" value={smsFailed ?? 0} color="red" />
          <QueueCard label="Email Failed" value={emailFailed ?? 0} color="red" />
        </div>
        {(overdueCount ?? 0) > 0 && (
          <div className="mt-3 flex items-center gap-2 rounded-xl border border-orange-500/30 bg-orange-500/10 p-4">
            <svg className="h-5 w-5 flex-shrink-0 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <p className="text-sm text-orange-300">
              <strong>{overdueCount}</strong> SMS messages are overdue (pending but{" "}
              past their scheduled time by more than 5 minutes)
            </p>
          </div>
        )}
      </section>

      {/* Active campaigns */}
      <section>
        <h2 className="mb-4 text-sm font-semibold text-zinc-300">
          Active Campaigns ({(activeCampaigns ?? []).length})
        </h2>
        {(activeCampaigns ?? []).length === 0 ? (
          <p className="text-sm text-zinc-600">No active campaigns right now.</p>
        ) : (
          <div className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-800">
                  <th className="px-4 py-3 text-left text-xs font-medium text-zinc-600">Campaign</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-zinc-600">Channel</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-zinc-600">Status</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-zinc-600">Rate (this min)</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-zinc-600">Last Updated</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800">
                {(activeCampaigns ?? []).map((c) => (
                  <tr key={c.id} className="transition hover:bg-zinc-800/50">
                    <td className="px-4 py-3">
                      <Link
                        href={`/${locale}/admin/campaigns/${c.id}`}
                        className="font-medium text-zinc-200 transition hover:text-white"
                      >
                        {c.name}
                      </Link>
                      <p className="text-xs text-zinc-600">
                        {(Array.isArray(c.profiles) ? (c.profiles as { business_name: string }[])[0] : c.profiles as { business_name: string } | null)?.business_name ?? "—"}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <ChannelBadge channel={c.channel} />
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={c.status} />
                    </td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums text-zinc-300">
                      {c.send_rate_count ?? 0}
                    </td>
                    <td className="px-4 py-3 text-xs text-zinc-500">
                      {new Date(c.updated_at).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Overdue tasks */}
      {(overdueTasks ?? []).length > 0 && (
        <section>
          <h2 className="mb-4 text-sm font-semibold text-orange-400">
            Overdue SMS Tasks ({overdueTasks!.length} shown)
          </h2>
          <div className="overflow-hidden rounded-xl border border-orange-500/20 bg-zinc-900">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-orange-500/20">
                  <th className="px-4 py-3 text-left font-medium text-zinc-600">To</th>
                  <th className="px-4 py-3 text-left font-medium text-zinc-600">Scheduled For</th>
                  <th className="px-4 py-3 text-left font-medium text-zinc-600">Overdue By</th>
                  <th className="px-4 py-3 text-left font-medium text-zinc-600">Campaign</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800">
                {overdueTasks!.map((t) => {
                  const overdueMins = Math.floor(
                    (now.getTime() - new Date(t.run_at).getTime()) / 60000
                  );
                  return (
                    <tr key={t.id} className="transition hover:bg-zinc-800/40">
                      <td className="px-4 py-3 font-mono text-zinc-300">{t.to_phone}</td>
                      <td className="px-4 py-3 text-zinc-500">
                        {new Date(t.run_at).toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-orange-400 font-medium">
                        {overdueMins}m ago
                      </td>
                      <td className="px-4 py-3">
                        {t.campaign_id ? (
                          <Link
                            href={`/${locale}/admin/campaigns/${t.campaign_id}`}
                            className="text-zinc-500 transition hover:text-zinc-300"
                          >
                            View →
                          </Link>
                        ) : (
                          <span className="text-zinc-700">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Two-column: failed SMS + failed email */}
      <div className="grid gap-8 lg:grid-cols-2">
        <section>
          <h2 className="mb-4 text-sm font-semibold text-zinc-300">
            Recent Failed SMS ({(recentFailedSms ?? []).length} shown)
          </h2>
          <div className="space-y-2">
            {(recentFailedSms ?? []).length === 0 ? (
              <p className="text-sm text-zinc-600">No failed SMS messages.</p>
            ) : (
              (recentFailedSms ?? []).map((m) => (
                <div
                  key={m.id}
                  className="rounded-lg border border-zinc-800 bg-zinc-900 p-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-mono text-xs text-zinc-300">{m.to_phone}</span>
                    <span className="text-xs text-zinc-600">
                      {new Date(m.updated_at).toLocaleString()}
                    </span>
                  </div>
                  {m.error_message && (
                    <p className="mt-1 text-xs text-red-400 line-clamp-2">{m.error_message}</p>
                  )}
                  {m.campaign_id && (
                    <Link
                      href={`/${locale}/admin/campaigns/${m.campaign_id}`}
                      className="mt-1 inline-block text-xs text-zinc-600 transition hover:text-zinc-400"
                    >
                      Campaign →
                    </Link>
                  )}
                </div>
              ))
            )}
          </div>
        </section>

        <section>
          <h2 className="mb-4 text-sm font-semibold text-zinc-300">
            Recent Failed Emails ({(recentFailedEmail ?? []).length} shown)
          </h2>
          <div className="space-y-2">
            {(recentFailedEmail ?? []).length === 0 ? (
              <p className="text-sm text-zinc-600">No failed emails.</p>
            ) : (
              (recentFailedEmail ?? []).map((m) => (
                <div
                  key={m.id}
                  className="rounded-lg border border-zinc-800 bg-zinc-900 p-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-mono text-xs text-zinc-300">{m.to_email}</span>
                    <span className="text-xs text-zinc-600">
                      {new Date(m.updated_at).toLocaleString()}
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-zinc-500 truncate">{m.subject}</p>
                  {m.error_message && (
                    <p className="mt-1 text-xs text-red-400 line-clamp-2">{m.error_message}</p>
                  )}
                  {m.campaign_id && (
                    <Link
                      href={`/${locale}/admin/campaigns/${m.campaign_id}`}
                      className="mt-1 inline-block text-xs text-zinc-600 transition hover:text-zinc-400"
                    >
                      Campaign →
                    </Link>
                  )}
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
