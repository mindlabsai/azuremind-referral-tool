"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  LETTER_KIND_OPTIONS,
  buildLetterBody,
  buildLetterEmailHtml,
  buildLetterSubject,
  parseRecipientList,
  type LetterKind,
  type LetterMergeFields,
} from "@/lib/texlex-comms/letters";
import { TEXLEX_SECTION_CONTAINER_CLASS, TEXLEX_SECTION_CONTENT_CLASS } from "../constants/texlexSectionSurface";

type Props = {
  unlocked: boolean;
  mergeFields: LetterMergeFields;
  defaultRecipients: string[];
  /** Build current final report PDF as base64 (no data: prefix). */
  buildReportPdfBase64: () => Promise<{ filename: string; contentBase64: string }>;
  onScrollToFinalize?: () => void;
};

export function TexlexSendPanel({
  unlocked,
  mergeFields,
  defaultRecipients,
  buildReportPdfBase64,
  onScrollToFinalize,
}: Props) {
  const [toInput, setToInput] = useState(() => defaultRecipients.join(", "));
  const [ccInput, setCcInput] = useState("");
  const [letterKind, setLetterKind] = useState<LetterKind>("parent-cover");
  const [subject, setSubject] = useState(() => buildLetterSubject("parent-cover", mergeFields));
  const [letterBody, setLetterBody] = useState(() => buildLetterBody("parent-cover", mergeFields));
  const [attachReport, setAttachReport] = useState(true);
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [toTouched, setToTouched] = useState(false);

  useEffect(() => {
    if (!toTouched && defaultRecipients.length) {
      setToInput(defaultRecipients.join(", "));
    }
  }, [defaultRecipients, toTouched]);

  // Refresh merge-driven letter when key demographics change
  useEffect(() => {
    setSubject(buildLetterSubject(letterKind, mergeFields));
    setLetterBody(buildLetterBody(letterKind, mergeFields));
    // Intentionally keyed on identity fields, not full mergeFields object
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

  const regenerateLetter = (kind: LetterKind) => {
    setLetterKind(kind);
    setSubject(buildLetterSubject(kind, mergeFields));
    setLetterBody(buildLetterBody(kind, mergeFields));
    setStatus(null);
    setError(null);
  };

  const handleSend = async () => {
    if (!unlocked) {
      onScrollToFinalize?.();
      setError("Complete Final PDF first, then send from Texlex.");
      return;
    }
    if (!toList.length) {
      setError("Add at least one valid recipient email (comma-separated for multiple).");
      return;
    }
    setSending(true);
    setError(null);
    setStatus(null);
    try {
      const attachments: Array<{ filename: string; contentBase64: string; contentType: string }> = [];
      if (attachReport) {
        const pdf = await buildReportPdfBase64();
        attachments.push({
          filename: pdf.filename,
          contentBase64: pdf.contentBase64,
          contentType: "application/pdf",
        });
      }
      const letterFilename = `AzureMind-Letter-${letterKind}-${(mergeFields.clientName || "client").replace(/\s+/g, "-")}.txt`;
      const letterBytes = new TextEncoder().encode(letterBody);
      let letterBinary = "";
      for (let i = 0; i < letterBytes.length; i++) letterBinary += String.fromCharCode(letterBytes[i]!);
      attachments.push({
        filename: letterFilename,
        contentBase64: btoa(letterBinary),
        contentType: "text/plain; charset=utf-8",
      });

      const res = await fetch("/api/send-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: toList,
          ...(ccList.length ? { cc: ccList } : {}),
          subject,
          html: buildLetterEmailHtml(letterBody, mergeFields.clientName),
          text: letterBody,
          attachments,
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
          Multi-recipient · letters · report PDF
        </span>
      </div>
      <Card className={TEXLEX_SECTION_CONTAINER_CLASS}>
        <CardContent className={cn(TEXLEX_SECTION_CONTENT_CLASS, "space-y-4")}>
          <p className="text-sm text-muted-foreground">
            After Final PDF, email parents, Dr Muru, referrers, or schools from Texlex. Cliniko keeps the
            file; Texlex sends the email.
          </p>

          {!unlocked ? (
            <div className="rounded-lg border border-amber-300/80 bg-amber-50 px-3 py-2 text-sm text-amber-950 dark:border-amber-700 dark:bg-amber-950/30 dark:text-amber-50">
              Locked until Final PDF completes.{" "}
              <button type="button" className="underline" onClick={onScrollToFinalize}>
                Finish review / Final PDF first
              </button>
            </div>
          ) : (
            <Badge variant="secondary">Unlocked — Final PDF ready</Badge>
          )}

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

          <label className="block space-y-1 text-sm">
            <span className="text-xs uppercase tracking-wide text-muted-foreground">
              To (multiple — comma or new line)
            </span>
            <Textarea
              rows={2}
              disabled={!unlocked}
              className="rounded-lg text-sm"
              placeholder="parent@email.com, other.parent@email.com"
              value={toInput}
              onChange={(e) => {
                setToTouched(true);
                setToInput(e.target.value);
              }}
            />
            <span className="text-xs text-muted-foreground">
              {toList.length ? `${toList.length} recipient(s) recognised` : "No valid emails yet"}
            </span>
          </label>

          <label className="block space-y-1 text-sm">
            <span className="text-xs uppercase tracking-wide text-muted-foreground">Cc (optional)</span>
            <Textarea
              rows={1}
              disabled={!unlocked}
              className="rounded-lg text-sm"
              placeholder="referrer@clinic.com.au"
              value={ccInput}
              onChange={(e) => setCcInput(e.target.value)}
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

          <label className="block space-y-1 text-sm">
            <span className="text-xs uppercase tracking-wide text-muted-foreground">
              Letter (edit before send)
            </span>
            <Textarea
              rows={14}
              disabled={!unlocked}
              className="rounded-lg font-serif text-sm leading-relaxed"
              value={letterBody}
              onChange={(e) => setLetterBody(e.target.value)}
            />
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={!unlocked}
              onClick={() => regenerateLetter(letterKind)}
            >
              Reset letter from template
            </Button>
          </label>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              disabled={!unlocked}
              checked={attachReport}
              onChange={(e) => setAttachReport(e.target.checked)}
            />
            Attach final ASD report PDF
          </label>

          <div className="flex flex-wrap items-center gap-2">
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
