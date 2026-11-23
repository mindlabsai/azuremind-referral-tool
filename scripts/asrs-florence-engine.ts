/**
 * Map Florence Apps ASRS (2–5) parent + teacher item facts onto the A-screen,
 * score them directly, then speak those facts into the live turn API.
 */
import { writeFileSync } from "node:fs";
import {
  A_FACETS,
  applyUpdates,
  closeFromBeliefs,
  emptyBeliefs,
  scoreCard,
  type Belief,
  type Polarity,
  type Frequency,
} from "../lib/parent-a-conversation";

const API = "http://localhost:3001/api/parent-screen/turn";

type Child = {
  dateOfBirth: string;
  schoolYear: string;
  gender: "girl" | "boy";
  known: string[];
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

const CHILD: Child = {
  dateOfBirth: "2022-06-15",
  schoolYear: "Kindy",
  gender: "girl",
  known: ["none"],
};

function setBelief(
  beliefs: Record<string, Belief>,
  id: string,
  polarity: Polarity,
  frequency: Frequency,
  quote: string
) {
  return applyUpdates(beliefs, [{ id, polarity, frequency, quote, confidence: 0.85 }]);
}

function pack(beliefs: Record<string, Belief>, label: string) {
  const score = scoreCard(beliefs);
  const close = closeFromBeliefs(beliefs);
  const asked = A_FACETS.filter((f) => beliefs[f.id]?.polarity !== "unknown").map((f) => ({
    id: f.id,
    domain: f.domain,
    title: f.title,
    polarity: beliefs[f.id].polarity,
    frequency: beliefs[f.id].frequency,
    quote: beliefs[f.id].quote,
  }));
  return {
    label,
    a1: score.a1,
    a2: score.a2,
    a3: score.a3,
    outcome: close?.outcome ?? "still_open",
    headline: close?.headline ?? "Did not close",
    body: close?.body ?? "",
    lines: score.lines,
    asked,
  };
}

/** Parent ASRS: social facts only. topic_repeat left typical because the form never asked re-ask. */
function parentStrict() {
  let b = emptyBeliefs();
  b = setBelief(b, "approach_reason", "typical", "always", "Starts conversations very frequently; shares enjoyment frequently; also fails to make needs known very frequently");
  b = setBelief(b, "parent_available", "typical", "always", "Home rater; with her most days");
  b = setBelief(b, "greet_spontaneous", "typical", "always", "Starts conversations very frequently; plays with others very frequently");
  b = setBelief(b, "greet_frequency", "typical", "always", "Start conversations = very frequently");
  b = setBelief(b, "greet_pervasive", "typical", "always", "Seeks other children very frequently; plays with others very frequently");
  b = setBelief(b, "greet_as_start", "typical", "always", "Starts conversations very frequently");
  b = setBelief(b, "topic_repeat", "typical", "unknown", "Off-topic questions are very frequent; form did not ask same-question-after-answered");
  b = setBelief(b, "show_to_share", "typical", "sometimes", "Shares enjoyment frequently; make-believe very frequently");
  b = setBelief(b, "other_oriented", "typical", "sometimes", "Interest in others' ideas frequently; cares what others feel only occasionally");
  b = setBelief(b, "pickup_confound", "typical", "sometimes", "Seeks children very frequently at home");
  b = setBelief(b, "request_gaze", "asd", "always", "Avoids looking at an adult when there is a problem — very frequently; looks when talking only occasionally");
  b = setBelief(b, "read_affect", "asd", "seldom", "Notices social cues rarely; age-appropriate humour rarely");
  b = setBelief(b, "point_share", "typical", "sometimes", "Shares enjoyment frequently");
  b = setBelief(b, "one_mate", "typical", "always", "Plays with others very frequently; seeks company very frequently; also social problems with same-age children frequently");
  b = setBelief(b, "outside_school", "typical", "sometimes", "Plays with others very frequently");
  b = setBelief(b, "notice_distress", "asd", "sometimes", "Understands how someone felt only occasionally");
  b = setBelief(b, "repair", "unknown", "unknown", "Form did not ask who sorts a fight");
  return pack(b, "Parent ASRS mapped strictly (re-ask not assumed)");
}

/** Parent ASRS: treat off-topic + echo + one-subject as topic_repeat asd. */
function parentLooseTopic() {
  let b = emptyBeliefs();
  const base = parentStrict();
  void base;
  b = emptyBeliefs();
  b = setBelief(b, "approach_reason", "typical", "always", "Starts conversations very frequently");
  b = setBelief(b, "parent_available", "typical", "always", "Home rater");
  b = setBelief(b, "greet_spontaneous", "typical", "always", "Starts conversations very frequently");
  b = setBelief(b, "greet_frequency", "typical", "always", "very frequently");
  b = setBelief(b, "greet_pervasive", "typical", "always", "Seeks children very frequently");
  b = setBelief(b, "topic_repeat", "asd", "always", "Off-topic questions very frequently; talks about things other children don't care about frequently; echoes frequently");
  b = setBelief(b, "request_gaze", "asd", "always", "Avoids looking at adult when problem very frequently");
  b = setBelief(b, "read_affect", "asd", "seldom", "Social cues rarely; humour rarely");
  b = setBelief(b, "point_share", "typical", "sometimes", "Shares enjoyment frequently");
  b = setBelief(b, "one_mate", "typical", "always", "Plays with others very frequently");
  b = setBelief(b, "outside_school", "typical", "sometimes", "Plays with others");
  b = setBelief(b, "notice_distress", "asd", "sometimes", "Understands feelings only occasionally");
  return pack(b, "Parent ASRS mapped loosely (off-topic counted as topic-repeat)");
}

/** Teacher ASRS: weaker initiation, parallel play, flat affect. */
function teacherMap() {
  let b = emptyBeliefs();
  b = setBelief(b, "approach_reason", "asd", "sometimes", "Starts conversations only occasionally; keep a conversation going only occasionally");
  b = setBelief(b, "parent_available", "typical", "always", "Teacher is present in the room most of the session");
  b = setBelief(b, "greet_spontaneous", "asd", "sometimes", "Starts conversations only occasionally at kindy");
  b = setBelief(b, "greet_frequency", "typical", "sometimes", "Occasionally");
  b = setBelief(b, "greet_pervasive", "asd", "sometimes", "Kindy: plays next to, not with, other children frequently");
  b = setBelief(b, "greet_as_start", "asd", "sometimes", "Starts conversations only occasionally");
  b = setBelief(b, "topic_repeat", "typical", "seldom", "Focus on one subject rarely; echo never");
  b = setBelief(b, "show_to_share", "asd", "sometimes", "Share enjoyment only occasionally; shows little emotion frequently");
  b = setBelief(b, "other_oriented", "asd", "sometimes", "Interest in others' ideas only occasionally");
  b = setBelief(b, "request_gaze", "typical", "sometimes", "Looks when talking frequently; avoid look when problem only occasionally");
  b = setBelief(b, "read_affect", "asd", "seldom", "Humour rarely; shows little emotion frequently");
  b = setBelief(b, "point_share", "asd", "sometimes", "Share enjoyment only occasionally");
  b = setBelief(b, "one_mate", "asd", "sometimes", "Plays next to not with frequently; seek company only occasionally; humour rarely");
  b = setBelief(b, "outside_school", "unknown", "unknown", "Teacher cannot rate home play");
  b = setBelief(b, "notice_distress", "asd", "sometimes", "Understand how someone felt only occasionally");
  b = setBelief(b, "repair", "unknown", "unknown", "Not asked");
  return pack(b, "Teacher ASRS mapped");
}

function pick(hay: string, pairs: Array<[RegExp, string]>, fallback: string): string {
  for (const [re, line] of pairs) {
    if (re.test(hay)) return line;
  }
  return fallback;
}

function parentAsrsReply(ask: string): string {
  const q = ask.toLowerCase();
  return pick(
    q,
    [
      [
        /most common reason|why is|comes up|kitchen|snack|look|i want|help me|nothing is wrong/,
        "She starts conversations with me very frequently — she comes over to play, to show me something, to share that she's having fun. That's frequent. What she cannot do is make her needs known. That's very frequent. She also asks questions that are off the topic, very frequently. The coming-over is not just a snack.",
      ],
      [
        /floor|in the room|set times|bath|dinner|the car|free enough|catch you|highchair/,
        "I'm with her at home most days. She can catch me. It's not only bath and the car.",
      ],
      [
        /hello|hi |wave|nan|pop|neighbour|kindy|drop-off|say bye|prompt/,
        "She starts talking to people very frequently. A smile is frequent. Looking at your face while she talks is only occasional. I don't know if she says hello first or just launches in. At kindy I wasn't standing at the door.",
      ],
      [
        /always, sometimes|how often|most times|seldom|hardly|pick one/,
        "The starting-to-talk is very frequent. The looking at faces is only occasional.",
      ],
      [
        /shops|playgroup|other|prompting|someone else|another child/,
        "At home she comes to people and she seeks other children very frequently. She plays with other children very frequently. Kindy might look different — I wasn't there for every greeting.",
      ],
      [
        /start with hi|wave, then|hello first|teaching it/,
        "She starts conversations very frequently. Whether that's a hello first or she just starts on the thing — the form didn't ask hello. She launches into talk a lot.",
      ],
      [
        /same question|already answered|one thing|show, a toy|where’s dad|move on/,
        "She asks off-topic questions very frequently. She talks about things other kids don't care about, frequently. She can stay on one subject occasionally. She repeats phrases and echoes what you said, frequently. I was not asked whether she asks the same question again after I've already answered. That's not the same as off-topic.",
      ],
      [
        /snack or the show|still show|disappeared|once they have/,
        "Once she's got the snack she still plays. She shares enjoyment frequently. Make-believe is very frequent. You haven't disappeared.",
      ],
      [
        /stick|drawing|bug|look|do this|just so you'll see/,
        "She shares fun activities frequently. She shares her enjoyment frequently. Make-believe play is very frequent. That's look, not only open this.",
      ],
      [
        /your day|nan's coming|come back|pick that up/,
        "Interest in other people's ideas — frequently. Caring what others think or feel — only occasionally. Noticing social cues — rarely.",
      ],
      [
        /after kindy|quiet|after food|only if they want/,
        "After kindy she's still a kid. At home she seeks other children very frequently. She plays with others very frequently.",
      ],
      [
        /lid or a zip|your face|hand as a tool|hold it up/,
        "When she's talking she looks at you only occasionally. If there's a problem with an adult she avoids looking — that's very frequent. Your face is not always in it.",
      ],
      [
        /done or annoyed|a look|park|without the words/,
        "Understanding how someone else felt is only occasional. Social cues she notices rarely. Jokes and humour — rarely. You usually have to say it.",
      ],
      [
        /point|dog|plane|look|i want/,
        "If I ask her to point she does, very frequently. Sharing enjoyment is frequent. I don't know if her pointing is look or I want.",
      ],
      [
        /one child|play with as a person|look for|standing next/,
        "She plays with other children very frequently and she seeks them out, very frequently. She also has social problems with kids her age, frequently. Playing next to them and not with them was rare on my form.",
      ],
      [
        /someone else's house|outside|play at|only kindy/,
        "She plays with others. There has been play with other children, not only kindy.",
      ],
      [
        /crying|notice|park|go see/,
        "Understanding how someone else felt is only occasional. I don't know what she does if another child is crying. Social cues she misses more often than not.",
      ],
      [
        /sorry|falling-out|sorts|went wrong/,
        "The form didn't ask who sorts a fight. Social problems with children her age happen frequently. I usually step in.",
      ],
    ],
    "From the ratings: she starts conversations and plays with others a lot. Needs known, off-topic questions, looking when there's a problem, social cues and humour are the weak bits. Sensory and sitting still were very high on that form but that's not how she starts with people."
  );
}

function teacherAsrsReply(ask: string): string {
  const q = ask.toLowerCase();
  return pick(
    q,
    [
      [
        /most common reason|why is|comes up|kitchen|snack|look|i want|help me|nothing is wrong/,
        "I'm the kindy teacher, not mum. In the room she starts conversations only occasionally. She keeps a conversation going only occasionally. She plays next to other children, not with them, frequently. Sharing enjoyment is only occasional.",
      ],
      [
        /floor|in the room|set times|bath|dinner|the car|free enough|catch you|highchair/,
        "I'm in the room with her. She can catch me. This is not a car-seat conversation.",
      ],
      [
        /hello|hi |wave|nan|pop|neighbour|kindy|drop-off|say bye|prompt/,
        "Starting conversations at kindy is only occasional. A smile is only occasional. Looking when she talks is frequent. She shows little emotion, frequently.",
      ],
      [
        /always, sometimes|how often|most times|seldom|hardly|pick one/,
        "Starting talk here is occasional. Not always. Not seldom.",
      ],
      [
        /shops|playgroup|other|prompting|someone else|another child/,
        "This is kindy. She plays next to children frequently rather than with them. Seeking other children is only occasional.",
      ],
      [
        /start with hi|wave, then|hello first|teaching it/,
        "She starts conversations only occasionally. It has not become the natural first step here.",
      ],
      [
        /same question|already answered|one thing|show, a toy|where’s dad|move on/,
        "Staying on one subject is rare here. Echoing never. Off-topic questions are frequent. I was not asked whether she re-asks after an answer. Once you answer, she usually moves on.",
      ],
      [
        /snack or the show|still show|disappeared|once they have/,
        "Sharing enjoyment is only occasional. She shows little emotion frequently. After she has a thing, there is not much share left.",
      ],
      [
        /stick|drawing|bug|look|do this|just so you'll see/,
        "Sharing enjoyment is occasional. Make-believe is occasional. It's not a strong look-at-this.",
      ],
      [
        /your day|nan's coming|come back|pick that up/,
        "Interest in other people's ideas is only occasional. Understanding how someone felt is only occasional.",
      ],
      [
        /after kindy|quiet|after food|only if they want/,
        "I don't see her after kindy. In the room, seeking other children is occasional.",
      ],
      [
        /lid or a zip|your face|hand as a tool|hold it up/,
        "She looks at others when talking, frequently. Avoiding a look when there's a problem is only occasional here. That's better than the parent form.",
      ],
      [
        /done or annoyed|a look|park|without the words/,
        "Humour she rarely gets. She shows little emotion frequently. Understanding how someone felt is only occasional.",
      ],
      [
        /point|dog|plane|look|i want/,
        "Pointing when asked is frequent. Sharing just to share is only occasional.",
      ],
      [
        /one child|play with as a person|look for|standing next/,
        "She plays next to children, not with them, frequently. Seeking other children is occasional. Humour she rarely understands. There is play with others frequently, but it's not a clear mate.",
      ],
      [
        /someone else's house|outside|play at|only kindy/,
        "I only see kindy. I cannot say what happens at someone else's house.",
      ],
      [
        /crying|notice|park|go see/,
        "Understanding how someone felt is only occasional. I would not say she clocks distress reliably.",
      ],
      [
        /sorry|falling-out|sorts|went wrong/,
        "Social problems with children happen occasionally. I usually sort it. I cannot say she sees the problem.",
      ],
    ],
    "At kindy: start and keep a conversation only occasional, parallel play frequent, little emotion frequent, humour rare. Sitting still and sensory are not a problem here."
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
    facetId?: string | null;
    score?: { a1: string; a2: string; a3: string; lines: Array<{ domain: string; verdict: string; why: string }> };
    band?: string;
  };
}

async function runSession(
  id: string,
  label: string,
  reply: (ask: string) => string
) {
  const seed = `asrs-${id}-${Date.now().toString(36)}`;
  const usedAsks: Record<string, string[]> = {};
  const turns: Array<{ role: "assistant" | "parent"; text: string }> = [];
  const log: Array<{ n: number; facetId: string | null; interviewer: string; parent: string | null }> = [];
  let beliefs: Record<string, Belief> = {};
  let close: Close = null;
  let score: { a1: string; a2: string; a3: string; lines: Array<{ domain: string; verdict: string; why: string }> } | null =
    null;
  let band = "";

  const first = await postTurn({ child: CHILD, ageYears: 4, start: true, seed, usedAsks });
  band = first.band ?? "early";
  score = first.score ?? score;
  beliefs = first.beliefs;
  turns.push({ role: "assistant", text: first.say });
  if (first.facetId && first.say) usedAsks[first.facetId] = [first.say];
  log.push({ n: 1, facetId: first.facetId ?? "open", interviewer: first.say, parent: null });

  for (let i = 0; i < 18; i += 1) {
    const lastAsk = turns.filter((t) => t.role === "assistant").at(-1)?.text ?? "";
    const parent = reply(lastAsk);
    log[log.length - 1]!.parent = parent;
    turns.push({ role: "parent", text: parent });
    const next = await postTurn({
      child: CHILD,
      ageYears: 4,
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
    .map(([fid, row]) => ({
      id: fid,
      domain: A_FACETS.find((f) => f.id === fid)?.domain ?? "?",
      title: A_FACETS.find((f) => f.id === fid)?.title ?? fid,
      polarity: row.polarity,
      frequency: row.frequency,
      quote: row.quote,
    }));

  return {
    id,
    label,
    band,
    interviewerTurns: log.filter((r) => r.parent).length,
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
  const mapped = {
    parentStrict: parentStrict(),
    parentLooseTopic: parentLooseTopic(),
    teacher: teacherMap(),
  };
  console.error("mapped", mapped.parentStrict.outcome, mapped.parentLooseTopic.outcome, mapped.teacher.outcome);

  console.error("live parent…");
  const liveParent = await runSession("asrs-parent", "Parent speaking ASRS item facts", parentAsrsReply);
  console.error("parent", liveParent.outcome, liveParent.a1, liveParent.interviewerTurns);

  console.error("live teacher…");
  const liveTeacher = await runSession("asrs-teacher", "Teacher speaking ASRS item facts", teacherAsrsReply);
  console.error("teacher", liveTeacher.outcome, liveTeacher.a1, liveTeacher.interviewerTurns);

  const out = {
    generatedAt: new Date().toISOString(),
    child: { age: 4, gender: "girl", setting: "Kindy", asrsForm: "ASRS 2–5 Years" },
    asrs: {
      parent: {
        date: "2026-06-07",
        total: { t: 67, band: "Elevated", pct: 96 },
        socialCommunication: { t: 62, band: "Slightly Elevated", pct: 88 },
        unusualBehaviors: { t: 67, band: "Elevated", pct: 96 },
        dsm5: { t: 67, band: "Elevated", pct: 96 },
        peer: { t: 60, band: "Slightly Elevated", pct: 84 },
        adult: { t: 63, band: "Slightly Elevated", pct: 90 },
        reciprocity: { t: 61, band: "Slightly Elevated", pct: 86 },
        atypicalLanguage: { t: 72, band: "Very Elevated", pct: 99 },
        stereotypy: { t: 55, band: "Average", pct: 69 },
        rigidity: { t: 61, band: "Slightly Elevated", pct: 86 },
        sensory: { t: 73, band: "Very Elevated", pct: 99 },
        attention: { t: 70, band: "Very Elevated", pct: 98 },
      },
      teacher: {
        date: "2026-05-27",
        total: { t: 63, band: "Slightly Elevated", pct: 90 },
        socialCommunication: { t: 60, band: "Slightly Elevated", pct: 84 },
        unusualBehaviors: { t: 64, band: "Slightly Elevated", pct: 92 },
        dsm5: { t: 62, band: "Slightly Elevated", pct: 88 },
        peer: { t: 65, band: "Elevated", pct: 93 },
        adult: { t: 60, band: "Slightly Elevated", pct: 84 },
        reciprocity: { t: 61, band: "Slightly Elevated", pct: 86 },
        atypicalLanguage: { t: 61, band: "Slightly Elevated", pct: 86 },
        stereotypy: { t: 58, band: "Average", pct: 79 },
        rigidity: { t: 64, band: "Slightly Elevated", pct: 92 },
        sensory: { t: 57, band: "Average", pct: 76 },
        attention: { t: 47, band: "Average", pct: 38 },
      },
    },
    mapped,
    live: [liveParent, liveTeacher],
  };
  writeFileSync("/tmp/asrs-engine-compare.json", JSON.stringify(out, null, 2));
  console.log(JSON.stringify(out, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
