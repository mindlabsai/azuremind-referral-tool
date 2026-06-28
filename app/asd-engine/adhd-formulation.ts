// ADHD formulation assembler.
// Compiles the outputs of the ADHD module components into a structured brief and a
// generation prompt. It NEVER concludes; it assembles what the clinician determined
// (DIVA-derived presentation, differential results, mental-health screen, channels)
// plus the clinician's stated framing. The integrated ASD+ADHD variant must SYNTHESISE
// the interaction between conditions in THIS child, not concatenate two formulations.

export type AdhdFormulationBrief = {
  childName: string;
  ageYears: number;
  divaState: "positive" | "negative" | "not-administered";
  presentation: string | null;
  severityStated: string | null;
  asdDifferentialBlock: string;
  asdActive: boolean;
  channelSummaries: string[];
  riskPresent: boolean;
  mentalHealthFraming: string | null;
  clinicianStatedFraming: string;
};

const VOICE_RULES =
  "Write in Australian English, DSM-5-TR aligned clinical prose, AHPRA-defensible. " +
  "No em dashes or en dashes. No asterisks. Tight, professional register. " +
  "Use the child's first name. Do not reach any diagnostic conclusion the clinician " +
  "has not stated. Preliminary findings are framed as preliminary and as warranting " +
  "ratification, never as confirmed diagnoses.";

export function buildFormulationPrompt(brief: AdhdFormulationBrief): string {
  const mode = brief.asdActive ? "INTEGRATED ASD + ADHD" : "ADHD";

  const adhdLine =
    brief.divaState === "positive" && brief.presentation
      ? `ADHD: affirmed by the clinician on DIVA-5. Presentation: ${brief.presentation}.` +
        (brief.severityStated ? ` Clinician-stated severity: ${brief.severityStated}.` : "")
      : brief.divaState === "negative"
        ? "ADHD: DIVA-5 administered, criteria not met. ADHD is not affirmed; compile the differential."
        : "ADHD: DIVA-5 not administered. ADHD is HELD OPEN and must not be affirmed; set out what is driving the hold.";

  const mh =
    brief.riskPresent
      ? "RISK: disclosed self-directed risk is present. It must be surfaced prominently and addressed ahead of the diagnostic discussion."
      : brief.mentalHealthFraming
        ? `Mental health (clinician's framing, use verbatim in meaning): ${brief.mentalHealthFraming}`
        : "";

  const synthesisInstruction = brief.asdActive
    ? "This is an INTEGRATED formulation. Do NOT write two separate formulations and join them. " +
      "Write ONE clinical opinion that NAMES THE INTERACTION between the ASD and ADHD presentations " +
      "in this specific child: how the attentional profile and the autistic profile compound or shape " +
      "each other here, and how the combined picture changes the support needs versus either alone."
    : "Write a single coherent ADHD formulation.";

  return [
    `Write the clinical formulation for ${brief.childName} (age ${brief.ageYears}). Mode: ${mode}.`,
    VOICE_RULES,
    "",
    "SOURCE OF TRUTH (compile from these; do not add determinations of your own):",
    `- ${adhdLine}`,
    `- ASD differential: ${brief.asdDifferentialBlock}`,
    ...(brief.channelSummaries.length ? [`- Other differentials: ${brief.channelSummaries.join(" ")}`] : []),
    ...(mh ? [`- ${mh}`] : []),
    `- Clinician's stated framing (authoritative): ${brief.clinicianStatedFraming}`,
    "",
    synthesisInstruction,
    "",
    "Produce the formulation prose only. No headings, no preamble.",
  ].join("\n");
}
