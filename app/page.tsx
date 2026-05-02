"use client";

import type { CSSProperties, FormEvent } from "react";
import { useCallback, useMemo, useState } from "react";

const PIN = "azuremind";

const DEFAULT_BOOKING_LINK = "https://azuremind.com.au/book";
const DEFAULT_CLINIC_PHONE = "07 3123 4567";

type AssessmentType = "ADHD" | "ASD" | "SLD";

type SentChannel = "email+sms" | "email" | "sms";

type SentEntry = {
  id: string;
  at: string;
  childFirst: string;
  parentFirst: string;
  parentLast: string;
  parentEmail: string;
  parentMobile: string;
  assessmentType: AssessmentType;
  bookingLink: string;
  clinicPhone: string;
  internalNotes: string;
  referrerName: string;
  referrerType: string;
  referrerEmail: string;
  channel: SentChannel;
};

function uid(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildParentEmailHtml(fields: {
  childFirst: string;
  parentFirst: string;
  parentLast: string;
  parentEmail: string;
  parentMobile: string;
  assessmentType: AssessmentType;
  bookingLink: string;
  clinicPhone: string;
}): string {
  const { childFirst, parentFirst, assessmentType, bookingLink, clinicPhone } =
    fields;
  const greeting = parentFirst.trim()
    ? `Dear ${escapeHtml(parentFirst.trim())},`
    : "Dear Parent/Carer,";
  return [
    "<!DOCTYPE html><html><head><meta charset=\"utf-8\" /></head><body>",
    `<p>${greeting}</p>`,
    `<p>Thank you for your referral regarding <strong>${escapeHtml(childFirst.trim() || "your child")}</strong>.</p>`,
    `<p>Assessment focus: <strong>${escapeHtml(assessmentType)}</strong>.</p>`,
    `<p>Please book using this link: <a href="${escapeHtml(bookingLink)}">${escapeHtml(bookingLink)}</a></p>`,
    `<p>If you need help, call us on <strong>${escapeHtml(clinicPhone)}</strong>.</p>`,
    "<p>Warm regards,<br/>Azure Mind</p>",
    "</body></html>",
  ].join("");
}

function buildSmsText(fields: {
  childFirst: string;
  parentFirst: string;
  assessmentType: AssessmentType;
  bookingLink: string;
  clinicPhone: string;
}): string {
  const name = fields.childFirst.trim() || "your child";
  return [
    `Azure Mind: Hi${fields.parentFirst.trim() ? ` ${fields.parentFirst.trim()}` : ""},`,
    `referral for ${name} (${fields.assessmentType}).`,
    `Book: ${fields.bookingLink}`,
    `Questions: ${fields.clinicPhone}`,
  ].join(" ");
}

export default function Home() {
  const [pinInput, setPinInput] = useState("");
  const [pinError, setPinError] = useState<string | null>(null);
  const [unlocked, setUnlocked] = useState(false);

  const [childFirst, setChildFirst] = useState("");
  const [parentFirst, setParentFirst] = useState("");
  const [parentLast, setParentLast] = useState("");
  const [parentEmail, setParentEmail] = useState("");
  const [parentMobile, setParentMobile] = useState("");
  const [assessmentType, setAssessmentType] = useState<AssessmentType>("ADHD");
  const [bookingLink, setBookingLink] = useState(DEFAULT_BOOKING_LINK);
  const [clinicPhone, setClinicPhone] = useState(DEFAULT_CLINIC_PHONE);
  const [internalNotes, setInternalNotes] = useState("");

  const [referrerName, setReferrerName] = useState("");
  const [referrerType, setReferrerType] = useState("");
  const [referrerEmail, setReferrerEmail] = useState("");

  const [previewEmailHtml, setPreviewEmailHtml] = useState("");
  const [previewSms, setPreviewSms] = useState("");
  const [previewReady, setPreviewReady] = useState(false);

  const [sentRegister, setSentRegister] = useState<SentEntry[]>([]);
  const [actionMsg, setActionMsg] = useState<string | null>(null);

  const handleUnlock = (e: FormEvent) => {
    e.preventDefault();
    if (pinInput.trim().toLowerCase() === PIN.toLowerCase()) {
      setUnlocked(true);
      setPinError(null);
    } else {
      setPinError("Incorrect PIN.");
    }
  };

  const generatePreview = useCallback((): boolean => {
    if (!parentMobile.trim()) {
      setActionMsg("Parent mobile is required.");
      setTimeout(() => setActionMsg(null), 2500);
      return false;
    }
    const html = buildParentEmailHtml({
      childFirst,
      parentFirst,
      parentLast,
      parentEmail,
      parentMobile,
      assessmentType,
      bookingLink,
      clinicPhone,
    });
    const sms = buildSmsText({
      childFirst,
      parentFirst,
      assessmentType,
      bookingLink,
      clinicPhone,
    });
    setPreviewEmailHtml(html);
    setPreviewSms(sms);
    setPreviewReady(true);
    setActionMsg("Preview updated from current form.");
    setTimeout(() => setActionMsg(null), 2500);
    return true;
  }, [
    childFirst,
    parentFirst,
    parentLast,
    parentEmail,
    parentMobile,
    assessmentType,
    bookingLink,
    clinicPhone,
  ]);

  const pushSent = useCallback(
    (channel: SentChannel) => {
      const entry: SentEntry = {
        id: uid(),
        at: new Date().toISOString(),
        childFirst,
        parentFirst,
        parentLast,
        parentEmail,
        parentMobile,
        assessmentType,
        bookingLink,
        clinicPhone,
        internalNotes,
        referrerName,
        referrerType,
        referrerEmail,
        channel,
      };
      setSentRegister((prev) => [entry, ...prev]);
    },
    [
      childFirst,
      parentFirst,
      parentLast,
      parentEmail,
      parentMobile,
      assessmentType,
      bookingLink,
      clinicPhone,
      internalNotes,
      referrerName,
      referrerType,
      referrerEmail,
    ]
  );

  const copyText = async (label: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setActionMsg(`${label} copied.`);
    } catch {
      setActionMsg("Clipboard unavailable.");
    }
    setTimeout(() => setActionMsg(null), 2500);
  };

  const registerCsv = useMemo(() => {
    const headers = [
      "timestamp_iso",
      "channel",
      "child_first",
      "parent_first",
      "parent_last",
      "parent_email",
      "parent_mobile",
      "assessment_type",
      "booking_link",
      "clinic_phone",
      "internal_notes",
      "referrer_name",
      "referrer_type",
      "referrer_email",
    ];
    const rows = sentRegister.map((r) =>
      [
        r.at,
        r.channel,
        r.childFirst,
        r.parentFirst,
        r.parentLast,
        r.parentEmail,
        r.parentMobile,
        r.assessmentType,
        r.bookingLink,
        r.clinicPhone,
        r.internalNotes,
        r.referrerName,
        r.referrerType,
        r.referrerEmail,
      ]
        .map((cell) => {
          const s = String(cell ?? "");
          if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
          return s;
        })
        .join(",")
    );
    return [headers.join(","), ...rows].join("\n");
  }, [sentRegister]);

  const copyRegister = () => copyText("Register", registerCsv);

  const downloadCsv = () => {
    const blob = new Blob([registerCsv], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `azure-mind-sent-register-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    setActionMsg("CSV download started.");
    setTimeout(() => setActionMsg(null), 2500);
  };

  const clearForm = () => {
    setChildFirst("");
    setParentFirst("");
    setParentLast("");
    setParentEmail("");
    setParentMobile("");
    setAssessmentType("ADHD");
    setBookingLink(DEFAULT_BOOKING_LINK);
    setClinicPhone(DEFAULT_CLINIC_PHONE);
    setInternalNotes("");
    setReferrerName("");
    setReferrerType("");
    setReferrerEmail("");
    setPreviewEmailHtml("");
    setPreviewSms("");
    setPreviewReady(false);
    setActionMsg("Form cleared.");
    setTimeout(() => setActionMsg(null), 2500);
  };

  const sendAnotherReferral = () => {
    clearForm();
    setActionMsg("Ready for another referral.");
    setTimeout(() => setActionMsg(null), 2500);
  };

  const card: CSSProperties = {
    background: "rgba(13, 148, 136, 0.06)",
    border: "1px solid rgba(13, 148, 136, 0.28)",
    borderRadius: 12,
    padding: "1rem 1.15rem",
  };

  const labelStyle: CSSProperties = {
    display: "block",
    fontSize: 12,
    fontWeight: 600,
    color: "#0f766e",
    marginBottom: 6,
  };

  const inputStyle: CSSProperties = {
    width: "100%",
    padding: "10px 12px",
    borderRadius: 8,
    border: "1px solid rgba(13, 148, 136, 0.35)",
    background: "#fff",
    fontSize: 14,
  };

  const btn: CSSProperties = {
    padding: "10px 14px",
    borderRadius: 8,
    border: "1px solid rgba(13, 148, 136, 0.45)",
    background: "rgba(13, 148, 136, 0.12)",
    color: "#0f766e",
    fontWeight: 600,
    cursor: "pointer",
    fontSize: 13,
  };

  if (!unlocked) {
    return (
      <main
        style={{
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(180deg, #ecfeff 0%, #f0fdfa 50%, #fafafa 100%)",
          padding: 24,
        }}
      >
        <header
          style={{
            width: "100%",
            maxWidth: 420,
            background: "linear-gradient(135deg, #0d9488 0%, #0f766e 100%)",
            color: "#fff",
            padding: "20px 24px",
            borderRadius: "12px 12px 0 0",
            textAlign: "center",
            boxShadow: "0 4px 20px rgba(13, 148, 136, 0.25)",
          }}
        >
          <h1 style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-0.02em" }}>
            Azure Mind
          </h1>
          <p style={{ fontSize: 13, opacity: 0.92, marginTop: 6 }}>
            Referral Admin — sign in
          </p>
        </header>
        <form
          onSubmit={handleUnlock}
          style={{
            ...card,
            maxWidth: 420,
            width: "100%",
            borderTopLeftRadius: 0,
            borderTopRightRadius: 0,
            marginTop: 0,
            borderTop: "none",
          }}
        >
          <label style={labelStyle} htmlFor="pin">
            PIN
          </label>
          <input
            id="pin"
            type="password"
            autoComplete="current-password"
            value={pinInput}
            onChange={(e) => setPinInput(e.target.value)}
            placeholder="Enter PIN"
            style={inputStyle}
          />
          {pinError ? (
            <p style={{ color: "#b91c1c", fontSize: 13, marginTop: 10 }}>
              {pinError}
            </p>
          ) : null}
          <button
            type="submit"
            style={{
              ...btn,
              width: "100%",
              marginTop: 16,
              background: "#0d9488",
              color: "#fff",
              border: "none",
            }}
          >
            Unlock
          </button>
        </form>
      </main>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "#f7faf9" }}>
      <header
        style={{
          background: "linear-gradient(135deg, #0d9488 0%, #0f766e 100%)",
          color: "#fff",
          padding: "18px 28px",
          boxShadow: "0 2px 12px rgba(13, 148, 136, 0.2)",
        }}
      >
        <h1 style={{ fontSize: 24, fontWeight: 700, letterSpacing: "-0.02em" }}>
          Azure Mind
        </h1>
        <p style={{ fontSize: 14, opacity: 0.92, marginTop: 4 }}>
          Referral Admin Tool
        </p>
      </header>

      <main
        style={{
          maxWidth: 1200,
          margin: "0 auto",
          padding: "24px 20px 48px",
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 340px), 1fr))",
          gap: 20,
          alignItems: "start",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <section style={card}>
            <h2
              style={{
                fontSize: 15,
                color: "#115e59",
                marginBottom: 14,
                fontWeight: 700,
              }}
            >
              Referral details
            </h2>
            <div style={{ display: "grid", gap: 12 }}>
              <div>
                <label style={labelStyle} htmlFor="childFirst">
                  Child first name
                </label>
                <input
                  id="childFirst"
                  value={childFirst}
                  onChange={(e) => setChildFirst(e.target.value)}
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle} htmlFor="parentFirst">
                  Parent first name
                </label>
                <input
                  id="parentFirst"
                  value={parentFirst}
                  onChange={(e) => setParentFirst(e.target.value)}
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle} htmlFor="parentLast">
                  Parent last name
                </label>
                <input
                  id="parentLast"
                  value={parentLast}
                  onChange={(e) => setParentLast(e.target.value)}
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle} htmlFor="parentEmail">
                  Parent email <span style={{ fontWeight: 400 }}>(optional)</span>
                </label>
                <input
                  id="parentEmail"
                  type="email"
                  value={parentEmail}
                  onChange={(e) => setParentEmail(e.target.value)}
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle} htmlFor="parentMobile">
                  Parent mobile <span style={{ color: "#b91c1c" }}>*</span>{" "}
                  required
                </label>
                <input
                  id="parentMobile"
                  type="tel"
                  value={parentMobile}
                  onChange={(e) => setParentMobile(e.target.value)}
                  style={inputStyle}
                  required
                />
              </div>
              <div>
                <span style={labelStyle}>Assessment type</span>
                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: 10,
                  }}
                >
                  {(["ADHD", "ASD", "SLD"] as const).map((t) => (
                    <label
                      key={t}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6,
                        fontSize: 14,
                        cursor: "pointer",
                      }}
                    >
                      <input
                        type="radio"
                        name="assessment"
                        checked={assessmentType === t}
                        onChange={() => setAssessmentType(t)}
                      />
                      {t}
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <label style={labelStyle} htmlFor="bookingLink">
                  Booking link <span style={{ fontWeight: 400 }}>(default)</span>
                </label>
                <input
                  id="bookingLink"
                  type="url"
                  value={bookingLink}
                  onChange={(e) => setBookingLink(e.target.value)}
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle} htmlFor="clinicPhone">
                  Clinic phone <span style={{ fontWeight: 400 }}>(default)</span>
                </label>
                <input
                  id="clinicPhone"
                  type="tel"
                  value={clinicPhone}
                  onChange={(e) => setClinicPhone(e.target.value)}
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle} htmlFor="internalNotes">
                  Internal notes
                </label>
                <textarea
                  id="internalNotes"
                  value={internalNotes}
                  onChange={(e) => setInternalNotes(e.target.value)}
                  rows={4}
                  style={{ ...inputStyle, resize: "vertical", fontFamily: "inherit" }}
                />
              </div>
            </div>
          </section>

          <section style={{ ...card, borderStyle: "dashed" }}>
            <h2
              style={{
                fontSize: 15,
                color: "#115e59",
                marginBottom: 8,
                fontWeight: 700,
              }}
            >
              Internal referrer
            </h2>
            <p style={{ fontSize: 12, color: "#64748b", marginBottom: 12 }}>
              Must never appear in parent-facing email or SMS.
            </p>
            <div style={{ display: "grid", gap: 12 }}>
              <div>
                <label style={labelStyle} htmlFor="referrerName">
                  Referrer name
                </label>
                <input
                  id="referrerName"
                  value={referrerName}
                  onChange={(e) => setReferrerName(e.target.value)}
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle} htmlFor="referrerType">
                  Referrer type
                </label>
                <input
                  id="referrerType"
                  value={referrerType}
                  onChange={(e) => setReferrerType(e.target.value)}
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle} htmlFor="referrerEmail">
                  Referrer email
                </label>
                <input
                  id="referrerEmail"
                  type="email"
                  value={referrerEmail}
                  onChange={(e) => setReferrerEmail(e.target.value)}
                  style={inputStyle}
                />
              </div>
            </div>
          </section>

          <section style={card}>
            <h2
              style={{
                fontSize: 15,
                color: "#115e59",
                marginBottom: 12,
                fontWeight: 700,
              }}
            >
              Actions
            </h2>
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 8,
              }}
            >
              <button type="button" style={btn} onClick={generatePreview}>
                Generate Preview
              </button>
              <button
                type="button"
                style={btn}
                onClick={() => {
                  if (!generatePreview()) return;
                  pushSent("email+sms");
                  setActionMsg(
                    "Send Email + SMS — placeholder recorded in register."
                  );
                  setTimeout(() => setActionMsg(null), 2500);
                }}
              >
                Send Email + SMS (placeholder)
              </button>
              <button
                type="button"
                style={btn}
                onClick={() => {
                  if (!generatePreview()) return;
                  pushSent("email");
                  setActionMsg("Send Email Only — placeholder recorded.");
                  setTimeout(() => setActionMsg(null), 2500);
                }}
              >
                Send Email Only (placeholder)
              </button>
              <button
                type="button"
                style={btn}
                onClick={() => {
                  if (!generatePreview()) return;
                  pushSent("sms");
                  setActionMsg("Send SMS Only — placeholder recorded.");
                  setTimeout(() => setActionMsg(null), 2500);
                }}
              >
                Send SMS Only (placeholder)
              </button>
              <button
                type="button"
                style={btn}
                onClick={() =>
                  previewReady
                    ? copyText("Email HTML", previewEmailHtml)
                    : setActionMsg("Generate preview first.")
                }
              >
                Copy Email HTML
              </button>
              <button
                type="button"
                style={btn}
                onClick={() =>
                  previewReady
                    ? copyText("SMS", previewSms)
                    : setActionMsg("Generate preview first.")
                }
              >
                Copy SMS
              </button>
              <button type="button" style={btn} onClick={sendAnotherReferral}>
                Send Another Referral
              </button>
              <button type="button" style={btn} onClick={clearForm}>
                Clear Form
              </button>
            </div>
            {actionMsg ? (
              <p style={{ marginTop: 12, fontSize: 13, color: "#0f766e" }}>
                {actionMsg}
              </p>
            ) : null}
          </section>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <section style={card}>
            <h2
              style={{
                fontSize: 15,
                color: "#115e59",
                marginBottom: 10,
                fontWeight: 700,
              }}
            >
              Email preview (parent-facing)
            </h2>
            {!previewReady ? (
              <p style={{ fontSize: 13, color: "#64748b" }}>
                Click &quot;Generate Preview&quot; to build parent-facing content.
                Internal referrer fields are excluded.
              </p>
            ) : (
              <EmailPreviewPlain
                childFirst={childFirst}
                parentFirst={parentFirst}
                assessmentType={assessmentType}
                bookingLink={bookingLink}
                clinicPhone={clinicPhone}
              />
            )}
          </section>

          <section style={card}>
            <h2
              style={{
                fontSize: 15,
                color: "#115e59",
                marginBottom: 10,
                fontWeight: 700,
              }}
            >
              SMS preview (parent-facing)
            </h2>
            {!previewReady ? (
              <p style={{ fontSize: 13, color: "#64748b" }}>
                Generate preview to see SMS text.
              </p>
            ) : (
              <pre
                style={{
                  margin: 0,
                  padding: 12,
                  background: "#fff",
                  borderRadius: 8,
                  border: "1px solid rgba(13, 148, 136, 0.25)",
                  fontSize: 13,
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                  fontFamily: "inherit",
                }}
              >
                {previewSms}
              </pre>
            )}
          </section>

          <section style={card}>
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 10,
                marginBottom: 12,
              }}
            >
              <h2
                style={{
                  fontSize: 15,
                  color: "#115e59",
                  fontWeight: 700,
                }}
              >
                Sent register ({sentRegister.length})
              </h2>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                <button
                  type="button"
                  style={btn}
                  onClick={copyRegister}
                  disabled={sentRegister.length === 0}
                >
                  Copy Register
                </button>
                <button
                  type="button"
                  style={btn}
                  onClick={downloadCsv}
                  disabled={sentRegister.length === 0}
                >
                  Download CSV
                </button>
              </div>
            </div>
            {sentRegister.length === 0 ? (
              <p style={{ fontSize: 13, color: "#64748b" }}>
                No entries yet. Use send placeholders or actions that record to the
                register.
              </p>
            ) : (
              <ul
                style={{
                  listStyle: "none",
                  maxHeight: 280,
                  overflow: "auto",
                  padding: 0,
                  margin: 0,
                }}
              >
                {sentRegister.map((r) => (
                  <li
                    key={r.id}
                    style={{
                      padding: "10px 0",
                      borderBottom: "1px solid rgba(13, 148, 136, 0.15)",
                      fontSize: 13,
                    }}
                  >
                    <strong>{r.childFirst || "(child)"}</strong> —{" "}
                    {r.parentFirst} {r.parentLast} · {r.assessmentType} ·{" "}
                    <span style={{ color: "#0d9488" }}>{r.channel}</span>
                    <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 4 }}>
                      {new Date(r.at).toLocaleString()}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}

function EmailPreviewPlain({
  childFirst,
  parentFirst,
  assessmentType,
  bookingLink,
  clinicPhone,
}: {
  childFirst: string;
  parentFirst: string;
  assessmentType: AssessmentType;
  bookingLink: string;
  clinicPhone: string;
}) {
  const greeting = parentFirst.trim()
    ? `Dear ${parentFirst.trim()},`
    : "Dear Parent/Carer,";
  return (
    <div
      style={{
        padding: 14,
        background: "#fff",
        borderRadius: 8,
        border: "1px solid rgba(13, 148, 136, 0.25)",
        fontSize: 14,
        lineHeight: 1.55,
        color: "#1e293b",
      }}
    >
      <p style={{ margin: "0 0 12px" }}>{greeting}</p>
      <p style={{ margin: "0 0 12px" }}>
        Thank you for your referral regarding{" "}
        <strong>{childFirst.trim() || "your child"}</strong>.
      </p>
      <p style={{ margin: "0 0 12px" }}>
        Assessment focus: <strong>{assessmentType}</strong>.
      </p>
      <p style={{ margin: "0 0 12px" }}>
        Please book using this link:{" "}
        <a href={bookingLink} style={{ color: "#0d9488", wordBreak: "break-all" }}>
          {bookingLink}
        </a>
      </p>
      <p style={{ margin: "0 0 12px" }}>
        If you need help, call us on <strong>{clinicPhone}</strong>.
      </p>
      <p style={{ margin: 0 }}>
        Warm regards,
        <br />
        Azure Mind
      </p>
    </div>
  );
}
