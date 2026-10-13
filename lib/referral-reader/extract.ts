import type Anthropic from "@anthropic-ai/sdk";
import { anthropic, MODELS } from "@/lib/anthropic-client";
import { extractTextFromPdfBuffer } from "@/lib/texlex-report-import/extract-pdf";
import {
  emptyReferralExtract,
  type ReferralAssessmentType,
  type ReferralReaderExtract,
  type ReferralReaderResult,
} from "./types";

const MAX_TEXT = 80_000;
const MAX_PDF_BYTES_FOR_VISION = 20 * 1024 * 1024;
/** Below this many “real” characters, treat PDF text as empty / scan-only. */
const MIN_MEANINGFUL_CHARS = 40;

const EXTRACT_TOOL_NAME = "extract_referral_fields";

const EXTRACT_TOOL: Anthropic.Tool = {
  name: EXTRACT_TOOL_NAME,
  description: "Extract Azure Mind referral-engine intake fields from a referral letter or email.",
  input_schema: {
    type: "object",
    properties: {
      childFirst: { type: "string", description: "Child / patient first name" },
      childLast: { type: "string", description: "Child / patient last name" },
      childDob: {
        type: "string",
        description: "Child date of birth as YYYY-MM-DD when possible",
      },
      parentFirst: { type: "string" },
      parentLast: { type: "string" },
      parentEmail: { type: "string" },
      parentMobile: { type: "string" },
      assessmentType: {
        type: "string",
        enum: ["ADHD", "ASD", "SLD", ""],
        description: "ADHD, ASD, SLD, or empty if unclear",
      },
      referrerName: { type: "string", description: "Referring GP / clinician name" },
      referrerType: { type: "string", description: "e.g. GP, paediatrician, school" },
      referrerEmail: { type: "string" },
      internalNotes: {
        type: "string",
        description: "1–4 short sentences of presenting concerns for staff only",
      },
      confidence: { type: "string", enum: ["high", "medium", "low"] },
      warnings: {
        type: "array",
        items: { type: "string" },
        description: "Missing or ambiguous fields",
      },
    },
    required: [
      "childFirst",
      "childLast",
      "childDob",
      "parentFirst",
      "parentLast",
      "parentEmail",
      "parentMobile",
      "assessmentType",
      "referrerName",
      "referrerType",
      "referrerEmail",
      "internalNotes",
      "confidence",
      "warnings",
    ],
  },
};

const SYSTEM = `You extract intake fields from a clinical referral letter, email, scanned form, or PDF for Azure Mind's referral engine.

Rules:
- Call the ${EXTRACT_TOOL_NAME} tool with the extracted fields.
- Do not invent names, emails, phones, or diagnoses not in the document.
- Never use placeholders like UNKNOWN, N/A, TBD, or angle-bracket tokens. If missing, use "".
- In AU GP letters, "RE: Mr/Miss/Master Name" is usually the child/patient.
- The signing doctor at the bottom is usually the referrer (often a GP).
- Phone under the patient block is often parent/carer mobile — put it in parentMobile when no separate parent phone is listed.
- Never put clinic/practice/reception emails in parentEmail (e.g. Reception.Wagin@…). Those go in referrerEmail only. If no parent email is written, leave parentEmail "".
- assessmentType: autism/ASD → ASD; ADHD/attention/possible ADHD → ADHD; learning/dyslexia/SLD → SLD. If both ADHD and autism are requested, still pick the primary assessment pathway (prefer the first named) — do NOT leave blank. Only use "" when no assessment type is named at all (generic behaviour opinion).
- referrerEmail = GP/practice that wrote the letter. Never use Perth Paediatrics / contact@perthpaediatrics / cstmedical recipient emails as referrerEmail.
- childDob: convert AU DD/MM/YYYY to YYYY-MM-DD when possible.
- internalNotes: 1–4 short sentences from the referral reason only.`;

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/** Drop LLM / form placeholders so they never fill the referral form. */
function cleanField(value: unknown): string {
  const s = asString(value);
  if (!s) return "";
  if (/^<[^>]+>$/.test(s)) return "";
  if (/^(unknown|n\/?a|none|null|tbd|not\s+provided|not\s+stated|\?+)$/i.test(s)) return "";
  return s;
}

/** Clinic / practice inboxes must never be treated as parent email. */
function isPracticeEmail(email: string): boolean {
  const e = email.trim().toLowerCase();
  if (!e) return false;
  const local = e.split("@")[0] ?? "";
  const domain = e.split("@")[1] ?? "";
  if (/^(info|admin|reception|clinic|hello|office|enquir(?:y|ies)|contact)([.+]|$)/i.test(local)) {
    return true;
  }
  return /^(stlukesfp|perthpaediatrics|azuremind|cstmedical|anketellfamilypractice|ballajura)\./i.test(
    domain
  );
}

function cleanParentEmail(value: unknown): string {
  const e = cleanField(value).toLowerCase();
  if (!e) return "";
  if (isPracticeEmail(e)) return "";
  return e;
}

function normalizeDob(raw: string): string {
  const s = cleanField(raw);
  if (!s) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const au = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/);
  if (au) {
    const d = au[1]!.padStart(2, "0");
    const m = au[2]!.padStart(2, "0");
    return `${au[3]}-${m}-${d}`;
  }
  const t = Date.parse(s);
  if (Number.isFinite(t)) {
    const dt = new Date(t);
    const y = dt.getFullYear();
    const m = String(dt.getMonth() + 1).padStart(2, "0");
    const d = String(dt.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  return "";
}

function normalizeMobile(raw: string): string {
  const s = cleanField(raw);
  if (!s) return "";
  const digits = s.replace(/[^\d+]/g, "");
  if (!digits) return "";
  if (/^04\d{8}$/.test(digits)) return digits;
  if (/^\+61/.test(digits)) return digits;
  // AU mobile with spaces: 0433 955 539
  const onlyDigits = digits.replace(/\D/g, "");
  if (/^04\d{8}$/.test(onlyDigits)) return onlyDigits;
  if (/^614\d{8}$/.test(onlyDigits)) return `+${onlyDigits}`;
  return s;
}

function parseAssessment(raw: unknown): ReferralAssessmentType | "" {
  const s = cleanField(raw).toUpperCase();
  if (s === "ADHD" || s === "ASD" || s === "SLD") return s;
  const lower = cleanField(raw).toLowerCase();
  if (/sld|learning|dyslex/.test(lower)) return "SLD";
  if (/autism|\basd\b|autistic/.test(lower)) return "ASD";
  if (/adhd|attention[- ]deficit/.test(lower)) return "ADHD";
  return "";
}

/** Perth Paediatrics / CST inboxes are the letter recipient, not the GP referrer. */
function isRecipientClinicEmail(email: string): boolean {
  const e = email.trim().toLowerCase();
  if (!e) return false;
  const domain = e.split("@")[1] ?? "";
  return /^(perthpaediatrics|cstmedical)\./i.test(domain);
}

/** Remove pdf-parse page banners so “empty” scans aren’t mistaken for content. */
export function stripPdfChrome(text: string): string {
  return text
    .replace(/^\s*--\s*\d+\s+of\s+\d+\s*--\s*$/gim, "")
    .replace(/\f/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function meaningfulCharCount(text: string): number {
  return stripPdfChrome(text).replace(/\s+/g, "").length;
}

export function isSparseReferralText(text: string): boolean {
  return meaningfulCharCount(text) < MIN_MEANINGFUL_CHARS;
}

function extractJsonObject(raw: string): Record<string, unknown> | null {
  let trimmed = raw.trim();
  if (!trimmed) return null;
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence?.[1]) trimmed = fence[1].trim();

  const tryParse = (s: string): Record<string, unknown> | null => {
    try {
      const v = JSON.parse(s) as unknown;
      return v && typeof v === "object" && !Array.isArray(v)
        ? (v as Record<string, unknown>)
        : null;
    } catch {
      return null;
    }
  };

  const direct = tryParse(trimmed);
  if (direct) return direct;
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start >= 0 && end > start) {
    const slice = trimmed.slice(start, end + 1);
    return tryParse(slice) ?? tryParse(slice.replace(/,\s*([}\]])/g, "$1"));
  }
  return null;
}

function normalizeExtract(raw: unknown): ReferralReaderExtract {
  const base = emptyReferralExtract();
  if (!raw || typeof raw !== "object") return base;
  const row = raw as Record<string, unknown>;
  const warnings = Array.isArray(row.warnings)
    ? row.warnings
        .filter((w): w is string => typeof w === "string")
        .map((w) => w.trim())
        .filter(Boolean)
        // Drop “blank document” noise when we actually got names from heuristics/vision
        .filter((w) => !/^document appears to be blank/i.test(w))
    : [];
  const confidence =
    row.confidence === "high" || row.confidence === "medium" || row.confidence === "low"
      ? row.confidence
      : "low";

  let parentEmail = cleanParentEmail(row.parentEmail);
  let referrerEmail = cleanField(row.referrerEmail).toLowerCase();
  if (referrerEmail && isRecipientClinicEmail(referrerEmail)) {
    referrerEmail = "";
  }
  // If model put practice inbox in parentEmail, move it to referrer when empty
  const rawParent = cleanField(row.parentEmail).toLowerCase();
  if (
    !parentEmail &&
    rawParent &&
    isPracticeEmail(rawParent) &&
    !isRecipientClinicEmail(rawParent) &&
    !referrerEmail
  ) {
    referrerEmail = rawParent;
  }

  return {
    childFirst: cleanField(row.childFirst),
    childLast: cleanField(row.childLast),
    childDob: normalizeDob(asString(row.childDob)),
    parentFirst: cleanField(row.parentFirst),
    parentLast: cleanField(row.parentLast),
    parentEmail,
    parentMobile: normalizeMobile(asString(row.parentMobile)),
    assessmentType: parseAssessment(row.assessmentType),
    referrerName: cleanField(row.referrerName),
    referrerType: cleanField(row.referrerType),
    referrerEmail,
    internalNotes: cleanField(row.internalNotes).slice(0, 2000),
    confidence,
    warnings,
  };
}

/**
 * Deterministic AU GP-letter scrape for when the model fails but text is present
 * (e.g. "RE: Mr Niza Zulu" + DOB + signing doctor).
 */
export function heuristicExtractFromReferralText(text: string): Partial<ReferralReaderExtract> | null {
  const t = stripPdfChrome(text);
  if (isSparseReferralText(t)) return null;

  const out: Partial<ReferralReaderExtract> = {};

  const reBlock =
    t.match(
      /RE:\s*(?:Mr|Mrs|Ms|Miss|Master|Mx)?\.?\s*([A-Za-z][A-Za-z'’-]+)\s+([A-Za-z][A-Za-z'’-]+)/i
    ) ||
    t.match(
      /regarding\s+(?:Mr|Mrs|Ms|Miss|Master|Mx)?\.?\s*([A-Za-z][A-Za-z'’-]+)\s+([A-Za-z][A-Za-z'’-]+)/i
    );
  if (reBlock) {
    out.childFirst = reBlock[1];
    out.childLast = reBlock[2];
  }

  const dob =
    t.match(/\bDOB:\s*(\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{4})/i) ||
    t.match(/\bdate of birth[:\s]+(\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{4})/i);
  if (dob) out.childDob = normalizeDob(dob[1]!);

  const mobile =
    t.match(/\b(04\d{2}\s?\d{3}\s?\d{3})\b/) ||
    t.match(/\b(\+61\s?4\d{2}\s?\d{3}\s?\d{3})\b/);
  if (mobile) out.parentMobile = normalizeMobile(mobile[1]!);

  {
    const all = [...t.matchAll(/\b([a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,})\b/gi)].map((m) =>
      m[1]!.toLowerCase()
    );
    const practice = all.find((e) => isPracticeEmail(e));
    const personal = all.find((e) => !isPracticeEmail(e));
    if (practice) out.referrerEmail = practice;
    if (personal) out.parentEmail = personal;
  }

  const signer =
    t.match(
      /Yours\s+faithfully,?\s*\r?\n+\s*(Dr\.?\s+[A-Za-z][A-Za-z'’-]+(?:\s+[A-Za-z][A-Za-z'’-]+){0,3})/i
    ) ||
    t.match(/\n(Dr\.?\s+[A-Z][a-z]+(?:\s+[A-Z][a-z'’-]+){1,3})\s*\r?\n/);
  if (signer) {
    out.referrerName = signer[1]!.replace(/\s+/g, " ").trim();
    out.referrerType = out.referrerType || "GP";
  }

  {
    const hasSld = /learning|dyslex|\bsld\b/i.test(t);
    const adhdIdx = t.search(/adhd|attention[- ]deficit/i);
    const asdIdx = t.search(/autism|\basd\b|autistic/i);
    if (hasSld && adhdIdx < 0 && asdIdx < 0) out.assessmentType = "SLD";
    else if (adhdIdx >= 0 && asdIdx >= 0) {
      // Dual request → still an assessment; prefer whichever is named first
      out.assessmentType = adhdIdx <= asdIdx ? "ADHD" : "ASD";
    } else if (asdIdx >= 0) out.assessmentType = "ASD";
    else if (adhdIdx >= 0) out.assessmentType = "ADHD";
  }

  const reason = t.match(/Thank you for seeing[\s\S]{10,400}?(?=\nYours|\nKind regards|\nRegards)/i);
  if (reason) out.internalNotes = reason[0]!.replace(/\s+/g, " ").trim().slice(0, 600);

  if (!out.childFirst && !out.parentMobile && !out.childDob) return null;
  return out;
}

function mergeHeuristic(
  primary: ReferralReaderExtract,
  heuristic: Partial<ReferralReaderExtract> | null
): ReferralReaderExtract {
  if (!heuristic) return primary;
  const pick = (a: string, b: string | undefined) => a || cleanField(b) || "";
  return {
    ...primary,
    childFirst: pick(primary.childFirst, heuristic.childFirst),
    childLast: pick(primary.childLast, heuristic.childLast),
    childDob: primary.childDob || normalizeDob(heuristic.childDob || ""),
    parentFirst: pick(primary.parentFirst, heuristic.parentFirst),
    parentLast: pick(primary.parentLast, heuristic.parentLast),
    parentEmail: pick(primary.parentEmail, heuristic.parentEmail),
    parentMobile: primary.parentMobile || normalizeMobile(heuristic.parentMobile || ""),
    assessmentType: primary.assessmentType || heuristic.assessmentType || "",
    referrerName: pick(primary.referrerName, heuristic.referrerName),
    referrerType: pick(primary.referrerType, heuristic.referrerType),
    referrerEmail: pick(primary.referrerEmail, heuristic.referrerEmail),
    internalNotes: pick(primary.internalNotes, heuristic.internalNotes),
    confidence:
      primary.childFirst || heuristic.childFirst
        ? primary.confidence === "low" && heuristic.childFirst
          ? "medium"
          : primary.confidence
        : primary.confidence,
    warnings: primary.warnings.filter((w) => !/blank|empty|no referral content/i.test(w)),
  };
}

function toolInputFromMessage(message: Anthropic.Message): Record<string, unknown> | null {
  for (const block of message.content) {
    if (block.type === "tool_use" && block.name === EXTRACT_TOOL_NAME) {
      const input = block.input;
      if (input && typeof input === "object" && !Array.isArray(input)) {
        return input as Record<string, unknown>;
      }
    }
  }
  const text = message.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n");
  return extractJsonObject(text);
}

async function callExtractTool(userContent: Anthropic.MessageParam["content"]): Promise<ReferralReaderExtract> {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY missing");
  }
  const message = await anthropic.messages.create({
    model: MODELS.SONNET,
    max_tokens: 2048,
    temperature: 0,
    system: SYSTEM,
    tools: [EXTRACT_TOOL],
    tool_choice: { type: "tool", name: EXTRACT_TOOL_NAME },
    messages: [{ role: "user", content: userContent }],
  });
  const input = toolInputFromMessage(message);
  if (!input) {
    throw new Error("Could not parse referral fields from the model response.");
  }
  return normalizeExtract(input);
}

async function mapReferralTextWithLlm(text: string): Promise<ReferralReaderExtract> {
  const clipped = stripPdfChrome(text).slice(0, MAX_TEXT);
  const llm = await callExtractTool(
    `Extract referral intake fields from this document text:\n\n${clipped}`
  );
  const merged = mergeHeuristic(llm, heuristicExtractFromReferralText(clipped));
  // If LLM left type blank but letter names ADHD/ASD/SLD, fill from heuristics
  if (!merged.assessmentType) {
    const h = heuristicExtractFromReferralText(clipped);
    if (h?.assessmentType) return { ...merged, assessmentType: h.assessmentType };
  }
  return merged;
}

async function mapReferralPdfWithVision(buffer: Buffer): Promise<ReferralReaderExtract> {
  if (buffer.length > MAX_PDF_BYTES_FOR_VISION) {
    throw new Error("PDF is too large for vision read (max 20MB).");
  }
  const data = buffer.toString("base64");
  const content: Anthropic.ContentBlockParam[] = [
    {
      type: "document",
      source: {
        type: "base64",
        media_type: "application/pdf",
        data,
      },
    },
    {
      type: "text",
      text: "This may be a scanned referral. Read the PDF (including handwriting if legible) and extract intake fields via the tool. Use empty strings for anything you cannot read.",
    },
  ];
  return callExtractTool(content);
}

export async function readReferralFromText(text: string): Promise<ReferralReaderResult> {
  const trimmed = stripPdfChrome(text);
  if (!trimmed || isSparseReferralText(trimmed)) {
    return {
      success: false,
      error:
        "No readable referral text found. If this is a scan, upload the PDF (vision read) or paste the letter text.",
    };
  }
  try {
    const extract = await mapReferralTextWithLlm(trimmed);
    if (!extract.childFirst && !extract.parentEmail && !extract.parentMobile && !extract.childDob) {
      return {
        success: false,
        error: "Could not find child or parent contact details in that document.",
        extract,
        sourceChars: trimmed.length,
      };
    }
    return { success: true, extract, sourceChars: trimmed.length };
  } catch (e) {
    // Last resort: heuristics only
    const h = heuristicExtractFromReferralText(trimmed);
    if (h && (h.childFirst || h.parentMobile || h.childDob)) {
      return {
        success: true,
        extract: mergeHeuristic(emptyReferralExtract(), h),
        sourceChars: trimmed.length,
      };
    }
    return {
      success: false,
      error: e instanceof Error ? e.message : "Referral reader failed",
    };
  }
}

export async function readReferralFromPdf(buffer: Buffer): Promise<ReferralReaderResult> {
  let text = "";
  try {
    text = await extractTextFromPdfBuffer(buffer);
  } catch {
    text = "";
  }

  const cleaned = stripPdfChrome(text);

  // Scanned / image-only PDF → Claude document vision
  if (!cleaned || isSparseReferralText(cleaned)) {
    try {
      const extract = await mapReferralPdfWithVision(buffer);
      if (!extract.childFirst && !extract.parentEmail && !extract.parentMobile && !extract.childDob) {
        return {
          success: false,
          error:
            "This looks like a scanned PDF and we still could not read patient/parent details. Paste the letter text if you can.",
          extract,
        };
      }
      return { success: true, extract, sourceChars: 0 };
    } catch (e) {
      return {
        success: false,
        error:
          e instanceof Error
            ? e.message
            : "Could not read scanned PDF. Paste the referral text instead.",
      };
    }
  }

  // Text layer present — LLM + AU letter heuristics
  try {
    const extract = await mapReferralTextWithLlm(cleaned);
    if (!extract.childFirst && !extract.parentEmail && !extract.parentMobile && !extract.childDob) {
      // Text existed but extract failed — try vision as backup (some “text” PDFs are garbage)
      try {
        const vision = await mapReferralPdfWithVision(buffer);
        const merged = mergeHeuristic(vision, heuristicExtractFromReferralText(cleaned));
        if (merged.childFirst || merged.parentMobile || merged.childDob) {
          return { success: true, extract: merged, sourceChars: cleaned.length };
        }
      } catch {
        /* fall through */
      }
      return {
        success: false,
        error: "Could not find child or parent contact details in that PDF.",
        extract,
        sourceChars: cleaned.length,
      };
    }
    return { success: true, extract, sourceChars: cleaned.length };
  } catch (e) {
    const h = heuristicExtractFromReferralText(cleaned);
    if (h && (h.childFirst || h.parentMobile || h.childDob)) {
      return {
        success: true,
        extract: mergeHeuristic(emptyReferralExtract(), h),
        sourceChars: cleaned.length,
      };
    }
    try {
      const vision = await mapReferralPdfWithVision(buffer);
      return { success: true, extract: vision, sourceChars: cleaned.length };
    } catch {
      return {
        success: false,
        error: e instanceof Error ? e.message : "Referral reader failed",
      };
    }
  }
}
