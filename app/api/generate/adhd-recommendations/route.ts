import { NextRequest } from "next/server";
import { anthropic, MODELS } from "@/lib/anthropic-client";
import {
  expandRecommendations,
  formatExpandedRecommendations,
  KNOWN_RECOMMENDATION_SHORTHAND_KEYS,
  parseRecommendationShorthand,
} from "@/app/asd-engine/adhd-recommendations";

export const runtime = "nodejs";
export const maxDuration = 120;

const EXTRACT_MAX_TOKENS = 1024;

type AdhdRecommendationsRequestBody = {
  rawNotes?: string;
  ageYears?: number;
  clientName?: string;
  chronologicalAge?: string;
  yearLevel?: string;
  school?: string;
};

function parseShorthandJson(raw: string): string[] {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = (fenced?.[1] ?? trimmed).trim();
  const start = candidate.indexOf("[");
  const end = candidate.lastIndexOf("]");
  if (start === -1 || end === -1 || end <= start) {
    // Fallback: treat model output as comma/line shorthand
    return parseRecommendationShorthand(candidate.replace(/^json\s*/i, ""));
  }
  const parsed = JSON.parse(candidate.slice(start, end + 1)) as unknown;
  if (!Array.isArray(parsed)) return [];
  return parsed
    .filter((item): item is string => typeof item === "string")
    .map((s) => s.trim())
    .filter(Boolean);
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as AdhdRecommendationsRequestBody;
    const rawNotes = typeof body.rawNotes === "string" ? body.rawNotes.trim() : "";
    if (rawNotes.length < 20) {
      return Response.json(
        { error: "Raw clinical notes required (minimum 20 characters)" },
        { status: 400 }
      );
    }

    const ageYears =
      typeof body.ageYears === "number" && Number.isFinite(body.ageYears)
        ? Math.max(0, Math.round(body.ageYears))
        : 8;

    if (!process.env.ANTHROPIC_API_KEY) {
      return Response.json({ error: "ANTHROPIC_API_KEY is not configured" }, { status: 500 });
    }

    const knownKeys = KNOWN_RECOMMENDATION_SHORTHAND_KEYS.join("\n- ");
    const system = `You extract ADHD report recommendation shorthand from raw clinical notes.

Rules:
- Return ONLY a JSON array of strings. No prose, no markdown fences unless necessary.
- Prefer these exact known shorthand keys when the notes support them:
- ${knownKeys}
- You may include a free-text item only when the notes clearly support a recommendation that has no matching known key.
- Include an item only when the notes evidence that need or plan. Do not invent referrals, school hours, medication, NDIS, or review timelines.
- Preserve clinical priority order from the notes when possible.
- If nothing is evidenced, return [].
- Do not expand into full recommendation paragraphs — shorthand items only.`;

    const user = `Client: ${body.clientName?.trim() || "[not provided]"}
Chronological age: ${body.chronologicalAge?.trim() || "[not specified]"}
Age years (for context): ${ageYears}
Year level: ${body.yearLevel?.trim() || "[not specified]"}
School: ${body.school?.trim() || "[not specified]"}

# RAW CLINICAL NOTES

${rawNotes}

# TASK

Return a JSON array of recommendation shorthand items evidenced by the notes.`;

    const message = await anthropic.messages.create({
      model: MODELS.SONNET,
      max_tokens: EXTRACT_MAX_TOKENS,
      system,
      messages: [{ role: "user", content: user }],
    });

    const textBlock = message.content.find((b) => b.type === "text");
    const modelText = textBlock && textBlock.type === "text" ? textBlock.text : "";
    const shorthand = parseShorthandJson(modelText);

    if (!shorthand.length) {
      return Response.json(
        {
          error:
            "No recommendations evidenced in the raw notes. Add clinical recommendations to the notes, or enter shorthand manually and expand.",
          shorthand: [],
          text: "",
        },
        { status: 422 }
      );
    }

    const items = expandRecommendations({ shorthand, ageYears });
    const text = formatExpandedRecommendations(items);

    return Response.json({ shorthand, items, text });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return Response.json({ error: message }, { status: 500 });
  }
}
