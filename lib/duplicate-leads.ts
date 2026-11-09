import { getSupabase } from "@/lib/supabase";

export type LeadCandidate = {
  id: string;
  company_name: string;
  customer_name: string | null;
  phone: string;
  alt_phone: string | null;
  status: string;
  sector: string | null;
  address: string | null;
};

export type DuplicateMatch = LeadCandidate & {
  exact: boolean;
  matchedOn: "name" | "phone" | "both";
  score: number;
};

const CANDIDATE_COLUMNS =
  "id, company_name, customer_name, phone, alt_phone, status, sector, address";

function normalizeName(value: string) {
  return value
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function phoneKey(value: string) {
  const digits = value.replace(/\D/g, "");
  if (digits.length >= 10) return digits.slice(-10);
  return digits;
}

function levenshtein(left: string, right: string) {
  const rows = Array.from({ length: left.length + 1 }, (_, index) => [index]);
  const first = rows[0];
  for (let column = 1; column <= right.length; column += 1) first[column] = column;

  for (let row = 1; row <= left.length; row += 1) {
    for (let column = 1; column <= right.length; column += 1) {
      const cost = left[row - 1] === right[column - 1] ? 0 : 1;
      rows[row][column] = Math.min(
        rows[row - 1][column] + 1,
        rows[row][column - 1] + 1,
        rows[row - 1][column - 1] + cost,
      );
    }
  }

  return rows[left.length][right.length];
}

function nameScore(typed: string, existing: string) {
  if (typed.length < 3 || existing.length < 3) return 0;
  if (typed === existing) return 1;
  const shorter = Math.min(typed.length, existing.length);
  const longer = Math.max(typed.length, existing.length);
  if (shorter >= 6 && (existing.includes(typed) || typed.includes(existing))) {
    return 0.9;
  }
  if (typed.length < 5 || existing.length < 5) return 0;
  const ratio = 1 - levenshtein(typed, existing) / longer;
  return ratio >= 0.84 ? ratio : 0;
}

function phonesMatch(typedPhone: string, candidate: LeadCandidate) {
  const typed = phoneKey(typedPhone);
  if (typed.length < 7) return false;
  return [candidate.phone, candidate.alt_phone ?? ""].some((value) => phoneKey(value) === typed);
}

export function rankDuplicateLeads(
  candidates: LeadCandidate[],
  companyName: string,
  phone: string,
  exceptId?: string,
) {
  const typedName = normalizeName(companyName);
  const matches: DuplicateMatch[] = [];

  for (const candidate of candidates) {
    if (exceptId && candidate.id === exceptId) continue;
    const byName = nameScore(typedName, normalizeName(candidate.company_name));
    const byPhone = phonesMatch(phone, candidate);
    if (byName <= 0 && !byPhone) continue;

    const exactName = byName === 1;
    const matchedOn = exactName && byPhone ? "both" : byPhone && byName <= 0 ? "phone" : byPhone ? "both" : "name";
    matches.push({
      ...candidate,
      exact: exactName || byPhone,
      matchedOn,
      score: byPhone ? Math.max(byName, 1) : byName,
    });
  }

  return matches.sort((left, right) => right.score - left.score || left.company_name.localeCompare(right.company_name));
}

export async function fetchLeadCandidates() {
  const supabase = getSupabase();
  const { data, error } = await supabase.from("leads").select(CANDIDATE_COLUMNS).limit(1000);

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as LeadCandidate[];
}

export async function findExactDuplicateLead(companyName: string, phone: string, exceptId?: string) {
  const candidates = await fetchLeadCandidates();
  return (
    rankDuplicateLeads(candidates, companyName, phone, exceptId).find((match) => match.exact) ?? null
  );
}

export function duplicateLeadMessage(match: Pick<DuplicateMatch, "matchedOn">) {
  if (match.matchedOn === "phone") return "A company with this phone already exists.";
  if (match.matchedOn === "name") return "A company with this name already exists.";
  return "A company with this name and phone already exists.";
}
