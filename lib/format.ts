export function toTelHref(phone: string) {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("1")) {
    return `tel:+${digits}`;
  }
  if (digits.length === 10) {
    return `tel:+1${digits}`;
  }
  return `tel:+${digits}`;
}

export function toMapsHref(address: string) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
}

export function toWebsiteHref(website: string) {
  if (/^https?:\/\//i.test(website)) {
    return website;
  }
  return `https://${website}`;
}

export function websiteLabel(website: string) {
  return website.replace(/^https?:\/\//i, "").replace(/\/$/, "");
}

export function formatAddedDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

export function appendVisitNote(existing: string | null, visitNote: string) {
  const next = visitNote.trim();
  const previous = (existing ?? "").trim();
  if (!previous) {
    return next;
  }
  return `${previous}\n\nVisit note:\n${next}`;
}

const RETURNED_NOTE_PATTERN = /^Returned to queue by .+ on .+\.$/m;

export function wasReturnedToQueue(notes: string | null) {
  return RETURNED_NOTE_PATTERN.test(notes ?? "");
}

export function appendReturnNote(existing: string | null, userName: string, at = new Date()) {
  const when = formatDateTime(at.toISOString()) || "an unknown time";
  const line = `Returned to queue by ${userName.trim() || "unknown"} on ${when}.`;
  const previous = (existing ?? "").trim();
  return previous ? `${previous}\n\n${line}` : line;
}

export function isMissingTableError(message: string) {
  return /could not find the table|schema cache|does not exist/i.test(message);
}

export function isPermissionError(message: string) {
  return /row-level security|permission denied|42501/i.test(message);
}

export function escapeIlike(value: string) {
  return value.replace(/[%_\\]/g, "\\$&");
}

export function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

const ACTION_LABELS: Record<string, string> = {
  VISITED: "Visited",
  ADDED_NOTE: "Added note",
  CREATED_LEAD: "Created lead",
  UPDATED_STATUS: "Updated status",
  UPDATED_LEAD: "Updated lead",
  DELETED_LEAD: "Deleted lead",
  ADDED_USER: "Added user",
  UPDATED_USER: "Updated user",
  REMOVED_USER: "Removed user",
  SHEETS_SYNC: "Sheets sync",
};

export function formatActionType(action: string) {
  return ACTION_LABELS[action] ?? action.replace(/_/g, " ").toLowerCase();
}

const STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  completed: "Completed",
  archived: "Archived",
};

export function formatLeadStatus(status: string) {
  return STATUS_LABELS[status] ?? status;
}
