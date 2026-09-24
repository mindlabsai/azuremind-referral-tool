import { clientFirstName } from "@/app/asd-engine/report/pdf/utils";
import type {
  ReviewFinding,
  ReviewSectionId,
  ReviewSectionInput,
} from "./types";
import { newReviewId } from "./types";

export type DeterministicReviewInput = {
  runId: string;
  clientName: string;
  pronouns: string;
  parent1: string;
  parent2: string;
  school: string;
  assessmentModality: "" | "in-clinic" | "virtual";
  diagnosticConclusion: string;
  confirmedLevelA: number | null;
  confirmedLevelB: number | null;
  expectedFormulationOpening: string;
  sections: ReviewSectionInput[];
};

function sectionMap(sections: ReviewSectionInput[]): Map<ReviewSectionId, string> {
  return new Map(sections.map((s) => [s.sectionId, s.text ?? ""]));
}

function firstSentence(text: string): string {
  const t = text.trim();
  if (!t) return "";
  const m = t.match(/^[\s\S]{10,400}?[.!?](?=\s|$)/);
  return (m?.[0] ?? t.split(/\n/)[0] ?? t).trim();
}

/** Allowed first-name tokens from demographics (client + parents). */
function allowedFirstNames(input: DeterministicReviewInput): Set<string> {
  const names = new Set<string>();
  const add = (raw: string) => {
    const first = clientFirstName(raw).trim();
    if (first && first.length >= 2) names.add(first.toLowerCase());
    const parts = raw.trim().split(/\s+/).filter(Boolean);
    for (const p of parts) {
      if (p.length >= 2 && /^[A-Za-z'’-]+$/.test(p)) names.add(p.toLowerCase());
    }
  };
  add(input.clientName);
  if (input.parent1.trim()) add(input.parent1);
  if (input.parent2.trim()) add(input.parent2);
  // Common clinical role words / titles — not flags
  for (const w of [
    "master",
    "miss",
    "mr",
    "mrs",
    "ms",
    "dr",
    "the",
    "client",
    "child",
    "mother",
    "father",
    "parent",
    "teacher",
    "assessor",
    "psychologist",
    "paediatrician",
    "pediatrician",
  ]) {
    names.add(w);
  }
  return names;
}

/**
 * Suspicious capitalized tokens that look like person first names and are not in demographics.
 * Conservative: only flags known high-risk patterns + words that appear as "X's Autism" style.
 */
const HIGH_RISK_FOREIGN_NAMES = [
  "savannah",
  "elena",
  "eleanor",
  "romy",
  "florence",
  "jessica",
  "emma",
  "liam",
  "noah",
  "oliver",
  "charlotte",
  "amelia",
  "sophia",
  "mia",
  "isla",
  "harper",
];

function findForeignNameHits(
  text: string,
  allowed: Set<string>
): Array<{ name: string; excerpt: string }> {
  const hits: Array<{ name: string; excerpt: string }> = [];
  const re = /\b([A-Z][a-z]{2,})(?:'s)?\b/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const raw = m[1];
    const lower = raw.toLowerCase();
    if (allowed.has(lower)) continue;
    // Only flag if in high-risk list OR possessive clinical pattern "Name's Autism/ASD"
    const after = text.slice(m.index, m.index + 40);
    const clinicalPossessive = /'s\s+(Autism|ASD|Attention|ADHD|presentation)\b/i.test(after);
    if (!HIGH_RISK_FOREIGN_NAMES.includes(lower) && !clinicalPossessive) continue;
    const start = Math.max(0, m.index - 40);
    const end = Math.min(text.length, m.index + raw.length + 60);
    hits.push({ name: raw, excerpt: text.slice(start, end).replace(/\s+/g, " ").trim() });
    if (hits.length >= 8) break;
  }
  return hits;
}

type PronounSet = { subject: string[]; object: string[]; possessive: string[] };

function parsePronounSet(pronouns: string): PronounSet | null {
  const p = pronouns.toLowerCase().replace(/\s+/g, "");
  if (!p) return null;
  if (p.includes("he/") || p === "he" || p.startsWith("he,")) {
    return { subject: ["he"], object: ["him"], possessive: ["his"] };
  }
  if (p.includes("she/") || p === "she" || p.startsWith("she,")) {
    return { subject: ["she"], object: ["her"], possessive: ["her", "hers"] };
  }
  if (p.includes("they/") || p === "they" || p.startsWith("they,")) {
    return { subject: ["they"], object: ["them"], possessive: ["their", "theirs"] };
  }
  return null;
}

function conflictingPronounHits(text: string, expected: PronounSet): string[] {
  const banned: string[] = [];
  if (expected.subject.includes("he")) banned.push("she", "her", "hers");
  if (expected.subject.includes("she")) banned.push("he", "him", "his");
  // they: don't ban he/she aggressively (mixed reports)
  if (expected.subject.includes("they")) return [];

  const found: string[] = [];
  for (const b of banned) {
    const re = new RegExp(`\\b${b}\\b`, "i");
    if (re.test(text)) found.push(b);
  }
  return found;
}

function modalityClaims(text: string): { inClinic: boolean; virtual: boolean } {
  const t = text.toLowerCase();
  return {
    inClinic: /\bin[-\s]?clinic\b/.test(t) || /\bin\s+person\s+assessment\b/.test(t),
    virtual:
      /\bvirtual\b/.test(t) ||
      /\btelehealth\b/.test(t) ||
      /\bsecure\s+video\b/.test(t) ||
      /\bvideo\s+assessment\b/.test(t),
  };
}

function finding(
  runId: string,
  partial: Omit<ReviewFinding, "id" | "runId" | "status" | "decidedAt" | "source"> & {
    source?: ReviewFinding["source"];
  }
): ReviewFinding {
  return {
    id: newReviewId("find"),
    runId,
    source: partial.source ?? "deterministic",
    kind: partial.kind,
    severity: partial.severity,
    sectionId: partial.sectionId,
    title: partial.title,
    detail: partial.detail,
    evidenceExcerpt: partial.evidenceExcerpt,
    suggestedEdit: partial.suggestedEdit,
    applyHint: partial.applyHint ?? null,
    status: "open",
    decidedAt: null,
  };
}

export function runDeterministicReview(input: DeterministicReviewInput): ReviewFinding[] {
  const out: ReviewFinding[] = [];
  const byId = sectionMap(input.sections);
  const allowed = allowedFirstNames(input);
  const clientFirst = clientFirstName(input.clientName).trim();
  const proseSections: ReviewSectionId[] = [
    "presenting-concerns",
    "clinical-formulation",
    "functional-impact",
    "recommendations",
    "collateral",
    "criterion-A1",
    "criterion-A2",
    "criterion-A3",
    "criterion-B1",
    "criterion-B2",
    "criterion-B3",
    "criterion-B4",
    "criterion-C",
    "criterion-D",
    "criterion-E",
  ];

  // --- Foreign / wrong names ---
  for (const sid of proseSections) {
    const text = byId.get(sid)?.trim() ?? "";
    if (!text) continue;
    for (const hit of findForeignNameHits(text, allowed)) {
      out.push(
        finding(input.runId, {
          kind: "name_mismatch",
          severity: "blocking",
          sectionId: sid,
          title: `Possible wrong name: “${hit.name}”`,
          detail: `“${hit.name}” does not match client/parent demographics${
            clientFirst ? ` (client first name: ${clientFirst})` : ""
          }. Remove or replace with the locked client name.`,
          evidenceExcerpt: hit.excerpt,
          suggestedEdit: clientFirst
            ? `Replace “${hit.name}” with “${clientFirst}” only if it refers to the client; otherwise remove the foreign name.`
            : `Remove the foreign name “${hit.name}” or align it to demographics.`,
          applyHint:
            clientFirst && HIGH_RISK_FOREIGN_NAMES.includes(hit.name.toLowerCase())
              ? {
                  mode: "replace_all_in_section",
                  find: hit.name,
                  replace: clientFirst,
                }
              : null,
        })
      );
    }
  }

  // --- Pronouns ---
  const expected = parsePronounSet(input.pronouns);
  if (expected) {
    for (const sid of ["clinical-formulation", "presenting-concerns", "functional-impact"] as ReviewSectionId[]) {
      const text = byId.get(sid)?.trim() ?? "";
      if (!text) continue;
      const conflicts = conflictingPronounHits(text, expected);
      if (!conflicts.length) continue;
      const bad = conflicts[0];
      const good = expected.subject[0];
      out.push(
        finding(input.runId, {
          kind: "pronoun_mismatch",
          severity: "blocking",
          sectionId: sid,
          title: `Pronoun conflict (“${bad}” vs demographics)`,
          detail: `Demographics pronouns are “${input.pronouns.trim()}”, but this section uses “${bad}”.`,
          evidenceExcerpt: (() => {
            const re = new RegExp(`.{0,40}\\b${bad}\\b.{0,40}`, "i");
            const m = text.match(re);
            return m ? m[0].replace(/\s+/g, " ").trim() : null;
          })(),
          suggestedEdit: `Align pronouns to ${input.pronouns.trim()} (e.g. use “${good}”).`,
          applyHint: {
            mode: "replace_all_in_section",
            find: bad,
            replace: good === "he" ? (bad === "she" ? "he" : bad === "her" ? "him" : bad === "hers" ? "his" : good) : good === "she" ? (bad === "he" ? "she" : bad === "him" ? "her" : bad === "his" ? "her" : good) : good,
          },
        })
      );
    }
  }

  // --- Level / conclusion vs formulation opening ---
  const formulation = byId.get("clinical-formulation")?.trim() ?? "";
  if (formulation && input.expectedFormulationOpening.trim()) {
    const opening = firstSentence(formulation);
    const expectedOpen = input.expectedFormulationOpening.trim();
    const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();
    const openingNorm = norm(opening);
    const expectedNorm = norm(expectedOpen);

    if (input.diagnosticConclusion === "meets") {
      if (/does not meet|do not meet|insufficient evidence to confirm/i.test(opening)) {
        out.push(
          finding(input.runId, {
            kind: "level_ab_vs_opening",
            severity: "blocking",
            sectionId: "clinical-formulation",
            title: "Formulation opening conflicts with diagnostic conclusion",
            detail: "Conclusion is meets, but the formulation opening reads as does-not-meet / inconclusive.",
            evidenceExcerpt: opening.slice(0, 280),
            suggestedEdit: `Replace the opening sentence with the locked opening:\n${expectedOpen}`,
            applyHint: {
              mode: "replace_opening_sentence",
              find: opening,
              replace: expectedOpen,
            },
          })
        );
      }

      if (input.confirmedLevelA != null && input.confirmedLevelB != null) {
        const levelMentions = [...opening.matchAll(/Level\s*([123])/gi)].map((x) => Number(x[1]));
        const unexpected = levelMentions.filter(
          (n) => n !== input.confirmedLevelA && n !== input.confirmedLevelB
        );
        // Also check body for conflicting "Level X" after opening if opening matches
        const body = formulation.slice(opening.length);
        const bodyUnexpected = [...body.matchAll(/Level\s*([123])/gi)]
          .map((x) => Number(x[1]))
          .filter((n) => n !== input.confirmedLevelA && n !== input.confirmedLevelB);

        if (unexpected.length || (openingNorm !== expectedNorm && levelMentions.length && unexpected.length)) {
          out.push(
            finding(input.runId, {
              kind: "level_ab_vs_opening",
              severity: "blocking",
              sectionId: "clinical-formulation",
              title: "Severity levels in opening differ from confirmed levels",
              detail: `Confirmed Level A ${input.confirmedLevelA} / Level B ${input.confirmedLevelB}, but opening states different Level value(s).`,
              evidenceExcerpt: opening.slice(0, 280),
              suggestedEdit: `Use the locked opening:\n${expectedOpen}`,
              applyHint: {
                mode: "replace_opening_sentence",
                find: opening,
                replace: expectedOpen,
              },
            })
          );
        } else if (bodyUnexpected.length) {
          out.push(
            finding(input.runId, {
              kind: "level_ab_vs_opening",
              severity: "major",
              sectionId: "clinical-formulation",
              title: "Severity Level restated differently after locked opening",
              detail: `Confirmed levels are A${input.confirmedLevelA}/B${input.confirmedLevelB}. Later formulation prose mentions other Level value(s). Remove or align those mentions.`,
              evidenceExcerpt: (() => {
                const m = body.match(/Level\s*[123].{0,80}/i);
                return m ? m[0] : null;
              })(),
              suggestedEdit:
                "Delete severity Level language after the opening sentence, or ensure it matches confirmed Level A/B only.",
              applyHint: null,
            })
          );
        } else if (expectedNorm && openingNorm && !openingNorm.includes(expectedNorm.slice(0, 48))) {
          // Soft: opening doesn't start like locked opening
          if (
            input.confirmedLevelA != null &&
            !new RegExp(`Level\\s*${input.confirmedLevelA}`, "i").test(opening) &&
            /meets DSM-5-TR criteria for Autism/i.test(opening)
          ) {
            out.push(
              finding(input.runId, {
                kind: "level_ab_vs_opening",
                severity: "blocking",
                sectionId: "clinical-formulation",
                title: "Formulation opening does not match locked severity wording",
                detail: "Opening does not align with the locked formulation opening for confirmed levels.",
                evidenceExcerpt: opening.slice(0, 280),
                suggestedEdit: `Replace opening with:\n${expectedOpen}`,
                applyHint: {
                  mode: "replace_opening_sentence",
                  find: opening,
                  replace: expectedOpen,
                },
              })
            );
          }
        }
      }
    }

    if (input.diagnosticConclusion === "does_not_meet") {
      if (/meets DSM-5-TR criteria for Autism Spectrum Disorder/i.test(opening) && !/does not meet/i.test(opening)) {
        out.push(
          finding(input.runId, {
            kind: "level_ab_vs_opening",
            severity: "blocking",
            sectionId: "clinical-formulation",
            title: "Formulation opening conflicts with does-not-meet conclusion",
            detail: "Diagnostic conclusion is does_not_meet, but formulation opening states the client meets criteria.",
            evidenceExcerpt: opening.slice(0, 280),
            suggestedEdit: `Replace the opening sentence with the locked opening:\n${expectedOpen}`,
            applyHint: {
              mode: "replace_opening_sentence",
              find: opening,
              replace: expectedOpen,
            },
          })
        );
      }
    }
  }

  // --- Modality ---
  if (input.assessmentModality === "in-clinic" || input.assessmentModality === "virtual") {
    for (const sid of ["clinical-formulation", "presenting-concerns", "recommendations"] as ReviewSectionId[]) {
      const text = byId.get(sid)?.trim() ?? "";
      if (!text) continue;
      const claims = modalityClaims(text);
      if (input.assessmentModality === "in-clinic" && claims.virtual && !claims.inClinic) {
        out.push(
          finding(input.runId, {
            kind: "modality_mismatch",
            severity: "blocking",
            sectionId: sid,
            title: "Virtual/telehealth language vs in-clinic modality",
            detail: "Demographics modality is in-clinic, but this section describes a virtual/telehealth assessment.",
            evidenceExcerpt: (() => {
              const m = text.match(/.{0,40}\b(virtual|telehealth|secure video)\b.{0,40}/i);
              return m ? m[0].replace(/\s+/g, " ").trim() : null;
            })(),
            suggestedEdit: "Align modality language to in-clinic, or correct demographics modality.",
            applyHint: null,
          })
        );
      }
      if (input.assessmentModality === "virtual" && claims.inClinic && !claims.virtual) {
        out.push(
          finding(input.runId, {
            kind: "modality_mismatch",
            severity: "blocking",
            sectionId: sid,
            title: "In-clinic language vs virtual modality",
            detail: "Demographics modality is virtual, but this section describes an in-clinic assessment.",
            evidenceExcerpt: (() => {
              const m = text.match(/.{0,40}\bin[-\s]?clinic\b.{0,40}/i);
              return m ? m[0].replace(/\s+/g, " ").trim() : null;
            })(),
            suggestedEdit: "Align modality language to virtual care, or correct demographics modality.",
            applyHint: null,
          })
        );
      }
    }

    if (input.assessmentModality === "virtual") {
      const recs = byId.get("recommendations")?.trim() ?? "";
      if (recs && !/in-person/i.test(recs)) {
        out.push(
          finding(input.runId, {
            kind: "modality_mismatch",
            severity: "major",
            sectionId: "recommendations",
            title: "Virtual assessment missing in-person review language",
            detail:
              "Modality is virtual, but recommendations do not mention in-person review (expected for telehealth confidence).",
            evidenceExcerpt: recs.slice(0, 180),
            suggestedEdit:
              "Add in-person medical/consensus review language to the primary recommendation without inventing new clinical content.",
            applyHint: null,
          })
        );
      }
    }
  }

  return out;
}
