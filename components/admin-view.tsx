"use client";

import { useEffect, useState } from "react";
import { DatabaseSetup } from "@/components/database-setup";
import { LeadTable } from "@/components/lead-table";
import { fetchActivityLogs, logActivity } from "@/lib/activity";
import { formatActionType, formatDateTime, isMissingTableError, isPermissionError } from "@/lib/format";
import { fetchAllLeads } from "@/lib/leads";
import { recordLeadAction } from "@/lib/record-action";
import type { ActivityLog, AppUser, Lead, UserRole } from "@/lib/types";
import { createUser, fetchUsers, removeUser, updateUser } from "@/lib/users";

function startOfLocalDay(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day, 0, 0, 0, 0).toISOString();
}

function startOfNextLocalDay(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day + 1, 0, 0, 0, 0).toISOString();
}

function periodLabel(fromDate: string, toDate: string) {
  if (fromDate && toDate && fromDate === toDate) return "on this date";
  if (fromDate && toDate) return "in this period";
  if (fromDate) return "from this date";
  return "through this date";
}

type AdminViewProps = {
  currentUser: AppUser;
  onToast: (message: string) => void;
  onCurrentUserChange: (user: AppUser) => void;
};

type AdminTab = "users" | "leads" | "log";
type SetupKind = "permission" | "missing-table" | null;

export function AdminView({ currentUser, onToast, onCurrentUserChange }: AdminViewProps) {
  const [tab, setTab] = useState<AdminTab>("leads");
  const [users, setUsers] = useState<AppUser[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [logTotal, setLogTotal] = useState(0);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [loadingLeads, setLoadingLeads] = useState(true);
  const [loadingLogs, setLoadingLogs] = useState(true);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [logVersion, setLogVersion] = useState(0);
  const [setup, setSetup] = useState<SetupKind>(null);
  const [error, setError] = useState<string | null>(null);
  const [username, setUsername] = useState("");
  const [role, setRole] = useState<UserRole>("sales");
  const [saving, setSaving] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editRole, setEditRole] = useState<UserRole>("sales");
  const [savingEdit, setSavingEdit] = useState(false);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadUsers() {
      setLoadingUsers(true);
      try {
        const rows = await fetchUsers();
        if (cancelled) return;
        setUsers(rows);
        setSetup(null);
      } catch (caught) {
        if (cancelled) return;
        const message = caught instanceof Error ? caught.message : "Could not load users.";
        setError(message);
        if (isMissingTableError(message)) setSetup("missing-table");
        if (isPermissionError(message)) setSetup("permission");
      } finally {
        if (!cancelled) setLoadingUsers(false);
      }
    }

    void loadUsers();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadLeads() {
      setLoadingLeads(true);
      try {
        const rows = await fetchAllLeads();
        if (cancelled) return;
        setLeads(rows);
      } catch (caught) {
        if (cancelled) return;
        const message = caught instanceof Error ? caught.message : "Could not load leads.";
        setError(message);
        if (isMissingTableError(message)) setSetup("missing-table");
        if (isPermissionError(message)) setSetup("permission");
      } finally {
        if (!cancelled) setLoadingLeads(false);
      }
    }

    void loadLeads();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const rangeInvalid = Boolean(fromDate && toDate && fromDate > toDate);

    async function loadLogs() {
      if (rangeInvalid) {
        setLogs([]);
        setLogTotal(0);
        setLoadingLogs(false);
        return;
      }

      setLoadingLogs(true);
      try {
        const result = await fetchActivityLogs({
          from: fromDate ? startOfLocalDay(fromDate) : undefined,
          to: toDate ? startOfNextLocalDay(toDate) : undefined,
        });
        if (cancelled) return;
        setLogs(result.logs);
        setLogTotal(result.total);
      } catch (caught) {
        if (cancelled) return;
        const message = caught instanceof Error ? caught.message : "Could not load the activity log.";
        setError(message);
        if (isMissingTableError(message)) setSetup("missing-table");
        if (isPermissionError(message)) setSetup("permission");
      } finally {
        if (!cancelled) setLoadingLogs(false);
      }
    }

    void loadLogs();
    return () => {
      cancelled = true;
    };
  }, [fromDate, toDate, logVersion]);

  async function addUser() {
    setSaving(true);
    setError(null);
    try {
      const created = await createUser(username, role);
      setUsers((current) =>
        [...current, created].sort((left, right) => {
          if (left.role !== right.role) return left.role === "admin" ? -1 : 1;
          return left.name.localeCompare(right.name);
        }),
      );
      setUsername("");
      setRole("sales");
      const logError = await logActivity({
        userName: currentUser.name,
        actionType: "ADDED_USER",
        details: `Added ${created.role} user ${created.name}.`,
      });
      setLogVersion((value) => value + 1);
      onToast(
        logError
          ? `${created.name} was added. The activity log was not updated.`
          : `${created.name} was added.`,
      );
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Could not add that user.";
      if (isMissingTableError(message)) setSetup("missing-table");
      else if (isPermissionError(message)) setSetup("permission");
      setError(message);
    } finally {
      setSaving(false);
    }
  }

  function beginEdit(user: AppUser) {
    setEditingUserId(user.id);
    setEditName(user.name);
    setEditRole(user.role);
    setConfirmId(null);
    setError(null);
  }

  async function saveUserEdit(user: AppUser) {
    setSavingEdit(true);
    setError(null);
    try {
      const updated = await updateUser(user.id, editName, editRole);
      setUsers((current) =>
        current
          .map((item) => (item.id === updated.id ? updated : item))
          .sort((left, right) => {
            if (left.role !== right.role) return left.role === "admin" ? -1 : 1;
            return left.name.localeCompare(right.name);
          }),
      );
      setEditingUserId(null);
      if (updated.id === currentUser.id) onCurrentUserChange(updated);
      const logError = await logActivity({
        userName: currentUser.name,
        actionType: "UPDATED_USER",
        details: `Changed ${user.name} (${user.role}) to ${updated.name} (${updated.role}).`,
      });
      setLogVersion((value) => value + 1);
      onToast(
        logError
          ? `${updated.name} was updated. The activity log was not updated.`
          : `${updated.name} was updated.`,
      );
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Could not update that user.";
      if (isMissingTableError(message)) setSetup("missing-table");
      else if (isPermissionError(message)) setSetup("permission");
      setError(message);
    } finally {
      setSavingEdit(false);
    }
  }

  async function handleLeadChange(lead: Lead) {
    setLeads((current) => current.map((item) => (item.id === lead.id ? lead : item)));
    const logError = await recordLeadAction({
      userName: currentUser.name,
      actionType: "UPDATED_LEAD",
      lead,
      details: "Updated the lead record.",
    });
    onToast(
      logError
        ? `${lead.company_name} was updated. The activity log was not updated.`
        : `${lead.company_name} was updated.`,
    );
    setLogVersion((value) => value + 1);
  }

  async function handleLeadDelete(lead: Lead) {
    setLeads((current) => current.filter((item) => item.id !== lead.id));
    const logError = await recordLeadAction({
      userName: currentUser.name,
      actionType: "DELETED_LEAD",
      lead,
      status: "deleted",
      details: "Deleted the lead.",
    });
    onToast(
      logError
        ? `${lead.company_name} was deleted. The activity log was not updated.`
        : `${lead.company_name} was deleted.`,
    );
    setLogVersion((value) => value + 1);
  }

  async function confirmRemove(user: AppUser) {
    setRemovingId(user.id);
    setError(null);
    try {
      const removed = await removeUser(user.id);
      setUsers((current) => current.filter((item) => item.id !== user.id));
      setConfirmId(null);
      const logError = await logActivity({
        userName: currentUser.name,
        actionType: "REMOVED_USER",
        details: `Removed ${removed.role} user ${removed.name}.`,
      });
      setLogVersion((value) => value + 1);
      onToast(
        logError
          ? `${removed.name} was removed. The activity log was not updated.`
          : `${removed.name} was removed.`,
      );
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Could not remove that user.";
      if (isPermissionError(message)) setSetup("permission");
      setError(message);
    } finally {
      setRemovingId(null);
    }
  }

  async function pullSheet() {
    setSyncing(true);
    setError(null);
    try {
      const response = await fetch("/api/sync-sheets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ direction: "from_sheet" }),
      });
      const body = (await response.json()) as { error?: string; detail?: string };
      if (!response.ok) {
        onToast(body.error || "Could not read Google Sheets.");
        return;
      }
      setLogVersion((value) => value + 1);
      try {
        setLeads(await fetchAllLeads());
      } catch {
        onToast("Google Sheets sync finished, but the lead table could not refresh.");
        return;
      }
      onToast(body.detail || "Google Sheets sync finished.");
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Could not read Google Sheets.";
      onToast(message);
    } finally {
      setSyncing(false);
    }
  }

  return (
    <div className="space-y-4 pb-8">
      <section className="rounded-[28px] border border-line bg-card p-4">
        <h2 className="font-serif text-2xl tracking-tight text-ink">Google Sheets</h2>
        <p className="mt-1 text-sm leading-relaxed text-muted">
          Status and notes save to the sheet when a lead changes. Pull the latest rows from Google here.
        </p>
        <button
          type="button"
          onClick={() => void pullSheet()}
          disabled={syncing}
          className="mt-3 w-full rounded-2xl bg-ink px-4 py-3 text-sm font-semibold text-paper disabled:opacity-60"
        >
          {syncing ? "Syncing..." : "Sync from Google Sheets"}
        </button>
      </section>

      <div className="grid grid-cols-3 gap-1 rounded-full bg-stamp p-1" role="tablist" aria-label="Admin dashboard">
        {(
          [
            ["users", "Users"],
            ["leads", "Leads"],
            ["log", "Activity"],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={tab === value}
            onClick={() => setTab(value)}
            className={`rounded-full px-3 py-2 text-sm font-semibold ${
              tab === value ? "bg-ink text-paper" : "text-muted"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {setup ? <DatabaseSetup kind={setup} detail={error ?? undefined} /> : null}
      {error && !setup ? (
        <p className="rounded-2xl bg-clay-soft px-3 py-2 text-sm text-clay" role="alert">
          {error}
        </p>
      ) : null}

      {tab === "leads" ? (
        loadingLeads ? (
          <div className="h-64 animate-pulse rounded-[28px] bg-card" />
        ) : error && leads.length === 0 ? null : (
          <LeadTable
            leads={leads}
            userName={currentUser.name}
            canDelete
            onLeadChange={(lead) => void handleLeadChange(lead)}
            onLeadDelete={(lead) => void handleLeadDelete(lead)}
            onToast={onToast}
          />
        )
      ) : tab === "users" ? (
        <section className="space-y-4">
          <form
            className="rounded-[28px] border border-line bg-card p-4"
            onSubmit={(event) => {
              event.preventDefault();
              void addUser();
            }}
          >
            <h2 className="font-serif text-3xl tracking-tight text-ink">User management</h2>
            <p className="mt-1 text-sm text-muted">
              Add a teammate, change a username or role, or remove someone. Sales users cannot delete leads.
            </p>
            <h3 className="mt-4 font-serif text-2xl tracking-tight text-ink">Add a user</h3>
            <label className="mt-4 block">
              <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">
                Username
              </span>
              <input
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                placeholder="ahmet54"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                autoComplete="off"
                className="w-full rounded-2xl border border-line bg-white px-4 py-3 text-base text-ink outline-none placeholder:text-muted/70 focus:border-pine"
              />
            </label>
            <div className="mt-3" role="group" aria-label="Role">
              <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">
                Role
              </span>
              <div className="grid grid-cols-2 gap-2">
                {(
                  [
                    ["sales", "Sales"],
                    ["admin", "Admin"],
                  ] as const
                ).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={role === value}
                    onClick={() => setRole(value)}
                    className={`rounded-2xl px-3 py-3 text-sm font-semibold ${
                      role === value ? "bg-ink text-paper" : "border border-line bg-white text-ink"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <button
              type="submit"
              disabled={saving || username.trim().length === 0}
              className="mt-4 w-full rounded-2xl bg-pine px-4 py-3.5 text-base font-semibold text-white disabled:opacity-60"
            >
              {saving ? "Adding..." : "Add user"}
            </button>
          </form>

          {loadingUsers ? (
            <div className="h-28 animate-pulse rounded-[28px] bg-card" />
          ) : (
            <ul className="space-y-3">
              {users.map((user) => {
                const isSelf = user.id === currentUser.id;
                const confirming = confirmId === user.id;
                const editing = editingUserId === user.id;
                return (
                  <li key={user.id} className="rounded-[28px] border border-line bg-card p-4">
                    {editing ? (
                      <form
                        onSubmit={(event) => {
                          event.preventDefault();
                          void saveUserEdit(user);
                        }}
                      >
                        <h3 className="font-serif text-2xl tracking-tight text-ink">Edit user</h3>
                        <label className="mt-3 block">
                          <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">
                            Username
                          </span>
                          <input
                            value={editName}
                            onChange={(event) => setEditName(event.target.value)}
                            placeholder="ahmet54"
                            autoCapitalize="none"
                            autoCorrect="off"
                            spellCheck={false}
                            autoComplete="off"
                            className="w-full rounded-2xl border border-line bg-white px-4 py-3 text-base text-ink outline-none placeholder:text-muted/70 focus:border-pine"
                          />
                        </label>
                        <div className="mt-3" role="group" aria-label="Role">
                          <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">
                            Role
                          </span>
                          <div className="grid grid-cols-2 gap-2">
                            {(
                              [
                                ["sales", "Sales"],
                                ["admin", "Admin"],
                              ] as const
                            ).map(([value, label]) => (
                              <button
                                key={value}
                                type="button"
                                aria-pressed={editRole === value}
                                onClick={() => setEditRole(value)}
                                className={`rounded-2xl px-3 py-3 text-sm font-semibold ${
                                  editRole === value ? "bg-ink text-paper" : "border border-line bg-white text-ink"
                                }`}
                              >
                                {label}
                              </button>
                            ))}
                          </div>
                        </div>
                        <div className="mt-3 grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={() => setEditingUserId(null)}
                            disabled={savingEdit}
                            className="rounded-2xl border border-line px-3 py-3 text-sm font-semibold text-ink disabled:opacity-60"
                          >
                            Cancel
                          </button>
                          <button
                            type="submit"
                            disabled={savingEdit || editName.trim().length === 0}
                            className="rounded-2xl bg-pine px-3 py-3 text-sm font-semibold text-white disabled:opacity-60"
                          >
                            {savingEdit ? "Saving..." : "Save user"}
                          </button>
                        </div>
                      </form>
                    ) : (
                      <>
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <h3 className="font-serif text-2xl leading-none tracking-tight text-ink">{user.name}</h3>
                            <p className="mt-2 text-sm text-muted">
                              {isSelf ? "Signed in on this device" : "Team member"}
                            </p>
                          </div>
                          <span className="rounded-full bg-stamp px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-ink">
                            {user.role}
                          </span>
                        </div>
                        <div className="mt-3 flex items-center justify-between gap-3">
                          <button
                            type="button"
                            onClick={() => beginEdit(user)}
                            className="text-sm font-semibold text-pine"
                          >
                            Edit user
                          </button>
                          {isSelf ? null : confirming ? (
                            <div className="grid flex-1 grid-cols-2 gap-2">
                              <button
                                type="button"
                                onClick={() => setConfirmId(null)}
                                disabled={removingId === user.id}
                                className="rounded-2xl border border-line px-3 py-3 text-sm font-semibold text-ink disabled:opacity-60"
                              >
                                Cancel
                              </button>
                              <button
                                type="button"
                                onClick={() => void confirmRemove(user)}
                                disabled={removingId === user.id}
                                className="rounded-2xl bg-clay px-3 py-3 text-sm font-semibold text-white disabled:opacity-60"
                              >
                                {removingId === user.id ? "Removing..." : "Remove"}
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setConfirmId(user.id)}
                              className="text-sm font-semibold text-clay"
                            >
                              Remove user
                            </button>
                          )}
                        </div>
                      </>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      ) : (
        <section className="space-y-3">
          <div className="rounded-[28px] border border-line bg-card p-4">
            <h2 className="font-serif text-3xl tracking-tight text-ink">Activity log</h2>
            <p className="mt-1 text-sm text-muted">Newest actions first. Choose one date or a start and end date.</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">
                  From
                </span>
                <input
                  type="date"
                  value={fromDate}
                  onChange={(event) => setFromDate(event.target.value)}
                  className="w-full rounded-2xl border border-line bg-white px-4 py-3 text-base text-ink outline-none focus:border-pine"
                />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">
                  To
                </span>
                <input
                  type="date"
                  value={toDate}
                  onChange={(event) => setToDate(event.target.value)}
                  className="w-full rounded-2xl border border-line bg-white px-4 py-3 text-base text-ink outline-none focus:border-pine"
                />
              </label>
            </div>
            {fromDate || toDate ? (
              <button
                type="button"
                onClick={() => {
                  setFromDate("");
                  setToDate("");
                }}
                className="mt-3 text-sm font-semibold text-pine"
              >
                Clear dates
              </button>
            ) : null}
            {fromDate && toDate && fromDate > toDate ? (
              <p className="mt-3 text-sm text-clay" role="alert">
                The start date is after the end date.
              </p>
            ) : fromDate || toDate ? (
              <p className="mt-3 text-sm font-semibold text-ink">
                Total actions {periodLabel(fromDate, toDate)}: {logTotal}. Companies recorded:{" "}
                {
                  new Set(
                    logs
                      .map((entry) => entry.company_name?.trim().toLowerCase())
                      .filter((name): name is string => Boolean(name)),
                  ).size
                }
                .
              </p>
            ) : (
              <p className="mt-3 text-sm text-muted">
                {logTotal === 1 ? "1 action in the latest results." : `${logTotal} actions in the latest results.`}
              </p>
            )}
            {logTotal > logs.length ? (
              <p className="mt-2 text-xs text-muted">Showing the first {logs.length} actions of {logTotal}.</p>
            ) : null}
          </div>
          {loadingLogs ? (
            <div className="space-y-3">
              <div className="h-24 animate-pulse rounded-[28px] bg-card" />
              <div className="h-24 animate-pulse rounded-[28px] bg-card" />
            </div>
          ) : error || setup || (fromDate && toDate && fromDate > toDate) ? null : logs.length === 0 ? (
            <section className="rounded-[28px] border border-dashed border-line bg-card/70 px-5 py-8 text-center">
              <h2 className="font-serif text-3xl tracking-tight text-ink">
                {fromDate || toDate ? "No actions in this period." : "No activity yet."}
              </h2>
              <p className="mt-2 text-sm text-muted">
                {fromDate || toDate
                  ? "Choose another date to see visits, notes, and team changes."
                  : "Visits, notes, new leads, and team changes will show up here."}
              </p>
            </section>
          ) : (
            <ul className="space-y-3">
              {logs.map((entry) => {
                const when = formatDateTime(entry.created_at);
                const subject =
                  entry.company_name?.trim() ||
                  (entry.action_type === "ADDED_USER" ||
                  entry.action_type === "UPDATED_USER" ||
                  entry.action_type === "REMOVED_USER"
                    ? "Team"
                    : "No company");
                return (
                  <li key={entry.id}>
                    <article className="rounded-[28px] border border-line bg-card p-4">
                      <div className="flex items-start justify-between gap-3">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-clay">
                          {formatActionType(entry.action_type)}
                        </p>
                        {when ? <time className="text-xs text-muted">{when}</time> : null}
                      </div>
                      <h3 className="mt-2 font-serif text-2xl leading-none tracking-tight text-ink">{subject}</h3>
                      <p className="mt-2 text-sm text-muted">{entry.user_name}</p>
                      {entry.details?.trim() ? (
                        <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-ink">{entry.details}</p>
                      ) : null}
                    </article>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}
