import { NextRequest } from "next/server";
import { formatDemographicsLock } from "@/lib/prompts/factual-integrity";
import { reframeCriterionText } from "@/lib/texlex-finalize-review/clinical-alternatives";
import { isUniversalReviewV2Enabled } from "@/lib/texlex-finalize-review/universal/flag";

export const runtime = "nodejs";
export const maxDuration = 60;

type Body = {
  sectionText?: string;
  sourceNotes?: string;
  patientDetails?: {
    clientName?: string;
    pronouns?: string;
    parent1?: string;
    parent2?: string;
    school?: string;
    dob?: string;
    yearLevel?: string;
    assessmentModality?: string;
    assessmentDates?: string[];
    reportDate?: string;
  };
};

export async function POST(req: NextRequest) {
  if (isUniversalReviewV2Enabled()) {
    return Response.json(
      {
        error:
          "Universal Review does not rewrite a section into Clinical observation and Parent report headings.",
      },
      { status: 409 }
    );
  }
  try {
    const body = (await req.json()) as Body;
    const sectionText = typeof body.sectionText === "string" ? body.sectionText : "";
    const pd = body.patientDetails ?? {};
    const modality =
      pd.assessmentModality === "in-clinic" || pd.assessmentModality === "virtual"
        ? pd.assessmentModality
        : undefined;
    const result = await reframeCriterionText({
      sectionText,
      sourceNotes: typeof body.sourceNotes === "string" ? body.sourceNotes : "",
      demographicsLock: formatDemographicsLock({
        clientName: pd.clientName,
        parent1: pd.parent1,
        parent2: pd.parent2,
        pronouns: pd.pronouns,
        dob: pd.dob,
        yearLevel: pd.yearLevel,
        school: pd.school,
        assessmentModality: modality,
        assessmentDate: Array.isArray(pd.assessmentDates)
          ? pd.assessmentDates.filter(Boolean).join(", ")
          : undefined,
        reportDate: typeof pd.reportDate === "string" ? pd.reportDate : undefined,
      }),
    });
    if ("error" in result) {
      return Response.json({ error: result.error }, { status: 422 });
    }
    return Response.json({ revisedText: result.revisedText });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "The observation reframe failed." },
      { status: 500 }
    );
  }
}
