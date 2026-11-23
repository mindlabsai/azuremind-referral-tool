/**
 * B–E and ADHD / anxiety / OCD / depression belief tree.
 * Parent never hears the codes. Autism still needs A, then two of B, then C D E.
 * Adjuncts never diagnose. BlinkLab can sit on B4 only.
 */

import type { Belief, Domain, DomainVerdict, Facet, Polarity } from "./parent-a-conversation";

export const REST_FACETS: Facet[] = [
  {
    id: "b1_motor",
    domain: "B1",
    title: "Body on a loop",
    listenFor: "same motor loop (flap rock spin toes) vs ordinary fidget that stops when interested",
    asks: [],
  },
  {
    id: "b1_speech_object",
    domain: "B1",
    title: "Same words or objects",
    listenFor: "echo / scripts / line-up / spin objects most weeks vs one-off tidy or a joke",
    asks: [],
  },
  {
    id: "b2_change",
    domain: "B2",
    title: "When the plan moves",
    listenFor: "actual change = stuck/crisis vs moan and adapt; not ‘what if’ anxiety",
    asks: [],
  },
  {
    id: "b2_sameness",
    domain: "B2",
    title: "Same way",
    listenFor: "order/route/brand/rules must stay vs can swap; brand/order is B2, texture is B4",
    asks: [],
  },
  {
    id: "b3_intensity",
    domain: "B3",
    title: "One thing takes over",
    listenFor: "hours/talk/crisis if removed vs ordinary hobby",
    asks: [],
  },
  {
    id: "b3_vs_hobby",
    domain: "B3",
    title: "Hobby or the only slot",
    listenFor: "can leave the topic vs pulls every conversation back; unusual for age",
    asks: [],
  },
  {
    id: "b4_hyper",
    domain: "B4",
    title: "Senses too much",
    listenFor: "noise clothes light smell texture cost dressing/canteen/assembly most weeks, more than one place",
    asks: [],
  },
  {
    id: "b4_seek",
    domain: "B4",
    title: "Senses hunted",
    listenFor: "crash chew spin mouthing seek, or pain/temperature not noticed",
    asks: [],
  },
  {
    id: "b4_vs_mood",
    domain: "B4",
    title: "Senses only when worried",
    listenFor: "senses most days when fine vs only when already anxious or tired",
    asks: [],
  },
  {
    id: "c_when",
    domain: "C",
    title: "When it started",
    listenFor: "under five / kindy vs only once school or high-school demand hit",
    asks: [],
  },
  {
    id: "c_early_signs",
    domain: "C",
    title: "What was there early",
    listenFor: "share/hello/play/change/senses already thin before school vs typical then",
    asks: [],
  },
  {
    id: "c_hidden",
    domain: "C",
    title: "Looked fine because",
    listenFor: "true ease vs small setting / adult carried it / copied / called shy or ADHD first",
    asks: [],
  },
  {
    id: "d_settings",
    domain: "D",
    title: "More than one place",
    listenFor: "two or more of home school community this year vs one room or one bad week",
    asks: [],
  },
  {
    id: "d_load",
    domain: "D",
    title: "Who runs the day",
    listenFor: "parent/school scaffolding, crash after mask, plans vs ordinary nagging",
    asks: [],
  },
  {
    id: "e_global",
    domain: "E",
    title: "Learning across the board",
    listenFor: "on time or some subjects hard vs global delay / ID test / like a much younger child in nearly everything",
    asks: [],
  },
  {
    id: "e_gap",
    domain: "E",
    title: "People versus schoolwork",
    listenFor: "social/rigid/sensory bigger than learning level vs the same as overall delay",
    asks: [],
  },
  {
    id: "adhd_inatt",
    domain: "ADHD",
    title: "Attention even when they like it",
    listenFor: "not listening / losing / not finishing on liked things and in two places vs only boring or only social talk",
    asks: [],
  },
  {
    id: "adhd_hyper",
    domain: "ADHD",
    title: "On the move",
    listenFor: "interrupt / on the go in two settings from early vs flap-when-excited or only tired",
    asks: [],
  },
  {
    id: "adhd_settings",
    domain: "ADHD",
    title: "Attention in two places",
    listenFor: "home and school since primary vs one teacher or this term only",
    asks: [],
  },
  {
    id: "anx_worry",
    domain: "ANX",
    title: "What if",
    listenFor: "future worry that needs cancelling vs sameness after a change already happened",
    asks: [],
  },
  {
    id: "anx_social_want",
    domain: "ANX",
    title: "Want the invite, dread it",
    listenFor: "wants peers then freeze vs peers do not register; fear drops when safe vs start still missing",
    asks: [],
  },
  {
    id: "ocd_dread",
    domain: "OCD",
    title: "Must undo a bad feeling",
    listenFor: "unwanted thought or ritual to cancel dread vs liked routine / special interest",
    asks: [],
  },
  {
    id: "dep_weeks",
    domain: "DEP",
    title: "Joy dropped for weeks",
    listenFor: "weeks of down/empty or lost likes vs never-shared A1 or a bad weekend",
    asks: [],
  },
];

export const B_ORDER: Domain[] = ["B4", "B2", "B3", "B1"];
export const ADJUNCT_DOMAINS: Domain[] = ["B4", "ADHD", "ANX", "OCD", "DEP"];

const TYPICAL: Record<string, RegExp[]> = {
  b1_motor: [/\b(ordinary (fidget|bounce|wriggle)|stops when (interested|into)|just fidget)\b/i],
  b1_speech_object: [/\b(one-off|rare tidy|just a joke|ordinary (chat|talk)|not weekly)\b/i],
  b2_change: [/\b(moan and (move|adapt)|get over it|flex|adapt)\b/i],
  b2_sameness: [/\b(can (swap|change|flex)|doesn.?t have to be the same|wait and see)\b/i],
  b3_intensity: [/\b(ordinary (hobby|like)|a mix|disappointing not a crisis|same as (friends|mates))\b/i],
  b3_vs_hobby: [/\b(can leave|stays in its slot|not really collect)\b/i],
  b4_hyper: [/\b(keep going|no big deal|fine with (noise|tags|clothes)|not most weeks)\b/i],
  b4_seek: [/\b(mostly avoid|almost never|doesn.?t (crash|chew|mouth))\b/i],
  b4_vs_mood: [/\b(only when (worried|anxious|tired)|only before (a )?(test|social))\b/i],
  c_when: [/\b(only (once|since) (school|high school|the last year)|fine then)\b/i],
  c_early_signs: [/\b(typical then|on time|was there|fine in kindy)\b/i],
  c_hidden: [/\b(true ease|really was fine)\b/i],
  d_settings: [/\b(only (one|in one)|one room|one-off|ordinary nagging)\b/i],
  d_load: [/\b(ordinary (nagging|parenting|toddler work)|have not needed to call)\b/i],
  e_global: [/\b(on time|roughly like other|some subjects|not tested|not (id|gdd|global))\b/i],
  e_gap: [/\b(about the same as (an )?overall delay|same as (the )?delay|the work itself)\b/i],
  adhd_inatt: [/\b(only when (bored|boring)|only (social|people)|can stay with a fun)\b/i],
  adhd_hyper: [/\b(only when tired|flap when excited|stops when (interested|into))\b/i],
  adhd_settings: [/\b(only one (place|teacher)|this term only)\b/i],
  anx_worry: [/\b(ordinary (worry|stress)|it passes|sameness is the house)\b/i],
  anx_social_want: [/\b(do not see the point|doesn.?t register|start still missing)\b/i],
  ocd_dread: [/\b(liked routine|my thing is gone|hobby|no ritual|doesn.?t have to undo)\b/i],
  dep_weeks: [/\b(bad weekend|never (there|shared)|one rotten|ordinary teen mood)\b/i],
};

const SIGNAL: Record<string, RegExp[]> = {
  b1_motor: [/\b(flap|rock|spin|on (their )?toes|same movement on a loop)\b/i],
  b1_speech_object: [/\b(echo|your last words|script|line(s)? up|spin (the )?wheel|like a recording)\b/i],
  b2_change: [/\b(day is gone|ruin the day|stuck|shutdown|blow-?up|cannot adapt|crisis)\b/i],
  b2_sameness: [/\b(has to be the same|same (order|route|brand|cup|seat)|only (their|his|her) rules)\b/i],
  b3_intensity: [/\b(takes over|main thing in|crisis if|would talk about for an hour|in the way of (sleep|school))\b/i],
  b3_vs_hobby: [/\b(pull(s)? (it|every conversation) back|cannot leave|unusually narrow)\b/i],
  b4_hyper: [/\b(cover (their )?ears|leave|strip|change (clothes|a top)|hand-?dryer|tags|blender|assembly)\b/i],
  b4_seek: [/\b(crash|chew|mouth(ing)?|deep pressure|doesn.?t notice (pain|temperature))\b/i],
  b4_vs_mood: [/\b(most days even when|quiet sunday|even when (they )?are fine)\b/i],
  c_when: [/\b(from little|under five|kindy|already hard|flag(ged)? it when)\b/i],
  c_early_signs: [/\b(already (thin|hard)|reduced early|not just to get)\b/i],
  c_hidden: [/\b(adult (doing|carried)|copied|small (room|setting)|called shy)\b/i],
  d_settings: [/\b(two or more|home and (school|kindy)|more than one place)\b/i],
  d_load: [/\b(run the (whole )?(day|morning)|on duty|school calling|time-out card|crash)\b/i],
  e_global: [/\b(across the board|global delay|intellectual disability|much younger child)\b/i],
  e_gap: [/\b(stronger than|bigger than|people more than (the )?work|noise, the group)\b/i],
  adhd_inatt: [/\b(even when (they )?like|losing things|not finishing|two places)\b/i],
  adhd_hyper: [/\b(on the move|interrupt|can.?t (wait|sit)|two settings|before (they were )?twelve)\b/i],
  adhd_settings: [/\b(home and (school|kindy)|two places|since primary)\b/i],
  anx_worry: [/\b(what if|tummy|cannot park|needs? (you )?to cancel)\b/i],
  anx_social_want: [/\b(want(s)? (to go|the invite|the other kids)|freeze|dread|they.?ll laugh)\b/i],
  ocd_dread: [/\b(to cancel|unwanted|must (do|wash|check|count)|something bad will happen)\b/i],
  dep_weeks: [/\b(for weeks|most of the day|lost (the )?(joy|likes)|empty|appetite)\b/i],
};

export function isCrisisTalk(text: string): boolean {
  return /\b(suicid|kill (them|him|her)?self|end (their|his|her) life|not safe|self[- ]harm)\b/i.test(text);
}

export function inferRestUpdates(
  text: string
): Array<{ id: string; polarity: Polarity; quote: string }> {
  const updates: Array<{ id: string; polarity: Polarity; quote: string }> = [];
  for (const facet of REST_FACETS) {
    const hitS = (SIGNAL[facet.id] ?? []).some((pattern) => pattern.test(text));
    const hitT = (TYPICAL[facet.id] ?? []).some((pattern) => pattern.test(text));
    if (hitS && !hitT) {
      const polarity: Polarity =
        facet.id === "b4_vs_mood" || facet.id === "c_hidden" ? "confound" : "asd";
      if (facet.id === "e_global" && hitS) {
        updates.push({ id: facet.id, polarity: "asd", quote: text.slice(0, 180) });
        continue;
      }
      updates.push({ id: facet.id, polarity, quote: text.slice(0, 180) });
    } else if (hitT && !hitS) {
      updates.push({ id: facet.id, polarity: "typical", quote: text.slice(0, 180) });
    }
  }
  return updates;
}

function askedOf(beliefs: Record<string, Belief>, domain: Domain): Belief[] {
  return REST_FACETS.filter((facet) => facet.domain === domain).map(
    (facet) => beliefs[facet.id] ?? { polarity: "unknown", frequency: "unknown", confidence: 0, quote: "" }
  );
}

export function scoreRestDomain(beliefs: Record<string, Belief>, domain: Domain): DomainVerdict {
  const rows = askedOf(beliefs, domain);
  const asked = rows.filter((row) => row.polarity !== "unknown");
  if (!asked.length) return "unasked";
  const typical = asked.filter((row) => row.polarity === "typical").length;
  const signal = asked.filter((row) => row.polarity === "asd").length;
  const confound = asked.filter((row) => row.polarity === "confound").length;

  if (domain === "C") {
    if (beliefs.c_when?.polarity === "typical" && beliefs.c_early_signs?.polarity === "typical") return "not_met";
    if (beliefs.c_when?.polarity === "asd" || beliefs.c_early_signs?.polarity === "asd") return "supported";
    if (beliefs.c_hidden?.polarity === "confound" || beliefs.c_hidden?.polarity === "asd") return "abstain";
    return "abstain";
  }
  if (domain === "D") {
    if (signal >= 1 && typical === 0) return "supported";
    if (typical >= 2 && signal === 0) return "not_met";
    if (signal >= 1 && typical >= 1) return "supported";
    return "abstain";
  }
  if (domain === "E") {
    if (beliefs.e_global?.polarity === "asd" && beliefs.e_gap?.polarity !== "asd") return "not_met";
    if (beliefs.e_gap?.polarity === "asd") return "supported";
    if (beliefs.e_global?.polarity === "typical") return "supported";
    if (beliefs.e_gap?.polarity === "typical") return "not_met";
    return "abstain";
  }
  if (domain === "B4" && confound >= 1 && signal === 0) return "abstain";
  if (typical >= 2 && signal <= 1) return "not_met";
  if (signal >= 2 && typical <= 1) return "supported";
  if (asked.length === 1) return "abstain";
  if (signal === 1 && typical === 0 && asked.length >= 1) return asked.length >= 2 ? "supported" : "abstain";
  return "abstain";
}

export function scoreB(beliefs: Record<string, Belief>): DomainVerdict {
  const parts = (["B1", "B2", "B3", "B4"] as const).map((code) => scoreRestDomain(beliefs, code));
  const supported = parts.filter((row) => row === "supported").length;
  const notMet = parts.filter((row) => row === "not_met").length;
  const asked = parts.filter((row) => row !== "unasked").length;
  if (supported >= 2) return "supported";
  if (notMet >= 3 && supported === 0) return "not_met";
  if (asked >= 4 && supported < 2) return supported === 1 ? "abstain" : "not_met";
  if (!asked) return "unasked";
  return "abstain";
}

function unknownIn(beliefs: Record<string, Belief>, domain: Domain): Facet | null {
  return REST_FACETS.find((facet) => facet.domain === domain && beliefs[facet.id]?.polarity === "unknown") ?? null;
}

function bDomainDone(beliefs: Record<string, Belief>, domain: Domain): boolean {
  const verdict = scoreRestDomain(beliefs, domain);
  return verdict === "supported" || verdict === "not_met" || !unknownIn(beliefs, domain);
}

export function nextAutismRestFacet(beliefs: Record<string, Belief>): Facet | null {
  const b = scoreB(beliefs);
  if (b !== "supported" && b !== "not_met") {
    for (const domain of B_ORDER) {
      if (bDomainDone(beliefs, domain)) continue;
      const next = unknownIn(beliefs, domain);
      if (next) return next;
    }
  }
  if (b === "not_met") return nextAdjunctFacet(beliefs, false);
  for (const domain of ["C", "D", "E"] as const) {
    const next = unknownIn(beliefs, domain);
    if (next && scoreRestDomain(beliefs, domain) === "unasked") return next;
    if (next && scoreRestDomain(beliefs, domain) === "abstain") return next;
  }
  return nextAdjunctFacet(beliefs, false);
}

export function nextAdjunctFacet(beliefs: Record<string, Belief>, includeB4 = true): Facet | null {
  const domains: Domain[] = includeB4 ? ADJUNCT_DOMAINS : ["ADHD", "ANX", "OCD", "DEP"];
  for (const domain of domains) {
    if (domain === "B4" && scoreRestDomain(beliefs, "B4") !== "unasked" && bDomainDone(beliefs, "B4")) continue;
    const verdict = scoreRestDomain(beliefs, domain);
    if (verdict === "supported" || verdict === "not_met") continue;
    const next = unknownIn(beliefs, domain);
    if (next) return next;
  }
  return null;
}

export function restScoreLines(beliefs: Record<string, Belief>): Array<{ domain: Domain; verdict: DomainVerdict; why: string }> {
  const pick = (ids: string[]) =>
    ids
      .map((id) => {
        const facet = REST_FACETS.find((row) => row.id === id);
        const row = beliefs[id];
        return `${facet?.title ?? id}: ${row?.polarity ?? "unknown"}`;
      })
      .join(". ");
  return [
    { domain: "B1", verdict: scoreRestDomain(beliefs, "B1"), why: pick(["b1_motor", "b1_speech_object"]) },
    { domain: "B2", verdict: scoreRestDomain(beliefs, "B2"), why: pick(["b2_change", "b2_sameness"]) },
    { domain: "B3", verdict: scoreRestDomain(beliefs, "B3"), why: pick(["b3_intensity", "b3_vs_hobby"]) },
    { domain: "B4", verdict: scoreRestDomain(beliefs, "B4"), why: pick(["b4_hyper", "b4_seek", "b4_vs_mood"]) },
    { domain: "C", verdict: scoreRestDomain(beliefs, "C"), why: pick(["c_when", "c_early_signs", "c_hidden"]) },
    { domain: "D", verdict: scoreRestDomain(beliefs, "D"), why: pick(["d_settings", "d_load"]) },
    { domain: "E", verdict: scoreRestDomain(beliefs, "E"), why: pick(["e_global", "e_gap"]) },
    { domain: "ADHD", verdict: scoreRestDomain(beliefs, "ADHD"), why: pick(["adhd_inatt", "adhd_hyper", "adhd_settings"]) },
    { domain: "ANX", verdict: scoreRestDomain(beliefs, "ANX"), why: pick(["anx_worry", "anx_social_want"]) },
    { domain: "OCD", verdict: scoreRestDomain(beliefs, "OCD"), why: pick(["ocd_dread"]) },
    { domain: "DEP", verdict: scoreRestDomain(beliefs, "DEP"), why: pick(["dep_weeks"]) },
  ];
}

export const REST_RULES = [
  "Autism needs A1, A2 and A3, then two of B1–B4, then early onset, impairment, and not just global delay.",
  "If the social start is there, we do not call autism. We still ask senses, attention, worry, rituals, and mood — that is why people come.",
  "B1 is a looped body or script, not ADHD chair-bounce.",
  "B2 is the plan already changed. Anxiety is what if.",
  "B3 is intensity that takes over, not a hobby.",
  "Senses are lived cost in the week — clothes, noise, assembly — not a one-off flinch.",
  "C: present before school, or only once demand rose. ‘Looked fine’ can be a small room and an adult carrying it.",
  "D: two places, or one place plus a real load, across the year.",
  "E: social and rigid bits bigger than learning level. ADHD and literacy do not fail E.",
  "ADHD, anxiety, OCD, and low mood are adjuncts. They are not a diagnosis from this talk.",
];
