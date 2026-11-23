"use client";

import { FormEvent, Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  STAFF_LOGIN_ACCOUNTS,
  isStaffLoginEmail,
  type StaffLoginEmail,
} from "@/lib/auth/staff-accounts";

const STORAGE_KEY = "texlex.staff-auth.v1";

type SavedAuth = {
  email: StaffLoginEmail;
  savePassword: boolean;
  passwords: Partial<Record<StaffLoginEmail, string>>;
};

type AuthMode = "signin" | "set-password";

function readSavedAuth(): SavedAuth | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SavedAuth;
    if (!isStaffLoginEmail(parsed.email)) return null;
    return {
      email: parsed.email,
      savePassword: Boolean(parsed.savePassword),
      passwords: parsed.passwords && typeof parsed.passwords === "object" ? parsed.passwords : {},
    };
  } catch {
    return null;
  }
}

function writeSavedAuth(next: SavedAuth) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [mode, setMode] = useState<AuthMode>("signin");
  const [email, setEmail] = useState<StaffLoginEmail>(STAFF_LOGIN_ACCOUNTS[0].email);
  const [password, setPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savePassword, setSavePassword] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const saved = readSavedAuth();
    const fromQuery = (searchParams.get("email") || "").trim().toLowerCase();
    const nextEmail = isStaffLoginEmail(fromQuery)
      ? fromQuery
      : saved?.email ?? STAFF_LOGIN_ACCOUNTS[0].email;

    setEmail(nextEmail);
    setSavePassword(saved?.savePassword ?? true);
    if (saved?.savePassword && saved.passwords[nextEmail]) {
      setPassword(saved.passwords[nextEmail] || "");
    }

    const authError = searchParams.get("error");
    if (authError === "missing_code" || authError === "auth_config") {
      setError("That reset link was invalid. Request a new password reset.");
    } else if (authError) {
      setError(decodeURIComponent(authError));
    }

    const wantSet = searchParams.get("mode") === "set-password";
    if (wantSet) setMode("set-password");

    setHydrated(true);
  }, [searchParams]);

  function selectAccount(next: StaffLoginEmail) {
    setEmail(next);
    setError(null);
    setStatus(null);
    const saved = readSavedAuth();
    if (savePassword && saved?.passwords[next]) {
      setPassword(saved.passwords[next] || "");
    } else {
      setPassword("");
    }
    setNewPassword("");
    setConfirmPassword("");
  }

  function persistAfterSuccess(nextPassword: string) {
    const existing = readSavedAuth();
    const passwords = { ...(existing?.passwords ?? {}) };
    if (savePassword) {
      passwords[email] = nextPassword;
    } else {
      delete passwords[email];
    }
    writeSavedAuth({
      email,
      savePassword,
      passwords,
    });
  }

  function goAfterAuth() {
    const next = searchParams.get("next");
    const destination =
      next && next.startsWith("/") && !next.startsWith("//") ? next : "/";
    router.replace(destination);
    router.refresh();
  }

  async function handleSignIn(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    setStatus(null);

    try {
      const supabase = createClient();
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) {
        setError("Incorrect password. Try again, reset it, or set your own.");
        setBusy(false);
        return;
      }

      persistAfterSuccess(password);
      goAfterAuth();
    } catch {
      setError("Something went wrong. Please try again.");
      setBusy(false);
    }
  }

  async function handleSetOwnPassword(e: FormEvent) {
    e.preventDefault();
    if (busy) return;

    if (newPassword.length < 8) {
      setError("New password must be at least 8 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("New passwords do not match.");
      return;
    }

    setBusy(true);
    setError(null);
    setStatus(null);

    try {
      const supabase = createClient();
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (signInError) {
        setError("Current password is incorrect.");
        setBusy(false);
        return;
      }

      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });
      if (updateError) {
        setError(updateError.message || "Could not update password.");
        setBusy(false);
        return;
      }

      persistAfterSuccess(newPassword);
      setPassword(newPassword);
      setNewPassword("");
      setConfirmPassword("");
      setStatus("Password updated. Signing you in…");
      goAfterAuth();
    } catch {
      setError("Something went wrong. Please try again.");
      setBusy(false);
    }
  }

  const fieldClass = error
    ? "w-full rounded-xl border border-[#e8a0a0] bg-[#0c1a2b] px-5 py-4 text-[19px] text-[#f4f8fc] outline-none transition-[border-color,box-shadow] placeholder:text-[#6f859b] focus:border-[#f0b4b4] focus:shadow-[0_0_0_4px_rgba(240,180,180,0.12)]"
    : "w-full rounded-xl border border-[#2a4158] bg-[#0c1a2b] px-5 py-4 text-[19px] text-[#f4f8fc] outline-none transition-[border-color,box-shadow] placeholder:text-[#6f859b] focus:border-[#9fc3f2] focus:shadow-[0_0_0_4px_rgba(159,195,242,0.16)]";

  return (
    <main className="texlex-surface relative flex min-h-dvh items-center justify-center overflow-hidden px-5 py-10 text-[#f4f8fc] sm:px-8 sm:py-14">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[#0a1624]"
        style={{
          backgroundImage: `
            radial-gradient(ellipse 70% 55% at 12% 20%, rgba(72, 118, 168, 0.28), transparent 55%),
            radial-gradient(ellipse 55% 45% at 88% 78%, rgba(42, 86, 128, 0.22), transparent 50%),
            linear-gradient(165deg, #0b1726 0%, #102033 48%, #0a1522 100%)
          `,
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.035]"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
        }}
      />

      <div className="relative z-10 grid w-full max-w-[1120px] overflow-hidden rounded-[24px] border border-[#2a4158]/70 bg-[#0d1c2e]/85 shadow-[0_32px_80px_rgba(0,0,0,0.35)] backdrop-blur-xl sm:rounded-[28px] lg:grid-cols-[1fr_1.12fr]">
        <aside className="relative flex flex-col justify-between border-b border-[#2a4158]/70 px-6 py-8 sm:px-10 sm:py-12 lg:border-b-0 lg:border-r lg:px-14 lg:py-16">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                "radial-gradient(ellipse 90% 70% at 30% 0%, rgba(159,195,242,0.12), transparent 60%)",
            }}
          />
          <div className="relative">
            <p className="text-[14px] font-semibold uppercase tracking-[0.22em] text-[#9fc3f2] sm:text-[15px]">
              Texlex
            </p>
            <h1 className="mt-4 text-[36px] font-semibold leading-[1.08] tracking-[-0.04em] text-[#f4f8fc] sm:mt-5 sm:text-[48px] lg:max-w-[11ch] lg:text-[52px]">
              {mode === "signin" ? "Welcome back" : "Make it yours"}
            </h1>
            <p className="mt-4 max-w-[36ch] text-[17px] leading-relaxed text-[#9eb2c6] sm:mt-5 sm:text-[19px]">
              {mode === "signin"
                ? "Staff sign-in for Vishal and Admin."
                : "Enter your current password, then choose a new one you’ll remember."}
            </p>
          </div>
          <p className="relative mt-10 hidden text-[14px] tracking-wide text-[#6f859b] lg:block">
            Azure Mind · clinical tools
          </p>
        </aside>

        <section className="relative px-6 py-8 sm:px-10 sm:py-12 lg:px-14 lg:py-16">
          <div
            role="tablist"
            aria-label="Sign in options"
            className="grid grid-cols-2 gap-1.5 rounded-2xl bg-[#081420] p-1.5"
          >
            <button
              type="button"
              role="tab"
              aria-selected={mode === "signin"}
              onClick={() => {
                setMode("signin");
                setError(null);
                setStatus(null);
              }}
              className={
                mode === "signin"
                  ? "rounded-xl bg-[#1a334d] px-3 py-3.5 text-[15px] font-semibold text-[#f4f8fc] shadow-[inset_0_0_0_1px_rgba(159,195,242,0.25)] transition-colors sm:px-4 sm:text-[16px]"
                  : "rounded-xl px-3 py-3.5 text-[15px] font-semibold text-[#849aaf] transition-colors hover:text-[#c5d4e4] sm:px-4 sm:text-[16px]"
              }
            >
              Sign in
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === "set-password"}
              onClick={() => {
                setMode("set-password");
                setError(null);
                setStatus(null);
              }}
              className={
                mode === "set-password"
                  ? "rounded-xl bg-[#1a334d] px-3 py-3.5 text-[15px] font-semibold text-[#f4f8fc] shadow-[inset_0_0_0_1px_rgba(159,195,242,0.25)] transition-colors sm:px-4 sm:text-[16px]"
                  : "rounded-xl px-3 py-3.5 text-[15px] font-semibold text-[#849aaf] transition-colors hover:text-[#c5d4e4] sm:px-4 sm:text-[16px]"
              }
            >
              Set your own
            </button>
          </div>

          <div
            role="radiogroup"
            aria-label="Account"
            className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2"
          >
            {STAFF_LOGIN_ACCOUNTS.map((account) => {
              const selected = email === account.email;
              return (
                <button
                  key={account.email}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => selectAccount(account.email)}
                  className={
                    selected
                      ? "rounded-2xl border border-[#9fc3f2]/55 bg-[#16324c] px-5 py-5 text-left transition-[border-color,background-color,transform] duration-200"
                      : "rounded-2xl border border-[#2a4158] bg-[#0c1a2b] px-5 py-5 text-left transition-[border-color,background-color,transform] duration-200 hover:border-[#3d5874] hover:bg-[#122436]"
                  }
                >
                  <span className="block text-[20px] font-semibold tracking-[-0.02em] text-[#f4f8fc]">
                    {account.label}
                  </span>
                  <span className="mt-1.5 block truncate text-[14px] text-[#849aaf]">
                    {account.email}
                  </span>
                </button>
              );
            })}
          </div>

          <form
            className="mt-9"
            onSubmit={(e) => void (mode === "signin" ? handleSignIn(e) : handleSetOwnPassword(e))}
            autoComplete="on"
          >
            <input
              type="email"
              name="username"
              autoComplete="username"
              value={email}
              readOnly
              tabIndex={-1}
              aria-hidden="true"
              className="absolute -left-[9999px] h-px w-px overflow-hidden opacity-0"
            />

            <label
              htmlFor="login-password"
              className="block text-[13px] font-semibold uppercase tracking-[0.14em] text-[#849aaf]"
            >
              {mode === "signin" ? "Password" : "Current password"}
            </label>
            <div className="relative mt-2.5">
              <input
                id="login-password"
                name="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                autoFocus={hydrated}
                required
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (error) setError(null);
                }}
                placeholder={mode === "signin" ? "Enter password" : "Current password"}
                aria-invalid={error ? true : undefined}
                className={`${fieldClass} pr-24`}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute inset-y-0 right-2 my-auto h-10 rounded-lg px-3 text-[14px] font-semibold text-[#9fc3f2] transition-colors hover:bg-[#16324c]/80"
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>

            {mode === "set-password" ? (
              <>
                <label
                  htmlFor="new-password"
                  className="mt-6 block text-[13px] font-semibold uppercase tracking-[0.14em] text-[#849aaf]"
                >
                  New password
                </label>
                <input
                  id="new-password"
                  name="new-password"
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={8}
                  value={newPassword}
                  onChange={(e) => {
                    setNewPassword(e.target.value);
                    if (error) setError(null);
                  }}
                  placeholder="At least 8 characters"
                  className={`mt-2.5 ${fieldClass}`}
                />

                <label
                  htmlFor="confirm-password"
                  className="mt-6 block text-[13px] font-semibold uppercase tracking-[0.14em] text-[#849aaf]"
                >
                  Confirm new password
                </label>
                <input
                  id="confirm-password"
                  name="confirm-password"
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={8}
                  value={confirmPassword}
                  onChange={(e) => {
                    setConfirmPassword(e.target.value);
                    if (error) setError(null);
                  }}
                  placeholder="Repeat new password"
                  className={`mt-2.5 ${fieldClass}`}
                />
              </>
            ) : null}

            <label className="mt-7 flex cursor-pointer items-start gap-3.5">
              <input
                type="checkbox"
                checked={savePassword}
                onChange={(e) => {
                  const checked = e.target.checked;
                  setSavePassword(checked);
                  if (!checked) {
                    const existing = readSavedAuth();
                    if (existing) {
                      const passwords = { ...existing.passwords };
                      delete passwords[email];
                      writeSavedAuth({
                        email,
                        savePassword: false,
                        passwords,
                      });
                    }
                  }
                }}
                className="mt-1 size-5 accent-[#9fc3f2]"
              />
              <span className="text-[16px] leading-snug text-[#c5d4e4]">
                Save password on this device
                <span className="mt-1 block text-[14px] text-[#849aaf]">
                  Fills it next time you open Texlex on this browser.
                </span>
              </span>
            </label>

            {error ? (
              <p role="alert" className="mt-5 text-[16px] font-medium text-[#f0b4b4]">
                {error}
              </p>
            ) : null}
            {status ? (
              <p className="mt-5 text-[16px] font-medium text-[#9fc3f2]" aria-live="polite">
                {status}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={busy}
              className="mt-9 inline-flex h-14 w-full items-center justify-center rounded-2xl bg-[#9fc3f2] px-5 text-[18px] font-semibold tracking-[-0.01em] text-[#0a1828] transition-[opacity,transform] hover:opacity-95 active:scale-[0.99] disabled:cursor-wait disabled:opacity-60"
            >
              {busy
                ? mode === "signin"
                  ? "Signing in…"
                  : "Saving…"
                : mode === "signin"
                  ? "Sign in"
                  : "Save password & sign in"}
            </button>

            <div className="mt-6 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-center">
              {mode === "signin" ? (
                <button
                  type="button"
                  onClick={() => {
                    setMode("set-password");
                    setError(null);
                    setStatus(null);
                  }}
                  className="text-[15px] font-medium text-[#9fc3f2] underline-offset-4 hover:underline"
                >
                  Set your own password
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setMode("signin");
                    setError(null);
                    setStatus(null);
                  }}
                  className="text-[15px] font-medium text-[#9fc3f2] underline-offset-4 hover:underline"
                >
                  Back to sign in
                </button>
              )}
              <Link
                href={`/login/forgot?email=${encodeURIComponent(email)}`}
                className="text-[15px] text-[#849aaf] underline-offset-4 hover:text-[#9fc3f2] hover:underline"
              >
                Email reset link
              </Link>
            </div>
          </form>
        </section>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-dvh items-center justify-center bg-[#0a1624] text-[18px] text-[#9eb2c6]">
          Loading…
        </main>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
