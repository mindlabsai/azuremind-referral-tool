import type { ClinikoPatientAppointment } from "@/lib/cliniko";

export type VoiceDayTarget =
  | { kind: "relative"; value: "today" | "tomorrow" | "yesterday" }
  | { kind: "weekday"; weekday: number; which: "this" | "next" | "last" }
  | { kind: "calendarDate"; year: number; month: number; day: number };

export type ParsedTexVoiceCommand =
  | {
      kind: "loadAppointment";
      hour: number;
      minute: number;
      day: VoiceDayTarget;
      raw: string;
    }
  | {
      kind: "loadPatientByName";
      nameQuery: string;
      /** Force Cliniko file import (e.g. “pull up files for Florence”). */
      importFiles: boolean;
      raw: string;
    }
  | {
      kind: "listCollateral";
      raw: string;
    }
  | {
      kind: "stop";
      raw: string;
    }
  | {
      kind: "unknown";
      raw: string;
    };

const WAKE_PREFIX =
  /^(?:hey|hi|ok(?:ay)?)\s+tex(?:lex)?[,.\s]+/i;

const LOAD_VERBS =
  /(?:pull\s*up|load|open|get|bring\s*up|show|find|start)\s+(?:me\s+)?(?:my\s+)?/i;

const WEEKDAY_NAMES: Record<string, number> = {
  sunday: 0,
  sun: 0,
  monday: 1,
  mon: 1,
  tuesday: 2,
  tue: 2,
  tues: 2,
  wednesday: 3,
  wed: 3,
  thursday: 4,
  thu: 4,
  thur: 4,
  thurs: 4,
  friday: 5,
  fri: 5,
  saturday: 6,
  sat: 6,
};

const MONTH_NAMES: Record<string, number> = {
  january: 0,
  jan: 0,
  february: 1,
  feb: 1,
  march: 2,
  mar: 2,
  april: 3,
  apr: 3,
  may: 4,
  june: 5,
  jun: 5,
  july: 6,
  jul: 6,
  august: 7,
  aug: 7,
  september: 8,
  sep: 8,
  sept: 8,
  october: 9,
  oct: 9,
  november: 10,
  nov: 10,
  december: 11,
  dec: 11,
};

/** Strip wake word and filler so "hey tex pull up my 9am today" → "pull up my 9am today". */
export function normaliseVoiceTranscript(raw: string): string {
  let text = raw.trim().replace(/\s+/g, " ");
  text = text.replace(WAKE_PREFIX, "");
  return text.trim();
}

function parseClockToken(token: string): { hour: number; minute: number } | null {
  const cleaned = token.trim().toLowerCase().replace(/\./g, "");
  const m = cleaned.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/i);
  if (!m) return null;
  let hour = Number(m[1]);
  const minute = m[2] != null ? Number(m[2]) : 0;
  const meridiem = m[3]?.toLowerCase() ?? null;
  if (!Number.isFinite(hour) || hour > 23 || minute > 59) return null;
  if (meridiem === "pm" && hour < 12) hour += 12;
  if (meridiem === "am" && hour === 12) hour = 0;
  return { hour, minute };
}

function startOfLocalDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
}

function addLocalDays(d: Date, days: number): Date {
  const next = new Date(d);
  next.setDate(next.getDate() + days);
  return next;
}

function formatDayLabel(d: Date): string {
  const weekdays = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  return `${weekdays[d.getDay()]} ${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

/** Parse today/tomorrow/yesterday, weekdays, or calendar dates from the utterance. */
export function parseDayTarget(text: string, now = new Date()): VoiceDayTarget | null {
  if (/\btoday\b/i.test(text)) return { kind: "relative", value: "today" };
  if (/\btomorrow\b/i.test(text)) return { kind: "relative", value: "tomorrow" };
  if (/\byesterday\b/i.test(text)) return { kind: "relative", value: "yesterday" };

  const weekdayMatch = text.match(
    /\b(?:(this|next|last)\s+)?(sunday|monday|tuesday|wednesday|thursday|friday|saturday|sun|mon|tue|tues|wed|thu|thur|thurs|fri|sat)\b/i
  );
  if (weekdayMatch) {
    const whichRaw = (weekdayMatch[1] ?? "this").toLowerCase() as "this" | "next" | "last";
    const weekday = WEEKDAY_NAMES[weekdayMatch[2]!.toLowerCase()];
    if (weekday != null) {
      return { kind: "weekday", weekday, which: whichRaw };
    }
  }

  // 18 August / 18th August / August 18 / 18 Aug 2026
  const dmyMonth = text.match(
    /\b(\d{1,2})(?:st|nd|rd|th)?\s+(?:of\s+)?(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec)(?:\s+(\d{4}))?\b/i
  );
  if (dmyMonth) {
    const day = Number(dmyMonth[1]);
    const month = MONTH_NAMES[dmyMonth[2]!.toLowerCase()];
    const year = dmyMonth[3] ? Number(dmyMonth[3]) : now.getFullYear();
    if (month != null && day >= 1 && day <= 31) {
      return { kind: "calendarDate", year, month, day };
    }
  }

  const mdyMonth = text.match(
    /\b(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec)\s+(\d{1,2})(?:st|nd|rd|th)?(?:\s+(\d{4}))?\b/i
  );
  if (mdyMonth) {
    const month = MONTH_NAMES[mdyMonth[1]!.toLowerCase()];
    const day = Number(mdyMonth[2]);
    const year = mdyMonth[3] ? Number(mdyMonth[3]) : now.getFullYear();
    if (month != null && day >= 1 && day <= 31) {
      return { kind: "calendarDate", year, month, day };
    }
  }

  // 18/8/2026 or 18-8-26 or 18/08
  const slash = text.match(/\b(\d{1,2})[\/\-.](\d{1,2})(?:[\/\-.](\d{2,4}))?\b/);
  if (slash) {
    const day = Number(slash[1]);
    const month = Number(slash[2]) - 1;
    let year = slash[3] ? Number(slash[3]) : now.getFullYear();
    if (year < 100) year += 2000;
    if (month >= 0 && month <= 11 && day >= 1 && day <= 31) {
      return { kind: "calendarDate", year, month, day };
    }
  }

  return null;
}

function resolveWeekdayDate(
  weekday: number,
  which: "this" | "next" | "last",
  now: Date
): Date {
  const today = startOfLocalDay(now);
  const current = today.getDay();

  if (which === "last") {
    let delta = (current - weekday + 7) % 7;
    if (delta === 0) delta = 7;
    return addLocalDays(today, -delta);
  }

  if (which === "next") {
    let delta = (weekday - current + 7) % 7;
    if (delta === 0) delta = 7;
    return addLocalDays(today, delta);
  }

  // "this Monday" / bare "Monday": today if match, else upcoming in this week (or next if already passed)
  let delta = (weekday - current + 7) % 7;
  return addLocalDays(today, delta);
}

export function resolveDayTargetToRange(
  day: VoiceDayTarget | null,
  now = new Date()
): { fromIso: string; toIso: string; label: string; date: Date } {
  const today = startOfLocalDay(now);
  let start = today;

  if (!day || (day.kind === "relative" && day.value === "today")) {
    start = today;
  } else if (day.kind === "relative" && day.value === "tomorrow") {
    start = addLocalDays(today, 1);
  } else if (day.kind === "relative" && day.value === "yesterday") {
    start = addLocalDays(today, -1);
  } else if (day.kind === "weekday") {
    start = resolveWeekdayDate(day.weekday, day.which, now);
  } else if (day.kind === "calendarDate") {
    start = startOfLocalDay(new Date(day.year, day.month, day.day));
  }

  const end = addLocalDays(start, 1);
  return {
    fromIso: start.toISOString(),
    toIso: end.toISOString(),
    label: formatDayLabel(start),
    date: start,
  };
}

/** @deprecated use resolveDayTargetToRange — kept for older call sites */
export function dayHintToRange(
  day: "today" | "tomorrow" | "yesterday" | null,
  now = new Date()
): { fromIso: string; toIso: string; label: string } {
  const target: VoiceDayTarget =
    day === "tomorrow"
      ? { kind: "relative", value: "tomorrow" }
      : day === "yesterday"
        ? { kind: "relative", value: "yesterday" }
        : { kind: "relative", value: "today" };
  const range = resolveDayTargetToRange(target, now);
  return { fromIso: range.fromIso, toIso: range.toIso, label: range.label };
}

function stripDayAndTimePhrases(text: string): string {
  let t = text;
  t = t.replace(
    /\b(?:this|next|last)\s+(?:sunday|monday|tuesday|wednesday|thursday|friday|saturday|sun|mon|tue|tues|wed|thu|thur|thurs|fri|sat)\b/gi,
    " "
  );
  t = t.replace(
    /\b(?:sunday|monday|tuesday|wednesday|thursday|friday|saturday|sun|mon|tue|tues|wed|thu|thur|thurs|fri|sat)\b/gi,
    " "
  );
  t = t.replace(/\b(?:today|tomorrow|yesterday)\b/gi, " ");
  t = t.replace(
    /\b\d{1,2}(?:st|nd|rd|th)?\s+(?:of\s+)?(?:january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec)(?:\s+\d{4})?\b/gi,
    " "
  );
  t = t.replace(
    /\b(?:january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec)\s+\d{1,2}(?:st|nd|rd|th)?(?:\s+\d{4})?\b/gi,
    " "
  );
  t = t.replace(/\b\d{1,2}[\/\-.]\d{1,2}(?:[\/\-.]\d{2,4})?\b/g, " ");
  t = t.replace(
    /\b(?:at\s+)?\d{1,2}(?::\d{2})?\s*(?:a\.?m\.?|p\.?m\.?)?\b|\b\d{1,2}\s*o'?clock\b/gi,
    " "
  );
  t = t.replace(/\b(?:am|pm)\b/gi, " ");
  return t.replace(/\s+/g, " ").trim();
}

/**
 * Parse clinician voice commands for Texlex Cliniko loading.
 * Examples:
 * - "hey tex pull up my 9am today"
 * - "load 2:30 pm next Monday"
 * - "open 10am 18 August"
 * - "pull up Florence Apps"
 * - "pull up files for Florence Apps"
 * - "list collateral"
 * - "stop" / "hey tex stop"
 */
export function parseTexVoiceCommand(rawInput: string, now = new Date()): ParsedTexVoiceCommand {
  const raw = rawInput.trim();
  const text = normaliseVoiceTranscript(raw);
  if (!text) return { kind: "unknown", raw };

  // Stop / cancel talk-back or in-flight command
  if (
    /^(?:please\s+)?(?:stop|cancel|quiet|silence|enough|never\s*mind|nevermind|shut\s*up|be\s*quiet|that's\s*enough|that\s*is\s*enough)(?:\s+please)?[.!?]*$/i.test(
      text
    ) ||
    /^(?:hey\s+)?tex(?:lex)?\s+(?:please\s+)?(?:stop|cancel|quiet)(?:\s+please)?[.!?]*$/i.test(text) ||
    /^(?:stop|cancel)\s+(?:talking|speaking|reading|please)[.!?]*$/i.test(text)
  ) {
    return { kind: "stop", raw };
  }

  const day = parseDayTarget(text, now) ?? { kind: "relative" as const, value: "today" as const };

  // Collateral inventory: "what collateral", "list collateral information", "show collateral files"
  if (
    /\bcollateral\b/i.test(text) &&
    /\b(what|which|list|show|tell|read|any|have|got|display|summary|information|info|files?|docs?|documents?)\b/i.test(
      text
    )
  ) {
    return { kind: "listCollateral", raw };
  }
  if (
    /^(?:what|which|list|show|tell\s+me)\s+(?:the\s+)?(?:collateral|uploaded\s+files?|supporting\s+(?:docs?|documents?|reports?))\b/i.test(
      text
    )
  ) {
    return { kind: "listCollateral", raw };
  }

  // Files-for-name: "pull up files for Florence Apps" / "get Florence's files"
  const filesMatch =
    text.match(
      /(?:pull\s*up|load|open|get|bring\s*up|show|find)\s+(?:the\s+)?files\s+(?:for|on|of)\s+(.+)$/i
    ) ??
    text.match(
      /(?:pull\s*up|load|open|get|bring\s*up|show|find)\s+(.+?)(?:'s)?\s+files\b/i
    );
  if (filesMatch) {
    const nameQuery = stripDayAndTimePhrases(filesMatch[1] ?? "")
      .replace(/^(?:patient|client)\s+/i, "")
      .trim();
    if (nameQuery.length >= 2) {
      return { kind: "loadPatientByName", nameQuery, importFiles: true, raw };
    }
  }

  // Time-first patterns
  const timeMatch =
    text.match(
      /(?:at\s+)?(\d{1,2}(?::\d{2})?\s*(?:a\.?m\.?|p\.?m\.?)?|\d{1,2}\s*o'?clock)\b/i
    ) ?? text.match(/\b(\d{1,2}(?::\d{2})?\s*(?:am|pm))\b/i);

  if (timeMatch) {
    let token = timeMatch[1]!.replace(/\s*o'?clock/i, "").replace(/\s+/g, "");
    token = token.replace(/a\.?m\.?/i, "am").replace(/p\.?m\.?/i, "pm");
    const clock = parseClockToken(token.replace(/\s+/g, ""));
    if (clock) {
      return {
        kind: "loadAppointment",
        hour: clock.hour,
        minute: clock.minute,
        day,
        raw,
      };
    }
  }

  // Name load: "pull up florence apps" / "load patient florence apps"
  const nameMatch = text.match(
    new RegExp(
      `${LOAD_VERBS.source}(?:patient\\s+|client\\s+)?(.+)$`,
      "i"
    )
  );
  if (nameMatch) {
    let nameQuery = stripDayAndTimePhrases(nameMatch[1] ?? "")
      .replace(/^(?:patient|client)\s+/i, "")
      .replace(/\bfiles\b/gi, "")
      .trim();
    // Drop leftover joiners
    nameQuery = nameQuery.replace(/^(?:for|of|on)\s+/i, "").trim();
    if (
      nameQuery.length >= 2 &&
      !/^(today|tomorrow|yesterday|am|pm|this|next|last)$/i.test(nameQuery)
    ) {
      const wantsFiles = /\bfiles?\b/i.test(text);
      return {
        kind: "loadPatientByName",
        nameQuery,
        importFiles: wantsFiles,
        raw,
      };
    }
  }

  return { kind: "unknown", raw };
}

export function matchAppointmentAtTime(
  appointments: ClinikoPatientAppointment[],
  hour: number,
  minute: number,
  toleranceMinutes = 45
): ClinikoPatientAppointment | null {
  const targetMinutes = hour * 60 + minute;
  let best: ClinikoPatientAppointment | null = null;
  let bestDelta = Number.POSITIVE_INFINITY;

  for (const appointment of appointments) {
    if (!appointment.starts_at || appointment.cancelled_at || appointment.archived_at) continue;
    if (!appointment.patient_id) continue;
    const starts = new Date(appointment.starts_at);
    if (Number.isNaN(starts.getTime())) continue;
    const mins = starts.getHours() * 60 + starts.getMinutes();
    const delta = Math.abs(mins - targetMinutes);
    if (delta <= toleranceMinutes && delta < bestDelta) {
      best = appointment;
      bestDelta = delta;
    }
  }
  return best;
}

export function formatVoiceClock(hour: number, minute: number): string {
  const h12 = ((hour + 11) % 12) + 1;
  const meridiem = hour >= 12 ? "pm" : "am";
  if (minute === 0) return `${h12}${meridiem}`;
  return `${h12}:${String(minute).padStart(2, "0")}${meridiem}`;
}

export type ClinikoVoiceSearchHit = {
  id: string;
  first_name: string;
  last_name: string;
  date_of_birth: string | null;
};

/** Pick best patient from Cliniko name search for a spoken query. */
export function pickBestPatientForVoiceQuery(
  query: string,
  patients: ClinikoVoiceSearchHit[]
): ClinikoVoiceSearchHit | null {
  if (!patients.length) return null;
  const tokens = query
    .toLowerCase()
    .split(/\s+/)
    .map((t) => t.trim())
    .filter(Boolean);
  if (!tokens.length) return patients[0] ?? null;

  let best: ClinikoVoiceSearchHit | null = null;
  let bestScore = -1;
  for (const patient of patients) {
    const hay = `${patient.first_name} ${patient.last_name}`.toLowerCase();
    let score = 0;
    for (const token of tokens) {
      if (hay.includes(token)) score += 2;
      if (patient.first_name.toLowerCase().startsWith(token)) score += 1;
      if (patient.last_name.toLowerCase().startsWith(token)) score += 1;
    }
    if (score > bestScore) {
      bestScore = score;
      best = patient;
    }
  }
  return bestScore > 0 ? best : patients[0] ?? null;
}

export type CollateralVoiceListItem = {
  filename: string;
  category: string;
};

/** Spoken + on-screen inventory of uploaded collateral. */
export function formatCollateralListForVoice(
  docs: CollateralVoiceListItem[],
  options?: { summaryFilled?: boolean }
): { spoken: string; lines: string[] } {
  const summaryNote = options?.summaryFilled
    ? " A written collateral summary is also filled in."
    : "";

  if (!docs.length) {
    return {
      spoken: `There are no collateral files uploaded yet.${summaryNote}`.trim(),
      lines: [],
    };
  }

  const lines = docs.map((d, i) => {
    const name = d.filename.trim() || "Untitled file";
    const cat = d.category.trim();
    return cat ? `${i + 1}. ${name} — ${cat}` : `${i + 1}. ${name}`;
  });

  const spokenNames = docs
    .map((d) => {
      const name = d.filename.trim() || "untitled file";
      const cat = d.category.trim();
      return cat ? `${name}, ${cat}` : name;
    })
    .join(". ");

  const countLabel =
    docs.length === 1 ? "1 collateral file" : `${docs.length} collateral files`;

  return {
    spoken: `You have ${countLabel}: ${spokenNames}.${summaryNote}`.trim(),
    lines,
  };
}
