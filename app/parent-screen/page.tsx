"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { type ChildProfile } from "@/lib/parent-a-screen";
import {
  ageBandFrom,
  emptyBeliefs,
  newSessionSeed,
  profileRows,
  scoreCard,
  type Belief,
  type ChatTurn,
  type ScreenClose,
} from "@/lib/parent-a-conversation";
import { stopTexSpeaking, texSpeak, warmTexSpeechVoices } from "@/lib/texlex-speech";

type Step = "setup" | "talk" | "result";
type TalkMode = "listening" | "speaking" | "thinking" | "held";

const STORAGE = "texlex-parent-voice-v2";
const APPLE_SANS =
  '-apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", "Helvetica Neue", Helvetica, Arial, sans-serif';

function schoolYearFromAge(age: number): string {
  if (age < 5) return "Kindy";
  if (age === 5) return "Pre-primary";
  const year = Math.min(12, Math.max(1, age - 5));
  return `Year ${year}`;
}

function childFromAgeGender(age: number, gender: ChildProfile["gender"]): ChildProfile {
  const year = new Date().getFullYear() - age;
  return {
    dateOfBirth: `${year}-06-15`,
    schoolYear: schoolYearFromAge(age),
    gender,
    known: ["none"],
  };
}
const ASK_HISTORY = "texlex-parent-ask-history-v1";

function loadAskHistory(): Record<string, string[]> {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem(ASK_HISTORY) ?? "{}") as Record<string, string[]>;
  } catch {
    return {};
  }
}

function rememberAsk(facetId: string, ask: string) {
  const history = loadAskHistory();
  const prev = history[facetId] ?? [];
  history[facetId] = [ask, ...prev.filter((item) => item !== ask)].slice(0, 2);
  localStorage.setItem(ASK_HISTORY, JSON.stringify(history));
}
const EMPTY_CHILD: ChildProfile = {
  dateOfBirth: "",
  schoolYear: "",
  gender: "prefer_not",
  known: [],
};

type SpeechRec = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  onspeechstart: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};

function getSpeechCtor(): (new () => SpeechRec) | null {
  if (typeof window === "undefined") return null;
  const w = window as Window & { SpeechRecognition?: new () => SpeechRec; webkitSpeechRecognition?: new () => SpeechRec };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

function loadDraft(): { step: Step; child: ChildProfile; age: number } {
  if (typeof window === "undefined") {
    return { step: "setup", child: EMPTY_CHILD, age: 10 };
  }
  try {
    const raw = sessionStorage.getItem(STORAGE);
    if (!raw) return { step: "setup", child: EMPTY_CHILD, age: 10 };
    const parsed = JSON.parse(raw) as { step?: Step; child?: ChildProfile; age?: number };
    const step = parsed.step === "talk" || parsed.step === "result" ? parsed.step : "setup";
    return { step, child: parsed.child ?? EMPTY_CHILD, age: parsed.age ?? 10 };
  } catch {
    return { step: "setup", child: EMPTY_CHILD, age: 10 };
  }
}

export default function ParentScreenPage() {
  const draft = useMemo(loadDraft, []);
  const [step, setStep] = useState<Step>("setup");
  const [age, setAge] = useState(draft.age || 10);
  const [child, setChild] = useState<ChildProfile>(draft.child);
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [beliefs, setBeliefs] = useState<Record<string, Belief>>(emptyBeliefs);
  const [close, setClose] = useState<ScreenClose | null>(null);
  const [mode, setMode] = useState<TalkMode>("thinking");
  const [live, setLive] = useState("");
  const [typed, setTyped] = useState("");
  const [voiceOk, setVoiceOk] = useState(true);
  const [seed, setSeed] = useState(() => newSessionSeed());
  const seedRef = useRef(seed);
  const askedFacetsRef = useRef<string[]>([]);

  const ageYears = age;
  const childRef = useRef(child);
  const beliefsRef = useRef(beliefs);
  const turnsRef = useRef(turns);
  const modeRef = useRef(mode);
  const ignoreEchoRef = useRef(false);
  const interruptedRef = useRef(false);
  const recRef = useRef<SpeechRec | null>(null);
  const keepListenRef = useRef(false);
  const submitTimerRef = useRef<number | null>(null);
  const pendingRef = useRef("");
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    childRef.current = child;
  }, [child]);
  useEffect(() => {
    beliefsRef.current = beliefs;
  }, [beliefs]);
  useEffect(() => {
    turnsRef.current = turns;
  }, [turns]);
  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [turns, live]);

  function persist(next: Partial<{ step: Step; child: ChildProfile; age: number }>) {
    sessionStorage.setItem(
      STORAGE,
      JSON.stringify({
        step: next.step ?? step,
        child: next.child ?? child,
        age: next.age ?? age,
      })
    );
  }

  const speakLine = useCallback((text: string) => {
    setMode("speaking");
    ignoreEchoRef.current = true;
    texSpeak(text, {
      interrupt: true,
      onStart: () => setMode("speaking"),
      onEnd: () => {
        window.setTimeout(() => {
          ignoreEchoRef.current = false;
          if (keepListenRef.current && modeRef.current !== "held") setMode("listening");
        }, 280);
      },
    });
  }, []);

  const sendTurn = useCallback(
    async (text: string, interrupted = false, start = false) => {
      const cleaned = text.trim();
      if (!start && !cleaned) return;
      if (submitTimerRef.current) {
        window.clearTimeout(submitTimerRef.current);
        submitTimerRef.current = null;
      }
      pendingRef.current = "";
      setLive("");
      if (cleaned) {
        const parentTurn: ChatTurn = { role: "parent", text: cleaned, interrupted };
        setTurns((current) => [...current, parentTurn]);
        turnsRef.current = [...turnsRef.current, parentTurn];
      }
      setMode("thinking");
      stopTexSpeaking();
      try {
        const response = await fetch("/api/parent-screen/turn", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            child: childRef.current,
            ageYears,
            beliefs: beliefsRef.current,
            turns: turnsRef.current,
            lastParent: cleaned,
            interrupted,
            start,
            seed: seedRef.current,
            usedAsks: loadAskHistory(),
            askedFacets: askedFacetsRef.current,
          }),
        });
        const data = (await response.json()) as {
          say: string;
          beliefs: Record<string, Belief>;
          close: ScreenClose | null;
          holdOn: boolean;
          facetId?: string | null;
        };
        setBeliefs(data.beliefs);
        beliefsRef.current = data.beliefs;
        if (data.facetId && data.say) {
          rememberAsk(data.facetId, data.say);
          if (data.facetId !== "open") askedFacetsRef.current = [...askedFacetsRef.current, data.facetId];
        }
        if (data.holdOn) {
          setMode("held");
          keepListenRef.current = false;
          recRef.current?.abort();
          const hold: ChatTurn = { role: "assistant", text: data.say };
          setTurns((current) => [...current, hold]);
          return;
        }
        const assistant: ChatTurn = { role: "assistant", text: data.say };
        setTurns((current) => [...current, assistant]);
        turnsRef.current = [...turnsRef.current, assistant];
        if (data.close?.done && data.close.outcome !== "paused") {
          setClose(data.close);
          speakLine(data.say);
          window.setTimeout(() => {
            setStep("result");
            sessionStorage.setItem(
              STORAGE,
              JSON.stringify({ step: "result", child, age })
            );
          }, 1600);
          return;
        }
        speakLine(data.say);
      } catch {
        const fallback = "I missed that. Say it again, or type it.";
        setTurns((current) => [...current, { role: "assistant", text: fallback }]);
        speakLine(fallback);
      }
    },
    [ageYears, child, speakLine]
  );

  const queueParent = useCallback(
    (text: string, interrupted = false) => {
      pendingRef.current = `${pendingRef.current} ${text}`.trim();
      setLive(pendingRef.current);
      if (submitTimerRef.current) window.clearTimeout(submitTimerRef.current);
      submitTimerRef.current = window.setTimeout(() => {
        const payload = pendingRef.current;
        pendingRef.current = "";
        setLive("");
        void sendTurn(payload, interrupted);
      }, 1100);
    },
    [sendTurn]
  );

  const startMic = useCallback(() => {
    const Ctor = getSpeechCtor();
    if (!Ctor) {
      setVoiceOk(false);
      return;
    }
    keepListenRef.current = true;
    try {
      recRef.current?.abort();
    } catch {
      // ignore
    }
    const rec = new Ctor();
    rec.lang = "en-AU";
    rec.continuous = true;
    rec.interimResults = true;
    rec.onspeechstart = () => {
      if (ignoreEchoRef.current) return;
      if (modeRef.current === "speaking") {
        interruptedRef.current = true;
        stopTexSpeaking();
        setMode("listening");
      }
    };
    rec.onresult = (event) => {
      if (ignoreEchoRef.current) return;
      let interim = "";
      let finals = "";
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const piece = event.results[i][0].transcript;
        if (event.results[i].isFinal) finals += ` ${piece}`;
        else interim += ` ${piece}`;
      }
      setLive((pendingRef.current + " " + finals + " " + interim).trim());
      if (finals.trim()) queueParent(finals.trim(), interruptedRef.current);
      interruptedRef.current = false;
    };
    rec.onerror = () => {
      if (keepListenRef.current) setMode("listening");
    };
    rec.onend = () => {
      if (keepListenRef.current) {
        try {
          rec.start();
        } catch {
          // ignore
        }
      }
    };
    recRef.current = rec;
    try {
      rec.start();
      setMode("listening");
    } catch {
      setVoiceOk(false);
    }
  }, [queueParent]);

  useEffect(() => {
    warmTexSpeechVoices();
    return () => {
      keepListenRef.current = false;
      recRef.current?.abort();
      stopTexSpeaking();
    };
  }, []);

  async function beginTalk() {
    const nextChild = childFromAgeGender(age, child.gender);
    childRef.current = nextChild;
    setChild(nextChild);
    setStep("talk");
    persist({ step: "talk", child: nextChild, age });
    const fresh = emptyBeliefs();
    setBeliefs(fresh);
    beliefsRef.current = fresh;
    setTurns([]);
    turnsRef.current = [];
    askedFacetsRef.current = [];
    setClose(null);
    const nextSeed = newSessionSeed();
    setSeed(nextSeed);
    seedRef.current = nextSeed;
    startMic();
    await sendTurn("", false, true);
  }

  function resumeHold() {
    keepListenRef.current = true;
    startMic();
    setMode("listening");
  }

  function endNow() {
    keepListenRef.current = false;
    recRef.current?.abort();
    stopTexSpeaking();
    setStep("result");
    persist({ step: "result" });
  }

  function restart() {
    keepListenRef.current = false;
    recRef.current?.abort();
    stopTexSpeaking();
    sessionStorage.removeItem(STORAGE);
    setStep("setup");
    setChild({ ...EMPTY_CHILD, gender: "prefer_not" });
    setAge(10);
    setTurns([]);
    turnsRef.current = [];
    const fresh = emptyBeliefs();
    setBeliefs(fresh);
    beliefsRef.current = fresh;
    askedFacetsRef.current = [];
    setClose(null);
  }

  const childReady = age >= 1 && age <= 18 && Boolean(child.gender);
  const rows = profileRows(beliefs);
  const scored = scoreCard(beliefs);
  const lastAssistant = [...turns].reverse().find((turn) => turn.role === "assistant")?.text ?? "";

  return (
    <main
      className="min-h-screen bg-white text-[#1d1d1f]"
      style={{ fontFamily: APPLE_SANS }}
    >
      {step === "setup" && (
        <div className="mx-auto flex min-h-screen max-w-xl flex-col px-6 py-16">
          <p className="text-[13px] font-medium tracking-[0.04em] text-[#86868b]">Azure Mind</p>
          <h1 className="mt-3 text-[40px] leading-tight font-semibold tracking-[-0.03em]">Talk. I’ll listen.</h1>
          <p className="mt-4 text-[17px] leading-7 text-[#6e6e73]">
            Test mode. Age and gender pick the script. No login. No name.
          </p>

          <section className="mt-12 space-y-8">
            <label className="block space-y-2">
              <span className="text-[13px] text-[#86868b]">Age</span>
              <input
                type="number"
                min={1}
                max={18}
                value={age}
                onChange={(event) => setAge(Number(event.target.value) || 0)}
                className="h-12 w-full rounded-2xl border border-[#d2d2d7] bg-white px-4 text-[17px] outline-none focus:border-[#1d1d1f]"
              />
            </label>
            <fieldset className="space-y-3">
              <legend className="text-[13px] text-[#86868b]">Gender</legend>
              <div className="grid grid-cols-2 gap-2">
                {(
                  [
                    ["girl", "Girl"],
                    ["boy", "Boy"],
                    ["another", "Another way"],
                    ["prefer_not", "Prefer not to say"],
                  ] as const
                ).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setChild((current) => ({ ...current, gender: value }))}
                    className={`h-12 rounded-full text-[15px] ${
                      child.gender === value
                        ? "bg-[#1d1d1f] text-white"
                        : "border border-[#d2d2d7] bg-white text-[#1d1d1f]"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </fieldset>
            <button
              type="button"
              disabled={!childReady}
              onClick={() => void beginTalk()}
              className="h-14 w-full rounded-full bg-[#0071e3] text-[17px] font-medium text-white disabled:opacity-30"
            >
              Start talking
            </button>
          </section>
        </div>
      )}

      {step === "talk" && (
        <div className="mx-auto flex min-h-screen max-w-2xl flex-col px-6 py-8">
          <div className="flex items-center justify-between text-[13px] text-[#86868b]">
            <span>Azure Mind</span>
            <button type="button" onClick={endNow} className="text-[#0071e3]">
              End
            </button>
          </div>

          <div className="flex flex-1 flex-col items-center justify-center py-10">
            <button
              type="button"
              onClick={() => {
                if (mode === "held") resumeHold();
                else if (mode === "speaking") {
                  stopTexSpeaking();
                  interruptedRef.current = true;
                  setMode("listening");
                }
              }}
              className={`relative h-32 w-32 rounded-full ${
                mode === "listening"
                  ? "bg-[#f5f5f7] ring-4 ring-[#d2d2d7]"
                  : mode === "speaking"
                    ? "bg-[#0071e3]/10 ring-4 ring-[#0071e3]/20"
                    : mode === "held"
                      ? "bg-[#f5f5f7]"
                      : "bg-[#f5f5f7]"
              }`}
              aria-label={mode}
            >
              <span className="absolute inset-0 flex items-center justify-center text-[13px] text-[#6e6e73]">
                {mode === "listening"
                  ? "Listening"
                  : mode === "speaking"
                    ? "Talk over me"
                    : mode === "held"
                      ? "Paused"
                      : "…"}
              </span>
            </button>
            <p className="mt-8 max-w-lg text-center text-[28px] leading-10 font-semibold tracking-[-0.02em]">
              {lastAssistant || "When you’re ready."}
            </p>
            {(live || typed) && (
              <p className="mt-5 max-w-lg text-center text-[17px] leading-7 text-[#6e6e73]">{live || typed}</p>
            )}
            {!voiceOk && (
              <p className="mt-4 text-[13px] text-[#6e6e73]">This browser won’t take voice. Type underneath.</p>
            )}
          </div>

          <div ref={scrollRef} className="mb-4 max-h-32 overflow-y-auto text-[13px] leading-6 text-[#86868b]">
            {turns.slice(-6).map((turn, index) => (
              <p key={`${turn.role}-${index}`} className={turn.role === "parent" ? "text-[#1d1d1f]" : ""}>
                {turn.role === "parent" ? "You. " : ""}
                {turn.text}
              </p>
            ))}
          </div>

          <form
            className="flex gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              const value = typed.trim();
              if (!value) return;
              setTyped("");
              void sendTurn(value, false);
            }}
          >
            <input
              value={typed}
              onChange={(event) => setTyped(event.target.value)}
              placeholder="Or type it"
              className="h-12 flex-1 rounded-full border border-[#d2d2d7] bg-white px-4 text-[17px] outline-none focus:border-[#1d1d1f]"
            />
            <button type="submit" className="h-12 rounded-full bg-[#0071e3] px-5 text-[15px] font-medium text-white">
              Send
            </button>
          </form>
          <p className="mt-3 text-center text-[12px] text-[#86868b]">Say hang on if you need me to stop.</p>
        </div>
      )}

      {step === "result" && (
        <div className="mx-auto flex min-h-screen max-w-2xl flex-col px-6 py-16">
          <p className="text-[13px] font-medium text-[#86868b]">
            {close?.outcome === "not_autism"
              ? "Not the social part of autism"
              : close?.outcome === "autism_pattern"
                ? "Full pattern — not a diagnosis"
                : close?.outcome === "social_pattern"
                  ? "Social pattern — not a diagnosis"
                  : "Won’t guess"}
          </p>
          <h1 className="mt-3 text-[40px] leading-tight font-semibold tracking-[-0.03em]">
            {close?.headline ?? "That’s enough for now."}
          </h1>
          <p className="mt-3 text-[13px] text-[#86868b]">
            {child.gender === "girl" ? "Girl" : child.gender === "boy" ? "Boy" : "Child"}, age {age},{" "}
            {ageBandFrom(ageYears, child.schoolYear)} band.
          </p>
          <p className="mt-5 text-[17px] leading-7 text-[#6e6e73]">{close?.body}</p>

          <div className="mt-10 grid grid-cols-3 gap-3">
            {(
              [
                ["Start", close?.a1],
                ["Face", close?.a2],
                ["Mate", close?.a3],
                ["Repeats / same / senses", close?.b],
                ["Early", close?.c],
                ["Gets in the way", close?.d],
                ["Not just delay", close?.e],
                ["Attention", close?.adhd],
                ["Worry", close?.anxiety],
                ["Rituals", close?.ocd],
                ["Mood", close?.depression],
              ] as const
            ).map(([title, verdict]) => (
              <div key={title} className="rounded-3xl border border-[#d2d2d7] p-4">
                <p className="text-[12px] text-[#86868b]">{title}</p>
                <p className="mt-2 text-[15px] capitalize">{(verdict ?? "unasked").replace("_", " ")}</p>
              </div>
            ))}
          </div>

          <div className="mt-10 space-y-3">
            <p className="text-[13px] text-[#86868b]">How this was scored</p>
            {scored.lines.map((line) => (
              <div key={line.domain} className="border-t border-[#d2d2d7] pt-3">
                <p className="text-[15px]">
                  {line.domain === "A1"
                    ? "Start"
                    : line.domain === "A2"
                      ? "Face"
                      : line.domain === "A3"
                        ? "Mate"
                        : line.domain === "B1"
                          ? "Body / scripts"
                          : line.domain === "B2"
                            ? "Sameness"
                            : line.domain === "B3"
                              ? "One thing"
                              : line.domain === "B4"
                                ? "Senses"
                                : line.domain === "C"
                                  ? "Early"
                                  : line.domain === "D"
                                    ? "Gets in the way"
                                    : line.domain === "E"
                                      ? "Not just delay"
                                      : line.domain === "ADHD"
                                        ? "Attention"
                                        : line.domain === "ANX"
                                          ? "Worry"
                                          : line.domain === "OCD"
                                            ? "Rituals"
                                            : line.domain === "DEP"
                                              ? "Mood"
                                              : line.domain}{" "}
                  — {line.verdict.replace("_", " ")}
                </p>
                <p className="mt-1 text-[13px] leading-6 text-[#6e6e73]">{line.why}</p>
              </div>
            ))}
            {rows.length > 0 &&
              rows.map((row) => (
                <div key={row.title} className="border-t border-[#d2d2d7] pt-3">
                  <p className="text-[15px]">{row.title}</p>
                  <p className="text-[13px] text-[#6e6e73]">{row.quote || row.polarity}</p>
                </div>
              ))}
          </div>
          <div className="mt-8 space-y-2 text-[13px] leading-6 text-[#6e6e73]">
            {scored.rules.map((rule) => (
              <p key={rule}>{rule}</p>
            ))}
          </div>
          <button
            type="button"
            onClick={restart}
            className="mt-10 h-14 rounded-full border border-[#d2d2d7] text-[17px]"
          >
            Start again
          </button>
        </div>
      )}
    </main>
  );
}
