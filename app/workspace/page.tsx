"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { SignOutButton } from "@/components/SignOutButton";
import { createClient } from "@/lib/supabase/client";
import type { ClinikoPatient, ClinikoPatientAppointment } from "@/lib/cliniko";
import { practiceApiBase, practiceLabel, type PracticeSource } from "@/lib/practice-source";
import { workspaceReportPath } from "@/lib/workspace-open";

type Engine = "adhd" | "asd";

type DraftRow = {
  patientId: string;
  clientName: string;
  lastSaved: string | null;
  source: PracticeSource;
};

function startOfLocalDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
}

function formatTime(iso: string | null): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const hours = date.getHours();
  const minutes = date.getMinutes();
  return `${hours < 10 ? `0${hours}` : hours}:${minutes < 10 ? `0${minutes}` : minutes}`;
}

function sourceFromDraft(state: unknown): PracticeSource {
  if (!state || typeof state !== "object") return "cliniko";
  const cliniko = (state as { cliniko?: { source?: unknown } }).cliniko;
  return cliniko?.source === "halaxy" ? "halaxy" : "cliniko";
}

const kicker: CSSProperties = {
  margin: "0 0 8px",
  fontSize: 15,
  fontWeight: 600,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: "#849aaf",
};

function choiceStyle(active: boolean): CSSProperties {
  return {
    background: "transparent",
    border: "none",
    borderBottom: active ? "2px solid #a8cdc4" : "2px solid transparent",
    padding: "4px 0",
    color: active ? "#f4f8fc" : "#849aaf",
    fontSize: 23,
    fontWeight: 600,
    cursor: "pointer",
  };
}

export default function WorkspacePage() {
  const router = useRouter();
  const [email, setEmail] = useState<string | null>(null);
  const [engine, setEngine] = useState<Engine | "">("");
  const [source, setSource] = useState<PracticeSource>("cliniko");
  const [appointments, setAppointments] = useState<ClinikoPatientAppointment[]>([]);
  const [scheduleError, setScheduleError] = useState<string | null>(null);
  const [scheduleLoading, setScheduleLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [patients, setPatients] = useState<ClinikoPatient[]>([]);
  const [patientError, setPatientError] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);
  const [drafts, setDrafts] = useState<DraftRow[]>([]);
  const [draftError, setDraftError] = useState<string | null>(null);
  const [needEngine, setNeedEngine] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    void supabase.auth.getUser().then(({ data }) => {
      setEmail(data.user?.email ?? null);
    }).catch(() => {
      setEmail(null);
    });
  }, []);

  useEffect(() => {
    const today = startOfLocalDay(new Date());
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const params = new URLSearchParams({
      from: today.toISOString(),
      to: tomorrow.toISOString(),
    });
    let cancelled = false;
    setScheduleLoading(true);
    setScheduleError(null);
    void (async () => {
      try {
        const response = await fetch(`${practiceApiBase(source)}/schedule?${params.toString()}`);
        const data = (await response.json()) as {
          appointments?: ClinikoPatientAppointment[];
          error?: string;
        };
        if (cancelled) return;
        if (!response.ok) {
          setAppointments([]);
          setScheduleError(data.error || `Could not load today's ${practiceLabel(source)} calendar.`);
          return;
        }
        setAppointments(
          (data.appointments ?? []).filter(
            (row) => row.patient_id && !row.cancelled_at && !row.archived_at
          )
        );
      } catch {
        if (!cancelled) {
          setAppointments([]);
          setScheduleError(`Could not load today's ${practiceLabel(source)} calendar.`);
        }
      } finally {
        if (!cancelled) setScheduleLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [source]);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setPatients([]);
      setPatientError(null);
      setSearching(false);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(() => {
      setSearching(true);
      void (async () => {
        try {
          const response = await fetch(
            `${practiceApiBase(source)}/patients/search?q=${encodeURIComponent(trimmed)}`
          );
          const data = (await response.json()) as { patients?: ClinikoPatient[]; error?: string };
          if (cancelled) return;
          if (!response.ok) {
            setPatients([]);
            setPatientError(data.error || `${practiceLabel(source)} search failed.`);
            return;
          }
          setPatientError(null);
          setPatients((data.patients ?? []).slice(0, 8));
        } catch {
          if (!cancelled) setPatientError(`${practiceLabel(source)} search failed.`);
        } finally {
          if (!cancelled) setSearching(false);
        }
      })();
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, source]);

  useEffect(() => {
    const trimmed = query.trim();
    if (!engine || trimmed.length < 3) {
      setDrafts([]);
      setDraftError(null);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(() => {
      void (async () => {
        try {
          const response = await fetch(
            `/api/report-state/search?engine=${engine}&q=${encodeURIComponent(trimmed)}`
          );
          const data = (await response.json()) as {
            success?: boolean;
            error?: string;
            hits?: Array<{
              clientName?: string;
              lastSaved?: string | null;
              patientId?: string | null;
              state?: unknown;
            }>;
          };
          if (cancelled) return;
          if (!response.ok || data.success === false) {
            setDrafts([]);
            setDraftError(data.error || "Could not search saved reports.");
            return;
          }
          setDraftError(null);
          setDrafts(
            (data.hits ?? [])
              .filter((hit) => typeof hit.patientId === "string" && hit.patientId)
              .slice(0, 8)
              .map((hit) => ({
                patientId: hit.patientId as string,
                clientName: hit.clientName?.trim() || "Saved report",
                lastSaved: hit.lastSaved ?? null,
                source: sourceFromDraft(hit.state),
              }))
          );
        } catch {
          if (!cancelled) setDraftError("Could not search saved reports.");
        }
      })();
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [engine, query]);

  function openPatient(
    patientId: string,
    openSource: PracticeSource,
    appointmentStartsAt?: string | null
  ) {
    if (engine !== "adhd" && engine !== "asd") {
      setNeedEngine(true);
      return;
    }
    setNeedEngine(false);
    router.push(
      workspaceReportPath(engine, {
        patientId,
        source: openSource,
        appointmentStartsAt,
        importFiles: openSource === "cliniko",
      })
    );
  }

  return (
    <main
      className="texlex-surface"
      style={{
        minHeight: "calc(100dvh - 96px)",
        background: "#102033",
        color: "#f4f8fc",
        fontFamily: "var(--font-geist-sans), Inter, ui-sans-serif, system-ui, sans-serif",
        padding: "28px 32px 48px",
      }}
    >
      <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "baseline", gap: 18, flexWrap: "wrap" }}>
          <p style={{ margin: 0, maxWidth: 420, textAlign: "right", fontSize: 16, lineHeight: 1.4, color: "#849aaf" }}>
          {email ? `Signed in as ${email}.` : "Signed in."} A number typed here is not a registration check.
        </p>
        <SignOutButton
          style={{
            background: "transparent",
            border: "none",
            color: "#c5d4e4",
            fontSize: 19,
            fontWeight: 600,
            cursor: "pointer",
          }}
        />
      </div>

      <div style={{ width: "min(760px, 100%)", margin: "8px auto 0", textAlign: "left" }}>
      <h1 style={{ margin: 0, fontSize: 43, fontWeight: 500, letterSpacing: "-0.03em" }}>Workspace</h1>

      <div style={{ marginTop: 22, display: "flex", gap: 56, flexWrap: "wrap" }}>
        <div>
          <p style={kicker}>Assessment</p>
          <div style={{ display: "flex", gap: 22 }}>
            {(["adhd", "asd"] as const).map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => {
                  setEngine(option);
                  setNeedEngine(false);
                }}
                style={choiceStyle(engine === option)}
              >
                {option === "adhd" ? "ADHD" : "ASD"}
              </button>
            ))}
          </div>
        </div>
        <div>
          <p style={kicker}>Practice system</p>
          <div style={{ display: "flex", gap: 22 }}>
            {(["cliniko", "halaxy"] as const).map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => {
                  setSource(option);
                  setAppointments([]);
                  setScheduleLoading(true);
                  setScheduleError(null);
                  setPatients([]);
                  setPatientError(null);
                }}
                style={choiceStyle(source === option)}
              >
                {practiceLabel(option)}
              </button>
            ))}
          </div>
        </div>
      </div>
      {needEngine ? (
        <p style={{ marginTop: 14, color: "#f0c593", fontSize: 20 }}>Choose ADHD or ASD before opening a person.</p>
      ) : null}

      <div style={{ marginTop: 26 }}>
        <p style={{ ...kicker, marginBottom: 8 }}>Find a patient or report</p>
        <label style={{ display: "block", fontSize: 16, fontWeight: 600, color: "#9eb2c6" }}>
          Search by name
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            aria-label="Search by name"
            style={{
              display: "block",
              width: "min(560px, 100%)",
              marginTop: 4,
              textAlign: "left",
              background: "transparent",
              border: "none",
              borderBottom: "1px solid #2c455f",
              color: "#f4f8fc",
              fontSize: 20,
              lineHeight: 1.4,
              padding: "8px 0",
              outline: "none",
            }}
          />
        </label>
      </div>

      <section style={{ marginTop: 28 }}>
        <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "#849aaf" }}>
          Today&apos;s appointments · {practiceLabel(source)}
        </h2>
        {scheduleLoading ? <p style={{ margin: "8px 0 0", fontSize: 19, color: "#9eb2c6" }}>Loading the calendar.</p> : null}
        {scheduleError ? <p style={{ margin: "8px 0 0", fontSize: 19, color: "#f0b4b4" }}>{scheduleError}</p> : null}
        {!scheduleLoading && !scheduleError && appointments.length === 0 ? (
          <p style={{ margin: "8px 0 0", fontSize: 19, color: "#9eb2c6" }}>No appointments.</p>
        ) : null}
        <div style={{ marginTop: 8 }}>
          {appointments.map((row) => (
            <button
              key={row.id}
              type="button"
              onClick={() => row.patient_id && openPatient(row.patient_id, source, row.starts_at)}
              style={{
                display: "flex",
                width: "100%",
                gap: 18,
                textAlign: "left",
                background: "transparent",
                border: "none",
                borderTop: "1px solid #2c455f",
                color: "#f4f8fc",
                fontSize: 20,
                padding: "14px 0",
                cursor: "pointer",
              }}
            >
              <span style={{ width: 72, color: "#9eb2c6" }}>{formatTime(row.starts_at)}</span>
              <span>{row.patient_name || "Unnamed booking"}</span>
            </button>
          ))}
        </div>
      </section>

      {query.trim().length >= 2 ? (
        <section style={{ marginTop: 28 }}>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "#849aaf" }}>
            {practiceLabel(source)}
          </h2>
          {searching ? <p style={{ margin: "8px 0 0", fontSize: 19, color: "#9eb2c6" }}>Searching.</p> : null}
          {patientError ? <p style={{ margin: "8px 0 0", fontSize: 19, color: "#f0b4b4" }}>{patientError}</p> : null}
          {!searching && !patientError && patients.length === 0 ? (
            <p style={{ margin: "8px 0 0", fontSize: 19, color: "#9eb2c6" }}>No one matched that name.</p>
          ) : null}
          <div>
            {patients.map((person) => (
              <button
                key={person.id}
                type="button"
                onClick={() => openPatient(person.id, source)}
                style={{
                  display: "block",
                  width: "100%",
                  textAlign: "left",
                  background: "transparent",
                  border: "none",
                  borderTop: "1px solid #2c455f",
                  color: "#f4f8fc",
                  fontSize: 20,
                  padding: "14px 0",
                  cursor: "pointer",
                }}
              >
                {person.first_name} {person.last_name}
                {person.date_of_birth ? (
                  <span style={{ color: "#9eb2c6" }}> · {person.date_of_birth}</span>
                ) : null}
              </button>
            ))}
          </div>
        </section>
      ) : null}

      {engine && query.trim().length >= 3 ? (
        <section style={{ marginTop: 28 }}>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "#849aaf" }}>
            Saved {engine === "adhd" ? "ADHD" : "ASD"} reports
          </h2>
          {draftError ? <p style={{ margin: "8px 0 0", fontSize: 19, color: "#f0b4b4" }}>{draftError}</p> : null}
          {!draftError && drafts.length === 0 ? (
            <p style={{ margin: "8px 0 0", fontSize: 19, color: "#9eb2c6" }}>No saved report matched that name.</p>
          ) : null}
          <div>
            {drafts.map((row) => (
              <button
                key={`${row.source}:${row.patientId}`}
                type="button"
                onClick={() => openPatient(row.patientId, row.source)}
                style={{
                  display: "block",
                  width: "100%",
                  textAlign: "left",
                  background: "transparent",
                  border: "none",
                  borderTop: "1px solid #2c455f",
                  color: "#f4f8fc",
                  fontSize: 20,
                  padding: "14px 0",
                  cursor: "pointer",
                }}
              >
                {row.clientName}
                <span style={{ color: "#9eb2c6" }}> · {practiceLabel(row.source)}</span>
              </button>
            ))}
          </div>
        </section>
      ) : null}
      </div>
    </main>
  );
}
