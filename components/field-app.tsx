"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { AddLeadSheet } from "@/components/add-lead-sheet";
import { AdminView } from "@/components/admin-view";
import { ArchiveView } from "@/components/archive-view";
import { LoginScreen } from "@/components/login-screen";
import { QueueView } from "@/components/queue-view";
import { useSession } from "@/hooks/use-session";
import { recordLeadAction } from "@/lib/record-action";
import { hasSupabaseEnv } from "@/lib/supabase";
import type { AppUser, Lead } from "@/lib/types";

type FieldAppProps = {
  view: "queue" | "archive" | "admin";
};

const NAV = [
  { href: "/", label: "Queue", view: "queue" },
  { href: "/archive", label: "Archive", view: "archive" },
  { href: "/admin", label: "Dashboard", view: "admin" },
] as const;

function LoadingShell() {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-lg flex-col px-4 py-6">
      <div className="h-8 w-28 animate-pulse rounded-full bg-line" />
      <div className="mt-4 h-12 w-2/3 animate-pulse rounded-2xl bg-line" />
      <div className="mt-8 h-64 animate-pulse rounded-[28px] bg-card" />
    </div>
  );
}

export function FieldApp({ view }: FieldAppProps) {
  const router = useRouter();
  const { user, ready, login, logout } = useSession();
  const [addOpen, setAddOpen] = useState(false);
  const [addSession, setAddSession] = useState(0);
  const [refreshKey, setRefreshKey] = useState(0);
  const [toast, setToast] = useState<string | null>(null);
  const [queueCount, setQueueCount] = useState<number | null>(null);
  const configured = hasSupabaseEnv();

  const onToast = useCallback((message: string) => {
    setToast(message);
    window.setTimeout(() => {
      setToast((current) => (current === message ? null : current));
    }, 2800);
  }, []);

  const onQueueCount = useCallback((count: number) => {
    setQueueCount(count);
  }, []);

  useEffect(() => {
    if (ready && user && view === "admin" && user.role !== "admin") {
      router.replace("/");
    }
  }, [ready, router, user, view]);

  function openAdd() {
    setAddSession((value) => value + 1);
    setAddOpen(true);
  }

  function handleLogin(next: AppUser) {
    login(next);
    router.push(next.role === "admin" ? "/admin" : "/");
  }

  function handleLogout() {
    logout();
    setQueueCount(null);
    router.push("/");
  }

  async function handleCreated(lead: Lead) {
    setAddOpen(false);
    setRefreshKey((value) => value + 1);
    if (!user) {
      onToast(`${lead.company_name} added to the queue.`);
      return;
    }

    const logError = await recordLeadAction({
      userName: user.name,
      actionType: "CREATED_LEAD",
      lead,
      details: "Added a new lead to the queue.",
    });
    onToast(
      logError
        ? `${lead.company_name} added to the queue. The activity log was not updated.`
        : `${lead.company_name} added to the queue.`,
    );
  }

  if (!configured) {
    return (
      <div className="mx-auto flex min-h-dvh w-full max-w-lg flex-col justify-center px-4">
        <section className="rounded-[28px] border border-line bg-card p-5">
          <h2 className="font-serif text-3xl tracking-tight text-ink">Connect Supabase</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to .env.local, then restart the dev server.
          </p>
        </section>
      </div>
    );
  }

  if (!ready) return <LoadingShell />;
  if (!user) return <LoginScreen onSuccess={handleLogin} />;
  if (view === "admin" && user.role !== "admin") return <LoadingShell />;

  const links = NAV.filter((item) => item.view !== "admin" || user.role === "admin");
  const title =
    view === "queue" ? "Today's route" : view === "archive" ? "Visited leads" : "Admin dashboard";
  const wide = view === "admin";

  return (
    <div className={`mx-auto flex min-h-dvh w-full flex-col ${wide ? "max-w-6xl" : "max-w-lg"}`}>
      <header className="sticky top-0 z-20 border-b border-line/70 bg-paper/90 px-4 backdrop-blur pt-[max(0.85rem,env(safe-area-inset-top))]">
        <div className="flex items-start justify-between gap-3 pb-3">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted">Field Sales</p>
            <h1 className="font-serif text-[1.85rem] leading-none tracking-tight text-ink">{title}</h1>
            <p className="mt-1 text-sm text-muted">
              <span className="font-medium text-ink">{user.name}</span>
              <span className="mx-1.5">·</span>
              {user.role}
              {view === "queue" && queueCount ? (
                <span>
                  <span className="mx-1.5">·</span>
                  {queueCount === 1 ? "1 company left" : `${queueCount} companies left`}
                </span>
              ) : null}
            </p>
            <button
              type="button"
              onClick={handleLogout}
              className="mt-1 text-sm font-semibold text-pine"
            >
              Sign out
            </button>
          </div>
          <button
            type="button"
            onClick={openAdd}
            className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-ink text-paper shadow-lg"
            aria-label="Add a company"
          >
            <Plus className="h-7 w-7" />
          </button>
        </div>
        <nav
          className={`mb-3 grid gap-1 rounded-full bg-stamp p-1 ${
            links.length === 3 ? "grid-cols-3" : "grid-cols-2"
          }`}
          aria-label="Primary"
        >
          {links.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`rounded-full px-3 py-2 text-center text-sm font-semibold ${
                view === item.view ? "bg-ink text-paper" : "text-muted"
              }`}
              aria-current={view === item.view ? "page" : undefined}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </header>

      <main className="flex flex-1 flex-col px-4 py-4">
        {view === "queue" ? (
          <QueueView
            refreshKey={refreshKey}
            userName={user.name}
            onAdd={openAdd}
            onToast={onToast}
            onQueueCount={onQueueCount}
          />
        ) : view === "archive" ? (
          <ArchiveView
            refreshKey={refreshKey}
            userName={user.name}
            canDelete={user.role === "admin"}
            onToast={onToast}
          />
        ) : (
          <AdminView currentUser={user} onToast={onToast} onCurrentUserChange={login} />
        )}
      </main>

      <AddLeadSheet
        key={addSession}
        open={addOpen}
        userName={user.name}
        onClose={() => setAddOpen(false)}
        onCreated={handleCreated}
      />

      {toast ? (
        <div
          role="status"
          className={`fixed inset-x-4 top-[max(5.5rem,env(safe-area-inset-top))] z-40 mx-auto rounded-2xl bg-ink px-4 py-3 text-sm text-paper shadow-xl ${
            wide ? "max-w-6xl" : "max-w-lg"
          }`}
        >
          {toast}
        </div>
      ) : null}
    </div>
  );
}
