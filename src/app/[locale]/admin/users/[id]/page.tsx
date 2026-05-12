import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { getAdminUser } from "@/lib/admin/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { StatusBadge, ChannelBadge } from "@/components/admin/StatusBadge";
import { RoleToggle } from "@/components/admin/RoleToggle";
import { UserMessagesTab } from "@/components/admin/UserMessagesTab";

export const dynamic = "force-dynamic";

function StatMini({
  label,
  value,
  sub,
}: {
  label: string;
  value: string | number;
  sub?: string;
}) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
      <p className="text-xs font-medium uppercase tracking-wider text-zinc-600">{label}</p>
      <p className="mt-1.5 text-2xl font-bold tabular-nums text-white">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-zinc-600">{sub}</p>}
    </div>
  );
}

export default async function AdminUserDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  const adminUser = await getAdminUser();
  if (!adminUser) redirect(`/${locale}/dashboard`);

  const db = createAdminClient();

  const [
    { data: profile },
    { data: campaigns },
    { data: audiences },
    { count: smsSent },
    { count: smsFailed },
    { count: smsPending },
    { count: emailSent },
    { count: emailFailed },
    { count: emailPending },
  ] = await Promise.all([
    db
      .from("profiles")
      .select("id, business_name, role, logo_url, sender_email, sender_display_name, created_at, updated_at")
      .eq("id", id)
      .single(),
    db
      .from("campaigns")
      .select("id, name, status, channel, scheduled_at, created_at, audience_id, email_subject")
      .eq("user_id", id)
      .order("created_at", { ascending: false }),
    db
      .from("audiences")
      .select("id, name, audience_type, created_at, audience_members(count)")
      .eq("user_id", id)
      .order("created_at", { ascending: false }),
    db.from("outbound_sms").select("*", { count: "exact", head: true }).eq("user_id", id).eq("status", "sent"),
    db.from("outbound_sms").select("*", { count: "exact", head: true }).eq("user_id", id).eq("status", "failed"),
    db.from("outbound_sms").select("*", { count: "exact", head: true }).eq("user_id", id).eq("status", "pending"),
    db.from("outbound_email").select("*", { count: "exact", head: true }).eq("user_id", id).eq("status", "sent"),
    db.from("outbound_email").select("*", { count: "exact", head: true }).eq("user_id", id).eq("status", "failed"),
    db.from("outbound_email").select("*", { count: "exact", head: true }).eq("user_id", id).eq("status", "pending"),
  ]);

  if (!profile) notFound();

  // Get auth user info (email, last sign-in)
  const { data: authUser } = await db.auth.admin.getUserById(id);
  const email = authUser?.user?.email ?? null;
  const lastSignIn = authUser?.user?.last_sign_in_at ?? null;
  const providers: string[] = authUser?.user?.app_metadata?.providers ?? [];

  const enrichedAudiences = (audiences ?? []).map((a) => ({
    ...a,
    member_count: Array.isArray((a as Record<string, unknown>).audience_members)
      ? ((a as Record<string, unknown>).audience_members as { count: number }[])[0]?.count ?? 0
      : 0,
  }));

  const totalSent = (smsSent ?? 0) + (emailSent ?? 0);
  const totalFailed = (smsFailed ?? 0) + (emailFailed ?? 0);
  const totalPending = (smsPending ?? 0) + (emailPending ?? 0);

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-zinc-600">
        <Link href={`/${locale}/admin/users`} className="transition hover:text-zinc-300">
          Users
        </Link>
        <span>/</span>
        <span className="text-zinc-400">{profile.business_name ?? email ?? id}</span>
      </div>

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          {profile.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={profile.logo_url}
              alt="Logo"
              className="h-14 w-14 rounded-xl object-cover"
            />
          ) : (
            <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-zinc-800 text-xl font-bold text-zinc-400">
              {(profile.business_name ?? email ?? "?").charAt(0).toUpperCase()}
            </div>
          )}
          <div>
            <h1 className="text-2xl font-bold text-white">
              {profile.business_name ?? "Unnamed Business"}
            </h1>
            <p className="text-sm text-zinc-500">{email ?? "No email"}</p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {providers.map((p) => (
                <span
                  key={p}
                  className="rounded-full bg-zinc-800 px-2 py-0.5 text-xs text-zinc-400"
                >
                  {p}
                </span>
              ))}
              <span className="text-xs text-zinc-600">
                Joined {new Date(profile.created_at).toLocaleDateString()}
              </span>
              {lastSignIn && (
                <span className="text-xs text-zinc-600">
                  · Last login {new Date(lastSignIn).toLocaleDateString()}
                </span>
              )}
            </div>
          </div>
        </div>
        <RoleToggle userId={id} currentRole={(profile as { role: string }).role} />
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatMini label="Total Sent" value={totalSent.toLocaleString()} sub={`SMS ${smsSent ?? 0} · Email ${emailSent ?? 0}`} />
        <StatMini label="Pending" value={totalPending.toLocaleString()} sub={`SMS ${smsPending ?? 0} · Email ${emailPending ?? 0}`} />
        <StatMini label="Failed" value={totalFailed.toLocaleString()} sub={`SMS ${smsFailed ?? 0} · Email ${emailFailed ?? 0}`} />
        <StatMini label="Campaigns" value={(campaigns ?? []).length} sub={`${enrichedAudiences.length} audiences`} />
      </div>

      {/* Profile details */}
      {(profile.sender_email || profile.sender_display_name) && (
        <section className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-zinc-600">
            Sender Identity
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {profile.sender_email && (
              <div>
                <p className="text-xs text-zinc-600">From Email</p>
                <p className="mt-0.5 text-sm text-zinc-300">{profile.sender_email}</p>
              </div>
            )}
            {profile.sender_display_name && (
              <div>
                <p className="text-xs text-zinc-600">Display Name</p>
                <p className="mt-0.5 text-sm text-zinc-300">{profile.sender_display_name}</p>
              </div>
            )}
          </div>
        </section>
      )}

      {/* Campaigns */}
      <section>
        <h2 className="mb-4 text-sm font-semibold text-zinc-300">
          Campaigns ({(campaigns ?? []).length})
        </h2>
        <div className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900">
          {(campaigns ?? []).length === 0 ? (
            <p className="p-5 text-sm text-zinc-600">No campaigns yet.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-800">
                  <th className="px-4 py-3 text-left text-xs font-medium text-zinc-600">Name</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-zinc-600">Channel</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-zinc-600">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-zinc-600">Created</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-zinc-600"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800">
                {(campaigns ?? []).map((c) => (
                  <tr key={c.id} className="transition hover:bg-zinc-800/50">
                    <td className="px-4 py-3">
                      <p className="font-medium text-zinc-200">{c.name}</p>
                      {c.email_subject && (
                        <p className="text-xs text-zinc-600 truncate max-w-xs">{c.email_subject}</p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <ChannelBadge channel={c.channel} />
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={c.status} />
                    </td>
                    <td className="px-4 py-3 text-xs text-zinc-500">
                      {new Date(c.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/${locale}/admin/campaigns/${c.id}`}
                        className="text-xs text-zinc-600 transition hover:text-zinc-300"
                      >
                        Details →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>

      {/* Audiences */}
      <section>
        <h2 className="mb-4 text-sm font-semibold text-zinc-300">
          Audiences ({enrichedAudiences.length})
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {enrichedAudiences.length === 0 ? (
            <p className="col-span-3 text-sm text-zinc-600">No audiences yet.</p>
          ) : (
            enrichedAudiences.map((a) => (
              <div
                key={a.id}
                className="rounded-xl border border-zinc-800 bg-zinc-900 p-4"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-medium text-zinc-200">{a.name}</p>
                    <p className="mt-0.5 text-xs text-zinc-600 capitalize">{a.audience_type}</p>
                  </div>
                  <span className="rounded-full bg-zinc-800 px-2.5 py-1 text-xs font-semibold tabular-nums text-zinc-300">
                    {a.member_count.toLocaleString()}
                  </span>
                </div>
                <p className="mt-2 text-xs text-zinc-600">
                  {new Date(a.created_at).toLocaleDateString()}
                </p>
              </div>
            ))
          )}
        </div>
      </section>

      {/* Messages */}
      <section>
        <h2 className="mb-4 text-sm font-semibold text-zinc-300">Message History</h2>
        <UserMessagesTab userId={id} />
      </section>
    </div>
  );
}
