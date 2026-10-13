import type { ReviewSectionId, ReviewSectionInput } from "./types";

const MONTHS: Record<string, number> = {
  jan: 1,
  feb: 2,
  mar: 3,
  apr: 4,
  may: 5,
  jun: 6,
  jul: 7,
  aug: 8,
  sep: 9,
  oct: 10,
  nov: 11,
  dec: 12,
};

const DATE_TOKEN =
  String.raw`(\d{4}-\d{2}-\d{2}|\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4}|\d{1,2}\s+[A-Za-z]+\s+\d{4})`;

/** Calendar day as YYYY-MM-DD, or null when the string is not a date. Australian day-first for numeric dates. */
export function parseCalendarDay(raw: string): string | null {
  const s = raw.trim();
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return validDay(Number(iso[1]), Number(iso[2]), Number(iso[3]));

  const numeric = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/);
  if (numeric) {
    let year = Number(numeric[3]);
    if (year < 100) year += 2000;
    return validDay(year, Number(numeric[2]), Number(numeric[1]));
  }

  const named = s.match(/^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})$/);
  if (named) {
    const month = MONTHS[named[2]!.slice(0, 3).toLowerCase()];
    if (!month) return null;
    return validDay(Number(named[3]), month, Number(named[1]));
  }
  return null;
}

function validDay(year: number, month: number, day: number): string | null {
  if (month < 1 || month > 12 || day < 1 || day > 31 || year < 1900 || year > 2200) return null;
  const dt = new Date(Date.UTC(year, month - 1, day));
  if (dt.getUTCFullYear() !== year || dt.getUTCMonth() !== month - 1 || dt.getUTCDate() !== day) {
    return null;
  }
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function formatCalendarDay(isoDay: string): string {
  const parsed = parseCalendarDay(isoDay);
  if (!parsed) return isoDay.trim();
  const [year, month, day] = parsed.split("-").map(Number);
  return new Date(Date.UTC(year!, month! - 1, day!)).toLocaleDateString("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function calendarDays(values: string[]): string[] {
  const days: string[] = [];
  for (const value of values) {
    const day = parseCalendarDay(value);
    if (day && !days.includes(day)) days.push(day);
  }
  return days;
}

export type HeaderDateConflict = {
  reportDay: string;
  latestAssessmentDay: string;
  assessmentDays: string[];
};

/** The report cannot be dated before the assessment was completed. */
export function headerDateConflict(
  assessmentDates: string[],
  reportDate: string
): HeaderDateConflict | null {
  const assessmentDays = calendarDays(assessmentDates);
  const reportDay = parseCalendarDay(reportDate);
  if (!assessmentDays.length || !reportDay) return null;
  const latestAssessmentDay = assessmentDays.reduce((latest, day) => (day > latest ? day : latest));
  if (reportDay >= latestAssessmentDay) return null;
  return { reportDay, latestAssessmentDay, assessmentDays };
}

export type ProseDateConflict = {
  sectionId: ReviewSectionId;
  which: "assessment" | "report";
  statedDay: string;
  excerpt: string;
};

const ASSESSMENT_LABEL = /date of assessment|assessment date/i;
const REPORT_LABEL = /date of report|report date/i;

function labeledDay(text: string, label: RegExp): { day: string; excerpt: string } | null {
  const re = new RegExp(`(?:${label.source})\\s*[:\\-]?\\s*${DATE_TOKEN}`, "i");
  const match = text.match(re);
  if (!match?.[1]) return null;
  const day = parseCalendarDay(match[1]);
  if (!day) return null;
  return { day, excerpt: match[0].replace(/\s+/g, " ").trim() };
}

/** A section that states a date of assessment or date of report other than the locked dates. */
export function proseDateConflicts(
  sections: ReviewSectionInput[],
  assessmentDates: string[],
  reportDate: string
): ProseDateConflict[] {
  const assessmentDays = calendarDays(assessmentDates);
  const reportDay = parseCalendarDay(reportDate);
  const out: ProseDateConflict[] = [];
  for (const section of sections) {
    const text = section.text ?? "";
    if (!text.trim()) continue;
    const assessment = labeledDay(text, ASSESSMENT_LABEL);
    if (assessment && assessmentDays.length && !assessmentDays.includes(assessment.day)) {
      out.push({
        sectionId: section.sectionId,
        which: "assessment",
        statedDay: assessment.day,
        excerpt: assessment.excerpt,
      });
    }
    const report = labeledDay(text, REPORT_LABEL);
    if (report && reportDay && report.day !== reportDay) {
      out.push({
        sectionId: section.sectionId,
        which: "report",
        statedDay: report.day,
        excerpt: report.excerpt,
      });
    }
  }
  return out;
}
