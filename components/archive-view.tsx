"use client";

import { useEffect, useMemo, useState } from "react";
import { EditLeadSheet } from "@/components/edit-lead-sheet";
import { LeadFacts } from "@/components/lead-facts";
import { DatabaseSetup } from "@/components/database-setup";
import { formatDateTime, formatLeadStatus, isMissingTableError, isPermissionError } from "@/lib/format";
import { deleteLead, fetchArchiveLeads, returnLeadToQueue, updateLeadNotes } from "@/lib/leads";
import { recordLeadAction } from "@/lib/record-action";
import type { Lead } from "@/lib/types";

type ArchiveViewProps = {
  refreshKey: number;
  userName: string;
  canDelete: boolean;
  onToast: (message: string) => void;
};

export function ArchiveView({ refreshKey, userName, canDelete, onToast }: ArchiveViewProps) {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [setup, setSetup] = useState<"permission" | "missing-table" | null>(null);
  const [companyQuery, setCompanyQuery] = useState("");
  const [sectorQuery, setSectorQuery] = useState("");
  const [repQuery, setRepQuery] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [editing, setEditing] = useState<Lead | null>(null);

  function reportLogError(message: string | null) {
    if (!message) return;
    if (isMissingTableError(message)) setSetup("missing-table");
    else if (isPermissionError(message)) setSetup("permission");
  }

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const rows = await fetchArchiveLeads();
        if (cancelled) return;
        setLeads(rows);
        setDrafts(Object.fromEntries(rows.map((lead) => [lead.id, lead.notes ?? ""])));
      } catch (caught) {
        if (cancelled) return;
        const message = caught instanceof Error ? caught.message : "Could not load the archive.";
        setError(message);
        if (isMissingTableError(message)) setSetup("missing-table");
        if (isPermissionError(message)) setSetup("permission");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  const visible = useMemo(() => {
    const company = companyQuery.trim().toLowerCase();
    const sector = sectorQuery.trim().toLowerCase();
    const rep = repQuery.trim().toLowerCase();
    return leads.filter((lead) => {
      if (company && !lead.company_name.toLowerCase().includes(company)) return false;
      if (sector && !(lead.sector ?? "").toLowerCase().includes(sector)) return false;
      if (rep && !(lead.updated_by ?? "").toLowerCase().includes(rep)) return false;
      return true;
    });
  }, [companyQuery, leads, repQuery, sectorQuery]);

  async function saveNotes(lead: Lead) {
    const notes = drafts[lead.id] ?? "";
    setSavingId(lead.id);
    try {
      const saved = await updateLeadNotes(lead.id, notes, userName);
      setLeads((rows) => rows.map((row) => (row.id === lead.id ? saved : row)));
      const logError = await recordLeadAction({
        userName,
        actionType: "ADDED_NOTE",
        lead: saved,
        details: "Saved notes.",
      });
      reportLogError(logError);
      onToast(
        logError
          ? `Notes saved for ${lead.company_name}. The activity log was not updated.`
          : `Notes saved for ${lead.company_name}.`,
      );
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Could not save notes.";
      if (isPermissionError(message)) setSetup("permission");
      onToast(message);
    } finally {
      setSavingId(null);
    }
  }

  async function returnToQueue(lead: Lead) {
    setSavingId(lead.id);
    try {
      const saved = await returnLeadToQueue(lead.id, userName);
      setLeads((rows) => rows.filter((row) => row.id !== lead.id));
      const logError = await recordLeadAction({
        userName,
        actionType: "UPDATED_STATUS",
        lead: saved,
        details: "Returned the lead to the queue.",
      });
      reportLogError(logError);
      const message = `${lead.company_name} is back in the queue.`;
      onToast(logError ? `${message} The activity log was not updated.` : message);
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Could not update this lead.";
      if (isPermissionError(message)) setSetup("permission");
      onToast(message);
    } finally {
      setSavingId(null);
    }
  }

  async function removeLead(lead: Lead) {
    setSavingId(lead.id);
    try {
      await deleteLead(lead.id);
      setLeads((rows) => rows.filter((row) => row.id !== lead.id));
      setConfirmDeleteId(null);
      setOpenId(null);
      const logError = await recordLeadAction({
        userName,
        actionType: "DELETED_LEAD",
        lead,
        status: "deleted",
        details: "Deleted the lead.",
      });
      reportLogError(logError);
      onToast(
        logError
          ? `${lead.company_name} was deleted. The activity log was not updated.`
          : `${lead.company_name} was deleted.`,
      );
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Could not delete this lead.";
      if (isPermissionError(message)) setSetup("permission");
      onToast(message);
    } finally {
      setSavingId(null);
    }
  }

  if (loading) {
    return (
      <div className="space-y-3">
        <div className="h-12 animate-pulse rounded-2xl bg-card" />
        <div className="h-28 animate-pulse rounded-[28px] bg-card" />
        <div className="h-28 animate-pulse rounded-[28px] bg-card" />
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-8">
      <section className="space-y-3 rounded-[28px] border border-line bg-card p-4">
        <h2 className="font-serif text-2xl tracking-tight text-ink">Find a visit</h2>
        <p className="text-sm text-muted">Filter completed and archived companies by name, sector, or sales rep.</p>
        <label className="block">
          <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">
            Company name
          </span>
          <input
            value={companyQuery}
            onChange={(event) => setCompanyQuery(event.target.value)}
            placeholder="Brickmoon Design"
            className="w-full rounded-2xl border border-line bg-white px-4 py-3 text-base text-ink outline-none placeholder:text-muted/70 focus:border-pine"
          />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">
            Sector
          </span>
          <input
            value={sectorQuery}
            onChange={(event) => setSectorQuery(event.target.value)}
            placeholder="Architect"
            className="w-full rounded-2xl border border-line bg-white px-4 py-3 text-base text-ink outline-none placeholder:text-muted/70 focus:border-pine"
          />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">
            Visited by
          </span>
          <input
            value={repQuery}
            onChange={(event) => setRepQuery(event.target.value)}
            placeholder="ahmet54"
            className="w-full rounded-2xl border border-line bg-white px-4 py-3 text-base text-ink outline-none placeholder:text-muted/70 focus:border-pine"
          />
        </label>
        <p className="text-sm text-muted">
          {visible.length === 1 ? "1 company" : `${visible.length} companies`}
        </p>
      </section>

      {setup ? <DatabaseSetup kind={setup} detail={error ?? undefined} /> : null}
      {error && !setup ? (
        <p className="rounded-2xl bg-clay-soft px-3 py-2 text-sm text-clay" role="alert">
          {error}
        </p>
      ) : null}

      {!error && visible.length === 0 ? (
        <section className="rounded-[28px] border border-dashed border-line bg-card/70 px-5 py-8 text-center">
          <h2 className="font-serif text-3xl tracking-tight text-ink">
            {leads.length === 0 ? "No visited leads yet." : "No leads match those filters."}
          </h2>
          <p className="mt-2 text-sm text-muted">
            {leads.length === 0
              ? "Companies marked completed or archived will show up here."
              : "Try another company, sector, or sales rep."}
          </p>
        </section>
      ) : null}

      <ul className="space-y-3">
        {visible.map((lead) => {
          const open = openId === lead.id;
          const updated = formatDateTime(lead.updated_at);
          const visitedBy = [
            lead.customer_name,
            lead.updated_by ? `Visited by ${lead.updated_by}` : "Visitor not recorded",
            updated ? `Updated ${updated}` : null,
          ].filter(Boolean);
          return (
            <li key={lead.id}>
              <article className="rounded-[28px] border border-line bg-card p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-clay">
                      {lead.sector?.trim() || "Sector not set"}
                    </p>
                    <h2 className="mt-1 font-serif text-2xl leading-none tracking-tight text-ink">
                      {lead.company_name}
                    </h2>
                    <p className="mt-2 text-sm text-muted">{visitedBy.join(" · ")}</p>
                  </div>
                  <span className="rounded-full bg-pine/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-pine">
                    {formatLeadStatus(lead.status)}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => setOpenId(open ? null : lead.id)}
                  className="mt-3 text-sm font-semibold text-pine"
                  aria-expanded={open}
                >
                  {open ? "Hide details" : "View and edit notes"}
                </button>

                {open ? (
                  <div className="mt-3">
                    <LeadFacts lead={lead} />
                    <label className="mt-4 block">
                      <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">
                        Notes
                      </span>
                      <textarea
                        value={drafts[lead.id] ?? ""}
                        rows={4}
                        onChange={(event) =>
                          setDrafts((current) => ({ ...current, [lead.id]: event.target.value }))
                        }
                        className="w-full rounded-2xl border border-line bg-white px-3 py-3 text-base text-ink outline-none focus:border-pine"
                      />
                    </label>
                    <div className="mt-3 grid gap-2">
                      <button
                        type="button"
                        disabled={savingId === lead.id}
                        onClick={() => setEditing(lead)}
                        className="rounded-2xl border border-line px-4 py-3 text-sm font-semibold text-ink disabled:opacity-60"
                      >
                        Edit lead
                      </button>
                      <button
                        type="button"
                        disabled={savingId === lead.id}
                        onClick={() => saveNotes(lead)}
                        className="rounded-2xl bg-ink px-4 py-3 text-sm font-semibold text-paper disabled:opacity-60"
                      >
                        {savingId === lead.id ? "Saving..." : "Save notes"}
                      </button>
                      <button
                        type="button"
                        disabled={savingId === lead.id}
                        onClick={() => returnToQueue(lead)}
                        className="rounded-2xl border border-line px-4 py-3 text-sm font-semibold text-ink disabled:opacity-60"
                      >
                        Return to queue
                      </button>
                      {canDelete ? (
                        confirmDeleteId === lead.id ? (
                          <div className="grid grid-cols-2 gap-2">
                            <button
                              type="button"
                              disabled={savingId === lead.id}
                              onClick={() => setConfirmDeleteId(null)}
                              className="rounded-2xl border border-line px-4 py-3 text-sm font-semibold text-ink disabled:opacity-60"
                            >
                              Cancel
                            </button>
                            <button
                              type="button"
                              disabled={savingId === lead.id}
                              onClick={() => removeLead(lead)}
                              className="rounded-2xl bg-clay px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
                            >
                              {savingId === lead.id ? "Deleting..." : "Delete lead"}
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            disabled={savingId === lead.id}
                            onClick={() => setConfirmDeleteId(lead.id)}
                            className="rounded-2xl border border-clay/40 px-4 py-3 text-sm font-semibold text-clay disabled:opacity-60"
                          >
                            Delete lead
                          </button>
                        )
                      ) : null}
                    </div>
                  </div>
                ) : lead.notes?.trim() ? (
                  <p className="mt-3 line-clamp-3 whitespace-pre-wrap text-sm leading-relaxed text-muted">
                    {lead.notes}
                  </p>
                ) : null}
              </article>
            </li>
          );
        })}
      </ul>
      <EditLeadSheet
        lead={editing}
        userName={userName}
        onClose={() => setEditing(null)}
        onSaved={(saved) => {
          setEditing(null);
          if (saved.status === "pending") {
            setLeads((rows) => rows.filter((row) => row.id !== saved.id));
          } else {
            setLeads((rows) => rows.map((row) => (row.id === saved.id ? saved : row)));
            setDrafts((current) => ({ ...current, [saved.id]: saved.notes ?? "" }));
          }
          void recordLeadAction({
            userName,
            actionType: "UPDATED_LEAD",
            lead: saved,
            details: "Updated the lead record.",
          }).then((logError) => {
            reportLogError(logError);
            onToast(
              logError
                ? `${saved.company_name} was updated. The activity log was not updated.`
                : `${saved.company_name} was updated.`,
            );
          });
        }}
      />
    </div>
  );
}
