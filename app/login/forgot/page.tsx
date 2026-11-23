"use client";

import { FormEvent, Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  STAFF_LOGIN_ACCOUNTS,
  isStaffLoginEmail,
  type StaffLoginEmail,
} from "@/lib/auth/staff-accounts";

function ForgotPasswordForm() {
  const searchParams = useSearchParams();
  const [email, setEmail] = useState<StaffLoginEmail>(STAFF_LOGIN_ACCOUNTS[0].email);
  const [status, setStatus] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fromQuery = (searchParams.get("email") || "").trim().toLowerCase();
    if (isStaffLoginEmail(fromQuery)) setEmail(fromQuery);
  }, [searchParams]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (status === "sending") return;
    if (!isStaffLoginEmail(email)) {
      setError("Choose Vishal or Admin.");
      return;
    }

    setStatus("sending");
    setError(null);

    try {
      const supabase = createClient();
      const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent("/login/update-password")}`;
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo,
      });

      if (resetError) {
        setError(resetError.message || "Could not send the reset email.");
        setStatus("idle");
        return;
      }

      setStatus("sent");
    } catch {
      setError("Something went wrong. Please try again.");
      setStatus("idle");
    }
  }

  return (
    <main className="texlex-surface flex min-h-screen items-center justify-center bg-[#102033] px-6 py-16 text-[#f4f8fc]">
      <div className="w-full max-w-[400px]">
        <p className="text-[13px] font-semibold uppercase tracking-[0.16em] text-[#849aaf]">
          Texlex
        </p>
        <h1 className="mt-3 text-[34px] font-medium leading-[1.15] tracking-[-0.03em] text-[#f4f8fc]">
          Reset password
        </h1>
        <p className="mt-2 text-[16px] leading-snug text-[#9eb2c6]">
          We&apos;ll email a link to set a new password.
        </p>

        {status === "sent" ? (
          <div className="mt-8">
            <p className="text-[16px] leading-relaxed text-[#c5d4e4]">
              Check <span className="font-semibold text-[#f4f8fc]">{email}</span> for the
              reset link. Open it on this device, then choose a new password.
            </p>
            <Link
              href={`/login?email=${encodeURIComponent(email)}`}
              className="mt-8 inline-flex h-11 w-full items-center justify-center rounded-md bg-[#9fc3f2] px-4 text-[15px] font-semibold text-[#0a1828] transition-opacity hover:opacity-90"
            >
              Back to sign in
            </Link>
          </div>
        ) : (
          <form className="mt-8" onSubmit={(e) => void handleSubmit(e)}>
            <div
              role="radiogroup"
              aria-label="Account"
              className="grid grid-cols-2 gap-px overflow-hidden rounded-md border border-[#2c455f] bg-[#2c455f]"
            >
              {STAFF_LOGIN_ACCOUNTS.map((account) => {
                const selected = email === account.email;
                return (
                  <button
                    key={account.email}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => {
                      setEmail(account.email);
                      if (error) setError(null);
                    }}
                    className={
                      selected
                        ? "bg-[#16324c] px-4 py-3.5 text-left transition-colors"
                        : "bg-[#0f1f30] px-4 py-3.5 text-left transition-colors hover:bg-[#13263a]"
                    }
                  >
                    <span className="block text-[15px] font-semibold text-[#f4f8fc]">
                      {account.label}
                    </span>
                    <span className="mt-1 block truncate text-[12px] text-[#849aaf]">
                      {account.email}
                    </span>
                  </button>
                );
              })}
            </div>

            {error ? (
              <p role="alert" className="mt-4 text-[14px] font-medium text-[#f0b4b4]">
                {error}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={status === "sending"}
              className="mt-8 inline-flex h-11 w-full items-center justify-center rounded-md bg-[#9fc3f2] px-4 text-[15px] font-semibold text-[#0a1828] transition-opacity hover:opacity-90 disabled:cursor-wait disabled:opacity-60"
            >
              {status === "sending" ? "Sending…" : "Email reset link"}
            </button>

            <div className="mt-5 text-center">
              <Link
                href={`/login?email=${encodeURIComponent(email)}`}
                className="text-[14px] text-[#9fc3f2] underline-offset-4 hover:underline"
              >
                Back to sign in
              </Link>
            </div>
          </form>
        )}
      </div>
    </main>
  );
}

export default function ForgotPasswordPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-[#102033] text-[16px] text-[#9eb2c6]">
          Loading…
        </main>
      }
    >
      <ForgotPasswordForm />
    </Suspense>
  );
}
