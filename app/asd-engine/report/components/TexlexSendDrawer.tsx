"use client";

import { useEffect } from "react";
import { TexlexSendPanel } from "./TexlexSendPanel";
import type { LetterKind, LetterMergeFields, RecipientBuckets } from "@/lib/texlex-comms/letters";

type PdfAttachment = { filename: string; contentBase64: string };

type Props = {
  open: boolean;
  onClose: () => void;
  unlocked: boolean;
  mergeFields: LetterMergeFields;
  recipientBuckets: RecipientBuckets;
  buildReportPdfBase64: () => Promise<PdfAttachment>;
  buildLetterPdfBase64: (args: { kind: LetterKind; body: string }) => Promise<PdfAttachment>;
  reportAttachLabel?: string;
  onScrollToFinalize?: () => void;
  clientLabel?: string;
};

export function TexlexSendDrawer({
  open,
  onClose,
  unlocked,
  mergeFields,
  recipientBuckets,
  buildReportPdfBase64,
  buildLetterPdfBase64,
  reportAttachLabel,
  onScrollToFinalize,
  clientLabel,
}: Props) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;

  const name = clientLabel?.trim() || mergeFields.clientName?.trim() || "Client";

  return (
    <div className="fixed inset-0 z-[80]" role="dialog" aria-modal="true" aria-label="Send report">
      <button
        type="button"
        className="absolute inset-0 border-0 bg-[rgba(10,30,32,0.4)]"
        aria-label="Close send report"
        onClick={onClose}
      />
      <aside className="absolute inset-y-0 right-0 flex w-full max-w-[460px] flex-col border-l border-[#D5E0E0] bg-white shadow-[0_22px_56px_rgba(7,94,99,0.16)] animate-in slide-in-from-right duration-200">
        <div className="flex items-start gap-3 border-b border-[#D5E0E0] px-5 py-4">
          <div className="min-w-0 flex-1">
            <h2 className="text-[22px] font-extrabold tracking-tight text-[#075E63]">Send report</h2>
            <p className="mt-1 text-[15px] text-[#5A6B6C]">
              {name} · builds PDF · Azure Mind preview
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border-0 bg-[#F3F5F5] text-xl text-[#5A6B6C] hover:bg-[#E8F6F5]"
            aria-label="Close"
          >
            ×
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-4">
          <TexlexSendPanel
            unlocked={unlocked}
            mergeFields={mergeFields}
            recipientBuckets={recipientBuckets}
            buildReportPdfBase64={buildReportPdfBase64}
            buildLetterPdfBase64={buildLetterPdfBase64}
            reportAttachLabel={reportAttachLabel}
            onScrollToFinalize={() => {
              onClose();
              onScrollToFinalize?.();
            }}
            embedded
          />
        </div>
      </aside>
    </div>
  );
}
