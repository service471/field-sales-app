"use client";

import { useEffect, useId, useMemo, useState, type FormEvent } from "react";
import { Sheet } from "@/components/sheet";
import {
  fetchLeadCandidates,
  rankDuplicateLeads,
  type DuplicateMatch,
  type LeadCandidate,
} from "@/lib/duplicate-leads";
import { formatLeadStatus, isPermissionError } from "@/lib/format";
import { createLead } from "@/lib/leads";
import { EMPTY_LEAD_DRAFT, type Lead, type LeadDraft } from "@/lib/types";

type AddLeadSheetProps = {
  open: boolean;
  userName: string;
  onClose: () => void;
  onCreated: (lead: Lead) => void;
};

const FIELDS: Array<{
  name: keyof LeadDraft;
  label: string;
  required?: boolean;
  placeholder: string;
  multiline?: boolean;
}> = [
  { name: "company_name", label: "Company name", required: true, placeholder: "Brickmoon Design" },
  { name: "customer_name", label: "Customer name", placeholder: "Alex Rivera" },
  { name: "job_title", label: "Job title", placeholder: "Owner" },
  { name: "sector", label: "Sector", placeholder: "Architect, contractor, supplier" },
  { name: "phone", label: "Phone", required: true, placeholder: "1 (512) 555 0100" },
  { name: "alt_phone", label: "Alt phone", placeholder: "Optional second number" },
  { name: "company_email", label: "Company email", placeholder: "hello@example.com" },
  { name: "alt_email", label: "Alt email", placeholder: "Optional second email" },
  { name: "address", label: "Address", placeholder: "Street, city, state" },
  { name: "website", label: "Website", placeholder: "https://example.com" },
  { name: "notes", label: "Notes", placeholder: "Gate code or visit context", multiline: true },
];

export function AddLeadSheet({ open, userName, onClose, onCreated }: AddLeadSheetProps) {
  const formId = useId();
  const [draft, setDraft] = useState<LeadDraft>(EMPTY_LEAD_DRAFT);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [candidates, setCandidates] = useState<LeadCandidate[]>([]);
  const [viewingId, setViewingId] = useState<string | null>(null);

  const matches = useMemo(
    () => rankDuplicateLeads(candidates, draft.company_name, draft.phone),
    [candidates, draft.company_name, draft.phone],
  );
  const viewing = matches.find((match) => match.id === viewingId) ?? null;

  useEffect(() => {
    if (!open) return;
    let cancelled = false;

    async function load() {
      try {
        const rows = await fetchLeadCandidates();
        if (!cancelled) setCandidates(rows);
      } catch {
        if (!cancelled) setCandidates([]);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [open]);

  function resetForm() {
    setDraft(EMPTY_LEAD_DRAFT);
    setError(null);
    setSaving(false);
    setViewingId(null);
  }

  function handleClose() {
    resetForm();
    onClose();
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!draft.company_name.trim() || !draft.phone.trim()) {
      setError("Company name and phone are required.");
      return;
    }

    const exact = matches.find((match) => match.exact);
    if (exact) {
      setViewingId(exact.id);
      setError("A company with this name or phone already exists.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const lead = await createLead(draft, userName);
      resetForm();
      onCreated(lead);
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Could not save this lead.";
      setError(
        isPermissionError(message)
          ? "Supabase row level security blocked this save. Run supabase/schema.sql in the SQL editor, then try again."
          : message,
      );
      setSaving(false);
    }
  }

  return (
    <Sheet
      open={open}
      title="Add a company"
      description="New leads join the end of today's queue."
      onClose={handleClose}
    >
      <form id={formId} onSubmit={onSubmit} className="space-y-3">
        {FIELDS.map((field) => (
          <label key={field.name} className="block">
            <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">
              {field.label}
              {field.required ? " *" : ""}
            </span>
            {field.multiline ? (
              <textarea
                value={draft[field.name]}
                placeholder={field.placeholder}
                rows={3}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, [field.name]: event.target.value }))
                }
                className="w-full rounded-2xl border border-line bg-white px-3 py-3 text-base text-ink outline-none placeholder:text-muted/70 focus:border-pine"
              />
            ) : (
              <input
                value={draft[field.name]}
                placeholder={field.placeholder}
                required={field.required}
                inputMode={
                  field.name === "phone" || field.name === "alt_phone"
                    ? "tel"
                    : field.name === "company_email" || field.name === "alt_email"
                      ? "email"
                      : "text"
                }
                autoComplete={field.name === "phone" ? "tel" : "off"}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, [field.name]: event.target.value }))
                }
                className="w-full rounded-2xl border border-line bg-white px-3 py-3 text-base text-ink outline-none placeholder:text-muted/70 focus:border-pine"
              />
            )}
          </label>
        ))}

        {matches.length > 0 ? (
          <DuplicateWarning
            matches={matches}
            viewing={viewing}
            onView={(match) => setViewingId(match.id)}
          />
        ) : null}

        {error ? (
          <p className="rounded-2xl bg-clay-soft px-3 py-2 text-sm text-clay" role="alert">
            {error}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={saving}
          className="mt-2 w-full rounded-2xl bg-ink px-4 py-3.5 text-base font-semibold text-paper disabled:opacity-60"
        >
          {saving ? "Saving..." : "Add to queue"}
        </button>
      </form>
    </Sheet>
  );
}

function DuplicateWarning({
  matches,
  viewing,
  onView,
}: {
  matches: DuplicateMatch[];
  viewing: DuplicateMatch | null;
  onView: (match: DuplicateMatch) => void;
}) {
  return (
    <div className="rounded-2xl border border-clay/40 bg-clay-soft p-3" role="status">
      <p className="text-sm font-semibold leading-relaxed text-clay">
        Warning: A company with this name/phone already exists in the system.
      </p>
      {matches.length > 1 ? (
        <p className="mt-1 text-sm text-ink">{matches.length} possible matches.</p>
      ) : null}
      <button
        type="button"
        onClick={() => onView(matches[0])}
        className="mt-3 rounded-full bg-white px-3 py-2 text-sm font-semibold text-ink"
      >
        View existing record
      </button>
      {matches.length > 1 ? (
        <div className="mt-2 flex flex-wrap gap-2">
          {matches.slice(0, 4).map((match) => (
            <button
              key={match.id}
              type="button"
              onClick={() => onView(match)}
              className="rounded-full border border-line bg-white px-3 py-2 text-sm font-semibold text-ink"
            >
              {match.company_name}
            </button>
          ))}
        </div>
      ) : null}
      {viewing ? (
        <div className="mt-3 rounded-2xl bg-white px-3 py-3 text-sm leading-relaxed text-ink">
          <p className="font-semibold">{viewing.company_name}</p>
          <p>{viewing.customer_name?.trim() || "Customer not set"}</p>
          <p>{viewing.phone}</p>
          <p>{viewing.sector?.trim() || "Sector not set"}</p>
          <p>{viewing.address?.trim() || "Address not set"}</p>
          <p>{formatLeadStatus(viewing.status)}</p>
        </div>
      ) : null}
    </div>
  );
}
