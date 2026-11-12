import assert from "node:assert/strict";
import { createHash, createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { decodeGmailBase64Url, parseGmailMessagePayload } from "./gmail/parse-message.ts";

/** Mirrors lib/referral-intake/duplicate.ts — providerDedupeKey */
function providerDedupeKey(provider: string, messageId: string): string {
  return `${provider}:${messageId.trim()}`;
}

/** Mirrors lib/referral-intake/duplicate.ts — isLikelySamePatient */
function isLikelySamePatient(
  a: { childFirst: string; childLast: string; childDob: string },
  b: { childFirst: string; childLast: string; childDob: string }
): boolean {
  const norm = (s: string) => s.trim().toLowerCase();
  if (!norm(a.childFirst) || !norm(a.childLast) || !norm(b.childFirst) || !norm(b.childLast)) {
    return false;
  }
  if (norm(a.childFirst) !== norm(b.childFirst) || norm(a.childLast) !== norm(b.childLast)) {
    return false;
  }
  const aDob = a.childDob.trim();
  const bDob = b.childDob.trim();
  if (!aDob || !bDob) return false;
  return aDob === bDob;
}

type ExtractionStatus = "pending" | "extracted" | "needs_review" | "failed";
type ContactStatus = "not_contacted" | "contact_attempted" | "contacted" | "opted_out";

/** Mirrors lib/referral-intake/status.ts auto-ready policy */
function isInformationalExtractionWarning(warning: string): boolean {
  const w = warning.trim();
  if (!w) return true;
  if (/^Processed \d+ attachment/i.test(w)) return true;
  if (/outside the page boundary/i.test(w)) return true;
  return false;
}
function deriveExtractionStatus(extract: {
  childFirst: string;
  childLast: string;
  childDob: string;
  parentMobile: string;
  assessmentType: string;
  confidence: string;
  warnings: string[];
}): ExtractionStatus {
  const hasChild = Boolean(extract.childFirst.trim() && extract.childLast.trim());
  const hasDob = Boolean(extract.childDob.trim());
  const blocking = extract.warnings.filter((w) => !isInformationalExtractionWarning(w));
  if (!hasChild) return "needs_review";
  if (!hasDob) return "needs_review";
  if (extract.confidence === "low") return "needs_review";
  if (blocking.length > 0) return "needs_review";
  return "extracted";
}

function deriveDashboardStatus(args: {
  extractionStatus: ExtractionStatus;
  contactStatus: ContactStatus;
  bookingStatus: string;
  failed?: boolean;
}): string {
  if (args.failed) return "processing_error";
  if (args.bookingStatus === "booked") return "booked";
  if (args.contactStatus === "contacted" || args.contactStatus === "contact_attempted") {
    return "contacted";
  }
  if (args.extractionStatus === "needs_review" || args.extractionStatus === "failed") {
    return "awaiting_review";
  }
  if (args.extractionStatus === "extracted") return "ready_for_contact";
  return "new";
}

describe("referral intake duplicates", () => {
  it("builds stable provider dedupe keys", () => {
    assert.equal(providerDedupeKey("gmail", "msg-1"), "gmail:msg-1");
    assert.equal(providerDedupeKey("synthetic", " msg-2 "), "synthetic:msg-2");
  });

  it("matches same patient only when name and DOB both match", () => {
    assert.equal(
      isLikelySamePatient(
        { childFirst: "Ava", childLast: "Example", childDob: "2016-06-14" },
        { childFirst: "ava", childLast: "EXAMPLE", childDob: "2016-06-14" }
      ),
      true
    );
    assert.equal(
      isLikelySamePatient(
        { childFirst: "Ava", childLast: "Example", childDob: "2016-06-14" },
        { childFirst: "Ava", childLast: "Example", childDob: "2015-01-01" }
      ),
      false
    );
    // Name alone is insufficient — siblings / common names must not match without DOB
    assert.equal(
      isLikelySamePatient(
        { childFirst: "Ava", childLast: "Example", childDob: "" },
        { childFirst: "Ava", childLast: "Example", childDob: "" }
      ),
      false
    );
  });
});

/** Mirrors lib/referral-intake/auto-verify.ts core gates */
function verifyReferralForAutoReady(args: {
  extract: {
    childFirst: string;
    childLast: string;
    childDob: string;
    parentMobile: string;
    parentEmail: string;
    referrerName: string;
    confidence: string;
    warnings: string[];
  };
  hasIdentityConflict: boolean;
  softDuplicateOfReferralId?: string;
}): { autoReady: boolean; reasons: string[] } {
  const { extract, hasIdentityConflict, softDuplicateOfReferralId } = args;
  const reasons: string[] = [];
  const hasChild = Boolean(extract.childFirst.trim() && extract.childLast.trim());
  if (!hasChild) reasons.push("Child first and last name missing");
  const dobOk = /^\d{4}-\d{2}-\d{2}$/.test(extract.childDob.trim());
  // Parent mobile is never an identity anchor (siblings share it)
  if (!dobOk) reasons.push("Need child DOB");
  const mobileDigits = extract.parentMobile.replace(/\D/g, "");
  const mobileOk = /^(?:\+?61|0)?4\d{8}$/.test(mobileDigits);
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(extract.parentEmail.trim());
  if (!mobileOk && !emailOk) reasons.push("Missing parent contact");
  if (!extract.referrerName.trim()) reasons.push("Referring GP missing");
  if (hasIdentityConflict) reasons.push("Identity conflict");
  if (softDuplicateOfReferralId) reasons.push("Soft duplicate");
  if (extract.confidence === "low") reasons.push("Low confidence");
  const blocking = extract.warnings.filter((w) => !isInformationalExtractionWarning(w));
  if (blocking.length) reasons.push("Blocking warnings");
  return { autoReady: reasons.length === 0, reasons };
}

describe("referral intake status", () => {
  it("flags incomplete extracts for human review", () => {
    const status = deriveExtractionStatus({
      childFirst: "Ava",
      childLast: "",
      childDob: "",
      parentMobile: "",
      assessmentType: "",
      confidence: "low",
      warnings: ["uncertain DOB"],
    });
    assert.equal(status, "needs_review");
    assert.equal(
      deriveDashboardStatus({
        extractionStatus: status,
        contactStatus: "not_contacted",
        bookingStatus: "not_booked",
      }),
      "awaiting_review"
    );
  });

  it("auto-ready when child + DOB present even if assessment missing", () => {
    assert.equal(
      deriveExtractionStatus({
        childFirst: "Maisie",
        childLast: "Mews",
        childDob: "2022-06-23",
        parentMobile: "0422568742",
        assessmentType: "",
        confidence: "high",
        warnings: ["Processed 1 attachment(s): referral.pdf (primary referral)."],
      }),
      "extracted"
    );
  });

  it("auto-verify passes clean referral to ready path", () => {
    const result = verifyReferralForAutoReady({
      extract: {
        childFirst: "Maisie",
        childLast: "Mews",
        childDob: "2022-06-23",
        parentMobile: "0422568742",
        parentEmail: "",
        referrerName: "Dr Example",
        confidence: "high",
        warnings: ["Processed 1 attachment(s): referral.pdf (primary referral)."],
      },
      hasIdentityConflict: false,
    });
    assert.equal(result.autoReady, true);
  });

  it("auto-verify holds Marcie/Zoe-style identity conflict for staff", () => {
    const result = verifyReferralForAutoReady({
      extract: {
        childFirst: "Marcie",
        childLast: "Smith",
        childDob: "2018-01-01",
        parentMobile: "0412345678",
        parentEmail: "",
        referrerName: "Dr Example",
        confidence: "high",
        warnings: [],
      },
      hasIdentityConflict: true,
    });
    assert.equal(result.autoReady, false);
    assert.ok(result.reasons.some((r) => /Identity conflict/i.test(r)));
  });

  it("auto-verify holds missing parent contact for staff", () => {
    const result = verifyReferralForAutoReady({
      extract: {
        childFirst: "Ava",
        childLast: "Nguyen",
        childDob: "2019-05-12",
        parentMobile: "",
        parentEmail: "",
        referrerName: "Dr Example",
        confidence: "medium",
        warnings: [],
      },
      hasIdentityConflict: false,
    });
    assert.equal(result.autoReady, false);
    assert.ok(result.reasons.some((r) => /parent contact/i.test(r)));
  });

  it("auto-verify rejects parent mobile alone as patient identity", () => {
    const result = verifyReferralForAutoReady({
      extract: {
        childFirst: "Sibling",
        childLast: "One",
        childDob: "",
        parentMobile: "0412345678",
        parentEmail: "",
        referrerName: "Dr Example",
        confidence: "high",
        warnings: [],
      },
      hasIdentityConflict: false,
    });
    assert.equal(result.autoReady, false);
    assert.ok(result.reasons.some((r) => /DOB/i.test(r)));
  });

  it("maps extracted + contacted + booked correctly", () => {
    assert.equal(
      deriveDashboardStatus({
        extractionStatus: "extracted",
        contactStatus: "not_contacted",
        bookingStatus: "not_booked",
      }),
      "ready_for_contact"
    );
    assert.equal(
      deriveDashboardStatus({
        extractionStatus: "extracted",
        contactStatus: "contacted",
        bookingStatus: "not_booked",
      }),
      "contacted"
    );
    assert.equal(
      deriveDashboardStatus({
        extractionStatus: "extracted",
        contactStatus: "contacted",
        bookingStatus: "booked",
      }),
      "booked"
    );
    assert.equal(
      deriveDashboardStatus({
        extractionStatus: "failed",
        contactStatus: "not_contacted",
        bookingStatus: "not_booked",
        failed: true,
      }),
      "processing_error"
    );
  });
});

describe("gmail parse-message", () => {
  it("parses headers and nested PDF attachments", () => {
    const parsed = parseGmailMessagePayload({
      id: "abc123",
      threadId: "thr1",
      historyId: "99",
      internalDate: "1700000000000",
      payload: {
        headers: [
          { name: "From", value: "gp@clinic.example" },
          { name: "Subject", value: "Referral — Ava Example" },
        ],
        parts: [
          {
            filename: "referral.pdf",
            mimeType: "application/pdf",
            body: { attachmentId: "att-1", size: 12 },
          },
          {
            mimeType: "multipart/alternative",
            parts: [{ mimeType: "text/plain", body: { data: "aGVsbG8=" } }],
          },
        ],
      },
    });
    assert.equal(parsed.id, "abc123");
    assert.equal(parsed.fromAddress, "gp@clinic.example");
    assert.equal(parsed.subject, "Referral — Ava Example");
    assert.equal(parsed.attachmentParts.length, 1);
    assert.equal(parsed.attachmentParts[0]?.attachmentId, "att-1");
    assert.equal(decodeGmailBase64Url("aGVsbG8").toString("utf8"), "hello");
  });
});

describe("document eligibility for patient comms", () => {
  it("excludes excluded and unresolved conflict docs", async () => {
    const { documentsEligibleForPatientComms, isUnresolvedIdentityConflict } = await import(
      "./document-eligibility.ts"
    );
    const docs = [
      { id: "1", filename: "a.pdf", extraction_role: "primary", identity_conflict: false },
      {
        id: "2",
        filename: "zoe.docx",
        extraction_role: "none",
        identity_conflict: true,
        conflict_resolution: "excluded",
      },
      {
        id: "3",
        filename: "other.png",
        extraction_role: "conflict",
        identity_conflict: true,
        conflict_resolution: null,
      },
    ];
    assert.equal(isUnresolvedIdentityConflict(docs[2]!), true);
    assert.equal(isUnresolvedIdentityConflict(docs[1]!), false);
    const eligible = documentsEligibleForPatientComms(docs);
    assert.deepEqual(
      eligible.map((d) => d.id),
      ["1"]
    );
  });
});

describe("patient identity conflicts", () => {
  it("flags different children and different DOBs", async () => {
    const { patientIdentitiesConflict } = await import("./patient-identity.ts");
    assert.equal(
      patientIdentitiesConflict(
        { childFirst: "Marcie", childLast: "Mews", childDob: "2022-09-25" },
        { childFirst: "Zoe", childLast: "Roser", childDob: "" }
      ),
      true
    );
    assert.equal(
      patientIdentitiesConflict(
        { childFirst: "Marcie", childLast: "Mews", childDob: "2022-09-25" },
        { childFirst: "Marcie", childLast: "Mews", childDob: "2020-01-01" }
      ),
      true
    );
    assert.equal(
      patientIdentitiesConflict(
        { childFirst: "Marcie", childLast: "Mews", childDob: "2022-09-25" },
        { childFirst: "Marcie", childLast: "Mews", childDob: "2022-09-25" }
      ),
      false
    );
    assert.equal(
      patientIdentitiesConflict(
        { childFirst: "Marcie", childLast: "Mews", childDob: "" },
        { childFirst: "", childLast: "", childDob: "" }
      ),
      false
    );
  });
});

describe("attachment kinds", () => {
  it("classifies PDF JPEG PNG DOCX and rejects unsupported", async () => {
    const {
      classifyReferralAttachment,
      isSupportedReferralAttachment,
    } = await import("../referral-reader/attachment-kinds.ts");
    assert.equal(classifyReferralAttachment({ filename: "a.pdf" }), "pdf");
    assert.equal(classifyReferralAttachment({ filename: "a.JPG" }), "jpeg");
    assert.equal(classifyReferralAttachment({ contentType: "image/png" }), "png");
    assert.equal(
      classifyReferralAttachment({
        filename: "letter.docx",
        contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      }),
      "docx"
    );
    assert.equal(isSupportedReferralAttachment({ filename: "notes.txt" }), false);
    assert.equal(isSupportedReferralAttachment({ filename: "scan.doc" }), false);
  });
});

describe("multi-attachment referral labelling", () => {
  it("marks referral-bearing extracts and merges blanks from supporting docs", () => {
    type Extract = {
      childFirst: string;
      childLast: string;
      childDob: string;
      parentFirst: string;
      parentLast: string;
      parentEmail: string;
      parentMobile: string;
      assessmentType: string;
      referrerName: string;
      referrerType: string;
      referrerEmail: string;
      internalNotes: string;
      confidence: "high" | "medium" | "low";
      warnings: string[];
    };
    /** Mirrors lib/referral-intake/multi-extract.ts — extractContainsReferralInfo */
    function extractContainsReferralInfo(extract: Extract): boolean {
      const hasChild = Boolean(extract.childFirst.trim() && extract.childLast.trim());
      const hasDob = Boolean(extract.childDob.trim());
      const hasParentContact = Boolean(extract.parentMobile.trim() || extract.parentEmail.trim());
      const hasReferrer = Boolean(extract.referrerName.trim());
      const hasAssessment = Boolean(extract.assessmentType);
      return (
        hasChild ||
        (hasDob && hasParentContact) ||
        (hasReferrer && (hasAssessment || hasParentContact || hasDob))
      );
    }
    function pick(a: string, b: string) {
      return a.trim() ? a : b;
    }
    /** Mirrors mergeReferralExtracts */
    function mergeReferralExtracts(primary: Extract, supporting: Extract[]): Extract {
      let merged = { ...primary };
      for (const next of supporting) {
        merged = {
          ...merged,
          childDob: pick(merged.childDob, next.childDob),
          parentFirst: pick(merged.parentFirst, next.parentFirst),
          parentLast: pick(merged.parentLast, next.parentLast),
          parentEmail: pick(merged.parentEmail, next.parentEmail),
          parentMobile: pick(merged.parentMobile, next.parentMobile),
          referrerName: pick(merged.referrerName, next.referrerName),
          referrerType: pick(merged.referrerType, next.referrerType),
        };
      }
      return merged;
    }

    assert.equal(
      extractContainsReferralInfo({
        childFirst: "Maisie",
        childLast: "Mews",
        childDob: "2022-06-23",
        parentFirst: "",
        parentLast: "",
        parentEmail: "",
        parentMobile: "",
        assessmentType: "ADHD",
        referrerName: "",
        referrerType: "",
        referrerEmail: "",
        internalNotes: "",
        confidence: "high",
        warnings: [],
      }),
      true
    );
    assert.equal(
      extractContainsReferralInfo({
        childFirst: "",
        childLast: "",
        childDob: "",
        parentFirst: "",
        parentLast: "",
        parentEmail: "",
        parentMobile: "",
        assessmentType: "",
        referrerName: "",
        referrerType: "",
        referrerEmail: "",
        internalNotes: "",
        confidence: "low",
        warnings: [],
      }),
      false
    );
    const merged = mergeReferralExtracts(
      {
        childFirst: "Maisie",
        childLast: "Mews",
        childDob: "",
        parentFirst: "",
        parentLast: "",
        parentEmail: "",
        parentMobile: "",
        assessmentType: "ADHD",
        referrerName: "",
        referrerType: "",
        referrerEmail: "",
        internalNotes: "",
        confidence: "medium",
        warnings: [],
      },
      [
        {
          childFirst: "",
          childLast: "",
          childDob: "2022-06-23",
          parentFirst: "Jay",
          parentLast: "Mews",
          parentEmail: "jay@example.com",
          parentMobile: "0422568742",
          assessmentType: "",
          referrerName: "Hui Lian Koh",
          referrerType: "GP",
          referrerEmail: "",
          internalNotes: "",
          confidence: "high",
          warnings: [],
        },
      ]
    );
    assert.equal(merged.childDob, "2022-06-23");
    assert.equal(merged.parentMobile, "0422568742");
    assert.equal(merged.referrerName, "Hui Lian Koh");
  });
});

describe("document store content addressing", () => {
  it("stores under clinic/sha path", () => {
    const root = mkdtempSync(path.join(tmpdir(), "texlex-ref-docs-"));
    try {
      const bytes = Buffer.from("%PDF-1.4 synthetic referral");
      const sha256 = createHash("sha256").update(bytes).digest("hex");
      const relative = path.join("perth-paediatrics", sha256.slice(0, 2), `${sha256}-GP_Referral.pdf`);
      const absolute = path.join(root, relative);
      mkdirSync(path.dirname(absolute), { recursive: true });
      writeFileSync(absolute, bytes);
      assert.equal(readFileSync(absolute).equals(bytes), true);
      assert.match(relative.replace(/\\/g, "/"), /^perth-paediatrics\//);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe("token encryption shape", () => {
  it("round-trips AES-256-GCM payload", () => {
    const key = createHash("sha256").update("test-secret").digest();
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", key, iv);
    const enc = Buffer.concat([cipher.update("refresh-token", "utf8"), cipher.final()]);
    const tag = cipher.getAuthTag();
    const payload = `v1:${iv.toString("base64url")}:${tag.toString("base64url")}:${enc.toString("base64url")}`;
    const [, ivB64, tagB64, dataB64] = payload.split(":");
    const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(ivB64!, "base64url"));
    decipher.setAuthTag(Buffer.from(tagB64!, "base64url"));
    const plain = Buffer.concat([
      decipher.update(Buffer.from(dataB64!, "base64url")),
      decipher.final(),
    ]).toString("utf8");
    assert.equal(plain, "refresh-token");
  });
});
