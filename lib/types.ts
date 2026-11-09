export type LeadStatus = "pending" | "completed" | "archived";

export type UserRole = "admin" | "sales";

export type AppUser = {
  id: string;
  name: string;
  role: UserRole;
};

export type ActivityAction =
  | "VISITED"
  | "ADDED_NOTE"
  | "CREATED_LEAD"
  | "UPDATED_STATUS"
  | "UPDATED_LEAD"
  | "DELETED_LEAD"
  | "ADDED_USER"
  | "UPDATED_USER"
  | "REMOVED_USER"
  | "SHEETS_SYNC";

export type ActivityLog = {
  id: string;
  user_name: string;
  action_type: string;
  company_name: string | null;
  details: string | null;
  created_at: string;
};

export type SheetLeadPayload = {
  id: string;
  company_name: string;
  status: string;
  notes: string | null;
  updated_by?: string | null;
  updated_at?: string | null;
  customer_name?: string | null;
  job_title?: string | null;
  phone?: string | null;
  alt_phone?: string | null;
  company_email?: string | null;
  alt_email?: string | null;
  sector?: string | null;
  address?: string | null;
  website?: string | null;
};

export type Lead = {
  id: string;
  customer_name: string | null;
  job_title: string | null;
  company_name: string;
  sector: string | null;
  address: string | null;
  phone: string;
  alt_phone: string | null;
  company_email: string | null;
  alt_email: string | null;
  website: string | null;
  status: LeadStatus;
  notes: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
};

export type LeadDraft = {
  customer_name: string;
  job_title: string;
  company_name: string;
  sector: string;
  address: string;
  phone: string;
  alt_phone: string;
  company_email: string;
  alt_email: string;
  website: string;
  notes: string;
};

export const EMPTY_LEAD_DRAFT: LeadDraft = {
  customer_name: "",
  job_title: "",
  company_name: "",
  sector: "",
  address: "",
  phone: "",
  alt_phone: "",
  company_email: "",
  alt_email: "",
  website: "",
  notes: "",
};
