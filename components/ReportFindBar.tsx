"use client";

import { useEffect, useState } from "react";
import { Search } from "lucide-react";
import { allSpans, collectReportFields, revealMatch, writeReportField, type ReportField } from "@/lib/report-find";

type Hit = { field: ReportField; start: number; end: number };

function pageRoot(): ParentNode {
  return document.querySelector(".texlex-surface, .report-desk") ?? document.body;
}

function scan(query: string): Hit[] {
  const needle = query.trim();
  if (needle.length < 2) return [];
  const hits: Hit[] = [];
  for (const field of collectReportFields(pageRoot())) {
    for (const span of allSpans(field.value, needle)) {
      hits.push({ field, start: span.start, end: span.end });
    }
  }
  return hits;
}

export function ReportFindBar({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [fix, setFix] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const [index, setIndex] = useState(0);
  const [note, setNote] = useState("");

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  function show(nextHits: Hit[], nextIndex: number) {
    setHits(nextHits);
    setIndex(nextIndex);
    const hit = nextHits[nextIndex];
    if (!hit) {
      setNote(query.trim().length < 2 ? "" : "No match.");
      return;
    }
    setNote("");
    revealMatch(hit.field, hit.start, hit.end);
  }

  function runSearch(fromIndex = 0) {
    const nextHits = scan(query);
    if (!nextHits.length) {
      show([], 0);
      return;
    }
    show(nextHits, ((fromIndex % nextHits.length) + nextHits.length) % nextHits.length);
  }

  function step(direction: 1 | -1) {
    const nextHits = scan(query);
    if (!nextHits.length) {
      show([], 0);
      return;
    }
    const current = hits[index];
    let at = nextHits.findIndex(
      (hit) => hit.field === current?.field && hit.start === current.start
    );
    if (at < 0) at = index;
    show(nextHits, (at + direction + nextHits.length) % nextHits.length);
  }

  function replaceCurrent() {
    const nextHits = scan(query);
    const hit = nextHits[index] ?? nextHits[0];
    if (!hit) {
      setNote("No match.");
      return;
    }
    const nextValue = hit.field.value.slice(0, hit.start) + fix + hit.field.value.slice(hit.end);
    writeReportField(hit.field, nextValue);
    window.setTimeout(() => runSearch(index), 40);
  }

  function replaceAll() {
    const needle = query.trim();
    if (needle.length < 2) return;
    let count = 0;
    for (const field of collectReportFields(pageRoot())) {
      const spans = allSpans(field.value, needle);
      if (!spans.length) continue;
      let next = field.value;
      for (let i = spans.length - 1; i >= 0; i -= 1) {
        const span = spans[i]!;
        next = next.slice(0, span.start) + fix + next.slice(span.end);
      }
      if (next !== field.value) {
        writeReportField(field, next);
        count += spans.length;
      }
    }
    setNote(count ? `Replaced ${count}.` : "No match.");
    window.setTimeout(() => {
      setHits([]);
      setIndex(0);
    }, 40);
  }

  return (
    <div data-report-find className={className}>
      <button
        type="button"
        className="report-find-toggle inline-flex items-center gap-2"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
      >
        <Search className="size-[17px] shrink-0" strokeWidth={2.25} aria-hidden />
        <span>{open ? "Close" : "Search"}</span>
      </button>
      {open ? (
        <div className="report-find-row">
          <label>
            Find
            <input
              value={query}
              aria-label="Find"
              onChange={(event) => {
                setQuery(event.target.value);
                setNote("");
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  if (event.shiftKey) step(-1);
                  else if (hits.length) step(1);
                  else runSearch(0);
                }
              }}
            />
          </label>
          <label>
            Fix
            <input
              value={fix}
              aria-label="Fix"
              onChange={(event) => setFix(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  replaceCurrent();
                }
              }}
            />
          </label>
          <button type="button" onClick={() => runSearch(0)}>
            Find
          </button>
          <button type="button" onClick={() => step(-1)} disabled={!hits.length}>
            Previous
          </button>
          <button type="button" onClick={() => step(1)} disabled={!hits.length}>
            Next
          </button>
          <button type="button" onClick={replaceCurrent} disabled={!hits.length}>
            Replace
          </button>
          <button type="button" onClick={replaceAll} disabled={query.trim().length < 2}>
            Replace all
          </button>
          <span className="report-find-count">
            {hits.length ? `${index + 1} of ${hits.length}` : note}
          </span>
        </div>
      ) : null}
    </div>
  );
}
