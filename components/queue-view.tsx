"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { DatabaseSetup } from "@/components/database-setup";
import { EditLeadSheet } from "@/components/edit-lead-sheet";
import { LeadCard } from "@/components/lead-card";
import { NoteSheet } from "@/components/note-sheet";
import { appendVisitNote, isMissingTableError, isPermissionError } from "@/lib/format";
import {
  completeLeadWithNotes,
  fetchLeadCount,
  fetchPendingLeads,
  seedLeadsIfEmpty,
  updateLeadStatus,
} from "@/lib/leads";
import { recordLeadAction } from "@/lib/record-action";
import type { Lead } from "@/lib/types";

type QueueViewProps = {
  refreshKey: number;
  userName: string;
  onAdd: () => void;
  onToast: (message: string) => void;
  onQueueCount: (count: number) => void;
};

type SetupKind = "permission" | "missing-table" | null;

function wait(ms: number) {
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  return new Promise((resolve) => setTimeout(resolve, reduceMotion ? 0 : ms));
}

function mergeQueue(previous: Lead[], fresh: Lead[]) {
  if (previous.length === 0) return fresh;
  const freshIds = new Set(fresh.map((lead) => lead.id));
  const kept = previous.filter((lead) => freshIds.has(lead.id));
  const keptIds = new Set(kept.map((lead) => lead.id));
  const added = fresh.filter((lead) => !keptIds.has(lead.id));
  return [...kept, ...added];
}

export function QueueView({ refreshKey, userName, onAdd, onToast, onQueueCount }: QueueViewProps) {
  const [queue, setQueue] = useState<Lead[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [setup, setSetup] = useState<SetupKind>(null);
  const [busy, setBusy] = useState(false);
  const [motion, setMotion] = useState<"idle" | "left" | "right" | "shake">("idle");
  const [editing, setEditing] = useState<Lead | null>(null);
  const [noteLead, setNoteLead] = useState<Lead | null>(null);
  const [noteError, setNoteError] = useState<string | null>(null);
  const [seeding, setSeeding] = useState(false);
  const hasLoaded = useRef(false);

  const reportWriteError = useCallback((message: string) => {
    if (isMissingTableError(message)) {
      setSetup("missing-table");
    } else if (isPermissionError(message)) {
      setSetup("permission");
    }
    onToast(message);
  }, [onToast]);

  const reportLogError = useCallback((message: string | null) => {
    if (!message) return;
    if (isMissingTableError(message)) setSetup("missing-table");
    else if (isPermissionError(message)) setSetup("permission");
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!hasLoaded.current) setLoading(true);
      setLoadError(null);
      try {
        const [pending, count] = await Promise.all([fetchPendingLeads(), fetchLeadCount()]);
        if (cancelled) return;
        setQueue((current) => mergeQueue(current, pending));
        setTotalCount(count);
        setSetup(null);
        hasLoaded.current = true;
      } catch (error) {
        if (cancelled) return;
        const message = error instanceof Error ? error.message : "Could not load leads.";
        setLoadError(message);
        if (isMissingTableError(message)) setSetup("missing-table");
        if (isPermissionError(message)) setSetup("permission");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  useEffect(() => {
    if (!loading) onQueueCount(queue.length);
  }, [loading, onQueueCount, queue.length]);

  const current = queue[0];

  async function handleVisited() {
    if (!current || busy) return;
    const leaving = current;
    setBusy(true);
    setMotion("left");
    await wait(280);
    setQueue((items) => items.filter((item) => item.id !== leaving.id));
    setMotion("idle");
    try {
      const saved = await updateLeadStatus(leaving.id, "completed", userName);
      const logError = await recordLeadAction({
        userName,
        actionType: "VISITED",
        lead: saved,
        details: "Marked the visit complete.",
      });
      reportLogError(logError);
      onToast(
        logError
          ? `${leaving.company_name} marked as visited. The activity log was not updated.`
          : `${leaving.company_name} marked as visited.`,
      );
    } catch (error) {
      setQueue((items) => [leaving, ...items.filter((item) => item.id !== leaving.id)]);
      reportWriteError(error instanceof Error ? error.message : "Could not update this lead.");
    } finally {
      setBusy(false);
    }
  }

  async function handleSkip() {
    if (!current || busy) return;
    if (queue.length < 2) {
      setMotion("shake");
      onToast("This is the only company left in the queue.");
      await wait(420);
      setMotion("idle");
      return;
    }

    const leaving = current;
    setBusy(true);
    setMotion("right");
    await wait(280);
    setQueue((items) => {
      const rest = items.filter((item) => item.id !== leaving.id);
      return [...rest, leaving];
    });
    setMotion("idle");
    setBusy(false);
  }

  async function handleNoteSubmit(note: string) {
    if (!current || busy) return;
    const leaving = current;
    setBusy(true);
    setNoteError(null);
    try {
      const notes = appendVisitNote(leaving.notes, note);
      const saved = await completeLeadWithNotes(leaving.id, notes, userName);
      const logError = await recordLeadAction({
        userName,
        actionType: "ADDED_NOTE",
        lead: saved,
        details: note.trim(),
      });
      reportLogError(logError);
      setNoteLead(null);
      setMotion("left");
      await wait(280);
      setQueue((items) => items.filter((item) => item.id !== leaving.id));
      setMotion("idle");
      onToast(
        logError
          ? `${leaving.company_name} marked as visited. The activity log was not updated.`
          : `${leaving.company_name} marked as visited.`,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not save the visit note.";
      setNoteError(message);
      reportWriteError(message);
    } finally {
      setBusy(false);
    }
  }

  async function handleSeed() {
    setSeeding(true);
    setSetup(null);
    try {
      const payload = await seedLeadsIfEmpty();
      onToast(payload.message);
      const [pending, count] = await Promise.all([fetchPendingLeads(), fetchLeadCount()]);
      setQueue(pending);
      setTotalCount(count);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not seed the database.";
      if (isMissingTableError(message)) setSetup("missing-table");
      else if (isPermissionError(message)) setSetup("permission");
      else onToast(message);
    } finally {
      setSeeding(false);
    }
  }

  if (loading) {
    return (
      <div className="animate-pulse rounded-[28px] border border-line bg-card p-5">
        <div className="h-3 w-24 rounded-full bg-line" />
        <div className="mt-4 h-10 w-3/4 rounded-2xl bg-line" />
        <div className="mt-8 space-y-3">
          <div className="h-14 rounded-2xl bg-stamp" />
          <div className="h-14 rounded-2xl bg-stamp" />
          <div className="h-14 rounded-2xl bg-stamp" />
        </div>
      </div>
    );
  }

  if (loadError && !current) {
    return (
      <div className="space-y-4">
        {setup ? <DatabaseSetup kind={setup} detail={loadError} /> : null}
        {!setup ? (
          <section className="rounded-[28px] border border-line bg-card p-5">
            <h2 className="font-serif text-3xl tracking-tight text-ink">Could not load the route</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted">{loadError}</p>
          </section>
        ) : null}
      </div>
    );
  }

  if (!current) {
    return (
      <div className="space-y-4">
        <section className="rounded-[28px] border border-line bg-card px-5 py-8 text-center">
          <p className="text-4xl" aria-hidden>
            🎉
          </p>
          <h2 className="mt-3 font-serif text-4xl leading-none tracking-tight text-ink">
            All leads visited for today! 🎉
          </h2>
          <p className="mx-auto mt-3 max-w-xs text-sm leading-relaxed text-muted">
            {totalCount === 0
              ? "The queue is empty. Load the sample companies or add one of your own."
              : "Nice work. Review the archive or add another company to the route."}
          </p>
          <div className="mt-6 flex flex-col gap-2">
            {totalCount === 0 ? (
              <button
                type="button"
                onClick={handleSeed}
                disabled={seeding}
                className="rounded-2xl bg-pine px-4 py-3.5 text-base font-semibold text-white disabled:opacity-60"
              >
                {seeding ? "Loading sample leads..." : "Seed database"}
              </button>
            ) : (
              <Link
                href="/archive"
                className="rounded-2xl bg-ink px-4 py-3.5 text-base font-semibold text-paper"
              >
                Review archive
              </Link>
            )}
            <button
              type="button"
              onClick={onAdd}
              className="rounded-2xl border border-line bg-white px-4 py-3.5 text-base font-semibold text-ink"
            >
              Add a new lead
            </button>
          </div>
        </section>
        {setup ? <DatabaseSetup kind={setup} /> : null}
      </div>
    );
  }

  const exiting = motion === "left" || motion === "right";
  const motionClass =
    motion === "left"
      ? "-translate-x-[120%] -rotate-6 opacity-0"
      : motion === "right"
        ? "translate-x-[120%] rotate-6 opacity-0"
        : motion === "shake"
          ? "animate-shake"
          : "animate-card-in";

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="relative pt-3">
        {queue.length > 1 ? (
          <div
            aria-hidden
            className="absolute inset-x-4 top-0 h-10 rounded-t-[28px] border border-b-0 border-line bg-[#ebe4d6]"
          />
        ) : null}
        <div className={`relative ${exiting ? "transition duration-300 ease-out" : ""} ${motionClass}`}>
          <LeadCard key={current.id} lead={current} />
        </div>
      </div>

      {setup ? (
        <div className="mt-4">
          <DatabaseSetup kind={setup} />
        </div>
      ) : null}

      <div className="sticky bottom-0 z-10 -mx-4 mt-4 space-y-2 border-t border-line/80 bg-paper/95 px-4 py-3 backdrop-blur pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <button
          type="button"
          onClick={handleVisited}
          disabled={busy}
          className="w-full rounded-2xl bg-pine px-4 py-3.5 text-base font-semibold text-white disabled:opacity-60"
        >
          Complete / Visited
        </button>
        <button
          type="button"
          onClick={() => {
            setNoteError(null);
            setNoteLead(current);
          }}
          disabled={busy}
          className="w-full rounded-2xl bg-clay px-4 py-3.5 text-base font-semibold text-white disabled:opacity-60"
        >
          Add Note & Complete
        </button>
        <button
          type="button"
          onClick={() => setEditing(current)}
          disabled={busy}
          className="w-full rounded-2xl border border-line bg-white px-4 py-3 text-base font-semibold text-ink disabled:opacity-60"
        >
          Edit lead
        </button>
        <button
          type="button"
          onClick={handleSkip}
          disabled={busy}
          className="w-full rounded-2xl border border-line bg-white px-4 py-3 text-base font-semibold text-ink disabled:opacity-60"
        >
          Skip / Next
        </button>
      </div>

      <NoteSheet
        lead={noteLead}
        saving={busy && Boolean(noteLead)}
        error={noteError}
        onClose={() => {
          if (busy) return;
          setNoteLead(null);
          setNoteError(null);
        }}
        onSubmit={handleNoteSubmit}
      />
      <EditLeadSheet
        lead={editing}
        userName={userName}
        onClose={() => setEditing(null)}
        onSaved={(saved) => {
          setEditing(null);
          if (saved.status === "pending") {
            setQueue((items) => items.map((item) => (item.id === saved.id ? saved : item)));
          } else {
            setQueue((items) => items.filter((item) => item.id !== saved.id));
          }
          void recordLeadAction({
            userName,
            actionType: "UPDATED_LEAD",
            lead: saved,
            details: "Updated the lead record.",
          }).then((logError) => {
            onToast(
              logError
                ? `${saved.company_name} was updated. The activity log was not updated.`
                : `${saved.company_name} was updated.`,
            );
          });
        }}
      />
    </div>
  );
}
