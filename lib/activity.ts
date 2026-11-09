import { getSupabase } from "@/lib/supabase";
import type { ActivityAction, ActivityLog } from "@/lib/types";

const LOG_COLUMNS = "id, user_name, action_type, company_name, details, created_at";
const LOG_LIMIT = 300;

export async function logActivity(entry: {
  userName: string;
  actionType: ActivityAction;
  companyName?: string | null;
  details?: string | null;
}) {
  try {
    const supabase = getSupabase();
    const { error } = await supabase.from("activity_logs").insert({
      user_name: entry.userName,
      action_type: entry.actionType,
      company_name: entry.companyName?.trim() || null,
      details: entry.details?.trim() || null,
    });

    if (error) return error.message;
    return null;
  } catch (error) {
    return error instanceof Error ? error.message : "Could not write the activity log.";
  }
}

const FILTERED_LOG_LIMIT = 5000;

export async function fetchActivityLogs(range?: { from?: string; to?: string }) {
  const supabase = getSupabase();
  const filtered = Boolean(range?.from || range?.to);
  let query = supabase
    .from("activity_logs")
    .select(LOG_COLUMNS, { count: "exact" })
    .order("created_at", { ascending: false });

  if (range?.from) query = query.gte("created_at", range.from);
  if (range?.to) query = query.lt("created_at", range.to);

  const { data, error, count } = await query.limit(filtered ? FILTERED_LOG_LIMIT : LOG_LIMIT);

  if (error) {
    throw new Error(error.message);
  }

  return {
    logs: (data ?? []) as ActivityLog[],
    total: count ?? 0,
  };
}
