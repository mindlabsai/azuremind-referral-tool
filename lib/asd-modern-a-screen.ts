/**
 * Modern A1–A3 social-communication screen.
 * If A1, A2, or A3 is not met, DSM-5-TR ASD is not met.
 * Does not write to the Texlex report draft.
 */

export const A_SCREEN_STORAGE_KEY = "texlex-modern-a-screen-v1";

export type AScreenChoice = "typical" | "asd" | "unsure" | "invalid";
export type AScreenDomain = "G0" | "A1" | "A2" | "A3";
export type AScreenAudience = "parent" | "session";
export type DomainVerdict = "supported" | "not_met" | "abstain";

export type AScreenItem = {
  id: string;
  domain: AScreenDomain;
  audience: AScreenAudience;
  prompt: string;
  typical: string;
  asd: string;
  why: string;
  /** If typical, A1 cannot be Supported from parent talk-volume complaints. */
  dietUnlock?: boolean;
  /** Counts toward the A1 other-oriented battery. */
  a1Quality?: boolean;
};

export const A_SCREEN_ITEMS: AScreenItem[] = [
  {
    id: "g0-sequence",
    domain: "G0",
    audience: "parent",
    prompt: "Last night at dinner or in the car: the last three things they said, then you, then them. Say the words.",
    typical: "They can give a real sequence from a named time.",
    asd: "Only adjectives: chatty, not social, in his own world. No sequence.",
    why: "If they cannot replay turns, they are not yet an informant.",
  },
  {
    id: "g0-meaning",
    domain: "G0",
    audience: "parent",
    prompt: "In your house, what counts as a conversation? Requests, logistics, a show, or them asking about you?",
    typical: "They can split chat from getting things / running the day.",
    asd: "They count any talking, nagging, or being in the room as conversation.",
    why: "Parents inflate ‘chatty’ with demands.",
  },
  {
    id: "g0-phones",
    domain: "G0",
    audience: "parent",
    prompt: "Phones on the table at dinner or in the car — yes or no? Who is the talker in the house?",
    typical: "There are phone-down windows and at least one adult who talks.",
    asd: "Phones stay out. Nobody models back-and-forth.",
    why: "You are scoring the diet they rate against.",
    dietUnlock: true,
  },
  {
    id: "g0-available",
    domain: "G0",
    audience: "parent",
    prompt: "When you put the phones away and sit with them for an hour, does their talk change?",
    typical: "Share-talk or more turns appear once you are actually available.",
    asd: "Still only demands, or still no other-oriented talk.",
    why: "If availability unlocks talk, last week’s ‘not social’ was technoference.",
    dietUnlock: true,
  },
  {
    id: "g0-disconfirm",
    domain: "G0",
    audience: "parent",
    prompt: "Give me one time this week when they DID do a back-and-forth that was not to get something.",
    typical: "They can name one counter-example.",
    asd: "They cannot, or they refuse: it is always like this.",
    why: "Cannot disconfirm = advocating, not reporting.",
  },
  {
    id: "g0-autism-script",
    domain: "G0",
    audience: "parent",
    prompt: "Did you learn about autism before or after you started noticing these things?",
    typical: "They noticed behaviours first, then sought the word.",
    asd: "They learned the language first, then started seeing the items.",
    why: "Concern trains the examples they will now give you.",
  },
  {
    id: "g0-language",
    domain: "G0",
    audience: "parent",
    prompt: "Can they tell a short story in sentences, or is talk mostly phrases / getting things?",
    typical: "Fluent enough to do other-oriented comments if they had them.",
    asd: "Language is too thin to demand dinner-table reciprocity — score share/show, not chat.",
    why: "A1 is normed to language level, not chronological age.",
  },
  {
    id: "g0-second-source",
    domain: "G0",
    audience: "parent",
    prompt: "What would their teacher or the other parent say about talk and friends that you disagree with?",
    typical: "They know a second setting, even if they disagree.",
    asd: "They have never asked, or there is only one reporter.",
    why: "Single-source adjectives cannot Support A.",
  },

  {
    id: "a1-share-now",
    domain: "A1",
    audience: "parent",
    prompt: "Something happens that is not theirs — a dog, a crash, your news. Do they look at you and comment just to share it?",
    typical: "Yes, even once, without wanting you to do anything.",
    asd: "Never, or only if they need you to act.",
    why: "Declarative share, not a request. This is the A1 miss.",
    a1Quality: true,
  },
  {
    id: "a1-share-then",
    domain: "A1",
    audience: "parent",
    prompt: "When they were about 4 or 5: did they bring you things just to show you, not to get them opened or fixed?",
    typical: "Yes — show-to-share was there.",
    asd: "Request only: hand-over-hand, get the jar, get the screen.",
    why: "Historical protodeclarative. Screens do not erase this if it was there.",
    a1Quality: true,
  },
  {
    id: "a1-your-topic",
    domain: "A1",
    audience: "parent",
    prompt: "You say two sentences about your day or something you care about. How many times do they come back to YOUR topic — a question or a comment, not ‘can I have…’?",
    typical: "Two or more other-oriented returns.",
    asd: "Zero or one. They go quiet, say I dont know, or jack to their thing.",
    why: "Floor for fluent children: ≥2 other-oriented returns. Do not use ‘how was your day.’",
    a1Quality: true,
  },
  {
    id: "a1-after-demand",
    domain: "A1",
    audience: "parent",
    prompt: "They want something. You give it. You stay there, available. What happens to the talk?",
    typical: "They can shift into a few turns that are not another demand.",
    asd: "Talk dies. They leave. Or the next line is another get.",
    why: "Splits learned demand from A1. If talk appears after they get it, this episode is not A1.",
    a1Quality: true,
  },
  {
    id: "a1-four-turns",
    domain: "A1",
    audience: "parent",
    prompt: "On a topic they did not pick: can they stay for four or five turns, including at least two that are about you or the other person?",
    typical: "Yes, at least sometimes, from about 4 years if they are fluent.",
    asd: "They cannot stay unless it is their interest or a demand chain.",
    why: "4–5 topic turns is the typical floor from ~3.5 years. Demand chains do not count.",
    a1Quality: true,
  },
  {
    id: "a1-you-quiet",
    domain: "A1",
    audience: "parent",
    prompt: "If you stay quiet and there is nothing they need, do they start talk to share, or only speak when they want something?",
    typical: "They will start something that is not a request, at least with familiar people.",
    asd: "Silent unless they need something, or they monologue their interest.",
    why: "Initiating a demand is not initiating reciprocity.",
    a1Quality: true,
  },
  {
    id: "a1-leave-interest",
    domain: "A1",
    audience: "parent",
    prompt: "When you change the topic away from their thing, can they come with you, or do they pull it back?",
    typical: "They can switch, even if they prefer their topic.",
    asd: "They pull it back every time. Your turn does not exist.",
    why: "One-way interest talk is A1, not ‘chatty.’",
    a1Quality: true,
  },
  {
    id: "a1-session",
    domain: "A1",
    audience: "session",
    prompt: "In this session: did they produce two other-oriented returns on YOUR topic, or only I dont know / iPad / leave?",
    typical: "At least two returns, or a clear reason the sample is invalid (anxiety, stranger, device).",
    asd: "No other-oriented returns, and history matches.",
    why: "Clinic mute is invalid until history agrees. Do not write A1 from Zoom silence alone.",
    a1Quality: true,
  },

  {
    id: "a2-face-for-get",
    domain: "A2",
    audience: "parent",
    prompt: "When they want something, do they use your face — look, point, show — or only words, pull you, or put your hand on the thing?",
    typical: "Face and gesture are in the request.",
    asd: "Hand-over-hand, pull, or words only. Your face is not used.",
    why: "Integration of verbal and nonverbal. Hand-as-tool is A2.",
  },
  {
    id: "a2-read-done",
    domain: "A2",
    audience: "parent",
    prompt: "Can they tell you are done, annoyed, or joking without you saying it in words?",
    typical: "Usually, or they get it after a look.",
    asd: "They need the words. They miss the face. They take the joke as real.",
    why: "Reading nonverbal. Words-only households still use looks for ‘enough.’",
  },
  {
    id: "a2-sad-angry",
    domain: "A2",
    audience: "parent",
    prompt: "Sad face versus angry face: do they tell them apart, or do those faces look the same / they guess?",
    typical: "They can tell them apart in everyday life.",
    asd: "They mix them, say I dont know, or only know after you label it.",
    why: "Concrete A2. You can also ask them to show each face.",
  },
  {
    id: "a2-share-point",
    domain: "A2",
    audience: "parent",
    prompt: "Pointing or showing: is it ever just to share (‘look’), or only to get (‘I want that’)?",
    typical: "Both exist, or share-point was there when younger.",
    asd: "Point / show only to get.",
    why: "Same declarative/imperative split as A1, on the nonverbal channel.",
  },
  {
    id: "a2-space",
    domain: "A2",
    audience: "parent",
    prompt: "Personal space: do they know how close to stand, or get too close and not notice you want them to back off until you say it?",
    typical: "Mostly know, or they notice the look.",
    asd: "Frequent encroachment. Words required to stop.",
    why: "Body language used to regulate interaction.",
  },
  {
    id: "a2-early-gaze",
    domain: "A2",
    audience: "parent",
    prompt: "From early on: did they dislike being looked at, need prompts to greet, or was gaze and greeting ordinary?",
    typical: "Ordinary enough, or look-away only when in trouble.",
    asd: "From early years they did not like being looked at, or greeting needed a prompt every time.",
    why: "A2 needs early or pervasive pattern, not one shy clinic hour.",
  },
  {
    id: "a2-session",
    domain: "A2",
    audience: "session",
    prompt: "In this session: did they look at you on turns, use any gesture, and match face to content — or eyes on the screen / blank / no gesture?",
    typical: "Enough face and gesture for the context, or sample invalid (device, light, anxiety).",
    asd: "Little or no integration, and parent history matches.",
    why: "Observe. Do not ask them to describe their own eye contact.",
  },

  {
    id: "a3-name-when",
    domain: "A3",
    audience: "parent",
    prompt: "Name one person. When did they last see them outside school, sport training, or a screen?",
    typical: "A real contact outside an organised slot, even if rare.",
    asd: "Never, or only if you arrange it and stay.",
    why: "Proximity in class or Discord is not a relationship.",
  },
  {
    id: "a3-together",
    domain: "A3",
    audience: "parent",
    prompt: "What do they do with that person that is not a game, a drill, or sitting near them?",
    typical: "Something two-way: talk, make, go, repair.",
    asd: "Same activity side by side. No mutual topic outside the activity.",
    why: "Companionship is not A3 intact.",
  },
  {
    id: "a3-upset",
    domain: "A3",
    audience: "parent",
    prompt: "If that person was upset, what would yours do?",
    typical: "Notice, fetch an adult, or try something kind — even clumsily.",
    asd: "Not notice, get annoyed, or only act if told.",
    why: "Understanding the other person in the relationship.",
  },
  {
    id: "a3-repair",
    domain: "A3",
    audience: "parent",
    prompt: "After a conflict with a peer: who repairs — them, you, or it just ends?",
    typical: "They can repair sometimes, or accept help to repair.",
    asd: "You always repair, or they do not see there was a rupture.",
    why: "Maintaining a relationship.",
  },
  {
    id: "a3-twoway",
    domain: "A3",
    audience: "parent",
    prompt: "Is it two-way: they go to that person and that person comes to them?",
    typical: "Both directions, even if uneven.",
    asd: "One direction, or only when the activity is theirs.",
    why: "Mutuality, not a helper or a controlled playmate.",
  },
  {
    id: "a3-rules",
    domain: "A3",
    audience: "parent",
    prompt: "Jokes, hints, unwritten group rules: do they usually get them, or take them as real and then blow up or copy the wrong instruction?",
    typical: "Mostly get them, or they ask.",
    asd: "Literal, copy a peer’s instruction, or conflict without seeing why.",
    why: "Social understanding. Peer said punch mum is here, not ‘good compliance.’",
  },
  {
    id: "a3-control",
    domain: "A3",
    audience: "parent",
    prompt: "Play dates or group play: share and take turns, or they run it / leave if it is not their plan — and you have to hover?",
    typical: "Imperfect but they can share without you as referee every time.",
    asd: "Control, no turns, you hover, conflict is the usual ending.",
    why: "Adjustment across social context.",
  },
  {
    id: "a3-why-friend",
    domain: "A3",
    audience: "session",
    prompt: "Ask them: name one person. Why them? Listen for ‘they help me / we like the same game’ versus ‘we talk / they get me.’",
    typical: "Some mutual reason, even simple.",
    asd: "Only help, same game, or I dont know — and they cannot say what that person likes.",
    why: "Activity-based versus reciprocal. If they cannot say why, that is data.",
  },
];

export type AScreenAnswers = Record<string, AScreenChoice>;

export type DomainResult = {
  domain: Exclude<AScreenDomain, "G0">;
  verdict: DomainVerdict;
  asdHits: number;
  typicalHits: number;
  answered: number;
  total: number;
  reason: string;
};

export type AScreenResult = {
  informant: "usable" | "weak";
  dietConfound: boolean;
  a1: DomainResult;
  a2: DomainResult;
  a3: DomainResult;
  threshold: "not_autism" | "a_supported" | "inconclusive";
  headline: string;
  detail: string;
};

function itemsFor(domain: AScreenDomain): AScreenItem[] {
  return A_SCREEN_ITEMS.filter((item) => item.domain === domain);
}

function count(answers: AScreenAnswers, ids: string[], choice: AScreenChoice): number {
  return ids.filter((id) => answers[id] === choice).length;
}

export function scoreAScreen(answers: AScreenAnswers): AScreenResult {
  const g0 = itemsFor("G0");
  const g0Ids = g0.map((item) => item.id);
  const sequenceOk = answers["g0-sequence"] === "typical";
  const disconfirmOk = answers["g0-disconfirm"] === "typical";
  const secondSourceOk = answers["g0-second-source"] === "typical";
  const informant: "usable" | "weak" =
    sequenceOk && (disconfirmOk || secondSourceOk) ? "usable" : "weak";

  const phonesAwayUnlocks = answers["g0-available"] === "typical";
  const thinDiet = answers["g0-phones"] === "asd";
  const dietConfound = phonesAwayUnlocks || thinDiet;

  const a1 = scoreA1(answers, informant, dietConfound);
  const a2 = scoreDomain("A2", answers, informant, 3, 3);
  const a3 = scoreDomain("A3", answers, informant, 3, 3);

  let threshold: AScreenResult["threshold"] = "inconclusive";
  let headline = "A1–A3 inconclusive on current answers.";
  let detail =
    "Need more operational examples, or a usable informant, before you write Supported or Not met.";

  if (a1.verdict === "not_met" || a2.verdict === "not_met" || a3.verdict === "not_met") {
    threshold = "not_autism";
    const missed = [a1, a2, a3]
      .filter((row) => row.verdict === "not_met")
      .map((row) => row.domain)
      .join(", ");
    headline = `Social communication threshold not met (${missed}). This is not autism on current evidence.`;
    detail =
      "DSM-5-TR requires all of A1, A2, and A3. One clear miss ends ASD. Do not keep hunting B to rescue it.";
  } else if (
    a1.verdict === "supported" &&
    a2.verdict === "supported" &&
    a3.verdict === "supported"
  ) {
    threshold = "a_supported";
    headline = "A1–A3 supported. Still not a diagnosis — you still need B (≥2 of 4), C, D, and E.";
    detail =
      "Social-communication threshold is present. Stop. Do not call autism until restricted/repetitive, onset, impairment, and the ID/GDD differential are done.";
  } else if (informant === "weak") {
    headline = "Informant is not yet usable. Do not write Supported A from adjectives.";
    detail =
      "Get a turn sequence, a counter-example, or a teacher source. Clinic silence is not A1.";
  }

  return { informant, dietConfound, a1, a2, a3, threshold, headline, detail };
}

function scoreA1(
  answers: AScreenAnswers,
  informant: "usable" | "weak",
  dietConfound: boolean
): DomainResult {
  const quality = A_SCREEN_ITEMS.filter((item) => item.a1Quality);
  const ids = quality.map((item) => item.id);
  const asdHits = count(answers, ids, "asd");
  const typicalHits = count(answers, ids, "typical");
  const answered = ids.filter((id) => answers[id] && answers[id] !== "invalid").length;
  const afterDemandTypical = answers["a1-after-demand"] === "typical";
  const availableUnlocks = answers["g0-available"] === "typical";

  let verdict: DomainVerdict = "abstain";
  let reason = "Not enough other-oriented probes yet.";

  if (typicalHits >= 3 && (afterDemandTypical || typicalHits >= 4)) {
    verdict = "not_met";
    reason =
      "Other-oriented turns appear when a demand is not running. Demanding or ‘will not talk about their day’ is not A1.";
  } else if (availableUnlocks && asdHits < 4) {
    verdict = "not_met";
    reason = "Talk appears when an adult is actually available. That is diet, not A1.";
  } else if (asdHits >= 4 && typicalHits <= 1 && informant === "usable") {
    verdict = "supported";
    reason = "Other-oriented probes fail across settings and time, and the informant gave sequences.";
  } else if (asdHits >= 5 && informant === "weak") {
    verdict = "supported";
    reason = "Quality probes are consistently one-way even though the informant is thin. Still get a second source.";
  } else if (dietConfound && asdHits < 4) {
    verdict = "abstain";
    reason = "Home diet is thin. Do not Support A1 until phones-down and after-demand probes are done.";
  } else if (answered >= 4) {
    verdict = "abstain";
    reason = "Mixed. Need after-demand plus your-topic plus one historical share item.";
  }

  return {
    domain: "A1",
    verdict,
    asdHits,
    typicalHits,
    answered,
    total: ids.length,
    reason,
  };
}

function scoreDomain(
  domain: "A2" | "A3",
  answers: AScreenAnswers,
  informant: "usable" | "weak",
  supportAt: number,
  notMetAt: number
): DomainResult {
  const items = itemsFor(domain);
  const ids = items.map((item) => item.id);
  const asdHits = count(answers, ids, "asd");
  const typicalHits = count(answers, ids, "typical");
  const answered = ids.filter((id) => answers[id] && answers[id] !== "invalid").length;

  let verdict: DomainVerdict = "abstain";
  let reason = `Not enough ${domain} probes yet.`;

  if (typicalHits >= notMetAt && asdHits <= 1) {
    verdict = "not_met";
    reason = `${domain} looks intact on operational items.`;
  } else if (asdHits >= supportAt && typicalHits <= 1 && (informant === "usable" || asdHits >= supportAt + 1)) {
    verdict = "supported";
    reason = `${domain} differences are consistent on operational items.`;
  } else if (answered >= 4) {
    verdict = "abstain";
    reason = `${domain} is mixed. Do not force a 2.`;
  }

  return { domain, verdict, asdHits, typicalHits, answered, total: ids.length, reason };
}

export function formatAScreenNotes(answers: AScreenAnswers): string {
  const scored = scoreAScreen(answers);
  const lines = A_SCREEN_ITEMS.filter((item) => answers[item.id]).map((item) => {
    const choice = answers[item.id];
    const label =
      choice === "typical"
        ? item.typical
        : choice === "asd"
          ? item.asd
          : choice === "invalid"
            ? "Invalid sample"
            : "Unsure";
    return `- [${item.domain} / ${item.audience}] ${item.prompt} → ${label}`;
  });
  if (!lines.length) return "";
  return [
    "Modern A1–A3 screen",
    scored.headline,
    scored.detail,
    `Informant: ${scored.informant}. Diet confound: ${scored.dietConfound ? "yes" : "no"}.`,
    `A1 ${scored.a1.verdict} — ${scored.a1.reason}`,
    `A2 ${scored.a2.verdict} — ${scored.a2.reason}`,
    `A3 ${scored.a3.verdict} — ${scored.a3.reason}`,
    "",
    ...lines,
  ].join("\n");
}

export function domainLabel(domain: AScreenDomain): string {
  if (domain === "G0") return "Informant and home diet";
  if (domain === "A1") return "Reciprocity (other-oriented turns)";
  if (domain === "A2") return "Nonverbal";
  return "Relationships";
}
