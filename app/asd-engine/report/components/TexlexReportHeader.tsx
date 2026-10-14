"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { SignOutButton } from "@/components/SignOutButton";
import { cn } from "@/lib/utils";

const BTN_GHOST =
  "inline-flex items-center justify-center rounded-lg border border-[#B7E1DE] bg-white px-4 py-2.5 text-[15px] font-semibold text-[#075E63] transition-colors hover:bg-[#E8F6F5] disabled:cursor-not-allowed disabled:opacity-50";

const BTN_PRIMARY =
  "inline-flex items-center justify-center rounded-lg border-0 bg-[#0E9F98] px-5 py-2.5 text-[16px] font-bold text-white transition-colors hover:bg-[#075E63] disabled:cursor-not-allowed disabled:opacity-50";

export type TexlexPdfBusyMode = "only" | "save" | "preview" | null;

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
    "flex w-full px-4 py-3 text-left text-[15px] text-[#122022] hover:bg-[#E8F6F5] disabled:cursor-not-allowed disabled:opacity-50";

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-label="More actions"
        aria-expanded={open}
        aria-haspopup="menu"
        className="inline-flex h-10 min-w-10 items-center justify-center rounded-lg border border-[#D5E0E0] bg-white px-3 text-lg leading-none text-[#5A6B6C] transition-colors hover:bg-[#F3F5F5] hover:text-[#075E63]"
        onClick={() => setOpen((v) => !v)}
      >
        ···
      </button>
      {open ? (
        <div
          role="menu"
          className="absolute right-0 z-50 mt-2 min-w-[14rem] rounded-lg border border-[#D5E0E0] bg-white py-1 shadow-lg"
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
              setOpen(false);
              onDownloadOnly();
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
                setOpen(false);
                onFinalPdf();
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
          <div className="my-1 border-t border-[#D5E0E0]" />
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
              className={cn(itemClass, "text-destructive")}
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
}: TexlexReportHeaderProps) {
  const displayName = clientName.trim() || "New patient";
  const flowLabel = workflowStatusText(workflowStatus, statusLabel);

  return (
    <header className="sticky top-0 z-10 border-b border-[#D5E0E0] bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/90">
      <div className="mx-auto flex max-w-[1600px] flex-wrap items-center gap-3 px-5 py-3.5">
        {onToggleToday ? (
          <button
            type="button"
            className={cn(BTN_GHOST, todayOpen && "bg-[#E8F6F5]")}
            onClick={onToggleToday}
          >
            Today
          </button>
        ) : null}

        <div className="min-w-0 flex-1">
          <p className="truncate text-[20px] font-extrabold tracking-tight text-[#075E63] sm:text-[22px]">
            {displayName}{" "}
            <span className="font-medium text-[#5A6B6C]">· {assessmentLabel.replace(/ assessment$/i, "")}</span>
          </p>
          <p
            className={cn(
              "mt-0.5 text-[15px] font-semibold",
              saveFailed
                ? "text-destructive"
                : workflowStatus === "ready" || flowLabel.toLowerCase().includes("ready")
                  ? "text-[#0F766E] underline decoration-[#B7E1DE] underline-offset-4"
                  : editing
                    ? "text-[#122022]"
                    : "text-[#5A6B6C]"
            )}
          >
            {saveFailed ? "Save failed" : flowLabel}
          </p>
          {statusExtras ? (
            <div className="mt-1 flex flex-wrap gap-2 text-[13px] text-[#5A6B6C]">{statusExtras}</div>
          ) : null}
        </div>

        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
          {onGenerateAll ? (
            <button
              type="button"
              className={BTN_GHOST}
              disabled={pdfDownloading || generateAllBusy}
              onClick={onGenerateAll}
            >
              {generateAllBusy ? "Generating…" : "Generate all"}
            </button>
          ) : null}
          <button
            type="button"
            className={BTN_GHOST}
            disabled={pdfDownloading}
            onClick={onSaveDraft}
          >
            Save
          </button>
          {onOpenSend ? (
            <button
              type="button"
              className={BTN_PRIMARY}
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
          />
          <SignOutButton className="inline-flex items-center justify-center rounded-lg border border-[#D5E0E0] bg-white px-3 py-2.5 text-[14px] font-semibold text-[#5A6B6C] transition-colors hover:bg-[#F3F5F5] hover:text-[#075E63]" />
        </div>
      </div>
    </header>
  );
}
