/**
 * Parent-facing A1–A3 screen.
 * Scenes first. Reverse item after each scene. Validity is not a criterion.
 * If any of A1–A3 is not met, autism is not met.
 */

export const PARENT_SCREEN_STORAGE_KEY = "texlex-parent-a-screen-v3";

export type ParentChoice = "typical" | "asd" | "google" | "unsure";
export type ParentDomain = "teach" | "A1" | "A2" | "A3";
export type ItemKind = "scene" | "question" | "reverse";
export type ParentVerdict = "supported" | "not_met" | "abstain";
export type ScreenOutcome = "not_autism" | "social_pattern" | "cannot_say";
export type ScoreBucket = "A1" | "A2" | "A3" | "validity" | "teach";

export type ChildProfile = {
  dateOfBirth: string;
  schoolYear: string;
  gender: "girl" | "boy" | "another" | "prefer_not";
  known: Array<"none" | "dld" | "gdd" | "id" | "adhd" | "hearing">;
};

export type ParentOption = {
  key: ParentChoice;
  text: string;
};

export type ParentItem = {
  id: string;
  domain: ParentDomain;
  kind: ItemKind;
  scores: ScoreBucket;
  setup?: string;
  prompt: string;
  help?: string;
  options: ParentOption[];
  followOf?: string;
  skipIfUnderYears?: number;
  skipIfOverYears?: number;
};

export const SCHOOL_YEARS = [
  "Kindy",
  "Pre-primary",
  "Year 1",
  "Year 2",
  "Year 3",
  "Year 4",
  "Year 5",
  "Year 6",
  "Year 7",
  "Year 8",
  "Year 9",
  "Year 10",
  "Year 11",
  "Year 12",
] as const;

export const PARENT_ITEMS: ParentItem[] = [
  {
    id: "teach-real",
    domain: "teach",
    kind: "question",
    scores: "teach",
    prompt: "Are you filling this in about a child you live with or look after most weeks?",
    help: "We do not ask their name. We still need a real household.",
    options: [
      {
        key: "typical",
        text: "Yes. I live with them or look after them most weeks.",
      },
      {
        key: "asd",
        text: "No. I’m just looking.",
      },
    ],
  },

  {
    id: "a1-reason",
    domain: "A1",
    kind: "question",
    scores: "A1",
    setup: "Think about home. Kitchen, couch, your bedroom door. Not school. Not a clinic.",
    prompt: "When they come up to talk to you, what is the most common reason?",
    help: "Most common. Not the best day and not the worst day.",
    options: [
      {
        key: "asd",
        text: "They want something. Food, the iPad, a lift, help with a thing.",
      },
      {
        key: "asd",
        text: "They want me to fix something. It’s broken, it’s not fair, they can’t log in.",
      },
      {
        key: "typical",
        text: "They want to tell me something or show me something. They don’t need me to do anything.",
      },
      {
        key: "typical",
        text: "They want a cuddle, a sit, or just to be near me.",
      },
      {
        key: "asd",
        text: "They almost never come over to talk. I go to them.",
      },
    ],
  },
  {
    id: "a1-greet-young",
    domain: "A1",
    kind: "question",
    scores: "A1",
    setup: "Think back to when they were little — kindy, pre-primary, first years of school.",
    prompt: "If someone they knew walked in — Nan, Pop, a neighbour, another parent at the gate — did they say hello on their own?",
    help: "On their own means you did not have to say “say hello.”",
    options: [
      {
        key: "typical",
        text: "Yes. Hi, hello, a wave. They started it.",
      },
      {
        key: "asd",
        text: "Only if I said “say hello to Nan” or “say hi.”",
      },
      {
        key: "asd",
        text: "They didn’t really greet people, even people they knew.",
      },
      {
        key: "unsure",
        text: "I can’t remember that far back.",
      },
    ],
  },
  {
    id: "a1-greet-start",
    domain: "A1",
    kind: "question",
    scores: "A1",
    prompt: "Most kids just get that you start with hello, then you talk. Did yours pick that up on their own?",
    help: "This is about starting with people, not whether they are polite at the shops.",
    options: [
      {
        key: "typical",
        text: "Yes. They’d start with hi, a wave, or coming over, then the rest.",
      },
      {
        key: "asd",
        text: "I had to prompt it every time. It never became natural.",
      },
      {
        key: "asd",
        text: "They still walk up and start on what they want. No hello. Or they don’t start at all.",
      },
    ],
  },
  {
    id: "a1-after-got",
    domain: "A1",
    kind: "question",
    scores: "A1",
    prompt: "Once they have what they came for — the snack, the iPad, the thing you fixed — what happens?",
    options: [
      {
        key: "typical",
        text: "They can still stay and talk a bit. Not another ask.",
      },
      {
        key: "asd",
        text: "That’s the end. Or the next thing is another ask.",
      },
    ],
  },
  {
    id: "a1-show-young",
    domain: "A1",
    kind: "question",
    scores: "A1",
    prompt: "When they were little, if they found something — a stick, a drawing, a bug, something on the iPad — what did they do?",
    options: [
      {
        key: "typical",
        text: "They brought it to show me. “Look.” They didn’t need me to open it or fix it.",
      },
      {
        key: "asd",
        text: "They brought it so I would do something. Open it, fix it, buy it.",
      },
      {
        key: "asd",
        text: "They didn’t really bring me things.",
      },
    ],
  },
  {
    id: "a1-pickup",
    domain: "A1",
    kind: "question",
    scores: "A1",
    prompt: "After school a lot of kids say “fine” and go to their room. That’s normal here. Later that arvo, do they still come to you?",
    help: "Not wanting to recap school is not the test.",
    options: [
      {
        key: "typical",
        text: "Later they still come to tell me something or just be around.",
      },
      {
        key: "asd",
        text: "Later they only come if they want something.",
      },
      {
        key: "google",
        text: "I read that not talking after school means autism, so I’m going with that.",
      },
    ],
  },

  {
    id: "a2-want-you",
    domain: "A2",
    kind: "question",
    scores: "A2",
    prompt: "When they want something they can’t get themselves — a jar, a zip, a login — what do they usually do?",
    options: [
      {
        key: "typical",
        text: "They come to me and look at me, hold it up, or say Mum or Dad.",
      },
      {
        key: "asd",
        text: "They grab my hand and put it on the thing. Or they get upset at the thing. They don’t really look at me.",
      },
    ],
  },
  {
    id: "a2-over-it",
    domain: "A2",
    kind: "question",
    scores: "A2",
    prompt: "Can they tell you are done or annoyed without you saying it in words?",
    options: [
      {
        key: "typical",
        text: "Usually. They read my face or how I sound.",
      },
      {
        key: "asd",
        text: "I have to say it. A look is not enough.",
      },
    ],
  },
  {
    id: "a2-look",
    domain: "A2",
    kind: "question",
    scores: "A2",
    prompt: "When they point or show you something, is it ever just “look at that”?",
    options: [
      {
        key: "typical",
        text: "Yes, sometimes. A plane, a dog, a video. They want me to see it.",
      },
      {
        key: "asd",
        text: "No. Pointing and showing are only if they want it.",
      },
    ],
  },

  {
    id: "a3-mate",
    domain: "A3",
    kind: "question",
    scores: "A3",
    prompt: "Can you think of one kid they would call a friend or a mate? Don’t type the name.",
    options: [
      {
        key: "typical",
        text: "Yes. There is at least one.",
      },
      {
        key: "asd",
        text: "Only kids in their class or on a game. Or I can’t think of anyone.",
      },
    ],
  },
  {
    id: "a3-see-them",
    domain: "A3",
    kind: "question",
    scores: "A3",
    prompt: "When did they last see that kid outside school, sport training, or a screen?",
    options: [
      {
        key: "typical",
        text: "Sometime this year, even if I set it up.",
      },
      {
        key: "asd",
        text: "Never, or only if I stay and run it.",
      },
      {
        key: "asd",
        text: "There isn’t a kid like that.",
      },
    ],
  },
  {
    id: "a3-upset",
    domain: "A3",
    kind: "question",
    scores: "A3",
    prompt: "If that kid was upset, what would yours usually do?",
    options: [
      {
        key: "typical",
        text: "Notice, tell an adult, or try something — even if it’s awkward.",
      },
      {
        key: "asd",
        text: "Not notice, get annoyed, or only do something if I tell them.",
      },
    ],
  },
  {
    id: "a3-fight",
    domain: "A3",
    kind: "question",
    scores: "A3",
    prompt: "After a falling-out with another kid, who sorts it?",
    options: [
      {
        key: "typical",
        text: "They can make up sometimes, or they let me help and they can see it went wrong.",
      },
      {
        key: "asd",
        text: "I always sort it, or they don’t see there was a problem.",
      },
    ],
  },
];

export const PARENT_EXPLAIN = {
  title: "How this works",
  lead: "Straight questions. Pick the answer that is most like your child most weeks. We start with why they come to you, and whether they said hello on their own when they were little. If those are not there, it is not autism.",
  a1: {
    title: "Starting with people",
    body: "Why they come up to you. Whether they said hello on their own. Whether they got that hello is how you start — not only when you tell them to.",
  },
  a2: {
    title: "Your face",
    body: "Whether they look at you when they need you, and whether they can tell you are done without the words.",
  },
  a3: {
    title: "A mate",
    body: "One kid who is a person, not only a class photo or a game.",
  },
  time: "Most people do six to ten questions. We stop as soon as we can.",
};

export function ageYearsFromDob(iso: string, now = new Date()): number | null {
  if (!iso) return null;
  const dob = new Date(iso);
  if (Number.isNaN(dob.getTime())) return null;
  let years = now.getFullYear() - dob.getFullYear();
  const monthDelta = now.getMonth() - dob.getMonth();
  if (monthDelta < 0 || (monthDelta === 0 && now.getDate() < dob.getDate())) years -= 1;
  return years;
}

export function itemsForAge(ageYears: number | null): ParentItem[] {
  return PARENT_ITEMS.filter((item) => {
    if (item.skipIfUnderYears != null && ageYears != null && ageYears < item.skipIfUnderYears) return false;
    if (item.skipIfOverYears != null && ageYears != null && ageYears >= item.skipIfOverYears) return false;
    return true;
  });
}

export type ParentAnswers = Record<string, ParentChoice>;

type DomainScore = {
  domain: Exclude<ParentDomain, "teach">;
  verdict: ParentVerdict;
  typical: number;
  asd: number;
  asked: number;
};

export type ParentScreenState = {
  answers: ParentAnswers;
  askedIds: string[];
  done: boolean;
  outcome: ScreenOutcome | null;
  a1: DomainScore;
  a2: DomainScore;
  a3: DomainScore;
  googleHits: number;
  headline: string;
  body: string;
  nextItem: ParentItem | null;
  progress: { asked: number; min: number; max: number };
};

function available(ageYears: number | null): ParentItem[] {
  return itemsForAge(ageYears);
}

function domainScoringIds(domain: Exclude<ParentDomain, "teach">, ageYears: number | null): string[] {
  return available(ageYears)
    .filter((item) => item.scores === domain)
    .map((item) => item.id);
}

function tally(ids: string[], answers: ParentAnswers): { typical: number; asd: number; unsure: number; asked: number } {
  let typical = 0;
  let asd = 0;
  let unsure = 0;
  for (const id of ids) {
    const choice = answers[id];
    if (!choice) continue;
    if (choice === "typical") typical += 1;
    else if (choice === "asd") asd += 1;
    else unsure += 1;
  }
  return { typical, asd, unsure, asked: typical + asd + unsure };
}

function scoreDomain(
  domain: Exclude<ParentDomain, "teach">,
  answers: ParentAnswers,
  ageYears: number | null,
  supportAt: number,
  notMetAt: number
): DomainScore {
  const ids = domainScoringIds(domain, ageYears);
  const { typical, asd, asked } = tally(ids, answers);
  let verdict: ParentVerdict = "abstain";
  if (typical >= notMetAt && asd <= 1) verdict = "not_met";
  else if (asd >= supportAt && typical <= 1) verdict = "supported";
  return { domain, verdict, typical, asd, asked };
}

function scoreA1(answers: ParentAnswers, ageYears: number | null): DomainScore {
  const base = scoreDomain("A1", answers, ageYears, 3, 2);
  const reasonTypical = answers["a1-reason"] === "typical";
  const greetTypical = answers["a1-greet-young"] === "typical";
  const startTypical = answers["a1-greet-start"] === "typical";
  const afterGotTypical = answers["a1-after-got"] === "typical";
  const pickupTypical = answers["a1-pickup"] === "typical";
  const reasonAsd = answers["a1-reason"] === "asd";
  const greetAsd = answers["a1-greet-young"] === "asd";
  const startAsd = answers["a1-greet-start"] === "asd";
  const greetAsked = Boolean(answers["a1-greet-young"]);
  const startAsked = Boolean(answers["a1-greet-start"]);

  // Always hear reason + greeting + start before we close A1.
  if (reasonTypical && greetTypical && startAsked) {
    return { ...base, verdict: "not_met" };
  }
  if (reasonTypical && startTypical && greetAsked) {
    return { ...base, verdict: "not_met" };
  }
  if ((afterGotTypical || pickupTypical) && reasonTypical && greetTypical && base.asd <= 1) {
    return { ...base, verdict: "not_met" };
  }
  if (reasonAsd && greetAsd && startAsd) {
    return { ...base, verdict: "supported" };
  }
  return base;
}

export function googleHits(answers: ParentAnswers): number {
  return Object.values(answers).filter((choice) => choice === "google").length;
}

function followUpFor(itemId: string, ageYears: number | null): ParentItem | undefined {
  return available(ageYears).find((item) => item.followOf === itemId);
}

export function nextParentItem(
  answers: ParentAnswers,
  ageYears: number | null,
  knownGddOrDld: boolean
): ParentItem | null {
  const items = available(ageYears);
  const teach = items.filter((item) => item.domain === "teach");
  for (const item of teach) {
    if (!answers[item.id]) return item;
  }
  if (answers["teach-real"] === "asd") return null;
  if (googleHits(answers) >= 2) return null;

  const unansweredFollow = (id: string) => {
    const follow = followUpFor(id, ageYears);
    if (follow && !answers[follow.id]) return follow;
    return null;
  };

  const walkDomain = (domain: ParentDomain, verdict: ParentVerdict) => {
    if (verdict === "not_met") return "stop" as const;
    const queue = items.filter((item) => item.domain === domain && item.kind !== "reverse");
    for (const item of queue) {
      if (!answers[item.id]) return item;
      const follow = unansweredFollow(item.id);
      if (follow) return follow;
    }
    if (verdict === "supported") return "continue" as const;
    return "stop" as const;
  };

  const a1 = scoreA1(answers, ageYears);
  const a1Next = walkDomain("A1", a1.verdict);
  if (a1Next === "stop") return null;
  if (a1Next !== "continue") return a1Next;

  const a2 = scoreDomain("A2", answers, ageYears, knownGddOrDld ? 3 : 2, 2);
  const a2Next = walkDomain("A2", a2.verdict);
  if (a2Next === "stop") return null;
  if (a2Next !== "continue") return a2Next;

  const a3 = scoreDomain("A3", answers, ageYears, 2, 2);
  const a3Next = walkDomain("A3", a3.verdict);
  if (a3Next === "stop") return null;
  if (a3Next !== "continue") return a3Next;
  return null;
}

export function evaluateParentScreen(
  answers: ParentAnswers,
  ageYears: number | null,
  knownGddOrDld: boolean
): ParentScreenState {
  const a1 = scoreA1(answers, ageYears);
  const a2 = scoreDomain("A2", answers, ageYears, knownGddOrDld ? 3 : 2, 2);
  const a3 = scoreDomain("A3", answers, ageYears, 2, 2);
  const hits = googleHits(answers);
  const nextItem = nextParentItem(answers, ageYears, knownGddOrDld);
  const askedIds = PARENT_ITEMS.filter((item) => answers[item.id]).map((item) => item.id);
  const max = available(ageYears).length;
  const failedRealPerson = answers["teach-real"] === "asd";

  let outcome: ScreenOutcome | null = null;
  let headline = "";
  let body = "";
  let done = false;

  if (failedRealPerson) {
    done = true;
    outcome = "cannot_say";
    headline = "We cannot use this screen.";
    body = "It needs an adult who lives this house most weeks. That is how we keep it honest.";
  } else if (hits >= 2 && !nextItem) {
    done = true;
    outcome = "cannot_say";
    headline = "We cannot use these answers.";
    body =
      "A few of those picks were the internet sitting the exam. A real parent can still hate ‘how was your day’ and still have a child who comes in with a meme later. We will not guess from a list.";
  } else if (!nextItem) {
    done = true;
    if (a1.verdict === "not_met" || a2.verdict === "not_met" || a3.verdict === "not_met") {
      outcome = "not_autism";
      headline = "This does not look like the social part of autism.";
      body =
        "They come to you for more than an ask, or they said hello on their own when they were little. That is the social start. Autism needs that start to be missing. We stopped there. If you are still worried about attention, language, sleep, or behaviour, talk to your GP.";
    } else if (a1.verdict === "supported" && a2.verdict === "supported" && a3.verdict === "supported") {
      outcome = "social_pattern";
      headline = "A social-communication pattern is there.";
      body =
        "The most common reason they come to you is to get something or to get it fixed, they did not greet on their own, and they did not pick up that hello is how you start. That can be part of autism. It is not a diagnosis. The next step is a clinician — not this screen.";
    } else {
      outcome = "cannot_say";
      headline = "We cannot tell from this, so we will not guess.";
      body = "The answers did not line up, or we did not have enough of them. A second adult who knows the child, or a clinician, is the next step.";
    }
  }

  return {
    answers,
    askedIds,
    done,
    outcome,
    a1,
    a2,
    a3,
    googleHits: hits,
    headline,
    body,
    nextItem,
    progress: { asked: askedIds.length, min: 6, max },
  };
}

export function knownIncludesDelay(known: ChildProfile["known"]): boolean {
  return known.includes("dld") || known.includes("gdd") || known.includes("id");
}

export function optionsForRender(item: ParentItem): ParentOption[] {
  const extras = item.options.filter((option) => option.key === "google");
  const core = item.options.filter((option) => option.key !== "google");
  return extras.length ? [...core, ...extras] : core;
}
