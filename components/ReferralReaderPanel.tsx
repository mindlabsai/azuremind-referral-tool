"use client";

import { useCallback, useRef, useState, type CSSProperties } from "react";
import type { ReferralReaderExtract } from "@/lib/referral-reader/types";

type Props = {
  onApply: (extract: ReferralReaderExtract) => void;
  cardStyle?: CSSProperties;
  sectionTitleStyle?: CSSProperties;
  inputStyle?: CSSProperties;
  textareaStyle?: CSSProperties;
  btnSecondaryStyle?: CSSProperties;
  btnPrimaryStyle?: CSSProperties;
};

export function ReferralReaderPanel({
  onApply,
  cardStyle,
  sectionTitleStyle,
  inputStyle,
  textareaStyle,
  btnSecondaryStyle,
  btnPrimaryStyle,
}: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [paste, setPaste] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [applied, setApplied] = useState<ReferralReaderExtract | null>(null);

  const resetSource = useCallback(() => {
    setFile(null);
    setFileName(null);
    setPaste("");
    if (fileRef.current) fileRef.current.value = "";
  }, []);

  const runRead = useCallback(async () => {
    setBusy(true);
    setError(null);
    setApplied(null);
    try {
      const form = new FormData();
      if (file) form.set("file", file);
      else if (paste.trim()) form.set("text", paste);
      else {
        setError("Upload a referral PDF or paste the referral text.");
        return;
      }
      const res = await fetch("/api/referral-reader", { method: "POST", body: form });
      const data = (await res.json()) as {
        success?: boolean;
        error?: string;
        extract?: ReferralReaderExtract;
      };
      if (!res.ok || !data.success || !data.extract) {
        setError(data.error || "Could not read referral.");
        return;
      }
      setApplied(data.extract);
      onApply(data.extract);
      // Parent email preview sits in the right column
      requestAnimationFrame(() => {
        document.getElementById("referral-email-preview")?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not read referral.");
    } finally {
      setBusy(false);
    }
  }, [file, paste, onApply]);

  return (
    <section id="referral-reader" style={cardStyle}>
      <h2 style={sectionTitleStyle}>Referral reader</h2>
      <p style={{ fontSize: 13, color: "#64748b", marginBottom: 12, lineHeight: 1.45 }}>
        Upload a GP / referrer PDF or paste the letter. One click fills the form and builds the
        parent booking email — check details, then send.
      </p>

      <div style={{ display: "grid", gap: 10 }}>
        <div>
          <input
            ref={fileRef}
            type="file"
            accept="application/pdf,.pdf"
            onChange={(e) => {
              const f = e.target.files?.[0] ?? null;
              setFile(f);
              setFileName(f?.name ?? null);
              setApplied(null);
              setError(null);
            }}
            style={{ ...inputStyle, padding: "8px 10px" }}
          />
          {fileName ? (
            <p style={{ fontSize: 12, color: "#64748b", marginTop: 6 }}>Selected: {fileName}</p>
          ) : null}
        </div>
        <div>
          <label
            style={{
              display: "block",
              fontSize: 12,
              fontWeight: 600,
              color: "#075E63",
              marginBottom: 6,
            }}
          >
            Or paste referral text
          </label>
          <textarea
            value={paste}
            onChange={(e) => {
              setPaste(e.target.value);
              setApplied(null);
              setError(null);
            }}
            rows={5}
            placeholder="Paste email or letter text…"
            style={{ ...textareaStyle, fontFamily: "inherit", width: "100%" }}
          />
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          <button type="button" style={btnPrimaryStyle} disabled={busy} onClick={() => void runRead()}>
            {busy ? "Reading…" : "Read referral → make parent email"}
          </button>
          <button
            type="button"
            style={btnSecondaryStyle}
            disabled={busy}
            onClick={() => {
              resetSource();
              setApplied(null);
              setError(null);
            }}
          >
            Clear
          </button>
        </div>
        {error ? (
          <p role="alert" style={{ fontSize: 13, color: "#b91c1c", margin: 0 }}>
            {error}
          </p>
        ) : null}
        {applied ? (
          <div
            style={{
              border: "1px solid #b7e1de",
              borderRadius: 10,
              padding: 12,
              background: "#f0faf9",
              fontSize: 13,
              color: "#334155",
              lineHeight: 1.45,
            }}
          >
            <p style={{ margin: "0 0 8px", fontWeight: 700, color: "#075E63" }}>
              Form + parent email filled · confidence {applied.confidence}
            </p>
            <p style={{ margin: "0 0 4px" }}>
              <strong>Child:</strong>{" "}
              {[applied.childFirst, applied.childLast].filter(Boolean).join(" ") || "—"}
              {applied.childDob ? ` · DOB ${applied.childDob}` : ""}
            </p>
            <p style={{ margin: "0 0 4px" }}>
              <strong>Parent:</strong>{" "}
              {[applied.parentFirst, applied.parentLast].filter(Boolean).join(" ") || "—"}
              {applied.parentEmail ? ` · ${applied.parentEmail}` : ""}
              {applied.parentMobile ? ` · ${applied.parentMobile}` : ""}
            </p>
            <p style={{ margin: "0 0 4px" }}>
              <strong>Type:</strong>{" "}
              {applied.assessmentType || "— pick ADHD, ASD, or SLD below"}
            </p>
            <p style={{ margin: "0 0 4px" }}>
              <strong>Referrer:</strong> {applied.referrerName || "—"}
              {applied.referrerType ? ` (${applied.referrerType})` : ""}
            </p>
            {applied.warnings.length ? (
              <ul style={{ margin: "8px 0 0", paddingLeft: 18, color: "#b45309" }}>
                {applied.warnings.map((w) => (
                  <li key={w}>{w}</li>
                ))}
              </ul>
            ) : null}
            <p style={{ margin: "10px 0 0", fontSize: 12, color: "#64748b" }}>
              Review the fields below and the email preview, then use Send Email + SMS.
            </p>
          </div>
        ) : null}
      </div>
    </section>
  );
}
