"use client";

import { useState } from "react";
import { Sheet } from "@/components/sheet";
import type { Lead } from "@/lib/types";

type NoteSheetProps = {
  lead: Lead | null;
  saving: boolean;
  error: string | null;
  onClose: () => void;
  onSubmit: (note: string) => void;
};

export function NoteSheet(props: NoteSheetProps) {
  return <NoteSheetBody key={props.lead?.id ?? "closed"} {...props} />;
}

function NoteSheetBody({ lead, saving, error, onClose, onSubmit }: NoteSheetProps) {
  const [note, setNote] = useState("");

  return (
    <Sheet
      open={Boolean(lead)}
      title="Visit notes"
      description={
        lead
          ? `Add a note for ${lead.company_name}. It is appended to the current notes, then the visit is marked complete.`
          : undefined
      }
      onClose={onClose}
    >
      {lead?.notes?.trim() ? (
        <div className="mb-4 rounded-2xl bg-stamp px-3 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">
            Current notes
          </p>
          <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-ink">{lead.notes}</p>
        </div>
      ) : null}

      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (!note.trim()) return;
          onSubmit(note);
        }}
      >
        <label className="block">
          <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">
            What happened on this visit?
          </span>
          <textarea
            value={note}
            onChange={(event) => setNote(event.target.value)}
            rows={5}
            autoFocus
            placeholder="Met the owner and left a sample board."
            className="w-full rounded-2xl border border-line bg-white px-3 py-3 text-base text-ink outline-none placeholder:text-muted/70 focus:border-pine"
          />
        </label>

        {error ? (
          <p className="mt-3 rounded-2xl bg-clay-soft px-3 py-2 text-sm text-clay" role="alert">
            {error}
          </p>
        ) : null}

        <div className="mt-4 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-2xl border border-line px-4 py-3.5 text-base font-semibold text-ink disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving || note.trim().length === 0}
            className="rounded-2xl bg-pine px-4 py-3.5 text-base font-semibold text-white disabled:opacity-60"
          >
            {saving ? "Saving..." : "Save and complete"}
          </button>
        </div>
      </form>
    </Sheet>
  );
}
