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
      <p style={{ fontSize: 17, color: "#c5d4e4", marginBottom: 12, lineHeight: 1.5 }}>
        Upload a GP / referrer PDF or paste the letter. One click fills the form and builds the
        parent booking email. Check details, then send.
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
            style={{
              position: "absolute",
              width: 1,
              height: 1,
              padding: 0,
              margin: -1,
              overflow: "hidden",
              clip: "rect(0,0,0,0)",
              border: 0,
            }}
          />
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <button
              type="button"
              style={btnSecondaryStyle}
              onClick={() => fileRef.current?.click()}
            >
              {fileName ? "Change PDF" : "Upload referral PDF"}
            </button>
            <span style={{ fontSize: 17, color: "#c5d4e4", lineHeight: 1.4 }}>
              {fileName ?? "No file selected"}
            </span>
          </div>
        </div>
        <div>
          <label
            style={{
              display: "block",
              fontSize: 17,
              fontWeight: 600,
              color: "#c5d4e4",
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
            rows={12}
            placeholder="Paste email or letter text…"
            style={{ ...textareaStyle, fontFamily: "inherit", width: "100%" }}
          />
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          <button type="button" style={btnPrimaryStyle} disabled={busy} onClick={() => void runRead()}>
            {busy ? "Reading…" : "Read → parent email"}
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
          <p role="alert" style={{ fontSize: 17, color: "#f0b4b4", margin: 0 }}>
            {error}
          </p>
        ) : null}
        {applied ? (
          <div
            style={{
              borderTop: "1px solid #2c455f",
              borderRadius: 0,
              padding: "16px 0",
              background: "transparent",
              fontSize: 17,
              color: "#f4f8fc",
              lineHeight: 1.45,
            }}
          >
            <p style={{ margin: "0 0 8px", fontWeight: 600, color: "#f4f8fc" }}>
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
              <ul style={{ margin: "8px 0 0", paddingLeft: 18, color: "#f0c593" }}>
                {applied.warnings.map((w) => (
                  <li key={w}>{w}</li>
                ))}
              </ul>
            ) : null}
            <p style={{ margin: "10px 0 0", fontSize: 17, color: "#c5d4e4" }}>
              Review the patient details and the email preview, then send.
            </p>
          </div>
        ) : null}
      </div>
    </section>
  );
}
