"use client";

import { useState, type FormEvent } from "react";
import { DatabaseSetup } from "@/components/database-setup";
import { isMissingTableError, isPermissionError } from "@/lib/format";
import { findUserByName } from "@/lib/users";
import type { AppUser } from "@/lib/types";

type LoginScreenProps = {
  onSuccess: (user: AppUser) => void;
};

type SetupKind = "permission" | "missing-table" | null;

export function LoginScreen({ onSuccess }: LoginScreenProps) {
  const [username, setUsername] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [setup, setSetup] = useState<SetupKind>(null);
  const [setupDetail, setSetupDetail] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const nextName = username.trim();
    if (!nextName) {
      setSetup(null);
      setSetupDetail(null);
      setError("Enter your username.");
      return;
    }

    setSubmitting(true);
    setError(null);
    setSetup(null);
    setSetupDetail(null);
    try {
      const user = await findUserByName(nextName);
      if (!user) {
        setError("User not found. Please contact admin.");
        return;
      }
      onSuccess(user);
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Could not sign in.";
      if (isMissingTableError(message)) {
        setSetup("missing-table");
        setSetupDetail(message);
      } else if (isPermissionError(message)) {
        setSetup("permission");
        setSetupDetail(message);
      } else setError(message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-lg flex-col justify-center px-4 py-8">
      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted">Field Sales</p>
      <h1 className="mt-2 font-serif text-5xl leading-none tracking-tight text-ink">Sign in</h1>
      <p className="mt-3 max-w-sm text-sm leading-relaxed text-muted">
        Type the username your admin gave you. There is no account menu.
      </p>

      <form onSubmit={onSubmit} className="mt-6">
        <label className="block">
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
            autoComplete="username"
            autoFocus
            enterKeyHint="go"
            className="w-full rounded-2xl border border-line bg-card px-4 py-3.5 text-base text-ink outline-none placeholder:text-muted/70 focus:border-pine"
          />
        </label>

        {error ? (
          <p className="mt-3 rounded-2xl bg-clay-soft px-3 py-2 text-sm text-clay" role="alert">
            {error}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={submitting}
          className="mt-4 w-full rounded-2xl bg-ink px-4 py-3.5 text-base font-semibold text-paper disabled:opacity-60"
        >
          {submitting ? "Checking..." : "Continue"}
        </button>
      </form>

      {setup ? (
        <div className="mt-6">
          <DatabaseSetup kind={setup} detail={setupDetail ?? undefined} />
        </div>
      ) : null}
    </div>
  );
}
