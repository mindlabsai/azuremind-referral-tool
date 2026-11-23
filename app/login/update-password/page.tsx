"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { isStaffLoginEmail, staffAccountLabel } from "@/lib/auth/staff-accounts";

export default function UpdatePasswordPage() {
  const router = useRouter();
  const [email, setEmail] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();

    void (async () => {
      const { data } = await supabase.auth.getUser();
      if (cancelled) return;
      const userEmail = data.user?.email?.toLowerCase() ?? null;
      if (!userEmail || !isStaffLoginEmail(userEmail)) {
        setError("Open the reset link from your email first, then set a new password.");
        setReady(true);
        return;
      }
      setEmail(userEmail);
      setReady(true);
    })();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") {
        const userEmail = session?.user?.email?.toLowerCase() ?? null;
        if (userEmail && isStaffLoginEmail(userEmail)) {
          setEmail(userEmail);
          setError(null);
        }
      }
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (saving) return;

    if (!email) {
      setError("Open the reset link from your email first, then set a new password.");
      return;
    }
    if (password.length < 8) {
      setError("Use at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const supabase = createClient();
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) {
        setError(updateError.message || "Could not update password.");
        setSaving(false);
        return;
      }
      router.replace("/");
      router.refresh();
    } catch {
      setError("Something went wrong. Please try again.");
      setSaving(false);
    }
  }

  const fieldClass =
    "mt-2 w-full border-0 border-b border-[#2c455f] bg-transparent px-0 py-3 text-[18px] text-[#f4f8fc] outline-none placeholder:text-[#7e95ab] focus:border-[#9fc3f2]";
  const fieldErrorClass =
    "mt-2 w-full border-0 border-b border-[#f0b4b4] bg-transparent px-0 py-3 text-[18px] text-[#f4f8fc] outline-none placeholder:text-[#7e95ab]";

  return (
    <main className="texlex-surface flex min-h-screen items-center justify-center bg-[#102033] px-6 py-16 text-[#f4f8fc]">
      <div className="w-full max-w-[400px]">
        <p className="text-[13px] font-semibold uppercase tracking-[0.16em] text-[#849aaf]">
          Texlex
        </p>
        <h1 className="mt-3 text-[34px] font-medium leading-[1.15] tracking-[-0.03em] text-[#f4f8fc]">
          Set new password
        </h1>
        <p className="mt-2 text-[16px] leading-snug text-[#9eb2c6]">
          {email
            ? `${staffAccountLabel(email)} · ${email}`
            : "Complete the email reset link first."}
        </p>

        {!ready ? (
          <p className="mt-8 text-[16px] text-[#9eb2c6]">Checking session…</p>
        ) : (
          <form className="mt-8" onSubmit={(e) => void handleSubmit(e)}>
            <label
              htmlFor="new-password"
              className="block text-[12px] font-semibold uppercase tracking-[0.12em] text-[#849aaf]"
            >
              New password
            </label>
            <input
              id="new-password"
              type="password"
              autoComplete="new-password"
              autoFocus
              required
              minLength={8}
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (error) setError(null);
              }}
              placeholder="At least 8 characters"
              className={error ? fieldErrorClass : fieldClass}
            />

            <label
              htmlFor="confirm-password"
              className="mt-6 block text-[12px] font-semibold uppercase tracking-[0.12em] text-[#849aaf]"
            >
              Confirm password
            </label>
            <input
              id="confirm-password"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              value={confirm}
              onChange={(e) => {
                setConfirm(e.target.value);
                if (error) setError(null);
              }}
              placeholder="Repeat password"
              className={error ? fieldErrorClass : fieldClass}
            />

            {error ? (
              <p role="alert" className="mt-4 text-[14px] font-medium text-[#f0b4b4]">
                {error}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={saving || !email}
              className="mt-8 inline-flex h-11 w-full items-center justify-center rounded-md bg-[#9fc3f2] px-4 text-[15px] font-semibold text-[#0a1828] transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save password"}
            </button>

            <div className="mt-5 text-center">
              <Link
                href="/login"
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
