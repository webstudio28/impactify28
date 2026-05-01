"use client";

import { useMemo, useState } from "react";

type Row = { id: string; name: string; created_at: string; count: number };

export function EmailsAudienceClient({ initialAudiences }: { initialAudiences: Row[] }) {
  const [audiences, setAudiences] = useState(initialAudiences);
  const [selectedId, setSelectedId] = useState(initialAudiences[0]?.id ?? "");
  const [newListName, setNewListName] = useState("");
  const [bulkText, setBulkText] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const selected = useMemo(() => audiences.find((a) => a.id === selectedId), [audiences, selectedId]);

  async function createList() {
    setError(null);
    setMessage(null);
    if (!newListName.trim()) {
      setError("Name your list first");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/audiences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newListName.trim(), audience_type: "email" }),
      });
      const json = (await res.json()) as {
        audience?: { id: string; name: string; created_at: string };
        error?: string;
      };
      if (!res.ok) throw new Error(json.error ?? "Create failed");
      if (json.audience) {
        const row: Row = { id: json.audience.id, name: json.audience.name, created_at: json.audience.created_at, count: 0 };
        setAudiences((prev) => [row, ...prev]);
        setSelectedId(row.id);
        setNewListName("");
        setMessage("List created");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setBusy(false);
    }
  }

  async function addEmails() {
    setError(null);
    setMessage(null);
    if (!selectedId) {
      setError("Create a list first");
      return;
    }
    const lines = bulkText
      .split(/\r?\n/)
      .flatMap((line) => line.split(/[,;]/))
      .map((l) => l.trim())
      .filter(Boolean);
    if (!lines.length) {
      setError("Paste one email per line");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`/api/audiences/${selectedId}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ values: lines }),
      });
      const json = (await res.json()) as { error?: string; count?: number };
      if (!res.ok) throw new Error(json.error ?? "Add failed");
      setBulkText("");
      const total = json.count ?? 0;
      setMessage(`List updated (${total} total in list)`);
      setAudiences((prev) => prev.map((a) => (a.id === selectedId ? { ...a, count: total } : a)));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-8">
      <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
        <h2 className="text-sm font-semibold text-ink">New email list</h2>
        <div className="mt-4 flex flex-wrap gap-2">
          <input
            value={newListName}
            onChange={(e) => setNewListName(e.target.value)}
            placeholder="e.g. Newsletter subscribers"
            className="min-w-[200px] flex-1 rounded-lg border border-zinc-200 px-3 py-2 text-sm"
          />
          <button
            type="button"
            disabled={busy}
            onClick={() => void createList()}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-60"
          >
            Create list
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
        <h2 className="text-sm font-semibold text-ink">Add emails</h2>
        <p className="mt-1 text-xs text-ink-muted">One email per line (or separated by comma).</p>
        <div className="mt-4 space-y-3">
          <label className="block text-xs font-medium text-ink-muted">Target list</label>
          <select
            value={selectedId}
            onChange={(e) => setSelectedId(e.target.value)}
            className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm"
          >
            {audiences.length === 0 ? <option value="">No lists yet</option> : null}
            {audiences.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name} ({a.count})
              </option>
            ))}
          </select>
          {selected ? (
            <p className="text-xs text-ink-muted">
              Selected: <span className="font-medium text-ink">{selected.name}</span>
            </p>
          ) : null}
          <textarea
            value={bulkText}
            onChange={(e) => setBulkText(e.target.value)}
            rows={8}
            placeholder={"hello@customer.com\nbuyer@example.org"}
            className="w-full rounded-lg border border-zinc-200 px-3 py-2 font-mono text-sm"
          />
          <button
            type="button"
            disabled={busy || !selectedId}
            onClick={() => void addEmails()}
            className="rounded-lg border border-zinc-200 bg-white px-4 py-2 text-sm font-medium hover:bg-surface-muted disabled:opacity-60"
          >
            Add to list
          </button>
        </div>
      </div>

      {message ? <p className="text-sm text-emerald-700">{message}</p> : null}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </div>
  );
}
