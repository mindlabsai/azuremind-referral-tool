/** Browser TTS helpers for Hey Tex spoken replies (Web Speech Synthesis API). */

const VOICE_PREF_KEY = "texlex.heyTex.voiceURI";

let preferredVoiceURI: string | null = null;
let voicesCache: SpeechSynthesisVoice[] = [];

function readStoredVoiceURI(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(VOICE_PREF_KEY);
  } catch {
    return null;
  }
}

function writeStoredVoiceURI(uri: string | null): void {
  if (typeof window === "undefined") return;
  try {
    if (uri) window.localStorage.setItem(VOICE_PREF_KEY, uri);
    else window.localStorage.removeItem(VOICE_PREF_KEY);
  } catch {
    // ignore
  }
}

function scoreVoice(voice: SpeechSynthesisVoice): number {
  const lang = voice.lang.toLowerCase();
  let score = 0;
  if (lang === "en-au" || lang.startsWith("en-au")) score += 5;
  if (lang.startsWith("en-gb")) score += 3;
  if (lang.startsWith("en-us")) score += 2;
  if (lang.startsWith("en")) score += 1;
  if (/australia|karen|catherine|lee|james|google uk|microsoft/i.test(voice.name)) score += 2;
  return score;
}

function pickDefaultVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
  if (!voices.length) return null;
  const stored = preferredVoiceURI ?? readStoredVoiceURI();
  if (stored) {
    const match = voices.find((v) => v.voiceURI === stored || v.name === stored);
    if (match) return match;
  }
  const scored = [...voices]
    .map((voice) => ({ voice, score: scoreVoice(voice) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score);
  return scored[0]?.voice ?? voices.find((v) => v.lang.toLowerCase().startsWith("en")) ?? voices[0] ?? null;
}

function refreshVoicesCache(): SpeechSynthesisVoice[] {
  if (typeof window === "undefined" || !window.speechSynthesis) return [];
  voicesCache = window.speechSynthesis.getVoices();
  return voicesCache;
}

export type TexSpeechVoiceOption = {
  voiceURI: string;
  name: string;
  lang: string;
  label: string;
};

export function listTexSpeechVoices(): TexSpeechVoiceOption[] {
  const voices = refreshVoicesCache();
  return [...voices]
    .filter((v) => v.lang.toLowerCase().startsWith("en"))
    .sort((a, b) => scoreVoice(b) - scoreVoice(a) || a.name.localeCompare(b.name))
    .map((v) => ({
      voiceURI: v.voiceURI,
      name: v.name,
      lang: v.lang,
      label: `${v.name} (${v.lang})`,
    }));
}

export function getSelectedTexVoiceURI(): string | null {
  return preferredVoiceURI ?? readStoredVoiceURI();
}

export function setSelectedTexVoiceURI(uri: string | null): void {
  preferredVoiceURI = uri;
  writeStoredVoiceURI(uri);
}

export function warmTexSpeechVoices(): void {
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  preferredVoiceURI = readStoredVoiceURI();
  refreshVoicesCache();
  if (!voicesCache.length) {
    window.speechSynthesis.addEventListener(
      "voiceschanged",
      () => {
        refreshVoicesCache();
      },
      { once: true }
    );
  }
}

export function stopTexSpeaking(): void {
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  window.speechSynthesis.cancel();
}

/** Wait until browser TTS is idle so the mic can open cleanly. */
export async function waitForTexSpeechIdle(timeoutMs = 1200): Promise<void> {
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const started = Date.now();
  while (window.speechSynthesis.speaking || window.speechSynthesis.pending) {
    if (Date.now() - started > timeoutMs) break;
    await new Promise((r) => setTimeout(r, 40));
  }
  // Extra beat — Chrome sometimes keeps the audio session briefly after cancel.
  await new Promise((r) => setTimeout(r, 80));
}

/** Speak a short Tex reply. Cancels any in-flight utterance first. */
export function texSpeak(
  text: string,
  options?: {
    interrupt?: boolean;
    onStart?: () => void;
    onEnd?: () => void;
  }
): void {
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  const cleaned = text
    .replace(/[“”]/g, "")
    .replace(/[·•]/g, ",")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned) {
    options?.onEnd?.();
    return;
  }

  if (options?.interrupt !== false) {
    window.speechSynthesis.cancel();
  }

  const voices = refreshVoicesCache();
  const voice = pickDefaultVoice(voices);

  const utterance = new SpeechSynthesisUtterance(cleaned);
  utterance.lang = voice?.lang || "en-AU";
  utterance.rate = 1.02;
  utterance.pitch = 1;
  if (voice) utterance.voice = voice;
  utterance.onstart = () => options?.onStart?.();
  utterance.onend = () => options?.onEnd?.();
  utterance.onerror = () => options?.onEnd?.();
  window.speechSynthesis.speak(utterance);
}

export function isTexSpeaking(): boolean {
  if (typeof window === "undefined" || !window.speechSynthesis) return false;
  return window.speechSynthesis.speaking || window.speechSynthesis.pending;
}

export function isTexSpeechSupported(): boolean {
  return typeof window !== "undefined" && typeof window.speechSynthesis !== "undefined";
}
