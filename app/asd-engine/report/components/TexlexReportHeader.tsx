"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { ReportFindBar } from "@/components/ReportFindBar";
import { SignOutButton } from "@/components/SignOutButton";
import { TexlexWorkspaceLinks } from "@/components/TexlexWorkspaceLinks";
import { cn } from "@/lib/utils";

const ACTION =
  "inline-flex items-center justify-center border-0 bg-transparent px-0 py-1 text-[17px] font-medium text-[#c5d4e4] transition-colors hover:text-[#f4f8fc] disabled:cursor-not-allowed disabled:opacity-40";

const ACTION_EMPHASIS =
  "inline-flex items-center justify-center border-0 bg-transparent px-0 py-1 text-[17px] font-semibold text-[#9fc3f2] transition-colors hover:text-[#eaf1f8] disabled:cursor-not-allowed disabled:opacity-40";

export type TexlexPdfBusyMode = "only" | "save" | "preview" | null;

export type TexlexHeaderRestoreNotice = {
  message: string;
  onDiscard: () => void;
};

type TexlexReportHeaderProps = {
  clientName: string;
  /** e.g. "ASD assessment" / "ADHD assessment" */
  assessmentLabel?: string;
  statusLabel: string;
  /** High-level workflow status shown as plain text (no capsules). */
  workflowStatus?: "draft" | "ready" | "sent" | string;
  saveFailed: boolean;
  editing: boolean;
  pdfDownloading: boolean;
  pdfBusyMode: TexlexPdfBusyMode;
  onDownloadOnly: () => void;
  onDownloadAndSave: () => void;
  onPreviewPdf: () => void;
  onNewReport: () => void;
  onSaveDraft: () => void;
  onFinalizeReview?: () => void;
  finalPdfUnlocked?: boolean;
  onFinalPdfDownload?: () => void;
  /** Review clear — Send report enabled (PDF builds on send). */
  sendUnlocked?: boolean;
  onOpenSend?: () => void;
  onGenerateAll?: () => void;
  generateAllBusy?: boolean;
  onToggleToday?: () => void;
  todayOpen?: boolean;
  statusExtras?: ReactNode;
  engineHomeHref?: string;
  /** Practice file the final PDF is saved to. */
  recordLabel?: string;
  /** Inline draft-restored notice (keeps Discard with the message). */
  restoreNotice?: TexlexHeaderRestoreNotice | null;
};

function TexlexHeaderOverflowMenu({
  saveFailed,
  pdfDownloading,
  onNewReport,
  onSaveDraft,
  onPreviewPdf,
  onDownloadOnly,
  onFinalPdf,
  finalPdfUnlocked,
  pdfBusyMode,
  onFinalizeReview,
  engineHomeHref,
  recordLabel,
  restoreNotice,
}: {
  saveFailed: boolean;
  pdfDownloading: boolean;
  onNewReport: () => void;
  onSaveDraft: () => void;
  onPreviewPdf: () => void;
  onDownloadOnly: () => void;
  onFinalPdf?: () => void;
  finalPdfUnlocked: boolean;
  pdfBusyMode: TexlexPdfBusyMode;
  onFinalizeReview?: () => void;
  engineHomeHref: string;
  recordLabel: string;
  restoreNotice?: TexlexHeaderRestoreNotice | null;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const itemClass =
    "flex w-full px-4 py-3.5 text-left text-[17px] text-[#eaf1f8] hover:bg-[#13263a] disabled:cursor-not-allowed disabled:opacity-50";

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-label="More actions"
        aria-expanded={open}
        aria-haspopup="menu"
        className="inline-flex h-10 min-w-10 items-center justify-center border-0 bg-transparent px-1 text-[26px] leading-none tracking-[0.08em] text-[#849aaf] transition-colors hover:text-[#eaf1f8]"
        onClick={() => setOpen((v) => !v)}
      >
        ···
      </button>
      {open ? (
        <div
          role="menu"
          className="absolute right-0 z-50 mt-2 min-w-[15rem] overflow-hidden rounded-xl border border-[#2c455f] bg-[#0a1828] py-1 shadow-[0_24px_60px_rgba(1,6,15,0.5)]"
        >
          <button
            type="button"
            role="menuitem"
            className={itemClass}
            disabled={pdfDownloading}
            onClick={() => {
              setOpen(false);
              onPreviewPdf();
            }}
          >
            {pdfBusyMode === "preview" ? "Preparing preview…" : "Preview PDF"}
          </button>
          <button
            type="button"
            role="menuitem"
            className={itemClass}
            disabled={pdfDownloading}
            onClick={() => {
              onDownloadOnly();
              setOpen(false);
            }}
          >
            {pdfBusyMode === "only" ? "Preparing…" : "Download draft"}
          </button>
          {onFinalPdf ? (
            <button
              type="button"
              role="menuitem"
              className={itemClass}
              disabled={pdfDownloading || !finalPdfUnlocked}
              title={
                finalPdfUnlocked
                  ? `Download final PDF and save to ${recordLabel}`
                  : "Clear review blockers first"
              }
              onClick={() => {
                onFinalPdf();
                setOpen(false);
              }}
            >
              {pdfBusyMode === "save"
                ? "Preparing…"
                : finalPdfUnlocked
                  ? `Save PDF to ${recordLabel}`
                  : "Save PDF (review blocked)"}
            </button>
          ) : null}
          {onFinalizeReview ? (
            <button
              type="button"
              role="menuitem"
              className={itemClass}
              disabled={pdfDownloading}
              onClick={() => {
                setOpen(false);
                onFinalizeReview();
              }}
            >
              Jump to Review
            </button>
          ) : null}
          <div className="my-1 border-t border-[#23384d]" />
          {restoreNotice ? (
            <button
              type="button"
              role="menuitem"
              className={cn(itemClass, "text-[#f0b4b4]")}
              onClick={() => {
                setOpen(false);
                restoreNotice.onDiscard();
              }}
            >
              Discard restored draft
            </button>
          ) : null}
          <button
            type="button"
            role="menuitem"
            className={itemClass}
            disabled={pdfDownloading}
            onClick={() => {
              setOpen(false);
              onNewReport();
            }}
          >
            New report
          </button>
          <button
            type="button"
            role="menuitem"
            className={itemClass}
            onClick={() => {
              setOpen(false);
              onSaveDraft();
            }}
          >
            Save draft
          </button>
          {saveFailed ? (
            <button
              type="button"
              role="menuitem"
              className={cn(itemClass, "text-[#f0b4b4]")}
              onClick={() => {
                setOpen(false);
                onSaveDraft();
              }}
            >
              Retry save
            </button>
          ) : null}
          <Link
            href={engineHomeHref}
            role="menuitem"
            className={itemClass}
            onClick={() => setOpen(false)}
          >
            Engine dashboard
          </Link>
        </div>
      ) : null}
    </div>
  );
}

function workflowStatusText(workflowStatus: string | undefined, statusLabel: string) {
  if (workflowStatus === "ready") return "Ready to send";
  if (workflowStatus === "sent") return "Sent";
  if (workflowStatus === "draft") return statusLabel || "Draft";
  return statusLabel;
}

export function TexlexReportHeader({
  clientName,
  assessmentLabel = "ASD assessment",
  statusLabel,
  workflowStatus,
  saveFailed,
  editing,
  pdfDownloading,
  pdfBusyMode,
  onDownloadOnly,
  onDownloadAndSave,
  onPreviewPdf,
  onNewReport,
  onSaveDraft,
  onFinalizeReview,
  finalPdfUnlocked = true,
  onFinalPdfDownload,
  sendUnlocked = false,
  onOpenSend,
  onGenerateAll,
  generateAllBusy,
  onToggleToday,
  todayOpen,
  statusExtras,
  engineHomeHref = "/asd-engine",
  recordLabel = "Cliniko",
  restoreNotice = null,
}: TexlexReportHeaderProps) {
  const displayName = clientName.trim() || "New patient";
  const flowLabel = workflowStatusText(workflowStatus, statusLabel);
  const pathway = assessmentLabel.replace(/ assessment$/i, "");

  return (
    <header className="relative z-10 border-b border-[#2c455f]/80 bg-[#0c1a2b]/95 backdrop-blur-md">
      <div className="mx-auto flex max-w-[1760px] flex-col gap-3 px-6 py-3.5">
        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
          <TexlexWorkspaceLinks density="header" />
          <p className="text-[13px] text-[#6f859b]">
            Drafts autosave — leave and return anytime
          </p>
        </div>

        <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <h1 className="truncate text-[28px] font-semibold leading-none tracking-[-0.03em] text-[#f4f8fc] sm:text-[32px]">
                {displayName}
              </h1>
              <span className="text-[15px] font-semibold uppercase tracking-[0.14em] text-[#9fc3f2]">
                {pathway}
              </span>
            </div>

            <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[15px] leading-snug">
              <span
                className={cn(
                  "font-medium",
                  saveFailed ? "text-[#f0b4b4]" : editing ? "text-[#eaf1f8]" : "text-[#9eb2c6]"
                )}
              >
                {saveFailed ? "Save failed" : flowLabel}
              </span>

              {statusExtras ? (
                <>
                  <span className="text-[#3d5874]" aria-hidden>
                    ·
                  </span>
                  <span className="text-[#9eb2c6]">{statusExtras}</span>
                </>
              ) : null}

              {restoreNotice ? (
                <>
                  <span className="text-[#3d5874]" aria-hidden>
                    ·
                  </span>
                  <span className="text-[#9eb2c6]" aria-live="polite">
                    {restoreNotice.message}
                  </span>
                </>
              ) : null}
            </div>
          </div>

          <div className="flex shrink-0 flex-wrap items-center justify-end gap-x-6 gap-y-2">
            {onToggleToday ? (
              <button
                type="button"
                className={cn(ACTION, todayOpen && "text-[#f4f8fc]")}
                onClick={onToggleToday}
              >
                {todayOpen ? "Hide calendar" : "Show calendar"}
              </button>
            ) : null}
            {onGenerateAll ? (
              <button
                type="button"
                className={ACTION}
                disabled={pdfDownloading || generateAllBusy}
                onClick={onGenerateAll}
              >
                {generateAllBusy ? "Generating…" : "Generate all"}
              </button>
            ) : null}
            <button
              type="button"
              className={ACTION}
              disabled={pdfDownloading}
              onClick={onSaveDraft}
            >
              Save
            </button>
            {onOpenSend ? (
              <button
                type="button"
                className={ACTION_EMPHASIS}
                disabled={pdfDownloading || !sendUnlocked}
                title={
                  sendUnlocked
                    ? "Preview and send — PDF builds with the send"
                    : "Clear Review blockers first"
                }
                onClick={onOpenSend}
              >
                Send report
              </button>
            ) : null}
            <TexlexHeaderOverflowMenu
              saveFailed={saveFailed}
              pdfDownloading={pdfDownloading}
              onNewReport={onNewReport}
              onSaveDraft={onSaveDraft}
              onPreviewPdf={onPreviewPdf}
              onDownloadOnly={onDownloadOnly}
              onFinalPdf={
                onFinalPdfDownload
                  ? () => {
                      if (!finalPdfUnlocked) {
                        onFinalizeReview?.();
                        return;
                      }
                      onFinalPdfDownload();
                    }
                  : () => onDownloadAndSave()
              }
              finalPdfUnlocked={finalPdfUnlocked}
              pdfBusyMode={pdfBusyMode}
              onFinalizeReview={onFinalizeReview}
              engineHomeHref={engineHomeHref}
              recordLabel={recordLabel}
              restoreNotice={restoreNotice}
            />
            <SignOutButton className={ACTION} />
            <ReportFindBar className="texlex-header-find" />
          </div>
        </div>
      </div>
    </header>
  );
}
