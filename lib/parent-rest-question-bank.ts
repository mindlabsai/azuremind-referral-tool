/**
 * Age-banded bank for B1–B4, C, D, E, and ADHD / anxiety / OCD / depression.
 * Same rule as A: we score the facet, not the sentence. Parent never hears the code.
 */

import type { BankItem, AgeBand } from "./parent-a-question-bank";

function q(facetId: string, bands: AgeBand | AgeBand[], text: string): BankItem {
  return {
    id: "",
    facetId,
    bands: Array.isArray(bands) ? bands : [bands],
    text,
  };
}

const ALL: AgeBand[] = ["early", "junior", "middle", "teen", "senior"];
const YOUNG: AgeBand[] = ["early", "junior"];
const SCHOOL: AgeBand[] = ["junior", "middle"];
const OLD: AgeBand[] = ["teen", "senior"];

const RAW: BankItem[] = [
  // —— B1 body
  q("b1_motor", "early", "When {child} is wound up or really happy — hands, body — is there a same movement on a loop? Flap, rock, spin, up on toes? Not ordinary wriggle."),
  q("b1_motor", "early", "Ordinary toddler bounce is fine. Does {their} body do the same action over and over, even when nothing is asked of {them}?"),
  q("b1_motor", SCHOOL, "When {child} is excited or stressed, does {their} body loop — flap, rock, spin, toes — or is it ordinary chair-bounce that stops when {they} are into something?"),
  q("b1_motor", SCHOOL, "ADHD bounce usually stops when the thing is interesting. Does this movement still happen when {they} are calm and nothing is on?"),
  q("b1_motor", OLD, "Hands, legs, pacing — is there a same movement on a loop when {they} are stressed or excited, or ordinary teen fidget?"),
  q("b1_motor", OLD, "Chair-bounce and phone-fiddle are common. Does a movement keep going in the same pattern even when {they} are not waiting or bored?"),

  // —— B1 speech / objects
  q("b1_speech_object", "early", "Does {child} line things up, spin wheels, or say your last words back — not once, most weeks?"),
  q("b1_speech_object", "early", "Play that is sort-and-line versus play that is a story. Which is {child} most days?"),
  q("b1_speech_object", SCHOOL, "Scripts from a show, your last words back, lining things up, spinning an object — is that a weekly thing, or rare tidy / one joke?"),
  q("b1_speech_object", SCHOOL, "One-off lining up Lego is not the test. Does the same object-move or the same phrase come back across weeks?"),
  q("b1_speech_object", OLD, "Does {child} still loop a line, a sound, or a way of using an object — like a recording — or is talk just ordinary teen talk?"),
  q("b1_speech_object", OLD, "Echolalia and scripts are not ‘they quote TikTok once’. Same phrase, same delivery, most weeks?"),

  // —— B2 change
  q("b2_change", "early", "If you leave five minutes late, or kindy is a different room — is that a wobble, or a real blow-up / shutdown?"),
  q("b2_change", "early", "Plans change. Most four-year-olds moan. Does {child} get stuck and not come back, or get over it?"),
  q("b2_change", SCHOOL, "Sport cancelled, different teacher, you are late out the door. Moan and move, or the day is gone?"),
  q("b2_change", SCHOOL, "Can {they} flex if you warn {them}, or does any change — even a small one — still land as a crisis?"),
  q("b2_change", OLD, "Timetable change, lift running late, plan cancelled. Annoying, or enough to ruin the day and not let it go?"),
  q("b2_change", OLD, "Anxiety is ‘what if’. This is ‘it already changed’. When the plan actually moves, can {they} adapt?"),

  // —— B2 sameness
  q("b2_sameness", "early", "Mornings, the cup, the route, the order — does it have to be the same way, or can it swap?"),
  q("b2_sameness", "early", "Picky food is common. Is it texture, or only that brand / that plate / that order?"),
  q("b2_sameness", SCHOOL, "Does the morning have to run in the same order? Same seat, same cup, same way out the door?"),
  q("b2_sameness", SCHOOL, "If someone else’s rules in a game — can {they} play their way, or only {theirs}?"),
  q("b2_sameness", OLD, "Does {child} need to know exactly what is next, or can {they} wait and see?"),
  q("b2_sameness", OLD, "Food or getting ready — texture is senses. Same brand, same order, same route is sameness. Which one is your house?"),

  // —— B3 intensity
  q("b3_intensity", "early", "Is there one thing — a show, a toy, a topic — that takes over talk and play most days, or a mix of ordinary likes?"),
  q("b3_intensity", "early", "If you take that thing away, is it disappointing, or a real crisis?"),
  q("b3_intensity", SCHOOL, "One game, one YouTuber, one fact-set. Hobby, or the main thing in {their} head most of the free time?"),
  q("b3_intensity", SCHOOL, "Friends who like the same game — is {child} at their level, or much narrower / much more?"),
  q("b3_intensity", OLD, "Is there one thing {they} would talk about for an hour if you let {them}? And if it is taken away — disappointing, or a crisis?"),
  q("b3_intensity", OLD, "Ordinary teen fandom is fine. Does this one thing get in the way of sleep, school, or other people?"),

  // —— B3 vs ordinary hobby
  q("b3_vs_hobby", YOUNG, "Would a stranger say that interest is a normal kid like, or unusually narrow for {their} age?"),
  q("b3_vs_hobby", SCHOOL, "Can {they} leave the topic when you change it, or do you have to hear it through again?"),
  q("b3_vs_hobby", OLD, "Does the interest stay in its slot, or pull every conversation back?"),
  q("b3_vs_hobby", OLD, "Collecting or keeping specific things {they} cannot let go of — or not really?"),

  // —— B4 hyper (BlinkLab turf — lived cost, not a phone PPI)
  q("b4_hyper", "early", "Tags, seams, hair-wash, blender, hand-dryer, a smell — does {child} cover ears, strip a top, or leave, most weeks?"),
  q("b4_hyper", "early", "Not fussy for fun. Is there a sense that hits too hard in more than one place — home and kindy or the shops?"),
  q("b4_hyper", SCHOOL, "Noise, clothes, light, smell, food texture — which ones make {them} leave, cover, or change, and is that most weeks?"),
  q("b4_hyper", SCHOOL, "A 15-minute phone test can pick a flinch. I want the week: does it cost getting dressed, the canteen, or assembly?"),
  q("b4_hyper", OLD, "Bell, dryer, fluoro, tags, perfume, canteen — too much, {they} have to leave or change, or {they} keep going?"),
  q("b4_hyper", OLD, "Has this been true since {they} were little, or only once high school got loud? I need both."),

  // —— B4 seek / hypo
  q("b4_seek", YOUNG, "Crash, squeeze, spin, chew, mouth things that are not food — does {child} hunt that input, or mostly avoid it?"),
  q("b4_seek", SCHOOL, "Deep pressure, crashing, spinning, chewing — sought, or avoided? And pain / temperature — ordinary, or {they} don’t notice?"),
  q("b4_seek", OLD, "Strong input — loud music, crash, chew, spin — do {they} seek it, or mostly stay away?"),
  q("b4_seek", ALL, "Mouthing, licking, sniffing objects — most weeks, or almost never?"),

  // —— B4 vs anxiety
  q("b4_vs_mood", ALL, "The noise and the clothes — is that most days even when {they} are fine, or only when {they} are already worried or tired?"),
  q("b4_vs_mood", OLD, "Senses that only spike before a test or a social thing are anxiety. Senses that are there on a quiet Sunday are not. Which is yours?"),

  // —— C when
  q("c_when", YOUNG, "First time you thought ‘this is different’ — under five / kindy, or only once school started?"),
  q("c_when", SCHOOL, "Were greeting, change, or noise already hard in kindy or pre-primary, or did it start in the last year or two?"),
  q("c_when", OLD, "Have people said {they} were like this from little, or only since high school demand hit?"),
  q("c_when", OLD, "Teachers or family — first really ask now, or flag it when {they} were little?"),

  // —— C early signs
  q("c_early_signs", YOUNG, "Back then — pointing to share, not just to get; coming over just to show you. Was that there, or already thin?"),
  q("c_early_signs", SCHOOL, "Eye contact, hello, showing you things, play with other kids, change, tags or noise — which of those were already hard before Year 1?"),
  q("c_early_signs", OLD, "Kindy or Year 1: friends, change, noise, starting talk — fine then and hard now, or already hard?"),
  q("c_early_signs", ALL, "Speech first words / sentences — on time, late, or you are not sure? Late speech alone is not the test."),

  // —— C hidden
  q("c_hidden", SCHOOL, "If kindy looked fine, was that true ease, or a small room, an adult doing the work, or {them} copying the kid next to {them}?"),
  q("c_hidden", OLD, "If primary looked fine at first — true ease, or a small setting and adults carrying the social load?"),
  q("c_hidden", ALL, "Did anyone name ADHD, speech, behaviour, or ‘shy’ before the social picture was looked at?"),

  // —— D settings
  q("d_settings", YOUNG, "Does this show up in more than one place — home and kindy, or the shops — or only in one room?"),
  q("d_settings", SCHOOL, "Home, school, sport, other houses — one place, or two or more most weeks?"),
  q("d_settings", OLD, "School, home, community — does the social, change, or sensory side get in the way in more than one of those?"),
  q("d_settings", ALL, "A one-off bad week does not count. Has this stayed a problem across this year?"),

  // —— D load
  q("d_load", YOUNG, "Do you have to run the whole morning — or is it ordinary toddler work?"),
  q("d_load", SCHOOL, "School calling, plans, refusal, you on duty the whole day — or ordinary nagging?"),
  q("d_load", OLD, "Has school had to put a plan in — meeting, reduced load, time-out card — or have they not needed to call you?"),
  q("d_load", OLD, "After a school day, is there energy left, or do {they} hold it together then crash?"),

  // —— E global
  q("e_global", YOUNG, "Walking, hands, speech — mostly on time, or late across the board like a much younger child?"),
  q("e_global", SCHOOL, "Everyday thinking — two-step plan, age-level talk — roughly like other kids {their} age, or more like a much younger child in nearly everything?"),
  q("e_global", OLD, "Schoolwork: some subjects hard, or everything much harder than other kids, across the board, since {they} were little?"),
  q("e_global", ALL, "Has anyone done a cognitive or developmental test that said global delay or intellectual disability — or not tested / not that?"),

  // —— E gap
  q("e_gap", SCHOOL, "The people / change / senses side — stronger than {their} general learning would predict, or about the same as an overall delay?"),
  q("e_gap", OLD, "If school is hard, is it mainly the work, or the noise, the group, the change, and the people?"),
  q("e_gap", ALL, "ADHD, anxiety, and literacy problems do not answer this. Are the social and rigid bits bigger than {their} learning level?"),

  // —— ADHD inatt
  q("adhd_inatt", YOUNG, "Can {child} stay with a fun thing, or do {they} bounce off even when {they} like it?"),
  q("adhd_inatt", SCHOOL, "Losing things, not hearing you, starting and not finishing — at home and at school, or only when the work is boring?"),
  q("adhd_inatt", OLD, "Sustain attention when the thing is not a screen {they} chose — two places, most days, since before high school?"),
  q("adhd_inatt", ALL, "Autism can look like ‘not listening’ when the topic is people. Does the not-listening also happen on Lego, sport, or a game {they} like?"),

  // —— ADHD hyper
  q("adhd_hyper", YOUNG, "On the move, interrupt, can’t sit for a story — most days in more than one place, or only when {they} are tired?"),
  q("adhd_hyper", SCHOOL, "Fidget that stops when the thing is interesting is one thing. Is {child} still on the move in the thing {they} chose?"),
  q("adhd_hyper", OLD, "Interrupt, on the go, can’t wait — two settings, and it was there before {they} were twelve?"),
  q("adhd_hyper", ALL, "A looped flap when excited is not the same as being unable to stay in the chair. Which one is the daily problem?"),

  // —— ADHD settings
  q("adhd_settings", ALL, "Attention or the motor side — home and kindy/school, or only one of those?"),
  q("adhd_settings", OLD, "One teacher saying ‘distracted’ is not enough. Two places, and it started in primary, not only this term?"),

  // —— Anxiety worry
  q("anx_worry", YOUNG, "Does {child} ask ‘what if’ about being left, the dark, something bad — and need you to cancel it — or is worry ordinary and it passes?"),
  q("anx_worry", SCHOOL, "Tummy, sleep, ‘what if’ about tomorrow — most weeks, or a one-off? And does it ease when the thing is over?"),
  q("anx_worry", OLD, "Future-worry that {they} cannot park — tests, health, something bad — most days, or ordinary teen stress that ends?"),
  q("anx_worry", ALL, "Sameness is ‘it changed’. Anxiety is ‘it might’. Which one runs your house?"),

  // —— Anxiety social want
  q("anx_social_want", YOUNG, "Does {child} want the other kids and then freeze or hide, or do other kids not really register as people to join?"),
  q("anx_social_want", SCHOOL, "Wants to go, then tummy / cling / ‘they’ll laugh’ — or {they} do not see the point of the group? Those are different."),
  q("anx_social_want", OLD, "Social fear: {they} want the invite and dread it. Autism A3: the invite does not mean much. Which is closer?"),
  q("anx_social_want", ALL, "After {they} know the person well, does the fear drop, or is starting with people still missing even when {they} feel safe?"),

  // —— OCD
  q("ocd_dread", YOUNG, "Does {child} have to do a thing — wash, check, tap, ask again — to cancel a bad feeling, even though {they} know it is too much?"),
  q("ocd_dread", SCHOOL, "A liked routine is calming. A ritual {they} hate but must do, or a thought {they} want gone — that is different. Have you got that?"),
  q("ocd_dread", OLD, "Unwanted thought {they} do not enjoy, and a check / wash / count to make it go. Not a hobby. Does that happen?"),
  q("ocd_dread", ALL, "If you stop the routine, is it ‘my thing is gone’ (like), or ‘something bad will happen’ (dread)?"),

  // —— Depression
  q("dep_weeks", YOUNG, "For weeks, not a bad afternoon — less joy in things {they} used to love, or more flat / clingy / angry than their usual?"),
  q("dep_weeks", SCHOOL, "Most of the day, most days, for more than two weeks — down or empty, or lost the things {they} liked? Not one rotten term of Year 3."),
  q("dep_weeks", OLD, "Weeks of down or empty, or nothing {they} used to like lands. Sleep or appetite shifted. Not ‘teen mood for a weekend’."),
  q("dep_weeks", OLD, "Never sharing is A1. Lost sharing they used to have is mood. Did the joy drop, or was it never there?"),
];

export const REST_QUESTION_BANK: BankItem[] = RAW.map((item, index) => ({
  ...item,
  id: `${item.facetId}-${item.bands[0]}-${index}`,
}));

export function restBankStats() {
  const byFacet: Record<string, number> = {};
  const byBand: Record<string, number> = { early: 0, junior: 0, middle: 0, teen: 0, senior: 0 };
  for (const item of REST_QUESTION_BANK) {
    byFacet[item.facetId] = (byFacet[item.facetId] ?? 0) + 1;
    for (const band of item.bands) byBand[band] += 1;
  }
  return { items: REST_QUESTION_BANK.length, byFacet, byBand };
}
