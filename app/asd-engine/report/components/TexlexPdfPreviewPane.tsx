"use client";

import { useEffect } from "react";
import { Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";

type TexlexPdfPreviewPaneProps = {
  open: boolean;
  busy: boolean;
  blobUrl: string | null;
  error: string | null;
  title: string;
  onClose: () => void;
};

export function TexlexPdfPreviewPane({
  open,
  busy,
  blobUrl,
  error,
  title,
  onClose,
}: TexlexPdfPreviewPaneProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <aside
      className="fixed inset-y-0 right-0 z-40 flex w-[min(52vw,760px)] flex-col border-l border-border/80 bg-background shadow-xl"
      aria-label="Report preview"
    >
      <div className="flex items-center justify-between gap-3 border-b border-border/80 px-4 py-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-foreground">{title}</p>
          <p className="text-xs text-muted-foreground">In-app preview — not saved to Cliniko</p>
        </div>
        <Button type="button" size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={onClose} aria-label="Close preview">
          <X className="h-4 w-4" />
        </Button>
      </div>
      <div className="min-h-0 flex-1 bg-muted/30">
        {busy ? (
          <div className="flex h-full items-center justify-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Preparing preview…
          </div>
        ) : error ? (
          <div className="flex h-full items-center justify-center px-6 text-center text-sm text-destructive">
            {error}
          </div>
        ) : blobUrl ? (
          <iframe title={title} src={blobUrl} className="h-full w-full border-0 bg-white" />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            No preview yet.
          </div>
        )}
      </div>
    </aside>
  );
}
