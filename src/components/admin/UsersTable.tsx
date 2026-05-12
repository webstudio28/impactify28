"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { StatusBadge } from "./StatusBadge";

type AdminUser = {
  id: string;
  business_name: string | null;
  email: string | null;
  role: string;
  created_at: string;
  last_sign_in: string | null;
  campaign_count: number;
  audience_count: number;
};

export function UsersTable({ locale }: { locale: string }) {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 350);
    return () => clearTimeout(t);
  }, [search]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page) });
      if (debouncedSearch) params.set("search", debouncedSearch);
      const res = await fetch(`/api/admin/users?${params}`);
      const json = await res.json();
      setUsers(json.users ?? []);
      setTotal(json.total ?? 0);
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch]);

  useEffect(() => {
    load();
  }, [load]);

  const totalPages = Math.ceil(total / 20);

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <svg
            className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Search by business name…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="w-full rounded-lg border border-zinc-700 bg-zinc-800 py-2 pl-9 pr-3 text-sm text-zinc-200 placeholder-zinc-600 outline-none focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500"
          />
        </div>
        <span className="text-xs text-zinc-600">{total.toLocaleString()} users</span>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-800">
              <th className="px-4 py-3 text-left text-xs font-medium text-zinc-600">Business / Email</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-zinc-600">Role</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-zinc-600">Campaigns</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-zinc-600">Audiences</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-zinc-600">Joined</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-zinc-600">Last Sign-in</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800">
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i}>
                  {Array.from({ length: 6 }).map((_, j) => (
                    <td key={j} className="px-4 py-3">
                      <div className="h-4 animate-pulse rounded bg-zinc-800" />
                    </td>
                  ))}
                </tr>
              ))
            ) : users.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-sm text-zinc-600">
                  No users found.
                </td>
              </tr>
            ) : (
              users.map((u) => (
                <tr key={u.id} className="group transition hover:bg-zinc-800/50">
                  <td className="px-4 py-3">
                    <Link
                      href={`/${locale}/admin/users/${u.id}`}
                      className="font-medium text-zinc-200 transition group-hover:text-white"
                    >
                      {u.business_name || "Unnamed Business"}
                    </Link>
                    <p className="text-xs text-zinc-500">{u.email ?? "—"}</p>
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={u.role === "admin" ? "admin" : "user"} />
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-sm tabular-nums text-zinc-300">
                    {u.campaign_count}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-sm tabular-nums text-zinc-300">
                    {u.audience_count}
                  </td>
                  <td className="px-4 py-3 text-xs text-zinc-500">
                    {new Date(u.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 text-xs text-zinc-500">
                    {u.last_sign_in ? new Date(u.last_sign_in).toLocaleDateString() : "—"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <span className="text-xs text-zinc-600">
            Page {page} of {totalPages}
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-xs text-zinc-400 transition hover:bg-zinc-700 disabled:opacity-40"
            >
              Previous
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-xs text-zinc-400 transition hover:bg-zinc-700 disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
