/**
 * Age-banded, pronoun-aware A1–A3 question bank.
 * We score the facet, not the sentence. Each session draws from the child’s band.
 */

import type { ChildProfile } from "./parent-a-screen";
import { REST_QUESTION_BANK } from "./parent-rest-question-bank";

export type AgeBand = "early" | "junior" | "middle" | "teen" | "senior";

export type Pronouns = {
  they: string;
  them: string;
  their: string;
  theirs: string;
  themselves: string;
  They: string;
  child: string;
  Child: string;
  do: string;
  Does: string;
};

export type BankItem = {
  id: string;
  facetId: string;
  bands: AgeBand[];
  text: string;
};

export function pronounsFor(gender: ChildProfile["gender"]): Pronouns {
  if (gender === "girl") {
    return {
      they: "she",
      them: "her",
      their: "her",
      theirs: "hers",
      themselves: "herself",
      They: "She",
      child: "your daughter",
      Child: "Your daughter",
      do: "does",
      Does: "Does",
    };
  }
  if (gender === "boy") {
    return {
      they: "he",
      them: "him",
      their: "his",
      theirs: "his",
      themselves: "himself",
      They: "He",
      child: "your son",
      Child: "Your son",
      do: "does",
      Does: "Does",
    };
  }
  return {
    they: "they",
    them: "them",
    their: "their",
    theirs: "theirs",
    themselves: "themselves",
    They: "They",
    child: "your child",
    Child: "Your child",
    do: "do",
    Does: "Do",
  };
}

export function applyPronouns(text: string, p: Pronouns): string {
  return text
    .replaceAll("{Child}", p.Child)
    .replaceAll("{child}", p.child)
    .replaceAll("{They}", p.They)
    .replaceAll("{they}", p.they)
    .replaceAll("{them}", p.them)
    .replaceAll("{their}", p.their)
    .replaceAll("{theirs}", p.theirs)
    .replaceAll("{themselves}", p.themselves)
    .replaceAll("{Does}", p.Does)
    .replaceAll("{do}", p.do);
}

export function ageBandFrom(ageYears: number | null, schoolYear: string): AgeBand {
  const year = schoolYear.toLowerCase();
  if (year.includes("kindy") || year.includes("pre-primary") || year.includes("pre primary")) return "early";
  if (/^year ([1-3])$/.test(year)) return "junior";
  if (/^year ([4-6])$/.test(year)) return "middle";
  if (/^year ([7-9])$/.test(year)) return "teen";
  if (/^year (10|11|12)$/.test(year)) return "senior";
  if (ageYears == null) return "middle";
  if (ageYears < 5) return "early";
  if (ageYears < 9) return "junior";
  if (ageYears < 13) return "middle";
  if (ageYears < 16) return "teen";
  return "senior";
}

function q(facetId: string, bands: AgeBand | AgeBand[], text: string): BankItem {
  return {
    id: "",
    facetId,
    bands: Array.isArray(bands) ? bands : [bands],
    text,
  };
}

const RAW: BankItem[] = [
  // —— Why they come over
  q("approach_reason", "early", "When {child} comes up to you at home — kitchen, couch, your legs — what’s the most common reason? A snack, the iPad, help with a thing, or just to show you or tell you something?"),
  q("approach_reason", "early", "Picture {child} walking in while you’re making dinner. Most days, is it “I want”, “help me”, or “look”?"),
  q("approach_reason", "early", "If you think of the last few times {they} started talking to you, were they after a thing, a fix, a cuddle, or just you seeing something?"),
  q("approach_reason", "early", "{Does} {they} come over when nothing is wrong — just to be near you — or mostly when {they} need something opened, poured, or turned on?"),
  q("approach_reason", ["junior", "middle"], "When {child} comes up to you at home — kitchen, couch, your door — what’s the most common reason? Want something, want you to fix something, or tell you something {they} don’t need you to do anything about?"),
  q("approach_reason", ["junior", "middle"], "Last few times {they} started talking at home — snack, charger, login, or “Mum you won’t believe this”?"),
  q("approach_reason", ["junior", "middle"], "If you stay quiet on the couch, does {child} still come over to tell you something, or only when {they} want something?"),
  q("approach_reason", ["junior", "middle"], "Most weeks, is the talk a request, a problem to fix, or {them} pulling you into something that isn’t an ask?"),
  q("approach_reason", ["teen", "senior"], "When {they} actually start a conversation with you at home, what’s it usually for — wifi, a lift, money, a login — or something {they} just wanted you to hear?"),
  q("approach_reason", ["teen", "senior"], "Be straight. When {child} comes to your door, is it mostly “can I” / “I need”, or {do} {they} still come in just to tell you a thing?"),
  q("approach_reason", ["teen", "senior"], "Teens ask for things. That’s normal. After you take those out — is there still a reason {they} start talking that isn’t an ask?"),
  q("approach_reason", ["teen", "senior"], "If you’re in the kitchen and {they} walk in, what’s the most common opening — a request, a complaint, or something about {their} day or yours?"),

  // —— Are you actually free
  q("parent_available", "early", "Are you actually on the floor or in the room with {them} most days, or do the chats only happen at set times — bath, dinner, the car?"),
  q("parent_available", "early", "When you’re home, can {they} catch you, or is talk only when you’re stuck with {them} — highchair, car seat, bed?"),
  q("parent_available", "early", "Be honest — are you free enough that {they} could start something on a random arvo, or only at those usual times?"),
  q("parent_available", ["junior", "middle"], "Are you actually around for a chat most days, or do the talks only happen at the usual times — the car, dinner, bedtime?"),
  q("parent_available", ["junior", "middle"], "When you’re home, can {they} catch you, or is chat only when you’re stuck with {them} — car, table, homework?"),
  q("parent_available", ["junior", "middle"], "If phones are down for half an hour, does extra chat appear, or is it still only at those set times?"),
  q("parent_available", ["teen", "senior"], "Are you actually free for {them} most days, or do you only talk in the car, at tea, or when something is on fire?"),
  q("parent_available", ["teen", "senior"], "A lot of families only talk in the car now. Is that your house, or can {they} still catch you on a random arvo?"),
  q("parent_available", ["teen", "senior"], "If you weren’t driving {them} anywhere this week, would there still be a chat that isn’t an ask?"),

  // —— Hello on their own
  q("greet_spontaneous", "early", "If Nan, Pop, or a neighbour walks in, does {child} say hello or wave on {their} own, or only if you say “say hello”?"),
  q("greet_spontaneous", "early", "At kindy, another parent or a known adult walks up. {Does} {they} start hi, or wait for you to tell {them}?"),
  q("greet_spontaneous", "early", "When someone {they} know comes to the door, does {they} pipe up, hide in your legs, or only greet if you prompt?"),
  q("greet_spontaneous", "early", "Think of drop-off. {Does} {they} say bye or hi without you running the script?"),
  q("greet_spontaneous", "junior", "At the school gate, another parent or a kid {they} know walks up. Does {child} say hi on {their} own, or do you still say “say hello”?"),
  q("greet_spontaneous", "junior", "When {they} were at kindy — Nan at the door — did {they} start hello, or only if you told {them}? What about now?"),
  q("greet_spontaneous", "junior", "If a known adult walks into your kitchen, does {they} greet {them}, ignore {them}, or wait for you?"),
  q("greet_spontaneous", "middle", "If a friend’s parent or Nan walks in now, does {child} start hello, go straight to what {they} want, or wait for you to prompt?"),
  q("greet_spontaneous", "middle", "When {they} were little — kindy, pre-primary — did hello start on {their} own? And now?"),
  q("greet_spontaneous", "middle", "At sport or a party, do {they} say hi to a known adult without you running it?"),
  q("greet_spontaneous", ["teen", "senior"], "Now, if a friend’s parent or Nan walks in, does {child} say hello, nod, or walk past like they aren’t there unless you prompt?"),
  q("greet_spontaneous", ["teen", "senior"], "Go back to kindy. Did {they} say hello on {their} own then, or only when you said “say hi”? We need both then and now."),
  q("greet_spontaneous", ["teen", "senior"], "Teens can be rude. That’s not the test. With people {they} actually know — do {they} start hello, or is it still you?"),
  q("greet_spontaneous", ["teen", "senior"], "When {they} walk into someone else’s house, is there a greeting, or do {they} go straight to the fridge, the room, or the wifi?"),

  // —— How often
  q("greet_frequency", ["early", "junior", "middle", "teen", "senior"], "When that happens — always, sometimes, or only now and then?"),
  q("greet_frequency", ["early", "junior", "middle", "teen", "senior"], "How often is that true? Most times, some of the time, or hardly ever?"),
  q("greet_frequency", ["early", "junior", "middle", "teen", "senior"], "If you had to pick one — always, sometimes, or seldom?"),
  q("greet_frequency", ["teen", "senior"], "Is the hello most visits, some visits, or rare enough you remember the times it happened?"),

  // —— Other places
  q("greet_pervasive", "early", "Is that only at home with Nan, or also at kindy, the shops, playgroup — do you still have to say “say hello” there?"),
  q("greet_pervasive", "early", "What about the shops or another child’s house? Same prompting, or does {they} start it there?"),
  q("greet_pervasive", "junior", "Have you seen the same thing at the school gate, shops, sport, someone else’s house — or is the prompting just your kitchen?"),
  q("greet_pervasive", "junior", "Does “say hello” follow {them} to other places, or was that only Nan at home?"),
  q("greet_pervasive", "middle", "Shops, oval, school gate, a friend’s place — do you still prompt hello, or is it only at home?"),
  q("greet_pervasive", "middle", "If you didn’t say anything, would {they} greet a known adult in those other places?"),
  q("greet_pervasive", ["teen", "senior"], "Work experience, sport, someone else’s kitchen, a mate’s parent — do you still have to run the hello, or is it just home?"),
  q("greet_pervasive", ["teen", "senior"], "Pervasive means it shows up in more than one place. Where do you still have to prompt, and where don’t you?"),

  // —— Hello as the start
  q("greet_as_start", "early", "When {child} comes up to someone, do {they} start with hi or a wave, then the rest — or go straight to the thing {they} want?"),
  q("greet_as_start", "early", "Have {they} picked up that you say hello first, or is it still you teaching it every time?"),
  q("greet_as_start", ["junior", "middle"], "Most kids just get that you start with hello, then you talk. Did {child} pick that up, or {do} {they} still walk up and start on what {they} want?"),
  q("greet_as_start", ["junior", "middle"], "When {child} comes up to a kid or an adult now, is there a hello, or straight into the ask or the topic?"),
  q("greet_as_start", ["teen", "senior"], "When {they} start with a person — even a mate — is there any greeting, or do {they} launch into the thing?"),
  q("greet_as_start", ["teen", "senior"], "Did hello ever become the natural first step, or is it still a script you run?"),

  // —— Same topic / same question
  q("topic_repeat", "early", "Does {child} get on one thing — a show, a toy, a question — and stay there? And do {they} ask the same question again after you’ve already answered?"),
  q("topic_repeat", "early", "“Where’s Dad?” “When’s iPad?” — if you’ve already answered, does {they} ask again like it didn’t land?"),
  q("topic_repeat", "early", "Can {they} move on after you answer, or does the same question come back again and again?"),
  q("topic_repeat", ["junior", "middle"], "Do {they} get on one game, one YouTuber, one fact, and stay there — and ask you the same question again after you’ve answered it?"),
  q("topic_repeat", ["junior", "middle"], "Having a favourite thing is fine. The test is: once you’ve answered, {do} {they} still come back with the same question?"),
  q("topic_repeat", ["junior", "middle"], "If you say “I already told you”, does that land, or does the question come back in five minutes?"),
  q("topic_repeat", ["teen", "senior"], "Do {they} stay on one topic in depth — and re-ask something you’ve already answered, like the answer didn’t stick?"),
  q("topic_repeat", ["teen", "senior"], "Special interest talk is not the test. Repeating the same question after a clear answer is. Does that happen?"),
  q("topic_repeat", ["teen", "senior"], "Can {they} leave a topic when you change it, or do you have to hear it through again?"),

  // —— After they get it
  q("after_demand", "early", "You give {them} the snack or the show. You stay there. Do {they} still show you a bit or say something, or is that the end?"),
  q("after_demand", "early", "Once {they} have what {they} wanted, do you still exist in the room, or have you disappeared?"),
  q("after_demand", ["junior", "middle"], "Once {they} have the iPad or the login, {do} {they} still go “watch this”, or is the next line more time or another snack?"),
  q("after_demand", ["junior", "middle"], "You give in. You sit on the end of the bed. Are you still a person to {them}, or gone?"),
  q("after_demand", ["teen", "senior"], "After the lift, the money, the wifi — is there any talk left that isn’t another ask?"),
  q("after_demand", ["teen", "senior"], "They got what {they} came for. You’re still there. Do {they} stay in the conversation, or is the door already closing?"),

  // —— Look vs open this
  q("show_to_share", "early", "If {they} find a stick, a drawing, a bug, a video — do {they} bring it to show you, or so you’ll open it, fix it, or turn it on?"),
  q("show_to_share", "early", "Is there a “look”, or is it only “do this”?"),
  q("show_to_share", "early", "Do {they} ever bring you something just so you’ll see it, not so you’ll do something with it?"),
  q("show_to_share", "junior", "When {they} were four or five — and now — a drawing or a video: “look”, or “open this”?"),
  q("show_to_share", "junior", "Does {child} still show you things just to share them, or only when {they} need you to do something?"),
  q("show_to_share", ["middle", "teen", "senior"], "When {they} were little, a stick or a drawing — was that “look”, or “open this”? We need that history."),
  q("show_to_share", ["middle", "teen", "senior"], "Now, a meme or a screenshot — is it for you, or is it a request / just the thing?"),
  q("show_to_share", ["teen", "senior"], "Do {they} ever send you something just so you’ll see it, not so you’ll fix wifi or buy it?"),

  // —— Coming back to you
  q("other_oriented", "early", "If you say something about your day — not “how was kindy” — does {child} come back to what you said, or stay on {their} thing?"),
  q("other_oriented", "early", "You say “Nan’s coming later.” Do {they} pick that up, or does it not land unless it’s about {them}?"),
  q("other_oriented", ["junior", "middle"], "Don’t ask how was school. You say two things about your day. {Does} {they} come back to you, or stay on the game?"),
  q("other_oriented", ["junior", "middle"], "You say work was a circus. Do you get a question or a comment, or nothing that isn’t an ask?"),
  q("other_oriented", ["teen", "senior"], "If you talk first — your day, Nan, something that isn’t {them} — do {they} come back to it?"),
  q("other_oriented", ["teen", "senior"], "“How was school” is a bad test. You speak first. Do you get an other-person turn, or only {their} topic?"),
  q("other_oriented", ["teen", "senior"], "If you said Nan’s not well, would that land, or would {they} talk through it?"),

  // —— After kindy / school
  q("pickup_confound", "early", "After kindy a lot of kids go quiet. Later at home, {do} {they} still come to tell you something, or only if {they} want something?"),
  q("pickup_confound", "early", "Not wanting to recap kindy doesn’t count. After food, do {they} start something that isn’t an ask?"),
  q("pickup_confound", ["junior", "middle"], "After school a lot of kids say fine and go to their room. Later that arvo, {do} {they} still come to tell you something, or only if {they} want something?"),
  q("pickup_confound", ["junior", "middle"], "Pickup can be a grunt. After they’ve eaten — person, or only charger / iPad?"),
  q("pickup_confound", ["teen", "senior"], "They don’t want to debrief school. Fine. Later that night, {do} {they} still start something that isn’t wifi, a lift, or money?"),
  q("pickup_confound", ["teen", "senior"], "Door slam after school is common. After food, is there a human turn, or only a request?"),

  // —— Your face when they need you
  q("request_gaze", "early", "When {they} want a lid or a zip {they} can’t do, do {they} look at your face and hold it up, or put your hand on it?"),
  q("request_gaze", "early", "Is your face in the job, or only your hand as a tool?"),
  q("request_gaze", ["junior", "middle"], "Jar, zip, login — do {they} find your face, or grab your wrist?"),
  q("request_gaze", ["junior", "middle"], "When {they} need you for a thing, do {they} say Mum or Dad and look, or just pull you?"),
  q("request_gaze", ["teen", "senior"], "When {they} need something {they} can’t do — a form, a login, a lift — do {they} look at you as a person, or only use you as the tool?"),
  q("request_gaze", ["teen", "senior"], "Do {they} check your face when {they} want something, or talk at the room / the phone?"),

  // —— Reading you’re done
  q("read_affect", "early", "Can {they} tell you’re done or annoyed without the words? A look, or do you have to say it?"),
  q("read_affect", "early", "Your face says we’re leaving the park. Do {they} read that, or only the sentence?"),
  q("read_affect", ["junior", "middle"], "Woolies, your face is we’re leaving. Do {they} know, or do you have to say it?"),
  q("read_affect", ["junior", "middle"], "If you don’t use words, can {child} tell you’re over it?"),
  q("read_affect", ["teen", "senior"], "Can {they} tell you’re finished or annoyed from your face, or do you have to say the sentence?"),
  q("read_affect", ["teen", "senior"], "Jokes and tone — do {they} usually get that you’re joking, or does it land as real until you explain?"),

  // —— Look at that
  q("point_share", "early", "When {they} point or show — a dog, a plane, a video — is it ever just “look”, or only “I want”?"),
  q("point_share", "early", "Is there a share-point, or is pointing only to get something?"),
  q("point_share", ["junior", "middle"], "A plane, a dog, a stupid video — do {they} ever show you just to share it?"),
  q("point_share", ["junior", "middle"], "Is there a “look at that”, or is showing only for getting?"),
  q("point_share", ["teen", "senior"], "A meme, a screenshot, something in the street — do {they} ever send or show it just so you’ll see it?"),
  q("point_share", ["teen", "senior"], "Sharing “look” versus “get this for me” — does the first one exist?"),

  // —— A mate / playmate
  q("one_mate", "early", "Can you think of one child {they} actually play with as a person — not just whoever is standing next to {them} at kindy? Don’t say the name."),
  q("one_mate", "early", "Is there a kid {they} look for, or only kids who happen to be there?"),
  q("one_mate", "junior", "Can you think of one kid {they} would call a friend? A face, or only kids in the class photo?"),
  q("one_mate", "junior", "Is there someone {they} talk about as a person, or only “the kids at school”?"),
  q("one_mate", "middle", "One kid {they} would call a friend or a mate. Don’t say the name. Face, or only a class list or a lobby?"),
  q("one_mate", "middle", "Would {they} use friend or mate about a real kid, not just someone {they} sit next to?"),
  q("one_mate", ["teen", "senior"], "One person {they} would call a mate. Not a username only. Is there a face?"),
  q("one_mate", ["teen", "senior"], "If that person vanished from the game but still existed in real life, would {child} still care?"),
  q("one_mate", ["teen", "senior"], "Class photo and Discord are not the same as a person. Have {they} got one person?"),

  // —— Outside school / kindy
  q("outside_school", "early", "Have {they} had a play at someone else’s house, or a kid here, this year — even if you set it up?"),
  q("outside_school", "early", "Is it only kindy, or do {they} see a kid outside the centre?"),
  q("outside_school", ["junior", "middle"], "When did {they} last see that kid outside school, sport, or a screen?"),
  q("outside_school", ["junior", "middle"], "Birthday, sleepover, just hanging at yours — this year, or only class and games?"),
  q("outside_school", ["teen", "senior"], "Have {they} seen that person this year not at school and not on a screen — even if you drove?"),
  q("outside_school", ["teen", "senior"], "If you didn’t organise it, would that person still exist in {their} week?"),

  // —— If that kid is upset
  q("notice_distress", "early", "If another child at kindy or the park is crying, what does {child} usually do?"),
  q("notice_distress", "early", "Do {they} notice, even badly — get you, stand there — or only if you say “go see if they’re ok”?"),
  q("notice_distress", ["junior", "middle"], "If that kid was upset — crying, left out — what would {child} usually do?"),
  q("notice_distress", ["junior", "middle"], "At the oval or in the group, a kid is dumped. Does yours clock it?"),
  q("notice_distress", ["teen", "senior"], "If that mate was dumped or crying in the chat, what would {they} usually do?"),
  q("notice_distress", ["teen", "senior"], "Do {they} notice the other person as a person, or only that the game stopped?"),

  // —— Who sorts a fight
  q("repair", "early", "After a grab or a falling-out, who sorts it — can {they} say sorry sometimes, or is it always you?"),
  q("repair", "early", "Do {they} see that something went wrong, or is it only you who sees the problem?"),
  q("repair", ["junior", "middle"], "After a falling-out with another kid, who sorts it?"),
  q("repair", ["junior", "middle"], "Can {they} make up, or do you always fix it and {they} don’t see the problem?"),
  q("repair", ["teen", "senior"], "After a falling-out, can {they} see they hurt someone, or is it always you cleaning it up?"),
  q("repair", ["teen", "senior"], "Do {they} ever repair it — even badly — or does the other person just vanish?"),
];

export const QUESTION_BANK: BankItem[] = RAW.map((item, index) => ({
  ...item,
  id: `${item.facetId}-${item.bands[0]}-${index}`,
}));

export function bankForFacet(
  facetId: string,
  ageYears: number | null,
  schoolYear: string
): BankItem[] {
  const band = ageBandFrom(ageYears, schoolYear);
  const pool = [...QUESTION_BANK, ...REST_QUESTION_BANK];
  const hit = pool.filter((item) => item.facetId === facetId && item.bands.includes(band));
  if (hit.length) return hit;
  return pool.filter((item) => item.facetId === facetId);
}

export function facetIdsForBand(ageYears: number | null, schoolYear: string): Set<string> {
  const band = ageBandFrom(ageYears, schoolYear);
  return new Set(
    [...QUESTION_BANK, ...REST_QUESTION_BANK]
      .filter((item) => item.bands.includes(band))
      .map((item) => item.facetId)
  );
}

export function pickBankAsk(options: {
  facetId: string;
  seed: string;
  ageYears: number | null;
  schoolYear: string;
  gender: ChildProfile["gender"];
  avoid?: string[];
}): { text: string; itemId: string; band: AgeBand } | null {
  const band = ageBandFrom(options.ageYears, options.schoolYear);
  const p = pronounsFor(options.gender);
  const items = bankForFacet(options.facetId, options.ageYears, options.schoolYear);
  if (!items.length) return null;
  const rendered = items.map((item) => ({ item, text: applyPronouns(item.text, p) }));
  const unused = rendered.filter((row) => !(options.avoid ?? []).includes(row.text));
  const pool = unused.length ? unused : rendered;
  let hash = 2166136261;
  const key = `${options.seed}:${options.facetId}:${band}`;
  for (let i = 0; i < key.length; i += 1) {
    hash ^= key.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  const chosen = pool[(hash >>> 0) % pool.length];
  return { text: chosen.text, itemId: chosen.item.id, band };
}

export function libraryAsks(options: {
  facetId: string;
  ageYears: number | null;
  schoolYear: string;
  gender: ChildProfile["gender"];
  limit?: number;
}): string[] {
  const p = pronounsFor(options.gender);
  return bankForFacet(options.facetId, options.ageYears, options.schoolYear)
    .slice(0, options.limit ?? 3)
    .map((item) => applyPronouns(item.text, p));
}

export const OPENING_BANK: Array<{ bands: AgeBand[]; text: string }> = [
  { bands: ["early"], text: "I won’t ask {their} name. What made you start wondering about {child}?" },
  { bands: ["early"], text: "{Child} is little. No name. What’s been going on at home that brought you here?" },
  { bands: ["junior", "middle"], text: "I won’t ask {their} name. What’s been going on with {child} — what made you start wondering?" },
  { bands: ["junior", "middle"], text: "No name. School, home, whatever it is. What made you want to talk about {child}?" },
  { bands: ["teen", "senior"], text: "I won’t ask {their} name. What made you start wondering about {child}?" },
  { bands: ["teen", "senior"], text: "No name. What’s been going on that brought you here?" },
];

export function pickOpeningAsk(options: {
  seed: string;
  ageYears: number | null;
  schoolYear: string;
  gender: ChildProfile["gender"];
  avoid?: string[];
}): string {
  const band = ageBandFrom(options.ageYears, options.schoolYear);
  const p = pronounsFor(options.gender);
  const lines = OPENING_BANK.filter((row) => row.bands.includes(band)).map((row) => applyPronouns(row.text, p));
  const pool = (options.avoid?.length ? lines.filter((line) => !options.avoid?.includes(line)) : lines).length
    ? lines.filter((line) => !options.avoid?.some((old) => old.slice(0, 32) === line.slice(0, 32)))
    : lines;
  const use = pool.length ? pool : lines;
  let hash = 2166136261;
  const key = `${options.seed}:open:${band}`;
  for (let i = 0; i < key.length; i += 1) {
    hash ^= key.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return use[(hash >>> 0) % use.length] ?? lines[0] ?? "When they come up to you at home, what’s the most common reason?";
}

export function bankStats(): { items: number; byFacet: Record<string, number>; byBand: Record<string, number> } {
  const byFacet: Record<string, number> = {};
  const byBand: Record<string, number> = { early: 0, junior: 0, middle: 0, teen: 0, senior: 0 };
  const pool = [...QUESTION_BANK, ...REST_QUESTION_BANK];
  for (const item of pool) {
    byFacet[item.facetId] = (byFacet[item.facetId] ?? 0) + 1;
    for (const band of item.bands) byBand[band] += 1;
  }
  return { items: pool.length, byFacet, byBand };
}
