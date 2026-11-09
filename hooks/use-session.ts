"use client";

import { useCallback, useEffect, useState } from "react";
import type { AppUser, UserRole } from "@/lib/types";

const SESSION_KEY = "field-sales-user";

function isRole(value: unknown): value is UserRole {
  return value === "admin" || value === "sales";
}

function readSession(): AppUser | null {
  try {
    const raw = window.localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<AppUser>;
    if (!parsed.id || !parsed.name || !isRole(parsed.role)) return null;
    return { id: parsed.id, name: parsed.name, role: parsed.role };
  } catch {
    return null;
  }
}

function writeSession(user: AppUser) {
  window.localStorage.setItem(SESSION_KEY, JSON.stringify(user));
}

function clearSession() {
  window.localStorage.removeItem(SESSION_KEY);
}

export function useSession() {
  const [user, setUser] = useState<AppUser | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setUser(readSession());
    setReady(true);
  }, []);

  const login = useCallback((next: AppUser) => {
    writeSession(next);
    setUser(next);
  }, []);

  const logout = useCallback(() => {
    clearSession();
    setUser(null);
  }, []);

  return { user, ready, login, logout };
}
