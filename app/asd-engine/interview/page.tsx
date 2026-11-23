"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  INTERVIEW_SECTIONS,
  INTERVIEW_STORAGE_KEY,
  audienceLabel,
  formatInterviewNotes,
  type CriterionInterviewCode,
  type InterviewAnswers,
  type InterviewChoice,
} from "@/lib/asd-criterion-interview";

const GROUP_LABEL: Record<(typeof INTERVIEW_SECTIONS)[number]["group"], string> = {
  A: "Section A",
  B: "Section B",
  CDE: "C D E",
};

function loadAnswers(): InterviewAnswers {
  if (typeof window === "undefined") return {};
  try {
    const raw = sessionStorage.getItem(INTERVIEW_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as InterviewAnswers;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export default function AsdCriterionInterviewPage() {
  const [activeCode, setActiveCode] = useState<CriterionInterviewCode>("A1");
  const [answers, setAnswers] = useState<InterviewAnswers>({});
  const [copied, setCopied] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setAnswers(loadAnswers());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    sessionStorage.setItem(INTERVIEW_STORAGE_KEY, JSON.stringify(answers));
  }, [answers, hydrated]);

  const section = INTERVIEW_SECTIONS.find((item) => item.code === activeCode) ?? INTERVIEW_SECTIONS[0];
  const notes = useMemo(() => formatInterviewNotes(answers), [answers]);
  const answeredInSection = section.questions.filter((question) => answers[question.id]).length;

  const setChoice = useCallback((id: string, choice: InterviewChoice) => {
    setAnswers((prev) => ({ ...prev, [id]: choice }));
    setCopied(false);
  }, []);

  const clearSection = useCallback(() => {
    setAnswers((prev) => {
      const next = { ...prev };
      for (const question of section.questions) delete next[question.id];
      return next;
    });
    setCopied(false);
  }, [section.questions]);

  const copyNotes = useCallback(async () => {
    if (!notes) return;
    await navigator.clipboard.writeText(notes);
    setCopied(true);
  }, [notes]);

  return (
    <div className="texlex-surface min-h-screen bg-[#102033] p-8 text-[#f4f8fc]">
      <div className="mx-auto flex max-w-7xl flex-col gap-5 lg:flex-row">
        <aside className="w-full shrink-0 space-y-3 lg:w-64">
          <div>
            <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">Session tool</p>
            <h1 className="mt-1 text-[40px] font-medium tracking-tight">ASD criterion interview</h1>
            <p className="mt-2 text-sm text-slate-600">
              Forced-choice A–E script for a young person who cannot talk in criterion language. This page does not
              write to the report generator.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" asChild>
              <Link href="/asd-engine">ASD engine</Link>
            </Button>
            <Button type="button" variant="outline" size="sm" asChild>
              <Link href="/asd-engine/interview/a-screen">A1–A3 screen</Link>
            </Button>
            <Button type="button" variant="outline" size="sm" asChild>
              <Link href="/asd-engine/report">Report</Link>
            </Button>
          </div>
          <nav className="space-y-3" aria-label="Criteria">
            {(["A", "B", "CDE"] as const).map((group) => (
              <div key={group}>
                <p className="mb-1 text-xs font-semibold text-slate-500">{GROUP_LABEL[group]}</p>
                <div className="flex flex-col gap-1">
                  {INTERVIEW_SECTIONS.filter((item) => item.group === group).map((item) => {
                    const count = item.questions.filter((question) => answers[question.id]).length;
                    const active = item.code === activeCode;
                    return (
                      <button
                        key={item.code}
                        type="button"
                        onClick={() => setActiveCode(item.code)}
                        className={`flex items-center justify-between rounded-lg px-3 py-2 text-left text-sm ${
                          active ? "text-[#f4f8fc] underline underline-offset-4" : "text-[#c5d4e4]"
                        }`}
                      >
                        <span>
                          <span className="font-semibold">{item.code}</span>{" "}
                          <span className={active ? "text-slate-200" : "text-slate-500"}>{item.teenLabel}</span>
                        </span>
                        <span className={active ? "text-slate-300" : "text-slate-400"}>
                          {count}/{item.questions.length}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </nav>
          <div className="border-t border-[#2c455f] py-4">
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="text-sm font-semibold">Copy for Texlex notes</p>
              <Button type="button" size="sm" variant="secondary" onClick={() => void copyNotes()} disabled={!notes}>
                {copied ? "Copied" : "Copy"}
              </Button>
            </div>
            <p className="text-xs text-slate-500">
              Paste into master notes or a criterion field, then generate. Right-hand answers are the difference side.
            </p>
          </div>
        </aside>

        <main className="min-w-0 flex-1 space-y-4">
          <section className="border-t border-[#2c455f] py-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-2xl font-semibold tracking-tight">
                    {section.code}. {section.title}
                  </h2>
                  <Badge variant="secondary">{section.teenLabel}</Badge>
                </div>
                <p className="mt-2 text-sm text-slate-700">{section.blackAndWhite}</p>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={clearSection}>
                Clear {section.code}
              </Button>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <div className="rounded-xl bg-slate-50 p-3 text-sm">
                <p className="font-semibold text-slate-700">Say to her</p>
                <p className="mt-1 text-slate-600">{section.sayToClient}</p>
                <p className="mt-2 text-slate-500">If stuck: {section.stuckPrompt}</p>
              </div>
              <div className="rounded-xl bg-slate-50 p-3 text-sm">
                <p className="font-semibold text-slate-700">You</p>
                <p className="mt-1 text-slate-600">{section.clinicianNote}</p>
                <p className="mt-2 text-slate-500">
                  Answered {answeredInSection} of {section.questions.length}
                </p>
              </div>
            </div>
          </section>

          <ol className="space-y-3">
            {section.questions.map((question, index) => {
              const selected = answers[question.id];
              return (
                <li key={question.id} className="border-t border-[#2c455f] py-4">
                  <div className="mb-3 flex flex-wrap items-center gap-2">
                    <span className="text-xs font-semibold text-slate-400">{index + 1}</span>
                    <Badge variant="secondary">{audienceLabel(question.audience)}</Badge>
                    <p className="text-base font-medium text-slate-900">{question.prompt}</p>
                  </div>
                  <div className="grid gap-2 md:grid-cols-2">
                    <ChoiceButton
                      selected={selected === "left"}
                      tone="left"
                      label={question.left}
                      onClick={() => setChoice(question.id, "left")}
                    />
                    <ChoiceButton
                      selected={selected === "right"}
                      tone="right"
                      label={question.right}
                      onClick={() => setChoice(question.id, "right")}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => setChoice(question.id, "unsure")}
                    className={`mt-2 text-xs ${
                      selected === "unsure" ? "font-semibold text-slate-900" : "text-slate-500 hover:text-slate-800"
                    }`}
                  >
                    Unsure / I dont know
                  </button>
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
  tone: "left" | "right";
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
