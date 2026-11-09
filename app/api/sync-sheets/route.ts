import { NextResponse } from "next/server";
import {
  sheetsConfigured,
  SheetSyncError,
  syncSheetLeadsToDatabase,
  updateSheetLeadStatusAndNotes,
} from "@/lib/googleSheets";
import type { SheetLeadPayload } from "@/lib/types";

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readString(value: unknown) {
  return typeof value === "string" ? value : undefined;
}

function sheetError(error: unknown) {
  if (error instanceof SheetSyncError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  const message = error instanceof Error ? error.message : "Could not sync Google Sheets.";
  return NextResponse.json({ error: message }, { status: 500 });
}

function leadFromRecord(record: JsonRecord): SheetLeadPayload | null {
  const id = readString(record.id)?.trim() ?? "";
  const companyName = readString(record.company_name)?.trim() ?? "";
  const status = readString(record.status)?.trim() ?? "";
  if (!id || !companyName || !status) return null;

  return {
    id,
    company_name: companyName,
    status,
    notes: record.notes === null ? null : (readString(record.notes) ?? null),
    updated_by: readString(record.updated_by) ?? null,
    updated_at: readString(record.updated_at) ?? null,
    customer_name: readString(record.customer_name) ?? null,
    job_title: readString(record.job_title) ?? null,
    phone: readString(record.phone) ?? null,
    alt_phone: readString(record.alt_phone) ?? null,
    company_email: readString(record.company_email) ?? null,
    alt_email: readString(record.alt_email) ?? null,
    sector: readString(record.sector) ?? null,
    address: readString(record.address) ?? null,
    website: readString(record.website) ?? null,
  };
}

function pullSummary(result: { updated: number; inserted: number; unchanged: number; skipped: number }) {
  if (result.updated === 0 && result.inserted === 0) {
    return "Google Sheets already matches the CRM.";
  }
  const parts = [
    result.updated === 1 ? "Updated 1 lead" : `Updated ${result.updated} leads`,
    result.inserted === 1 ? "added 1 lead" : `added ${result.inserted} leads`,
  ];
  return `${parts.join(" and ")} from Google Sheets.`;
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    configured: sheetsConfigured(),
    directions: ["to_sheet", "from_sheet"],
  });
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Send a JSON body." }, { status: 400 });
  }

  if (!isRecord(body)) {
    return NextResponse.json({ error: "Send a JSON object." }, { status: 400 });
  }

  const direction = readString(body.direction);
  const inbound = direction === "from_sheet";

  if (!sheetsConfigured()) {
    return NextResponse.json({
      ok: true,
      synced: false,
      direction: inbound ? "from_sheet" : "to_sheet",
      detail: "Google Sheets is not configured.",
    });
  }

  if (inbound) {
    try {
      const result = await syncSheetLeadsToDatabase();
      return NextResponse.json({
        ok: true,
        synced: true,
        direction: "from_sheet",
        ...result,
        detail: pullSummary(result),
      });
    } catch (error) {
      return sheetError(error);
    }
  }

  const leadRecord = isRecord(body.lead) ? body.lead : body;
  const lead = leadFromRecord(leadRecord);
  if (!lead) {
    return NextResponse.json(
      { error: "A lead id, company name, and status are required." },
      { status: 400 },
    );
  }

  try {
    const result = await updateSheetLeadStatusAndNotes(lead);
    return NextResponse.json({
      ok: true,
      synced: true,
      direction: "to_sheet",
      ...result,
      detail:
        result.action === "updated"
          ? "Updated status, notes, and the last editor in Google Sheets."
          : "Added the lead to Google Sheets.",
    });
  } catch (error) {
    return sheetError(error);
  }
}
