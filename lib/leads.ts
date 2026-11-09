import { duplicateLeadMessage, findExactDuplicateLead } from "@/lib/duplicate-leads";
import { appendReturnNote } from "@/lib/format";
import { SEED_LEADS } from "@/lib/seed-data";
import { getSupabase } from "@/lib/supabase";
import type { Lead, LeadDraft, LeadStatus } from "@/lib/types";

const LEAD_COLUMNS =
  "id, customer_name, job_title, company_name, sector, address, phone, alt_phone, company_email, alt_email, website, status, notes, updated_by, created_at, updated_at";

function touch(userName: string) {
  return {
    updated_by: userName,
    updated_at: new Date().toISOString(),
  };
}

function emptyToNull(value: string) {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export async function fetchPendingLeads() {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("leads")
    .select(LEAD_COLUMNS)
    .eq("status", "pending")
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as Lead[];
}

export async function fetchLeadCount() {
  const supabase = getSupabase();
  const { count, error } = await supabase
    .from("leads")
    .select("id", { count: "exact", head: true });

  if (error) {
    throw new Error(error.message);
  }

  return count ?? 0;
}

export async function fetchArchiveLeads() {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("leads")
    .select(LEAD_COLUMNS)
    .in("status", ["completed", "archived"])
    .order("updated_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as Lead[];
}

export async function fetchAllLeads() {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("leads")
    .select(LEAD_COLUMNS)
    .order("updated_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as Lead[];
}

export async function updateLeadStatus(id: string, status: LeadStatus, userName: string) {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("leads")
    .update({ status, ...touch(userName) })
    .eq("id", id)
    .select(LEAD_COLUMNS)
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data as Lead;
}

export async function returnLeadToQueue(id: string, userName: string) {
  const supabase = getSupabase();
  const { data: current, error: readError } = await supabase
    .from("leads")
    .select(LEAD_COLUMNS)
    .eq("id", id)
    .single();

  if (readError) {
    throw new Error(readError.message);
  }

  const lead = current as Lead;
  const { data, error } = await supabase
    .from("leads")
    .update({
      status: "pending",
      notes: lead.status === "pending" ? lead.notes : appendReturnNote(lead.notes, userName),
      ...touch(userName),
    })
    .eq("id", id)
    .select(LEAD_COLUMNS)
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data as Lead;
}

export async function updateLeadNotes(id: string, notes: string, userName: string) {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("leads")
    .update({ notes, ...touch(userName) })
    .eq("id", id)
    .select(LEAD_COLUMNS)
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data as Lead;
}

export async function completeLeadWithNotes(id: string, notes: string, userName: string) {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("leads")
    .update({ notes, status: "completed", ...touch(userName) })
    .eq("id", id)
    .select(LEAD_COLUMNS)
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data as Lead;
}

export async function seedLeadsIfEmpty() {
  const count = await fetchLeadCount();
  if (count > 0) {
    return {
      seeded: false,
      count: 0,
      message: "The leads table already has data, so nothing was inserted.",
    };
  }

  const supabase = getSupabase();
  const { data, error } = await supabase.from("leads").insert(SEED_LEADS).select("id");

  if (error) {
    throw new Error(error.message);
  }

  return {
    seeded: true,
    count: data?.length ?? 0,
    message: "Sample leads are ready.",
  };
}

export async function updateLeadRecord(id: string, draft: LeadDraft, status: LeadStatus, userName: string) {
  const companyName = draft.company_name.trim();
  const phone = draft.phone.trim();
  if (!companyName || !phone) {
    throw new Error("Company name and phone are required.");
  }

  const duplicate = await findExactDuplicateLead(companyName, phone, id);
  if (duplicate) {
    throw new Error(duplicateLeadMessage(duplicate));
  }

  const supabase = getSupabase();
  const { data: existing, error: readError } = await supabase
    .from("leads")
    .select("status")
    .eq("id", id)
    .single();

  if (readError) {
    throw new Error(readError.message);
  }

  let notes = emptyToNull(draft.notes) ?? "";
  const leavingArchive =
    (existing.status === "completed" || existing.status === "archived") && status === "pending";
  if (leavingArchive) {
    notes = appendReturnNote(notes, userName);
  }

  const { data, error } = await supabase
    .from("leads")
    .update({
      customer_name: emptyToNull(draft.customer_name),
      job_title: emptyToNull(draft.job_title),
      company_name: companyName,
      sector: emptyToNull(draft.sector),
      address: emptyToNull(draft.address),
      phone,
      alt_phone: emptyToNull(draft.alt_phone),
      company_email: emptyToNull(draft.company_email),
      alt_email: emptyToNull(draft.alt_email),
      website: emptyToNull(draft.website),
      notes,
      status,
      ...touch(userName),
    })
    .eq("id", id)
    .select(LEAD_COLUMNS)
    .single();

  if (error) {
    throw new Error(friendlyLeadWriteError(error.message));
  }

  return data as Lead;
}

function friendlyLeadWriteError(message: string) {
  if (/company with this (name|phone|name and phone) already exists/i.test(message)) {
    const found = message.match(/A company with this (?:name and phone|name|phone) already exists\./i);
    return found?.[0] ?? "A company with this name or phone already exists.";
  }
  return message;
}

export async function deleteLead(id: string) {
  const supabase = getSupabase();
  const { error } = await supabase.from("leads").delete().eq("id", id);

  if (error) {
    throw new Error(error.message);
  }
}

export async function createLead(draft: LeadDraft, userName: string) {
  const companyName = draft.company_name.trim();
  const phone = draft.phone.trim();
  const duplicate = await findExactDuplicateLead(companyName, phone);
  if (duplicate) {
    throw new Error(duplicateLeadMessage(duplicate));
  }

  const supabase = getSupabase();
  const payload = {
    customer_name: emptyToNull(draft.customer_name),
    job_title: emptyToNull(draft.job_title),
    company_name: companyName,
    sector: emptyToNull(draft.sector),
    address: emptyToNull(draft.address),
    phone,
    alt_phone: emptyToNull(draft.alt_phone),
    company_email: emptyToNull(draft.company_email),
    alt_email: emptyToNull(draft.alt_email),
    website: emptyToNull(draft.website),
    notes: emptyToNull(draft.notes) ?? "",
    status: "pending" as const,
    ...touch(userName),
  };

  const { data, error } = await supabase
    .from("leads")
    .insert(payload)
    .select(LEAD_COLUMNS)
    .single();

  if (error) {
    throw new Error(friendlyLeadWriteError(error.message));
  }

  return data as Lead;
}
