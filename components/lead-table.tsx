"use client";

import { useMemo, useState } from "react";
import { EditLeadSheet } from "@/components/edit-lead-sheet";
import { formatDateTime, formatLeadStatus, isPermissionError } from "@/lib/format";
import { deleteLead } from "@/lib/leads";
import type { Lead, LeadStatus } from "@/lib/types";

type LeadTableProps = {
  leads: Lead[];
  userName: string;
  canDelete: boolean;
  onLeadChange: (lead: Lead) => void;
  onLeadDelete: (lead: Lead) => void;
  onToast: (message: string) => void;
};

type SortKey =
  | "customer_name"
  | "company_name"
  | "sector"
  | "phone"
  | "address"
  | "status"
  | "updated_by"
  | "updated_at";

type StatusFilter = "all" | LeadStatus;

const COLUMNS: { key: SortKey; label: string }[] = [
  { key: "customer_name", label: "Customer" },
  { key: "company_name", label: "Company" },
  { key: "sector", label: "Sector" },
  { key: "phone", label: "Phone" },
  { key: "address", label: "Address" },
  { key: "status", label: "Status" },
  { key: "updated_by", label: "Updated by" },
  { key: "updated_at", label: "Updated" },
];

const STATUS_FILTERS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "pending", label: "Pending" },
  { value: "completed", label: "Completed" },
  { value: "archived", label: "Archived" },
];

function cellText(lead: Lead, key: SortKey) {
  if (key === "updated_at") return formatDateTime(lead.updated_at);
  if (key === "status") return formatLeadStatus(lead.status);
  return lead[key]?.trim() ?? "";
}

function compareLeads(left: Lead, right: Lead, key: SortKey) {
  if (key === "updated_at") {
    return new Date(left.updated_at).getTime() - new Date(right.updated_at).getTime();
  }
  return cellText(left, key).localeCompare(cellText(right, key), undefined, { sensitivity: "base" });
}

export function LeadTable({ leads, userName, canDelete, onLeadChange, onLeadDelete, onToast }: LeadTableProps) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [sortKey, setSortKey] = useState<SortKey>("updated_at");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [editing, setEditing] = useState<Lead | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const matched = leads.filter((lead) => {
      if (status !== "all" && lead.status !== status) return false;
      if (!needle) return true;
      return COLUMNS.some((column) => cellText(lead, column.key).toLowerCase().includes(needle));
    });

    const sorted = [...matched].sort((left, right) => compareLeads(left, right, sortKey));
    return sortDirection === "asc" ? sorted : sorted.reverse();
  }, [leads, query, sortDirection, sortKey, status]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(key);
    setSortDirection(key === "updated_at" ? "desc" : "asc");
  }

  return (
    <section className="space-y-3">
      <div className="rounded-[28px] border border-line bg-card p-4">
        <h2 className="font-serif text-3xl tracking-tight text-ink">All leads</h2>
        <p className="mt-1 text-sm text-muted">
          {canDelete
            ? "Every pending, completed, and archived company. Edit a row, or delete it after you confirm."
            : "Every pending, completed, and archived company. Edit a row."}
        </p>
        <label className="mt-4 block">
          <span className="sr-only">Search leads</span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search customer, company, sector, phone, or rep"
            className="w-full rounded-2xl border border-line bg-white px-4 py-3 text-base text-ink outline-none placeholder:text-muted/70 focus:border-pine"
          />
        </label>
        <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Status">
          {STATUS_FILTERS.map((item) => (
            <button
              key={item.value}
              type="button"
              aria-pressed={status === item.value}
              onClick={() => setStatus(item.value)}
              className={`rounded-full px-3 py-1.5 text-sm font-semibold ${
                status === item.value ? "bg-ink text-paper" : "bg-stamp text-muted"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
        <p className="mt-3 text-sm text-muted">
          {visible.length === 1 ? "1 lead" : `${visible.length} leads`}
        </p>
      </div>

      {visible.length === 0 ? (
        <section className="rounded-[28px] border border-dashed border-line bg-card/70 px-5 py-8 text-center">
          <h3 className="font-serif text-3xl tracking-tight text-ink">
            {leads.length === 0 ? "No leads yet." : "No leads match those filters."}
          </h3>
          <p className="mt-2 text-sm text-muted">
            {leads.length === 0
              ? "Companies added to the queue will appear in this table."
              : "Try another name, sector, phone, or status."}
          </p>
        </section>
      ) : (
        <div className="overflow-x-auto rounded-[28px] border border-line bg-card">
          <table className="w-full min-w-[1080px] text-left text-sm">
            <thead className="border-b border-line bg-stamp/70">
              <tr>
                {COLUMNS.map((column) => {
                  const active = sortKey === column.key;
                  const ariaSort = active ? (sortDirection === "asc" ? "ascending" : "descending") : "none";
                  return (
                    <th key={column.key} aria-sort={ariaSort} className="px-3 py-3 font-semibold text-ink">
                      <button
                        type="button"
                        onClick={() => toggleSort(column.key)}
                        className="inline-flex items-center gap-1 text-left"
                      >
                        {column.label}
                        <span className="text-xs text-muted" aria-hidden>
                          {active ? (sortDirection === "asc" ? "↑" : "↓") : "↕"}
                        </span>
                      </button>
                    </th>
                  );
                })}
                <th className="px-3 py-3 font-semibold text-ink">Actions</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((lead) => (
                <tr key={lead.id} className="border-b border-line/80 last:border-b-0">
                  {COLUMNS.map((column) => (
                    <td key={column.key} className="max-w-[220px] px-3 py-3 align-top text-ink">
                      {column.key === "status" ? (
                        <span className="rounded-full bg-stamp px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.12em]">
                          {formatLeadStatus(lead.status)}
                        </span>
                      ) : (
                        <span className="block whitespace-pre-wrap break-words">
                          {cellText(lead, column.key) || "Not set"}
                        </span>
                      )}
                    </td>
                  ))}
                  <td className="px-3 py-3 align-top">
                    {canDelete && confirmId === lead.id ? (
                      <div className="flex min-w-40 flex-col gap-2">
                        <button
                          type="button"
                          disabled={deletingId === lead.id}
                          onClick={() => setConfirmId(null)}
                          className="rounded-xl border border-line px-3 py-2 text-sm font-semibold text-ink disabled:opacity-60"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          disabled={deletingId === lead.id}
                          onClick={() => void removeRow(lead)}
                          className="rounded-xl bg-clay px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
                        >
                          {deletingId === lead.id ? "Deleting..." : "Delete lead"}
                        </button>
                      </div>
                    ) : (
                      <div className="flex min-w-28 flex-col gap-2">
                        <button
                          type="button"
                          onClick={() => setEditing(lead)}
                          className="rounded-xl bg-ink px-3 py-2 text-sm font-semibold text-paper"
                        >
                          Edit
                        </button>
                        {canDelete ? (
                          <button
                            type="button"
                            onClick={() => setConfirmId(lead.id)}
                            className="rounded-xl border border-clay/40 px-3 py-2 text-sm font-semibold text-clay"
                          >
                            Delete
                          </button>
                        ) : null}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <EditLeadSheet
        lead={editing}
        userName={userName}
        onClose={() => setEditing(null)}
        onSaved={(saved) => {
          setEditing(null);
          onLeadChange(saved);
        }}
      />
    </section>
  );

  async function removeRow(lead: Lead) {
    setDeletingId(lead.id);
    try {
      await deleteLead(lead.id);
      setConfirmId(null);
      onLeadDelete(lead);
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Could not delete this lead.";
      onToast(
        isPermissionError(message)
          ? "Supabase row level security blocked this delete. Run supabase/schema.sql in the SQL editor, then try again."
          : message,
      );
    } finally {
      setDeletingId(null);
    }
  }
}
