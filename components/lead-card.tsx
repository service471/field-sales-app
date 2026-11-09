import { LeadFacts } from "@/components/lead-facts";
import { formatDateTime, wasReturnedToQueue } from "@/lib/format";
import type { Lead } from "@/lib/types";

type LeadCardProps = {
  lead: Lead;
};

function monogram(name: string) {
  const parts = name
    .split(/\s+/)
    .map((part) => part.replace(/[^A-Za-z0-9]/g, ""))
    .filter(Boolean);
  const letters = parts.slice(0, 2).map((part) => part[0]?.toUpperCase() ?? "");
  return letters.join("") || "FS";
}

export function LeadCard({ lead }: LeadCardProps) {
  const notes = lead.notes?.trim();
  const returned = wasReturnedToQueue(lead.notes);

  return (
    <article
      className={`rounded-[28px] border bg-card px-5 py-5 shadow-[0_20px_50px_rgba(28,25,21,0.08)] ${
        returned ? "border-clay ring-2 ring-clay/30" : "border-line"
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-clay">
              {lead.sector?.trim() || "Sector not set"}
            </p>
            {returned ? (
              <span className="rounded-full bg-clay px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-white">
                Returned to queue
              </span>
            ) : null}
          </div>
          <h2 className="mt-2 font-serif text-[2.05rem] leading-[0.95] tracking-tight text-ink">
            {lead.company_name}
          </h2>
        </div>
        <div
          aria-hidden
          className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-stamp font-serif text-xl text-ink"
        >
          {monogram(lead.company_name)}
        </div>
      </div>

      <div className="mt-5">
        <LeadFacts lead={lead} />
      </div>

      <div className="mt-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">Notes</p>
        <p
          className={`mt-2 whitespace-pre-wrap text-sm leading-relaxed ${
            notes ? "text-ink" : "text-muted"
          }`}
        >
          {notes || "No notes yet."}
        </p>
        {lead.updated_by ? (
          <p className="mt-3 text-sm text-muted">
            Last updated by {lead.updated_by}
            {lead.updated_at ? ` · ${formatDateTime(lead.updated_at)}` : ""}
          </p>
        ) : null}
      </div>
    </article>
  );
}
