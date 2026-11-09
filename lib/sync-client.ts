import type { SheetLeadPayload } from "@/lib/types";

// Best-effort push. The lead change is already stored in Supabase.
export function pushLeadChange(lead: SheetLeadPayload) {
  void fetch("/api/sync-sheets", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ direction: "to_sheet", lead }),
  }).catch(() => undefined);
}
