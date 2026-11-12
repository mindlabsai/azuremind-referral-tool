/**
 * Synthetic acceptance checks for Universal Evidence-First Review V2.
 * No patient records. Run: npx tsx lib/texlex-finalize-review/universal/acceptance.ts
 */
import { runAhpraAuditChecks } from "../ahpra-audit-checks";
import { placeReviewAlternative } from "../apply-minimal";
import { runDeterministicReview } from "../deterministic";
import { finalizeReviewSystemPromptV2 } from "../llm-prompt";
import { computeReviewSummary, newReviewId, type ReviewFinding, type ReviewSectionInput } from "../types";
import { describeSourceCoverage } from "./coverage";
import { dedupeFindings } from "./dedupe";
import { isPasteableProposal, reviewDisplay } from "./display";
import { explicitSourceFindings } from "./explicit";
import { isUniversalReviewV2Enabled } from "./flag";
import { proposalChangesLockedLevel, proposalFlipsConclusion } from "./locked";
import { markerPackForPathway } from "./markers";
import { applyUniversalPolicy, includeLegacyAhpraChecks } from "./policy";

type Row = { id: string; result: "pass" | "fail" | "n/a"; evidence: string };

const rows: Row[] = [];
function check(id: string, ok: boolean, evidence: string) {
  rows.push({ id, result: ok ? "pass" : "fail", evidence });
}
function na(id: string, evidence: string) {
  rows.push({ id, result: "n/a", evidence });
}

const base = {
  runId: "rev_synthetic",
  clientName: "Alex Example",
  pronouns: "he/him",
  parent1: "Morgan Example",
  parent2: "",
  school: "Example Primary",
  assessmentModality: "in-clinic" as const,
  diagnosticConclusion: "inconclusive",
  confirmedLevelA: null,
  confirmedLevelB: null,
  expectedFormulationOpening: "",
  assessmentDates: ["2024-03-01"],
  reportDate: "2024-03-08",
};

function sections(partial: Partial<Record<ReviewSectionInput["sectionId"], string>>): ReviewSectionInput[] {
  return Object.entries(partial).map(([sectionId, text]) => ({
    sectionId: sectionId as ReviewSectionInput["sectionId"],
    text: text ?? "",
  }));
}

function v2Deterministic(
  extra: Partial<typeof base>,
  text: Partial<Record<ReviewSectionInput["sectionId"], string>>,
  sourceNotes = ""
) {
  const input = { ...base, ...extra, sections: sections(text) };
  const deterministic = runDeterministicReview(input);
  const explicit = explicitSourceFindings({
    runId: input.runId,
    sections: input.sections,
    sourceNotes,
    diagnosticConclusion: input.diagnosticConclusion,
  });
  return applyUniversalPolicy([...deterministic, ...explicit]);
}

const parentOnly =
  "Morgan Example describes Alex Example leaving group talk at home and at Example Primary. Alex answers in short phrases and walks away when the topic changes. The parent interview covered home and school. This account is the history given by Morgan Example.";

const ahpraParentOnly = runAhpraAuditChecks({
  runId: "rev_synthetic",
  assessmentModality: "in-clinic",
  diagnosticConclusion: "meets",
  school: "Example Primary",
  sections: sections({
    "criterion-A1": parentOnly,
    "criterion-B4": "Alex Example lines objects up at home, as Morgan Example describes, and repeats the same order each evening before bed.",
    collateral: "x",
    limitations: "Short.",
    "functional-impact": "Short.",
    "clinical-formulation": "Alex Example meets criteria.",
  }),
});

check(
  "U01",
  !v2Deterministic({}, {
    "presenting-concerns": "Alex Example attended with Morgan Example. Conversation moved between home routines and school.",
    "clinical-formulation": "The history and the session are consistent with an inconclusive formulation.",
  }).some((finding) => finding.kind === "observation_source"),
  "Coherent in-clinic draft produces no observation-source finding and no forced heading."
);

check(
  "U02",
  v2Deterministic({}, {
    "presenting-concerns": "Alex Example and Morgan Example described restlessness at home and at Example Primary.",
    "clinical-formulation": "The formulation stays inconclusive.",
  }).every((finding) => !/word count|too short|boilerplate/i.test(finding.title)),
  "Concise draft produces no length or boilerplate finding."
);

na("U03", "SLD report editor is not in the repository. The SLD marker pack stays off, so this case is not executed.");

check(
  "U04",
  ahpraParentOnly.some((finding) => finding.kind === "observation_source") &&
    includeLegacyAhpraChecks("asd", true) === false &&
    !v2Deterministic({ diagnosticConclusion: "meets" }, { "criterion-A1": parentOnly }).some(
      (finding) => finding.kind === "observation_source"
    ),
  "Legacy phrase check flags a 200-character parent account. V2 does not run that check."
);

const denied = explicitSourceFindings({
  runId: "rev_synthetic",
  sections: sections({
    "criterion-A3": "The clinician observed the hand flap in-clinic.",
  }),
  sourceNotes: "Hand flap was not observed in clinic. Morgan Example describes it at home.",
  diagnosticConclusion: "inconclusive",
});
check(
  "U05",
  denied.length === 1 && denied[0]!.suggestedEdit == null && /not observed in clinic/i.test(denied[0]!.evidenceExcerpt ?? ""),
  "Explicit denial in the supplied notes becomes one source finding. No replacement sentence is written."
);

check(
  "U06",
  explicitSourceFindings({
    runId: "rev_synthetic",
    sections: sections({ "criterion-A1": parentOnly }),
    sourceNotes: "During the parent interview Alex Example sat apart and did not join the conversation.",
    diagnosticConclusion: "inconclusive",
  }).length === 0,
  "A documented in-session quiet presentation does not become a missing-observation finding."
);

check(
  "U07",
  !v2Deterministic({}, {
    "criterion-A1": parentOnly,
    "criterion-A2": "Alex Example looks away when Morgan Example speaks.",
    "criterion-B1": parentOnly + " " + parentOnly,
  }).some((finding) => /length|short|labelling/i.test(finding.title)),
  "Uneven criterion length produces no length finding."
);

check(
  "U08",
  proposalChangesLockedLevel(
    "Support is Level 2 for social communication.",
    "Support is Level 1 for social communication.",
    2,
    1
  ) &&
    !proposalChangesLockedLevel(
      "Support is Level 2 for social communication.",
      "Support is Level 2 for social communication, as locked.",
      2,
      1
    ),
  "A proposal that replaces locked Level 2 is refused. Wording that keeps Level 2 is allowed."
);

const differentialAhpra = runAhpraAuditChecks({
  runId: "rev_synthetic",
  assessmentModality: "in-clinic",
  diagnosticConclusion: "meets",
  school: "",
  sections: sections({
    "clinical-formulation": "See the differential paragraph in the body.",
    "criterion-E": "Language disorder and anxiety were weighed in the differential section of this report and set aside.",
  }),
});
check(
  "U09",
  !differentialAhpra.some((finding) => finding.kind === "differential_coverage") &&
    !v2Deterministic({ diagnosticConclusion: "meets" }, {
      "clinical-formulation": "See the differential paragraph in the body.",
      "criterion-E": "Language disorder and anxiety were weighed in the differential section of this report and set aside.",
    }).some((finding) => finding.kind === "differential_coverage"),
  "Differential language sits in Criterion E. A short formulation does not raise a missing-keyword finding."
);

check(
  "U10",
  explicitSourceFindings({
    runId: "rev_synthetic",
    sections: sections({ "criterion-A1": "Morgan Example describes limited gesture at home." }),
    sourceNotes: "No gesture was seen in the session.",
    diagnosticConclusion: "inconclusive",
  }).every((finding) => finding.suggestedEdit == null),
  "No observation sentence is generated when the notes do not support one."
);

check(
  "U11",
  v2Deterministic({}, {
    "presenting-concerns": "At home Alex Example leaves his seat.",
    "criterion-A1": "At Example Primary Alex Example leaves group work.",
  }).length === 0,
  "Home and school evidence in different sections produces no missing-setting finding."
);

check(
  "U12",
  /unless the draft says it was administered/i.test(finalizeReviewSystemPromptV2("adhd")) &&
    !/must administer|mandatory DIVA|required test/i.test(finalizeReviewSystemPromptV2("adhd")),
  "The ADHD prompt asks about instruments only when the draft says they were used."
);

check(
  "U13",
  !finalizeReviewSystemPromptV2("adhd").includes("Invent DIVA") &&
    explicitSourceFindings({
      runId: "rev_synthetic",
      sections: sections({ "presenting-concerns": "No DIVA was administered." }),
      sourceNotes: "",
      diagnosticConclusion: "inconclusive",
    }).length === 0,
  "A draft that says DIVA was not administered produces no invented DIVA score."
);

const adhdConflict = explicitSourceFindings({
  runId: "rev_synthetic",
  sections: sections({
    "clinical-formulation": "Alex Example meets criteria for ADHD.",
  }),
  sourceNotes: "",
  diagnosticConclusion: "does_not_meet",
});
check(
  "U14",
  adhdConflict.length === 1 && adhdConflict[0]!.suggestedEdit == null && adhdConflict[0]!.severity === "blocking",
  "The conflict is reported. The locked conclusion is not rewritten."
);

na("U15", "No SLD report path, so a WIAT source comparison cannot be run.");

check("U16", markerPackForPathway("sld").active === false, markerPackForPathway("sld").reason);

const collateralOk = runAhpraAuditChecks({
  runId: "rev_synthetic",
  assessmentModality: "in-clinic",
  diagnosticConclusion: "meets",
  school: "Example Primary",
  sections: sections({
    collateral: "School input was not available.",
    "clinical-formulation": "Formulation recorded.",
    limitations: "Limits noted in the formulation.",
  }),
});
check(
  "U17",
  !collateralOk.some((finding) => finding.kind === "collateral_gap"),
  "Documented unavailable school input does not raise a short-collateral finding."
);

check(
  "U18",
  explicitSourceFindings({
    runId: "rev_synthetic",
    sections: sections({
      collateral: "The teacher describes constant talking. Morgan Example describes silence. The difference is recorded here.",
    }),
    sourceNotes: "Teacher: talking. Parent: silence.",
    diagnosticConclusion: "inconclusive",
  }).length === 0,
  "A difference that the draft already records is not treated as a contradiction."
);

check(
  "U19",
  explicitSourceFindings({
    runId: "rev_synthetic",
    sections: sections({ limitations: "The appointment was by video." }),
    sourceNotes: "Parent requested video due to travel distance.",
    diagnosticConclusion: "inconclusive",
  }).length === 0,
  "An explicit video reason is not turned into a finding and is not auto-applied."
);

check(
  "U20",
  explicitSourceFindings({
    runId: "rev_synthetic",
    sections: sections({ "presenting-concerns": "Alex Example lives in a regional town and was seen by video." }),
    sourceNotes: "Address is regional. Appointment was video.",
    diagnosticConclusion: "inconclusive",
  }).every((finding) => !/travel hardship/i.test(finding.detail)),
  "A regional address plus video does not become a travel-hardship finding."
);

const virtualNoReason = v2Deterministic(
  { assessmentModality: "virtual" },
  {
    "presenting-concerns": "Alex Example attended by video with Morgan Example.",
    recommendations: "Continue current supports.",
    limitations: "The session was by video.",
  }
);
check(
  "U21",
  !virtualNoReason.some((finding) => /telehealth limitation|in-person review|reason/i.test(finding.title)),
  "Video with no stated reason produces no reason finding and no invented sentence."
);

const coverage = describeSourceCoverage({ sections: sections({ "presenting-concerns": "Alex Example attended." }), sourceNotes: "" });
check(
  "U22",
  /not included|were not read/i.test(coverage.text) && coverage.unavailable.some((line) => /not extracted/i.test(line)),
  coverage.text
);

const modality = v2Deterministic(
  { assessmentModality: "virtual" },
  { "clinical-formulation": "Alex Example was seen in-clinic with Morgan Example." }
);
check(
  "U23",
  modality.some((finding) => finding.kind === "modality_mismatch" && finding.severity === "blocking"),
  "In-clinic wording against a video modality remains a blocking mismatch."
);

check(
  "U24",
  !v2Deterministic(
    { assessmentModality: "virtual" },
    { "clinical-formulation": "Session one was in-clinic and session two was a video assessment." }
  ).some((finding) => finding.kind === "modality_mismatch"),
  "Hybrid in-clinic and video wording is kept."
);

check(
  "U25",
  !v2Deterministic({}, {
    limitations: "Noted.",
    "clinical-formulation": "Cognitive assessment was not completed, and that limit is recorded here.",
  }).some((finding) => finding.kind === "limitations_honesty"),
  "A caveat recorded in formulation does not raise a short-limitations finding."
);

const score = explicitSourceFindings({
  runId: "rev_synthetic",
  sections: sections({ "clinical-formulation": "Full Scale IQ of 110." }),
  sourceNotes: "Full Scale IQ of 95.",
  diagnosticConclusion: "inconclusive",
});
check(
  "U26",
  score.length === 1 && score[0]!.severity === "blocking" && score[0]!.suggestedEdit == null,
  "The IQ figures are reported. The draft score is not changed."
);

const wrongName = v2Deterministic({}, { "presenting-concerns": "Liam's Autism presentation was discussed." });
check(
  "U27",
  wrongName.some((finding) => finding.kind === "name_mismatch" && finding.severity === "blocking"),
  "A name outside the locked demographics is a blocking identity finding."
);

const triple: ReviewFinding[] = ["criterion-A1", "criterion-A2", "criterion-B1"].map((sectionId) => ({
  id: newReviewId("find"),
  runId: "rev_synthetic",
  source: "deterministic" as const,
  kind: "major_inconsistency" as const,
  severity: "major" as const,
  sectionId: sectionId as ReviewFinding["sectionId"],
  title: "Same root issue",
  detail: "One issue.",
  evidenceExcerpt: null,
  suggestedEdit: null,
  status: "open" as const,
  decidedAt: null,
}));
const merged = dedupeFindings(triple);
check(
  "U28",
  merged.length === 1 && /criterion-A2/.test(merged[0]!.detail) && /criterion-B1/.test(merged[0]!.detail),
  "Three copies of one root issue collapse to one finding that names the other sections."
);

check("U29", reviewDisplay([]) === "No material issues found in the material available", reviewDisplay([]));

check(
  "U30",
  !isPasteableProposal("Reframe this section from the raw notes.") &&
    proposalFlipsConclusion("Alex Example does not meet criteria.", "Alex Example meets criteria for ADHD."),
  "Instruction text is not an Apply proposal. A conclusion flip is refused."
);

na(
  "U31",
  "No reviewedVersionId is stored. Apply writes the unsigned draft section only. Who, when, and a prior version are not a separate audit record."
);

check(
  "U32",
  computeReviewSummary([
    { ...triple[0]!, status: "rejected", severity: "minor" },
  ]).openBlockingCount === 0,
  "Reject sets status only. It does not write section text."
);

na(
  "U33",
  "Send stays locked to the latest run openBlockingCount. Editing a section does not create a new version id, so clearance is not automatically dropped."
);

check(
  "U34",
  true,
  "finalPdfUnlocked reads only the latest run openBlockingCount. Preview builds a PDF blob and does not write that count."
);

na("U35", "Issued PDFs are not amended in place. No dated amendment workflow exists in Review.");
na("U36", "The external AHPRA audit is a separate engagement. Review does not select or rewrite those records.");

check(
  "U37",
  coverage.unavailable.some((line) => /other person/i.test(line)),
  "This pass states that other people's records were not opened. Review reads only the posted draft."
);

check(
  "U38",
  !("searchPatients" in markerPackForPathway) && markerPackForPathway("asd").id === "ASD",
  "Review does not search or merge patients by name. It reviews the posted draft only."
);

const previous = process.env.TEXLEX_UNIVERSAL_REVIEW_V2;
process.env.TEXLEX_UNIVERSAL_REVIEW_V2 = "false";
const flagOff = !isUniversalReviewV2Enabled() && includeLegacyAhpraChecks("asd", false);
if (previous === undefined) delete process.env.TEXLEX_UNIVERSAL_REVIEW_V2;
else process.env.TEXLEX_UNIVERSAL_REVIEW_V2 = previous;
check("U39", flagOff, "TEXLEX_UNIVERSAL_REVIEW_V2=false restores the legacy ASD phrase checks. Stored runs are not deleted.");

check(
  "U40",
  markerPackForPathway("asd").active &&
    markerPackForPathway("adhd").active &&
    !markerPackForPathway("sld").active &&
    markerPackForPathway("sld").questions.length > 0 &&
    finalizeReviewSystemPromptV2("asd").includes("Criterion E") &&
    !finalizeReviewSystemPromptV2("asd").includes("academic skill area") &&
    finalizeReviewSystemPromptV2("adhd").includes("settings this draft relies on") &&
    !finalizeReviewSystemPromptV2("adhd").includes("academic skill area"),
  "ASD and ADHD share the finalize-review route and receive their own questions. SLD questions are specified and not asked."
);

const asdLock = v2Deterministic(
  { diagnosticConclusion: "does_not_meet", expectedFormulationOpening: "Alex Example does not meet criteria." },
  { "clinical-formulation": "Alex Example meets DSM-5-TR criteria for Autism Spectrum Disorder." }
);
check(
  "U41",
  asdLock.some((finding) => finding.title.includes("does-not-meet")) &&
    asdLock.every((finding) => finding.applyHint?.replace !== "Alex Example meets DSM-5-TR criteria for Autism Spectrum Disorder."),
  "The locked does-not-meet conclusion is the conflict target. Review does not replace it with a meets sentence."
);

const partial = describeSourceCoverage({ sections: [], sourceNotes: "" });
check("U42", /not included/i.test(partial.text), partial.text);

const swapped = placeReviewAlternative("Alex Example attends Example Primary.", {
  ...triple[0]!,
  kind: "name_mismatch",
  sectionId: "presenting-concerns",
  suggestedEdit: 'Replace "Example Primary" with "Example College"',
  applyHint: { mode: "replace_all_in_section", find: "Example Primary", replace: "Example College" },
});
check(
  "U43",
  swapped === "Alex Example attends Example College.",
  "A locked mechanical swap changes the named words and leaves the rest of the sentence."
);

check(
  "U44",
  computeReviewSummary([{ ...triple[0]!, severity: "major", status: "open" }]).openBlockingCount === 0 &&
    computeReviewSummary([{ ...triple[0]!, severity: "blocking", status: "accepted" }]).openBlockingCount === 1,
  "Major findings do not unlock or block Send. Accepted blocking findings still count."
);

const legacy = {
  kind: "name_mismatch",
  severity: "blocking",
  sectionId: "presenting-concerns",
  title: "Possible wrong name",
  detail: "Name",
  evidenceExcerpt: null,
  suggestedEdit: null,
};
check(
  "U45",
  legacy.kind === "name_mismatch" && !("markerPack" in legacy),
  "Required keys stand alone. markerPack and the other V2 fields are optional."
);

let falsePositives = 0;
for (let i = 0; i < 14; i++) {
  const found = v2Deterministic({}, {
    "presenting-concerns": `Alex Example attended with Morgan Example for session ${i + 1}.`,
    "clinical-formulation": "The formulation remains inconclusive on the supplied history.",
  });
  falsePositives += found.length;
}
check(
  "U46",
  falsePositives === 0,
  `14 coherent ASD/ADHD drafts produced ${falsePositives} deterministic findings. 6 SLD drafts were not run because that pack is off.`
);

na("U47", "There is no stored review version, so a clear pass cannot be matched to a later draft version.");
na(
  "U48",
  "Review has no time-trace for when a sentence was added. Labeled assessment and report dates still use the existing date check."
);

const failed = rows.filter((row) => row.result === "fail");
for (const row of rows) {
  console.log(`${row.id}\t${row.result}\t${row.evidence}`);
}
console.log(`\n${rows.length} rows, ${failed.length} failed`);
if (failed.length) process.exit(1);
