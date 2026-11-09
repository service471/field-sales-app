// Google Sheets service-account client.
// Expected columns include company_name, status, notes, updated_by, and updated_at.
// Header names are matched loosely. A sheet with no header uses that column order.

import { google, type sheets_v4 } from "googleapis";
import { logActivity } from "@/lib/activity";
import { escapeIlike } from "@/lib/format";
import { getSupabase } from "@/lib/supabase";
import type { Lead, LeadStatus, SheetLeadPayload } from "@/lib/types";

const LEAD_COLUMNS =
  "id, customer_name, job_title, company_name, sector, address, phone, alt_phone, company_email, alt_email, website, status, notes, updated_by, created_at, updated_at";

const DEFAULT_HEADERS = [
  "id",
  "customer_name",
  "job_title",
  "company_name",
  "sector",
  "address",
  "phone",
  "alt_phone",
  "company_email",
  "alt_email",
  "website",
  "status",
  "notes",
  "updated_by",
  "created_at",
  "updated_at",
] as const;

const HEADER_FIELDS = new Set<string>(DEFAULT_HEADERS);

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export class SheetSyncError extends Error {
  status: number;

  constructor(message: string, status = 500) {
    super(message);
    this.name = "SheetSyncError";
    this.status = status;
  }
}

export type SheetLead = {
  id: string | null;
  customer_name: string | null;
  job_title: string | null;
  company_name: string;
  sector: string | null;
  address: string | null;
  phone: string | null;
  alt_phone: string | null;
  company_email: string | null;
  alt_email: string | null;
  website: string | null;
  status: LeadStatus | null;
  notes: string | null;
  updated_by: string | null;
  updated_at: string | null;
  rowNumber: number;
};

type SheetGrid = {
  fields: string[];
  labels: string[];
  rows: string[][];
  hasHeader: boolean;
};

export function sheetsConfigured() {
  return Boolean(serviceAccountEmail() && privateKey() && spreadsheetId());
}

function serviceAccountEmail() {
  return process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL?.trim() ?? "";
}

function spreadsheetId() {
  return (process.env.GOOGLE_SHEET_ID || process.env.GOOGLE_SHEETS_SPREADSHEET_ID || "").trim();
}

function privateKey() {
  const raw = process.env.GOOGLE_PRIVATE_KEY || process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY || "";
  return raw.trim().replace(/^["']|["']$/g, "").replace(/\\n/g, "\n");
}

function blankToNull(value: string | null | undefined) {
  const trimmed = (value ?? "").trim();
  return trimmed.length > 0 ? trimmed : null;
}

function cellText(value: unknown) {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function normalizeHeader(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}

function fieldName(header: string) {
  const name = normalizeHeader(header);
  if (name === "company" || name === "companyname") return "company_name";
  if (name === "note") return "notes";
  if (name === "telephone" || name === "phone_number") return "phone";
  if (name === "lead_id") return "id";
  if (name === "contact" || name === "contact_person" || name === "contact_name" || name === "customer") {
    return "customer_name";
  }
  if (name === "contact_title" || name === "title") return "job_title";
  if (name === "email") return "company_email";
  return HEADER_FIELDS.has(name) ? name : "";
}

function parseStatus(value: string): LeadStatus | null {
  const normalized = value.trim().toLowerCase();
  if (normalized === "pending" || normalized === "open" || normalized === "queue") return "pending";
  if (normalized === "archived" || normalized === "archive") return "archived";
  if (["completed", "complete", "visited", "done"].includes(normalized)) return "completed";
  return null;
}

function quotedTab(tab: string) {
  return `'${tab.replace(/'/g, "''")}'`;
}

function columnLetter(index: number) {
  let n = index + 1;
  let letters = "";
  while (n > 0) {
    const remainder = (n - 1) % 26;
    letters = String.fromCharCode(65 + remainder) + letters;
    n = Math.floor((n - 1) / 26);
  }
  return letters;
}

async function sheetsClient() {
  const email = serviceAccountEmail();
  const key = privateKey();
  const id = spreadsheetId();
  if (!email || !key || !id) {
    throw new SheetSyncError(
      "Google Sheets is not configured. Set GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_PRIVATE_KEY, and GOOGLE_SHEET_ID.",
      500,
    );
  }

  const auth = new google.auth.JWT({
    email,
    key,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });

  return {
    sheets: google.sheets({ version: "v4", auth }),
    spreadsheetId: id,
  };
}

async function sheetTab(sheets: sheets_v4.Sheets, id: string) {
  const requested = process.env.GOOGLE_SHEET_TAB?.trim() || process.env.GOOGLE_SHEETS_TAB?.trim();
  if (requested) return requested;

  const meta = await asSheetError(() =>
    sheets.spreadsheets.get({
      spreadsheetId: id,
      fields: "sheets.properties.title",
    }),
  );
  return meta.data.sheets?.[0]?.properties?.title || "Sheet1";
}

function googleMessage(error: unknown) {
  if (error instanceof SheetSyncError) return error.message;
  const raw =
    error && typeof error === "object" && "message" in error && typeof error.message === "string"
      ? error.message
      : "Google Sheets request failed.";
  if (/caller does not have permission|permission denied|forbidden/i.test(raw)) {
    return "The service account cannot open this spreadsheet. Share the sheet with the service account email and check GOOGLE_SHEET_ID.";
  }
  if (/requested entity was not found|not found/i.test(raw)) {
    return "The spreadsheet was not found. Check GOOGLE_SHEET_ID.";
  }
  return raw;
}

function googleStatus(error: unknown) {
  if (/cannot open this spreadsheet|permission/i.test(googleMessage(error))) return 403;
  if (/was not found/i.test(googleMessage(error))) return 404;
  return 502;
}

async function asSheetError<T>(work: () => Promise<T>) {
  try {
    return await work();
  } catch (error) {
    if (error instanceof SheetSyncError) throw error;
    throw new SheetSyncError(googleMessage(error), googleStatus(error));
  }
}

async function readGrid(sheets: sheets_v4.Sheets, id: string, tab: string): Promise<SheetGrid> {
  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: id,
      range: `${quotedTab(tab)}!A:Z`,
    });
    const values = (response.data.values ?? []).map((row) => row.map((cell) => cellText(cell)));
    if (values.length === 0) {
      return { fields: [...DEFAULT_HEADERS], labels: [...DEFAULT_HEADERS], rows: [], hasHeader: false };
    }

    const fields = values[0].map(fieldName);
    const hasHeader = fields.some((name) => name === "company_name" || name === "status" || name === "notes");
    if (!hasHeader) {
      return { fields: [...DEFAULT_HEADERS], labels: [...DEFAULT_HEADERS], rows: values, hasHeader: false };
    }

    return {
      fields,
      labels: values[0],
      rows: values.slice(1),
      hasHeader: true,
    };
  } catch (error) {
    if (error instanceof SheetSyncError) throw error;
    throw new SheetSyncError(googleMessage(error), googleStatus(error));
  }
}

function valueForHeader(header: string, lead: SheetLeadPayload) {
  switch (header) {
    case "id":
      return lead.id;
    case "customer_name":
      return lead.customer_name ?? "";
    case "job_title":
      return lead.job_title ?? "";
    case "company_name":
      return lead.company_name;
    case "status":
      return lead.status;
    case "notes":
      return lead.notes ?? "";
    case "phone":
      return lead.phone ?? "";
    case "alt_phone":
      return lead.alt_phone ?? "";
    case "company_email":
      return lead.company_email ?? "";
    case "alt_email":
      return lead.alt_email ?? "";
    case "sector":
      return lead.sector ?? "";
    case "address":
      return lead.address ?? "";
    case "website":
      return lead.website ?? "";
    case "updated_by":
      return lead.updated_by ?? "";
    case "updated_at":
      return lead.updated_at || new Date().toISOString();
    default:
      return "";
  }
}

function rowFromLead(headers: string[], lead: SheetLeadPayload) {
  return headers.map((header) => valueForHeader(header, lead));
}

function leadFromCells(fields: string[], cells: string[], rowNumber: number): SheetLead | null {
  const record = new Map<string, string>();
  fields.forEach((field, index) => {
    if (!field || record.has(field)) return;
    record.set(field, cells[index] ?? "");
  });

  const companyName = blankToNull(record.get("company_name"));
  if (!companyName) return null;

  return {
    id: blankToNull(record.get("id")),
    customer_name: blankToNull(record.get("customer_name")),
    job_title: blankToNull(record.get("job_title")),
    company_name: companyName,
    sector: blankToNull(record.get("sector")),
    address: blankToNull(record.get("address")),
    phone: blankToNull(record.get("phone")),
    alt_phone: blankToNull(record.get("alt_phone")),
    company_email: blankToNull(record.get("company_email")),
    alt_email: blankToNull(record.get("alt_email")),
    website: blankToNull(record.get("website")),
    status: parseStatus(record.get("status") ?? ""),
    notes: blankToNull(record.get("notes")),
    updated_by: blankToNull(record.get("updated_by")),
    updated_at: blankToNull(record.get("updated_at")),
    rowNumber,
  };
}

export async function readSheetLeads() {
  const { sheets, spreadsheetId: id } = await sheetsClient();
  const tab = await sheetTab(sheets, id);
  const grid = await asSheetError(() => readGrid(sheets, id, tab));
  const firstDataRow = grid.hasHeader ? 2 : 1;

  return grid.rows
    .map((cells, index) => leadFromCells(grid.fields, cells, firstDataRow + index))
    .filter((lead): lead is SheetLead => Boolean(lead));
}

function findRowIndex(grid: SheetGrid, lead: SheetLeadPayload) {
  const idIndex = grid.fields.indexOf("id");
  const companyIndex = grid.fields.indexOf("company_name");
  const wantedCompany = lead.company_name.trim().toLowerCase();

  return grid.rows.findIndex((row) => {
    const sameId = idIndex >= 0 && lead.id && row[idIndex] === lead.id;
    const sameCompany =
      companyIndex >= 0 && wantedCompany.length > 0 && (row[companyIndex] ?? "").trim().toLowerCase() === wantedCompany;
    return sameId || sameCompany;
  });
}

async function writeCells(
  sheets: sheets_v4.Sheets,
  id: string,
  data: sheets_v4.Schema$ValueRange[],
) {
  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId: id,
    requestBody: {
      valueInputOption: "USER_ENTERED",
      data,
    },
  });
}

export async function updateSheetLeadStatusAndNotes(lead: SheetLeadPayload) {
  const companyName = lead.company_name.trim();
  const status = lead.status.trim();
  if (!lead.id || !companyName || !status) {
    throw new SheetSyncError("A lead id, company name, and status are required.", 400);
  }

  const { sheets, spreadsheetId: id } = await sheetsClient();
  const tab = await sheetTab(sheets, id);
  const grid = await asSheetError(() => readGrid(sheets, id, tab));
  const prefix = quotedTab(tab);

  if (!grid.hasHeader && grid.rows.length === 0) {
    await asSheetError(() =>
      sheets.spreadsheets.values.update({
        spreadsheetId: id,
        range: `${prefix}!A1`,
        valueInputOption: "USER_ENTERED",
        requestBody: {
          values: [[...DEFAULT_HEADERS], rowFromLead([...DEFAULT_HEADERS], lead)],
        },
      }),
    );
    return { action: "appended" as const, row: 2 };
  }

  const fields = [...grid.fields];
  const labels = [...grid.labels];
  if (grid.hasHeader) {
    const missing = ["id", "company_name", "status", "notes", "updated_by", "updated_at"].filter(
      (name) => !fields.includes(name),
    );
    if (missing.length > 0) {
      fields.push(...missing);
      labels.push(...missing);
      await asSheetError(() =>
        sheets.spreadsheets.values.update({
          spreadsheetId: id,
          range: `${prefix}!A1`,
          valueInputOption: "USER_ENTERED",
          requestBody: { values: [labels] },
        }),
      );
    }
  }

  const matchIndex = findRowIndex({ ...grid, fields, labels }, lead);
  if (matchIndex >= 0) {
    const rowNumber = matchIndex + (grid.hasHeader ? 2 : 1);
    const columns = ["status", "notes", "updated_by", "updated_at"];
    const data: sheets_v4.Schema$ValueRange[] = columns
      .filter((name) => fields.includes(name))
      .map((name) => ({
        range: `${prefix}!${columnLetter(fields.indexOf(name))}${rowNumber}`,
        values: [[valueForHeader(name, lead)]],
      }));

    await asSheetError(() => writeCells(sheets, id, data));
    return { action: "updated" as const, row: rowNumber };
  }

  const values = rowFromLead(fields, lead);
  await asSheetError(() =>
    sheets.spreadsheets.values.append({
      spreadsheetId: id,
      range: `${prefix}!A:Z`,
      valueInputOption: "USER_ENTERED",
      insertDataOption: "INSERT_ROWS",
      requestBody: { values: [values] },
    }),
  );

  return { action: "appended" as const, row: (grid.hasHeader ? 2 : 1) + grid.rows.length };
}

async function findDatabaseLead(row: SheetLead) {
  const supabase = getSupabase();
  if (row.id && UUID_PATTERN.test(row.id)) {
    const { data, error } = await supabase.from("leads").select(LEAD_COLUMNS).eq("id", row.id).limit(1);
    if (error) throw new SheetSyncError(error.message, 500);
    if (data?.[0]) return data[0] as Lead;
  }

  const { data, error } = await supabase
    .from("leads")
    .select(LEAD_COLUMNS)
    .ilike("company_name", escapeIlike(row.company_name))
    .limit(1);
  if (error) throw new SheetSyncError(error.message, 500);
  return (data?.[0] as Lead | undefined) ?? null;
}

export async function syncSheetLeadsToDatabase() {
  const rows = await readSheetLeads();
  const supabase = getSupabase();
  let updated = 0;
  let inserted = 0;
  let unchanged = 0;
  let skipped = 0;

  for (const row of rows) {
    const existing = await findDatabaseLead(row);
    if (!existing) {
      if (!row.phone) {
        skipped += 1;
        continue;
      }

      const { error } = await supabase.from("leads").insert({
        customer_name: row.customer_name,
        job_title: row.job_title,
        company_name: row.company_name,
        sector: row.sector,
        address: row.address,
        phone: row.phone,
        alt_phone: row.alt_phone,
        company_email: row.company_email,
        alt_email: row.alt_email,
        website: row.website,
        notes: row.notes ?? "",
        status: row.status ?? "pending",
        updated_by: row.updated_by,
        updated_at: row.updated_at ?? new Date().toISOString(),
      });
      if (error) throw new SheetSyncError(error.message, 500);
      inserted += 1;
      await logActivity({
        userName: "google-sheets",
        actionType: "SHEETS_SYNC",
        companyName: row.company_name,
        details: "Added the lead from Google Sheets.",
      });
      continue;
    }

    const patch: {
      status?: LeadStatus;
      notes?: string;
      updated_by?: string;
      updated_at?: string;
      customer_name?: string;
      job_title?: string;
      company_email?: string;
      alt_email?: string;
    } = {};
    if (row.status && row.status !== existing.status) patch.status = row.status;
    if (row.notes && row.notes !== (existing.notes ?? "")) patch.notes = row.notes;
    if (row.updated_by && row.updated_by !== existing.updated_by) patch.updated_by = row.updated_by;
    if (row.customer_name && row.customer_name !== existing.customer_name) patch.customer_name = row.customer_name;
    if (row.job_title && row.job_title !== existing.job_title) patch.job_title = row.job_title;
    if (row.company_email && row.company_email !== existing.company_email) patch.company_email = row.company_email;
    if (row.alt_email && row.alt_email !== existing.alt_email) patch.alt_email = row.alt_email;
    if (Object.keys(patch).length > 0 && row.updated_at && !Number.isNaN(Date.parse(row.updated_at))) {
      patch.updated_at = new Date(row.updated_at).toISOString();
    }
    if (Object.keys(patch).length === 0) {
      unchanged += 1;
      continue;
    }

    const { error } = await supabase.from("leads").update(patch).eq("id", existing.id);
    if (error) throw new SheetSyncError(error.message, 500);
    updated += 1;
    await logActivity({
      userName: "google-sheets",
      actionType: "SHEETS_SYNC",
      companyName: existing.company_name,
      details: [
        patch.status ? `Status set to ${patch.status}.` : null,
        patch.notes !== undefined ? "Notes updated from Google Sheets." : null,
        patch.updated_by ? `Updated by ${patch.updated_by}.` : null,
      ]
        .filter(Boolean)
        .join(" "),
    });
  }

  return { updated, inserted, unchanged, skipped };
}
