"use client";

import { useEffect, useId, useState, type FormEvent } from "react";
import { Sheet } from "@/components/sheet";
import { isPermissionError } from "@/lib/format";
import { updateLeadRecord } from "@/lib/leads";
import { EMPTY_LEAD_DRAFT, type Lead, type LeadDraft, type LeadStatus } from "@/lib/types";

type EditLeadSheetProps = {
  lead: Lead | null;
  userName: string;
  onClose: () => void;
  onSaved: (lead: Lead) => void;
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

const STATUSES: { value: LeadStatus; label: string }[] = [
  { value: "pending", label: "Pending" },
  { value: "completed", label: "Completed" },
  { value: "archived", label: "Archived" },
];

function draftFromLead(lead: Lead): LeadDraft {
  return {
    customer_name: lead.customer_name ?? "",
    job_title: lead.job_title ?? "",
    company_name: lead.company_name,
    sector: lead.sector ?? "",
    address: lead.address ?? "",
    phone: lead.phone,
    alt_phone: lead.alt_phone ?? "",
    company_email: lead.company_email ?? "",
    alt_email: lead.alt_email ?? "",
    website: lead.website ?? "",
    notes: lead.notes ?? "",
  };
}

export function EditLeadSheet({ lead, userName, onClose, onSaved }: EditLeadSheetProps) {
  const formId = useId();
  const [draft, setDraft] = useState<LeadDraft>(EMPTY_LEAD_DRAFT);
  const [status, setStatus] = useState<LeadStatus>("pending");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!lead) return;
    setDraft(draftFromLead(lead));
    setStatus(lead.status);
    setError(null);
    setSaving(false);
  }, [lead]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!lead) return;
    if (!draft.company_name.trim() || !draft.phone.trim()) {
      setError("Company name and phone are required.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const saved = await updateLeadRecord(lead.id, draft, status, userName);
      onSaved(saved);
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Could not update this lead.";
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
      open={Boolean(lead)}
      title="Edit lead"
      description="Update the company details, visit notes, or status."
      onClose={onClose}
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
                autoComplete="off"
                onChange={(event) =>
                  setDraft((current) => ({ ...current, [field.name]: event.target.value }))
                }
                className="w-full rounded-2xl border border-line bg-white px-3 py-3 text-base text-ink outline-none placeholder:text-muted/70 focus:border-pine"
              />
            )}
          </label>
        ))}

        <div role="group" aria-label="Status">
          <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">
            Status
          </span>
          <div className="grid grid-cols-3 gap-2">
            {STATUSES.map((item) => (
              <button
                key={item.value}
                type="button"
                aria-pressed={status === item.value}
                onClick={() => setStatus(item.value)}
                className={`rounded-2xl px-2 py-3 text-sm font-semibold ${
                  status === item.value ? "bg-ink text-paper" : "border border-line bg-white text-ink"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

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
          {saving ? "Saving..." : "Save lead"}
        </button>
      </form>
    </Sheet>
  );
}
