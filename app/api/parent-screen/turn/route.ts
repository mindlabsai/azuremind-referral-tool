import { NextRequest, NextResponse } from "next/server";
import { anthropic, MODELS } from "@/lib/anthropic-client";
import {
  ALL_FACETS,
  ageBandFrom,
  applyUpdates,
  closeFromBeliefs,
  emptyBeliefs,
  fallbackSay,
  inferUpdates,
  isHoldOn,
  pickAsk,
  scoreCard,
  type AskContext,
  type Belief,
  type ChatTurn,
  type Facet,
  type Polarity,
} from "@/lib/parent-a-conversation";
import { decideNext } from "@/lib/parent-conversation-controller";
import { libraryAsks } from "@/lib/parent-a-question-bank";
import { isCrisisTalk } from "@/lib/parent-rest-conversation";
import type { ChildProfile } from "@/lib/parent-a-screen";

export const runtime = "nodejs";
export const maxDuration = 30;

type TurnBody = {
  child: ChildProfile;
  ageYears: number | null;
  beliefs?: Record<string, Belief>;
  turns?: ChatTurn[];
  lastParent?: string;
  interrupted?: boolean;
  start?: boolean;
  seed?: string;
  usedAsks?: Record<string, string[]>;
  askedFacets?: string[];
};

type ExtractJson = {
  updates?: Array<{
    id: string;
    polarity: Polarity;
    frequency?: "always" | "sometimes" | "seldom" | "unknown";
    quote?: string;
    confidence?: number;
  }>;
};

type SayJson = {
  say?: string;
};

function parseJson<T>(raw: string): T | null {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(raw.slice(start, end + 1)) as T;
  } catch {
    return null;
  }
}

function facetList(): string {
  return ALL_FACETS.map((facet) => `${facet.id}: ${facet.listenFor}`).join("\n");
}

function snippet(text: string, max = 160): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  return `${clean.slice(0, max).trim()}…`;
}

async function extractUpdates(
  lastParent: string,
  ageYears: number | null,
  schoolYear: string,
  band: string,
  gender: string
): Promise<ExtractJson["updates"]> {
  if (!process.env.ANTHROPIC_API_KEY || !lastParent) return [];
  const response = await anthropic.messages.create({
    model: MODELS.SONNET,
    max_tokens: 700,
    temperature: 0.2,
    system: `You only extract. You do not ask. You do not diagnose.

Read the parent's words. For every construct they actually spoke to, write a lean.
Leave a construct out if they did not speak to it. Do not guess. Do not fill holes.

polarity:
- typical = ordinary / other-oriented / flexible / not-that-thing
- asd = the construct is present (on ADHD/worry/rituals/mood that means the adjunct showed, not autism)
- confound = do not count (only the car, only when worried, Google list, adult carried the social load)

frequency only if they said it: always | sometimes | seldom

Split, do not lump:
- Talks a lot about one thing is not the same as asking the same question after it was answered
- Fidget that stops when they like it is attention. A looped flap is body-repeat
- What-if is worry. The plan already changed is sameness
- Wants the invite and freezes is worry. Does not see the point of the group is mates
- Texture is senses. Same brand / same order is sameness

Return JSON only: {"updates":[{"id":"facet_id","polarity":"typical|asd|confound","frequency":"always|sometimes|seldom","quote":"their words","confidence":0.8}]}
Only use ids from the list.`,
    messages: [
      {
        role: "user",
        content: `Child: age ${ageYears ?? "unknown"}, ${schoolYear}, band ${band}, ${gender}.
Constructs:
${facetList()}

parent said:
${lastParent}`,
      },
    ],
  });
  const raw = response.content.map((block) => (block.type === "text" ? block.text : "")).join("");
  const parsed = parseJson<ExtractJson>(raw);
  return parsed?.updates ?? [];
}

async function speakNext(options: {
  lastParent: string;
  facet: Facet;
  library: string[];
  ageYears: number | null;
  schoolYear: string;
  band: string;
  gender: string;
  interrupted: boolean;
}): Promise<string | null> {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  const response = await anthropic.messages.create({
    model: MODELS.SONNET,
    max_tokens: 160,
    temperature: 0.4,
    system: `You are in a parent's kitchen in Australia. They just talked. You heard them.

Speak 5–10 seconds. Two short sentences at most. Under 40 words.
Sentence one: reflect one real thing they said, in their words.
Sentence two: one question about the construct you are given. Only that construct.

Do not sound like a form. Do not say always / sometimes / seldom unless they already spoke that way.
Do not say “you previously indicated”. Do not list options. Do not diagnose.
No A1, DSM, criterion, ADHD-as-a-label.
Stay in this child's world. Kindy is not Roblox. Year 10 is not a stick.
Use the same pronouns as the library lines. Do not switch gender.
The library is tone, not a script. Do not invent a new construct.
If they talked over you, four words then the question.`,
    messages: [
      {
        role: "user",
        content: `Child: age ${options.ageYears ?? "unknown"}, ${options.schoolYear}, band ${options.band}, ${options.gender}.
Interrupted: ${options.interrupted ? "yes" : "no"}
They said: “${snippet(options.lastParent)}”
Ask only this: ${options.facet.id} — ${options.facet.listenFor}
Tone library:
${options.library.map((line) => `- ${line}`).join("\n") || "(none)"}

Return JSON only: {"say":"spoken line"}`,
      },
    ],
  });
  const raw = response.content.map((block) => (block.type === "text" ? block.text : "")).join("");
  const parsed = parseJson<SayJson>(raw);
  const say = parsed?.say?.trim();
  if (!say) return null;
  const words = say.split(/\s+/).length;
  if (words > 55) return `${say.split(/(?<=[.?!])\s+/).slice(0, 2).join(" ")}`;
  return say;
}

export async function POST(req: NextRequest) {
  const body = (await req.json()) as TurnBody;
  const child = body.child;
  const ageYears = body.ageYears ?? null;
  let beliefs = body.beliefs && Object.keys(body.beliefs).length ? body.beliefs : emptyBeliefs();
  const lastParent = (body.lastParent ?? "").trim();
  const holdOn = isHoldOn(lastParent);
  const seed = body.seed || "default";
  const usedAsks = body.usedAsks ?? {};
  const ctx: AskContext = {
    ageYears,
    schoolYear: child.schoolYear,
    gender: child.gender,
  };
  const band = ageBandFrom(ageYears, child.schoolYear);

  if (body.start && (body.turns?.length ?? 0) === 0) {
    const say = `I won’t ask their name. What made you start wondering about ${
      child.gender === "girl" ? "your daughter" : child.gender === "boy" ? "your son" : "your child"
    }?`;
    return NextResponse.json({
      say,
      beliefs,
      close: null,
      holdOn: false,
      facetId: "open",
      score: scoreCard(beliefs),
      band,
    });
  }

  const before = { ...beliefs };
  beliefs = applyUpdates(beliefs, inferUpdates(lastParent));

  if (holdOn) {
    return NextResponse.json({
      say: "I’ll wait. Talk when you’re ready.",
      beliefs,
      close: null,
      holdOn: true,
      facetId: null,
      score: scoreCard(beliefs),
      band,
    });
  }

  if (isCrisisTalk(lastParent)) {
    return NextResponse.json({
      say: "If they are not safe, stop this and call 000 or Lifeline on 13 11 14. I will not keep going on that here.",
      beliefs,
      close: null,
      holdOn: true,
      facetId: null,
      score: scoreCard(beliefs),
      band,
    });
  }

  try {
    const extracted = await extractUpdates(lastParent, ageYears, child.schoolYear, band, child.gender);
    if (extracted?.length) {
      beliefs = applyUpdates(
        beliefs,
        extracted
          .filter((update) => ALL_FACETS.some((facet) => facet.id === update.id))
          .map((update) => ({ ...update, quote: update.quote ?? lastParent.slice(0, 180) }))
      );
    }
  } catch {
    // markers already applied
  }

  const decision = decideNext(before, beliefs, body.askedFacets ?? []);
  beliefs = decision.beliefs;
  const close = closeFromBeliefs(beliefs);

  if (close && !decision.facet) {
    return NextResponse.json({
      say: `${close.headline} ${close.body}`,
      beliefs,
      close,
      holdOn: false,
      facetId: null,
      score: scoreCard(beliefs),
      band,
      filledThisTurn: decision.filledThisTurn,
    });
  }

  const facet = decision.facet;
  let say = facet
    ? fallbackSay(beliefs, lastParent, false, seed, usedAsks[facet.id] ?? [], ctx)
    : fallbackSay(beliefs, lastParent, false, seed, [], ctx);

  if (facet) {
    try {
      const spoken = await speakNext({
        lastParent,
        facet,
        library: libraryAsks({
          facetId: facet.id,
          ageYears,
          schoolYear: child.schoolYear,
          gender: child.gender,
        }),
        ageYears,
        schoolYear: child.schoolYear,
        band,
        gender: child.gender,
        interrupted: Boolean(body.interrupted),
      });
      if (spoken) say = spoken;
      else say = pickAsk(facet, seed, usedAsks[facet.id] ?? [], ctx);
    } catch {
      say = pickAsk(facet, seed, usedAsks[facet.id] ?? [], ctx);
    }
  }

  return NextResponse.json({
    say,
    beliefs,
    close: close && !decision.facet ? close : null,
    holdOn: false,
    facetId: facet?.id ?? null,
    score: scoreCard(beliefs),
    band,
    filledThisTurn: decision.filledThisTurn,
  });
}
