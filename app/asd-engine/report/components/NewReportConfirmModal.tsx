"use client";

import { useEffect, useId, useRef } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type NewReportConfirmModalProps = {
  open: boolean;
  clinikoSyncInProgress: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  skipConfirmThisSession: boolean;
  onSkipConfirmThisSessionChange: (value: boolean) => void;
};

const FOCUSABLE_SELECTOR =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function NewReportConfirmModal({
  open,
  clinikoSyncInProgress,
  onCancel,
  onConfirm,
  skipConfirmThisSession,
  onSkipConfirmThisSessionChange,
}: NewReportConfirmModalProps) {
  const headingId = useId();
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const focusTarget = modalRef.current?.querySelector<HTMLElement>("[data-new-report-confirm]");
    focusTarget?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onCancel();
        return;
      }
      if (event.key !== "Tab" || !modalRef.current) return;
      const focusable = Array.from(
        modalRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
      ).filter((element) => !element.hasAttribute("disabled"));
      if (!focusable.length) return;
      const first = focusable[0]!;
      const last = focusable[focusable.length - 1]!;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/40 backdrop-blur-[1px]"
        aria-label="Close dialog"
        onClick={onCancel}
      />
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={headingId}
        className="relative z-10 w-full max-w-[480px] rounded-xl border border-border/80 bg-white p-6 shadow-xl dark:bg-card"
      >
        <h2 id={headingId} className="text-lg font-semibold text-foreground">
          Start a new report?
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          This will clear all current report data including client details, raw notes, and all generated
          sections. This action cannot be undone.
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          Your assessor details and date of report will be preserved.
        </p>
        {clinikoSyncInProgress ? (
          <p className="mt-3 text-sm font-medium text-amber-800 dark:text-amber-200">
            A Cliniko sync is in progress. Wait for it to complete before starting a new report.
          </p>
        ) : null}
        <label className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
          <input
            type="checkbox"
            checked={skipConfirmThisSession}
            onChange={(event) => onSkipConfirmThisSessionChange(event.target.checked)}
          />
          Don&apos;t ask me again this session
        </label>
        <div className="mt-6 flex flex-wrap justify-end gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={clinikoSyncInProgress}
            data-new-report-confirm
            autoFocus
            className={cn(
              "border border-transparent bg-[#0E9F98] text-white hover:bg-[#0c8a84]",
              clinikoSyncInProgress && "opacity-50"
            )}
            onClick={onConfirm}
          >
            Start new report
          </Button>
        </div>
      </div>
    </div>
  );
}
