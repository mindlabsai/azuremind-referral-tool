/** Standalone DSM-5-TR A–E interview script. Does not write to the Texlex report draft. */

export type InterviewAudience = "teen" | "parent" | "session";
export type InterviewChoice = "left" | "right" | "unsure";
export type CriterionInterviewCode =
  | "A1"
  | "A2"
  | "A3"
  | "B1"
  | "B2"
  | "B3"
  | "B4"
  | "C"
  | "D"
  | "E";

export type InterviewQuestion = {
  id: string;
  audience: InterviewAudience;
  prompt: string;
  left: string;
  right: string;
};

export type InterviewSection = {
  code: CriterionInterviewCode;
  group: "A" | "B" | "CDE";
  title: string;
  teenLabel: string;
  blackAndWhite: string;
  sayToClient: string;
  stuckPrompt: string;
  clinicianNote: string;
  questions: InterviewQuestion[];
};

export const INTERVIEW_STORAGE_KEY = "texlex-criterion-interview-v1";

export const INTERVIEW_SECTIONS: InterviewSection[] = [
  {
    code: "A1",
    group: "A",
    title: "Social-emotional reciprocity",
    teenLabel: "Talk",
    blackAndWhite:
      "Can she start, keep, and share a conversation, or is talk one-way, demand-only, or I dont know?",
    sayToClient: "This is about talking with people, not how smart you are.",
    stuckPrompt: "So is it more I keep the chat going, or more I wait / I dont know?",
    clinicianNote:
      "Watch greeting, turns, and I dont know on the call. You do not need her to describe what you can see.",
    questions: [
      { id: "a1-1", audience: "teen", prompt: "When someone talks to you, do you usually", left: "Keep it going", right: "Wait for them to do all the work" },
      { id: "a1-2", audience: "teen", prompt: "Do you", left: "Ask them questions about their day", right: "Only talk when you need something" },
      { id: "a1-3", audience: "teen", prompt: "If a teacher or parent tells you about their day, do you", left: "Ask a follow-up", right: "Go quiet or say I dont know" },
      { id: "a1-4", audience: "teen", prompt: "In a conversation, do you", left: "Take turns", right: "Talk over them or jump in" },
      { id: "a1-5", audience: "teen", prompt: "When you talk, is it usually", left: "About what they brought up", right: "About what you want to talk about" },
      { id: "a1-6", audience: "teen", prompt: "If you do not know what to say, do you", left: "Try something", right: "Say I dont know and stop" },
      { id: "a1-7", audience: "teen", prompt: "When you walk into a room or join a call, do you", left: "Say hi on your own", right: "Need someone to tell you to say hi" },
      { id: "a1-8", audience: "teen", prompt: "If two people are talking, do you", left: "Wait", right: "Cut in because you need to know what they said" },
      { id: "a1-9", audience: "teen", prompt: "If someone answers your question, do you", left: "Leave it", right: "Ask the same thing again until it feels finished" },
      { id: "a1-10", audience: "teen", prompt: "Do people need to", left: "You can get it from a look or a nod", right: "Use actual words with you" },
      { id: "a1-11", audience: "teen", prompt: "After school, do you", left: "Tell someone what happened because you want to share it", right: "Only tell if they ask" },
      { id: "a1-12", audience: "session", prompt: "In this session right now, is talking", left: "Easy to keep going", right: "Something you want to get over" },
    ],
  },
  {
    code: "A2",
    group: "A",
    title: "Nonverbal communication",
    teenLabel: "Faces",
    blackAndWhite:
      "Do eyes, face, gesture, space, and tone work with her words, or does she miss them or not use them?",
    sayToClient: "This is about faces and body language, not whether you are rude.",
    stuckPrompt: "Words only, or face and body as well?",
    clinicianNote:
      "Ask her to show a sad face and an angry face. Watch gaze, video angle, and affect on the call.",
    questions: [
      { id: "a2-1", audience: "teen", prompt: "When someone talks to you, do you", left: "Look at their face", right: "Look away, at the floor, or at a screen" },
      { id: "a2-2", audience: "teen", prompt: "Does looking at someone's eyes feel", left: "Fine", right: "Too much, like they are staring" },
      { id: "a2-3", audience: "teen", prompt: "Can you tell a sad face from an angry face", left: "Straight away", right: "They look the same / you guess" },
      { id: "a2-4", audience: "teen", prompt: "If I looked annoyed but said I am fine, would you", left: "Notice the face", right: "Only believe the words" },
      { id: "a2-5", audience: "teen", prompt: "When you talk, do you", left: "Use your face (smile, frown)", right: "Keep the same face" },
      { id: "a2-6", audience: "teen", prompt: "When you say yes or no, do you", left: "Nod or shake your head", right: "Only use words" },
      { id: "a2-7", audience: "teen", prompt: "In everyday talk, do you", left: "Point, wave, or shrug", right: "Not really do that" },
      { id: "a2-8", audience: "teen", prompt: "In a group, do you know it is your turn", left: "From their face", right: "Only if they say your name" },
      { id: "a2-9", audience: "teen", prompt: "With personal space, do you", left: "Know how close to stand", right: "Get too close and not notice" },
      { id: "a2-10", audience: "teen", prompt: "Can you tell if someone wants you to back off", left: "Without them saying it", right: "Only if they say it in words" },
      { id: "a2-11", audience: "teen", prompt: "Is your voice usually", left: "Matched to the situation", right: "Flat, too loud, or like a teacher" },
      { id: "a2-12", audience: "teen", prompt: "On video, is it", left: "Harder because you cannot read them", right: "Easier because you can look away" },
    ],
  },
  {
    code: "A3",
    group: "A",
    title: "Relationships",
    teenLabel: "Friends",
    blackAndWhite:
      "Can she make, keep, and read friendships, or is it join-then-conflict, control, copy, or one-sided?",
    sayToClient: "This is about friends and groups, not whether you are nice.",
    stuckPrompt: "Real friends you do things with, or just people in your class?",
    clinicianNote:
      "Ask her to name one person and why. Activity-based (they help me / same interest) versus reciprocal (we talk about each other's stuff).",
    questions: [
      { id: "a3-1", audience: "teen", prompt: "Do you have", left: "Friends you see outside school", right: "People you sit near but do not really do things with" },
      { id: "a3-2", audience: "teen", prompt: "Are your friendships", left: "Two-way: they come to you and you go to them", right: "You do the work, or they do the work" },
      { id: "a3-3", audience: "teen", prompt: "When you hang out, do you", left: "Share and take turns", right: "Want it your way" },
      { id: "a3-4", audience: "teen", prompt: "In a group, do you", left: "Follow the group plan", right: "Try to run it, or leave if it is not your plan" },
      { id: "a3-5", audience: "teen", prompt: "If someone is joking, do you", left: "Usually get it", right: "Take it as real and get upset" },
      { id: "a3-6", audience: "teen", prompt: "If two friends are fighting, do you", left: "Get why", right: "It feels random, or you pick a side and stick" },
      { id: "a3-7", audience: "teen", prompt: "At school versus home, do you", left: "Change how you act", right: "Act the same everywhere" },
      { id: "a3-8", audience: "teen", prompt: "Have you", left: "Kept the same friend for more than a year", right: "Friends start then drop off" },
      { id: "a3-9", audience: "teen", prompt: "In conflict, do you", left: "Sort it out", right: "Blow up, shut down, or get blamed" },
      { id: "a3-10", audience: "teen", prompt: "If a peer told you to do something mean, would you", left: "Stop and think", right: "Just do it" },
      { id: "a3-11", audience: "teen", prompt: "Do you know when you have gone too far", left: "At the time", right: "Only after an adult tells you" },
      { id: "a3-12", audience: "teen", prompt: "Birthday parties, group chats, sport: do you", left: "Know the unwritten rules", right: "Need someone to explain them" },
      { id: "a3-13", audience: "teen", prompt: "Do you", left: "Prefer friends and it mostly works", right: "Want friends but find it confusing, or prefer to be on your own" },
    ],
  },
  {
    code: "B1",
    group: "B",
    title: "Repetitive movement, objects, or speech",
    teenLabel: "Repeats",
    blackAndWhite:
      "Does her body, speech, or use of objects loop, or is it ordinary fidget / teen habit?",
    sayToClient: "This is about things your body or words do on repeat. Not whether you are weird.",
    stuckPrompt: "Same movement or phrase on a loop, or just ordinary fidgeting?",
    clinicianNote:
      "Watch rocking, hand movements, repeating your last words, pacing off-camera. Do not count ADHD chair-bounce, anxiety chewing, or one-off lining up. Skip quickly if empty; two of B1–B4 is enough.",
    questions: [
      { id: "b1-1", audience: "teen", prompt: "Do your hands or legs", left: "Just fidget like most people", right: "Do the same movement over and over when stressed or excited" },
      { id: "b1-2", audience: "teen", prompt: "When you walk, is it", left: "Ordinary walking", right: "On your toes, spinning, or a set path" },
      { id: "b1-3", audience: "teen", prompt: "Do you", left: "Just use ordinary chat", right: "Repeat a word, line, or sound from a show, a person, or yourself" },
      { id: "b1-4", audience: "teen", prompt: "If you like a phrase, do you", left: "Say it once", right: "Say it again the same way" },
      { id: "b1-5", audience: "teen", prompt: "With objects (pens, cards, figures, apps), do you", left: "Use them to do the task", right: "Line them up, spin them, or tap them in a set way" },
      { id: "b1-6", audience: "teen", prompt: "When you were younger, did you", left: "Just play with toys", right: "Line them up or sort them" },
      { id: "b1-7", audience: "teen", prompt: "Do people say you talk", left: "Like a normal 13-year-old", right: "Like a recording or like a teacher" },
      { id: "b1-8", audience: "teen", prompt: "These repeats happen", left: "Almost never", right: "Most days" },
    ],
  },
  {
    code: "B2",
    group: "B",
    title: "Sameness and inflexibility",
    teenLabel: "Plans",
    blackAndWhite: "Does a change of plan, order, or rule cause a real problem, or can she flex?",
    sayToClient: "This is about plans and change. Not about being naughty.",
    stuckPrompt: "I can change the plan, or the plan has to stay the same.",
    clinicianNote: "If she blanks, ask parent: what happens if you are five minutes late leaving, or sport is cancelled?",
    questions: [
      { id: "b2-1", audience: "teen", prompt: "If the plan changes with little warning, do you", left: "Adapt", right: "Get stuck, angry, or shut down" },
      { id: "b2-2", audience: "teen", prompt: "Mornings: can the order", left: "Change", right: "Need to go the same way" },
      { id: "b2-3", audience: "teen", prompt: "If someone says we might go later, do you hear", left: "Maybe", right: "It is happening" },
      { id: "b2-4", audience: "teen", prompt: "Switching from one class, game, or tab to the next is", left: "Fine", right: "A big deal" },
      { id: "b2-5", audience: "teen", prompt: "Other people's rules in a game: can you", left: "Play their way", right: "Only play by your rules" },
      { id: "b2-6", audience: "teen", prompt: "If a teacher changes the seating or timetable, is that", left: "Annoying", right: "Enough to ruin the day" },
      { id: "b2-7", audience: "teen", prompt: "Food: are you picky but", left: "You will eat something else", right: "Only those foods, that way" },
      { id: "b2-8", audience: "teen", prompt: "Being out at night, a different house, or a different route is", left: "Manageable", right: "You want to go home" },
      { id: "b2-9", audience: "teen", prompt: "Do you need to", left: "Wait and see", right: "Know what is happening next" },
      { id: "b2-10", audience: "teen", prompt: "When you have to be flexible, do you", left: "Get over it", right: "Stay upset and not let it go" },
    ],
  },
  {
    code: "B3",
    group: "B",
    title: "Restricted or intense interests",
    teenLabel: "Hobby intensity",
    blackAndWhite:
      "Is there a topic that takes over time, talk, and mood, or are her likes ordinary teen likes?",
    sayToClient: "This is about how strong a hobby is. Liking a game or sport is not enough on its own.",
    stuckPrompt: "Name the thing. Is it a hobby, or the main thing in your head most days?",
    clinicianNote:
      "Need: what is it, hours yesterday, what happens if she cannot do it. Do not count a piggy-bank protest, I like being active, or a short TikTok phase unless intensity and interference are clear.",
    questions: [
      { id: "b3-1", audience: "teen", prompt: "Is there", left: "A few ordinary hobbies", right: "One thing you would talk about for an hour" },
      { id: "b3-2", audience: "teen", prompt: "If someone changes the topic, can you", left: "Switch", right: "Pull it back to your thing" },
      { id: "b3-3", audience: "teen", prompt: "Compared with friends who like the same thing, is yours", left: "The same level", right: "Much stronger / you know way more" },
      { id: "b3-4", audience: "teen", prompt: "Free time is", left: "A mix of things", right: "Mostly that one thing" },
      { id: "b3-5", audience: "teen", prompt: "If that thing is taken away, is it", left: "Disappointing", right: "A real crisis" },
      { id: "b3-6", audience: "teen", prompt: "Do you collect or keep", left: "Not really", right: "Specific things you cannot let go of" },
      { id: "b3-7", audience: "teen", prompt: "At school, does that interest", left: "Stay in its slot", right: "Get in the way of work or friends" },
      { id: "b3-8", audience: "teen", prompt: "Would a stranger say the interest is", left: "A normal teen hobby", right: "Unusually narrow or intense for your age" },
    ],
  },
  {
    code: "B4",
    group: "B",
    title: "Sensory differences",
    teenLabel: "Senses",
    blackAndWhite:
      "Do everyday sounds, touch, clothes, food, light, or movement hit too hard or too little?",
    sayToClient: "This is about your senses. Not about being fussy for fun.",
    stuckPrompt: "Clothes, hair, and noise: no big deal, or a daily problem?",
    clinicianNote:
      "If she is tired, run B4 then B2 then B3 then B1. Watch hoodie, tags, light, flinch at household noise. Picky food that is brand or routine only is B2, not B4.",
    questions: [
      { id: "b4-1", audience: "teen", prompt: "Loud or sudden sounds (bell, hand dryer, blender, fan) are", left: "Fine", right: "Too much: you cover your ears or leave" },
      { id: "b4-2", audience: "teen", prompt: "Slight sounds other people ignore", left: "You do not notice", right: "Get to you" },
      { id: "b4-3", audience: "teen", prompt: "Clothing tags, seams, or certain fabrics", left: "Whatever", right: "Have to come off" },
      { id: "b4-4", audience: "teen", prompt: "Hair wash or haircut is", left: "Annoying", right: "A major problem" },
      { id: "b4-5", audience: "teen", prompt: "If a drop of water or food gets on your clothes, do you", left: "Leave it", right: "Need to change" },
      { id: "b4-6", audience: "teen", prompt: "Food textures are", left: "Fine", right: "Some textures you will not eat" },
      { id: "b4-7", audience: "teen", prompt: "Light (fluoro, sun, screens) is", left: "Fine", right: "Too bright: you squint or hide" },
      { id: "b4-8", audience: "teen", prompt: "Smell (canteen, perfume, toilets) is", left: "Normal", right: "You cannot stay in the room" },
      { id: "b4-9", audience: "teen", prompt: "With strong input (crash, squeeze, spin, loud music, chew), do you", left: "Mostly avoid it", right: "Seek it" },
      { id: "b4-10", audience: "teen", prompt: "When a sense is too much, do you", left: "Keep going", right: "Need to leave, change clothes, or shut down" },
      { id: "b4-11", audience: "teen", prompt: "Has this been true", left: "Only lately", right: "Since you were little" },
    ],
  },
  {
    code: "C",
    group: "CDE",
    title: "Onset in the early developmental period",
    teenLabel: "Was this there early?",
    blackAndWhite:
      "Were the social, sensory, or rigid patterns there in early childhood, or did they start in the last year or two?",
    sayToClient: "Three questions only. If you do not remember, that is fine.",
    stuckPrompt: "Present before school age, or only once high school demand hit?",
    clinicianNote:
      "She will not remember toddler years. Stop after three teen items if she does not remember. Parent interview is the actual C evidence. Do not invent ages. Current friends are A3/D, not onset.",
    questions: [
      { id: "c-t1", audience: "teen", prompt: "Have people said you were", left: "Only like this since high school or the last year or two", right: "Like this from little" },
      { id: "c-t2", audience: "teen", prompt: "Thinking back to kindy or Year 1, friends, change, noise, talking were", left: "Fine then and hard now", right: "Already hard" },
      { id: "c-t3", audience: "teen", prompt: "Did teachers or family", left: "First really ask now", right: "Flag it when you were little" },
      { id: "c-p1", audience: "parent", prompt: "First worries were", left: "Only once primary or high school started", right: "Under 5, kindy, or pre-primary" },
      { id: "c-p2", audience: "parent", prompt: "Eye contact, greeting, being looked at", left: "Recent", right: "From toddler years" },
      { id: "c-p3", audience: "parent", prompt: "Back-and-forth, pointing, showing to share (not just to get something)", left: "Typical early", right: "Reduced early" },
      { id: "c-p4", audience: "parent", prompt: "Play with other kids", left: "Ordinary parallel then cooperative play", right: "Joined but conflict, or preferred own company" },
      { id: "c-p5", audience: "parent", prompt: "Change, routine, transitions as a toddler or in daycare", left: "Flexible then", right: "Already a problem" },
      { id: "c-p6", audience: "parent", prompt: "Sensory (noise, hair, clothes, tags)", left: "Started later", right: "From early on" },
      { id: "c-p7", audience: "parent", prompt: "Speech (first words / sentences)", left: "On time", right: "Late or you are not sure" },
      { id: "c-p8", audience: "parent", prompt: "Daycare or kindy", left: "No real flags", right: "Separation, regulation, own company, toileting, or teacher comments" },
      { id: "c-p9", audience: "parent", prompt: "Did anyone name ADHD, speech, behaviour, or something different", left: "Not until now", right: "Before Year 3" },
      { id: "c-p10", audience: "parent", prompt: "If school looked fine at first, was that", left: "True ease", right: "Small setting, adult doing the work, or she copied others" },
    ],
  },
  {
    code: "D",
    group: "CDE",
    title: "Clinically significant impairment",
    teenLabel: "Does it get in the way now?",
    blackAndWhite: "Does this cost her at home, school, or in the community, or is it a style that still works?",
    sayToClient: "This is about whether it gets in the way, not whether you are trying.",
    stuckPrompt: "This gets in the way of school or home most weeks, or it does not.",
    clinicianNote:
      "Need two settings, or one setting plus clear cost. Do not count one fight last week or teen attitude with no support load.",
    questions: [
      { id: "d-t1", audience: "teen", prompt: "At school, is the social, change, or sensory side", left: "Annoying but you cope", right: "Getting in the way of learning or being there" },
      { id: "d-t2", audience: "teen", prompt: "Friendships are", left: "Working well enough", right: "Conflict, drop-off, or you stay alone" },
      { id: "d-t3", audience: "teen", prompt: "At home, do parents", left: "You can do the day without a fight most days", right: "Have to run the day: mornings, homework, getting out" },
      { id: "d-t4", audience: "teen", prompt: "After school (sport, shops, other houses), can you", left: "Participate", right: "Avoid, melt, or need to go home" },
      { id: "d-t5", audience: "teen", prompt: "After a school day, do you", left: "Have energy left", right: "Mask all day then crash" },
      { id: "d-t6", audience: "teen", prompt: "Has school or home had to", left: "No extra support", right: "Put a plan in: meeting, extra help, time-out card, reduced load" },
      { id: "d-p1", audience: "parent", prompt: "Problems show in", left: "Only one place", right: "Two or more of home, school, community, clinic" },
      { id: "d-p2", audience: "parent", prompt: "School has needed", left: "They have not needed to call you", right: "Meetings, plans, withdrawals, detentions, refusal, or learning support" },
      { id: "d-p3", audience: "parent", prompt: "Home is", left: "Age-typical nagging", right: "Daily scaffolding: prompts, consequences not working, getting out the door" },
      { id: "d-p4", audience: "parent", prompt: "Community (shops, sport, other houses, transport)", left: "She participates", right: "Avoid, incident, or leave early" },
      { id: "d-p5", audience: "parent", prompt: "The load on you is", left: "Ordinary parenting", right: "You are on duty the whole day" },
      { id: "d-p6", audience: "parent", prompt: "Has this", left: "A one-off bad term", right: "Stayed a problem across this year" },
    ],
  },
  {
    code: "E",
    group: "CDE",
    title: "Not better explained by ID or GDD",
    teenLabel: "Learning versus this pattern",
    blackAndWhite:
      "Are thinking, motor, and language in a roughly expected range, with the social / rigid / sensory pattern on top, or does everything look globally delayed?",
    sayToClient: "This is about schoolwork versus people, change, and senses. Not a test.",
    stuckPrompt:
      "Milestones mainly on time and this is a social/sensory/rigid pattern, or delayed in nearly everything since she was little.",
    clinicianNote:
      "Do not ask her if she has an ID. ADHD, anxiety, and literacy problems do not fail E. If never tested and learning looks globally very weak, hold E.",
    questions: [
      { id: "e-t1", audience: "teen", prompt: "Schoolwork (reading, writing, maths)", left: "Mostly keep up, or some subjects hard", right: "Everything is much harder than for other kids" },
      { id: "e-t2", audience: "teen", prompt: "If school is hard, is it mainly", left: "The work itself", right: "The noise, group work, change, and people" },
      { id: "e-t3", audience: "teen", prompt: "Can you", left: "Explain a topic you know well", right: "Find talking about anything hard because of language" },
      { id: "e-p1", audience: "parent", prompt: "Walking and using hands as a toddler", left: "On time", right: "Late or unsure" },
      { id: "e-p2", audience: "parent", prompt: "Speech", left: "On time, or late but caught up", right: "Still clearly behind" },
      { id: "e-p3", audience: "parent", prompt: "Cognitive, IQ, or developmental testing", left: "Never tested, or tested and not ID/GDD", right: "Showed global delay or ID" },
      { id: "e-p4", audience: "parent", prompt: "Everyday thinking (two-step plan, age-level talk) is", left: "Roughly like other 13-year-olds", right: "More like a much younger child across the board" },
      { id: "e-p5", audience: "parent", prompt: "The social, routine, and sensory issues are", left: "Stronger than her general learning level would predict", right: "About the same as her overall delay" },
      { id: "e-p6", audience: "parent", prompt: "Toileting, dressing, organisation are", left: "Specific adaptive gaps", right: "Global delay in all self-care" },
    ],
  },
];

export type InterviewAnswers = Record<string, InterviewChoice>;

export function sectionByCode(code: CriterionInterviewCode): InterviewSection {
  const section = INTERVIEW_SECTIONS.find((item) => item.code === code);
  if (!section) throw new Error(`Unknown interview section: ${code}`);
  return section;
}

export function audienceLabel(audience: InterviewAudience): string {
  if (audience === "parent") return "Parent";
  if (audience === "session") return "Session";
  return "Young person";
}

export function choiceLabel(question: InterviewQuestion, choice: InterviewChoice): string {
  if (choice === "unsure") return "Unsure / I dont know";
  return choice === "left" ? question.left : question.right;
}

export function formatInterviewNotes(
  answers: InterviewAnswers,
  sections: InterviewSection[] = INTERVIEW_SECTIONS
): string {
  const blocks = sections
    .map((section) => {
      const lines = section.questions
        .filter((question) => answers[question.id])
        .map((question) => {
          const choice = answers[question.id];
          return `- [${audienceLabel(question.audience)}] ${question.prompt} → ${choiceLabel(question, choice)}`;
        });
      if (!lines.length) return "";
      return `${section.code} ${section.title}\n${lines.join("\n")}`;
    })
    .filter(Boolean);

  if (!blocks.length) return "";
  return `Criterion interview (forced choice)\n\n${blocks.join("\n\n")}`;
}
