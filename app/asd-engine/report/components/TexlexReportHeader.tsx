"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

const TEXLEX_PRIMARY_BUTTON_CLASS =
  "inline-flex items-center justify-center rounded-md border-0 bg-[#1A1A1A] px-3 py-[5px] text-xs text-white transition-colors hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-60";

type TexlexReportHeaderProps = {
  clientName: string;
  statusLabel: string;
  saveFailed: boolean;
  editing: boolean;
  pdfDownloading: boolean;
  onDownloadPdf: () => void;
  onNewReport: () => void;
  onSaveDraft: () => void;
  statusExtras?: ReactNode;
};

function TexlexHeaderOverflowMenu({
  saveFailed,
  pdfDownloading,
  onNewReport,
  onSaveDraft,
}: {
  saveFailed: boolean;
  pdfDownloading: boolean;
  onNewReport: () => void;
  onSaveDraft: () => void;
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

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-label="More actions"
        aria-expanded={open}
        aria-haspopup="menu"
        className="inline-flex h-8 min-w-8 items-center justify-center rounded-md border border-border/80 bg-background px-2 text-base leading-none text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
        onClick={() => setOpen((v) => !v)}
      >
        ···
      </button>
      {open ? (
        <div
          role="menu"
          className="absolute right-0 z-50 mt-1 min-w-[11rem] rounded-md border border-border/80 bg-background py-1 shadow-md"
        >
          <button
            type="button"
            role="menuitem"
            className="flex w-full px-3 py-2 text-left text-sm text-foreground hover:bg-muted/50 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={pdfDownloading}
            onClick={() => {
              setOpen(false);
              onNewReport();
            }}
          >
            New Report
          </button>
          <button
            type="button"
            role="menuitem"
            className="flex w-full px-3 py-2 text-left text-sm text-foreground hover:bg-muted/50"
            onClick={() => {
              setOpen(false);
              onSaveDraft();
            }}
          >
            Save Draft
          </button>
          {saveFailed ? (
            <button
              type="button"
              role="menuitem"
              className="flex w-full px-3 py-2 text-left text-sm text-destructive hover:bg-muted/50"
              onClick={() => {
                setOpen(false);
                onSaveDraft();
              }}
            >
              Retry save
            </button>
          ) : null}
          <span
            className="flex w-full cursor-not-allowed px-3 py-2 text-sm text-muted-foreground opacity-60"
            title="Available after report sections are generated"
            role="menuitem"
            aria-disabled
          >
            Download DOCX
          </span>
          <span
            className="flex w-full cursor-not-allowed px-3 py-2 text-sm text-muted-foreground opacity-60"
            title="Available after report sections are generated"
            role="menuitem"
            aria-disabled
          >
            Email
          </span>
          <Link
            href="/asd-engine"
            role="menuitem"
            className="flex w-full px-3 py-2 text-sm text-foreground hover:bg-muted/50"
            onClick={() => setOpen(false)}
          >
            Engine dashboard
          </Link>
        </div>
      ) : null}
    </div>
  );
}

export function TexlexReportHeader({
  clientName,
  statusLabel,
  saveFailed,
  editing,
  pdfDownloading,
  onDownloadPdf,
  onNewReport,
  onSaveDraft,
  statusExtras,
}: TexlexReportHeaderProps) {
  const displayName = clientName.trim() || "Client name not set";
  const subtitle = `${displayName} · ASD assessment`;

  return (
    <header className="sticky top-0 z-10 border-b border-border/80 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="mx-auto flex max-w-[1600px] items-center justify-between gap-4 px-5 py-3">
        <div className="min-w-0">
          <p className="text-lg font-semibold tracking-tight text-foreground">Texlex</p>
          <p className="truncate text-xs text-muted-foreground">{subtitle}</p>
        </div>
        <div className="flex shrink-0 items-center justify-end gap-3">
          <div className="flex flex-col items-end gap-1">
            <span
              className={cn(
                "text-xs text-[var(--text-3)]",
                saveFailed && "font-medium text-destructive",
                editing && !saveFailed && "text-foreground"
              )}
            >
              {statusLabel}
            </span>
            {statusExtras ? (
              <div className="flex flex-wrap justify-end gap-2">{statusExtras}</div>
            ) : null}
          </div>
          <button
            type="button"
            className={TEXLEX_PRIMARY_BUTTON_CLASS}
            disabled={pdfDownloading}
            onClick={onDownloadPdf}
          >
            {pdfDownloading ? "Preparing PDF…" : "Download PDF"}
          </button>
          <TexlexHeaderOverflowMenu
            saveFailed={saveFailed}
            pdfDownloading={pdfDownloading}
            onNewReport={onNewReport}
            onSaveDraft={onSaveDraft}
          />
        </div>
      </div>
    </header>
  );
}
