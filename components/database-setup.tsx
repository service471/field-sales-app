"use client";

import { useState } from "react";
import { SETUP_SQL } from "@/lib/setup-sql";

type DatabaseSetupProps = {
  kind: "permission" | "missing-table";
  detail?: string;
};

export function DatabaseSetup({ kind, detail }: DatabaseSetupProps) {
  const [copied, setCopied] = useState(false);

  async function copySql() {
    try {
      await navigator.clipboard.writeText(SETUP_SQL);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  const title =
    kind === "missing-table"
      ? "The database is not ready"
      : "Supabase is blocking writes";

  const body =
    kind === "missing-table"
      ? "Create the leads, users, and activity log tables by running this SQL in the Supabase SQL editor, then retry. The script adds an admin user named admin."
      : "Row level security is blocking the app. Run this SQL in the Supabase SQL editor, then retry.";

  return (
    <section className="rounded-[28px] border border-line bg-card p-5">
      <h2 className="font-serif text-3xl tracking-tight text-ink">{title}</h2>
      <p className="mt-2 text-sm leading-relaxed text-muted">{body}</p>
      {detail ? (
        <p className="mt-3 rounded-2xl bg-clay-soft px-3 py-2 text-sm text-clay">{detail}</p>
      ) : null}
      <div className="mt-4 flex items-center justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">
          supabase/schema.sql
        </p>
        <button
          type="button"
          onClick={copySql}
          className="rounded-full border border-line px-3 py-1.5 text-sm font-medium text-ink"
        >
          {copied ? "Copied" : "Copy SQL"}
        </button>
      </div>
      <pre className="mt-3 max-h-64 overflow-auto rounded-2xl bg-ink p-4 text-left text-xs leading-relaxed text-paper">
        {SETUP_SQL}
      </pre>
    </section>
  );
}
