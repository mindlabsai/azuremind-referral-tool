/**
 * Live synthetic test of /api/parent-screen/turn
 * Two parents: unsure mum of a 15yo girl; convinced-but-wrong dad of an 8yo boy.
 */
import { writeFileSync } from "node:fs";
import { A_FACETS } from "../lib/parent-a-conversation";
import { OPENING_BANK, QUESTION_BANK, ageBandFrom, bankStats } from "../lib/parent-a-question-bank";

const API = "http://localhost:3001/api/parent-screen/turn";

type Child = {
  dateOfBirth: string;
  schoolYear: string;
  gender: "girl" | "boy";
  known: string[];
};

type Belief = {
  polarity: string;
  frequency: string;
  confidence: number;
  quote: string;
};

type Close = {
  done: true;
  outcome: string;
  headline: string;
  body: string;
  a1: string;
  a2: string;
  a3: string;
} | null;

type TurnLog = {
  n: number;
  facetId: string | null;
  interviewer: string;
  parent: string | null;
};

function schoolYearFromAge(age: number): string {
  if (age < 5) return "Kindy";
  if (age === 5) return "Pre-primary";
  return `Year ${Math.min(12, Math.max(1, age - 5))}`;
}

function childFrom(age: number, gender: "girl" | "boy"): Child {
  return {
    dateOfBirth: `${new Date().getFullYear() - age}-06-15`,
    schoolYear: schoolYearFromAge(age),
    gender,
    known: ["none"],
  };
}

function bankFor(age: number) {
  const schoolYear = schoolYearFromAge(age);
  const band = ageBandFrom(age, schoolYear);
  const items = QUESTION_BANK.filter((item) => item.bands.includes(band));
  const openings = OPENING_BANK.filter((row) => row.bands.includes(band));
  const byFacet: Record<string, number> = {};
  for (const item of items) byFacet[item.facetId] = (byFacet[item.facetId] ?? 0) + 1;
  return {
    schoolYear,
    band,
    wordingVariants: items.length,
    openings: openings.length,
    facetsWithWording: Object.keys(byFacet).length,
    byFacet,
  };
}

function pick(hay: string, pairs: Array<[RegExp, string]>, fallback: string): string {
  for (const [re, line] of pairs) {
    if (re.test(hay)) return line;
  }
  return fallback;
}

/** Mum of a 15yo girl. Does not know. Wants to know. Hedges. Asks what counts. */
function unsureMum15(ask: string, turn: number): string {
  const q = ask.toLowerCase();
  return pick(
    q,
    [
      [
        /most common reason|why is|comes to your door|start talking|walk in|wifi|lift|money|login|request, a complaint/,
        "I don't actually know what the most common one is. Sometimes she wants the wifi or a lift, sometimes she just stands there and tells me something about a friend. I never counted. Does the wifi stuff count against her? That's what I keep wondering.",
      ],
      [
        /free for|only talk in the car|random arvo|weren't driving|catch you/,
        "I'm home most afternoons. We do talk in the car a lot though. Is car talk the same as her coming to me? I honestly don't know what you're scoring.",
      ],
      [
        /hello|hi |greet|nod|walk past|kindy|say hi|friend's parent|nan/,
        "When she was little… I think she said hello? I wasn't watching for it. Now she's fifteen. She'll nod at Nan. Sometimes she walks past. I don't know if a nod counts. Is that a teen thing or is that what you mean?",
      ],
      [
        /always, sometimes|how often|most visits|seldom|hardly|most times/,
        "I couldn't swear to it. Sometimes? Not always. I feel like I should have been paying more attention.",
      ],
      [
        /other place|shops|sport|work experience|pervasive|someone else's|mate's parent|prompt/,
        "At other people's houses she can go quiet. Sport I don't really see. I don't know if that's her being shy or something I should have noticed years ago.",
      ],
      [
        /same question|one topic|in depth|already answered|leave a topic|special interest/,
        "She can go on about one show, yeah. The same question again… maybe? Like what time are we leaving, after I already said. Is that the thing? I don't want to make it sound worse than it is.",
      ],
      [
        /after the lift|got what|stay in the conversation|door already|another ask/,
        "After she gets the lift she sometimes keeps talking. Sometimes she's gone. I don't know which one happens more.",
      ],
      [
        /meme|screenshot|just so you'll see|look vs|when they were little|stick or a drawing/,
        "She sends me stuff. I think so I can see it? Sometimes she wants me to buy it. When she was little I honestly can't remember if it was look or open this.",
      ],
      [
        /your day|nan's not well|come back|other-person|talk first|how was school/,
        "If I talk first… sometimes she asks a question. Sometimes she's on her phone. I don't know if that's every fifteen year old girl.",
      ],
      [
        /after school|debrief|door slam|later that night|after food|human turn/,
        "She doesn't want to debrief school. Later she might come out. I don't know if that's her coming to me as a person or she just wants food.",
      ],
      [
        /look at you|your face|form, a login|talk at the room|check your face/,
        "She looks at me when she wants a lift I think? Or she's looking at her phone. I'm not sure I ever watched her face.",
      ],
      [
        /annoyed|finished|jokes and tone|your face|without the words/,
        "Jokes — sometimes she gets them, sometimes she doesn't and I have to say I was joking. Does that mean something? That's why I came.",
      ],
      [
        /mate|friend|username|discord|class photo|one person|vanished from the game/,
        "There's a girl she talks about. I think they're friends. I don't know if it's a real friend or just school. I haven't met her mum. Is that enough?",
      ],
      [
        /outside school|not at school|not on a screen|organise|exist in/,
        "They've seen each other this year I think? Or was that only at school. I should know this. I feel like a bad parent.",
      ],
      [
        /upset|dumped|crying|notice/,
        "If that girl was upset… I don't know what mine would do. I'd like to think she'd notice. I've never asked.",
      ],
      [
        /falling-out|repair|hurt someone|sorry|vanish/,
        "If they fall out I usually hear about it from her, or I don't. I don't know who sorts it.",
      ],
    ],
    turn < 3
      ? "I don't know if I'm answering this right. I just want to know if I should be worried."
      : "I'm not sure. What would a normal answer even sound like?"
  );
}

/** Dad of an 8yo boy. Convinced it is autism. The facts are typical. */
function convincedDad8(ask: string, turn: number): string {
  const q = ask.toLowerCase();
  return pick(
    q,
    [
      [
        /most common reason|why is|comes up|started talking|walks into|request|snack|charger|mum you won't/,
        "He comes over just to tell me things — look at this, you won't believe this, nothing he needed me to do. I still think it's autism. I read the list. The snack stuff happens too but that's not why he starts.",
      ],
      [
        /around for a chat|catch you|phones are down|set times|car, dinner|stuck with/,
        "I'm usually around most days. He can catch me. It's not only the car. I sit with him. I still think the signs are there because TikTok said kids can look social at home.",
      ],
      [
        /hello|hi |greet|say hello|nan|school gate|kindy|known adult/,
        "He says hi on his own. Always has. Nan at the door, school gate — he started it, I didn't say say hello. I read that can still be autism if it's learned though.",
      ],
      [
        /always, sometimes|how often|most times|seldom|hardly|pick one/,
        "Always. Pretty much every time. I still don't trust it.",
      ],
      [
        /other place|shops|sport|school gate|someone else|prompt|just your kitchen|just at home/,
        "Shops, sport, someone else's house — he says hi there too, not just home. I still have to prompt? No. I don't. I just keep thinking about the list.",
      ],
      [
        /start with hello|walk up and start|natural first|straight into|hi, or straight/,
        "He picked it up. He starts with hi then he talks. It became natural. I still googled signs of autism last night.",
      ],
      [
        /same question|one game|one youtuber|already answered|already told you|move on/,
        "He moves on once I've answered. He doesn't keep asking it again. Favourite YouTuber yes, same question after a clear answer no.",
      ],
      [
        /once they have|give in|still a person|watch this|iPad or the login/,
        "Once he has the thing he still goes watch this. He stays and talks. Not another ask.",
      ],
      [
        /drawing or a video|look|open this|show you things|just to share/,
        "When he was four it was look. Now it's still look at this — wanted me to see it, not open this.",
      ],
      [
        /your day|work was a circus|come back|don't ask how was school/,
        "If I talk first about my day he comes back to it. Asked me why work was a circus last week.",
      ],
      [
        /after school|later that arvo|pickup|after they've eaten|charger/,
        "Pickup is a grunt, that's normal. Later after food he still comes to tell me something random. Not only if he wants something.",
      ],
      [
        /jar|zip|login|your face|hold it up|grab your wrist|pull you/,
        "He looks at me and holds it up. Says Dad. Not grab my wrist.",
      ],
      [
        /done or annoyed|woolies|your face is|without you saying|read that/,
        "He can tell. He reads my face. He knows when I'm done. I don't have to say the words.",
      ],
      [
        /plane|dog|video|look at that|just to share|showing only/,
        "He shows me just to share it. Look at that. Not only I want.",
      ],
      [
        /friend|mate|class photo|one kid|username|lobby/,
        "Yes. There's a mate. A face. Not only the class photo. They've been to our house.",
      ],
      [
        /outside school|last see|sleepover|birthday|only class/,
        "Last month he came over. Sleepover this year. Not only class and screens.",
      ],
      [
        /upset|crying|left out|dumped|clock it|notice/,
        "He notices. He'd tell me. Awkward but he clocks it. I don't have to say go see if they're ok.",
      ],
      [
        /falling-out|who sorts|make up|see the problem|something went wrong/,
        "He can say sorry. They make up. He knows it went wrong. I don't always fix it.",
      ],
    ],
    turn === 0
      ? "I already know it's autism. I read it online. I just need you to confirm it."
      : "That's still a sign in my head even if it sounds normal."
  );
}

async function postTurn(body: unknown) {
  const response = await fetch(API, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`HTTP ${response.status}: ${text.slice(0, 400)}`);
  }
  return (await response.json()) as {
    say: string;
    beliefs: Record<string, Belief>;
    close: Close;
    holdOn: boolean;
    facetId?: string | null;
    score?: { a1: string; a2: string; a3: string; lines: Array<{ domain: string; verdict: string; why: string }> };
    band?: string;
  };
}

async function runSession(options: {
  id: string;
  label: string;
  age: number;
  gender: "girl" | "boy";
  reply: (ask: string, turn: number) => string;
}) {
  const child = childFrom(options.age, options.gender);
  const seed = `synth-${options.id}-${Date.now().toString(36)}`;
  const usedAsks: Record<string, string[]> = {};
  const turns: Array<{ role: "assistant" | "parent"; text: string }> = [];
  const log: TurnLog[] = [];
  let beliefs: Record<string, Belief> = {};
  let close: Close = null;
  let score: { a1: string; a2: string; a3: string; lines: Array<{ domain: string; verdict: string; why: string }> } | null =
    null;
  let band = "";

  const first = await postTurn({
    child,
    ageYears: options.age,
    start: true,
    seed,
    usedAsks,
  });
  band = first.band ?? band;
  score = first.score ?? score;
  beliefs = first.beliefs;
  turns.push({ role: "assistant", text: first.say });
  if (first.facetId && first.say) {
    usedAsks[first.facetId] = [first.say, ...(usedAsks[first.facetId] ?? [])].slice(0, 2);
  }
  log.push({ n: 1, facetId: first.facetId ?? "open", interviewer: first.say, parent: null });

  for (let i = 0; i < 22; i += 1) {
    const lastAsk = turns.filter((t) => t.role === "assistant").at(-1)?.text ?? "";
    const parent = options.reply(lastAsk, i);
    log[log.length - 1]!.parent = parent;
    turns.push({ role: "parent", text: parent });

    const next = await postTurn({
      child,
      ageYears: options.age,
      beliefs,
      turns,
      lastParent: parent,
      seed,
      usedAsks,
    });
    band = next.band ?? band;
    score = next.score ?? score;
    beliefs = next.beliefs;
    close = next.close;
    turns.push({ role: "assistant", text: next.say });
    if (next.facetId && next.say) {
      usedAsks[next.facetId] = [next.say, ...(usedAsks[next.facetId] ?? [])].slice(0, 2);
    }
    log.push({ n: log.length + 1, facetId: next.facetId ?? "close", interviewer: next.say, parent: null });

    if (next.close?.done && next.close.outcome !== "paused") break;
  }

  const asked = Object.entries(beliefs)
    .filter(([, row]) => row.polarity !== "unknown")
    .map(([id, row]) => ({
      id,
      domain: A_FACETS.find((f) => f.id === id)?.domain ?? "?",
      title: A_FACETS.find((f) => f.id === id)?.title ?? id,
      polarity: row.polarity,
      frequency: row.frequency,
      quote: row.quote,
    }));

  return {
    id: options.id,
    label: options.label,
    age: options.age,
    gender: options.gender,
    schoolYear: child.schoolYear,
    band,
    interviewerQuestions: log.filter((row) => row.parent).length,
    parentAnswers: log.filter((row) => row.parent).length,
    closingLine: log.at(-1)?.interviewer ?? "",
    outcome: close?.outcome ?? "still_open",
    headline: close?.headline ?? "Did not close",
    body: close?.body ?? "",
    a1: score?.a1 ?? close?.a1 ?? "unknown",
    a2: score?.a2 ?? close?.a2 ?? "unknown",
    a3: score?.a3 ?? close?.a3 ?? "unknown",
    scoreLines: score?.lines ?? [],
    asked,
    log,
  };
}

async function main() {
  const stats = bankStats();
  const girl = bankFor(15);
  const boy = bankFor(8);
  const facets = A_FACETS.map((f) => ({ id: f.id, domain: f.domain, title: f.title }));

  console.error("bank", stats.items, "openings", OPENING_BANK.length);
  console.error("running girl 15…");
  const sessionGirl = await runSession({
    id: "girl-15-unsure",
    label: "Mum of a 15-year-old girl — does not know, wants to know",
    age: 15,
    gender: "girl",
    reply: unsureMum15,
  });
  console.error("girl done", sessionGirl.outcome, sessionGirl.interviewerQuestions);
  console.error("running boy 8…");
  const sessionBoy = await runSession({
    id: "boy-8-convinced",
    label: "Dad of an 8-year-old boy — convinced it is autism, facts are not",
    age: 8,
    gender: "boy",
    reply: convincedDad8,
  });
  console.error("boy done", sessionBoy.outcome, sessionBoy.interviewerQuestions);

  const out = {
    generatedAt: new Date().toISOString(),
    bank: {
      wordingItems: stats.items,
      openings: OPENING_BANK.length,
      facets: facets.length,
      byFacet: stats.byFacet,
      byBand: stats.byBand,
      a1Facets: facets.filter((f) => f.domain === "A1").length,
      a2Facets: facets.filter((f) => f.domain === "A2").length,
      a3Facets: facets.filter((f) => f.domain === "A3").length,
      a1GateFacets: [
        "approach_reason",
        "parent_available",
        "greet_spontaneous",
        "greet_frequency",
        "greet_pervasive",
        "topic_repeat",
      ],
      sessionMinIfA1NotMet: 6,
      sessionMaxIfAllDomains: 18,
    },
    locked: { girl15: girl, boy8: boy },
    sessions: [sessionGirl, sessionBoy],
  };

  writeFileSync("/tmp/synthetic-parent-screen.json", JSON.stringify(out, null, 2));
  console.log(JSON.stringify(out, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
