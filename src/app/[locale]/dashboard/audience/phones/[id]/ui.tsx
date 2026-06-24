"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { parsePhoneInput } from "@/lib/audiences/parse-phones";

type Member = { id: string; value: string; created_at: string };
type Audience = { id: string; name: string; count: number };

const PAGE_SIZES = [20, 50, 100] as const;

export function PhoneAudienceDetail({
  audienceId,
  initialAudience,
}: {
  audienceId: string;
  initialAudience: Audience;
}) {
  const t = useTranslations("phones");
  const router = useRouter();

  const [audience, setAudience] = useState(initialAudience);
  const [members, setMembers] = useState<Member[]>([]);
  const [total, setTotal] = useState(initialAudience.count);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<(typeof PAGE_SIZES)[number]>(20);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [showAdd, setShowAdd] = useState(false);
  const [bulkText, setBulkText] = useState("");
  const [showRename, setShowRename] = useState(false);
  const [renameValue, setRenameValue] = useState(audience.name);
  const [showDeleteList, setShowDeleteList] = useState(false);
  const [showDeleteSelected, setShowDeleteSelected] = useState(false);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const pageIds = useMemo(() => members.map((m) => m.id), [members]);
  const allOnPageSelected = pageIds.length > 0 && pageIds.every((id) => selected.has(id));

  const loadMembers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/audiences/${audienceId}/members?page=${page}&limit=${pageSize}`
      );
      const json = (await res.json()) as {
        members?: Member[];
        total?: number;
        error?: string;
      };
      if (!res.ok) throw new Error(json.error ?? t("loadFailed"));
      setMembers(json.members ?? []);
      setTotal(json.total ?? 0);
      setSelected(new Set());
    } catch (e) {
      setError(e instanceof Error ? e.message : t("loadFailed"));
    } finally {
      setLoading(false);
    }
  }, [audienceId, page, pageSize, t]);

  useEffect(() => {
    void loadMembers();
  }, [loadMembers]);

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAllOnPage() {
    setSelected((prev) => {
      const next = new Set(prev);
      for (const id of pageIds) next.add(id);
      return next;
    });
  }

  function deselectAll() {
    setSelected(new Set());
  }

  async function addPhones() {
    setError(null);
    setMessage(null);
    const phones = parsePhoneInput(bulkText);
    if (!phones.length) {
      setError(t("pastePhones"));
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`/api/audiences/${audienceId}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ values: phones }),
      });
      const json = (await res.json()) as { error?: string; count?: number };
      if (!res.ok) throw new Error(json.error ?? t("addFailed"));
      const count = json.count ?? total;
      setAudience((a) => ({ ...a, count }));
      setTotal(count);
      setBulkText("");
      setShowAdd(false);
      setMessage(t("phonesAdded", { added: phones.length, total: count }));
      setPage(1);
      await loadMembers();
    } catch (e) {
      setError(e instanceof Error ? e.message : t("addFailed"));
    } finally {
      setBusy(false);
    }
  }

  async function renameList() {
    setError(null);
    if (!renameValue.trim()) {
      setError(t("nameListFirst"));
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`/api/audiences/${audienceId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: renameValue.trim() }),
      });
      const json = (await res.json()) as { audience?: { name: string }; error?: string };
      if (!res.ok) throw new Error(json.error ?? t("renameFailed"));
      setAudience((a) => ({ ...a, name: json.audience?.name ?? renameValue.trim() }));
      setShowRename(false);
      setMessage(t("listRenamed"));
    } catch (e) {
      setError(e instanceof Error ? e.message : t("renameFailed"));
    } finally {
      setBusy(false);
    }
  }

  async function deleteList() {
    setBusy(true);
    try {
      const res = await fetch(`/api/audiences/${audienceId}`, { method: "DELETE" });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(json.error ?? t("deleteFailed"));
      router.push("/dashboard/audience/phones");
    } catch (e) {
      setError(e instanceof Error ? e.message : t("deleteFailed"));
      setBusy(false);
    }
  }

  async function deleteSelected() {
    if (!selected.size) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/audiences/${audienceId}/members`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: Array.from(selected) }),
      });
      const json = (await res.json()) as { error?: string; count?: number; deleted?: number };
      if (!res.ok) throw new Error(json.error ?? t("deleteFailed"));
      const count = json.count ?? 0;
      setAudience((a) => ({ ...a, count }));
      setTotal(count);
      setShowDeleteSelected(false);
      setMessage(t("phonesRemoved", { count: json.deleted ?? selected.size }));
      if (page > 1 && (page - 1) * pageSize >= count) setPage((p) => Math.max(1, p - 1));
      else await loadMembers();
    } catch (e) {
      setError(e instanceof Error ? e.message : t("deleteFailed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">{audience.name}</h1>
          <p className="mt-1 text-sm text-ink-muted">{t("memberCount", { count: total })}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              setRenameValue(audience.name);
              setShowRename(true);
            }}
            className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm font-medium hover:bg-surface-muted"
          >
            {t("renameList")}
          </button>
          <button
            type="button"
            onClick={() => setShowDeleteList(true)}
            className="rounded-lg border border-red-200 bg-white px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
          >
            {t("deleteList")}
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-zinc-200 bg-white px-4 py-3 shadow-sm">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setShowAdd(true)}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover"
          >
            {t("addPhones")}
          </button>
          <button
            type="button"
            disabled={!selected.size || busy}
            onClick={() => setShowDeleteSelected(true)}
            className="rounded-lg border border-zinc-200 px-4 py-2 text-sm font-medium hover:bg-surface-muted disabled:opacity-50"
          >
            {t("deleteSelected", { count: selected.size })}
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={!pageIds.length}
            onClick={selectAllOnPage}
            className="rounded-lg border border-zinc-200 px-3 py-2 text-xs font-medium hover:bg-surface-muted disabled:opacity-50"
          >
            {t("selectAll")}
          </button>
          <button
            type="button"
            disabled={!selected.size}
            onClick={deselectAll}
            className="rounded-lg border border-zinc-200 px-3 py-2 text-xs font-medium hover:bg-surface-muted disabled:opacity-50"
          >
            {t("deselectAll")}
          </button>
        </div>
      </div>

      {message ? <p className="text-sm text-emerald-700">{message}</p> : null}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
        {loading ? (
          <p className="px-5 py-10 text-center text-sm text-ink-muted">{t("loading")}</p>
        ) : members.length === 0 ? (
          <div className="px-5 py-12 text-center">
            <p className="text-sm text-ink-muted">{t("noPhonesYet")}</p>
            <button
              type="button"
              onClick={() => setShowAdd(true)}
              className="mt-4 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover"
            >
              {t("addPhones")}
            </button>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-zinc-100 bg-surface-muted/50 text-left text-xs text-ink-muted">
              <tr>
                <th className="w-10 px-4 py-3">
                  <input
                    type="checkbox"
                    checked={allOnPageSelected}
                    onChange={() => (allOnPageSelected ? deselectAll() : selectAllOnPage())}
                    aria-label={t("selectAll")}
                  />
                </th>
                <th className="px-4 py-3 font-medium">{t("phoneColumn")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {members.map((m) => (
                <tr key={m.id} className="hover:bg-surface-muted/30">
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selected.has(m.id)}
                      onChange={() => toggleOne(m.id)}
                      aria-label={m.value}
                    />
                  </td>
                  <td className="px-4 py-3 font-mono text-ink">{m.value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {total > 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-sm text-ink-muted">
            <span>{t("rowsPerPage")}</span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value) as (typeof PAGE_SIZES)[number]);
                setPage(1);
              }}
              className="rounded-lg border border-zinc-200 bg-white px-2 py-1 text-sm text-ink"
            >
              {PAGE_SIZES.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-ink-muted">
              {t("pageOf", { page, total: totalPages })}
            </span>
            <button
              type="button"
              disabled={page <= 1 || loading}
              onClick={() => setPage((p) => p - 1)}
              className="rounded-lg border border-zinc-200 px-3 py-1.5 text-sm hover:bg-surface-muted disabled:opacity-50"
            >
              {t("prevPage")}
            </button>
            <button
              type="button"
              disabled={page >= totalPages || loading}
              onClick={() => setPage((p) => p + 1)}
              className="rounded-lg border border-zinc-200 px-3 py-1.5 text-sm hover:bg-surface-muted disabled:opacity-50"
            >
              {t("nextPage")}
            </button>
          </div>
        </div>
      ) : null}

      {showAdd ? (
        <Modal title={t("addPhones")} onClose={() => !busy && setShowAdd(false)} busy={busy}>
          <p className="text-sm text-ink-muted">{t("addHint")}</p>
          <textarea
            autoFocus
            value={bulkText}
            onChange={(e) => setBulkText(e.target.value)}
            rows={10}
            placeholder={"+15551234567\n+15559876543"}
            className="mt-3 w-full rounded-lg border border-zinc-200 px-3 py-2 font-mono text-sm outline-none ring-accent/30 focus:ring-2"
          />
          <ModalActions
            busy={busy}
            onCancel={() => setShowAdd(false)}
            onConfirm={() => void addPhones()}
            cancelLabel={t("cancel")}
            confirmLabel={t("addToList")}
          />
        </Modal>
      ) : null}

      {showRename ? (
        <Modal title={t("renameList")} onClose={() => !busy && setShowRename(false)} busy={busy}>
          <input
            autoFocus
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void renameList();
            }}
            className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none ring-accent/30 focus:ring-2"
          />
          <ModalActions
            busy={busy}
            onCancel={() => setShowRename(false)}
            onConfirm={() => void renameList()}
            cancelLabel={t("cancel")}
            confirmLabel={t("save")}
          />
        </Modal>
      ) : null}

      {showDeleteList ? (
        <Modal title={t("deleteList")} onClose={() => !busy && setShowDeleteList(false)} busy={busy}>
          <p className="text-sm text-ink-muted">{t("deleteListConfirm", { name: audience.name })}</p>
          <ModalActions
            busy={busy}
            onCancel={() => setShowDeleteList(false)}
            onConfirm={() => void deleteList()}
            cancelLabel={t("cancel")}
            confirmLabel={t("deleteList")}
            danger
          />
        </Modal>
      ) : null}

      {showDeleteSelected ? (
        <Modal
          title={t("deleteSelectedTitle")}
          onClose={() => !busy && setShowDeleteSelected(false)}
          busy={busy}
        >
          <p className="text-sm text-ink-muted">
            {t("deleteSelectedConfirm", { count: selected.size })}
          </p>
          <ModalActions
            busy={busy}
            onCancel={() => setShowDeleteSelected(false)}
            onConfirm={() => void deleteSelected()}
            cancelLabel={t("cancel")}
            confirmLabel={t("deleteSelectedAction")}
            danger
          />
        </Modal>
      ) : null}
    </div>
  );
}

function Modal({
  title,
  children,
  onClose,
  busy,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
  busy: boolean;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !busy) onClose();
      }}
    >
      <div className="w-full max-w-lg rounded-xl border border-zinc-200 bg-white p-5 shadow-xl">
        <h2 className="text-base font-semibold text-ink">{title}</h2>
        <div className="mt-3">{children}</div>
      </div>
    </div>
  );
}

function ModalActions({
  busy,
  onCancel,
  onConfirm,
  cancelLabel,
  confirmLabel,
  danger,
}: {
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  cancelLabel: string;
  confirmLabel: string;
  danger?: boolean;
}) {
  return (
    <div className="mt-5 flex justify-end gap-2">
      <button
        type="button"
        disabled={busy}
        onClick={onCancel}
        className="rounded-lg border border-zinc-200 px-4 py-2 text-sm font-medium hover:bg-surface-muted disabled:opacity-60"
      >
        {cancelLabel}
      </button>
      <button
        type="button"
        disabled={busy}
        onClick={onConfirm}
        className={`rounded-lg px-4 py-2 text-sm font-medium text-white disabled:opacity-60 ${
          danger ? "bg-red-600 hover:bg-red-700" : "bg-accent hover:bg-accent-hover"
        }`}
      >
        {confirmLabel}
      </button>
    </div>
  );
}
