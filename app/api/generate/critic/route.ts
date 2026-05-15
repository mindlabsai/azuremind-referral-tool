import { NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { NICHE_CLINICAL_CRITIC_SYSTEM_PROMPT } from "@/lib/voice/critic-system-prompt";

export const runtime = "nodejs";
export const maxDuration = 60;

const CRITIC_MODEL = "claude-opus-4-7";
const CRITIC_MAX_TOKENS = 4096;
/** Target 0.4 when the model supports `temperature`; omitted for Opus 4.7 (API rejects deprecated param). */

const SECTION_PURPOSE: Record<string, string> = {
  formulation: "Clinical formulation and consensus opinion — diagnostic synthesis for multidisciplinary readers.",
  "functional-impact": "Functional impact summary — consequences across home, education, and community settings.",
  recommendations: "Recommendations — actionable next steps for family, school, and clinical team.",
  "criterion-narrative": "DSM-5-TR criterion narrative — evidence synthesis for a single criterion subdomain.",
  "presenting-concerns": "Presenting concerns — reason for referral and presenting picture.",
  collateral: "Collateral summary — integrated third-party report content.",
  background: "Background subsection — developmental or historical clinical context.",
};

type CriticCaseContext = {
  patientDetails?: Record<string, unknown>;
  rawNotes?: Record<string, unknown> | string;
  diagnosticConclusion?: string;
  ratingsAssigned?: Record<string, unknown>;
};

type CriticRequestBody = {
  sectionType?: string;
  draftContent?: string;
  caseContext?: CriticCaseContext;
};

type CriticResponseBody = {
  rewrittenContent: string;
  modelUsed: string;
  criticPassed: boolean;
  fallbackToDraft: boolean;
  error: string | null;
};

function formatCaseContextBlock(caseContext: CriticCaseContext | undefined): string {
  const patientDetails = caseContext?.patientDetails ?? {};
  const rawNotes = caseContext?.rawNotes ?? {};
  const diagnosticConclusion = caseContext?.diagnosticConclusion ?? "[not provided]";
  const ratingsAssigned = caseContext?.ratingsAssigned ?? {};

  const rawNotesText =
    typeof rawNotes === "string"
      ? rawNotes
      : JSON.stringify(rawNotes, null, 2);

  return `## Case context (for specificity restoration and conclusion preservation)

Patient details:
${JSON.stringify(patientDetails, null, 2)}

Raw notes (restore session-specific detail from here only — do not invent):
${rawNotesText}

Diagnostic conclusion (preserve exactly in rewrite):
${diagnosticConclusion}

Ratings assigned (preserve exactly in rewrite):
${JSON.stringify(ratingsAssigned, null, 2)}`;
}

function buildCriticUserMessage(
  sectionType: string,
  draftContent: string,
  caseContext: CriticCaseContext | undefined
): string {
  const purpose =
    SECTION_PURPOSE[sectionType] ??
    `Clinical report section: ${sectionType}. Rewrite for senior neurodevelopmental assessment voice.`;

  return `# Section to rewrite

Section type: ${sectionType}
Clinical purpose: ${purpose}

${formatCaseContextBlock(caseContext)}

---

## Draft content (rewrite this section only)

<<<DRAFT_START>>>
${draftContent}
<<<DRAFT_END>>>

Rewrite the draft per your system instructions. Return only the rewritten prose.`;
}

function fallbackResponse(
  draftContent: string,
  error: string,
  modelUsed: string = CRITIC_MODEL
): CriticResponseBody {
  console.error(`[Texlex Critic] ${error}`);
  return {
    rewrittenContent: draftContent,
    modelUsed,
    criticPassed: false,
    fallbackToDraft: true,
    error,
  };
}

function okResponse(rewrittenContent: string): CriticResponseBody {
  return {
    rewrittenContent,
    modelUsed: CRITIC_MODEL,
    criticPassed: true,
    fallbackToDraft: false,
    error: null,
  };
}

export async function POST(req: NextRequest) {
  let body: CriticRequestBody = {};
  try {
    body = (await req.json()) as CriticRequestBody;
  } catch {
    return Response.json(
      fallbackResponse("", "Critic API call failed: invalid JSON body"),
      { status: 200 }
    );
  }

  const sectionType = typeof body.sectionType === "string" ? body.sectionType.trim() : "unknown";
  const draftContent = typeof body.draftContent === "string" ? body.draftContent : "";
  const caseContext = body.caseContext;

  if (!draftContent.trim()) {
    return Response.json(
      fallbackResponse(draftContent, "Critic API call failed: draftContent is required"),
      { status: 200 }
    );
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return Response.json(
      fallbackResponse(draftContent, "Critic API call failed: ANTHROPIC_API_KEY is not configured"),
      { status: 200 }
    );
  }

  const userMessage = buildCriticUserMessage(sectionType, draftContent, caseContext);
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  try {
    const message = await client.messages.create({
      model: CRITIC_MODEL,
      max_tokens: CRITIC_MAX_TOKENS,
      system: NICHE_CLINICAL_CRITIC_SYSTEM_PROMPT,
      messages: [{ role: "user", content: userMessage }],
    });

    const rewrittenContent = message.content
      .filter((block): block is Anthropic.TextBlock => block.type === "text")
      .map((block) => block.text)
      .join("")
      .trim();

    const minLength = Math.floor(draftContent.length * 0.5);
    if (!rewrittenContent || rewrittenContent.length < minLength) {
      return Response.json(
        fallbackResponse(
          draftContent,
          "Critic output suspiciously short, falling back to draft"
        ),
        { status: 200 }
      );
    }

    return Response.json(okResponse(rewrittenContent), { status: 200 });
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    return Response.json(
      fallbackResponse(draftContent, `Critic API call failed: ${reason}`),
      { status: 200 }
    );
  }
}
