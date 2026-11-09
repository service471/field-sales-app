import { logActivity } from "@/lib/activity";
import { pushLeadChange } from "@/lib/sync-client";
import type { ActivityAction, Lead } from "@/lib/types";

export async function recordLeadAction(input: {
  userName: string;
  actionType: ActivityAction;
  lead: Lead;
  details?: string | null;
  status?: string;
}) {
  const logError = await logActivity({
    userName: input.userName,
    actionType: input.actionType,
    companyName: input.lead.company_name,
    details: input.details,
  });

  pushLeadChange({
    id: input.lead.id,
    company_name: input.lead.company_name,
    status: input.status ?? input.lead.status,
    notes: input.lead.notes,
    updated_by: input.lead.updated_by,
    updated_at: input.lead.updated_at,
    customer_name: input.lead.customer_name,
    job_title: input.lead.job_title,
    phone: input.lead.phone,
    alt_phone: input.lead.alt_phone,
    company_email: input.lead.company_email,
    alt_email: input.lead.alt_email,
    sector: input.lead.sector,
    address: input.lead.address,
    website: input.lead.website,
  });

  return logError;
}
