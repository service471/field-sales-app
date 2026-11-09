import { escapeIlike } from "@/lib/format";
import { getSupabase } from "@/lib/supabase";
import type { AppUser, UserRole } from "@/lib/types";

const USER_COLUMNS = "id, name, role";

function isUserRole(value: string): value is UserRole {
  return value === "admin" || value === "sales";
}

export async function findUserByName(name: string) {
  const trimmed = name.trim();
  if (!trimmed) return null;

  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("users")
    .select(USER_COLUMNS)
    .ilike("name", escapeIlike(trimmed))
    .limit(1);

  if (error) {
    throw new Error(error.message);
  }

  const row = data?.[0] as AppUser | undefined;
  if (!row || !isUserRole(row.role)) return null;
  return row;
}

export async function fetchUsers() {
  const supabase = getSupabase();
  const { data, error } = await supabase.from("users").select(USER_COLUMNS).order("name");

  if (error) {
    throw new Error(error.message);
  }

  const users = ((data ?? []) as AppUser[]).filter((user) => isUserRole(user.role));
  return users.sort((left, right) => {
    if (left.role !== right.role) return left.role === "admin" ? -1 : 1;
    return left.name.localeCompare(right.name);
  });
}

export async function createUser(name: string, role: UserRole) {
  const trimmed = name.trim();
  if (!/^[A-Za-z0-9._-]{2,40}$/.test(trimmed)) {
    throw new Error("Use 2 to 40 letters, numbers, dots, underscores, or hyphens.");
  }

  const existing = await findUserByName(trimmed);
  if (existing) {
    throw new Error("That username is already taken.");
  }

  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("users")
    .insert({ name: trimmed, role })
    .select(USER_COLUMNS)
    .single();

  if (error) {
    if (/duplicate|unique/i.test(error.message)) {
      throw new Error("That username is already taken.");
    }
    throw new Error(error.message);
  }

  return data as AppUser;
}

export async function updateUser(id: string, name: string, role: UserRole) {
  const trimmed = name.trim();
  if (!/^[A-Za-z0-9._-]{2,40}$/.test(trimmed)) {
    throw new Error("Use 2 to 40 letters, numbers, dots, underscores, or hyphens.");
  }

  const users = await fetchUsers();
  const target = users.find((user) => user.id === id);
  if (!target) {
    throw new Error("That user is no longer on the team.");
  }

  const taken = await findUserByName(trimmed);
  if (taken && taken.id !== id) {
    throw new Error("That username is already taken.");
  }

  const adminCount = users.filter((user) => user.role === "admin").length;
  if (target.role === "admin" && role !== "admin" && adminCount < 2) {
    throw new Error("Keep at least one admin.");
  }

  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("users")
    .update({ name: trimmed, role })
    .eq("id", id)
    .select(USER_COLUMNS)
    .single();

  if (error) {
    if (/duplicate|unique/i.test(error.message)) {
      throw new Error("That username is already taken.");
    }
    if (/coerce the result|0 rows|PGRST116/i.test(error.message)) {
      throw new Error("The database blocked this user update. Run supabase/schema.sql in the SQL editor, then try again.");
    }
    throw new Error(error.message);
  }

  return data as AppUser;
}

export async function removeUser(id: string) {
  const users = await fetchUsers();
  const target = users.find((user) => user.id === id);
  if (!target) {
    throw new Error("That user is no longer on the team.");
  }

  const adminCount = users.filter((user) => user.role === "admin").length;
  if (target.role === "admin" && adminCount < 2) {
    throw new Error("Keep at least one admin.");
  }

  const supabase = getSupabase();
  const { error } = await supabase.from("users").delete().eq("id", id);

  if (error) {
    throw new Error(error.message);
  }

  return target;
}
