"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, Mic, MicOff, Square, Volume2, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  formatCollateralListForVoice,
  formatVoiceClock,
  matchAppointmentAtTime,
  parseTexVoiceCommand,
  pickBestPatientForVoiceQuery,
  resolveDayTargetToRange,
  type ClinikoVoiceSearchHit,
  type CollateralVoiceListItem,
} from "@/lib/texlex-voice-commands";
import {
  getSelectedTexVoiceURI,
  isTexSpeechSupported,
  listTexSpeechVoices,
  setSelectedTexVoiceURI,
  stopTexSpeaking,
  texSpeak,
  waitForTexSpeechIdle,
  warmTexSpeechVoices,
  type TexSpeechVoiceOption,
} from "@/lib/texlex-speech";
import type { ClinikoPatientAppointment } from "@/lib/cliniko";

type SpeechRecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
  onend: (() => void) | null;
};

type SpeechRecognitionEventLike = {
  results: ArrayLike<{ 0: { transcript: string }; isFinal?: boolean }>;
};

const SPEAK_PREF_KEY = "texlex.heyTex.speakReplies";

function getSpeechRecognitionCtor(): (new () => SpeechRecognitionLike) | null {
  if (typeof window === "undefined") return null;
  const w = window as Window & {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

async function fetchDayAppointments(
  fromIso: string,
  toIso: string,
  practitionerId: string | null
): Promise<ClinikoPatientAppointment[]> {
  const params = new URLSearchParams({ from: fromIso, to: toIso });
  if (practitionerId) params.set("practitionerId", practitionerId);
  const response = await fetch(`/api/cliniko/schedule?${params.toString()}`);
  const data = (await response.json()) as {
    appointments?: ClinikoPatientAppointment[];
    error?: string;
  };
  if (!response.ok) {
    throw new Error(data.error ?? "Could not load schedule for voice command.");
  }
  return data.appointments ?? [];
}

async function searchPatientsByName(query: string): Promise<ClinikoVoiceSearchHit[]> {
  const response = await fetch(
    `/api/cliniko/patients/search?q=${encodeURIComponent(query.trim())}`
  );
  const data = (await response.json()) as {
    patients?: ClinikoVoiceSearchHit[];
    error?: string;
  };
  if (!response.ok) {
    throw new Error(data.error ?? "Cliniko name search failed.");
  }
  return data.patients ?? [];
}

export function ClinikoHeyTex({
  practitionerId = null,
  importFilesEnabled = false,
  disabled = false,
  collateralDocs = [],
  collateralSummaryFilled = false,
  onLoadAppointment,
  className,
}: {
  practitionerId?: string | null;
  importFilesEnabled?: boolean;
  disabled?: boolean;
  /** Uploaded collateral files for “list collateral” voice commands. */
  collateralDocs?: CollateralVoiceListItem[];
  /** Whether the written collateral summary field has content. */
  collateralSummaryFilled?: boolean;
  onLoadAppointment: (args: {
    patientId: string;
    patientName: string | null;
    appointmentStartsAt: string | null;
    importFiles: boolean;
  }) => void | Promise<void>;
  className?: string;
}) {
  const [supported, setSupported] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(false);
  const [speakReplies, setSpeakReplies] = useState(true);
  const [voiceOptions, setVoiceOptions] = useState<TexSpeechVoiceOption[]>([]);
  const [voiceURI, setVoiceURI] = useState<string>("");
  const [listening, setListening] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string>(
    'Say “Hey Tex, pull up my 9am Monday”, “list collateral”, or “stop”'
  );
  const [collateralListLines, setCollateralListLines] = useState<string[]>([]);
  const [speaking, setSpeaking] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const handlingRef = useRef(false);
  const cancelledRef = useRef(false);
  const speakRepliesRef = useRef(true);
  const collateralDocsRef = useRef(collateralDocs);
  const collateralSummaryFilledRef = useRef(collateralSummaryFilled);

  useEffect(() => {
    collateralDocsRef.current = collateralDocs;
  }, [collateralDocs]);

  useEffect(() => {
    collateralSummaryFilledRef.current = collateralSummaryFilled;
  }, [collateralSummaryFilled]);

  useEffect(() => {
    setSupported(Boolean(getSpeechRecognitionCtor()));
    setSpeechSupported(isTexSpeechSupported());
    warmTexSpeechVoices();
    const refresh = () => {
      const options = listTexSpeechVoices();
      setVoiceOptions(options);
      const selected = getSelectedTexVoiceURI();
      if (selected && options.some((o) => o.voiceURI === selected)) {
        setVoiceURI(selected);
      } else if (options[0]) {
        setVoiceURI(options[0].voiceURI);
        setSelectedTexVoiceURI(options[0].voiceURI);
      }
    };
    refresh();
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.addEventListener("voiceschanged", refresh);
      return () => window.speechSynthesis.removeEventListener("voiceschanged", refresh);
    }
    return undefined;
  }, []);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(SPEAK_PREF_KEY);
      if (raw === "0") {
        setSpeakReplies(false);
        speakRepliesRef.current = false;
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    speakRepliesRef.current = speakReplies;
  }, [speakReplies]);

  useEffect(() => {
    return () => {
      try {
        recognitionRef.current?.abort();
      } catch {
        // ignore
      }
      stopTexSpeaking();
    };
  }, []);

  /** Update on-screen status only — never speak mid-command (keeps the mic free). */
  const note = useCallback((message: string) => {
    setStatus(message);
  }, []);

  /** Final outcome: status + optional spoken reply after work is done. */
  const finish = useCallback((message: string) => {
    if (cancelledRef.current) {
      setStatus("Stopped.");
      setSpeaking(false);
      return;
    }
    setStatus(message);
    if (speakRepliesRef.current) {
      setSpeaking(true);
      texSpeak(message, {
        onEnd: () => setSpeaking(false),
      });
    } else {
      setSpeaking(false);
    }
  }, []);

  const stopAll = useCallback(() => {
    cancelledRef.current = true;
    stopTexSpeaking();
    setSpeaking(false);
    try {
      recognitionRef.current?.abort();
    } catch {
      // ignore
    }
    setListening(false);
    setBusy(false);
    handlingRef.current = false;
    setStatus("Stopped.");
  }, []);

  const handleTranscript = useCallback(
    async (transcript: string) => {
      const early = parseTexVoiceCommand(transcript);
      // Stop always wins — even mid-command or while Tex is talking.
      if (early.kind === "stop") {
        stopAll();
        return;
      }

      if (handlingRef.current) return;
      handlingRef.current = true;
      cancelledRef.current = false;
      setBusy(true);
      stopTexSpeaking();
      setSpeaking(false);
      note(`Heard: “${transcript.trim()}”`);

      try {
        const command = early;
        if (command.kind === "listCollateral") {
          const formatted = formatCollateralListForVoice(collateralDocsRef.current, {
            summaryFilled: collateralSummaryFilledRef.current,
          });
          if (cancelledRef.current) return;
          setCollateralListLines(formatted.lines);
          finish(formatted.spoken);
          return;
        }

        if (command.kind === "loadAppointment") {
          setCollateralListLines([]);
          const range = resolveDayTargetToRange(command.day);
          const clock = formatVoiceClock(command.hour, command.minute);
          note(`Looking for ${clock} on ${range.label}…`);
          const appointments = await fetchDayAppointments(
            range.fromIso,
            range.toIso,
            practitionerId
          );
          if (cancelledRef.current) return;
          const match = matchAppointmentAtTime(
            appointments,
            command.hour,
            command.minute
          );
          if (!match?.patient_id) {
            finish(`I couldn't find a booking near ${clock} on ${range.label}.`);
            return;
          }
          const label =
            match.patient_name?.trim() || `patient ${match.patient_id}`;
          note(`Loading ${label}…`);
          await onLoadAppointment({
            patientId: match.patient_id,
            patientName: match.patient_name,
            appointmentStartsAt: match.starts_at,
            importFiles: importFilesEnabled,
          });
          if (cancelledRef.current) return;
          finish(`Loaded ${label} for ${clock}.`);
          return;
        }

        if (command.kind === "loadPatientByName") {
          setCollateralListLines([]);
          note(`Searching Cliniko for “${command.nameQuery}”…`);
          const patients = await searchPatientsByName(command.nameQuery);
          if (cancelledRef.current) return;
          const best = pickBestPatientForVoiceQuery(command.nameQuery, patients);
          if (!best) {
            finish(`I couldn't find ${command.nameQuery} in Cliniko.`);
            return;
          }
          const label = `${best.first_name} ${best.last_name}`.trim();
          const shouldImport = command.importFiles || importFilesEnabled;
          note(
            shouldImport
              ? `Loading ${label} and Cliniko files…`
              : `Loading ${label}…`
          );
          await onLoadAppointment({
            patientId: best.id,
            patientName: label,
            appointmentStartsAt: null,
            importFiles: shouldImport,
          });
          if (cancelledRef.current) return;
          finish(
            shouldImport
              ? `Loaded ${label}, with registration and files where available.`
              : `Loaded ${label}.`
          );
          return;
        }

        setCollateralListLines([]);
        finish(
          "Sorry, I didn't catch that. Try nine a m next Monday, pull up a patient name, list collateral, or stop."
        );
      } catch (error) {
        if (cancelledRef.current) return;
        finish(error instanceof Error ? error.message : "Voice command failed.");
      } finally {
        if (!cancelledRef.current) {
          setBusy(false);
          handlingRef.current = false;
        }
      }
    },
    [finish, importFilesEnabled, note, onLoadAppointment, practitionerId, stopAll]
  );

  const stopListening = useCallback(() => {
    try {
      recognitionRef.current?.stop();
    } catch {
      // ignore
    }
    setListening(false);
  }, []);

  const startListening = useCallback(async () => {
    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) {
      finish("Voice needs Chrome or Edge on this device.");
      return;
    }

    cancelledRef.current = false;
    // Critical: stop any talk-back audio before opening the mic.
    stopTexSpeaking();
    setSpeaking(false);
    await waitForTexSpeechIdle();

    try {
      recognitionRef.current?.abort();
    } catch {
      // ignore
    }

    const recognition = new Ctor();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = "en-AU";
    recognition.onresult = (event) => {
      const spoken = Array.from(event.results)
        .map((result) => result[0]?.transcript ?? "")
        .join(" ")
        .trim();
      if (spoken) void handleTranscript(spoken);
    };
    recognition.onerror = (event) => {
      const code = event.error ?? "error";
      if (code === "not-allowed") {
        finish("Microphone blocked. Allow mic access for Texlex.");
      } else if (code === "no-speech") {
        note("No speech heard — tap Hey Tex and try again.");
      } else if (code !== "aborted") {
        finish(`Voice error: ${code}`);
      }
      setListening(false);
    };
    recognition.onend = () => {
      setListening(false);
    };
    recognitionRef.current = recognition;
    setListening(true);
    note("Listening…");
    try {
      recognition.start();
    } catch {
      setListening(false);
      note("Could not start the microphone.");
    }
  }, [finish, handleTranscript, note]);

  const toggle = () => {
    if (disabled) return;
    if (listening) {
      stopListening();
      stopTexSpeaking();
      setSpeaking(false);
    } else if (busy || speaking) {
      stopAll();
    } else {
      void startListening();
    }
  };

  const toggleSpeak = () => {
    const next = !speakReplies;
    setSpeakReplies(next);
    speakRepliesRef.current = next;
    try {
      window.localStorage.setItem(SPEAK_PREF_KEY, next ? "1" : "0");
    } catch {
      // ignore
    }
    if (!next) {
      stopTexSpeaking();
      setSpeaking(false);
      note("Talk back off — mic only.");
    } else {
      // Preview voice without opening the mic.
      note("Talk back on.");
      setSpeaking(true);
      texSpeak("Talk back on.", { onEnd: () => setSpeaking(false) });
    }
  };

  const onVoiceChange = (uri: string) => {
    setVoiceURI(uri);
    setSelectedTexVoiceURI(uri || null);
    if (speakRepliesRef.current) {
      texSpeak("This is my voice.");
    }
  };

  if (!supported) {
    return (
      <p className={cn("text-xs text-muted-foreground", className)}>
        Hey Tex voice needs Chrome or Edge on this device.
      </p>
    );
  }

  return (
    <div
      className={cn(
        "space-y-2 rounded-lg border border-border/70 bg-background/80 px-3 py-3",
        className
      )}
      data-testid="cliniko-hey-tex"
    >
      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          size="lg"
          variant={listening ? "default" : "outline"}
          className="h-12 min-w-[9.5rem] gap-2 px-4 text-base font-semibold"
          disabled={disabled}
          onClick={toggle}
          aria-pressed={listening}
          aria-label={
            listening
              ? "Stop listening"
              : busy || speaking
                ? "Stop Tex"
                : "Start Hey Tex voice"
          }
        >
          {busy && !speaking && !listening ? (
            <Loader2 className="size-5 animate-spin" />
          ) : listening ? (
            <Mic className="size-5" />
          ) : (
            <MicOff className="size-5 opacity-70" />
          )}
          {listening ? "Listening…" : busy || speaking ? "Working…" : "Hey Tex"}
        </Button>
        {busy || speaking || listening ? (
          <Button
            type="button"
            size="lg"
            variant="secondary"
            className="h-12 gap-2 px-4"
            disabled={disabled}
            onClick={stopAll}
            aria-label="Stop Tex"
          >
            <Square className="size-4 fill-current" />
            Stop
          </Button>
        ) : null}
        {speechSupported ? (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-10 gap-1.5 px-2"
            onClick={toggleSpeak}
            aria-pressed={speakReplies}
            title={speakReplies ? "Mute Tex replies" : "Unmute Tex replies"}
          >
            {speakReplies ? (
              <Volume2 className="size-4" />
            ) : (
              <VolumeX className="size-4 opacity-70" />
            )}
            <span className="text-xs">{speakReplies ? "Talk back on" : "Talk back off"}</span>
          </Button>
        ) : null}
        <p className="min-w-0 flex-1 text-sm text-muted-foreground" role="status">
          {status}
        </p>
      </div>

      {collateralListLines.length > 0 ? (
        <ul
          className="max-h-40 list-none space-y-1 overflow-y-auto rounded-md border border-border/60 bg-muted/30 px-3 py-2 text-xs text-foreground"
          aria-label="Collateral files"
        >
          {collateralListLines.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      ) : null}

      {speechSupported && speakReplies && voiceOptions.length > 0 ? (
        <label className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span className="shrink-0">Voice</span>
          <select
            className="h-8 min-w-[12rem] max-w-full flex-1 rounded-md border border-border/70 bg-background px-2 text-xs text-foreground"
            value={voiceURI}
            onChange={(e) => onVoiceChange(e.target.value)}
            aria-label="Choose Tex speaking voice"
          >
            {voiceOptions.map((option) => (
              <option key={option.voiceURI} value={option.voiceURI}>
                {option.label}
              </option>
            ))}
          </select>
          <span className="text-[11px] text-muted-foreground">
            Uses your browser / Mac voices (not a cloud API)
          </span>
        </label>
      ) : null}
    </div>
  );
}
