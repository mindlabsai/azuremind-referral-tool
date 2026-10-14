"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  BUILTIN_REFERRAL_DOCTORS,
  LETTER_KIND_OPTIONS,
  SEND_AUDIENCE_OPTIONS,
  buildLetterBody,
  buildLetterEmailHtml,
  buildLetterRegardingLine,
  buildLetterSubject,
  letterDocumentSubtitle,
  letterDocumentTitle,
  parseRecipientList,
  readExtraReferralDoctors,
  referralDoctorById,
  resolveAudienceRecipients,
  saveExtraReferralDoctor,
  type LetterKind,
  type LetterMergeFields,
  type RecipientBuckets,
  type ReferralDoctor,
  type SendAudience,
} from "@/lib/texlex-comms/letters";
import { TEXLEX_SECTION_CONTENT_CLASS } from "../constants/texlexSectionSurface";

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
  /** Compact layout for the Send report drawer (no outer section chrome). */
  embedded?: boolean;
};

export function TexlexSendPanel({
  unlocked,
  mergeFields,
  recipientBuckets,
  buildReportPdfBase64,
  buildLetterPdfBase64,
  reportAttachLabel = "Attach final ASD report PDF",
  onScrollToFinalize,
  embedded = false,
}: Props) {
  const [audience, setAudience] = useState<SendAudience>("parents-and-clinician");
  const initialRecipients = resolveAudienceRecipients("parents-and-clinician", recipientBuckets);
  const [toInput, setToInput] = useState(() => initialRecipients.to.join(", "));
  const [ccInput, setCcInput] = useState(() => initialRecipients.cc.join(", "));
  const [letterKind, setLetterKind] = useState<LetterKind>("parent-cover");
  const [extraDoctors, setExtraDoctors] = useState<ReferralDoctor[]>([]);
  const [referralDoctorId, setReferralDoctorId] = useState("chaandini-subramaniam");
  const [addingDoctor, setAddingDoctor] = useState(false);
  const [newDoctorName, setNewDoctorName] = useState("");
  const [newDoctorRole, setNewDoctorRole] = useState("");
  const [newDoctorClinic, setNewDoctorClinic] = useState("");
  const [subject, setSubject] = useState(() => buildLetterSubject("parent-cover", mergeFields));
  const [letterBody, setLetterBody] = useState(() => buildLetterBody("parent-cover", mergeFields));
  const [attachReport, setAttachReport] = useState(true);
  const [attachLetterPdf, setAttachLetterPdf] = useState(true);
  const [sending, setSending] = useState(false);
  const [previewingLetter, setPreviewingLetter] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [recipientsTouched, setRecipientsTouched] = useState(false);

  useEffect(() => {
    setExtraDoctors(readExtraReferralDoctors());
  }, []);

  const doctorFor = (
    kind: LetterKind,
    doctorId = referralDoctorId,
    extras: ReferralDoctor[] = extraDoctors
  ) => (kind === "dr-muru-referral" ? referralDoctorById(doctorId, extras) : undefined);

  const writeLetter = (
    kind: LetterKind,
    doctorId = referralDoctorId,
    extras: ReferralDoctor[] = extraDoctors
  ) => {
    setSubject(buildLetterSubject(kind, mergeFields));
    setLetterBody(buildLetterBody(kind, mergeFields, doctorFor(kind, doctorId, extras)));
  };

  const applyAudience = (next: SendAudience, buckets: RecipientBuckets = recipientBuckets) => {
    const option = SEND_AUDIENCE_OPTIONS.find((o) => o.value === next)!;
    const kind = option.defaultLetterKind;
    const resolved = resolveAudienceRecipients(next, buckets);
    setAudience(next);
    setLetterKind(kind);
    setAddingDoctor(false);
    writeLetter(kind);
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
    setLetterBody(
      buildLetterBody(letterKind, mergeFields, doctorFor(letterKind, referralDoctorId))
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    letterKind,
    referralDoctorId,
    extraDoctors,
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
    setAddingDoctor(false);
    writeLetter(kind);
    // Align audience with letter when switching referral types
    if (kind === "parent-cover" && audience === "clinician") {
      applyAudience("parents-and-clinician");
      setLetterKind("parent-cover");
      writeLetter("parent-cover");
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

  const body = (
        <div className={cn("space-y-4", !embedded && TEXLEX_SECTION_CONTENT_CLASS)}>
          {!embedded ? (
            <p className="text-[15px] text-muted-foreground">
              Parents, clinicians, or both. Sends from{" "}
              <span className="text-foreground">admin@azuremind.com.au</span>. PDF builds with
              this send — the finished PDF is saved from More → Save PDF.
            </p>
          ) : null}

          {!unlocked ? (
            <div className="rounded-lg border border-amber-300/80 bg-amber-50 px-4 py-3 text-[15px] text-amber-950 dark:border-amber-700 dark:bg-amber-950/30 dark:text-amber-50">
              Locked until Review is clear.{" "}
              {onScrollToFinalize ? (
                <button type="button" className="font-semibold underline" onClick={onScrollToFinalize}>
                  Open Review
                </button>
              ) : null}
            </div>
          ) : (
            <p className="text-[15px] font-semibold text-[#0F766E]">Ready — PDF builds when you send</p>
          )}

          <div className="space-y-2">
            <label className="text-[13px] font-bold text-[#5A6B6C]">Who receives this</label>
            <div className="grid gap-2">
              {SEND_AUDIENCE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  disabled={!unlocked}
                  title={opt.description}
                  className={cn(
                    "rounded-lg border px-4 py-3 text-left text-[15px] font-semibold transition-colors",
                    audience === opt.value
                      ? "border-[#0E9F98] bg-[#E8F6F5] text-[#075E63]"
                      : "border-[#D5E0E0] bg-white text-[#5A6B6C] hover:bg-[#F3F5F5]"
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

          <div className="space-y-2">
            <label className="text-[13px] font-bold text-[#5A6B6C]">Letter type</label>
            <div className="grid gap-2">
              {LETTER_KIND_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  disabled={!unlocked}
                  title={opt.description}
                  className={cn(
                    "rounded-lg border px-4 py-3 text-left text-[15px] font-semibold transition-colors",
                    letterKind === opt.value
                      ? "border-[#0E9F98] bg-[#E8F6F5] text-[#075E63]"
                      : "border-[#D5E0E0] bg-white text-[#5A6B6C] hover:bg-[#F3F5F5]"
                  )}
                  onClick={() => regenerateLetter(opt.value)}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            {letterKind === "dr-muru-referral" ? (
              <div className="space-y-2">
                <label className="block text-[13px] font-bold text-[#5A6B6C]" htmlFor="referral-doctor">
                  Referral doctor
                </label>
                <select
                  id="referral-doctor"
                  disabled={!unlocked}
                  className="h-11 w-full rounded-lg border border-[#D5E0E0] bg-white px-3 text-[15px] text-[#075E63]"
                  value={addingDoctor ? "add" : referralDoctorId}
                  onChange={(event) => {
                    const value = event.target.value;
                    if (value === "add") {
                      setAddingDoctor(true);
                      return;
                    }
                    setAddingDoctor(false);
                    setReferralDoctorId(value);
                    writeLetter("dr-muru-referral", value);
                  }}
                >
                  {[...BUILTIN_REFERRAL_DOCTORS, ...extraDoctors].map((doctor) => (
                    <option key={doctor.id} value={doctor.id}>
                      {doctor.name}
                    </option>
                  ))}
                  <option value="add">Add a doctor…</option>
                </select>
                {addingDoctor ? (
                  <form
                    className="grid gap-2"
                    onSubmit={(event) => {
                      event.preventDefault();
                      const name = newDoctorName.trim();
                      if (!name) return;
                      const doctor: ReferralDoctor = {
                        id: `custom-${Date.now()}`,
                        name: /^dr\.?\s+/i.test(name) ? name : `Dr ${name}`,
                        role: newDoctorRole.trim(),
                        clinic: newDoctorClinic.trim(),
                      };
                      const next = saveExtraReferralDoctor(doctor);
                      setExtraDoctors(next);
                      setReferralDoctorId(doctor.id);
                      setAddingDoctor(false);
                      setNewDoctorName("");
                      setNewDoctorRole("");
                      setNewDoctorClinic("");
                      writeLetter("dr-muru-referral", doctor.id, next);
                    }}
                  >
                    <input
                      required
                      disabled={!unlocked}
                      value={newDoctorName}
                      onChange={(event) => setNewDoctorName(event.target.value)}
                      placeholder="Doctor name"
                      className="h-10 rounded-lg border border-[#D5E0E0] px-3 text-sm"
                    />
                    <input
                      disabled={!unlocked}
                      value={newDoctorRole}
                      onChange={(event) => setNewDoctorRole(event.target.value)}
                      placeholder="Role, if you want it on the letter"
                      className="h-10 rounded-lg border border-[#D5E0E0] px-3 text-sm"
                    />
                    <input
                      disabled={!unlocked}
                      value={newDoctorClinic}
                      onChange={(event) => setNewDoctorClinic(event.target.value)}
                      placeholder="Clinic, if you want it on the letter"
                      className="h-10 rounded-lg border border-[#D5E0E0] px-3 text-sm"
                    />
                    <button
                      type="submit"
                      disabled={!unlocked}
                      className="h-10 rounded-lg bg-[#075E63] text-sm font-semibold text-white"
                    >
                      Add doctor
                    </button>
                  </form>
                ) : null}
              </div>
            ) : null}
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
                writeLetter(letterKind);
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

          <div className="flex flex-col gap-2">
            <Button
              type="button"
              className="h-12 rounded-lg bg-[#0E9F98] text-[16px] font-bold text-white hover:bg-[#075E63]"
              disabled={!unlocked || sending}
              onClick={() => void handleSend()}
            >
              {sending ? "Sending…" : "Send report"}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="h-11 rounded-lg text-[15px]"
              disabled={!unlocked || previewingLetter || sending}
              onClick={() => void downloadLetterPdf()}
            >
              {previewingLetter ? "Preparing…" : "Download letter PDF"}
            </Button>
          </div>

          {status ? (
            <p className="text-[15px] font-semibold text-emerald-700 dark:text-emerald-400" role="status">
              {status}
            </p>
          ) : null}
          {error ? (
            <p className="text-[15px] text-destructive" role="alert">
              {error}
            </p>
          ) : null}
        </div>
  );

  if (embedded) {
    return <div id="texlex-send">{body}</div>;
  }

  return (
    <section id="texlex-send" className="sr-only" aria-hidden>
      {/* Inline panel kept for anchors; primary UX is the Send report drawer. */}
    </section>
  );
}
