"use client";

import { type CSSProperties, useCallback, useEffect, useMemo, useState } from "react";
import { dashboardLabel } from "@/lib/referral-intake/status";
import type { ReferralDashboardStatus, ReferralInboxRow } from "@/lib/referral-intake/types";

const STATUS_TABS: Array<ReferralDashboardStatus | "all"> = [
  "all",
  "new",
  "awaiting_review",
  "ready_for_contact",
  "contacted",
  "booked",
  "closed",
  "processing_error",
];

type InboxSource = "intake" | "legacy";

type Readiness = {
  intakeEnabled?: boolean;
  liveMailbox?: boolean;
  liveComms?: boolean;
  productionReady?: boolean;
  blockers?: string[];
  warnings?: string[];
  google?: {
    oauthConfigured?: boolean;
    redirectUri?: string;
    pubsubTopicPresent?: boolean;
  };
  mailboxes?: Array<{
    email: string;
    clinicSlug: string | null;
    active: boolean;
    watchExpiration: string | null;
    hasRefreshToken: boolean;
  }>;
  storage?: {
    bucket?: string;
    ready?: boolean;
  };
};

type OpsState = {
  autoReady?: {
    enabled: boolean;
    source: string;
    updatedAt?: string | null;
    updatedBy?: string | null;
    note?: string | null;
  };
  qa?: {
    target: number;
    pending: number;
    confirmed: number;
    incorrect: number;
    totalAutoReady: number;
  };
};

type ReviewDraft = {
  childFirst: string;
  childLast: string;
  childDob: string;
  parentFirst: string;
  parentLast: string;
  parentEmail: string;
  parentMobile: string;
  assessmentType: string;
  referrerName: string;
  referrerType: string;
  referrerEmail: string;
  notes: string;
  resolutions: Record<string, "excluded" | "accepted_same_patient" | "">;
};

function formatWhen(value: string | null | undefined): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString("en-AU", {
    timeZone: "Australia/Perth",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function childName(row: ReferralInboxRow): string {
  const name = [row.child_first_name, row.child_last_name].filter(Boolean).join(" ").trim();
  return name || "Unknown child";
}

function docLabel(doc: NonNullable<ReferralInboxRow["documents"]>[number]): string {
  if (doc.extraction_role === "conflict" || doc.identity_conflict) {
    if (doc.conflict_resolution === "excluded") return "excluded";
    if (doc.conflict_resolution === "accepted_same_patient") return "same patient";
    return "conflict";
  }
  if (doc.extraction_role === "primary") return "primary";
  if (doc.extraction_role === "supporting") return "supporting";
  if (doc.contains_referral_info) return "referral";
  return "stored";
}

function draftFromRow(row: ReferralInboxRow): ReviewDraft {
  const resolutions: ReviewDraft["resolutions"] = {};
  for (const doc of row.documents ?? []) {
    if (doc.extraction_role === "conflict" || doc.identity_conflict) {
      resolutions[doc.id] =
        doc.conflict_resolution === "excluded" || doc.conflict_resolution === "accepted_same_patient"
          ? doc.conflict_resolution
          : "";
    }
  }
  return {
    childFirst: row.child_first_name || "",
    childLast: row.child_last_name || "",
    childDob: row.child_dob || "",
    parentFirst: row.parent_first_name || "",
    parentLast: row.parent_last_name || "",
    parentEmail: row.parent_email || "",
    parentMobile: row.parent_mobile || "",
    assessmentType: row.assessment_type || "",
    referrerName: row.referring_practitioner || "",
    referrerType: row.referring_practitioner_type || "",
    referrerEmail: row.referring_practitioner_email || "",
    notes: typeof row.notes === "string" ? row.notes : "",
    resolutions,
  };
}

function unresolvedConflicts(row: ReferralInboxRow, draft: ReviewDraft): boolean {
  return (row.documents ?? []).some((doc) => {
    const conflict = doc.extraction_role === "conflict" || doc.identity_conflict;
    if (!conflict) return false;
    const res = draft.resolutions[doc.id] || doc.conflict_resolution || "";
    return res !== "excluded" && res !== "accepted_same_patient";
  });
}

export default function ReferralInboxPage() {
  const [clinic, setClinic] = useState("perth-paediatrics");
  const [source, setSource] = useState<InboxSource>("intake");
  const [status, setStatus] = useState<ReferralDashboardStatus | "all">("all");
  const [rows, setRows] = useState<ReferralInboxRow[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [legacyCount, setLegacyCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [readiness, setReadiness] = useState<Readiness | null>(null);
  const [ops, setOps] = useState<OpsState | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [oauthNote, setOauthNote] = useState<string | null>(null);
  const [reviewId, setReviewId] = useState<string | null>(null);
  const [draft, setDraft] = useState<ReviewDraft | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const oauth = params.get("oauth");
    if (oauth === "connected") {
      setOauthNote(
        `Mailbox connected: ${params.get("mailbox") || "ok"}. TEXLEX_REFERRAL_LIVE_COMMS stays off.`
      );
    } else if (oauth === "error") {
      setOauthNote(`OAuth failed: ${params.get("reason") || "unknown"}`);
    }
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [inboxRes, statusRes, opsRes] = await Promise.all([
        fetch(
          `/api/referral-intake/inbox?clinic=${encodeURIComponent(clinic)}&status=${encodeURIComponent(status)}&source=${encodeURIComponent(source)}`
        ),
        fetch("/api/referral-intake/status"),
        fetch("/api/referral-intake/ops"),
      ]);
      const inboxJson = (await inboxRes.json()) as {
        success: boolean;
        error?: string;
        data?: ReferralInboxRow[];
        counts?: Record<string, number>;
        legacyCount?: number;
        hint?: string;
      };
      const statusJson = (await statusRes.json()) as Readiness & { success?: boolean };
      const opsJson = (await opsRes.json()) as OpsState & { success?: boolean };
      setReadiness(statusJson);
      setOps(opsJson.success ? opsJson : null);
      if (!inboxJson.success) {
        setError([inboxJson.error, inboxJson.hint].filter(Boolean).join(" — "));
        setRows([]);
        setCounts({});
        setLegacyCount(0);
      } else {
        setRows(inboxJson.data ?? []);
        setCounts(inboxJson.counts ?? {});
        setLegacyCount(inboxJson.legacyCount ?? 0);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [clinic, status, source]);

  useEffect(() => {
    void load();
  }, [load]);

  const connectHref = useMemo(
    () => `/api/referral-intake/oauth/start?clinicSlug=${encodeURIComponent(clinic)}`,
    [clinic]
  );

  const reviewing = rows.find((r) => r.id === reviewId) ?? null;

  function openReview(row: ReferralInboxRow) {
    setReviewId(row.id);
    setDraft(draftFromRow(row));
    setError(null);
  }

  async function submitReview(approve: boolean) {
    if (!reviewing || !draft) return;
    if (approve && unresolvedConflicts(reviewing, draft)) {
      setError("Resolve every conflicting attachment before approving.");
      return;
    }
    if (approve && (!draft.childFirst.trim() || !draft.childLast.trim())) {
      setError("Child first and last name are required before approval.");
      return;
    }

    setBusyId(reviewing.id);
    try {
      const documentResolutions = Object.entries(draft.resolutions)
        .filter(([, resolution]) => resolution === "excluded" || resolution === "accepted_same_patient")
        .map(([documentId, resolution]) => ({
          documentId,
          resolution: resolution as "excluded" | "accepted_same_patient",
        }));

      const res = await fetch("/api/referral-intake/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          referralId: reviewing.id,
          dashboardStatus: approve ? "ready_for_contact" : "awaiting_review",
          fields: {
            childFirst: draft.childFirst,
            childLast: draft.childLast,
            childDob: draft.childDob,
            parentFirst: draft.parentFirst,
            parentLast: draft.parentLast,
            parentEmail: draft.parentEmail,
            parentMobile: draft.parentMobile,
            assessmentType: draft.assessmentType,
            referrerName: draft.referrerName,
            referrerType: draft.referrerType,
            referrerEmail: draft.referrerEmail,
            notes: draft.notes,
          },
          documentResolutions,
        }),
      });
      const json = (await res.json()) as { success: boolean; error?: string };
      if (!json.success) {
        setError(json.error || "Review update failed");
      } else {
        setReviewId(null);
        setDraft(null);
        await load();
      }
    } finally {
      setBusyId(null);
    }
  }

  async function toggleAutoReady(enabled: boolean) {
    setBusyId("ops");
    try {
      const res = await fetch("/api/referral-intake/ops", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          autoReadyEnabled: enabled,
          actor: "clinician",
          note: enabled
            ? "Auto-ready re-enabled from inbox"
            : "Emergency stop from inbox — force all new referrals to review",
        }),
      });
      const json = (await res.json()) as OpsState & { success?: boolean; error?: string; message?: string };
      if (!json.success) {
        setError(json.error || "Ops update failed");
      } else {
        setOps(json);
        setOauthNote(json.message || (enabled ? "Auto-ready ON" : "Auto-ready OFF"));
      }
    } finally {
      setBusyId(null);
    }
  }

  async function markAutoReadyQa(referralId: string, autoReadyQa: "confirmed" | "incorrect") {
    setBusyId(referralId);
    try {
      const res = await fetch("/api/referral-intake/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ referralId, autoReadyQa, actor: "clinician" }),
      });
      const json = (await res.json()) as { success: boolean; error?: string };
      if (!json.success) {
        setError(json.error || "QA update failed");
      } else {
        await load();
      }
    } finally {
      setBusyId(null);
    }
  }

  async function updateStatus(referralId: string, dashboardStatus: ReferralDashboardStatus) {
    setBusyId(referralId);
    try {
      const res = await fetch("/api/referral-intake/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          referralId,
          dashboardStatus,
          markFirstContact: dashboardStatus === "contacted",
        }),
      });
      const json = (await res.json()) as { success: boolean; error?: string };
      if (!json.success) {
        setError(json.error || "Update failed");
      } else {
        await load();
      }
    } finally {
      setBusyId(null);
    }
  }

  return (
    <main
      className="texlex-surface"
      style={{
        minHeight: "100vh",
        background: "linear-gradient(165deg, #0c1826 0%, #13273a 48%, #0f1f30 100%)",
        color: "#e8f0f8",
        fontFamily: "var(--font-geist-sans), ui-sans-serif, system-ui, sans-serif",
        padding: "28px 20px 64px",
      }}
    >
      <div style={{ maxWidth: 1180, margin: "0 auto" }}>
        <header style={{ marginBottom: 22 }}>
          <p style={{ margin: 0, color: "#8eabc4", fontSize: 13, letterSpacing: "0.08em" }}>
            TEXLEX · INBOUND REFERRALS
          </p>
          <h1
            style={{
              margin: "8px 0 0",
              fontSize: 36,
              fontWeight: 560,
              letterSpacing: "-0.03em",
              lineHeight: 1.15,
            }}
          >
            Automated intake
          </h1>
          <p style={{ margin: "10px 0 0", color: "#b7c9db", maxWidth: 720, lineHeight: 1.45 }}>
            Clean referrals go straight to Ready for contact. Staff only handle exceptions — identity
            mismatches, missing parent contact, unclear scans, or duplicates. Parent email/SMS stay off.
          </p>
        </header>

        <section
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
            gap: 10,
            marginBottom: 18,
          }}
        >
          {(
            [
              {
                label: "Auto-ready",
                value: counts.ready_for_contact ?? 0,
                hint: "No staff handling needed",
                onClick: () => setStatus("ready_for_contact"),
              },
              {
                label: "Need review",
                value: counts.awaiting_review ?? 0,
                hint: "Exceptions only",
                onClick: () => setStatus("awaiting_review"),
              },
              {
                label: "Processing errors",
                value: counts.processing_error ?? 0,
                hint: "Failed extraction",
                onClick: () => setStatus("processing_error"),
              },
            ] as const
          ).map((card) => (
            <button
              key={card.label}
              type="button"
              onClick={card.onClick}
              style={{
                textAlign: "left",
                border: "1px solid #2c4560",
                borderRadius: 12,
                padding: "14px 16px",
                background: status === (
                  card.label === "Auto-ready"
                    ? "ready_for_contact"
                    : card.label === "Need review"
                      ? "awaiting_review"
                      : "processing_error"
                )
                  ? "#1a3348"
                  : "#122233",
                color: "#e8f0f8",
                cursor: "pointer",
              }}
            >
              <div style={{ fontSize: 28, fontWeight: 600, letterSpacing: "-0.03em" }}>{card.value}</div>
              <div style={{ marginTop: 4, fontSize: 14, color: "#d7e6f5" }}>{card.label}</div>
              <div style={{ marginTop: 2, fontSize: 12, color: "#8eabc4" }}>{card.hint}</div>
            </button>
          ))}
        </section>

        <section
          style={{
            border: "1px solid #2c4560",
            borderRadius: 12,
            padding: 14,
            marginBottom: 18,
            background: "#122233",
            display: "flex",
            flexWrap: "wrap",
            gap: 12,
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div>
            <div style={{ fontSize: 14, fontWeight: 600 }}>
              Auto-ready{" "}
              <span style={{ color: ops?.autoReady?.enabled === false ? "#e8b86d" : "#9dcea8" }}>
                {ops?.autoReady?.enabled === false ? "OFF (force review)" : "ON"}
              </span>
              <span style={{ color: "#8eabc4", fontWeight: 400, marginLeft: 8, fontSize: 12 }}>
                {ops?.autoReady?.source === "db" ? "DB switch · live ≤3s" : ops?.autoReady?.source || "…"}
              </span>
            </div>
            <div style={{ color: "#8eabc4", fontSize: 12, marginTop: 4 }}>
              QA sample: {ops?.qa?.confirmed ?? 0} confirmed · {ops?.qa?.incorrect ?? 0} incorrect ·{" "}
              {ops?.qa?.pending ?? 0} pending of first {ops?.qa?.target ?? 50} auto-ready
              {(ops?.qa?.incorrect ?? 0) > 0 ? " — wrong-patient target is 0" : ""}
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button
              type="button"
              disabled={busyId === "ops" || ops?.autoReady?.enabled === false}
              onClick={() => void toggleAutoReady(false)}
              style={{
                ...actionBtnStyle,
                background: "#3a2a1a",
                borderColor: "#8a6a3a",
                color: "#f0d9a8",
                opacity: ops?.autoReady?.enabled === false ? 0.5 : 1,
              }}
            >
              Emergency stop
            </button>
            <button
              type="button"
              disabled={busyId === "ops" || ops?.autoReady?.enabled === true}
              onClick={() => void toggleAutoReady(true)}
              style={{
                ...actionBtnStyle,
                opacity: ops?.autoReady?.enabled === true ? 0.5 : 1,
              }}
            >
              Resume auto-ready
            </button>
          </div>
        </section>

        <section
          style={{
            border: "1px solid #2c4560",
            borderRadius: 12,
            padding: 16,
            marginBottom: 18,
            background: "#122233",
          }}
        >
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 10,
              alignItems: "center",
              marginBottom: 12,
            }}
          >
            <strong style={{ fontSize: 15 }}>
              {readiness?.productionReady ? "Production ready" : "Go-live checklist"}
            </strong>
            <span style={pillStyle}>
              Intake {readiness?.intakeEnabled ? "on" : "off"} · Mailbox{" "}
              {readiness?.liveMailbox ? "LIVE" : "safe"} · Comms{" "}
              {readiness?.liveComms ? "flag on" : "off"} · Storage{" "}
              {readiness?.storage?.ready ? readiness.storage.bucket || "ready" : "missing"}
            </span>
            <select
              value={clinic}
              onChange={(e) => setClinic(e.target.value)}
              style={selectStyle}
              aria-label="Clinic"
            >
              <option value="perth-paediatrics">Perth Paediatrics</option>
              <option value="azure-mind">Azure Mind</option>
            </select>
            <a href={connectHref} style={{ ...actionBtnStyle, textDecoration: "none" }}>
              Connect Gmail mailbox
            </a>
            <button type="button" onClick={() => void load()} style={actionBtnStyle}>
              Refresh
            </button>
          </div>

          {oauthNote ? (
            <p style={{ margin: "0 0 10px", color: "#d7e6f5", fontSize: 13 }}>{oauthNote}</p>
          ) : null}

          {(readiness?.mailboxes?.length ?? 0) > 0 ? (
            <ul style={{ margin: "0 0 10px", paddingLeft: 18, color: "#b7c9db", fontSize: 13 }}>
              {readiness!.mailboxes!.map((m) => (
                <li key={m.email}>
                  {m.email}
                  {m.hasRefreshToken ? " · token saved" : " · missing token"}
                  {m.watchExpiration ? ` · watch until ${formatWhen(m.watchExpiration)}` : ""}
                </li>
              ))}
            </ul>
          ) : (
            <p style={{ margin: "0 0 10px", color: "#8eabc4", fontSize: 13 }}>
              No mailbox connected yet.
            </p>
          )}

          {(readiness?.blockers?.length ?? 0) > 0 ? (
            <ol style={{ margin: 0, paddingLeft: 18, color: "#f0d9a8", fontSize: 13 }}>
              {readiness!.blockers!.map((b) => (
                <li key={b}>{b}</li>
              ))}
            </ol>
          ) : (
            <p style={{ margin: 0, color: "#9dcea8", fontSize: 13 }}>
              All blockers clear. Live mailbox processing is on.
            </p>
          )}
        </section>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
          <button
            type="button"
            onClick={() => setSource("intake")}
            style={{
              ...actionBtnStyle,
              background: source === "intake" ? "#2a4d70" : "transparent",
            }}
          >
            Inbound referrals
          </button>
          <button
            type="button"
            onClick={() => setSource("legacy")}
            style={{
              ...actionBtnStyle,
              background: source === "legacy" ? "#2a4d70" : "transparent",
            }}
          >
            Legacy records ({legacyCount})
          </button>
        </div>

        <div
          role="tablist"
          aria-label="Referral status"
          style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 18 }}
        >
          {STATUS_TABS.map((tab) => {
            const active = status === tab;
            const count =
              tab === "all" ? Object.values(counts).reduce((a, b) => a + b, 0) : counts[tab] ?? 0;
            return (
              <button
                key={tab}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setStatus(tab)}
                style={{
                  background: active ? "#2a4d70" : "transparent",
                  color: active ? "#f2f7fc" : "#9eb4c8",
                  border: `1px solid ${active ? "#4d78a3" : "#2c4560"}`,
                  borderRadius: 8,
                  padding: "8px 12px",
                  cursor: "pointer",
                  fontSize: 13,
                }}
              >
                {tab === "all" ? "All" : dashboardLabel(tab)}
                <span style={{ marginLeft: 8, opacity: 0.75 }}>{count}</span>
              </button>
            );
          })}
        </div>

        {error ? (
          <p
            role="alert"
            style={{
              background: "#3a1f24",
              border: "1px solid #7a3a44",
              color: "#f2d5d8",
              padding: "12px 14px",
              borderRadius: 10,
              marginBottom: 16,
            }}
          >
            {error}
          </p>
        ) : null}

        {reviewing && draft ? (
          <section
            style={{
              border: "1px solid #4d78a3",
              borderRadius: 12,
              padding: 18,
              marginBottom: 18,
              background: "#152636",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
              <div>
                <p style={{ margin: 0, color: "#e8b86d", fontSize: 13, fontWeight: 600 }}>
                  Needs review
                </p>
                <h2 style={{ margin: "6px 0 0", fontSize: 22, fontWeight: 560 }}>
                  {childName(reviewing)}
                </h2>
              </div>
              <button type="button" style={actionBtnStyle} onClick={() => { setReviewId(null); setDraft(null); }}>
                Close review
              </button>
            </div>

            {(reviewing.patient_identity_conflict ||
              (reviewing.documents ?? []).some(
                (d) => d.extraction_role === "conflict" || d.identity_conflict
              )) && (
              <p
                style={{
                  margin: "14px 0 0",
                  padding: "10px 12px",
                  borderRadius: 8,
                  background: "#3a2a18",
                  border: "1px solid #8a6a3a",
                  color: "#f0d9a8",
                  fontSize: 13,
                  lineHeight: 1.4,
                }}
              >
                Patient identity requires confirmation. Primary and supporting documents contain
                different patient names. Resolve each conflict before approving — conflicting fields
                were not merged.
              </p>
            )}

            {(Array.isArray(reviewing.extraction_warnings)
              ? reviewing.extraction_warnings
              : []
            ).length > 0 ? (
              <ul style={{ margin: "12px 0 0", paddingLeft: 18, color: "#c9d7e6", fontSize: 12 }}>
                {(reviewing.extraction_warnings as string[]).slice(0, 8).map((w) => (
                  <li key={w}>{w}</li>
                ))}
              </ul>
            ) : null}

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                gap: 10,
                marginTop: 16,
              }}
            >
              {(
                [
                  ["childFirst", "Child first name"],
                  ["childLast", "Child last name"],
                  ["childDob", "Date of birth"],
                  ["parentFirst", "Parent first name"],
                  ["parentLast", "Parent last name"],
                  ["parentEmail", "Parent email"],
                  ["parentMobile", "Parent mobile"],
                  ["assessmentType", "Assessment"],
                  ["referrerName", "Referring GP"],
                  ["referrerType", "Referrer type"],
                  ["referrerEmail", "Referrer email"],
                ] as const
              ).map(([key, label]) => (
                <label key={key} style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12 }}>
                  <span style={{ color: "#9eb4c8" }}>{label}</span>
                  <input
                    value={draft[key]}
                    onChange={(e) => setDraft({ ...draft, [key]: e.target.value })}
                    style={inputStyle}
                  />
                </label>
              ))}
            </div>

            <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12, marginTop: 10 }}>
              <span style={{ color: "#9eb4c8" }}>Internal notes</span>
              <textarea
                value={draft.notes}
                onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
                rows={3}
                style={{ ...inputStyle, resize: "vertical" }}
              />
            </label>

            <div style={{ marginTop: 16 }}>
              <p style={{ margin: "0 0 8px", fontWeight: 600, fontSize: 14 }}>Attached documents</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {(reviewing.documents ?? []).map((doc) => {
                  const conflict = doc.extraction_role === "conflict" || doc.identity_conflict;
                  const extractedName = [doc.extracted_child_first, doc.extracted_child_last]
                    .filter(Boolean)
                    .join(" ");
                  return (
                    <div
                      key={doc.id}
                      style={{
                        border: `1px solid ${conflict ? "#8a6a3a" : "#2c4560"}`,
                        borderRadius: 8,
                        padding: 12,
                        background: conflict ? "#241c12" : "#122233",
                      }}
                    >
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
                        <a
                          href={`/api/referral-intake/documents/${doc.id}?download=1`}
                          target="_blank"
                          rel="noreferrer"
                          style={{ color: "#9ec5e8", fontSize: 13 }}
                        >
                          {doc.filename}
                        </a>
                        <span style={{ color: "#8eabc4", fontSize: 12 }}>({docLabel(doc)})</span>
                        {extractedName ? (
                          <span style={{ color: "#c9d7e6", fontSize: 12 }}>
                            Extracted: {extractedName}
                            {doc.extracted_child_dob ? ` · DOB ${doc.extracted_child_dob}` : ""}
                          </span>
                        ) : null}
                      </div>
                      {conflict ? (
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 10 }}>
                          <button
                            type="button"
                            style={{
                              ...actionBtnStyle,
                              background:
                                draft.resolutions[doc.id] === "excluded" ? "#5a3a2a" : "#1f3a55",
                            }}
                            onClick={() =>
                              setDraft({
                                ...draft,
                                resolutions: { ...draft.resolutions, [doc.id]: "excluded" },
                              })
                            }
                          >
                            Exclude from this referral
                          </button>
                          <button
                            type="button"
                            style={{
                              ...actionBtnStyle,
                              background:
                                draft.resolutions[doc.id] === "accepted_same_patient"
                                  ? "#2a4d40"
                                  : "#1f3a55",
                            }}
                            onClick={() =>
                              setDraft({
                                ...draft,
                                resolutions: {
                                  ...draft.resolutions,
                                  [doc.id]: "accepted_same_patient",
                                },
                              })
                            }
                          >
                            Confirm same patient
                          </button>
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>

            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 16 }}>
              <button
                type="button"
                disabled={busyId === reviewing.id}
                onClick={() => void submitReview(false)}
                style={actionBtnStyle}
              >
                Save corrections
              </button>
              <button
                type="button"
                disabled={
                  busyId === reviewing.id || unresolvedConflicts(reviewing, draft)
                }
                onClick={() => void submitReview(true)}
                style={{
                  ...actionBtnStyle,
                  background: unresolvedConflicts(reviewing, draft) ? "#2a3540" : "#2a5a40",
                  opacity: unresolvedConflicts(reviewing, draft) ? 0.55 : 1,
                }}
                title={
                  unresolvedConflicts(reviewing, draft)
                    ? "Resolve conflicts before approving"
                    : "Approve referral"
                }
              >
                Approve referral
              </button>
            </div>
          </section>
        ) : null}

        {loading ? (
          <p style={{ color: "#9eb4c8" }}>Loading referrals…</p>
        ) : rows.length === 0 ? (
          <p style={{ color: "#9eb4c8" }}>
            {source === "legacy"
              ? "No legacy records in this clinic view."
              : "No inbound referrals yet. Send a test attachment to the clinic mailbox."}
          </p>
        ) : (
          <div style={{ overflowX: "auto", border: "1px solid #2c4560", borderRadius: 12 }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
              <thead>
                <tr style={{ background: "#152636", textAlign: "left" }}>
                  {[
                    "Child",
                    "Assessment",
                    "Referring GP",
                    "Document",
                    "Received",
                    "Status",
                    "Review",
                    "Actions",
                  ].map((h) => (
                    <th
                      key={h}
                      style={{
                        padding: "12px 14px",
                        color: "#9eb4c8",
                        fontWeight: 600,
                        whiteSpace: "nowrap",
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} style={{ borderTop: "1px solid #24384d" }}>
                    <td style={{ padding: "12px 14px", verticalAlign: "top" }}>
                      <div style={{ fontWeight: 600 }}>{childName(row)}</div>
                      <div style={{ color: "#8eabc4", fontSize: 12, marginTop: 2 }}>
                        {[row.parent_first_name, row.parent_last_name].filter(Boolean).join(" ") ||
                          "Parent unknown"}
                      </div>
                    </td>
                    <td style={{ padding: "12px 14px", verticalAlign: "top" }}>
                      {row.assessment_type || "—"}
                    </td>
                    <td style={{ padding: "12px 14px", verticalAlign: "top" }}>
                      {row.referring_practitioner || "—"}
                    </td>
                    <td style={{ padding: "12px 14px", verticalAlign: "top" }}>
                      {(row.documents?.length ?? 0) > 0 ? (
                        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                          {row.documents!.map((doc) => (
                            <a
                              key={doc.id}
                              href={`/api/referral-intake/documents/${doc.id}?download=1`}
                              target="_blank"
                              rel="noreferrer"
                              style={{
                                color:
                                  doc.extraction_role === "conflict" || doc.identity_conflict
                                    ? "#e8b86d"
                                    : "#9ec5e8",
                                textDecoration: "underline",
                                fontSize: 12,
                              }}
                            >
                              {doc.filename}
                              <span style={{ color: "#8eabc4", marginLeft: 6 }}>
                                ({docLabel(doc)})
                              </span>
                            </a>
                          ))}
                        </div>
                      ) : (
                        <span style={{ color: "#8eabc4" }}>—</span>
                      )}
                    </td>
                    <td style={{ padding: "12px 14px", verticalAlign: "top", whiteSpace: "nowrap" }}>
                      {formatWhen(row.received_at || row.created_at)}
                    </td>
                    <td style={{ padding: "12px 14px", verticalAlign: "top" }}>
                      {dashboardLabel(row.dashboard_status)}
                      {row.patient_identity_conflict ? (
                        <div style={{ color: "#e8b86d", fontSize: 11, marginTop: 4 }}>
                          Identity conflict
                        </div>
                      ) : null}
                      {row.auto_ready_at && !row.needs_human_review ? (
                        <div style={{ color: "#9dcea8", fontSize: 11, marginTop: 4 }}>
                          Auto-verified
                          {row.auto_ready_qa_status === "pending"
                            ? " · QA pending"
                            : row.auto_ready_qa_status === "confirmed"
                              ? " · QA confirmed"
                              : row.auto_ready_qa_status === "incorrect"
                                ? " · QA incorrect"
                                : ""}
                        </div>
                      ) : null}
                      {Array.isArray(row.extraction_warnings)
                        ? (row.extraction_warnings as string[])
                            .filter((w) => /^Auto-verify held/i.test(w))
                            .slice(0, 2)
                            .map((w) => (
                              <div key={w} style={{ color: "#e8b86d", fontSize: 11, marginTop: 4 }}>
                                {w.replace(/^Auto-verify held for review:\s*/i, "")}
                              </div>
                            ))
                        : null}
                    </td>
                    <td style={{ padding: "12px 14px", verticalAlign: "top" }}>
                      {row.needs_human_review || row.patient_identity_conflict ? (
                        <span style={{ color: "#e8b86d" }}>Needs review</span>
                      ) : (
                        <span style={{ color: "#8eabc4" }}>Clear</span>
                      )}
                    </td>
                    <td style={{ padding: "12px 14px", verticalAlign: "top" }}>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                        {row.dashboard_status === "awaiting_review" ||
                        row.dashboard_status === "processing_error" ||
                        row.patient_identity_conflict ||
                        row.needs_human_review ? (
                          <button
                            type="button"
                            disabled={busyId === row.id}
                            onClick={() => openReview(row)}
                            style={actionBtnStyle}
                          >
                            Review
                          </button>
                        ) : null}
                        {row.auto_ready_at && row.auto_ready_qa_status === "pending" ? (
                          <>
                            <button
                              type="button"
                              disabled={busyId === row.id}
                              onClick={() => void markAutoReadyQa(row.id, "confirmed")}
                              style={actionBtnStyle}
                            >
                              QA OK
                            </button>
                            <button
                              type="button"
                              disabled={busyId === row.id}
                              onClick={() => void markAutoReadyQa(row.id, "incorrect")}
                              style={{
                                ...actionBtnStyle,
                                background: "#3a2a1a",
                                borderColor: "#8a6a3a",
                                color: "#f0d9a8",
                              }}
                            >
                              QA wrong
                            </button>
                          </>
                        ) : null}
                        {row.dashboard_status === "ready_for_contact" ? (
                          <button
                            type="button"
                            disabled={busyId === row.id}
                            onClick={() => void updateStatus(row.id, "contacted")}
                            style={actionBtnStyle}
                          >
                            Mark contacted
                          </button>
                        ) : null}
                        {row.dashboard_status === "contacted" ? (
                          <button
                            type="button"
                            disabled={busyId === row.id}
                            onClick={() => void updateStatus(row.id, "booked")}
                            style={actionBtnStyle}
                          >
                            Mark booked
                          </button>
                        ) : null}
                        {row.dashboard_status !== "closed" ? (
                          <button
                            type="button"
                            disabled={busyId === row.id}
                            onClick={() => void updateStatus(row.id, "closed")}
                            style={{ ...actionBtnStyle, opacity: 0.85 }}
                          >
                            Close
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  );
}

const actionBtnStyle: CSSProperties = {
  background: "#1f3a55",
  color: "#e8f0f8",
  border: "1px solid #3a5f82",
  borderRadius: 6,
  padding: "8px 12px",
  cursor: "pointer",
  fontSize: 12,
};

const selectStyle: CSSProperties = {
  background: "#172a3d",
  color: "#e8f0f8",
  border: "1px solid #2c4560",
  borderRadius: 8,
  padding: "8px 12px",
};

const inputStyle: CSSProperties = {
  background: "#0f1f30",
  color: "#e8f0f8",
  border: "1px solid #2c4560",
  borderRadius: 6,
  padding: "8px 10px",
  fontSize: 13,
};

const pillStyle: CSSProperties = {
  fontSize: 12,
  color: "#8eabc4",
  border: "1px solid #2c4560",
  borderRadius: 999,
  padding: "6px 12px",
};
