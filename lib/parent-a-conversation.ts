/**
 * Parent voice belief tree. A is the gate. B–E and the adjuncts run after.
 * The parent never hears DSM codes. We do not diagnose.
 */

import type { ChildProfile } from "./parent-a-screen";
import { pickBankAsk, pickOpeningAsk, ageBandFrom } from "./parent-a-question-bank";
import {
  REST_FACETS,
  REST_RULES,
  inferRestUpdates,
  isCrisisTalk,
  restScoreLines,
  scoreB,
  scoreRestDomain,
} from "./parent-rest-conversation";

export type Polarity = "typical" | "asd" | "confound" | "unknown";
export type Frequency = "always" | "sometimes" | "seldom" | "unknown";
export type Domain =
  | "A1"
  | "A2"
  | "A3"
  | "B1"
  | "B2"
  | "B3"
  | "B4"
  | "C"
  | "D"
  | "E"
  | "ADHD"
  | "ANX"
  | "OCD"
  | "DEP";
export type DomainVerdict = "supported" | "not_met" | "abstain" | "unasked";

export type Facet = {
  id: string;
  domain: Domain;
  title: string;
  listenFor: string;
  asks: string[];
};

export type Belief = {
  polarity: Polarity;
  frequency: Frequency;
  confidence: number;
  quote: string;
};

export type ChatTurn = {
  role: "assistant" | "parent";
  text: string;
  interrupted?: boolean;
};

export type ConversationState = {
  child: ChildProfile;
  ageYears: number | null;
  beliefs: Record<string, Belief>;
  turns: ChatTurn[];
};

export const A_FACETS: Facet[] = [
  {
    id: "approach_reason",
    domain: "A1",
    title: "Why they come over",
    listenFor: "most common reason they come up to talk — want/fix vs tell/show/cuddle vs never",
    asks: [
      "When they come up to you at home — kitchen, couch, your door — what’s the most common reason? Want something, want you to fix something, or tell you something they don’t need you to do anything about?",
      "Picture them walking into the room. Most weeks, why are they coming? Something they want, something broken, or just to tell you a thing?",
      "If you think of the last few times they started talking to you at home, what were they after — a thing, a fix, or just you hearing it?",
    ],
  },
  {
    id: "parent_available",
    domain: "A1",
    title: "Are you actually free",
    listenFor: "is the parent free to chat most days, or do talks only happen at set times — car, dinner, bedtime, after school",
    asks: [
      "Are you actually around for a chat most days, or do the talks only happen at the usual times — the car, dinner, bedtime?",
      "When you’re home, can they catch you, or is chat only when you’re stuck with them — car, table, bed?",
      "Be honest — are you free enough that they could start a chat on a random arvo, or does it only happen at those set times?",
    ],
  },
  {
    id: "greet_spontaneous",
    domain: "A1",
    title: "Hello on their own",
    listenFor: "when little, did they say hi/wave to Nan, Pop, neighbour, gate parent without being told",
    asks: [
      "When they were little — kindy, pre-primary — if Nan or a neighbour walked in, did they say hello on their own, or only if you said say hello?",
      "Think of Nan or Pop at the door when they were younger. Did they pipe up with hi or a wave, or did you have to tell them?",
      "At the kindy gate, another parent walks up. Did yours start hello, or wait for you to say say hi?",
    ],
  },
  {
    id: "greet_frequency",
    domain: "A1",
    title: "How often they start hello",
    listenFor: "hello on their own — always, sometimes, or seldom",
    asks: [
      "When that happens — always, sometimes, or only now and then?",
      "How often is that true? Most times, some of the time, or hardly ever?",
      "If you had to pick — always, sometimes, or seldom?",
    ],
  },
  {
    id: "greet_pervasive",
    domain: "A1",
    title: "Hello in other places",
    listenFor: "do they need prompting to say hello in other places too — shops, sport, school gate, other adults — or only at home",
    asks: [
      "Have you seen the same thing in other places? Shops, sport, the school gate, someone else’s house — do you still have to say say hello, or is it just at home?",
      "What about the shops or sport? Do you still prompt hello there, or was that only at home with Nan?",
      "Is the prompting just your house, or does it follow them — school gate, oval, someone else’s kitchen?",
    ],
  },
  {
    id: "greet_as_start",
    domain: "A1",
    title: "Hello as the start",
    listenFor: "did they pick up that you start with hello then talk, or still walk up and start on the want",
    asks: [
      "Most kids just get that you start with hello, then you talk. Did yours pick that up on their own, or do they still walk up and start on what they want?",
      "When they come up to someone now, do they start with hi, or go straight to the thing they want?",
      "Did saying hello ever become the natural first step, or is it still you teaching it?",
    ],
  },
  {
    id: "topic_repeat",
    domain: "A1",
    title: "Same topic, same question",
    listenFor: "talk one topic in depth, and/or ask the same question over and over after it has already been answered",
    asks: [
      "Do they get on one thing and stay there — and do they ask you the same question again even after you’ve already answered it?",
      "Have they got a topic they can stay on for ages? And do they ask the same question again after you’ve already given the answer?",
      "If you already answered something, will they still come back with the same question, like it didn’t land?",
    ],
  },
  {
    id: "after_demand",
    domain: "A1",
    title: "After they get it",
    listenFor: "once they have the snack/iPad/fix, do they stay and talk or is that the end",
    asks: [
      "Once they have what they came for — the snack, the iPad, the thing you fixed — do they stay and talk a bit, or is that the end?",
      "You give them the thing. You’re still there. Do they keep talking, or have you disappeared?",
      "After the ask is sorted, is there any chat left that isn’t another ask?",
    ],
  },
  {
    id: "show_to_share",
    domain: "A1",
    title: "Look vs open this",
    listenFor: "when little, stick/drawing/bug — brought to show or to get opened",
    asks: [
      "When they were little, if they found a stick or a drawing or something on the iPad, did they bring it to show you, or so you’d open it or fix it?",
      "A drawing, a bug, a video — was that look, or open this?",
      "Did they ever bring you something just so you’d see it, not so you’d do something with it?",
    ],
  },
  {
    id: "other_oriented",
    domain: "A1",
    title: "Coming back to you",
    listenFor: "if you talk first about your day, do they come back to you or only their thing",
    asks: [
      "If you don’t ask how was school — you just say something about your day — do they come back to what you said, or does it stay on their thing?",
      "You say work was a circus. Do they pick that up, or do they keep going on their game?",
      "When you talk first, not about them — do you get a question or a comment back?",
    ],
  },
  {
    id: "pickup_confound",
    domain: "A1",
    title: "After school",
    listenFor: "fine at the gate is normal; later that arvo do they still come for something that isn’t an ask",
    asks: [
      "After school a lot of kids say fine and go to their room. That’s normal here. Later that arvo, do they still come to tell you something, or only if they want something?",
      "Pickup can be a grunt. Later, food, couch — do they still start something that isn’t an ask?",
      "Not wanting to recap school doesn’t count. After they’ve eaten, do they come to you as a person?",
    ],
  },
  {
    id: "request_gaze",
    domain: "A2",
    title: "Your face when they need you",
    listenFor: "jar/zip/login — look at you / hold it up vs put your hand on it",
    asks: [
      "When they want a jar or a zip they can’t do, do they look at you and hold it up, or put your hand on it?",
      "They can’t open something. Do they find your face, or grab your wrist?",
      "If they need you for a thing — lid, login, zip — is your face in it, or only your hand?",
    ],
  },
  {
    id: "read_affect",
    domain: "A2",
    title: "Reading you’re done",
    listenFor: "can they tell you’re annoyed or done from your face without the words",
    asks: [
      "Can they tell you’re done or annoyed without you saying it? A look, or do you have to say the words?",
      "Your face says we’re leaving. Do they read that, or do you have to say it?",
      "If you don’t use words, can they tell you’re over it?",
    ],
  },
  {
    id: "point_share",
    domain: "A2",
    title: "Look at that",
    listenFor: "pointing/showing ever just look, or only I want",
    asks: [
      "When they point or show you something, is it ever just look at that — or only I want that?",
      "A plane, a dog, a video — do they ever show you just to share it?",
      "Is there a look at that, or is pointing only for getting something?",
    ],
  },
  {
    id: "one_mate",
    domain: "A3",
    title: "A mate",
    listenFor: "can they picture one kid who is a friend/mate, not only class photo or lobby",
    asks: [
      "Can you think of one kid they would call a friend or a mate? Don’t say the name. Is there a face, or only kids in the class photo or on a game?",
      "In your head — one kid who is a person to them. Is there someone, or only a class list or a username?",
      "Would they use the word mate or friend about a real kid, not just someone they sit next to?",
    ],
  },
  {
    id: "outside_school",
    domain: "A3",
    title: "Outside school",
    listenFor: "seen that kid this year outside school/sport/screen",
    asks: [
      "When did they last see that kid outside school, sport, or a screen?",
      "Have they seen that kid this year not at school and not on a game — even if you set it up?",
      "Birthday, sleepover, just hanging at yours — has that happened, or only class and screens?",
    ],
  },
  {
    id: "notice_distress",
    domain: "A3",
    title: "If that kid is upset",
    listenFor: "notice/help badly vs only if told vs miss it",
    asks: [
      "If that kid was upset — crying, left out — what would yours usually do?",
      "Someone they know is upset. Do they notice, even if they handle it badly, or only if you say go see if they’re ok?",
      "At the oval or in the group chat, a kid is dumped. Does yours clock it?",
    ],
  },
  {
    id: "repair",
    domain: "A3",
    title: "Who sorts a fight",
    listenFor: "can see something went wrong vs parent always sorts it",
    asks: [
      "After a falling-out with another kid, who sorts it?",
      "When there’s a fight — can they see something went wrong, or do you always have to fix it?",
      "Do they ever make up, or is it always you, and they don’t see the problem?",
    ],
  },
];

export function newSessionSeed(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function hashString(input: string): number {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export type AskContext = {
  ageYears: number | null;
  schoolYear: string;
  gender: ChildProfile["gender"];
};

export function pickAsk(facet: Facet, seed: string, avoid: string[] = [], ctx?: AskContext): string {
  if (ctx) {
    const hit = pickBankAsk({
      facetId: facet.id,
      seed,
      ageYears: ctx.ageYears,
      schoolYear: ctx.schoolYear,
      gender: ctx.gender,
      avoid,
    });
    if (hit) return hit.text;
  }
  const unused = facet.asks.filter((ask) => !avoid.includes(ask));
  const pool = unused.length ? unused : facet.asks;
  return pool[hashString(`${seed}:${facet.id}`) % pool.length];
}

export function pickOpening(
  seed: string,
  ageYears: number | null,
  schoolYear: string,
  avoid: string[] = [],
  gender: ChildProfile["gender"] = "prefer_not"
): string {
  return pickOpeningAsk({ seed, ageYears, schoolYear, gender, avoid });
}

export const ALL_FACETS: Facet[] = [...A_FACETS, ...REST_FACETS];

export function emptyBeliefs(): Record<string, Belief> {
  return Object.fromEntries(
    ALL_FACETS.map((facet) => [
      facet.id,
      { polarity: "unknown" as const, frequency: "unknown" as const, confidence: 0, quote: "" },
    ])
  );
}

export function withAllFacets(beliefs: Record<string, Belief>): Record<string, Belief> {
  return { ...emptyBeliefs(), ...beliefs };
}

export function openingLine(
  ageYears: number | null,
  schoolYear: string,
  seed = "default",
  avoid: string[] = [],
  gender: ChildProfile["gender"] = "prefer_not"
): string {
  return pickOpening(seed, ageYears, schoolYear, avoid, gender);
}

const TYPICAL_MARKERS: Record<string, RegExp[]> = {
  approach_reason: [
    /\b(tell me|show me|look at this|you won’t believe|guess what|just to (be|sit|talk)|cuddle|a hug|near me)\b/i,
    /\b(don’t need me to do anything|not asking for anything|nothing they wanted)\b/i,
  ],
  parent_available: [
    /\b(i(’m| am) (usually |mostly )?around|they can catch me|most days|not only (the )?car|i sit with them)\b/i,
  ],
  greet_spontaneous: [
    /\b(on their own|by themselves|without (me )?saying|they(’d| would) (say )?hi|wave|g’day|gday)\b/i,
    /\b(started it|piped up|said hello first)\b/i,
  ],
  greet_frequency: [/\b(always|most (of the )?time|pretty much every|sometimes)\b/i],
  greet_pervasive: [
    /\b(shops?|sport|oval|school gate|other (people|adults|kids)|someone else(’s)? house|everywhere)\b/i,
    /\b(they (do it|say hi) there too|not just (at )?home)\b/i,
  ],
  topic_repeat: [
    /\b(they move on|once i(’ve| have) answered|they don(’|')t (keep )?ask(ing)? (it )?again)\b/i,
  ],
  greet_as_start: [
    /\b(they (just )?got it|picked it up|natural|they start with (hi|hello)|then (they )?talk)\b/i,
  ],
  after_demand: [/\b(stay and talk|still (chat|talk)|watch this|not another ask)\b/i],
  show_to_share: [/\b(to show|look at this|wanted me to see)\b/i],
  other_oriented: [/\b(ask(ed)? (me )?why|came back to|about my day|about work)\b/i],
  pickup_confound: [/\b(later they (still )?come|after (food|dinner|a snack)|meme|random)\b/i],
  request_gaze: [/\b(look at me|hold it up|say mum|say dad)\b/i],
  read_affect: [/\b(they (can )?tell|read my face|they know (when )?i(’m| am) (done|annoyed))\b/i],
  point_share: [/\b(just look|look at that|to show me)\b/i],
  one_mate: [/\b(yes|there(’s| is) (a|one)|a mate|a friend|been to (our|their) (house|place))\b/i],
  outside_school: [/\b(this year|last (week|month)|sleepover|came over|we went)\b/i],
  notice_distress: [/\b(they notice|they(’d| would) (tell me|get me|help)|awkward but)\b/i],
  repair: [/\b(they (can )?say sorry|make up|they know (it )?went wrong)\b/i],
};

const ASD_MARKERS: Record<string, RegExp[]> = {
  approach_reason: [
    /\b(only (when|if) they want|iPad|snack|charger|fix it|log in|i (always )?go to them|never come(s)? over)\b/i,
    /\b(want something|want me to (get|fix|do)|help with)\b/i,
  ],
  parent_available: [
    /\b(only (in )?the car|only (at )?(dinner|tea|bedtime)|only after school|set times|i(’m| am) (always )?busy|on my phone)\b/i,
  ],
  greet_spontaneous: [
    /\b(only if i (said|say)|say hello to nan|i (had to )?prompt|didn(’|')t (really )?greet|wouldn(’|')t say hi)\b/i,
  ],
  greet_frequency: [/\b(seldom|hardly ever|rarely|once in a while|only now and then|almost never)\b/i],
  greet_pervasive: [
    /\b(only (at )?home|just with (me|us|nan)|i still (have to )?prompt|everywhere i (have to )?say say hello)\b/i,
  ],
  topic_repeat: [
    /\b(same (question|thing) (over and over|again)|already answered|won(’|')t let it go|one topic|in depth|keeps asking)\b/i,
  ],
  greet_as_start: [
    /\b(never became natural|every time|walk(s)? up and start|no hello|start on what they want)\b/i,
  ],
  after_demand: [/\b(that(’s| is) the end|walk(s)? off|another (ask|snack|episode)|disappear)\b/i],
  show_to_share: [/\b(open this|put my hand|so i(’d| would) (open|fix|buy)|didn(’|')t bring)\b/i],
  other_oriented: [/\b(their (game|thing)|nothing comes back|only hear|ask for a mango)\b/i],
  pickup_confound: [/\b(only (come|if) they want|still only|charger)\b/i],
  request_gaze: [/\b(put my (hand|wrist)|grab my hand|doesn(’|')t look)\b/i],
  read_affect: [/\b(have to say (it|the words)|a look (is )?(not|isn(’|')t) enough)\b/i],
  point_share: [/\b(only if they want|only i want|never just look)\b/i],
  one_mate: [/\b(can(’|')t think|class photo|on a game|lobby|no one|nobody)\b/i],
  outside_school: [/\b(never|only if i stay|i (have to )?run it)\b/i],
  notice_distress: [/\b(doesn(’|')t notice|get annoyed|only if i (tell|say))\b/i],
  repair: [/\b(i always (sort|fix)|don(’|')t see (there was )?a problem|nothing went wrong)\b/i],
};

const GOOGLE_MARKERS = [
  /\bi read (that|online|on)\b/i,
  /\b(signs? of autism|google|the list|tiktok said|red flag)\b/i,
  /\bthat means (they(’re| are) )?autis/i,
];

const STOP_MARKERS = [/\b(hang on|hold on|wait|stop|pause|give me a (sec|second|minute))\b/i];

export function isHoldOn(text: string): boolean {
  return STOP_MARKERS.some((pattern) => pattern.test(text));
}

export function isGoogleTalk(text: string): boolean {
  return GOOGLE_MARKERS.some((pattern) => pattern.test(text));
}

function inferFrequency(text: string): Frequency {
  if (/\b(always|every time|most (of the )?time|pretty much every)\b/i.test(text)) return "always";
  if (/\b(seldom|hardly ever|rarely|almost never|only now and then|once in a while)\b/i.test(text)) return "seldom";
  if (/\b(sometimes|now and then|depends|half the time)\b/i.test(text)) return "sometimes";
  return "unknown";
}

export function inferUpdates(
  text: string
): Array<{ id: string; polarity: Polarity; frequency?: Frequency; quote: string }> {
  const updates: Array<{ id: string; polarity: Polarity; frequency?: Frequency; quote: string }> = [];
  if (isGoogleTalk(text)) {
    updates.push({ id: "pickup_confound", polarity: "confound", quote: text.slice(0, 180) });
  }
  const frequency = inferFrequency(text);
  updates.push(...inferRestUpdates(text));
  for (const facet of A_FACETS) {
    const asdHit = (ASD_MARKERS[facet.id] ?? []).some((pattern) => pattern.test(text));
    const typicalHit = (TYPICAL_MARKERS[facet.id] ?? []).some((pattern) => pattern.test(text));
    if (asdHit && !typicalHit) {
      updates.push({
        id: facet.id,
        polarity: facet.id === "parent_available" ? "confound" : "asd",
        frequency,
        quote: text.slice(0, 180),
      });
    } else if (typicalHit && !asdHit) {
      updates.push({ id: facet.id, polarity: "typical", frequency, quote: text.slice(0, 180) });
    } else if (facet.id === "greet_frequency" && frequency !== "unknown") {
      updates.push({
        id: facet.id,
        polarity: frequency === "seldom" ? "asd" : "typical",
        frequency,
        quote: text.slice(0, 180),
      });
    }
  }
  return updates;
}

export function applyUpdates(
  beliefs: Record<string, Belief>,
  updates: Array<{ id: string; polarity: Polarity; frequency?: Frequency; quote: string; confidence?: number }>
): Record<string, Belief> {
  const next = withAllFacets(beliefs);
  for (const update of updates) {
    if (!next[update.id]) continue;
    const confidence = update.confidence ?? 0.7;
    const current = next[update.id];
    if (current.polarity !== "unknown" && current.confidence > confidence) {
      if (update.frequency && current.frequency === "unknown") {
        next[update.id] = { ...current, frequency: update.frequency };
      }
      continue;
    }
    const polarity =
      update.id === "parent_available" && update.polarity === "asd" ? "confound" : update.polarity;
    next[update.id] = {
      polarity,
      frequency: update.frequency ?? current.frequency,
      confidence,
      quote: update.quote || current.quote,
    };
  }
  return next;
}

function domainFacets(domain: Domain): Facet[] {
  return A_FACETS.filter((facet) => facet.domain === domain);
}

export const A1_GATE_IDS = [
  "approach_reason",
  "parent_available",
  "greet_spontaneous",
  "greet_frequency",
  "greet_pervasive",
  "topic_repeat",
] as const;

function a1GateAsked(beliefs: Record<string, Belief>): boolean {
  return A1_GATE_IDS.every((id) => beliefs[id]?.polarity !== "unknown");
}

function unknownsIn(beliefs: Record<string, Belief>, facets: Facet[]): Facet[] {
  return facets.filter((facet) => beliefs[facet.id]?.polarity === "unknown");
}

function adjunctUnknowns(beliefs: Record<string, Belief>, includeB4 = true): Facet[] {
  const domains: Domain[] = includeB4 ? ["B4", "ADHD", "ANX", "OCD", "DEP"] : ["ADHD", "ANX", "OCD", "DEP"];
  return REST_FACETS.filter((facet) => {
    if (!domains.includes(facet.domain)) return false;
    if (beliefs[facet.id]?.polarity !== "unknown") return false;
    const verdict = scoreRestDomain(beliefs, facet.domain);
    return verdict !== "supported" && verdict !== "not_met";
  });
}

/** All constructs the tree will still allow this turn. The controller ranks these. */
export function legalFacets(beliefs: Record<string, Belief>): Facet[] {
  beliefs = withAllFacets(beliefs);
  const a1 = scoreDomain(beliefs, "A1");
  if (a1 !== "supported" && a1 !== "not_met") {
    const gate = unknownsIn(
      beliefs,
      A_FACETS.filter((facet) => (A1_GATE_IDS as readonly string[]).includes(facet.id))
    );
    if (gate.length) return gate;
    const extra = unknownsIn(beliefs, domainFacets("A1"));
    return extra.length ? extra : adjunctUnknowns(beliefs);
  }
  if (a1 === "not_met") return adjunctUnknowns(beliefs);

  const a2 = scoreDomain(beliefs, "A2");
  if (a2 !== "supported" && a2 !== "not_met") {
    const rows = unknownsIn(beliefs, domainFacets("A2"));
    return rows.length ? rows : adjunctUnknowns(beliefs);
  }
  if (a2 === "not_met") return adjunctUnknowns(beliefs);

  const a3 = scoreDomain(beliefs, "A3");
  if (a3 !== "supported" && a3 !== "not_met") {
    const rows = unknownsIn(beliefs, domainFacets("A3"));
    return rows.length ? rows : adjunctUnknowns(beliefs);
  }
  if (a3 === "not_met") return adjunctUnknowns(beliefs);

  const b = scoreB(beliefs);
  if (b !== "supported" && b !== "not_met") {
    for (const domain of ["B4", "B2", "B3", "B1"] as const) {
      const verdict = scoreRestDomain(beliefs, domain);
      if (verdict === "supported" || verdict === "not_met") continue;
      const rows = unknownsIn(
        beliefs,
        REST_FACETS.filter((facet) => facet.domain === domain)
      );
      if (rows.length) return rows;
    }
  }
  if (b === "not_met") return adjunctUnknowns(beliefs, false);

  for (const domain of ["C", "D", "E"] as const) {
    const verdict = scoreRestDomain(beliefs, domain);
    if (verdict === "supported" || verdict === "not_met") continue;
    const rows = unknownsIn(
      beliefs,
      REST_FACETS.filter((facet) => facet.domain === domain)
    );
    if (rows.length) return rows;
  }
  return adjunctUnknowns(beliefs, false);
}

export function scoreDomain(beliefs: Record<string, Belief>, domain: Domain): DomainVerdict {
  const map = withAllFacets(beliefs);
  const rows = domainFacets(domain).map((facet) => map[facet.id]);
  const asked = rows.filter((row) => row.polarity !== "unknown");
  if (!asked.length) return "unasked";
  const typical = asked.filter((row) => row.polarity === "typical").length;
  const asd = asked.filter((row) => row.polarity === "asd").length;
  if (domain === "A1") {
    if (!a1GateAsked(map)) return "abstain";
    const reason = map.approach_reason.polarity;
    const available = map.parent_available.polarity;
    const greet = map.greet_spontaneous.polarity;
    const greetHowOften = map.greet_frequency.frequency;
    const greetFreq = map.greet_frequency.polarity;
    const pervasive = map.greet_pervasive.polarity;
    const start = map.greet_as_start.polarity;
    const repeat = map.topic_repeat.polarity;
    const greetOftenEnough = greetFreq === "typical" || greetHowOften === "always" || greetHowOften === "sometimes";

    // Chat only at set times does not count as a free social start.
    if (available === "confound" && reason === "typical") {
      if (greet === "asd" && pervasive === "asd") return "supported";
      return "abstain";
    }
    if (
      reason === "typical" &&
      available === "typical" &&
      greet === "typical" &&
      greetOftenEnough &&
      pervasive === "typical" &&
      repeat !== "asd"
    ) {
      return "not_met";
    }
    if (reason === "asd" && greet === "asd" && (pervasive === "asd" || start === "asd" || greetFreq === "asd")) {
      return "supported";
    }
    if (repeat === "asd" && greet === "asd" && reason === "asd") return "supported";
  }
  if (typical >= 2 && asd <= 1) return "not_met";
  if (asd >= 2 && typical <= 1) return "supported";
  if (asked.length >= 3 && typical > 0 && asd > 0) return "abstain";
  return "abstain";
}

export function nextFacet(beliefs: Record<string, Belief>): Facet | null {
  return legalFacets(beliefs)[0] ?? null;
}

export type ScreenClose = {
  done: true;
  outcome: "not_autism" | "social_pattern" | "autism_pattern" | "cannot_say" | "paused";
  headline: string;
  body: string;
  a1: DomainVerdict;
  a2: DomainVerdict;
  a3: DomainVerdict;
  b?: DomainVerdict;
  c?: DomainVerdict;
  d?: DomainVerdict;
  e?: DomainVerdict;
  adhd?: DomainVerdict;
  anxiety?: DomainVerdict;
  ocd?: DomainVerdict;
  depression?: DomainVerdict;
};

function packClose(
  outcome: ScreenClose["outcome"],
  headline: string,
  body: string,
  beliefs: Record<string, Belief>
): ScreenClose {
  return {
    done: true,
    outcome,
    headline,
    body,
    a1: scoreDomain(beliefs, "A1"),
    a2: scoreDomain(beliefs, "A2"),
    a3: scoreDomain(beliefs, "A3"),
    b: scoreB(beliefs),
    c: scoreRestDomain(beliefs, "C"),
    d: scoreRestDomain(beliefs, "D"),
    e: scoreRestDomain(beliefs, "E"),
    adhd: scoreRestDomain(beliefs, "ADHD"),
    anxiety: scoreRestDomain(beliefs, "ANX"),
    ocd: scoreRestDomain(beliefs, "OCD"),
    depression: scoreRestDomain(beliefs, "DEP"),
  };
}

function adjunctLine(beliefs: Record<string, Belief>): string {
  const hits: string[] = [];
  if (scoreRestDomain(beliefs, "B4") === "supported") hits.push("senses that cost the week");
  if (scoreRestDomain(beliefs, "ADHD") === "supported") hits.push("attention or being on the move in more than one place");
  if (scoreRestDomain(beliefs, "ANX") === "supported") hits.push("what-if worry, or wanting the invite and dreading it");
  if (scoreRestDomain(beliefs, "OCD") === "supported") hits.push("a ritual to cancel dread, not a liked routine");
  if (scoreRestDomain(beliefs, "DEP") === "supported") hits.push("joy that dropped for weeks");
  if (!hits.length) return " If something else is going on, that’s a GP conversation.";
  return ` What showed beside that: ${hits.join("; ")}. Not a diagnosis. A GP or clinician does the next layer.`;
}

export function closeFromBeliefs(beliefs: Record<string, Belief>): ScreenClose | null {
  if (nextFacet(beliefs)) return null;
  const a1 = scoreDomain(beliefs, "A1");
  const a2 = scoreDomain(beliefs, "A2");
  const a3 = scoreDomain(beliefs, "A3");
  const b = scoreB(beliefs);
  const c = scoreRestDomain(beliefs, "C");
  const d = scoreRestDomain(beliefs, "D");
  const e = scoreRestDomain(beliefs, "E");
  const extra = adjunctLine(beliefs);

  if (a1 === "not_met" || (a1 === "supported" && (a2 === "not_met" || a3 === "not_met"))) {
    return packClose(
      "not_autism",
      "This doesn’t look like the social part of autism.",
      a1 === "not_met"
        ? `They come to you for more than an ask, hello started on their own in more than one place, and it is not only the car. Autism needs that start to be missing.${extra}`
        : `Talking can be hard and still not be autism. Faces or friendships didn’t line up. Autism needs all three.${extra}`,
      beliefs
    );
  }

  if (a1 === "supported" && a2 === "supported" && a3 === "supported" && b === "supported" && c === "supported" && d === "supported" && e === "supported") {
    return packClose(
      "autism_pattern",
      "A full social and rigid pattern is there.",
      "Start with people, faces, a mate, two kinds of sameness or senses, it was there early, it gets in the way, and it is not just global delay. That can be autism. It is not a diagnosis. A clinician does the next layer.",
      beliefs
    );
  }

  if (a1 === "supported" && a2 === "supported" && a3 === "supported" && b === "not_met") {
    return packClose(
      "social_pattern",
      "The social part is there. The rigid / sensory part is not.",
      `Starting with people lined up. Repeats, sameness, a taking-over interest, or senses that cost the week did not. Autism needs both.${extra}`,
      beliefs
    );
  }

  if (a1 === "supported" && a2 === "supported" && a3 === "supported") {
    return packClose(
      "social_pattern",
      "A social-communication pattern is there.",
      `Starting with people, your face, and a mate pointed the same way. That can be part of autism. History, impairment, or the delay question was not clear enough to go further.${extra}`,
      beliefs
    );
  }

  return packClose(
    "cannot_say",
    "I can’t tell from this, so I won’t guess.",
    `A second adult who knows them, or a clinician, is the next step.${extra}`,
    beliefs
  );
}

export function fallbackSay(
  beliefs: Record<string, Belief>,
  lastParent: string,
  holdOn: boolean,
  seed = "default",
  avoid: string[] = [],
  ctx?: AskContext
): string {
  if (holdOn) return "I’ll wait. Talk when you’re ready.";
  if (isCrisisTalk(lastParent)) {
    return "If they are not safe, stop this and call 000 or Lifeline on 13 11 14. I will not keep going on that here.";
  }
  if (isGoogleTalk(lastParent)) {
    return "Forget the list for a second. In your kitchen, most weeks — why do they come up to you?";
  }
  const close = closeFromBeliefs(beliefs);
  if (close) return `${close.headline} ${close.body}`;
  const facet = nextFacet(beliefs);
  if (!facet) return "I think I have enough. Thank you.";
  return pickAsk(facet, seed, avoid, ctx);
}

export { ageBandFrom };

export type ScoreLine = {
  domain: Domain;
  verdict: DomainVerdict;
  why: string;
};

export function scoreCard(beliefs: Record<string, Belief>): {
  a1: DomainVerdict;
  a2: DomainVerdict;
  a3: DomainVerdict;
  lines: ScoreLine[];
  rules: string[];
} {
  const map = withAllFacets(beliefs);
  const a1 = scoreDomain(map, "A1");
  const a2 = scoreDomain(map, "A2");
  const a3 = scoreDomain(map, "A3");
  const freq = map.greet_frequency.frequency;
  return {
    a1,
    a2,
    a3,
    lines: [
      {
        domain: "A1",
        verdict: a1,
        why: `Come over: ${map.approach_reason.polarity}. You free: ${map.parent_available.polarity}. Hello on their own: ${map.greet_spontaneous.polarity}. How often: ${freq}. Other places: ${map.greet_pervasive.polarity}. Same question again: ${map.topic_repeat.polarity}.`,
      },
      {
        domain: "A2",
        verdict: a2,
        why: `Your face when they need you: ${map.request_gaze.polarity}. Read you’re done: ${map.read_affect.polarity}. Look at that: ${map.point_share.polarity}.`,
      },
      {
        domain: "A3",
        verdict: a3,
        why: `A mate: ${map.one_mate.polarity}. Outside school: ${map.outside_school.polarity}. If that kid is upset: ${map.notice_distress.polarity}. Who sorts a fight: ${map.repair.polarity}.`,
      },
      ...restScoreLines(map),
    ],
    rules: [
      "We score the map, not the wording. Each session draws different questions for the same thing.",
      "Each answer gets a lean (typical / autism-leaning / confound) and, where it matters, always / sometimes / seldom.",
      "A1 is not met only if they come to share, you are actually free, hello started on their own, that is always or sometimes, it happens in other places, and they do not keep asking the same question after it is answered.",
      "Chat only in the car or at dinner does not count as a free start.",
      "Hello once to Nan does not count.",
      "If the social start is there, we do not call autism. We still ask senses, attention, worry, rituals, and mood.",
      "A2 and A3: two clear typical leans and at most one autism lean = not met. Two autism leans and at most one typical = supported.",
      ...REST_RULES,
      "Mixed or not enough = we will not guess.",
    ],
  };
}

export function profileRows(beliefs: Record<string, Belief>): Array<{
  domain: Domain;
  title: string;
  polarity: Polarity;
  quote: string;
}> {
  return ALL_FACETS.filter((facet) => beliefs[facet.id]?.polarity !== "unknown").map((facet) => ({
    domain: facet.domain,
    title: facet.title,
    polarity: beliefs[facet.id].polarity,
    quote: [beliefs[facet.id].frequency !== "unknown" ? beliefs[facet.id].frequency : "", beliefs[facet.id].quote]
      .filter(Boolean)
      .join(" — "),
  }));
}
