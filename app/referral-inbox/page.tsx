"use client";

import { type CSSProperties, useCallback, useEffect, useMemo, useState } from "react";
import { dashboardLabel } from "@/lib/referral-intake/status";
import type { ReferralDashboardStatus, ReferralInboxRow } from "@/lib/referral-intake/types";

const STATUS_TABS: Array<ReferralDashboardStatus | "all"> = [
  "all",
  "awaiting_review",
  "ready_for_contact",
  "contact_attempted",
  "contacted",
  "booked",
  "processing_error",
];

type ContactChannel = "email" | "sms" | "email+sms";

type ContactPreview = {
  subject: string;
  emailHtml: string;
  sms: string;
};

type InboxSource = "intake" | "legacy";

type Readiness = {
  intakeEnabled?: boolean;
  liveMailbox?: boolean;
  liveComms?: boolean;
  autoFirstContact?: boolean;
  productionReady?: boolean;
  blockers?: string[];
  mailboxes?: Array<{
    email: string;
    clinicSlug: string | null;
    active: boolean;
    watchExpiration: string | null;
    hasRefreshToken: boolean;
  }>;
  storage?: { bucket?: string; ready?: boolean };
};

type OpsState = {
  autoReady?: {
    enabled: boolean;
    source: string;
  };
  qa?: {
    target: number;
    pending: number;
    confirmed: number;
    incorrect: number;
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

function parentName(row: ReferralInboxRow): string {
  return [row.parent_first_name, row.parent_last_name].filter(Boolean).join(" ").trim() || "—";
}

function parentContact(row: ReferralInboxRow): string {
  return [row.parent_mobile, row.parent_email].filter(Boolean).join(" · ") || "—";
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

function needsExceptionReview(row: ReferralInboxRow): boolean {
  return Boolean(
    row.needs_human_review ||
      row.patient_identity_conflict ||
      row.dashboard_status === "awaiting_review" ||
      row.dashboard_status === "processing_error"
  );
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
  const [caseId, setCaseId] = useState<string | null>(null);
  const [draft, setDraft] = useState<ReviewDraft | null>(null);
  const [contactChannel, setContactChannel] = useState<ContactChannel>("email+sms");
  const [contactPreview, setContactPreview] = useState<ContactPreview | null>(null);
  const [contactNote, setContactNote] = useState<string | null>(null);
  const [liveComms, setLiveComms] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const oauth = params.get("oauth");
    if (oauth === "connected") {
      setOauthNote(`Mailbox connected: ${params.get("mailbox") || "ok"}. Parent email/SMS stay off.`);
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
        liveCommsEnabled?: boolean;
      };
      const statusJson = (await statusRes.json()) as Readiness & { success?: boolean };
      const opsJson = (await opsRes.json()) as OpsState & { success?: boolean };
      setReadiness(statusJson);
      setOps(opsJson.success ? opsJson : null);
      if (typeof inboxJson.liveCommsEnabled === "boolean") {
        setLiveComms(inboxJson.liveCommsEnabled);
      } else if (typeof statusJson.liveComms === "boolean") {
        setLiveComms(statusJson.liveComms);
      }
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

  const activeCase = rows.find((r) => r.id === caseId) ?? null;
  const exceptionMode = activeCase ? needsExceptionReview(activeCase) : false;

  function openCase(row: ReferralInboxRow) {
    setCaseId(row.id);
    setDraft(draftFromRow(row));
    setContactPreview(null);
    setContactNote(null);
    setError(null);
    const hasEmail = Boolean(row.parent_email?.trim());
    const hasMobile = Boolean(row.parent_mobile?.trim());
    setContactChannel(hasEmail && hasMobile ? "email+sms" : hasEmail ? "email" : hasMobile ? "sms" : "email+sms");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function closeCase() {
    setCaseId(null);
    setDraft(null);
    setContactPreview(null);
    setContactNote(null);
  }

  async function runContact(mode: "preview" | "simulate" | "live") {
    if (!activeCase || !draft) return;
    if (unresolvedConflicts(activeCase, draft)) {
      setError("Resolve document patient conflicts before messaging.");
      return;
    }
    setBusyId(activeCase.id);
    setContactNote(null);
    try {
      const res = await fetch("/api/referral-intake/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          referralId: activeCase.id,
          channel: contactChannel,
          mode,
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
          },
        }),
      });
      const json = (await res.json()) as {
        success?: boolean;
        error?: string;
        dryRun?: boolean;
        simulated?: boolean;
        emailSent?: boolean;
        smsSent?: boolean;
        message?: string;
        liveCommsEnabled?: boolean;
        preview?: ContactPreview | null;
        dashboardStatus?: string;
      };
      if (typeof json.liveCommsEnabled === "boolean") setLiveComms(json.liveCommsEnabled);
      if (!json.success) {
        setError(json.error || "Contact action failed");
        if (json.preview) setContactPreview(json.preview);
        return;
      }
      if (json.preview) setContactPreview(json.preview);
      setContactNote(
        json.message ||
          (json.simulated
            ? "Simulation only — status unchanged."
            : json.dryRun
              ? "Preview ready — status unchanged."
              : "Sent.")
      );
      // Only reload after a real (or synthetic-delivery) send that changes status.
      if (!json.dryRun && !json.simulated && (json.emailSent || json.smsSent)) {
        await load();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusyId(null);
    }
  }

  async function openDocument(docId: string) {
    setError(null);
    try {
      const res = await fetch(`/api/referral-intake/documents/${docId}`);
      const json = (await res.json()) as { success?: boolean; url?: string; error?: string };
      if (!json.success || !json.url) {
        setError(json.error || "Could not open document");
        return;
      }
      window.open(json.url, "_blank", "noopener,noreferrer");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function submitReview(approve: boolean) {
    if (!activeCase || !draft) return;
    if (approve && unresolvedConflicts(activeCase, draft)) {
      setError("Resolve every conflicting attachment before approving.");
      return;
    }
    if (approve && (!draft.childFirst.trim() || !draft.childLast.trim())) {
      setError("Child first and last name are required before approval.");
      return;
    }

    setBusyId(activeCase.id);
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
          referralId: activeCase.id,
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
        closeCase();
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
        body: JSON.stringify({ referralId, dashboardStatus, actor: "clinician" }),
      });
      const json = (await res.json()) as { success: boolean; error?: string };
      if (!json.success) {
        setError(json.error || "Update failed");
      } else {
        if (caseId === referralId && dashboardStatus !== "awaiting_review") {
          closeCase();
        }
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
            One referral case: intake extraction, original letter, and booking email/SMS in the same
            place. Sending records Contact attempted. Mark contacted is for phone conversations only.
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
                label: "Ready for contact",
                value: counts.ready_for_contact ?? 0,
                hint: "Preview / send booking message",
                tab: "ready_for_contact" as const,
              },
              {
                label: "Need review",
                value: counts.awaiting_review ?? 0,
                hint: "Exceptions only",
                tab: "awaiting_review" as const,
              },
              {
                label: "Contact attempted",
                value: counts.contact_attempted ?? 0,
                hint: "Email/SMS sent — awaiting reply",
                tab: "contact_attempted" as const,
              },
              {
                label: "Contacted",
                value: counts.contacted ?? 0,
                hint: "Phone / reply confirmed",
                tab: "contacted" as const,
              },
            ] as const
          ).map((card) => (
            <button
              key={card.label}
              type="button"
              onClick={() => {
                closeCase();
                setStatus(card.tab);
              }}
              style={{
                textAlign: "left",
                border: "1px solid #2c4560",
                borderRadius: 12,
                padding: "14px 16px",
                background: status === card.tab ? "#1a3348" : "#122233",
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
                {ops?.autoReady?.enabled === false ? "OFF" : "ON"}
              </span>
              <span style={{ color: "#8eabc4", fontWeight: 400, marginLeft: 8, fontSize: 12 }}>
                Mailbox {readiness?.liveMailbox ? "LIVE" : "off"} · Manual send{" "}
                {liveComms || readiness?.liveComms ? "LIVE" : "off"} · Auto-first{" "}
                {readiness?.autoFirstContact ? "ON" : "off"} · Storage{" "}
                {readiness?.storage?.ready ? "ready" : "missing"}
              </span>
            </div>
            <div style={{ color: "#8eabc4", fontSize: 12, marginTop: 4 }}>
              {(readiness?.mailboxes ?? [])
                .map((m) => `${m.email}${m.watchExpiration ? ` · watch until ${formatWhen(m.watchExpiration)}` : ""}`)
                .join(" · ") || "No mailbox connected"}
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <select
              value={clinic}
              onChange={(e) => setClinic(e.target.value)}
              style={selectStyle}
              aria-label="Clinic"
            >
              <option value="perth-paediatrics">Perth Paediatrics</option>
              <option value="azure-mind">Azure Mind</option>
            </select>
            <button type="button" onClick={() => void load()} style={actionBtnStyle}>
              Refresh
            </button>
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
            <a href={connectHref} style={{ ...actionBtnStyle, textDecoration: "none" }}>
              Connect Gmail
            </a>
          </div>
        </section>

        {oauthNote ? (
          <p style={{ margin: "0 0 14px", color: "#d7e6f5", fontSize: 13 }}>{oauthNote}</p>
        ) : null}

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

        {activeCase && draft ? (
          <section
            style={{
              border: "1px solid #4d78a3",
              borderRadius: 14,
              padding: 22,
              background: "#152636",
              marginBottom: 18,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
              <div>
                <p style={{ margin: 0, color: exceptionMode ? "#e8b86d" : "#9dcea8", fontSize: 13, fontWeight: 600 }}>
                  {exceptionMode ? "Exception review" : "Referral case"}
                </p>
                <h2 style={{ margin: "6px 0 0", fontSize: 28, fontWeight: 560 }}>{childName(activeCase)}</h2>
                <p style={{ margin: "8px 0 0", color: "#b7c9db", fontSize: 14 }}>
                  {dashboardLabel(activeCase.dashboard_status)}
                  {activeCase.child_dob ? ` · DOB ${activeCase.child_dob}` : ""}
                  {activeCase.assessment_type ? ` · ${activeCase.assessment_type}` : ""}
                </p>
              </div>
              <button type="button" style={actionBtnStyle} onClick={closeCase}>
                Back to list
              </button>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                gap: 12,
                marginTop: 18,
                padding: 14,
                borderRadius: 10,
                background: "#122233",
                border: "1px solid #2c4560",
              }}
            >
              <div>
                <div style={metaLabel}>Parent / guardian</div>
                <div style={metaValue}>{parentName(activeCase)}</div>
              </div>
              <div>
                <div style={metaLabel}>Contact</div>
                <div style={metaValue}>{parentContact(activeCase)}</div>
              </div>
              <div>
                <div style={metaLabel}>Referring GP</div>
                <div style={metaValue}>{activeCase.referring_practitioner || "—"}</div>
              </div>
              <div>
                <div style={metaLabel}>Received</div>
                <div style={metaValue}>{formatWhen(activeCase.received_at || activeCase.created_at)}</div>
              </div>
            </div>

            {(Array.isArray(activeCase.extraction_warnings) ? activeCase.extraction_warnings : []).length > 0 ? (
              <ul style={{ margin: "14px 0 0", paddingLeft: 18, color: "#f0d9a8", fontSize: 13 }}>
                {(activeCase.extraction_warnings as string[]).slice(0, 8).map((w) => (
                  <li key={w}>{w}</li>
                ))}
              </ul>
            ) : null}

            <div
              style={{
                marginTop: 16,
                display: "flex",
                flexWrap: "wrap",
                gap: 8,
                alignItems: "center",
                fontSize: 12,
                color: "#9eb4c8",
              }}
            >
              <span style={{ fontWeight: 600, color: "#d7e6f5" }}>Case history</span>
              {(
                [
                  ["Received", true],
                  [
                    "Verified",
                    activeCase.dashboard_status !== "awaiting_review" &&
                      activeCase.dashboard_status !== "processing_error" &&
                      activeCase.dashboard_status !== "new",
                  ],
                  ["Cliniko linked", Boolean(activeCase.cliniko_patient_id)],
                  [
                    "Contact attempted",
                    activeCase.contact_status === "contact_attempted" ||
                      activeCase.contact_status === "contacted" ||
                      Boolean(activeCase.sent_email || activeCase.sent_sms) ||
                      activeCase.dashboard_status === "contact_attempted" ||
                      activeCase.dashboard_status === "contacted" ||
                      activeCase.dashboard_status === "booked",
                  ],
                  [
                    "Contacted",
                    activeCase.contact_status === "contacted" ||
                      activeCase.dashboard_status === "contacted" ||
                      activeCase.dashboard_status === "booked",
                  ],
                  ["Booked", activeCase.dashboard_status === "booked"],
                ] as const
              ).map(([label, done], index) => (
                <span key={label} style={{ color: done ? "#9dcea8" : "#5f7a92" }}>
                  {index > 0 ? " → " : ""}
                  {label}
                </span>
              ))}
            </div>

            <div style={{ marginTop: 18 }}>
              <p style={{ margin: "0 0 8px", fontWeight: 600, fontSize: 15 }}>Original documents</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {(activeCase.documents ?? []).map((doc) => {
                  const conflict = doc.extraction_role === "conflict" || doc.identity_conflict;
                  const extractedName = [doc.extracted_child_first, doc.extracted_child_last]
                    .filter(Boolean)
                    .join(" ");
                  return (
                    <div
                      key={doc.id}
                      style={{
                        border: `1px solid ${conflict ? "#8a6a3a" : "#2c4560"}`,
                        borderRadius: 10,
                        padding: 14,
                        background: conflict ? "#241c12" : "#122233",
                      }}
                    >
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
                        <button
                          type="button"
                          onClick={() => void openDocument(doc.id)}
                          style={{
                            ...actionBtnStyle,
                            background: "#1f4d72",
                          }}
                        >
                          Open {doc.filename}
                        </button>
                        <span style={{ color: "#8eabc4", fontSize: 12 }}>({docLabel(doc)})</span>
                        {extractedName ? (
                          <span style={{ color: "#c9d7e6", fontSize: 12 }}>
                            Extracted: {extractedName}
                            {doc.extracted_child_dob ? ` · DOB ${doc.extracted_child_dob}` : ""}
                          </span>
                        ) : null}
                      </div>
                      {exceptionMode && conflict ? (
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

            {exceptionMode ? (
              <>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                    gap: 10,
                    marginTop: 18,
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
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 16 }}>
                  <button
                    type="button"
                    disabled={busyId === activeCase.id}
                    onClick={() => void submitReview(false)}
                    style={actionBtnStyle}
                  >
                    Save corrections
                  </button>
                  <button
                    type="button"
                    disabled={busyId === activeCase.id || unresolvedConflicts(activeCase, draft)}
                    onClick={() => void submitReview(true)}
                    style={{
                      ...actionBtnStyle,
                      background: unresolvedConflicts(activeCase, draft) ? "#2a3540" : "#2a5a40",
                      opacity: unresolvedConflicts(activeCase, draft) ? 0.55 : 1,
                    }}
                  >
                    Approve → Ready for contact
                  </button>
                </div>
              </>
            ) : (
              <>
                {(activeCase.dashboard_status === "ready_for_contact" ||
                  activeCase.dashboard_status === "contact_attempted") &&
                !activeCase.patient_identity_conflict ? (
                  <div
                    style={{
                      marginTop: 18,
                      border: "1px solid #2c4560",
                      borderRadius: 12,
                      padding: 16,
                      background: "#122233",
                    }}
                  >
                    <p style={{ margin: 0, fontWeight: 600, fontSize: 15 }}>Booking correspondence</p>
                    <p style={{ margin: "6px 0 0", color: "#8eabc4", fontSize: 13, lineHeight: 1.4 }}>
                      Uses the existing Azure Mind booking templates, filled from this intake case.
                      No second upload or re-extraction.
                    </p>

                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                        gap: 10,
                        marginTop: 14,
                      }}
                    >
                      {(
                        [
                          ["parentFirst", "Parent first name"],
                          ["parentLast", "Parent last name"],
                          ["parentEmail", "Parent email"],
                          ["parentMobile", "Parent mobile"],
                          ["assessmentType", "Assessment"],
                          ["referrerName", "Referring GP"],
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

                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 14, alignItems: "center" }}>
                      <label style={{ fontSize: 12, color: "#9eb4c8" }}>
                        Channel{" "}
                        <select
                          value={contactChannel}
                          onChange={(e) => setContactChannel(e.target.value as ContactChannel)}
                          style={{ ...selectStyle, marginLeft: 6 }}
                        >
                          <option value="email+sms">Email + SMS</option>
                          <option value="email">Email only</option>
                          <option value="sms">SMS only</option>
                        </select>
                      </label>
                      <button
                        type="button"
                        disabled={busyId === activeCase.id}
                        onClick={() => void runContact("preview")}
                        style={actionBtnStyle}
                      >
                        Preview messages
                      </button>
                      {!(liveComms || readiness?.liveComms) ? (
                        <button
                          type="button"
                          disabled={
                            busyId === activeCase.id ||
                            Boolean(activeCase.sent_email && activeCase.sent_sms)
                          }
                          title="Audit-only rehearsal — does not change status, Cliniko, or block a later real send"
                          onClick={() => void runContact("simulate")}
                          style={{ ...actionBtnStyle, background: "#3a4d2a" }}
                        >
                          Simulate send
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled={
                            busyId === activeCase.id ||
                            Boolean(activeCase.sent_email && activeCase.sent_sms)
                          }
                          title="Send via existing messaging integration"
                          onClick={() => void runContact("live")}
                          style={{ ...actionBtnStyle, background: "#2a5a40" }}
                        >
                          Send messages
                        </button>
                      )}
                      {activeCase.sent_email || activeCase.sent_sms ? (
                        <span style={{ color: "#9dcea8", fontSize: 12 }}>
                          Already sent:{" "}
                          {[activeCase.sent_email ? "email" : null, activeCase.sent_sms ? "SMS" : null]
                            .filter(Boolean)
                            .join(" · ")}
                        </span>
                      ) : null}
                    </div>

                    {contactNote ? (
                      <p style={{ margin: "12px 0 0", color: "#d7e6f5", fontSize: 13 }}>{contactNote}</p>
                    ) : null}

                    {contactPreview ? (
                      <div style={{ marginTop: 14 }}>
                        <p style={{ margin: "0 0 6px", fontSize: 13, color: "#9eb4c8" }}>
                          Subject: {contactPreview.subject}
                        </p>
                        <p
                          style={{
                            margin: "0 0 10px",
                            padding: 10,
                            borderRadius: 8,
                            background: "#0f1f30",
                            border: "1px solid #2c4560",
                            fontSize: 13,
                            whiteSpace: "pre-wrap",
                          }}
                        >
                          {contactPreview.sms}
                        </p>
                        <iframe
                          title="Booking email preview"
                          srcDoc={contactPreview.emailHtml}
                          style={{
                            width: "100%",
                            minHeight: 320,
                            border: "1px solid #2c4560",
                            borderRadius: 8,
                            background: "#fff",
                          }}
                        />
                      </div>
                    ) : null}
                  </div>
                ) : null}

                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 18 }}>
                  {activeCase.dashboard_status === "ready_for_contact" ||
                  activeCase.dashboard_status === "contact_attempted" ? (
                    <button
                      type="button"
                      disabled={busyId === activeCase.id}
                      onClick={() => void updateStatus(activeCase.id, "contacted")}
                      style={actionBtnStyle}
                    >
                      Mark contacted (phone)
                    </button>
                  ) : null}
                  {activeCase.dashboard_status === "contacted" ||
                  activeCase.dashboard_status === "contact_attempted" ? (
                    <button
                      type="button"
                      disabled={busyId === activeCase.id}
                      onClick={() => void updateStatus(activeCase.id, "booked")}
                      style={{ ...actionBtnStyle, background: "#2a5a40" }}
                    >
                      Mark booked
                    </button>
                  ) : null}
                </div>
              </>
            )}
          </section>
        ) : (
          <>
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
                Legacy ({legacyCount})
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

            {loading ? (
              <p style={{ color: "#9eb4c8" }}>Loading referrals…</p>
            ) : rows.length === 0 ? (
              <p style={{ color: "#9eb4c8" }}>No referrals in this view.</p>
            ) : (
              <div style={{ overflowX: "auto", border: "1px solid #2c4560", borderRadius: 12 }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
                  <thead>
                    <tr style={{ background: "#152636", textAlign: "left" }}>
                      {["Child / DOB", "Parent / contact", "GP", "Assessment", "Status", "Action"].map(
                        (h) => (
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
                        )
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => {
                      const exception = needsExceptionReview(row);
                      return (
                        <tr
                          key={row.id}
                          style={{ borderTop: "1px solid #24384d", cursor: "pointer" }}
                          onClick={() => openCase(row)}
                        >
                          <td style={{ padding: "12px 14px", verticalAlign: "top" }}>
                            <div style={{ fontWeight: 600 }}>{childName(row)}</div>
                            <div style={{ color: "#8eabc4", fontSize: 12, marginTop: 2 }}>
                              {row.child_dob ? `DOB ${row.child_dob}` : "DOB unknown"}
                            </div>
                          </td>
                          <td style={{ padding: "12px 14px", verticalAlign: "top" }}>
                            <div>{parentName(row)}</div>
                            <div style={{ color: "#8eabc4", fontSize: 12, marginTop: 2 }}>
                              {parentContact(row)}
                            </div>
                          </td>
                          <td style={{ padding: "12px 14px", verticalAlign: "top" }}>
                            {row.referring_practitioner || "—"}
                          </td>
                          <td style={{ padding: "12px 14px", verticalAlign: "top" }}>
                            {row.assessment_type || "—"}
                          </td>
                          <td style={{ padding: "12px 14px", verticalAlign: "top" }}>
                            {dashboardLabel(row.dashboard_status)}
                            {exception ? (
                              <div style={{ color: "#e8b86d", fontSize: 11, marginTop: 4 }}>Needs review</div>
                            ) : row.auto_ready_at ? (
                              <div style={{ color: "#9dcea8", fontSize: 11, marginTop: 4 }}>Auto-verified</div>
                            ) : null}
                          </td>
                          <td
                            style={{ padding: "12px 14px", verticalAlign: "top" }}
                            onClick={(e) => e.stopPropagation()}
                          >
                            {exception ? (
                              <button
                                type="button"
                                style={actionBtnStyle}
                                onClick={() => openCase(row)}
                              >
                                Review case
                              </button>
                            ) : row.dashboard_status === "ready_for_contact" ? (
                              <button
                                type="button"
                                style={{ ...actionBtnStyle, background: "#2a5a40" }}
                                onClick={() => openCase(row)}
                              >
                                Open & send
                              </button>
                            ) : row.dashboard_status === "contact_attempted" ? (
                              <button
                                type="button"
                                style={actionBtnStyle}
                                onClick={() => openCase(row)}
                              >
                                Open case
                              </button>
                            ) : row.dashboard_status === "contacted" ? (
                              <button
                                type="button"
                                disabled={busyId === row.id}
                                style={{ ...actionBtnStyle, background: "#2a5a40" }}
                                onClick={() => void updateStatus(row.id, "booked")}
                              >
                                Mark booked
                              </button>
                            ) : (
                              <button type="button" style={actionBtnStyle} onClick={() => openCase(row)}>
                                Open
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </>
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

const metaLabel: CSSProperties = {
  fontSize: 11,
  color: "#8eabc4",
  marginBottom: 4,
};

const metaValue: CSSProperties = {
  fontSize: 14,
  color: "#e8f0f8",
};
