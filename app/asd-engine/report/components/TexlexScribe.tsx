"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, Mic, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function pickRecorderMimeType(): string | undefined {
  if (typeof MediaRecorder === "undefined") return undefined;
  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/mp4",
    "audio/ogg;codecs=opus",
  ];
  return candidates.find((type) => MediaRecorder.isTypeSupported(type));
}

type LiveRecognition = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

function liveRecognitionCtor(): (new () => LiveRecognition) | null {
  if (typeof window === "undefined") return null;
  const w = window as Window & {
    SpeechRecognition?: new () => LiveRecognition;
    webkitSpeechRecognition?: new () => LiveRecognition;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

function formatElapsed(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function TexlexScribe({
  className,
  onTranscript,
  onAppendToNotes,
  onGenerateSessionSections,
  sessionGenerating = false,
}: {
  className?: string;
  onTranscript?: (text: string) => void;
  /** Optional: push transcript into raw clinical notes. */
  onAppendToNotes?: (text: string) => void;
  /**
   * Option A: draft presenting concerns + four background sections from this
   * transcript (stops before collateral).
   */
  onGenerateSessionSections?: (text: string) => void | Promise<void>;
  /** Parent is running the session-section pipeline. */
  sessionGenerating?: boolean;
}) {
  const [supported, setSupported] = useState(false);
  const [recording, setRecording] = useState(false);
  const [busy, setBusy] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [status, setStatus] = useState(
    "Live captions while you speak. Whisper keeps the transcript when you stop."
  );
  const [transcript, setTranscript] = useState("");
  const [liveCaption, setLiveCaption] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [generatingLocal, setGeneratingLocal] = useState(false);
  const recognitionRef = useRef<LiveRecognition | null>(null);
  const liveCaptionRef = useRef("");

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const startedAtRef = useRef<number>(0);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    setSupported(
      typeof window !== "undefined" &&
        typeof navigator !== "undefined" &&
        Boolean(navigator.mediaDevices?.getUserMedia) &&
        typeof MediaRecorder !== "undefined"
    );
  }, []);

  const clearTick = useCallback(() => {
    if (tickRef.current) {
      clearInterval(tickRef.current);
      tickRef.current = null;
    }
  }, []);

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  useEffect(() => {
    return () => {
      clearTick();
      try {
        mediaRecorderRef.current?.stop();
      } catch {
        // ignore
      }
      stopStream();
      try {
        recognitionRef.current?.stop();
      } catch {
        // ignore
      }
    };
  }, [clearTick, stopStream]);

  const stopLiveCaption = useCallback(() => {
    try {
      recognitionRef.current?.stop();
    } catch {
      // ignore
    }
    recognitionRef.current = null;
  }, []);

  const startLiveCaption = useCallback(() => {
    const Ctor = liveRecognitionCtor();
    if (!Ctor) {
      setLiveCaption("");
      return;
    }
    const recognition = new Ctor();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-AU";
    recognition.onresult = (event) => {
      let text = "";
      for (let i = 0; i < event.results.length; i++) {
        text += event.results[i]?.[0]?.transcript ?? "";
      }
      const next = text.trim();
      liveCaptionRef.current = next;
      setLiveCaption(next);
    };
    recognition.onerror = () => {
      /* Whisper still runs when recording stops. */
    };
    recognition.onend = () => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
        try {
          recognition.start();
        } catch {
          // ignore restart races
        }
      }
    };
    recognitionRef.current = recognition;
    try {
      recognition.start();
    } catch {
      recognitionRef.current = null;
    }
  }, []);

  const transcribeBlob = useCallback(
    async (blob: Blob) => {
      setBusy(true);
      setError(null);
      setStatus("Sending audio to Whisper…");
      try {
        const ext = blob.type.includes("mp4")
          ? "mp4"
          : blob.type.includes("ogg")
            ? "ogg"
            : "webm";
        const form = new FormData();
        form.append("file", blob, `encounter.${ext}`);
        const response = await fetch("/api/scribe/transcribe", {
          method: "POST",
          body: form,
        });
        const data = (await response.json()) as { text?: string; error?: string };
        if (!response.ok) {
          throw new Error(data.error ?? "Transcription failed.");
        }
        const text = (data.text ?? "").trim();
        const kept = text || liveCaptionRef.current.trim();
        setTranscript(kept);
        if (kept) onTranscript?.(kept);
        liveCaptionRef.current = "";
        setLiveCaption("");
        setStatus(
          text
            ? "Whisper transcript ready."
            : kept
              ? "Whisper was empty. Live captions were kept."
              : "Whisper returned an empty transcript."
        );
      } catch (err) {
        const kept = liveCaptionRef.current.trim();
        if (kept) {
          setTranscript(kept);
          onTranscript?.(kept);
          liveCaptionRef.current = "";
          setLiveCaption("");
        }
        const message = err instanceof Error ? err.message : "Transcription failed.";
        setError(kept ? `${message} Live captions were kept.` : message);
        setStatus(kept ? "Whisper failed. Live captions were kept." : "Transcription failed.");
      } finally {
        setBusy(false);
      }
    },
    [onTranscript]
  );

  const startRecording = useCallback(async () => {
    setError(null);
    setTranscript("");
    setLiveCaption("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mimeType = pickRecorderMimeType();
      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        clearTick();
        stopLiveCaption();
        setRecording(false);
        stopStream();
        const type = recorder.mimeType || mimeType || "audio/webm";
        const blob = new Blob(chunksRef.current, { type });
        chunksRef.current = [];
        mediaRecorderRef.current = null;
        if (!blob.size) {
          setError("No audio captured.");
          setStatus("Recording was empty.");
          return;
        }
        void transcribeBlob(blob);
      };
      mediaRecorderRef.current = recorder;
      startedAtRef.current = Date.now();
      setElapsedMs(0);
      clearTick();
      tickRef.current = setInterval(() => {
        setElapsedMs(Date.now() - startedAtRef.current);
      }, 250);
      recorder.start(1000);
      startLiveCaption();
      setRecording(true);
      setStatus("Live scribe is on. Speak, then stop — Whisper keeps the final transcript.");
    } catch {
      setError("Microphone blocked. Allow mic access for Texlex.");
      setStatus("Could not start recording.");
      stopStream();
    }
  }, [clearTick, startLiveCaption, stopLiveCaption, stopStream, transcribeBlob]);

  const stopRecording = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state === "inactive") {
      setRecording(false);
      clearTick();
      stopStream();
      return;
    }
    stopLiveCaption();
    setStatus("Finishing recording…");
    try {
      recorder.stop();
    } catch {
      setRecording(false);
      clearTick();
      stopStream();
    }
  }, [clearTick, stopStream]);

  const appendNotes = () => {
    const text = transcript.trim();
    if (!text || !onAppendToNotes) return;
    onAppendToNotes(text);
    setStatus("Appended to raw notes.");
  };

  const generateSessionSections = async () => {
    const text = transcript.trim();
    if (!text || !onGenerateSessionSections) return;
    setGeneratingLocal(true);
    setError(null);
    setStatus("Drafting presenting concerns and background sections…");
    try {
      await onGenerateSessionSections(text);
      setStatus("Session sections drafted — review presenting concerns and background.");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Session section generation failed.";
      setError(message);
      setStatus("Session section generation failed.");
    } finally {
      setGeneratingLocal(false);
    }
  };

  const pipelineBusy = busy || sessionGenerating || generatingLocal;

  if (!supported) {
    return (
      <p className={cn("text-xs text-muted-foreground", className)}>
        Scribe needs a browser that can record audio (Chrome or Edge recommended).
      </p>
    );
  }

  return (
    <div
      className={cn(
        "space-y-3 rounded-lg border border-border/70 bg-background/80 px-3 py-3",
        className
      )}
      data-testid="texlex-scribe"
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h4 className="text-sm font-semibold text-foreground">Texlex Scribe</h4>
          <p className="text-xs text-muted-foreground">
            Live captions while you speak. Whisper replaces them when you stop. Review before use.
          </p>
        </div>
        {recording ? (
          <span className="rounded-md bg-muted px-2 py-1 font-mono text-xs text-foreground">
            {formatElapsed(elapsedMs)}
          </span>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        {!recording ? (
          <Button
            type="button"
            size="lg"
            variant="outline"
            className="h-12 min-w-[9.5rem] gap-2 px-4 text-base font-semibold"
            disabled={pipelineBusy}
            onClick={() => void startRecording()}
          >
            {busy ? (
              <Loader2 className="size-5 animate-spin" />
            ) : (
              <Mic className="size-5" />
            )}
            {busy ? "Transcribing…" : "Record"}
          </Button>
        ) : (
          <Button
            type="button"
            size="lg"
            variant="secondary"
            className="h-12 min-w-[9.5rem] gap-2 px-4 text-base font-semibold"
            onClick={stopRecording}
          >
            <Square className="size-4 fill-current" />
            Stop
          </Button>
        )}
        <p className="min-w-0 flex-1 text-sm text-muted-foreground" role="status">
          {status}
        </p>
      </div>

      {recording && liveCaption ? (
        <div className="rounded-md border border-[#B7E1DE] bg-[#E8F6F5] px-3 py-2 text-sm leading-relaxed text-[#075E63]">
          <p className="mb-1 text-[11px] font-bold uppercase tracking-wide">Live</p>
          {liveCaption}
        </div>
      ) : null}

      {error ? (
        <p className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-900 dark:text-amber-100">
          {error}
        </p>
      ) : null}

      {transcript ? (
        <div className="space-y-2">
          <textarea
            className="min-h-[140px] w-full rounded-md border border-border/70 bg-background px-3 py-2 text-sm leading-relaxed text-foreground"
            value={transcript}
            onChange={(e) => setTranscript(e.target.value)}
            aria-label="Whisper transcript"
          />
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={pipelineBusy}
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(transcript);
                  setStatus("Copied transcript.");
                } catch {
                  setStatus("Could not copy — select the text manually.");
                }
              }}
            >
              Copy
            </Button>
            {onAppendToNotes ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={pipelineBusy}
                onClick={appendNotes}
              >
                Append to raw notes
              </Button>
            ) : null}
            {onGenerateSessionSections ? (
              <Button
                type="button"
                size="sm"
                disabled={pipelineBusy || transcript.trim().length < 20}
                onClick={() => void generateSessionSections()}
              >
                {sessionGenerating || generatingLocal ? (
                  <span className="inline-flex items-center gap-1.5">
                    <Loader2 className="size-3.5 animate-spin" />
                    Generating sections…
                  </span>
                ) : (
                  "Generate sections from session"
                )}
              </Button>
            ) : null}
          </div>
          {onGenerateSessionSections ? (
            <p className="text-[11px] text-muted-foreground">
              Drafts presenting concerns and all four background sections from this
              transcript. Does not touch collateral, criteria, or formulation.
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
