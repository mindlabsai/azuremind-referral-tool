"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  A_SCREEN_ITEMS,
  A_SCREEN_STORAGE_KEY,
  domainLabel,
  formatAScreenNotes,
  scoreAScreen,
  type AScreenAnswers,
  type AScreenChoice,
  type AScreenDomain,
  type DomainVerdict,
} from "@/lib/asd-modern-a-screen";

const DOMAINS: AScreenDomain[] = ["G0", "A1", "A2", "A3"];

function loadAnswers(): AScreenAnswers {
  if (typeof window === "undefined") return {};
  try {
    const raw = sessionStorage.getItem(A_SCREEN_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as AScreenAnswers;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function verdictTone(verdict: DomainVerdict): "default" | "secondary" | "destructive" | "outline" {
  if (verdict === "supported") return "destructive";
  if (verdict === "not_met") return "default";
  return "secondary";
}

function verdictLabel(verdict: DomainVerdict): string {
  if (verdict === "supported") return "Supported";
  if (verdict === "not_met") return "Not met";
  return "Abstain";
}

export default function ModernAScreenPage() {
  const [active, setActive] = useState<AScreenDomain>("G0");
  const [answers, setAnswers] = useState<AScreenAnswers>({});
  const [copied, setCopied] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setAnswers(loadAnswers());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    sessionStorage.setItem(A_SCREEN_STORAGE_KEY, JSON.stringify(answers));
  }, [answers, hydrated]);

  const scored = useMemo(() => scoreAScreen(answers), [answers]);
  const notes = useMemo(() => formatAScreenNotes(answers), [answers]);
  const items = A_SCREEN_ITEMS.filter((item) => item.domain === active);

  const setChoice = useCallback((id: string, choice: AScreenChoice) => {
    setAnswers((prev) => ({ ...prev, [id]: choice }));
    setCopied(false);
  }, []);

  const copyNotes = useCallback(async () => {
    if (!notes) return;
    await navigator.clipboard.writeText(notes);
    setCopied(true);
  }, [notes]);

  const thresholdClass =
    scored.threshold === "not_autism"
      ? "border-[#f0b4b4] bg-transparent text-[#f0b4b4]"
      : scored.threshold === "a_supported"
        ? "border-[#9bd6be] bg-transparent text-[#9bd6be]"
        : "border-[#2c455f] bg-transparent text-[#f4f8fc]";

  return (
    <div className="texlex-surface min-h-screen bg-[#102033] p-8 text-[#f4f8fc]">
      <div className="mx-auto flex max-w-7xl flex-col gap-5 lg:flex-row">
        <aside className="w-full shrink-0 space-y-3 lg:w-72">
          <div>
            <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
              Modern A screen
            </p>
            <h1 className="mt-1 text-[40px] font-medium tracking-tight">A1–A3</h1>
            <p className="mt-2 text-sm text-slate-600">
              If A1, A2, or A3 is not met, DSM-5-TR autism is not met. This page does not write to
              the report generator.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" asChild>
              <Link href="/asd-engine/interview">Teen script</Link>
            </Button>
            <Button type="button" variant="outline" size="sm" asChild>
              <Link href="/asd-engine/report">Report</Link>
            </Button>
          </div>

          <nav className="space-y-1" aria-label="A screen sections">
            {DOMAINS.map((domain) => {
              const count = A_SCREEN_ITEMS.filter((item) => item.domain === domain && answers[item.id])
                .length;
              const total = A_SCREEN_ITEMS.filter((item) => item.domain === domain).length;
              const domainVerdict =
                domain === "A1" ? scored.a1.verdict : domain === "A2" ? scored.a2.verdict : domain === "A3" ? scored.a3.verdict : null;
              return (
                <button
                  key={domain}
                  type="button"
                  onClick={() => setActive(domain)}
                  className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm ${
                    active === domain ? "text-[#f4f8fc] underline underline-offset-4" : "text-[#c5d4e4]"
                  }`}
                >
                  <span>
                    <span className="font-semibold">{domain === "G0" ? "Gate" : domain}</span>{" "}
                    <span className={active === domain ? "text-slate-200" : "text-slate-500"}>
                      {domainLabel(domain)}
                    </span>
                  </span>
                  <span className={active === domain ? "text-slate-300" : "text-slate-400"}>
                    {domainVerdict ? verdictLabel(domainVerdict) : `${count}/${total}`}
                  </span>
                </button>
              );
            })}
          </nav>

          <div className={`rounded-xl border p-3 ${thresholdClass}`}>
            <p className="text-sm font-semibold">{scored.headline}</p>
            <p className={`mt-2 text-xs ${scored.threshold === "inconclusive" ? "text-slate-600" : "opacity-90"}`}>
              {scored.detail}
            </p>
            {scored.dietConfound ? (
              <p className="mt-2 text-xs opacity-90">Home diet confound is on. A1 cannot rest on talk volume.</p>
            ) : null}
            <p className="mt-2 text-xs opacity-90">Informant: {scored.informant}.</p>
          </div>

          <div className="space-y-2">
            {([scored.a1, scored.a2, scored.a3] as const).map((row) => (
              <div key={row.domain} className="border-t border-[#2c455f] py-3 text-[16px]">
                <div className="mb-1 flex items-center justify-between">
                  <span className="font-semibold">{row.domain}</span>
                  <Badge variant={verdictTone(row.verdict)}>{verdictLabel(row.verdict)}</Badge>
                </div>
                <p className="text-slate-600">{row.reason}</p>
                <p className="mt-1 text-slate-400">
                  Difference {row.asdHits} · typical {row.typicalHits} · {row.answered}/{row.total}
                </p>
              </div>
            ))}
          </div>

          <Button type="button" variant="secondary" size="sm" onClick={() => void copyNotes()} disabled={!notes}>
            {copied ? "Copied" : "Copy notes"}
          </Button>
        </aside>

        <main className="min-w-0 flex-1 space-y-4">
          <section className="border-t border-[#2c455f] py-5">
            <h2 className="text-2xl font-semibold tracking-tight">{domainLabel(active)}</h2>
            <p className="mt-2 text-sm text-slate-600">
              {active === "G0"
                ? "Do this first. If they cannot replay a turn or disconfirm, do not write Supported from adjectives."
                : active === "A1"
                  ? "Do not ask how their day was. Count other-oriented returns. Demands do not count. After they get the thing, what happens to the talk?"
                  : active === "A2"
                    ? "Face, gesture, space. Share-point versus get-point. Clinic gaze is invalid if the iPad is on."
                    : "Do not accept ‘has friends.’ Name a person, a time outside a slot, and who repairs."}
            </p>
          </section>

          <ol className="space-y-3">
            {items.map((item, index) => {
              const selected = answers[item.id];
              return (
                <li key={item.id} className="border-t border-[#2c455f] py-4">
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <span className="text-xs font-semibold text-slate-400">{index + 1}</span>
                    <Badge variant="secondary">{item.audience === "session" ? "Session" : "Parent"}</Badge>
                  </div>
                  <p className="text-base font-medium text-slate-900">{item.prompt}</p>
                  <p className="mt-1 text-sm text-slate-500">{item.why}</p>
                  <div className="mt-3 grid gap-2 md:grid-cols-2">
                    <ChoiceButton
                      selected={selected === "typical"}
                      tone="typical"
                      label={item.typical}
                      onClick={() => setChoice(item.id, "typical")}
                    />
                    <ChoiceButton
                      selected={selected === "asd"}
                      tone="asd"
                      label={item.asd}
                      onClick={() => setChoice(item.id, "asd")}
                    />
                  </div>
                  <div className="mt-2 flex gap-3">
                    <button
                      type="button"
                      onClick={() => setChoice(item.id, "unsure")}
                      className={`text-xs ${selected === "unsure" ? "font-semibold text-slate-900" : "text-slate-500"}`}
                    >
                      Unsure
                    </button>
                    <button
                      type="button"
                      onClick={() => setChoice(item.id, "invalid")}
                      className={`text-xs ${selected === "invalid" ? "font-semibold text-slate-900" : "text-slate-500"}`}
                    >
                      Invalid sample
                    </button>
                  </div>
                </li>
              );
            })}
          </ol>
        </main>
      </div>
    </div>
  );
}

function ChoiceButton({
  selected,
  tone,
  label,
  onClick,
}: {
  selected: boolean;
  tone: "typical" | "asd";
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`min-h-12 rounded-xl border px-3 py-3 text-left text-sm leading-snug ${
        selected ? "border-[#f4f8fc] bg-[#f4f8fc] text-[#102033]" : "border-[#2c455f] bg-transparent text-[#f4f8fc]"
      }`}
    >
      {label}
    </button>
  );
}
