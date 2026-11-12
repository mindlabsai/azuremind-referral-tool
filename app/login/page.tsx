"use client";

import { FormEvent, Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [signingIn, setSigningIn] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (signingIn) return;
    setSigningIn(true);
    setError(null);

    try {
      const supabase = createClient();
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (signInError) {
        setError("Incorrect email or password. Please try again.");
        setSigningIn(false);
        return;
      }

      const next = searchParams.get("next");
      const destination =
        next && next.startsWith("/") && !next.startsWith("//") ? next : "/";
      router.replace(destination);
      router.refresh();
    } catch {
      setError("Something went wrong. Please try again.");
      setSigningIn(false);
    }
  }

  return (
    <main
      className="azuremind-app"
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background:
          "linear-gradient(165deg, #E8F6F5 0%, #F8FAFC 48%, #EEF2F7 100%)",
        padding: 24,
      }}
    >
      <div style={{ width: "100%", maxWidth: 420 }}>
        <header
          style={{
            textAlign: "center",
            marginBottom: 24,
            padding: "28px 24px",
            borderRadius: 16,
            background: "linear-gradient(135deg, #0E9F98 0%, #0A7A75 100%)",
            color: "#fff",
            boxShadow: "0 8px 28px rgba(14, 95, 99, 0.18)",
          }}
        >
          <h1
            style={{
              fontSize: 24,
              fontWeight: 700,
              letterSpacing: "-0.03em",
              lineHeight: 1.2,
            }}
          >
            Azure Mind
          </h1>
          <p
            style={{
              fontSize: 14,
              fontWeight: 600,
              opacity: 0.94,
              marginTop: 8,
              letterSpacing: "0.04em",
              textTransform: "uppercase",
            }}
          >
            Clinical tools
          </p>
          <p
            style={{
              fontSize: 12,
              fontWeight: 500,
              opacity: 0.72,
              marginTop: 10,
              letterSpacing: "0.02em",
            }}
          >
            Sign in to continue
          </p>
        </header>

        <form
          onSubmit={(e) => void handleSubmit(e)}
          style={{
            background: "#fff",
            borderRadius: 16,
            padding: 24,
            boxShadow: "0 4px 24px rgba(15, 23, 42, 0.08)",
            border: "1px solid rgba(14, 95, 99, 0.08)",
          }}
        >
          <label
            htmlFor="login-email"
            style={{
              display: "block",
              fontSize: 13,
              fontWeight: 600,
              color: "#334155",
              marginBottom: 6,
            }}
          >
            Email
          </label>
          <input
            id="login-email"
            type="email"
            autoComplete="email"
            autoFocus
            required
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              if (error) setError(null);
            }}
            placeholder="you@example.com"
            aria-invalid={error ? true : undefined}
            style={{
              width: "100%",
              boxSizing: "border-box",
              padding: "10px 12px",
              borderRadius: 10,
              border: error ? "2px solid #DC2626" : "1px solid #CBD5E1",
              fontSize: 15,
              marginBottom: 14,
            }}
          />

          <label
            htmlFor="login-password"
            style={{
              display: "block",
              fontSize: 13,
              fontWeight: 600,
              color: "#334155",
              marginBottom: 6,
            }}
          >
            Password
          </label>
          <input
            id="login-password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              if (error) setError(null);
            }}
            placeholder="Enter password"
            aria-invalid={error ? true : undefined}
            style={{
              width: "100%",
              boxSizing: "border-box",
              padding: "10px 12px",
              borderRadius: 10,
              border: error ? "2px solid #DC2626" : "1px solid #CBD5E1",
              fontSize: 15,
            }}
          />

          {error ? (
            <p
              role="alert"
              style={{
                color: "#991B1B",
                fontSize: 13,
                fontWeight: 600,
                marginTop: 12,
              }}
            >
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={signingIn}
            style={{
              width: "100%",
              marginTop: 16,
              padding: "11px 16px",
              borderRadius: 10,
              border: "none",
              background: "#0E9F98",
              color: "#fff",
              fontSize: 15,
              fontWeight: 700,
              cursor: signingIn ? "wait" : "pointer",
              opacity: signingIn ? 0.85 : 1,
            }}
          >
            {signingIn ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <main
          style={{
            minHeight: "100vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "#F8FAFC",
            color: "#64748b",
            fontSize: 14,
          }}
        >
          Loading…
        </main>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
