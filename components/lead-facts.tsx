import { Globe, Mail, MapPin, Phone, UserRound } from "lucide-react";
import { toMapsHref, toTelHref, toWebsiteHref, websiteLabel } from "@/lib/format";
import type { Lead } from "@/lib/types";

type LeadFactsProps = {
  lead: Lead;
};

function FactValue({
  href,
  external,
  children,
}: {
  href?: string;
  external?: boolean;
  children: string;
}) {
  if (!href) {
    return <span className="mt-0.5 block text-base text-muted">{children}</span>;
  }

  return (
    <a
      href={href}
      {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
      className="mt-0.5 block break-words text-base leading-snug text-ink underline decoration-line underline-offset-4"
    >
      {children}
    </a>
  );
}

export function LeadFacts({ lead }: LeadFactsProps) {
  const contact = [lead.customer_name, lead.job_title].filter(Boolean).join(" · ");

  return (
    <div className="divide-y divide-line border-y border-line">
      <div className="flex items-start gap-3 py-3">
        <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-pine" aria-hidden />
        <span className="min-w-0">
          <span className="block text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">
            Address
          </span>
          <FactValue href={lead.address ? toMapsHref(lead.address) : undefined} external>
            {lead.address?.trim() || "Not provided"}
          </FactValue>
        </span>
      </div>

      <div className="flex items-start gap-3 py-3">
        <Phone className="mt-0.5 h-5 w-5 shrink-0 text-pine" aria-hidden />
        <span className="min-w-0">
          <span className="block text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">
            Phone
          </span>
          <FactValue href={toTelHref(lead.phone)}>{lead.phone}</FactValue>
        </span>
      </div>

      <div className="flex items-start gap-3 py-3">
        <Phone className="mt-0.5 h-5 w-5 shrink-0 text-clay" aria-hidden />
        <span className="min-w-0">
          <span className="block text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">
            Alt phone
          </span>
          <FactValue href={lead.alt_phone ? toTelHref(lead.alt_phone) : undefined}>
            {lead.alt_phone?.trim() || "Not provided"}
          </FactValue>
        </span>
      </div>

      <div className="flex items-start gap-3 py-3">
        <UserRound className="mt-0.5 h-5 w-5 shrink-0 text-pine" aria-hidden />
        <span className="min-w-0">
          <span className="block text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">
            Customer
          </span>
          <span className={`mt-0.5 block text-base ${contact ? "text-ink" : "text-muted"}`}>
            {contact || "Not provided"}
          </span>
        </span>
      </div>

      <div className="flex items-start gap-3 py-3">
        <Mail className="mt-0.5 h-5 w-5 shrink-0 text-pine" aria-hidden />
        <span className="min-w-0">
          <span className="block text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">
            Company email
          </span>
          <FactValue href={lead.company_email ? `mailto:${lead.company_email}` : undefined}>
            {lead.company_email?.trim() || "Not provided"}
          </FactValue>
        </span>
      </div>

      <div className="flex items-start gap-3 py-3">
        <Mail className="mt-0.5 h-5 w-5 shrink-0 text-clay" aria-hidden />
        <span className="min-w-0">
          <span className="block text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">
            Alt email
          </span>
          <FactValue href={lead.alt_email ? `mailto:${lead.alt_email}` : undefined}>
            {lead.alt_email?.trim() || "Not provided"}
          </FactValue>
        </span>
      </div>

      <div className="flex items-start gap-3 py-3">
        <Globe className="mt-0.5 h-5 w-5 shrink-0 text-pine" aria-hidden />
        <span className="min-w-0">
          <span className="block text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">
            Website
          </span>
          <FactValue href={lead.website ? toWebsiteHref(lead.website) : undefined} external>
            {lead.website ? websiteLabel(lead.website) : "Not provided"}
          </FactValue>
        </span>
      </div>
    </div>
  );
}
