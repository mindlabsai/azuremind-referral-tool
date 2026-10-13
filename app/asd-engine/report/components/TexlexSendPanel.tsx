"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  LETTER_KIND_OPTIONS,
  SEND_AUDIENCE_OPTIONS,
  buildLetterBody,
  buildLetterEmailHtml,
  buildLetterRegardingLine,
  buildLetterSubject,
  letterDocumentSubtitle,
  letterDocumentTitle,
  parseRecipientList,
  resolveAudienceRecipients,
  type LetterKind,
  type LetterMergeFields,
  type RecipientBuckets,
  type SendAudience,
} from "@/lib/texlex-comms/letters";
import { TEXLEX_SECTION_CONTAINER_CLASS, TEXLEX_SECTION_CONTENT_CLASS } from "../constants/texlexSectionSurface";

type PdfAttachment = { filename: string; contentBase64: string };

type Props = {
  unlocked: boolean;
  mergeFields: LetterMergeFields;
  recipientBuckets: RecipientBuckets;
  /** Build current final report PDF as base64 (no data: prefix). */
  buildReportPdfBase64: () => Promise<PdfAttachment>;
  /** Build Texlex-format letter PDF (masthead + signature). */
  buildLetterPdfBase64: (args: {
    kind: LetterKind;
    body: string;
  }) => Promise<PdfAttachment>;
  /** Label for the report attachment checkbox. */
  reportAttachLabel?: string;
  onScrollToFinalize?: () => void;
};

export function TexlexSendPanel({
  unlocked,
  mergeFields,
  recipientBuckets,
  buildReportPdfBase64,
  buildLetterPdfBase64,
  reportAttachLabel = "Attach final ASD report PDF",
  onScrollToFinalize,
}: Props) {
  const [audience, setAudience] = useState<SendAudience>("parents-and-clinician");
  const initialRecipients = resolveAudienceRecipients("parents-and-clinician", recipientBuckets);
  const [toInput, setToInput] = useState(() => initialRecipients.to.join(", "));
  const [ccInput, setCcInput] = useState(() => initialRecipients.cc.join(", "));
  const [letterKind, setLetterKind] = useState<LetterKind>("parent-cover");
  const [subject, setSubject] = useState(() => buildLetterSubject("parent-cover", mergeFields));
  const [letterBody, setLetterBody] = useState(() => buildLetterBody("parent-cover", mergeFields));
  const [attachReport, setAttachReport] = useState(true);
  const [attachLetterPdf, setAttachLetterPdf] = useState(true);
  const [sending, setSending] = useState(false);
  const [previewingLetter, setPreviewingLetter] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [recipientsTouched, setRecipientsTouched] = useState(false);

  const applyAudience = (next: SendAudience, buckets: RecipientBuckets = recipientBuckets) => {
    const option = SEND_AUDIENCE_OPTIONS.find((o) => o.value === next)!;
    const kind = option.defaultLetterKind;
    const resolved = resolveAudienceRecipients(next, buckets);
    setAudience(next);
    setLetterKind(kind);
    setSubject(buildLetterSubject(kind, mergeFields));
    setLetterBody(buildLetterBody(kind, mergeFields));
    setToInput(resolved.to.join(", "));
    setCcInput(resolved.cc.join(", "));
    setRecipientsTouched(false);
    setAttachReport(next !== "clinician" ? true : true);
    setStatus(null);
    setError(null);
  };

  useEffect(() => {
    if (!recipientsTouched) {
      const resolved = resolveAudienceRecipients(audience, recipientBuckets);
      setToInput(resolved.to.join(", "));
      setCcInput(resolved.cc.join(", "));
    }
  }, [recipientBuckets, audience, recipientsTouched]);

  useEffect(() => {
    setSubject(buildLetterSubject(letterKind, mergeFields));
    setLetterBody(buildLetterBody(letterKind, mergeFields));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    letterKind,
    mergeFields.clientName,
    mergeFields.dob,
    mergeFields.reportDate,
    mergeFields.diagnosticConclusionLabel,
    mergeFields.severityLine,
    mergeFields.parent1,
    mergeFields.parent2,
    mergeFields.referringPractitioner,
  ]);

  const toList = useMemo(() => parseRecipientList(toInput), [toInput]);
  const ccList = useMemo(() => parseRecipientList(ccInput), [ccInput]);
  const docTitle = letterDocumentTitle(letterKind);
  const docSubtitle = letterDocumentSubtitle(letterKind, mergeFields.pathway ?? "asd");
  const regarding = buildLetterRegardingLine(mergeFields);

  const missingParents =
    (audience === "parents" || audience === "parents-and-clinician") &&
    recipientBuckets.parentEmails.length === 0;
  const missingClinician =
    (audience === "clinician" || audience === "parents-and-clinician") &&
    recipientBuckets.clinicianEmails.length === 0;

  const regenerateLetter = (kind: LetterKind) => {
    setLetterKind(kind);
    setSubject(buildLetterSubject(kind, mergeFields));
    setLetterBody(buildLetterBody(kind, mergeFields));
    // Align audience with letter when switching referral types
    if (kind === "parent-cover" && audience === "clinician") {
      applyAudience("parents-and-clinician");
      setLetterKind("parent-cover");
      setSubject(buildLetterSubject("parent-cover", mergeFields));
      setLetterBody(buildLetterBody("parent-cover", mergeFields));
    } else if ((kind === "referrer-update" || kind === "dr-muru-referral") && audience !== "clinician") {
      const resolved = resolveAudienceRecipients("clinician", recipientBuckets);
      setAudience("clinician");
      setToInput(resolved.to.join(", "));
      setCcInput(resolved.cc.join(", "));
      setRecipientsTouched(false);
    }
    setStatus(null);
    setError(null);
  };

  const downloadLetterPdf = async () => {
    if (!unlocked) {
      onScrollToFinalize?.();
      setError("Complete Final PDF first, then preview the letter.");
      return;
    }
    setPreviewingLetter(true);
    setError(null);
    try {
      const letter = await buildLetterPdfBase64({ kind: letterKind, body: letterBody });
      const binary = atob(letter.contentBase64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      const blob = new Blob([bytes], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = letter.filename;
      a.click();
      URL.revokeObjectURL(url);
      setStatus(`Downloaded Texlex letter PDF: ${letter.filename}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not build letter PDF");
    } finally {
      setPreviewingLetter(false);
    }
  };

  const handleSend = async () => {
    if (!unlocked) {
      onScrollToFinalize?.();
      setError("Complete Final PDF first, then send from Texlex.");
      return;
    }
    if (!toList.length) {
      setError(
        audience === "clinician"
          ? "Add clinician email (referrer email in Client details, or type below)."
          : "Add at least one parent email in Client details, or type below."
      );
      return;
    }
    if (!attachReport && !attachLetterPdf) {
      setError("Attach at least the Texlex letter PDF or the report PDF.");
      return;
    }
    setSending(true);
    setError(null);
    setStatus(null);
    try {
      const attachments: Array<{ filename: string; contentBase64: string; contentType: string }> = [];
      if (attachLetterPdf) {
        const letter = await buildLetterPdfBase64({ kind: letterKind, body: letterBody });
        attachments.push({
          filename: letter.filename,
          contentBase64: letter.contentBase64,
          contentType: "application/pdf",
        });
      }
      if (attachReport) {
        const pdf = await buildReportPdfBase64();
        attachments.push({
          filename: pdf.filename,
          contentBase64: pdf.contentBase64,
          contentType: "application/pdf",
        });
      }

      const res = await fetch("/api/send-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          purpose: "correspondence",
          to: toList,
          ...(ccList.length ? { cc: ccList } : {}),
          subject,
          html: buildLetterEmailHtml(letterKind, letterBody, mergeFields),
          text: `${docTitle}\n${docSubtitle}\n\n${regarding}\n\n${letterBody}\n\nKind Regards,\n${mergeFields.assessor || "Vishal Maharaj"}\nAzure Mind`,
          attachments,
          replyTo: "admin@azuremind.com.au",
        }),
      });
      const data = (await res.json()) as { success?: boolean; error?: string };
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Send failed");
      }
      setStatus(
        `Sent via Texlex to ${toList.join(", ")}${ccList.length ? ` (cc ${ccList.join(", ")})` : ""}.`
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Send failed");
    } finally {
      setSending(false);
    }
  };

  return (
    <section id="texlex-send">
      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-baseline sm:justify-between">
        <h2 className="text-lg font-semibold tracking-tight text-foreground">Send via Texlex</h2>
        <span className="text-xs text-muted-foreground sm:text-right">
          Parents · clinician · Texlex letter PDF
        </span>
      </div>
      <Card className={TEXLEX_SECTION_CONTAINER_CLASS}>
        <CardContent className={cn(TEXLEX_SECTION_CONTENT_CLASS, "space-y-4")}>
          <p className="text-sm text-muted-foreground">
            Send the final report to parents, clinicians, or both. Parent cover goes to carers;
            clinician letters go to the referrer / Dr Muru. Sends from{" "}
            <span className="text-foreground">admin@azuremind.com.au</span> (post-referral
            correspondence). Cliniko keeps the file; Texlex sends mail.
          </p>

          {!unlocked ? (
            <div className="rounded-lg border border-amber-300/80 bg-amber-50 px-3 py-2 text-sm text-amber-950 dark:border-amber-700 dark:bg-amber-950/30 dark:text-amber-50">
              Locked until Final PDF / Download &amp; save completes.{" "}
              {onScrollToFinalize ? (
                <button type="button" className="underline" onClick={onScrollToFinalize}>
                  Finish Final PDF first
                </button>
              ) : (
                <span>Use Download &amp; save to Cliniko first.</span>
              )}
            </div>
          ) : (
            <Badge variant="secondary">Unlocked — final package ready</Badge>
          )}

          <div className="space-y-1">
            <label className="text-xs uppercase tracking-wide text-muted-foreground">
              Send to
            </label>
            <div className="flex flex-wrap gap-2">
              {SEND_AUDIENCE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  disabled={!unlocked}
                  title={opt.description}
                  className={cn(
                    "rounded-md border px-2.5 py-1.5 text-xs transition-colors",
                    audience === opt.value
                      ? "border-foreground bg-foreground text-background"
                      : "border-border/80 bg-background text-foreground hover:bg-muted/50"
                  )}
                  onClick={() => applyAudience(opt.value)}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            {(missingParents || missingClinician) && unlocked ? (
              <p className="text-xs text-amber-800 dark:text-amber-200">
                {missingParents
                  ? "Add parent email(s) under Client details (Parent/carer email). "
                  : null}
                {missingClinician
                  ? "Add referrer email under Client details for the clinician copy."
                  : null}
              </p>
            ) : null}
          </div>

          <div className="space-y-1">
            <label className="text-xs uppercase tracking-wide text-muted-foreground">
              Letter type
            </label>
            <div className="flex flex-wrap gap-2">
              {LETTER_KIND_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  disabled={!unlocked}
                  title={opt.description}
                  className={cn(
                    "rounded-md border px-2.5 py-1.5 text-xs transition-colors",
                    letterKind === opt.value
                      ? "border-foreground bg-foreground text-background"
                      : "border-border/80 bg-background text-foreground hover:bg-muted/50"
                  )}
                  onClick={() => regenerateLetter(opt.value)}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div
            className={cn(
              "rounded-lg border border-border/80 bg-background px-5 py-4",
              !unlocked && "opacity-60"
            )}
          >
            <div className="mb-3 flex items-center justify-between gap-3 border-b border-border/60 pb-3">
              <span className="text-xs font-semibold tracking-wide text-[var(--teal-text,#0e7c8a)]">
                AZURE MIND
              </span>
              <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                Confidential
              </span>
            </div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-foreground">
              {docTitle}
            </p>
            <p className="mt-0.5 text-xs italic text-muted-foreground">{docSubtitle}</p>
            <p className="mt-3 text-xs text-muted-foreground">
              Date: {mergeFields.reportDate || "—"}
            </p>
            <p className="mt-1 text-sm font-semibold text-foreground">{regarding}</p>
            <label className="mt-4 block space-y-1 text-sm">
              <span className="text-xs uppercase tracking-wide text-muted-foreground">
                Letter body (edit — PDF adds letterhead & signature)
              </span>
              <Textarea
                rows={12}
                disabled={!unlocked}
                className="rounded-lg font-[family-name:Helvetica,Arial,sans-serif] text-sm leading-relaxed"
                value={letterBody}
                onChange={(e) => setLetterBody(e.target.value)}
              />
            </label>
            <div className="mt-3 border-t border-border/60 pt-3 text-sm text-muted-foreground">
              <p>Kind Regards,</p>
              <p className="mt-2 font-semibold text-foreground">
                {mergeFields.assessor || "Vishal Maharaj"}
              </p>
              <p className="text-xs">Registered Psychologist · PSY0001579010</p>
              <p className="text-xs text-[var(--teal-text,#0e7c8a)]">
                {mergeFields.practiceName || "Azure Mind"}
              </p>
            </div>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={!unlocked}
              className="mt-2"
              onClick={() => {
                setSubject(buildLetterSubject(letterKind, mergeFields));
                setLetterBody(buildLetterBody(letterKind, mergeFields));
              }}
            >
              Reset letter from template
            </Button>
          </div>

          <label className="block space-y-1 text-sm">
            <span className="text-xs uppercase tracking-wide text-muted-foreground">
              To —{" "}
              {audience === "clinician"
                ? "clinician"
                : audience === "parents"
                  ? "parents"
                  : "parents (primary)"}
            </span>
            <Textarea
              rows={2}
              disabled={!unlocked}
              className="rounded-lg text-sm"
              placeholder={
                audience === "clinician"
                  ? "referrer@clinic.com.au"
                  : "parent@email.com, other.parent@email.com"
              }
              value={toInput}
              onChange={(e) => {
                setRecipientsTouched(true);
                setToInput(e.target.value);
              }}
            />
            <span className="text-xs text-muted-foreground">
              {toList.length ? `${toList.length} recipient(s) recognised` : "No valid emails yet"}
            </span>
          </label>

          <label className="block space-y-1 text-sm">
            <span className="text-xs uppercase tracking-wide text-muted-foreground">
              Cc —{" "}
              {audience === "parents-and-clinician" ? "clinician (auto)" : "optional"}
            </span>
            <Textarea
              rows={1}
              disabled={!unlocked}
              className="rounded-lg text-sm"
              placeholder="referrer@clinic.com.au"
              value={ccInput}
              onChange={(e) => {
                setRecipientsTouched(true);
                setCcInput(e.target.value);
              }}
            />
          </label>

          <label className="block space-y-1 text-sm">
            <span className="text-xs uppercase tracking-wide text-muted-foreground">Subject</span>
            <input
              disabled={!unlocked}
              className="flex h-9 w-full rounded-lg border border-input bg-background px-3 text-sm"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
            />
          </label>

          <div className="flex flex-col gap-2 text-sm">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                disabled={!unlocked}
                checked={attachLetterPdf}
                onChange={(e) => setAttachLetterPdf(e.target.checked)}
              />
              Attach Texlex letter PDF
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                disabled={!unlocked}
                checked={attachReport}
                onChange={(e) => setAttachReport(e.target.checked)}
              />
              {reportAttachLabel}
            </label>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={!unlocked || previewingLetter || sending}
              onClick={() => void downloadLetterPdf()}
            >
              {previewingLetter ? "Preparing…" : "Download letter PDF"}
            </Button>
            <Button type="button" disabled={!unlocked || sending} onClick={() => void handleSend()}>
              {sending ? "Sending…" : "Send via Texlex"}
            </Button>
          </div>

          {status ? (
            <p className="text-sm text-emerald-700 dark:text-emerald-400" role="status">
              {status}
            </p>
          ) : null}
          {error ? (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}
        </CardContent>
      </Card>
    </section>
  );
}
