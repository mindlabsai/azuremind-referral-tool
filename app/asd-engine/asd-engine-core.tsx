"use client";
// @ts-nocheck — large clinical UI module; strict param typing deferred.

import { useMemo } from "react";

const TAXONOMY = [
  {
    domain: "A1 Social-emotional reciprocity",
    code: "A1",
    criterion: "Deficits in social-emotional reciprocity",
    criterionGroup: "A",
    dsmReference: "DSM-5-TR 299.00 Criterion A1",
    severityWeight: 1.2,
    detectionStrategy: "negation-dominant", // A criteria are mostly absences of typical behaviour
    markers: [
      // ============================================================
      // CLINICIAN — RECIPROCITY CORE
      // ============================================================
      {
        label: "Reduced social-emotional reciprocity",
        weight: 1.5,
        source: "clinician",
        specificity: "high",
        ageRange: { min: 18, max: 999, unit: "months" },
        keywords: ["reduced reciprocity", "limited reciprocity", "poor reciprocity", "impaired reciprocity"],
        regex: ["\\b(reduced|limited|poor|impaired|diminished)\\s+(social[-\\s]?emotional\\s+)?reciprocity\\b"],
        negationRequired: false,
        crossTags: [],
        auContext: false
      },
      {
        label: "Failure of normal back-and-forth conversation",
        weight: 1.5,
        source: "clinician",
        specificity: "high",
        ageRange: { min: 36, max: 999, unit: "months" },
        keywords: ["back and forth", "back-and-forth", "to and fro", "give and take", "conversational reciprocity"],
        regex: ["\\b(failure of|reduced|limited|absent|poor)\\s+(normal\\s+)?back[-\\s]?and[-\\s]?forth\\b", "\\bone[-\\s]?sided\\s+(conversation|interaction)\\b"],
        negationRequired: false,
        crossTags: [],
        auContext: false
      },
      {
        label: "One-sided interaction / monologue pattern",
        weight: 1.4,
        source: "parent",
        specificity: "high",
        ageRange: { min: 48, max: 999, unit: "months" },
        keywords: [
          "one-sided",
          "one way",
          "all one way",
          "monologue pattern",
          "monologue",
          "monologues",
          "talks at people",
          "talks AT",
          "talks at me",
          "talks at us",
          "conversations feel one-way",
          "conversations one way",
          "info-dumps on people",
          "lectures people",
          "lectures at family",
          "doesn't have conversations",
        ],
        regex: [
          "\\b(one[-\\s]?sided|one[-\\s]?way)\\s+(interaction|conversation|relationship|exchange)",
          "\\bconversations?\\s+(often\\s+)?feel\\s+['\"]?one[-\\s]?way['\"]?",
          "\\btalks?\\s+at\\s+(me|people|us|her|him|them|family)\\b",
          "\\bmonologues?\\b",
          "\\binfo[-\\s]?dumps?\\b",
        ],
        negationRequired: false,
        crossTags: ["A3"],
        auContext: false,
      },
      {
        label: "Does not initiate social interaction",
        weight: 1.4,
        source: "clinician",
        specificity: "high",
        ageRange: { min: 12, max: 999, unit: "months" },
        keywords: ["doesn't initiate", "does not initiate", "no initiation", "fails to initiate", "limited initiation"],
        regex: ["\\b(does\\s+not|doesn't|fails?\\s+to|limited|reduced|no)\\s+initiat\\w*\\s+(social|interaction|contact|engagement)"],
        negationRequired: true,
        crossTags: [],
        auContext: false
      },
      {
        label: "Does not respond to social bids",
        weight: 1.5,
        source: "clinician",
        specificity: "high",
        ageRange: { min: 12, max: 999, unit: "months" },
        keywords: ["doesn't respond to bids", "no response to social bids", "reduced response to bids"],
        regex: ["\\b(does\\s+not|doesn't|reduced|limited)\\s+respon\\w*\\s+to\\s+social\\s+bids?\\b"],
        negationRequired: true,
        crossTags: [],
        auContext: false
      },
      {
        label: "Reduced sharing of interests, emotions, or affect",
        weight: 1.5,
        source: "clinician",
        specificity: "high",
        ageRange: { min: 12, max: 999, unit: "months" },
        keywords: ["reduced sharing", "limited sharing", "doesn't share interests", "doesn't share emotions", "reduced affective sharing"],
        regex: ["\\b(reduced|limited|absent|fails?\\s+to|does\\s+not|doesn't)\\s+shar\\w*\\s+(interests?|emotions?|affect|enjoyment|achievements?)"],
        negationRequired: false,
        crossTags: ["A2"],
        auContext: false
      },
      {
        label: "Reduced theory of mind / perspective-taking",
        weight: 1.5,
        source: "clinician",
        specificity: "high",
        ageRange: { min: 48, max: 999, unit: "months" },
        keywords: ["theory of mind", "ToM", "perspective taking", "perspective-taking", "mentalising", "mentalizing"],
        regex: ["\\b(reduced|limited|impaired|poor|absent)\\s+(theory\\s+of\\s+mind|ToM|perspective[-\\s]?taking|mentali[sz]ing)"],
        negationRequired: false,
        crossTags: ["A3"],
        auContext: false
      },
      {
        label: "Concrete / literal interpretation of language",
        weight: 1.4,
        source: "clinician",
        specificity: "high",
        ageRange: { min: 48, max: 999, unit: "months" },
        keywords: ["literal interpretation", "concrete interpretation", "takes things literally", "literal-minded"],
        regex: ["\\b(literal|concrete)\\s+(interpretation|understanding|thinker|minded)\\b", "\\btakes?\\s+(things|it|everything)\\s+literally\\b"],
        negationRequired: false,
        crossTags: [],
        auContext: false
      },

      // ============================================================
      // PARENT / TEACHER — CONVERSATION RECIPROCITY
      // ============================================================
      {
        label: "Doesn't really have conversations",
        weight: 1.4,
        source: "parent",
        specificity: "high",
        ageRange: { min: 36, max: 999, unit: "months" },
        keywords: ["doesn't have conversations", "can't hold a conversation", "no real conversation", "conversations don't go anywhere"],
        regex: ["\\b(doesn't|does\\s+not|can't|cannot|won't)\\s+(really\\s+)?(have|hold|do)\\s+(a\\s+)?conversation"],
        negationRequired: true,
        crossTags: [],
        auContext: false
      },
      {
        label: "Talks AT people not WITH people",
        weight: 1.4,
        source: "parent",
        specificity: "high",
        ageRange: { min: 36, max: 999, unit: "months" },
        keywords: ["talks at me", "talks at people", "talks at not with", "lectures me", "talks at us"],
        regex: ["\\btalks?\\s+at\\s+(me|people|us|her|him|them|you)\\b", "\\b(lecture|monologue|info[-\\s]?dump)s?\\s+(me|people|at|on)"],
        negationRequired: false,
        crossTags: ["A3"],
        auContext: false
      },
      {
        label: "Doesn't ask about others' day or experiences",
        weight: 1.3,
        source: "parent",
        specificity: "moderate",
        ageRange: { min: 60, max: 999, unit: "months" },
        keywords: ["doesn't ask how my day was", "never asks about me", "never asks about anyone else", "doesn't ask questions back"],
        regex: ["\\b(never|doesn't|does\\s+not)\\s+ask\\w*\\s+(me\\s+)?(about|how|what)"],
        negationRequired: true,
        crossTags: [],
        auContext: false
      },
      {
        label: "Doesn't notice when others are upset",
        weight: 1.5,
        source: "parent",
        specificity: "high",
        ageRange: { min: 36, max: 999, unit: "months" },
        keywords: ["doesn't notice I'm sad", "doesn't notice when I cry", "walked past me crying", "doesn't react when I'm upset"],
        regex: ["\\b(doesn't|does\\s+not|never|didn't)\\s+(notice|see|realise|register)\\s+(when\\s+)?(I'm|I\\s+am|I'm\\s+being|me\\s+being)\\s+(sad|upset|crying|hurt|angry)", "\\bwalked\\s+past\\s+(me|her|him|us)\\s+crying\\b"],
        negationRequired: true,
        crossTags: [],
        auContext: false
      },
      {
        label: "Didn't comfort sibling or family member when distressed",
        weight: 1.4,
        source: "parent",
        specificity: "high",
        ageRange: { min: 30, max: 999, unit: "months" },
        keywords: ["didn't comfort", "doesn't comfort", "no empathy when sister fell", "didn't help when brother cried"],
        regex: ["\\b(didn't|did\\s+not|doesn't|fails?\\s+to)\\s+comfort\\b", "\\bno\\s+empathy\\s+when\\b"],
        negationRequired: true,
        crossTags: [],
        auContext: false
      },
      {
        label: "Goes on and on about preferred topic",
        weight: 1.5,
        source: "parent",
        specificity: "high",
        ageRange: { min: 48, max: 999, unit: "months" },
        keywords: ["goes on and on", "won't stop talking about", "all he talks about", "all she talks about", "every conversation comes back to"],
        regex: ["\\b(goes\\s+on\\s+and\\s+on|won't\\s+stop\\s+talking|all\\s+(he|she|they)\\s+talks?\\s+about|every\\s+conversation\\s+comes?\\s+back\\s+to)\\b"],
        negationRequired: false,
        crossTags: ["B3"],
        auContext: false
      },
      {
        label: "Doesn't read the room / doesn't notice when people are bored",
        weight: 1.4,
        source: "parent",
        specificity: "high",
        ageRange: { min: 60, max: 999, unit: "months" },
        keywords: ["doesn't read the room", "doesn't pick up on cues", "doesn't notice people are bored", "keeps going when I'm walking away"],
        regex: ["\\b(doesn't|does\\s+not|can't|cannot)\\s+read\\s+the\\s+room\\b", "\\bdoesn't\\s+(pick\\s+up|notice|register|see)\\s+(on\\s+)?(social\\s+)?cues\\b", "\\bkeeps?\\s+going\\s+(even\\s+)?when\\s+(I'm|people\\s+are)\\s+(walking\\s+away|leaving|bored)"],
        negationRequired: true,
        crossTags: ["A2"],
        auContext: false
      },
      {
        label: "Repeats questions after they have been answered",
        weight: 1.4,
        source: "parent",
        specificity: "high",
        ageRange: { min: 48, max: 999, unit: "months" },
        keywords: ["asks the same question", "repeats questions", "asks again and again", "asks 50 times a day"],
        regex: ["\\basks?\\s+the\\s+same\\s+question\\b", "\\brepeats?\\s+questions?\\b", "\\basks?\\s+\\d+\\s+times\\s+a\\s+day\\b"],
        negationRequired: false,
        crossTags: ["B1"],
        auContext: false
      },
      {
        label: "Doesn't get jokes / sarcasm / idioms",
        weight: 1.4,
        source: "parent",
        specificity: "high",
        ageRange: { min: 60, max: 999, unit: "months" },
        keywords: ["doesn't get jokes", "doesn't get sarcasm", "doesn't understand sarcasm", "misses jokes", "takes it literally"],
        regex: ["\\b(doesn't|does\\s+not|can't|cannot|misses?)\\s+(get|understand|do)\\s+(jokes?|sarcasm|idioms?|expressions?|figures?\\s+of\\s+speech|sayings?)"],
        negationRequired: true,
        crossTags: [],
        auContext: false
      },
      {
        label: "Literal interpretation example: pull your socks up / hop in the car",
        weight: 1.7,
        source: "parent",
        specificity: "very high",
        ageRange: { min: 36, max: 999, unit: "months" },
        keywords: ["pulled his socks up", "literally pulled", "hopped in the car", "literally hopped", "I said pull yourself together"],
        regex: ["\\bliterally\\s+(pulled|hopped|jumped|climbed|grabbed|took|did)\\b", "\\b(pull\\s+your\\s+socks\\s+up|hop\\s+in\\s+the\\s+car|pull\\s+yourself\\s+together|hold\\s+your\\s+horses|cat\\s+got\\s+your\\s+tongue)\\b.*\\b(literally|actually)\\b"],
        negationRequired: false,
        crossTags: [],
        auContext: false,
        note: "Verbatim parent examples of literal interpretation are pathognomonic when present"
      },
      {
        label: "Wasn't interested in other babies / siblings as infants",
        weight: 1.5,
        source: "parent",
        specificity: "high",
        ageRange: { min: 0, max: 24, unit: "months", retrospective: true },
        keywords: ["wasn't interested in other babies", "didn't notice when brother was born", "ignored the new baby"],
        regex: ["\\b(wasn't|was\\s+not|never)\\s+interested\\s+in\\s+(other\\s+)?bab(ies|y)\\b", "\\b(didn't|did\\s+not)\\s+(really\\s+)?notice\\s+(when\\s+)?(his|her|the)\\s+(brother|sister|sibling)\\s+was\\s+born\\b"],
        negationRequired: true,
        crossTags: ["A3"],
        auContext: false
      },
      {
        label: "Self-contained — doesn't seek caregiver out",
        weight: 1.4,
        source: "parent",
        specificity: "high",
        ageRange: { min: 12, max: 999, unit: "months" },
        keywords: ["self-contained", "doesn't seek us out", "doesn't need us", "happy on his own", "in his own world"],
        regex: ["\\b(self[-\\s]?contained|doesn't\\s+(seek|need)\\s+(us|me|his\\s+parents?)|happy\\s+on\\s+(his|her)\\s+own|in\\s+(his|her|their)\\s+own\\s+world)\\b"],
        negationRequired: false,
        crossTags: ["A3"],
        auContext: false
      },

      // ============================================================
      // CHILD SELF-REPORT
      // ============================================================
      {
        label: "I don't know what to say in conversations",
        weight: 1.3,
        source: "child",
        specificity: "moderate",
        ageRange: { min: 96, max: 999, unit: "months" },
        keywords: ["don't know what to say", "run out of things to talk about", "don't know how to make conversation"],
        regex: ["\\bdon't\\s+know\\s+what\\s+to\\s+say\\b", "\\brun\\s+out\\s+of\\s+things\\s+to\\s+(say|talk\\s+about)\\b"],
        negationRequired: false,
        crossTags: [],
        auContext: false
      },
      {
        label: "Small talk is exhausting / I find it difficult",
        weight: 1.4,
        source: "child",
        specificity: "high",
        ageRange: { min: 84, max: 999, unit: "months" },
        keywords: ["small talk is exhausting", "small talk is hard", "I hate small talk"],
        regex: ["\\bsmall\\s+talk\\s+is\\s+(exhausting|hard|difficult|the\\s+worst|painful)\\b", "\\bI\\s+hate\\s+small\\s+talk\\b"],
        negationRequired: false,
        crossTags: ["MASKING"],
        auContext: false
      },
      {
        label: "I don't know what people are feeling",
        weight: 1.4,
        source: "child",
        specificity: "high",
        ageRange: { min: 84, max: 999, unit: "months" },
        keywords: ["don't know what people are feeling", "can't read emotions", "don't get how people feel"],
        regex: ["\\b(don't|do\\s+not|can't|cannot)\\s+(know|tell|read|see)\\s+(what\\s+)?people\\s+are\\s+feeling\\b"],
        negationRequired: false,
        crossTags: [],
        auContext: false
      },
      {
        label: "I forget to ask people about themselves",
        weight: 1.5,
        source: "child",
        specificity: "high",
        ageRange: { min: 84, max: 999, unit: "months" },
        keywords: ["forget to ask people", "don't think to ask", "I don't remember to ask"],
        regex: ["\\b(forget|don't\\s+remember|don't\\s+think)\\s+to\\s+ask\\s+(people|them|others)\\b"],
        negationRequired: false,
        crossTags: ["MASKING"],
        auContext: false,
        note: "Often appears in masking/late-identified presentations, particularly female/AFAB"
      },
      {
        label: "Don't really get people / social world confusing (adolescent self-report)",
        weight: 1.55,
        source: "child",
        specificity: "very high",
        ageRange: { min: 72, max: 999, unit: "months" },
        keywords: ["don't get people", "don't understand people", "people are confusing"],
        regex: [
          "\\bdon'?t\\s+really\\s+get\\s+people\\b",
          "\\bI\\s+don'?t\\s+(understand|get)\\s+people\\b",
          "\\bpeople\\s+(are\\s+)?(confusing|hard\\s+to\\s+read)\\b",
          "\\b(social|conversations?)\\s+(feel\\s+)?(confusing|exhausting|draining)\\b",
        ],
        negationRequired: false,
        crossTags: ["MASKING"],
        auContext: false,
      },
      {
        label: "Don't notice social cues unless someone walks away / leaves",
        weight: 1.5,
        source: "child",
        specificity: "high",
        ageRange: { min: 72, max: 999, unit: "months" },
        keywords: ["don't notice unless they walk away"],
        regex: [
          "\\bdon'?t\\s+notice\\s+unless\\s+they\\s+(walk\\s+away|leave)\\b",
          "\\bonly\\s+notice\\s+when\\s+someone\\s+leaves\\b",
        ],
        negationRequired: false,
        crossTags: [],
        auContext: false,
      },
      {
        label: "Online-only friendships / discord friends / not friends in real life",
        weight: 1.45,
        source: "child",
        specificity: "high",
        ageRange: { min: 72, max: 999, unit: "months" },
        keywords: ["online friends only", "only friends online"],
        regex: [
          "\\b(online[-\\s]?only|only\\s+online)\\s+friend(s|ships)?\\b",
          "\\bfriends?\\s+(on\\s+)?(discord|minecraft|roblox|online)\\b",
          "\\bnot\\s+really\\s+friends?\\s+in\\s+real\\s+life\\b",
        ],
        negationRequired: false,
        crossTags: ["A3"],
        auContext: false,
      },
      {
        label: "Difficulty entering or joining group conversations",
        weight: 1.45,
        source: "child",
        specificity: "high",
        ageRange: { min: 72, max: 999, unit: "months" },
        keywords: ["hard to join conversations", "can't get into the conversation"],
        regex: [
          "\\b(hard|difficult)\\s+to\\s+(join|enter)\\s+(group\\s+)?conversations?\\b",
          "\\bcan'?t\\s+get\\s+into\\s+the\\s+conversation\\b",
        ],
        negationRequired: false,
        crossTags: [],
        auContext: false,
      },
      {
        label: "Intellectualised / formal social responses (adolescent)",
        weight: 1.45,
        source: "clinician",
        specificity: "high",
        ageRange: { min: 72, max: 999, unit: "months" },
        keywords: ["intellectualised responses", "formal register in social contexts"],
        regex: [
          "\\bintellectuali[sz]ed\\s+(responses?|style|register)\\b",
          "\\b(formal|lecture[-\\s]?like)\\s+(register|tone)\\s+in\\s+social\\b",
        ],
        negationRequired: false,
        crossTags: [],
        auContext: false,
      },

      // ============================================================
      // REAL-TIME CLINIC OBSERVATIONS
      // ============================================================
      {
        label: "Did not greet examiner / did not respond to greeting",
        weight: 1.4,
        source: "observation",
        specificity: "high",
        ageRange: { min: 36, max: 999, unit: "months" },
        keywords: ["didn't greet", "no greeting", "didn't respond to hello", "didn't say hello back"],
        regex: ["\\b(did\\s+not|didn't)\\s+(greet|return\\s+greeting|respond\\s+to\\s+(hello|greeting))"],
        negationRequired: true,
        crossTags: ["A2"],
        auContext: false
      },
      {
        label: "Did not share completed task / seek shared enjoyment",
        weight: 1.5,
        source: "observation",
        specificity: "high",
        ageRange: { min: 18, max: 999, unit: "months" },
        keywords: ["didn't show parent", "didn't share task", "didn't seek praise", "no shared enjoyment"],
        regex: ["\\b(did\\s+not|didn't)\\s+(show|share|seek)\\s+(parent|examiner|completed\\s+task|praise|enjoyment|excitement)"],
        negationRequired: true,
        crossTags: ["A2"],
        auContext: false
      },
      {
        label: "Returned to preferred topic regardless of question (perseveration)",
        weight: 1.5,
        source: "observation",
        specificity: "very high",
        ageRange: { min: 48, max: 999, unit: "months" },
        keywords: ["perseverated on topic", "kept returning to special interest", "monologue on preferred topic", "redirected to interest"],
        regex: ["\\b(perseverat|kept\\s+returning|monologu|redirect)"],
        negationRequired: false,
        crossTags: ["B3"],
        auContext: false
      },
      {
        label: "Telehealth / clinic: subtle surface presentation, intermittent engagement, or limited reciprocal flow",
        weight: 1.48,
        source: "observation",
        specificity: "high",
        ageRange: { min: 72, max: 999, unit: "months" },
        keywords: ["subtle presentation externally", "intermittent eye contact", "limited reciprocal flow"],
        regex: [
          "\\bsubtle\\s+presentation\\s+externally\\b",
          "\\beye\\s+contact\\s+intermittent\\b",
          "\\blimited\\s+reciprocal\\s+(flow|exchange|back[-\\s]and[-\\s]forth)\\b",
          "\\bappears?\\s+superficially\\s+(fine|appropriate)\\b.*\\b(underneath|however|although)\\b",
        ],
        negationRequired: false,
        crossTags: ["MASKING", "A2"],
        auContext: false
      },
      {
        label: "No spontaneous comments or declaratives — communication primarily instrumental",
        weight: 1.6,
        source: "observation",
        specificity: "very high",
        ageRange: { min: 24, max: 999, unit: "months" },
        keywords: ["no spontaneous comments", "communication only requesting", "instrumental only", "no declaratives", "only proto-imperative"],
        regex: ["\\b(no|absent|reduced|lacking)\\s+(spontaneous\\s+)?(comments?|declaratives?)\\b", "\\b(communication|speech)\\s+(primarily|only|mostly)\\s+(requesting|instrumental|proto[-\\s]?imperative)"],
        negationRequired: false,
        crossTags: ["A2"],
        auContext: false,
        note: "Highly specific ASD marker; near-pathognomonic when present"
      },
      {
        label: "Did not respond to examiner's pretend distress (ADOS-style probe)",
        weight: 1.6,
        source: "observation",
        specificity: "very high",
        ageRange: { min: 24, max: 999, unit: "months" },
        keywords: ["didn't respond to ouch", "no empathic response", "no reaction to examiner's distress"],
        regex: ["\\b(did\\s+not|didn't)\\s+respond\\s+to\\s+(examiner|clinician)'s?\\s+(pretend|simulated)\\s+(distress|pain|hurt)", "\\bno\\s+empathic\\s+response\\s+to\\s+ouch\\b"],
        negationRequired: true,
        crossTags: [],
        auContext: false
      },

      // ============================================================
      // DEVELOPMENTAL HISTORY
      // ============================================================
      {
        label: "Didn't engage in peekaboo / pat-a-cake as infant",
        weight: 1.5,
        source: "history",
        specificity: "high",
        ageRange: { min: 6, max: 18, unit: "months", retrospective: true },
        keywords: ["didn't play peekaboo", "no peekaboo", "didn't do pat-a-cake", "no pat-a-cake"],
        regex: ["\\b(didn't|did\\s+not|never)\\s+(really\\s+)?(play|do|enjoy)\\s+(peek[-\\s]?a[-\\s]?boo|pat[-\\s]?a[-\\s]?cake|round\\s+and\\s+round\\s+the\\s+garden)"],
        negationRequired: true,
        crossTags: ["A2"],
        auContext: true,
        auContextNote: "Round and Round the Garden is a common AU/UK infant interactive routine"
      },
      {
        label: "Played alongside not with — parallel play past developmental norm",
        weight: 1.4,
        source: "history",
        specificity: "high",
        ageRange: { min: 36, max: 999, unit: "months" },
        keywords: ["played alongside not with", "parallel play", "didn't engage with other kids"],
        regex: ["\\b(played?\\s+alongside\\s+(not\\s+with|but\\s+not\\s+with)|parallel\\s+play|next\\s+to\\s+but\\s+not\\s+with)"],
        negationRequired: false,
        crossTags: ["A3"],
        auContext: false
      },
      {
        label: "Didn't bring toys to share / didn't show parent things",
        weight: 1.6,
        source: "history",
        specificity: "very high",
        ageRange: { min: 12, max: 36, unit: "months", retrospective: true },
        keywords: ["didn't bring me toys", "didn't show me things", "didn't share toys with me", "no give-and-show"],
        regex: ["\\b(didn't|did\\s+not|never)\\s+(bring|show)\\s+(me\\s+)?(toys|things|drawings|objects)"],
        negationRequired: true,
        crossTags: ["A2"],
        auContext: false
      }
    ]
  },
  {
    domain: "A2 Nonverbal communication",
    code: "A2",
    criterion: "Deficits in nonverbal communicative behaviours",
    criterionGroup: "A",
    dsmReference: "DSM-5-TR 299.00 Criterion A2",
    severityWeight: 1.2,
    detectionStrategy: "negation-dominant",
    markers: [
      // ============================================================
      // EYE CONTACT — CLINICIAN
      // ============================================================
      {
        label: "Reduced / poor / fleeting eye contact",
        weight: 1.3,
        source: "clinician",
        specificity: "moderate",
        ageRange: { min: 6, max: 999, unit: "months" },
        keywords: ["reduced eye contact", "poor eye contact", "fleeting eye contact", "limited eye contact", "diminished eye contact"],
        regex: ["\\b(reduced|poor|fleeting|limited|diminished|brief|inconsistent)\\s+eye\\s+contact\\b"],
        negationRequired: false,
        crossTags: [],
        auContext: false
      },
      {
        label: "Sideways / peripheral / corner-of-eye gaze",
        weight: 1.6,
        source: "clinician",
        specificity: "very high",
        ageRange: { min: 12, max: 999, unit: "months" },
        keywords: ["sideways gaze", "peripheral gaze", "corner of eye", "looks from the corner", "lateral glances"],
        regex: ["\\b(sideways|peripheral|lateral|corner[-\\s]?of[-\\s]?eye)\\s+(gaze|glance|look)", "\\blooks?\\s+(at\\s+(things|me|people)\\s+)?(from\\s+)?(out\\s+of\\s+)?the\\s+corner\\s+of\\s+(his|her|their)\\s+eye"],
        negationRequired: false,
        crossTags: ["B4"],
        auContext: false,
        note: "Highly specific ASD visual marker"
      },
      {
        label: "Eye contact instrumental only — only when requesting",
        weight: 1.7,
        source: "clinician",
        specificity: "very high",
        ageRange: { min: 18, max: 999, unit: "months" },
        keywords: ["only looks when wants something", "instrumental eye contact", "eye contact only when requesting"],
        regex: ["\\beye\\s+contact\\s+only\\s+when\\s+(requesting|wants?|needs?)", "\\bonly\\s+looks?\\s+(at\\s+me\\s+)?when\\s+(he|she|they)\\s+wants?\\s+something\\b"],
        negationRequired: false,
        crossTags: [],
        auContext: false,
        note: "Pathognomonic ASD pattern"
      },
      {
        label: "Eye contact not coordinated with speech / not used to regulate interaction",
        weight: 1.6,
        source: "clinician",
        specificity: "very high",
        ageRange: { min: 24, max: 999, unit: "months" },
        keywords: ["not coordinated with speech", "not used to regulate", "not communicative eye contact"],
        regex: ["\\beye\\s+contact\\s+(not\\s+coordinated|not\\s+used\\s+to\\s+regulate|not\\s+communicative)"],
        negationRequired: false,
        crossTags: [],
        auContext: false
      },
      {
        label: "Looks past / through examiner",
        weight: 1.5,
        source: "clinician",
        specificity: "high",
        ageRange: { min: 12, max: 999, unit: "months" },
        keywords: ["looks past", "looks through", "stares through"],
        regex: ["\\blooks?\\s+(past|through|right\\s+through)\\s+(me|examiner|people|him|her)"],
        negationRequired: false,
        crossTags: [],
        auContext: false
      },
      {
        label: "Looks at mouth instead of eyes",
        weight: 1.4,
        source: "clinician",
        specificity: "high",
        ageRange: { min: 12, max: 999, unit: "months" },
        keywords: ["looks at mouth", "mouth not eyes", "watches mouth"],
        regex: ["\\blooks?\\s+at\\s+(my\\s+|the\\s+)?mouth\\s+(not|instead\\s+of|rather\\s+than)\\s+(my\\s+)?eyes?\\b"],
        negationRequired: false,
        crossTags: [],
        auContext: false,
        note: "Documented developmental pattern in ASD - infant gaze studies"
      },

      // ============================================================
      // EYE CONTACT — PARENT
      // ============================================================
      {
        label: "Doesn't look at me when I talk to him",
        weight: 1.4,
        source: "parent",
        specificity: "high",
        ageRange: { min: 12, max: 999, unit: "months" },
        keywords: ["doesn't look at me", "won't look at me", "doesn't look when I talk"],
        regex: ["\\b(doesn't|does\\s+not|won't|will\\s+not)\\s+look\\s+at\\s+(me|us)\\s+when\\s+I\\s+(talk|speak)"],
        negationRequired: true,
        crossTags: [],
        auContext: false
      },
      {
        label: "Looks right through me",
        weight: 1.5,
        source: "parent",
        specificity: "high",
        ageRange: { min: 12, max: 999, unit: "months" },
        keywords: ["looks through me", "looks right through", "stares through me"],
        regex: ["\\blooks?\\s+(right\\s+)?through\\s+(me|us)\\b"],
        negationRequired: false,
        crossTags: [],
        auContext: false
      },
      {
        label: "Have to physically turn his face to me",
        weight: 1.5,
        source: "parent",
        specificity: "high",
        ageRange: { min: 12, max: 60, unit: "months" },
        keywords: ["turn his face", "physically turn face", "have to grab his chin"],
        regex: ["\\b(have\\s+to\\s+)?(physically\\s+)?turn\\s+(his|her|their)\\s+face\\b", "\\bgrab\\s+(his|her|their)\\s+chin\\b"],
        negationRequired: false,
        crossTags: [],
        auContext: false
      },
      {
        label: "Only looks when he wants something",
        weight: 1.7,
        source: "parent",
        specificity: "very high",
        ageRange: { min: 18, max: 999, unit: "months" },
        keywords: ["only looks when wants", "only when needs something", "looks for requesting only"],
        regex: ["\\bonly\\s+looks?\\s+(at\\s+(me|us)\\s+)?when\\s+(he|she|they)\\s+wants?\\s+something\\b"],
        negationRequired: false,
        crossTags: [],
        auContext: false,
        note: "Pathognomonic instrumental-only gaze pattern"
      },
      {
        label: "Looks sideways out of the corner of his eye",
        weight: 1.6,
        source: "parent",
        specificity: "very high",
        ageRange: { min: 12, max: 999, unit: "months" },
        keywords: ["sideways from corner of eye", "looks sideways", "from the side of his eye"],
        regex: ["\\b(sideways|from\\s+the\\s+side|out\\s+of\\s+the\\s+corner)\\s+of\\s+(his|her|their)\\s+eye"],
        negationRequired: false,
        crossTags: [],
        auContext: false
      },
      {
        label: "Looks but it's not connecting",
        weight: 1.5,
        source: "parent",
        specificity: "high",
        ageRange: { min: 12, max: 999, unit: "months" },
        keywords: ["not connecting", "not really seeing me", "looks but doesn't see"],
        regex: ["\\blooks?\\s+but\\s+(it's\\s+)?not\\s+connecting\\b", "\\blooks?\\s+but\\s+(doesn't|does\\s+not)\\s+(really\\s+)?see\\b"],
        negationRequired: false,
        crossTags: [],
        auContext: false,
        note: "Distinctive parent metaphor for non-communicative gaze"
      },

      // ============================================================
      // FACIAL EXPRESSION — CLINICIAN
      // ============================================================
      {
        label: "Flat / restricted / mask-like affect",
        weight: 1.4,
        source: "clinician",
        specificity: "high",
        ageRange: { min: 12, max: 999, unit: "months" },
        keywords: ["flat affect", "restricted affect", "mask-like face", "expressionless", "inexpressive"],
        regex: ["\\b(flat|restricted|mask[-\\s]?like|inexpressive|expressionless|blunted)\\s+(affect|face|expression)"],
        negationRequired: false,
        crossTags: [],
        auContext: false
      },
      {
        label: "Reduced reciprocal facial expression / social smiling",
        weight: 1.6,
        source: "clinician",
        specificity: "very high",
        ageRange: { min: 6, max: 999, unit: "months" },
        keywords: ["reduced social smiling", "no reciprocal smile", "smile not directed", "smile not shared"],
        regex: ["\\b(reduced|absent|limited|no)\\s+(reciprocal|social|directed|shared)\\s+(smile|smiling|facial\\s+expression)"],
        negationRequired: false,
        crossTags: ["A1"],
        auContext: false
      },
      {
        label: "Facial expression incongruent with content / mismatched to emotion",
        weight: 1.5,
        source: "clinician",
        specificity: "very high",
        ageRange: { min: 36, max: 999, unit: "months" },
        keywords: ["incongruent expression", "mismatched expression", "face doesn't match", "expression doesn't fit"],
        regex: ["\\b(facial\\s+)?expression\\s+(incongruent|mismatched|doesn't\\s+match|inappropriate)"],
        negationRequired: false,
        crossTags: [],
        auContext: false
      },

      // ============================================================
      // FACIAL EXPRESSION — PARENT
      // ============================================================
      {
        label: "Doesn't smile back / doesn't return smiles",
        weight: 1.6,
        source: "parent",
        specificity: "very high",
        ageRange: { min: 3, max: 999, unit: "months" },
        keywords: ["doesn't smile back", "doesn't return smiles", "no smile back", "I smile and nothing"],
        regex: ["\\b(doesn't|does\\s+not|never|didn't)\\s+(really\\s+)?smile\\s+back\\b", "\\bdoesn't\\s+return\\s+(my\\s+)?smiles?\\b"],
        negationRequired: true,
        crossTags: [],
        auContext: false,
        note: "Critical early developmental marker - reduced social smile from infancy"
      },
      {
        label: "Hard to read what she's feeling / face doesn't change much",
        weight: 1.4,
        source: "parent",
        specificity: "high",
        ageRange: { min: 24, max: 999, unit: "months" },
        keywords: ["hard to read", "face doesn't change", "can't tell what she's feeling", "stone-faced", "poker face"],
        regex: ["\\b(hard|difficult)\\s+to\\s+(read|tell|know)\\s+(what\\s+)?(he|she|they)('s|\\s+is|\\s+are)\\s+feeling\\b", "\\b(face|expression)\\s+doesn't\\s+(change|move)", "\\b(stone[-\\s]?faced|poker\\s+face)\\b"],
        negationRequired: false,
        crossTags: [],
        auContext: false
      },
      {
        label: "Doesn't smile in photos / for selfies / for the camera",
        weight: 1.5,
        source: "parent",
        specificity: "very high",
        ageRange: { min: 36, max: 999, unit: "months" },
        keywords: ["doesn't smile in photos", "won't smile for camera", "doesn't pose", "looks away in pictures"],
        regex: ["\\b(doesn't|won't|never)\\s+(smile|pose|look)\\s+(in|for)\\s+(photos?|pictures?|selfies?|the\\s+camera)\\b"],
        negationRequired: true,
        crossTags: [],
        auContext: false,
        note: "Frequently mentioned by parents but rarely coded by scribes"
      },
      {
        label: "Doesn't react when I'm upset / doesn't show concern",
        weight: 1.5,
        source: "parent",
        specificity: "high",
        ageRange: { min: 24, max: 999, unit: "months" },
        keywords: ["doesn't react when I'm upset", "doesn't show concern", "doesn't notice my feelings"],
        regex: ["\\b(doesn't|does\\s+not)\\s+(react|respond|show\\s+concern)\\s+when\\s+(I'm|we're)\\s+(upset|sad|hurt|crying)"],
        negationRequired: true,
        crossTags: ["A1"],
        auContext: false
      },
      {
        label: "Doesn't look excited even when she is",
        weight: 1.5,
        source: "parent",
        specificity: "high",
        ageRange: { min: 24, max: 999, unit: "months" },
        keywords: ["doesn't look excited", "no excitement on face", "doesn't show excitement"],
        regex: ["\\b(doesn't|does\\s+not)\\s+look\\s+excited\\s+(even\\s+)?when\\s+(he|she|they)\\s+(is|are)\\b"],
        negationRequired: true,
        crossTags: [],
        auContext: false
      },

      // ============================================================
      // GESTURES — CLINICIAN (HIGHEST SPECIFICITY MARKERS)
      // ============================================================
      {
        label: "Absent or reduced pointing",
        weight: 1.7,
        source: "clinician",
        specificity: "very high",
        ageRange: { min: 12, max: 999, unit: "months" },
        keywords: ["absent pointing", "doesn't point", "no pointing", "limited pointing", "never points"],
        regex: ["\\b(absent|no|reduced|limited|doesn't|does\\s+not|never)\\s+(spontaneous\\s+)?point(ing|s)?\\b"],
        negationRequired: false,
        crossTags: [],
        auContext: false,
        note: "Gold-standard early ASD marker; absent point at 18 months is high-specificity"
      },
      {
        label: "Proto-imperative pointing only (requesting), not proto-declarative (sharing)",
        weight: 1.8,
        source: "clinician",
        specificity: "very high",
        ageRange: { min: 12, max: 999, unit: "months" },
        keywords: ["proto-imperative", "proto imperative", "pointing for requesting", "requesting point", "no declarative point"],
        regex: ["\\bproto[-\\s]?imperative\\s+(only|pointing)\\b", "\\b(no|absent|missing|reduced)\\s+proto[-\\s]?declarative", "\\bpointing?\\s+only\\s+for\\s+(requesting|wants|needs)"],
        negationRequired: false,
        crossTags: [],
        auContext: false,
        note: "Pathognomonic developmental marker - Mundy/Sigman classic"
      },
      {
        label: "Hand-leading / uses adult's hand as a tool",
        weight: 1.7,
        source: "clinician",
        specificity: "very high",
        ageRange: { min: 12, max: 60, unit: "months" },
        keywords: ["hand-leading", "hand leading", "uses my hand", "adult's hand as tool", "tool use of hand"],
        regex: ["\\bhand[-\\s]?leading\\b", "\\buses?\\s+(adult's?|my|parent's?|caregiver's?)\\s+hand\\s+as\\s+(a\\s+)?tool\\b"],
        negationRequired: false,
        crossTags: [],
        auContext: false,
        note: "Highly specific ASD marker - rarely seen in typical development or other conditions"
      },
      {
        label: "Gestures not integrated with speech",
        weight: 1.5,
        source: "clinician",
        specificity: "very high",
        ageRange: { min: 24, max: 999, unit: "months" },
        keywords: ["gestures not integrated", "speech without gesture", "gesture not coordinated"],
        regex: ["\\bgestures?\\s+(not\\s+integrated|not\\s+coordinated|poorly\\s+coordinated)", "\\bspeech\\s+without\\s+(accompanying\\s+)?gesture"],
        negationRequired: false,
        crossTags: [],
        auContext: false
      },
      {
        label: "Reduced use of conventional gestures (wave, nod, shake, shrug, thumbs up)",
        weight: 1.4,
        source: "clinician",
        specificity: "high",
        ageRange: { min: 12, max: 999, unit: "months" },
        keywords: ["reduced gestures", "doesn't wave", "doesn't nod", "doesn't shrug", "no thumbs up", "no high-five"],
        regex: ["\\b(reduced|limited|absent|no|doesn't|does\\s+not)\\s+(use\\s+of\\s+)?(conventional\\s+)?gestures?\\b", "\\b(doesn't|does\\s+not|never)\\s+(wave|nod|shake|shrug|do\\s+thumbs|high[-\\s]?five)"],
        negationRequired: false,
        crossTags: [],
        auContext: false
      },

      // ============================================================
      // GESTURES — PARENT (PATHOGNOMONIC PHRASES)
      // ============================================================
      {
        label: "Never points at things",
        weight: 1.7,
        source: "parent",
        specificity: "very high",
        ageRange: { min: 12, max: 999, unit: "months" },
        keywords: ["never points", "doesn't point", "won't point", "no pointing"],
        regex: ["\\b(never|doesn't|does\\s+not|won't)\\s+points?\\s+(at\\s+things|to\\s+things|at\\s+anything)?\\b"],
        negationRequired: true,
        crossTags: [],
        auContext: false
      },
      {
        label: "Pulls my hand to what he wants / drags me to the fridge",
        weight: 1.7,
        source: "parent",
        specificity: "very high",
        ageRange: { min: 12, max: 60, unit: "months" },
        keywords: ["pulls my hand", "drags me to", "puts my hand on", "leads me by the hand", "uses my hand"],
        regex: ["\\b(pulls?|drags?|leads?|takes?)\\s+(me|my\\s+hand|my\\s+wrist|my\\s+arm)\\s+(to|by)\\b", "\\bputs?\\s+my\\s+hand\\s+on\\b", "\\buses?\\s+my\\s+hand\\s+(to|as)\\b"],
        negationRequired: false,
        crossTags: [],
        auContext: false,
        note: "Hand-leading verbatim - pathognomonic"
      },
      {
        label: "Doesn't show me things he's excited about",
        weight: 1.6,
        source: "parent",
        specificity: "very high",
        ageRange: { min: 12, max: 60, unit: "months" },
        keywords: ["doesn't show me things", "doesn't bring drawings", "doesn't show toys"],
        regex: ["\\b(doesn't|does\\s+not|never)\\s+show\\s+me\\s+(things|toys|drawings|stuff)"],
        negationRequired: true,
        crossTags: ["A1"],
        auContext: false
      },
      {
        label: "Doesn't wave hello / goodbye",
        weight: 1.5,
        source: "parent",
        specificity: "high",
        ageRange: { min: 12, max: 999, unit: "months" },
        keywords: ["doesn't wave", "no waving", "won't wave goodbye"],
        regex: ["\\b(doesn't|does\\s+not|never|won't)\\s+wave\\s+(hello|goodbye|bye)?"],
        negationRequired: true,
        crossTags: [],
        auContext: false
      },

      // ============================================================
      // JOINT ATTENTION — CLINICIAN (CORE EARLY MARKERS)
      // ============================================================
      {
        label: "Reduced or absent joint attention",
        weight: 1.7,
        source: "clinician",
        specificity: "very high",
        ageRange: { min: 9, max: 999, unit: "months" },
        keywords: ["reduced joint attention", "absent joint attention", "no joint attention", "limited joint attention"],
        regex: ["\\b(reduced|absent|limited|impaired|no)\\s+joint\\s+attention\\b"],
        negationRequired: false,
        crossTags: [],
        auContext: false,
        note: "Core ASD developmental marker"
      },
      {
        label: "Does not initiate joint attention (IJA)",
        weight: 1.7,
        source: "clinician",
        specificity: "very high",
        ageRange: { min: 9, max: 999, unit: "months" },
        keywords: ["doesn't initiate joint attention", "no IJA", "no initiation of joint attention"],
        regex: ["\\b(does\\s+not|doesn't|fails?\\s+to)\\s+initiate\\s+joint\\s+attention\\b", "\\bno\\s+IJA\\b"],
        negationRequired: true,
        crossTags: [],
        auContext: false
      },
      {
        label: "Does not respond to joint attention bids (RJA)",
        weight: 1.7,
        source: "clinician",
        specificity: "very high",
        ageRange: { min: 9, max: 999, unit: "months" },
        keywords: ["doesn't respond to JA", "no RJA", "doesn't follow point", "doesn't follow gaze"],
        regex: ["\\b(does\\s+not|doesn't|fails?\\s+to)\\s+(respond\\s+to\\s+joint\\s+attention|follow\\s+(point|gaze))", "\\bno\\s+RJA\\b"],
        negationRequired: true,
        crossTags: [],
        auContext: false
      },
      {
        label: "Reduced social referencing — does not check in with caregiver",
        weight: 1.6,
        source: "clinician",
        specificity: "very high",
        ageRange: { min: 9, max: 999, unit: "months" },
        keywords: ["reduced social referencing", "doesn't check in", "doesn't look to parent"],
        regex: ["\\breduced\\s+social\\s+referencing\\b", "\\bdoesn't\\s+(check\\s+in|look\\s+to\\s+(parent|caregiver))"],
        negationRequired: false,
        crossTags: [],
        auContext: false
      },
      {
        label: "Does not orient to name",
        weight: 1.7,
        source: "clinician",
        specificity: "very high",
        ageRange: { min: 9, max: 999, unit: "months" },
        keywords: ["doesn't orient to name", "no response to name", "didn't orient to name", "doesn't respond to name"],
        regex: ["\\b(does\\s+not|doesn't|didn't|did\\s+not|fails?\\s+to)\\s+(orient|respond|turn|look)\\s+to\\s+(his|her|their)?\\s*name\\b"],
        negationRequired: true,
        crossTags: [],
        auContext: false,
        note: "M-CHAT-R critical item; Australian standard developmental check"
      },
      {
        label: "Did not orient to name despite normal hearing assessment",
        weight: 1.8,
        source: "clinician",
        specificity: "very high",
        ageRange: { min: 9, max: 999, unit: "months" },
        keywords: ["normal hearing but doesn't respond", "hearing test normal but", "hearing fine but no response to name"],
        regex: ["\\bhearing\\s+(test\\s+)?(was\\s+)?normal\\s+but\\b", "\\bnormal\\s+hearing\\s+but\\b"],
        negationRequired: false,
        crossTags: [],
        auContext: false,
        note: "Highest-specificity parent phrasing - extremely rare outside ASD"
      },

      // ============================================================
      // JOINT ATTENTION — PARENT (THE PATHOGNOMONIC PHRASES)
      // ============================================================
      {
        label: "Hearing test was normal but doesn't respond to name",
        weight: 1.8,
        source: "parent",
        specificity: "very high",
        ageRange: { min: 9, max: 999, unit: "months" },
        keywords: ["hearing test was normal but", "hearing test was fine but", "GP checked hearing but", "audiologist said normal but"],
        regex: ["\\b(hearing\\s+(test|check)|audiolog\\w+)\\s+(was|came\\s+back)?\\s*(normal|fine|clear|all\\s+clear)\\s+but\\b"],
        negationRequired: false,
        crossTags: [],
        auContext: false,
        note: "Near-pathognomonic Australian parent phrasing"
      },
      {
        label: "Other kids look up but he doesn't (plane / dog / loud noise)",
        weight: 1.7,
        source: "parent",
        specificity: "very high",
        ageRange: { min: 12, max: 999, unit: "months" },
        keywords: ["other kids look up but", "other kids point but", "everyone looks but he doesn't"],
        regex: ["\\b(other\\s+kids?|everyone\\s+else|all\\s+the\\s+(other\\s+)?kids?)\\s+(look(s)?\\s+up|point(s)?|notice(s)?)\\s+but\\s+(he|she|they)\\s+doesn't\\b"],
        negationRequired: false,
        crossTags: [],
        auContext: false,
        note: "Comparative parent observation - high diagnostic value"
      },
      {
        label: "I point at the dog and she looks at my finger not the dog",
        weight: 1.8,
        source: "parent",
        specificity: "very high",
        ageRange: { min: 12, max: 60, unit: "months" },
        keywords: ["looks at my finger not", "looks at finger instead", "doesn't follow point"],
        regex: ["\\blooks?\\s+at\\s+(my|the)\\s+finger\\s+(not|instead\\s+of|rather\\s+than)\\b", "\\b(doesn't|does\\s+not)\\s+follow\\s+(my|the)?\\s*point"],
        negationRequired: false,
        crossTags: [],
        auContext: false,
        note: "Classic developmental marker; pathognomonic when verbatim"
      },
      {
        label: "Wanders off without looking back / doesn't check in at playground",
        weight: 1.6,
        source: "parent",
        specificity: "very high",
        ageRange: { min: 18, max: 999, unit: "months" },
        keywords: ["wanders off", "doesn't check in", "doesn't look back", "no checking in at playground"],
        regex: ["\\bwanders?\\s+off\\s+without\\s+(looking|checking)\\s+back\\b", "\\b(doesn't|does\\s+not)\\s+check\\s+in\\s+(with\\s+me\\s+)?at\\s+(the\\s+)?playground\\b"],
        negationRequired: false,
        crossTags: ["SAFETY", "A3"],
        auContext: false
      },

      // ============================================================
      // PROSODY — CLINICIAN
      // ============================================================
      {
        label: "Monotone / flat / atypical prosody",
        weight: 1.5,
        source: "clinician",
        specificity: "very high",
        ageRange: { min: 36, max: 999, unit: "months" },
        keywords: ["monotone", "flat prosody", "atypical prosody", "robotic speech", "lacks intonation"],
        regex: ["\\b(monotone|monotonic|flat|atypical|unusual|robotic)\\s+(prosody|speech|intonation|voice)"],
        negationRequired: false,
        crossTags: [],
        auContext: false
      },
      {
        label: "Pedantic / formal / 'little professor' speech",
        weight: 1.5,
        source: "clinician",
        specificity: "very high",
        ageRange: { min: 60, max: 999, unit: "months" },
        keywords: ["pedantic speech", "formal speech", "little professor", "stilted speech", "overly formal"],
        regex: ["\\b(pedantic|stilted|overly\\s+formal|little\\s+professor|news\\s+reader|book[-\\s]?like)\\s+(speech|prosody|register|language)?"],
        negationRequired: false,
        crossTags: [],
        auContext: false
      },
      {
        label: "Foreign / mid-Atlantic accent without exposure",
        weight: 1.7,
        source: "clinician",
        specificity: "very high",
        ageRange: { min: 36, max: 999, unit: "months" },
        keywords: ["foreign accent without exposure", "mid-Atlantic accent", "American accent without exposure", "British accent without exposure"],
        regex: ["\\b(foreign|mid[-\\s]?Atlantic|American|British|affected)\\s+accent\\s+(without|despite|with\\s+no)\\s+exposure\\b"],
        negationRequired: false,
        crossTags: [],
        auContext: false,
        note: "Pathognomonic when present; near-zero false-positive rate"
      },

      // ============================================================
      // PROSODY — PARENT
      // ============================================================
      {
        label: "Sounds like a robot / TV character / YouTuber",
        weight: 1.6,
        source: "parent",
        specificity: "very high",
        ageRange: { min: 36, max: 999, unit: "months" },
        keywords: ["sounds like a robot", "sounds like a TV character", "sounds like a YouTuber", "sounds like Peppa", "sounds like Bluey"],
        regex: ["\\bsounds?\\s+like\\s+(a\\s+)?(robot|TV\\s+character|YouTuber|news\\s+reader|movie\\s+character)\\b", "\\bsounds?\\s+like\\s+(Peppa|Bluey|Paw\\s+Patrol|Octonauts)"],
        negationRequired: false,
        crossTags: ["B1"],
        auContext: true,
        auContextNote: "Bluey/Peppa references are common Australian cultural touchpoints"
      },
      {
        label: "Has an American accent and we're not American",
        weight: 1.7,
        source: "parent",
        specificity: "very high",
        ageRange: { min: 36, max: 999, unit: "months" },
        keywords: ["American accent and we're Australian", "British accent without exposure", "accent doesn't match family"],
        regex: ["\\b(American|British|Irish|Scottish)\\s+accent\\s+and\\s+we're\\s+not\\b", "\\b(American|British)\\s+accent\\s+(without|despite|but\\s+we're)\\s+(exposure|Australian|here|local)"],
        negationRequired: false,
        crossTags: [],
        auContext: true,
        auContextNote: "Specific to non-US/UK English-speaking countries; high signal in Australia"
      },
      {
        label: "Talks like he's reading a book / sounds like a little adult",
        weight: 1.5,
        source: "parent",
        specificity: "very high",
        ageRange: { min: 48, max: 999, unit: "months" },
        keywords: ["talks like reading a book", "sounds like a little adult", "talks like a professor"],
        regex: ["\\btalks?\\s+like\\s+(he's|she's|they're)\\s+reading\\s+a\\s+book\\b", "\\bsounds?\\s+like\\s+a\\s+little\\s+adult\\b", "\\btalks?\\s+like\\s+a\\s+(little\\s+)?professor\\b"],
        negationRequired: false,
        crossTags: [],
        auContext: false
      },

      // ============================================================
      // BODY LANGUAGE & PROXIMITY
      // ============================================================
      {
        label: "Stiff when hugged / hugs limp / doesn't return hugs",
        weight: 1.5,
        source: "parent",
        specificity: "high",
        ageRange: { min: 12, max: 999, unit: "months" },
        keywords: ["stiff when hugged", "hugs are limp", "doesn't hug back", "like hugging a board"],
        regex: ["\\b(stiff|rigid|tense)\\s+when\\s+hugged\\b", "\\b(doesn't|does\\s+not)\\s+hug\\s+back\\b", "\\b(hugs?\\s+are\\s+like|hugging)\\s+(a\\s+)?board"],
        negationRequired: false,
        crossTags: ["B4"],
        auContext: false
      },
      {
        label: "Doesn't reach up to be picked up (anticipatory posture absent)",
        weight: 1.6,
        source: "parent",
        specificity: "very high",
        ageRange: { min: 6, max: 24, unit: "months", retrospective: true },
        keywords: ["doesn't reach up", "doesn't lift arms", "no anticipatory posture", "didn't reach for me"],
        regex: ["\\b(doesn't|did\\s+not|didn't)\\s+(reach\\s+up|lift\\s+(his|her|their)\\s+arms?|reach\\s+for\\s+me)\\s+(to\\s+be\\s+picked\\s+up)?"],
        negationRequired: true,
        crossTags: [],
        auContext: false,
        note: "Critical infancy marker - reduced anticipatory postural communication"
      },
      {
        label: "Talks to me with his back turned",
        weight: 1.5,
        source: "parent",
        specificity: "very high",
        ageRange: { min: 36, max: 999, unit: "months" },
        keywords: ["talks with back turned", "back turned when talking", "doesn't face me when talking"],
        regex: ["\\btalks?\\s+(to\\s+(me|us)\\s+)?with\\s+(his|her|their)\\s+back\\s+turned\\b", "\\b(doesn't|does\\s+not)\\s+face\\s+me\\s+when\\s+talking\\b"],
        negationRequired: false,
        crossTags: [],
        auContext: false
      },

      // ============================================================
      // CHILD SELF-REPORT
      // ============================================================
      {
        label: "Eyes hurt / eyes are too much (sensory account of gaze aversion)",
        weight: 1.6,
        source: "child",
        specificity: "very high",
        ageRange: { min: 96, max: 999, unit: "months" },
        keywords: ["it hurts to look at eyes", "eyes are too much", "eye contact hurts"],
        regex: ["\\beyes?\\s+(hurts?|are?\\s+too\\s+much|burn|sting)", "\\b(it\\s+)?hurts?\\s+to\\s+look\\s+at\\s+(eyes|people's\\s+eyes)\\b"],
        negationRequired: false,
        crossTags: ["B4"],
        auContext: false,
        note: "Distinctive autistic phenomenology - sensory account of gaze aversion"
      },
      {
        label: "I forget to smile / I don't know what face to make",
        weight: 1.5,
        source: "child",
        specificity: "high",
        ageRange: { min: 96, max: 999, unit: "months" },
        keywords: ["forget to smile", "don't know what face to make", "people say I look angry", "what face to make"],
        regex: ["\\b(forget|don't\\s+remember)\\s+to\\s+smile\\b", "\\bdon't\\s+know\\s+what\\s+face\\s+to\\s+make\\b", "\\bpeople\\s+say\\s+I\\s+look\\s+(angry|sad|grumpy)\\s+but\\s+I'm\\s+not\\b"],
        negationRequired: false,
        crossTags: ["MASKING"],
        auContext: false
      },
      {
        label: "I copy what other people do (compensatory masking)",
        weight: 1.5,
        source: "child",
        specificity: "high",
        ageRange: { min: 120, max: 999, unit: "months" },
        keywords: ["I copy what people do", "I mimic", "I study how to act", "I learned how to do social"],
        regex: ["\\bI\\s+copy\\s+(what\\s+)?(other\\s+)?people\\s+do\\b", "\\bI\\s+mimic\\b", "\\bI\\s+(studied|learned|figured\\s+out)\\s+how\\s+to\\s+(act|do\\s+social)"],
        negationRequired: false,
        crossTags: ["MASKING"],
        auContext: false,
        note: "Critical masking marker - particularly relevant for late-identified, female/AFAB presentations"
      },

      // ============================================================
      // DEVELOPMENTAL HISTORY
      // ============================================================
      {
        label: "Didn't smile at us as a baby (reduced social smile)",
        weight: 1.7,
        source: "history",
        specificity: "very high",
        ageRange: { min: 2, max: 12, unit: "months", retrospective: true },
        keywords: ["didn't smile as a baby", "no social smile", "didn't smile at us"],
        regex: ["\\b(didn't|did\\s+not|never|no)\\s+(social\\s+)?smile\\s+(at\\s+(us|me)\\s+)?as\\s+a\\s+baby\\b", "\\bno\\s+social\\s+smile\\b"],
        negationRequired: true,
        crossTags: [],
        auContext: false,
        note: "Earliest developmental marker; reduced/absent social smile by 2-3 months"
      },
      {
        label: "Was 'too good' a baby — never demanded attention",
        weight: 1.5,
        source: "history",
        specificity: "very high",
        ageRange: { min: 0, max: 24, unit: "months", retrospective: true },
        keywords: ["was a good baby too good", "never demanded attention", "could be left alone for hours"],
        regex: ["\\b(was\\s+a\\s+(good|easy|too\\s+good)\\s+baby|never\\s+(demanded|required|cried\\s+for)\\s+attention|could\\s+be\\s+left\\s+(alone\\s+)?for\\s+hours)\\b"],
        negationRequired: false,
        crossTags: ["A1"],
        auContext: false,
        note: "Counterintuitive parent observation - frequently missed by clinicians not familiar with this presentation"
      },
      {
        label: "Didn't engage in early interactive routines (peekaboo, pat-a-cake, round-and-round-the-garden)",
        weight: 1.6,
        source: "history",
        specificity: "very high",
        ageRange: { min: 6, max: 18, unit: "months", retrospective: true },
        keywords: ["didn't do peekaboo", "no peekaboo", "didn't do pat-a-cake", "no round and round the garden"],
        regex: ["\\b(didn't|did\\s+not|never)\\s+(do|enjoy|engage\\s+in|play)\\s+(peek[-\\s]?a[-\\s]?boo|pat[-\\s]?a[-\\s]?cake|round\\s+and\\s+round\\s+the\\s+garden|this\\s+little\\s+piggy)"],
        negationRequired: true,
        crossTags: ["A1"],
        auContext: true,
        auContextNote: "Round and Round the Garden is a standard Australian/UK infant interactive routine"
      },
      {
        label: "First word was unusual / brand name / character name",
        weight: 1.5,
        source: "history",
        specificity: "very high",
        ageRange: { min: 9, max: 24, unit: "months", retrospective: true },
        keywords: ["first word was unusual", "first word was a brand", "first word was a character"],
        regex: ["\\bfirst\\s+word\\s+was\\s+(a\\s+)?(unusual|brand|character|TV\\s+character|YouTube)"],
        negationRequired: false,
        crossTags: ["B1", "B3"],
        auContext: false,
        note: "Common ASD pattern - first word is often a label/brand rather than relational (Mum/Dad)"
      }
    ]
  },
  {
    domain: "A3 Relationships and social context",
    code: "A3",
    criterion: "Deficits in developing, maintaining, and understanding relationships",
    criterionGroup: "A",
    dsmReference: "DSM-5-TR 299.00 Criterion A3",
    severityWeight: 1.2,
    detectionStrategy: "negation-dominant",
    markers: [
      // ============================================================
      // CLINICIAN — FRIENDSHIP DEVELOPMENT & MAINTENANCE
      // ============================================================
      {
        label: "Difficulty making friends",
        weight: 1.3,
        source: "clinician",
        specificity: "moderate",
        ageRange: { min: 36, max: 999, unit: "months" },
        keywords: ["difficulty making friends", "trouble making friends", "struggles to make friends", "can't make friends"],
        regex: ["\\b(difficulty|trouble|struggle\\w*|unable|can't|cannot|fails?\\s+to)\\s+(making|to\\s+make|in\\s+making)\\s+friends?\\b"],
        negationRequired: false,
        crossTags: [],
        auContext: false
      },
      {
        label: "Difficulty maintaining friendships",
        weight: 1.4,
        source: "clinician",
        specificity: "high",
        ageRange: { min: 60, max: 999, unit: "months" },
        keywords: ["difficulty maintaining friendships", "friendships don't last", "friendships fizzle", "loses friends"],
        regex: ["\\b(difficulty|trouble|unable)\\s+(maintaining|sustaining|keeping|holding\\s+onto)\\s+friendships?\\b", "\\bfriendships?\\s+(don't\\s+last|fizzle|fall\\s+apart|don't\\s+stick)"],
        negationRequired: false,
        crossTags: [],
        auContext: false
      },
      {
        label: "Difficulty understanding relationships",
        weight: 1.5,
        source: "clinician",
        specificity: "high",
        ageRange: { min: 60, max: 999, unit: "months" },
        keywords: ["difficulty understanding relationships", "doesn't understand social relationships", "confused about friendships"],
        regex: ["\\b(difficulty|trouble|impaired|reduced)\\s+understand\\w*\\s+relationships?\\b"],
        negationRequired: false,
        crossTags: [],
        auContext: false
      },
      {
        label: "Reduced or absent peer interest",
        weight: 1.6,
        source: "clinician",
        specificity: "very high",
        ageRange: { min: 18, max: 999, unit: "months" },
        keywords: ["reduced peer interest", "absent peer interest", "no interest in peers", "doesn't notice peers"],
        regex: ["\\b(reduced|absent|limited|no|lacking)\\s+(peer\\s+interest|interest\\s+in\\s+peers?)\\b"],
        negationRequired: false,
        crossTags: [],
        auContext: false,
        note: "Core ASD developmental marker - distinguishable from social anxiety"
      },
      {
        label: "Parallel play past developmental norm",
        weight: 1.5,
        source: "clinician",
        specificity: "high",
        ageRange: { min: 36, max: 999, unit: "months" },
        keywords: ["parallel play", "plays alongside not with", "plays next to", "plays in proximity but not with"],
        regex: ["\\bparallel\\s+play(s|ing)?\\s+(past|beyond|after)\\s+(developmental\\s+)?(norm|age|expected)", "\\bplay(s|ing|ed)?\\s+alongside\\s+(but\\s+)?not\\s+with"],
        negationRequired: false,
        crossTags: [],
        auContext: false
      },
      {
        label: "Solitary play preference",
        weight: 1.3,
        source: "clinician",
        specificity: "moderate",
        ageRange: { min: 36, max: 999, unit: "months" },
        keywords: ["solitary play", "plays alone", "prefers to play alone", "isolated play"],
        regex: ["\\b(solitary|isolated|alone|by\\s+(him|her|them)self)\\s+play(ing)?\\b", "\\bprefers?\\s+to\\s+play\\s+alone\\b"],
        negationRequired: false,
        crossTags: [],
        auContext: false,
        note: "Distinguish from temperamental introversion; weight only when persistent and pervasive"
      },
      {
        label: "Cannot adjust behaviour to social context",
        weight: 1.5,
        source: "clinician",
        specificity: "very high",
        ageRange: { min: 60, max: 999, unit: "months" },
        keywords: ["cannot adjust behaviour to context", "same behaviour all settings", "doesn't modify behaviour socially"],
        regex: ["\\b(cannot|can't|unable\\s+to|doesn't|does\\s+not)\\s+adjust\\s+behaviour\\s+to\\s+(social\\s+)?context", "\\bsame\\s+behaviour\\s+across\\s+all\\s+(contexts|settings|situations)"],
        negationRequired: false,
        crossTags: [],
        auContext: false
      },
      {
        label: "Wing's social subtype: aloof",
        weight: 1.5,
        source: "clinician",
        specificity: "very high",
        ageRange: { min: 36, max: 999, unit: "months" },
        keywords: ["aloof", "Wing aloof", "socially aloof", "in own world"],
        regex: ["\\b(socially\\s+)?aloof\\b", "\\bWing'?s?\\s+aloof\\b", "\\bin\\s+(his|her|their)\\s+own\\s+world\\b"],
        negationRequired: false,
        crossTags: ["A1"],
        auContext: false
      },
      {
        label: "Wing's social subtype: passive",
        weight: 1.4,
        source: "clinician",
        specificity: "high",
        ageRange: { min: 36, max: 999, unit: "months" },
        keywords: ["socially passive", "Wing passive", "passive social style"],
        regex: ["\\b(socially\\s+)?passive\\s+(social\\s+)?(style|presentation|subtype)?\\b", "\\bWing'?s?\\s+passive\\b"],
        negationRequired: false,
        crossTags: [],
        auContext: false
      },
      {
        label: "Wing's social subtype: active-but-odd",
        weight: 1.6,
        source: "clinician",
        specificity: "very high",
        ageRange: { min: 36, max: 999, unit: "months" },
        keywords: ["active but odd", "active-but-odd", "Wing active but odd"],
        regex: ["\\bactive[-\\s]?but[-\\s]?odd\\b", "\\bWing'?s?\\s+active[-\\s]?but[-\\s]?odd\\b"],
        negationRequired: false,
        crossTags: [],
        auContext: false,
        note: "Particularly relevant for late-identified or female/AFAB presentations"
      },
      {
        label: "Reduced or absent imaginative / pretend play",
        weight: 1.7,
        source: "clinician",
        specificity: "very high",
        ageRange: { min: 24, max: 72, unit: "months" },
        keywords: ["no imaginative play", "absent pretend play", "reduced symbolic play", "no make-believe"],
        regex: ["\\b(reduced|absent|limited|no|lacking)\\s+(imaginative|pretend|symbolic|make[-\\s]?believe|fantasy)\\s+play\\b"],
        negationRequired: false,
        crossTags: ["B1"],
        auContext: false,
        note: "Critical developmental marker - one of strongest early ASD indicators"
      },
      {
        label: "Cannot share imaginative play with peers",
        weight: 1.6,
        source: "clinician",
        specificity: "very high",
        ageRange: { min: 36, max: 999, unit: "months" },
        keywords: ["can't share imaginative play", "won't share pretend", "cannot do shared pretend"],
        regex: ["\\b(cannot|can't|unable|won't)\\s+share\\s+(imaginative|pretend|symbolic)\\s+play\\b"],
        negationRequired: false,
        crossTags: [],
        auContext: false
      },
      {
        label: "Rigid play with peers — cannot tolerate variation",
        weight: 1.6,
        source: "clinician",
        specificity: "very high",
        ageRange: { min: 36, max: 999, unit: "months" },
        keywords: ["rigid play", "cannot tolerate peer changing play", "must direct play", "cannot follow peer's lead"],
        regex: ["\\brigid\\s+play\\b", "\\b(cannot|can't|won't)\\s+(tolerate|accept|allow)\\s+(peer\\s+)?(changing|varying|leading)\\s+(the\\s+)?play\\b"],
        negationRequired: false,
        crossTags: ["B2"],
        auContext: false
      },
      {
        label: "Reduced cooperative / reciprocal play",
        weight: 1.5,
        source: "clinician",
        specificity: "high",
        ageRange: { min: 36, max: 999, unit: "months" },
        keywords: ["reduced cooperative play", "no reciprocal play", "limited cooperative play"],
        regex: ["\\b(reduced|limited|absent|no)\\s+(cooperative|reciprocal|collaborative)\\s+play\\b"],
        negationRequired: false,
        crossTags: [],
        auContext: false
      },
      {
        label: "One-sided friendships — reduced reciprocity",
        weight: 1.5,
        source: "clinician",
        specificity: "high",
        ageRange: { min: 60, max: 999, unit: "months" },
        keywords: ["one-sided friendships", "friendships not reciprocated", "non-reciprocal friendships"],
        regex: ["\\bone[-\\s]?sided\\s+friendships?\\b", "\\b(non[-\\s]?reciprocal|unreciprocated)\\s+friendships?\\b"],
        negationRequired: false,
        crossTags: [],
        auContext: false
      },
      {
        label: "Befriends much younger or older children only",
        weight: 1.6,
        source: "clinician",
        specificity: "very high",
        ageRange: { min: 60, max: 999, unit: "months" },
        keywords: ["befriends younger children", "only friends with older kids", "age-discrepant friendships"],
        regex: ["\\b(befriends?|friends?\\s+(with|are)|prefers?)\\s+(much\\s+)?(younger|older)\\s+(children|kids)\\s+only\\b", "\\bage[-\\s]?discrepant\\s+friendships?\\b"],
        negationRequired: false,
        crossTags: [],
        auContext: false,
        note: "Highly specific marker - typical peer interest but mismatched developmental level"
      },
      {
        label: "Adults preferred over peers",
        weight: 1.5,
        source: "clinician",
        specificity: "very high",
        ageRange: { min: 60, max: 999, unit: "months" },
        keywords: ["prefers adults to peers", "adults over kids", "talks to adults like equals"],
        regex: ["\\b(adults?\\s+preferred\\s+over\\s+peers?|prefers?\\s+adults?\\s+(to|over)\\s+peers?|talks?\\s+to\\s+adults?\\s+like\\s+(equals|peers))\\b"],
        negationRequired: false,
        crossTags: [],
        auContext: false
      },
      {
        label: "Reduced understanding of social hierarchy",
        weight: 1.5,
        source: "clinician",
        specificity: "high",
        ageRange: { min: 72, max: 999, unit: "months" },
        keywords: ["doesn't understand social hierarchy", "treats teacher as peer", "no respect for authority hierarchy"],
        regex: ["\\b(reduced|limited|no|doesn't\\s+understand)\\s+(social\\s+)?hierarchy\\b", "\\btreats?\\s+teacher\\s+as\\s+(a\\s+)?peer\\b"],
        negationRequired: false,
        crossTags: [],
        auContext: false
      },
      {
        label: "Misreads social cues / theory of mind deficits",
        weight: 1.5,
        source: "clinician",
        specificity: "high",
        ageRange: { min: 60, max: 999, unit: "months" },
        keywords: ["misreads social cues", "ToM deficits", "doesn't infer intentions", "misses social cues"],
        regex: ["\\bmisreads?\\s+(social\\s+)?cues\\b", "\\b(theory\\s+of\\s+mind|ToM)\\s+deficits?\\b", "\\b(doesn't|does\\s+not|cannot)\\s+infer\\s+(others'?\\s+)?(intentions?|thoughts?|feelings?)"],
        negationRequired: false,
        crossTags: ["A1"],
        auContext: false
      },
      {
        label: "Vulnerability to bullying",
        weight: 1.4,
        source: "clinician",
        specificity: "high",
        ageRange: { min: 60, max: 999, unit: "months" },
        keywords: ["vulnerable to bullying", "history of bullying", "easily bullied", "target of bullying"],
        regex: ["\\b(vulnerab\\w+|target|history)\\s+(to|of|for)\\s+bull(y|ying|ied)\\b", "\\beasily\\s+bullied\\b"],
        negationRequired: false,
        crossTags: [],
        auContext: false
      },
      {
        label: "Vulnerability to exploitation / overly trusting",
        weight: 1.6,
        source: "clinician",
        specificity: "very high",
        ageRange: { min: 60, max: 999, unit: "months" },
        keywords: ["vulnerable to exploitation", "overly trusting", "naive", "no stranger awareness"],
        regex: ["\\b(vulnerab\\w+|prone)\\s+to\\s+exploitation\\b", "\\b(overly\\s+trusting|naïve|naive)\\b", "\\b(reduced|no|absent)\\s+stranger\\s+awareness\\b"],
        negationRequired: false,
        crossTags: ["SAFETY"],
        auContext: false
      },
      {
        label: "Reduced understanding of social rules / group dynamics",
        weight: 1.4,
        source: "clinician",
        specificity: "high",
        ageRange: { min: 60, max: 999, unit: "months" },
        keywords: ["doesn't understand social rules", "no understanding of group dynamics", "misses group dynamics"],
        regex: ["\\b(reduced|limited|poor|no)\\s+understanding\\s+of\\s+(social\\s+rules?|group\\s+dynamics?)"],
        negationRequired: false,
        crossTags: [],
        auContext: false
      },
      {
        label: "Inappropriate or awkward social approaches",
        weight: 1.4,
        source: "clinician",
        specificity: "high",
        ageRange: { min: 36, max: 999, unit: "months" },
        keywords: ["inappropriate social approaches", "awkward approaches", "socially intrusive"],
        regex: ["\\b(inappropriate|awkward|odd|unusual|intrusive)\\s+social\\s+(approaches?|overtures?|advances?)"],
        negationRequired: false,
        crossTags: [],
        auContext: false
      },

      // ============================================================
      // PARENT / TEACHER — FRIENDSHIP ABSENCE
      // ============================================================
      {
        label: "No real friends",
        weight: 1.5,
        source: "parent",
        specificity: "high",
        ageRange: { min: 60, max: 999, unit: "months" },
        keywords: ["no real friends", "no friends", "doesn't have friends", "hasn't got friends"],
        regex: ["\\b(no|doesn't\\s+have|hasn't\\s+got|hasn't\\s+had)\\s+(any\\s+)?(real\\s+)?friends?\\b"],
        negationRequired: true,
        crossTags: [],
        auContext: false
      },
      {
        label: "Plays alone at lunch / sits by herself",
        weight: 1.5,
        source: "parent",
        specificity: "high",
        ageRange: { min: 60, max: 999, unit: "months" },
        keywords: ["plays alone at lunch", "sits alone at lunch", "alone at recess", "by herself at break"],
        regex: ["\\b(plays?|sits?|eats?)\\s+alone\\s+(at\\s+)?(lunch|recess|break|playtime)\\b", "\\bby\\s+(her|him|them)self\\s+at\\s+(lunch|recess|break)"],
        negationRequired: false,
        crossTags: [],
        auContext: true,
        auContextNote: "Recess/lunch are key Australian school social periods"
      },
      {
        label: "Hides in the library at break",
        weight: 1.6,
        source: "parent",
        specificity: "very high",
        ageRange: { min: 72, max: 999, unit: "months" },
        keywords: ["hides in the library", "goes to library at lunch", "library at recess", "library at break"],
        regex: ["\\b(hides?|goes?|stays?)\\s+(in\\s+)?(the\\s+)?library\\s+(at\\s+)?(lunch|recess|break|playtime)\\b"],
        negationRequired: false,
        crossTags: [],
        auContext: true,
        auContextNote: "Australian school context - library as social refuge"
      },
      {
        label: "Plays with the teachers / lunchtime supervisors instead of peers",
        weight: 1.6,
        source: "parent",
        specificity: "very high",
        ageRange: { min: 60, max: 999, unit: "months" },
        keywords: ["plays with teachers", "with lunchtime supervisor", "with the teacher's aide", "with the EA"],
        regex: ["\\bplays?\\s+with\\s+(the\\s+)?(teachers?|lunchtime\\s+supervisors?|teacher'?s?\\s+aides?|EAs?|education\\s+assistants?|duty\\s+teachers?)\\b"],
        negationRequired: false,
        crossTags: [],
        auContext: true,
        auContextNote: "EA = Education Assistant (Australian schooling term)"
      },
      {
        label: "Plays with much younger or older children",
        weight: 1.6,
        source: "parent",
        specificity: "very high",
        ageRange: { min: 60, max: 999, unit: "months" },
        keywords: ["plays with younger kids", "plays with sister's friends", "plays with the little ones", "plays with older kids"],
        regex: ["\\bplays?\\s+with\\s+(the\\s+)?(younger\\s+(kids?|children)|little\\s+ones?|(his|her)\\s+sister'?s?\\s+friends?|(his|her)\\s+brother'?s?\\s+friends?|older\\s+(kids?|children))\\b"],
        negationRequired: false,
        crossTags: [],
        auContext: false
      },
      {
        label: "Better with adults than peers",
        weight: 1.5,
        source: "parent",
        specificity: "high",
        ageRange: { min: 60, max: 999, unit: "months" },
        keywords: ["better with adults", "more comfortable with adults", "adults are easier"],
        regex: ["\\b(better|more\\s+comfortable|easier|prefers)\\s+with\\s+adults?\\s+(than\\s+)?(peers?|kids?|children)?"],
        negationRequired: false,
        crossTags: [],
        auContext: false
      },
      {
        label: "Talks to adults like they're equals",
        weight: 1.5,
        source: "parent",
        specificity: "very high",
        ageRange: { min: 60, max: 999, unit: "months" },
        keywords: ["talks to adults like equals", "treats adults as peers", "no boundary with adults"],
        regex: ["\\btalks?\\s+to\\s+adults?\\s+like\\s+(they're\\s+)?(equals?|peers?)", "\\btreats?\\s+adults?\\s+(as|like)\\s+peers?"],
        negationRequired: false,
        crossTags: [],
        auContext: false
      },
      {
        label: "Doesn't have a best friend",
        weight: 1.4,
        source: "parent",
        specificity: "high",
        ageRange: { min: 72, max: 999, unit: "months" },
        keywords: ["doesn't have a best friend", "no best friend", "can't name a best friend"],
        regex: ["\\b(doesn't|does\\s+not|hasn't\\s+got|doesn't\\s+really\\s+have)\\s+(a\\s+)?best\\s+friends?\\b"],
        negationRequired: true,
        crossTags: [],
        auContext: false
      },
      {
        label: "Names friends but they don't know him / don't reciprocate",
        weight: 1.6,
        source: "parent",
        specificity: "very high",
        ageRange: { min: 72, max: 999, unit: "months" },
        keywords: ["says he has friends but they don't", "names kids as friends but kids don't know", "friends don't reciprocate"],
        regex: ["\\b(says|claims)\\s+(he|she|they)\\s+(has|have)\\s+friends\\s+but\\s+(the\\s+)?(kids?|they)\\s+don't\\b", "\\bnames?\\s+kids?\\s+as\\s+friends?\\s+but\\b"],
        negationRequired: false,
        crossTags: [],
        auContext: false,
        note: "Distinctive parent observation - reduced reciprocity in named friendships"
      },
      {
        label: "Gets invited once and never again",
        weight: 1.5,
        source: "parent",
        specificity: "very high",
        ageRange: { min: 60, max: 999, unit: "months" },
        keywords: ["invited once and never again", "one playdate only", "doesn't get invited back"],
        regex: ["\\b(invited\\s+)?once\\s+(and\\s+)?never\\s+again\\b", "\\b(doesn't|does\\s+not)\\s+get\\s+invited\\s+back\\b", "\\bone\\s+(playdate|invitation)\\s+only\\b"],
        negationRequired: false,
        crossTags: [],
        auContext: false
      },
      {
        label: "Friendships fizzle out",
        weight: 1.5,
        source: "parent",
        specificity: "high",
        ageRange: { min: 72, max: 999, unit: "months" },
        keywords: [
          "friendships fizzle",
          "friendships fade",
          "friendships fall apart",
          "wants to make friends",
          "struggles to maintain friendships",
        ],
        regex: [
          "\\bfriendships?\\s+(fizzle|fade|fall\\s+apart|don't\\s+last|peter\\s+out)\\b",
          "\\bwants?\\s+to\\s+make\\s+friends\\s+but\\b",
        ],
        negationRequired: false,
        crossTags: [],
        auContext: false
      },
      {
        label: "Wants friendships but struggles to maintain them",
        weight: 1.6,
        source: "parent",
        specificity: "very high",
        ageRange: { min: 60, max: 999, unit: "months" },
        keywords: [
          "wants friendships",
          "wants to make friends",
          "struggles to maintain friendships",
          "friendships don't last",
          "wants friends but",
          "tries to make friends but",
        ],
        regex: [
          "\\bwants?\\s+friendships?\\s+but\\b",
          "\\bstruggles?\\s+to\\s+maintain\\s+friendships?",
          "\\bfriendships?\\s+don't\\s+last\\b",
        ],
        negationRequired: false,
        crossTags: [],
        auContext: false
      },
      {
        label: "Controls games / distressed when peers don't follow rules",
        weight: 1.5,
        source: "teacher",
        specificity: "very high",
        ageRange: { min: 48, max: 999, unit: "months" },
        keywords: [
          "controls games",
          "control games",
          "distressed if peers",
          "if peers do not follow",
          "preferred rules or sequence",
          "rigid play with peers",
        ],
        regex: [
          "\\b(controls?|control|controlling)\\s+(the\\s+)?games?\\b",
          "\\bdistressed?\\s+(when|if)\\s+peers?\\s+(do\\s+not|don't)\\s+(follow|comply)",
          "\\bpreferred\\s+rules?\\s+or\\s+sequence",
        ],
        negationRequired: false,
        crossTags: ["B2"],
        auContext: false
      },
      {
        label: "Gravitates to adults / wanders playground alone",
        weight: 1.6,
        source: "teacher",
        specificity: "very high",
        ageRange: { min: 60, max: 999, unit: "months" },
        keywords: [
          "gravitating toward adults",
          "gravitates to adults",
          "with adults during break",
          "wandering around the playground",
          "alone in the playground",
          "alone at break",
        ],
        regex: [
          "\\bgravitat(ing|es?)\\s+toward(s)?\\s+adults?\\b",
          "\\bwander(ing|s|ed)\\s+(around\\s+)?(the\\s+)?playground\\s+alone\\b",
          "\\b(alone|by\\s+(him|her|them)self)\\s+(in\\s+)?(the\\s+)?(playground|break\\s+time|recess)",
        ],
        negationRequired: false,
        crossTags: [],
        auContext: true
      },
      {
        label: "Other kids tolerate him / find him weird",
        weight: 1.5,
        source: "parent",
        specificity: "high",
        ageRange: { min: 72, max: 999, unit: "months" },
        keywords: ["other kids tolerate him", "find her weird", "other kids think he's odd", "kids find him annoying"],
        regex: ["\\bother\\s+kids?\\s+(tolerate|find\\s+(him|her|them)\\s+(weird|odd|strange|annoying|too\\s+much))"],
        negationRequired: false,
        crossTags: [],
        auContext: false
      },
      {
        label: "Has to be in charge of every game / has to win",
        weight: 1.5,
        source: "parent",
        specificity: "high",
        ageRange: { min: 48, max: 999, unit: "months" },
        keywords: ["has to be in charge", "has to win", "must direct the game", "controls all play"],
        regex: ["\\b(has\\s+to|must)\\s+be\\s+in\\s+charge\\b", "\\bhas\\s+to\\s+win\\b", "\\b(must|has\\s+to)\\s+(direct|control)\\s+(the\\s+)?(game|play)"],
        negationRequired: false,
        crossTags: ["B2"],
        auContext: false
      },
      {
        label: "Flips the board / leaves the game when losing",
        weight: 1.4,
        source: "parent",
        specificity: "high",
        ageRange: { min: 48, max: 999, unit: "months" },
        keywords: ["flips the board", "leaves the game", "tantrum when losing", "can't lose"],
        regex: ["\\b(flips?\\s+the\\s+board|leaves?\\s+the\\s+game|can't\\s+lose|melts?\\s+down\\s+when\\s+losing|tantrums?\\s+when\\s+losing)\\b"],
        negationRequired: false,
        crossTags: ["B2"],
        auContext: false
      },
      {
        label: "Won't share / won't take turns",
        weight: 1.3,
        source: "parent",
        specificity: "moderate",
        ageRange: { min: 36, max: 999, unit: "months" },
        keywords: ["won't share", "won't take turns", "doesn't share", "no turn-taking"],
        regex: ["\\b(won't|doesn't|does\\s+not|refuses?\\s+to)\\s+(share|take\\s+turns)\\b"],
        negationRequired: false,
        crossTags: [],
        auContext: false
      },
      {
        label: "Doesn't get the rules of games",
        weight: 1.4,
        source: "parent",
        specificity: "high",
        ageRange: { min: 60, max: 999, unit: "months" },
        keywords: ["doesn't get rules of games", "doesn't understand game rules", "plays his own way"],
        regex: ["\\b(doesn't|does\\s+not|can't|cannot)\\s+get\\s+the\\s+rules?\\s+of\\s+(games?|playing)", "\\bplays?\\s+(games?\\s+)?(his|her|their)\\s+own\\s+way\\b"],
        negationRequired: false,
        crossTags: [],
        auContext: false
      },
      {
        label: "Has a script and won't deviate / wants same game over and over",
        weight: 1.6,
        source: "parent",
        specificity: "very high",
        ageRange: { min: 36, max: 999, unit: "months" },
        keywords: ["has a script", "won't deviate from script", "same game over and over", "scripted play"],
        regex: ["\\b(has\\s+a\\s+script|won't\\s+deviate|same\\s+game\\s+(over\\s+and\\s+over|repeatedly))\\b", "\\bscripted\\s+play\\b"],
        negationRequired: false,
        crossTags: ["B1", "B2"],
        auContext: false
      },
      {
        label: "Re-enacts scenes from shows / movies line by line",
        weight: 1.6,
        source: "parent",
        specificity: "very high",
        ageRange: { min: 36, max: 999, unit: "months" },
        keywords: ["re-enacts scenes", "plays out movie scenes", "plays Star Wars / Pokémon scenes", "scenes line by line"],
        regex: ["\\b(re[-\\s]?enacts?|plays?\\s+out|recreates?)\\s+(scenes?\\s+)?(from\\s+)?(the\\s+)?(show|movie|TV|YouTube|Star\\s+Wars|Pokémon|Bluey|Frozen|Marvel)", "\\b(scenes?\\s+)?line\\s+by\\s+line\\b"],
        negationRequired: false,
        crossTags: ["B1", "B3"],
        auContext: false
      },
      {
        label: "Doesn't do imaginary / pretend play (parent phrasing)",
        weight: 1.7,
        source: "parent",
        specificity: "very high",
        ageRange: { min: 24, max: 72, unit: "months" },
        keywords: ["doesn't pretend", "doesn't play house", "doesn't play shops", "doesn't play doctors", "no make-believe"],
        regex: ["\\b(doesn't|does\\s+not|never)\\s+(pretend|play\\s+(house|shops?|doctors?|cooking|tea\\s+parties?|dress[-\\s]?ups?|make[-\\s]?believe))"],
        negationRequired: true,
        crossTags: ["B1"],
        auContext: false,
        note: "Critical developmental marker - one of strongest early indicators when persistent past 36 months"
      },
      {
        label: "Lines up toys instead of playing with them",
        weight: 1.7,
        source: "parent",
        specificity: "very high",
        ageRange: { min: 18, max: 999, unit: "months" },
        keywords: ["lines up toys", "sorts toys instead of playing", "arranges toys", "lines up cars"],
        regex: ["\\b(lines?\\s+up|sorts?|arranges?|orders?)\\s+(the\\s+)?toys?\\s+(instead\\s+of\\s+playing|rather\\s+than\\s+playing)?", "\\blines?\\s+up\\s+(cars?|trains?|figures?|animals?|blocks?|shoes?)"],
        negationRequired: false,
        crossTags: ["B1"],
        auContext: false,
        note: "Pathognomonic when persistent and dominates play repertoire"
      },
      {
        label: "Sorts toys by colour / size / type instead of pretend play",
        weight: 1.6,
        source: "parent",
        specificity: "very high",
        ageRange: { min: 24, max: 999, unit: "months" },
        keywords: ["sorts by colour", "sorts by size", "categorises toys", "sorts not pretend"],
        regex: ["\\bsorts?\\s+(toys?\\s+)?by\\s+(colou?r|size|type|shape|category)\\b", "\\bcategoris(es|ing)\\s+toys?\\b"],
        negationRequired: false,
        crossTags: ["B1"],
        auContext: false
      },
      {
        label: "Bullied / picked on / left out at school",
        weight: 1.4,
        source: "parent",
        specificity: "high",
        ageRange: { min: 60, max: 999, unit: "months" },
        keywords: ["bullied", "picked on", "left out", "comes home crying"],
        regex: ["\\b(bullied|picked\\s+on|teased|left\\s+out|excluded|ostracised|targeted)\\b", "\\bcomes?\\s+home\\s+crying\\s+(every\\s+day|most\\s+days|all\\s+the\\s+time)"],
        negationRequired: false,
        crossTags: [],
        auContext: false
      },
      {
        label: "Says 'no one likes me' / nobody plays with me",
        weight: 1.5,
        source: "parent",
        specificity: "high",
        ageRange: { min: 60, max: 999, unit: "months" },
        keywords: ["nobody likes me", "no one likes me", "nobody plays with me"],
        regex: ["\\b(no\\s+one|nobody|no-one)\\s+(likes?|plays?\\s+with|wants?\\s+to\\s+play\\s+with)\\s+me\\b"],
        negationRequired: false,
        crossTags: [],
        auContext: false
      },
      {
        label: "Trusts everyone / would go off with anyone",
        weight: 1.7,
        source: "parent",
        specificity: "very high",
        ageRange: { min: 36, max: 999, unit: "months" },
        keywords: ["trusts everyone", "would go with anyone", "no stranger danger", "tells strangers everything"],
        regex: ["\\b(trusts?\\s+everyone|would\\s+go\\s+(off\\s+)?with\\s+anyone|no\\s+stranger\\s+danger|tells?\\s+strangers?)\\b"],
        negationRequired: false,
        crossTags: ["SAFETY"],
        auContext: false,
        note: "High-priority safety marker; auto-elevates risk planning"
      },
      {
        label: "Walks up to / hugs / approaches strangers",
        weight: 1.6,
        source: "parent",
        specificity: "very high",
        ageRange: { min: 24, max: 999, unit: "months" },
        keywords: ["walks up to strangers", "hugs strangers", "approaches random people", "talks to anyone"],
        regex: ["\\b(walks?\\s+up\\s+to|hugs?|approaches?|talks?\\s+to)\\s+(random\\s+)?strangers?\\b", "\\b(walks?\\s+up\\s+to|hugs?|approaches?)\\s+random\\s+people\\b"],
        negationRequired: false,
        crossTags: ["SAFETY"],
        auContext: false
      },
      {
        label: "Got in a stranger's car / went off with stranger",
        weight: 1.8,
        source: "parent",
        specificity: "very high",
        ageRange: { min: 24, max: 999, unit: "months" },
        keywords: ["got in stranger's car", "went off with stranger", "lost in shops"],
        regex: ["\\b(got\\s+in|got\\s+into|climbed\\s+in)\\s+(a\\s+)?stranger'?s?\\s+(car|vehicle)\\b", "\\bwent\\s+off\\s+with\\s+(a\\s+)?stranger\\b"],
        negationRequired: false,
        crossTags: ["SAFETY"],
        auContext: false,
        note: "Critical safety event - auto-elevates support needs"
      },
      {
        label: "Bossy with peers / tells other kids what to do",
        weight: 1.4,
        source: "parent",
        specificity: "high",
        ageRange: { min: 48, max: 999, unit: "months" },
        keywords: ["bossy with peers", "tells other kids what to do", "directs other kids"],
        regex: ["\\b(bossy|directive|controlling)\\s+with\\s+(peers?|other\\s+kids?|children)\\b", "\\btells?\\s+other\\s+kids?\\s+what\\s+to\\s+do\\b"],
        negationRequired: false,
        crossTags: ["B2"],
        auContext: false
      },
      {
        label: "Calls teachers by their first name / argues with teachers as peers",
        weight: 1.5,
        source: "parent",
        specificity: "high",
        ageRange: { min: 60, max: 999, unit: "months" },
        keywords: ["calls teachers first name", "argues with teachers", "no respect for teacher authority"],
        regex: ["\\bcalls?\\s+teachers?\\s+by\\s+(their\\s+)?first\\s+names?\\b", "\\bargues?\\s+with\\s+teachers?\\s+(like|as)\\s+(if\\s+they're\\s+)?(peers?|equals?)"],
        negationRequired: false,
        crossTags: [],
        auContext: false
      },
      {
        label: "Stands too close / touches kids without permission / hugs kids who don't want to be hugged",
        weight: 1.5,
        source: "parent",
        specificity: "high",
        ageRange: { min: 36, max: 999, unit: "months" },
        keywords: ["stands too close to kids", "touches kids without permission", "hugs kids who don't want hugs"],
        regex: ["\\bstands?\\s+too\\s+close\\s+to\\s+(other\\s+)?(kids?|children)\\b", "\\btouches?\\s+(other\\s+)?kids?\\s+without\\s+permission\\b", "\\bhugs?\\s+kids?\\s+who\\s+don't\\s+want\\s+(to\\s+be\\s+)?hugged?\\b"],
        negationRequired: false,
        crossTags: [],
        auContext: false
      },
      {
        label: "Other parents have complained / school has had to talk to me about peer behaviour",
        weight: 1.5,
        source: "parent",
        specificity: "high",
        ageRange: { min: 48, max: 999, unit: "months" },
        keywords: ["other parents complained", "school had to talk to me", "complaints from other parents"],
        regex: ["\\bother\\s+parents?\\s+(have\\s+)?(complained|spoken\\s+to\\s+me|raised\\s+concerns?)", "\\bschool\\s+(has\\s+)?(had\\s+to\\s+)?talk(ed)?\\s+to\\s+me\\s+about\\b"],
        negationRequired: false,
        crossTags: [],
        auContext: false
      },

      // ============================================================
      // PARENT — INVITATION & SOCIAL EVENT ABSENCE
      // ============================================================
      {
        label: "We don't get invited to parties / playdates anymore",
        weight: 1.6,
        source: "parent",
        specificity: "very high",
        ageRange: { min: 60, max: 999, unit: "months" },
        keywords: ["don't get invited to parties", "no party invitations", "no playdates", "stopped being invited"],
        regex: ["\\b(don't|do\\s+not|no\\s+longer|stopped)\\s+(get\\s+)?invited\\s+to\\s+(parties|playdates?|things?)\\b", "\\bno\\s+(party\\s+)?invitations?\\b"],
        negationRequired: false,
        crossTags: [],
        auContext: false
      },
      {
        label: "Has never had a sleepover / playdate",
        weight: 1.6,
        source: "parent",
        specificity: "very high",
        ageRange: { min: 72, max: 999, unit: "months" },
        keywords: ["never had a sleepover", "never had a playdate", "no sleepovers"],
        regex: ["\\b(has\\s+)?never\\s+(had|been\\s+to|done)\\s+(a\\s+)?(sleepover|playdate)s?\\b"],
        negationRequired: false,
        crossTags: [],
        auContext: false
      },
      {
        label: "Last birthday party was years ago / we don't host parties anymore",
        weight: 1.5,
        source: "parent",
        specificity: "high",
        ageRange: { min: 72, max: 999, unit: "months" },
        keywords: ["last birthday party years ago", "don't host parties", "stopped having parties"],
        regex: ["\\blast\\s+(birthday\\s+)?party\\s+was\\s+(years?|ages?)\\s+ago\\b", "\\b(don't|do\\s+not|no\\s+longer|stopped)\\s+(host|having)\\s+(birthday\\s+)?parties\\b"],
        negationRequired: false,
        crossTags: [],
        auContext: false
      },

      // ============================================================
      // CHILD SELF-REPORT
      // ============================================================
      {
        label: "I don't have any friends",
        weight: 1.5,
        source: "child",
        specificity: "high",
        ageRange: { min: 60, max: 999, unit: "months" },
        keywords: ["don't have friends", "have no friends", "no friends"],
        regex: ["\\bI\\s+(don't|do\\s+not)\\s+have\\s+(any\\s+)?friends?\\b", "\\bI\\s+have\\s+no\\s+friends?\\b"],
        negationRequired: false,
        crossTags: [],
        auContext: false
      },
      {
        label: "Nobody likes me / I don't fit in",
        weight: 1.5,
        source: "child",
        specificity: "high",
        ageRange: { min: 72, max: 999, unit: "months" },
        keywords: ["nobody likes me", "I don't fit in", "I'm always alone", "I'm different"],
        regex: ["\\bnobody\\s+likes\\s+me\\b", "\\bI\\s+don't\\s+fit\\s+in\\b", "\\bI'm\\s+(always\\s+)?(on\\s+my\\s+own|alone)\\b"],
        negationRequired: false,
        crossTags: [],
        auContext: false
      },
      {
        label: "I'd rather play by myself / friends are too much work",
        weight: 1.4,
        source: "child",
        specificity: "high",
        ageRange: { min: 84, max: 999, unit: "months" },
        keywords: ["rather play by myself", "friends are too much work", "easier alone"],
        regex: ["\\bI'd\\s+rather\\s+play\\s+by\\s+myself\\b", "\\bfriends?\\s+are\\s+too\\s+much\\s+work\\b", "\\beasier\\s+(on\\s+my\\s+own|alone)\\b"],
        negationRequired: false,
        crossTags: [],
        auContext: false
      },
      {
        label: "Other kids are mean / I don't get them",
        weight: 1.4,
        source: "child",
        specificity: "high",
        ageRange: { min: 84, max: 999, unit: "months" },
        keywords: ["other kids are mean", "I don't get them", "kids are confusing"],
        regex: ["\\bother\\s+kids?\\s+are\\s+(mean|annoying|loud|too\\s+much|boring|weird)\\b", "\\bI\\s+don't\\s+get\\s+(them|kids|other\\s+kids?)\\b"],
        negationRequired: false,
        crossTags: [],
        auContext: false
      },
      {
        label: "I prefer animals to people / I prefer my dog",
        weight: 1.5,
        source: "child",
        specificity: "very high",
        ageRange: { min: 84, max: 999, unit: "months" },
        keywords: ["prefer animals to people", "prefer my dog", "animals over people", "easier with animals"],
        regex: ["\\b(prefer|like)\\s+animals?\\s+(to|over|more\\s+than)\\s+people\\b", "\\b(prefer|like)\\s+my\\s+(dog|cat|pet)\\b"],
        negationRequired: false,
        crossTags: [],
        auContext: false,
        note: "Distinctive autistic phenomenology"
      },
      {
        label: "Recess is the worst part of the day",
        weight: 1.6,
        source: "child",
        specificity: "very high",
        ageRange: { min: 72, max: 999, unit: "months" },
        keywords: ["recess is the worst", "lunchtime is the worst", "hate recess", "hate playtime"],
        regex: ["\\b(recess|lunch|lunchtime|playtime|break)\\s+is\\s+the\\s+worst\\b", "\\b(hate|dread)\\s+(recess|lunchtime|playtime|break)"],
        negationRequired: false,
        crossTags: [],
        auContext: true,
        auContextNote: "Australian school terminology — recess and lunch as distinct social periods"
      },
      {
        label: "I had a friend but she stopped talking to me",
        weight: 1.5,
        source: "child",
        specificity: "high",
        ageRange: { min: 84, max: 999, unit: "months" },
        keywords: ["she stopped talking to me", "friend ghosted me", "lost my friend"],
        regex: ["\\b(she|he|they)\\s+stopped\\s+talking\\s+to\\s+me\\b", "\\b(friend\\s+)?ghosted\\s+me\\b", "\\blost\\s+my\\s+(only\\s+)?friend\\b"],
        negationRequired: false,
        crossTags: [],
        auContext: false
      },

      // ============================================================
      // REAL-TIME CLINIC OBSERVATIONS
      // ============================================================
      {
        label: "Did not engage with examiner playfully / did not initiate play",
        weight: 1.5,
        source: "observation",
        specificity: "high",
        ageRange: { min: 24, max: 999, unit: "months" },
        keywords: ["didn't engage playfully", "didn't initiate play", "no playful engagement"],
        regex: ["\\b(did\\s+not|didn't)\\s+(engage|initiate)\\s+(playfully|with\\s+examiner|in\\s+play)\\b"],
        negationRequired: true,
        crossTags: [],
        auContext: false
      },
      {
        label: "Did not include examiner in play",
        weight: 1.5,
        source: "observation",
        specificity: "very high",
        ageRange: { min: 24, max: 999, unit: "months" },
        keywords: ["didn't include examiner", "played alongside examiner without acknowledgement", "didn't invite examiner"],
        regex: ["\\b(did\\s+not|didn't)\\s+include\\s+examiner\\s+in\\s+play\\b", "\\bplayed?\\s+alongside\\s+examiner\\s+without\\s+acknowledgement\\b"],
        negationRequired: true,
        crossTags: ["A1"],
        auContext: false
      },
      {
        label: "Play was rigid / scripted / repetitive",
        weight: 1.5,
        source: "observation",
        specificity: "very high",
        ageRange: { min: 24, max: 999, unit: "months" },
        keywords: ["rigid play", "scripted play", "repetitive play"],
        regex: ["\\bplay\\s+was\\s+(rigid|scripted|repetitive|stereotyped|inflexible)\\b"],
        negationRequired: false,
        crossTags: ["B1", "B2"],
        auContext: false
      },
      {
        label: "Did not pretend / no symbolic play during assessment",
        weight: 1.7,
        source: "observation",
        specificity: "very high",
        ageRange: { min: 18, max: 72, unit: "months" },
        keywords: ["no symbolic play observed", "didn't pretend", "no functional play"],
        regex: ["\\b(no|absent|did\\s+not|didn't)\\s+(symbolic|pretend|imaginative|functional)\\s+play\\s+(observed|present|elicited)?"],
        negationRequired: false,
        crossTags: ["B1"],
        auContext: false,
        note: "Standard ADOS-2 / MIGDAS observation"
      },
      {
        label: "Lined up / sorted toys rather than functional play",
        weight: 1.6,
        source: "observation",
        specificity: "very high",
        ageRange: { min: 18, max: 999, unit: "months" },
        keywords: ["lined up assessment toys", "sorted blocks instead", "lined up materials"],
        regex: ["\\b(lined?\\s+up|sorted)\\s+(assessment\\s+)?(toys|materials|blocks?|items)\\s+(rather\\s+than|instead\\s+of)\\s+(functional|symbolic|pretend)\\s+play"],
        negationRequired: false,
        crossTags: ["B1"],
        auContext: false
      },
      {
        label: "Insisted on directing play / could not tolerate variation",
        weight: 1.5,
        source: "observation",
        specificity: "high",
        ageRange: { min: 36, max: 999, unit: "months" },
        keywords: ["insisted on directing play", "could not tolerate variation", "would not let examiner lead"],
        regex: ["\\binsisted?\\s+on\\s+(directing|controlling|leading)\\s+(the\\s+)?play\\b", "\\b(could\\s+not|cannot|would\\s+not)\\s+tolerate\\s+(variation|change|peer\\s+leading)"],
        negationRequired: false,
        crossTags: ["B2"],
        auContext: false
      },
      {
        label: "Did not bring objects to share / no give-and-show during assessment",
        weight: 1.5,
        source: "observation",
        specificity: "very high",
        ageRange: { min: 12, max: 60, unit: "months" },
        keywords: ["didn't bring objects to share", "no give and show", "didn't show toys to examiner"],
        regex: ["\\b(did\\s+not|didn't)\\s+(bring|show)\\s+(objects?|toys?)\\s+to\\s+(share|examiner)", "\\bno\\s+give[-\\s]?and[-\\s]?show\\b"],
        negationRequired: true,
        crossTags: ["A2"],
        auContext: false
      },

      // ============================================================
      // DEVELOPMENTAL HISTORY
      // ============================================================
      {
        label: "Wasn't interested in other babies at playgroup / mothers' group",
        weight: 1.6,
        source: "history",
        specificity: "very high",
        ageRange: { min: 6, max: 24, unit: "months", retrospective: true },
        keywords: ["wasn't interested in other babies", "didn't notice other babies", "ignored other babies at playgroup"],
        regex: ["\\b(wasn't|was\\s+not|never)\\s+interested\\s+in\\s+(other\\s+)?bab(ies|y)\\b", "\\bignored\\s+other\\s+bab(ies|y)\\s+at\\s+(playgroup|mothers?'?\\s+group)"],
        negationRequired: true,
        crossTags: ["A1"],
        auContext: true,
        auContextNote: "Mothers' group is a standard Australian early-parenting context"
      },
      {
        label: "Sat alone at daycare / kindy / playgroup",
        weight: 1.5,
        source: "history",
        specificity: "high",
        ageRange: { min: 18, max: 60, unit: "months", retrospective: true },
        keywords: ["sat alone at daycare", "alone at kindy", "alone at playgroup", "daycare staff said always alone"],
        regex: ["\\bsat\\s+alone\\s+at\\s+(daycare|kindy|kindergarten|playgroup|preschool)\\b", "\\b(daycare|kindy)\\s+(staff|teachers?|educators?)\\s+(said|mentioned|noted)\\s+(he|she|they)\\s+(was|is)\\s+always\\s+alone\\b"],
        negationRequired: false,
        crossTags: [],
        auContext: true,
        auContextNote: "Kindy = Australian/British term for kindergarten/preschool"
      },
      {
        label: "Kindy / prep / daycare teacher mentioned no friends or social concerns",
        weight: 1.5,
        source: "history",
        specificity: "high",
        ageRange: { min: 36, max: 84, unit: "months", retrospective: true },
        keywords: ["kindy teacher mentioned", "prep teacher raised", "daycare educator concerned", "early childhood educator concerns"],
        regex: ["\\b(kindy|kindergarten|prep|preschool|daycare|childcare)\\s+(teacher|educator|staff)\\s+(mentioned|raised|noted|concerned\\s+about)\\b"],
        negationRequired: false,
        crossTags: [],
        auContext: true,
        auContextNote: "Prep = first year of Australian school (varies by state)"
      },
      {
        label: "Hasn't had a friend since prep / kindy",
        weight: 1.6,
        source: "history",
        specificity: "very high",
        ageRange: { min: 72, max: 999, unit: "months" },
        keywords: ["no friend since prep", "no friend since kindy", "no friend since reception"],
        regex: ["\\b(hasn't|has\\s+not|haven't)\\s+had\\s+(a\\s+)?friends?\\s+since\\s+(prep|kindy|kindergarten|reception|year\\s+\\d|grade\\s+\\d)\\b"],
        negationRequired: true,
        crossTags: [],
        auContext: true
      },
      {
        label: "Family stopped attending playgroups / playdates because of social difficulties",
        weight: 1.5,
        source: "history",
        specificity: "very high",
        ageRange: { min: 12, max: 60, unit: "months", retrospective: true },
        keywords: ["stopped going to playgroup", "stopped attending playdates", "family withdrew from social"],
        regex: ["\\b(stopped|gave\\s+up|withdrew\\s+from)\\s+(going\\s+to\\s+|attending\\s+)?(playgroup|playdates?|mothers?'?\\s+group|family\\s+events?)\\b"],
        negationRequired: false,
        crossTags: ["IMPAIRMENT"],
        auContext: true
      }
    ]
  },
  {
    domain: "B1 Repetitive motor/speech/object use",
    code: "B1",
    criterion: "Stereotyped or repetitive motor movements, use of objects, or speech",
    criterionGroup: "B",
    dsmReference: "DSM-5-TR 299.00 Criterion B1",
    severityWeight: 1.1,
    detectionStrategy: "presence-dominant",
    markers: [
      // ============================================================
      // MOTOR STEREOTYPIES — CLINICIAN
      // ============================================================
      {
        label: "Hand-flapping",
        weight: 1.5,
        source: "clinician",
        specificity: "very high",
        ageRange: { min: 6, max: 999, unit: "months" },
        keywords: ["hand flapping", "hand-flapping", "flaps hands", "flapping when excited"],
        regex: ["\\bhand[-\\s]?flapp(ing|ed|s)?\\b", "\\bflaps?\\s+(his|her|their)?\\s*hands?\\b"],
        negationRequired: false,
        crossTags: [],
        auContext: false
      },
      {
        label: "Finger-flicking / finger movements near eyes",
        weight: 1.6,
        source: "clinician",
        specificity: "very high",
        ageRange: { min: 6, max: 999, unit: "months" },
        keywords: ["finger flicking", "finger-flicking", "wiggles fingers", "fingers near eyes", "finger movements near face"],
        regex: ["\\bfinger[-\\s]?flick(ing|s|ed)?\\b", "\\b(wiggles?|flicks?)\\s+(his|her|their)?\\s*fingers?\\s+(near|in\\s+front\\s+of)\\s+(his|her|their)?\\s*(eyes|face)"],
        negationRequired: false,
        crossTags: ["B4"],
        auContext: false,
        note: "Visual stim - cross-tags with B4 sensory"
      },
      {
        label: "Body rocking",
        weight: 1.4,
        source: "clinician",
        specificity: "high",
        ageRange: { min: 6, max: 999, unit: "months" },
        keywords: ["rocking", "body rocking", "rocks back and forth", "rocking motion"],
        regex: ["\\b(body\\s+)?rock(ing|ed|s)\\b", "\\brocks?\\s+back\\s+and\\s+forth\\b"],
        negationRequired: false,
        crossTags: [],
        auContext: false
      },
      {
        label: "Hand-wringing / hand-mannerisms",
        weight: 1.4,
        source: "clinician",
        specificity: "high",
        ageRange: { min: 24, max: 999, unit: "months" },
        keywords: ["hand wringing", "hand mannerisms", "hand posturing", "hand twisting"],
        regex: ["\\bhand[-\\s]?(wringing|mannerisms?|posturing|twisting)\\b"],
        negationRequired: false,
        crossTags: [],
        auContext: false
      },
      {
        label: "Whole-body tensing / posturing",
        weight: 1.4,
        source: "clinician",
        specificity: "high",
        ageRange: { min: 12, max: 999, unit: "months" },
        keywords: ["whole body tensing", "body posturing", "tenses whole body", "stiffens body"],
        regex: ["\\b(whole[-\\s]?body|body)\\s+(tensing|posturing|stiffening)\\b", "\\btenses?\\s+(his|her|their)?\\s*whole\\s+body\\b"],
        negationRequired: false,
        crossTags: [],
        auContext: false
      },
      {
        label: "Toe-walking",
        weight: 1.5,
        source: "clinician",
        specificity: "very high",
        ageRange: { min: 18, max: 999, unit: "months" },
        keywords: ["toe walking", "toe-walking", "walks on toes", "tip-toe walking"],
        regex: ["\\btoe[-\\s]?walk(ing|s|ed)?\\b", "\\bwalks?\\s+on\\s+(his|her|their)?\\s*toes\\b", "\\btip[-\\s]?toe\\s+walk"],
        negationRequired: false,
        crossTags: [],
        auContext: false,
        note: "When persistent past 24 months, highly specific to ASD"
      },
      {
        label: "Spinning self / rotational seeking",
        weight: 1.5,
        source: "clinician",
        specificity: "very high",
        ageRange: { min: 18, max: 999, unit: "months" },
        keywords: ["spinning self", "spins around", "rotates self", "rotational seeking"],
        regex: ["\\bspin(s|ning|ned)?\\s+(self|him|her|them|in\\s+circles)\\b", "\\brotational\\s+seeking\\b"],
        negationRequired: false,
        crossTags: ["B4"],
        auContext: false
      },
      {
        label: "Spinning objects / watching wheels spin",
        weight: 1.6,
        source: "clinician",
        specificity: "very high",
        ageRange: { min: 12, max: 999, unit: "months" },
        keywords: [
          "spins objects",
          "watches wheels spin",
          "spins toys",
          "rotates objects",
          "spinning objects",
          "spinning things",
          "spins things",
          "watches spinning",
          "watching spinning",
          "spinning fans",
          "spinning wheels",
          "spinning washing machine",
          "highly focused on spinning",
          "focused on spinning",
          "fascinated by spinning",
          "fascinated by fans",
          "watches the washing machine",
          "watches the dryer",
          "stares at fans",
          "stares at the ceiling fan",
        ],
        regex: [
          "\\bspins?\\s+(objects?|toys?|wheels?|things)\\b",
          "\\bwatches?\\s+(wheels?|fans?|washing\\s+machines?)\\s+spin",
          "\\bspin(s|ning|ned)?\\s+(objects?|things|fans?|wheels?|washing\\s+machines?|toys?)",
          "\\b(watches?|watching|stares?\\s+at|fascinated\\s+by|focused\\s+on)\\s+(spinning|fans?|ceiling\\s+fans?|washing\\s+machines?|wheels?|dryers?)",
          "\\bspinning\\s+objects?\\s+such\\s+as\\b",
        ],
        negationRequired: false,
        crossTags: ["B3", "B4"],
        auContext: false,
        note: "Pathognomonic when persistent and dominates play"
      },
      {
        label: "Lining up objects / repetitive arrangement",
        weight: 1.7,
        source: "clinician",
        specificity: "very high",
        ageRange: { min: 12, max: 999, unit: "months" },
        keywords: [
          "lining up",
          "lines up objects",
          "lines up toys",
          "repetitive arrangement",
          "line up",
          "lines up",
          "lined up",
          "lines them up",
          "line them up",
          "lined them up",
          "in a row",
          "in a line",
          "all in a line",
          "arranges in a line",
          "arranges in rows",
          "line up toys",
        ],
        regex: [
          "\\blin(es?|ing|ed)\\s+up\\s+(objects?|toys?|cars?|trains?|figures?|shoes?|cups?|pencils?)\\b",
          "\\b(lines?\\s+up|lining\\s+up|lined\\s+up)\\b",
          "\\b(lines?|lined|lining)\\s+(them|toys?|objects?|cars?|figures?|cards?|shoes?|pencils?|cups?|trains?|animals?|blocks?)\\s+(up\\s+)?(in\\s+(a\\s+)?(row|line))?",
          "\\b(arranges?|arranged|arranging)\\s+(.*?)\\s+in\\s+(a\\s+)?(row|line|order)\\b",
        ],
        negationRequired: false,
        crossTags: ["A3"],
        auContext: false,
        note: "Pathognomonic ASD marker; one of the highest-specificity behavioural signals"
      },
      {
        label: "Repetitive opening and closing (doors, drawers, cupboards, switches)",
        weight: 1.5,
        source: "clinician",
        specificity: "very high",
        ageRange: { min: 18, max: 999, unit: "months" },
        keywords: ["opens and closes doors", "opens and closes drawers", "switch flicking", "light switching"],
        regex: ["\\bopens?\\s+and\\s+closes?\\s+(doors?|drawers?|cupboards?|cabinets?)\\b", "\\b(switch|light)[-\\s]?flick(ing|s|ed)?\\b", "\\bturns?\\s+(taps?|switches?)\\s+on\\s+and\\s+off\\b"],
        negationRequired: false,
        crossTags: ["B3"],
        auContext: false
      },

      // ============================================================
      // MOTOR STEREOTYPIES — PARENT
      // ============================================================
      {
        label: "Flaps his hands when excited",
        weight: 1.6,
        source: "parent",
        specificity: "very high",
        ageRange: { min: 6, max: 999, unit: "months" },
        keywords: ["flaps when excited", "flaps when happy", "hands go like this", "happy flapping"],
        regex: ["\\bflaps?\\s+(his|her|their)?\\s*hands?\\s+when\\s+(excited|happy)\\b", "\\bhappy\\s+flapping\\b"],
        negationRequired: false,
        crossTags: [],
        auContext: false
      },
      {
        label: "Wiggles fingers in front of eyes / watches his hands",
        weight: 1.7,
        source: "parent",
        specificity: "very high",
        ageRange: { min: 6, max: 60, unit: "months" },
        keywords: ["wiggles fingers in front of eyes", "watches his hands", "stares at his hands"],
        regex: ["\\bwiggles?\\s+(his|her|their)?\\s*fingers?\\s+in\\s+front\\s+of\\s+(his|her|their)?\\s*eyes?\\b", "\\bwatches?\\s+(his|her|their)?\\s*(own\\s+)?hands?\\b"],
        negationRequired: false,
        crossTags: ["B4"],
        auContext: false
      },
      {
        label: "Looks at things from the corner of his eye",
        weight: 1.6,
        source: "parent",
        specificity: "very high",
        ageRange: { min: 12, max: 999, unit: "months" },
        keywords: ["corner of eye", "side glance", "peripheral viewing"],
        regex: ["\\b(looks?|sees?)\\s+(at\\s+things\\s+)?(from|out\\s+of)\\s+the\\s+corner\\s+of\\s+(his|her|their)?\\s*eyes?\\b"],
        negationRequired: false,
        crossTags: ["A2", "B4"],
        auContext: false
      },
      {
        label: "Walks on his toes / tip-toes everywhere",
        weight: 1.5,
        source: "parent",
        specificity: "very high",
        ageRange: { min: 18, max: 999, unit: "months" },
        keywords: ["walks on toes", "tip-toes everywhere", "tippy-toes"],
        regex: ["\\b(walks?|runs?)\\s+on\\s+(his|her|their)?\\s*toes\\b", "\\btip[-\\s]?toes?\\s+everywhere\\b", "\\btippy[-\\s]?toes?\\b"],
        negationRequired: false,
        crossTags: [],
        auContext: false
      },
      {
        label: "Spins around in circles / spins until falls over",
        weight: 1.5,
        source: "parent",
        specificity: "high",
        ageRange: { min: 18, max: 999, unit: "months" },
        keywords: ["spins in circles", "spins until falls over", "loves spinning"],
        regex: ["\\bspins?\\s+(around\\s+)?in\\s+circles\\b", "\\bspins?\\s+until\\s+(he|she|they)\\s+falls?\\s+over\\b"],
        negationRequired: false,
        crossTags: ["B4"],
        auContext: false
      },
      {
        label: "Spins the wheels of cars instead of pushing them",
        weight: 1.7,
        source: "parent",
        specificity: "very high",
        ageRange: { min: 18, max: 60, unit: "months" },
        keywords: ["spins wheels of cars", "flips cars to spin wheels", "spins wheels not pushes"],
        regex: ["\\bspins?\\s+(the\\s+)?wheels?\\s+(of\\s+(the\\s+)?)?cars?\\s+(instead|rather)\\s+(of|than)\\s+pushing\\b", "\\bflips?\\s+cars?\\s+(over\\s+)?to\\s+spin\\s+(the\\s+)?wheels?"],
        negationRequired: false,
        crossTags: ["A3"],
        auContext: false,
        note: "Pathognomonic functional play deficit"
      },
      {
        label: "Watches the washing machine for hours / mesmerised by appliances",
        weight: 1.7,
        source: "parent",
        specificity: "very high",
        ageRange: { min: 12, max: 999, unit: "months" },
        keywords: ["watches washing machine", "obsessed with fans", "watches the dryer", "stares at ceiling fan", "spinning objects", "watches spinning", "fascinated by spinning"],
        regex: [
          "\\bwatches?\\s+the\\s+(washing\\s+machine|dryer|dishwasher)\\s+(for\\s+hours|spinning)?",
          "\\b(obsessed|fascinated)\\s+with\\s+(fans?|ceiling\\s+fans?)\\b",
          "\\bstares?\\s+at\\s+(ceiling\\s+)?fans?\\b",
          "\\b(watches?|watching|stares?\\s+at|fascinated\\s+by|focused\\s+on)\\s+(spinning|fans?|ceiling\\s+fans?|washing\\s+machines?|wheels?|dryers?)",
          "\\bspinning\\s+objects?\\s+such\\s+as\\b",
        ],
        negationRequired: false,
        crossTags: ["B3"],
        auContext: false
      },
      {
        label: "Has to flick every light switch / open and close every door",
        weight: 1.5,
        source: "parent",
        specificity: "very high",
        ageRange: { min: 18, max: 999, unit: "months" },
        keywords: ["flicks every light switch", "opens and closes every door", "has to do switches"],
        regex: ["\\bhas\\s+to\\s+flick\\s+every\\s+(light\\s+)?switch\\b", "\\b(opens?\\s+and\\s+closes?|opens?)\\s+every\\s+(door|drawer|cupboard)\\b"],
        negationRequired: false,
        crossTags: ["B2", "B3"],
        auContext: false
      },
      {
        label: "Lines up his toys / cars / Pokémon cards",
        weight: 1.7,
        source: "parent",
        specificity: "very high",
        ageRange: { min: 12, max: 999, unit: "months" },
        keywords: [
          "lines up toys",
          "lines up cars",
          "lines up shoes",
          "lines up cups",
          "lines up pencils",
          "line up",
          "lines them up",
          "in a row",
          "in a line",
          "all in a line",
          "arranges in rows",
        ],
        regex: [
          "\\blines?\\s+up\\s+(his|her|their)?\\s*(toys?|cars?|trains?|figures?|shoes?|cups?|pencils?|Pok[eé]mon|cards?|animals?|blocks?)\\b",
          "\\b(lines?\\s+up|lining\\s+up|lined\\s+up)\\b",
          "\\b(lines?|lined|lining)\\s+(them|toys?|objects?|cars?|figures?|cards?|shoes?|pencils?|cups?|trains?|animals?|blocks?)\\s+(up\\s+)?(in\\s+(a\\s+)?(row|line))?",
          "\\b(arranges?|arranged|arranging)\\s+(.*?)\\s+in\\s+(a\\s+)?(row|line|order)\\b",
        ],
        negationRequired: false,
        crossTags: ["A3"],
        auContext: false
      },
      {
        label: "Cars / toys have to be in a row / sorts everything",
        weight: 1.6,
        source: "parent",
        specificity: "very high",
        ageRange: { min: 18, max: 999, unit: "months" },
        keywords: ["cars in a row", "everything in a line", "sorts by colour", "sorts everything"],
        regex: ["\\b(cars?|toys?|figures?)\\s+have\\s+to\\s+be\\s+in\\s+(a\\s+)?row\\b", "\\bsorts?\\s+(everything|toys?)\\s+by\\s+(colou?r|size|type)\\b"],
        negationRequired: false,
        crossTags: ["B2"],
        auContext: false
      },
      {
        label: "Doesn't play with toys properly / plays the same way every time",
        weight: 1.5,
        source: "parent",
        specificity: "high",
        ageRange: { min: 24, max: 999, unit: "months" },
        keywords: ["doesn't play properly", "plays same way every time", "uses toys wrong"],
        regex: ["\\b(doesn't|does\\s+not)\\s+play\\s+with\\s+toys?\\s+properly\\b", "\\bplays?\\s+(with\\s+the\\s+same\\s+toy\\s+)?the\\s+same\\s+way\\s+every\\s+time\\b"],
        negationRequired: false,
        crossTags: ["A3"],
        auContext: false
      },

      // ============================================================
      // ECHOLALIA & SCRIPTED SPEECH
      // ============================================================
      {
        label: "Immediate echolalia",
        weight: 1.5,
        source: "clinician",
        specificity: "very high",
        ageRange: { min: 18, max: 999, unit: "months" },
        keywords: ["immediate echolalia", "echoes back", "repeats my question"],
        regex: ["\\bimmediate\\s+echolalia\\b", "\\b(echoes?|echo)\\s+back\\b", "\\brepeats?\\s+(my|the)\\s+question\\s+(back\\s+)?(rather|instead\\s+of\\s+answering)"],
        negationRequired: false,
        crossTags: [],
        auContext: false
      },
      {
        label: "Delayed echolalia",
        weight: 1.6,
        source: "clinician",
        specificity: "very high",
        ageRange: { min: 24, max: 999, unit: "months" },
        keywords: [
          "delayed echolalia",
          "TV phrases",
          "scripted from television",
          "movie quotes",
          "repeats phrases",
          "repeating phrases",
          "repeats lines",
          "phrases from YouTube",
          "phrases from TV",
          "phrases from videos",
          "lines from YouTube",
          "quotes from YouTube",
          "repeats what he hears",
          "echoes phrases",
          "scripted from",
          "scripts from",
        ],
        regex: [
          "\\bdelayed\\s+echolalia\\b",
          "\\bscripted\\s+(from|TV|television|YouTube|movies?)\\b",
          "\\b(TV|movie|YouTube)\\s+(phrases?|quotes?|lines?)",
          "\\b(repeats?|repeating|repeated|echoes?|echoing)\\s+(phrases?|lines?|words?|things?)\\s+(from|he('s|s)?\\s+heard|she('s|s)?\\s+heard)",
          "\\b(phrases?|lines?|quotes?)\\s+from\\s+(YouTube|TV|television|videos?|movies?|films?|shows?)",
        ],
        negationRequired: false,
        crossTags: [],
        auContext: false
      },
      {
        label: "Mitigated echolalia",
        weight: 1.6,
        source: "clinician",
        specificity: "very high",
        ageRange: { min: 36, max: 999, unit: "months" },
        keywords: ["mitigated echolalia", "modified echolalia"],
        regex: ["\\bmitigated\\s+echolalia\\b", "\\bmodified\\s+echolalia\\b"],
        negationRequired: false,
        crossTags: [],
        auContext: false,
        note: "Higher-functioning echolalic pattern - often missed"
      },
      {
        label: "Quotes Bluey / Peppa / Paw Patrol all day",
        weight: 1.6,
        source: "parent",
        specificity: "very high",
        ageRange: { min: 24, max: 999, unit: "months" },
        keywords: ["quotes Bluey", "quotes Peppa", "quotes Paw Patrol", "talks like Bluey", "Bluey lines"],
        regex: ["\\b(quotes?|repeats?|says?\\s+lines?\\s+from)\\s+(Bluey|Peppa|Paw\\s+Patrol|Octonauts|Bing|Sesame\\s+Street|YouTube)\\b", "\\btalks?\\s+like\\s+(Bluey|Peppa|YouTuber)"],
        negationRequired: false,
        crossTags: ["A2"],
        auContext: true,
        auContextNote: "Bluey is the dominant Australian children's show — extremely high signal"
      },
      {
        label: "Repeats lines from movies / talks like a YouTuber",
        weight: 1.5,
        source: "parent",
        specificity: "very high",
        ageRange: { min: 36, max: 999, unit: "months" },
        keywords: [
          "repeats movie lines",
          "talks like a YouTuber",
          "YouTuber voice",
          "movie quotes",
          "repeats phrases",
          "repeating phrases",
          "phrases from YouTube",
          "lines from YouTube",
          "quotes from YouTube",
          "echoes phrases",
        ],
        regex: [
          "\\brepeats?\\s+(lines?|quotes?)\\s+from\\s+(movies?|films?|YouTube|videos?)",
          "\\btalks?\\s+like\\s+(a\\s+)?YouTuber\\b",
          "\\b(repeats?|repeating|repeated|echoes?|echoing)\\s+(phrases?|lines?|words?|things?)\\s+(from|he('s|s)?\\s+heard|she('s|s)?\\s+heard)",
          "\\b(phrases?|lines?|quotes?)\\s+from\\s+(YouTube|TV|television|videos?|movies?|films?|shows?)",
        ],
        negationRequired: false,
        crossTags: ["A2"],
        auContext: false
      },
      {
        label: "Just repeats my question instead of answering",
        weight: 1.5,
        source: "parent",
        specificity: "very high",
        ageRange: { min: 18, max: 999, unit: "months" },
        keywords: ["just repeats my question", "echoes back my question", "repeats what I say"],
        regex: ["\\b(just\\s+)?repeats?\\s+(my|the)\\s+question\\b", "\\bechoes?\\s+(back\\s+)?(my|what\\s+I\\s+say|the\\s+question)"],
        negationRequired: false,
        crossTags: [],
        auContext: false
      },

      // ============================================================
      // PRONOUN REVERSAL & IDIOSYNCRATIC LANGUAGE
      // ============================================================
      {
        label: "Pronoun reversal — 'you' for 'I'",
        weight: 1.7,
        source: "clinician",
        specificity: "very high",
        ageRange: { min: 24, max: 999, unit: "months" },
        keywords: ["pronoun reversal", "uses you for I", "says you when means I", "you/I confusion"],
        regex: ["\\bpronoun\\s+reversal\\b", "\\buses?\\s+['\"]?you['\"]?\\s+for\\s+['\"]?I['\"]?\\b", "\\bsays?\\s+['\"]?you['\"]?\\s+when\\s+(he|she|they)\\s+means?\\s+['\"]?I['\"]?\\b"],
        negationRequired: false,
        crossTags: [],
        auContext: false,
        note: "Highly specific to ASD; near-pathognomonic in monolingual children past 30 months"
      },
      {
        label: "Refers to self in third person / by name",
        weight: 1.5,
        source: "parent",
        specificity: "very high",
        ageRange: { min: 24, max: 999, unit: "months" },
        keywords: ["third person self-reference", "calls himself by name", "refers to self by name"],
        regex: ["\\brefers?\\s+to\\s+(him|her|them)self\\s+(in\\s+third\\s+person|by\\s+name)\\b", "\\bcalls?\\s+(him|her|them)self\\s+by\\s+(his|her|their)\\s+name\\b"],
        negationRequired: false,
        crossTags: [],
        auContext: false
      },
      {
        label: "Idiosyncratic phrases / neologisms / private language",
        weight: 1.5,
        source: "clinician",
        specificity: "very high",
        ageRange: { min: 36, max: 999, unit: "months" },
        keywords: ["idiosyncratic phrases", "neologisms", "made-up words", "private language"],
        regex: ["\\b(idiosyncratic|neologism|made[-\\s]?up|private)\\s+(phrases?|words?|language|terms?)"],
        negationRequired: false,
        crossTags: [],
        auContext: false
      },
      {
        label: "Asks the same question 50 times a day",
        weight: 1.4,
        source: "parent",
        specificity: "high",
        ageRange: { min: 36, max: 999, unit: "months" },
        keywords: [
          "asks same question 50 times",
          "repetitive questioning",
          "asks the same thing over and over",
          "asks the same question",
          "asks the same questions",
          "repeatedly asking",
          "repeatedly asks",
          "same question over and over",
          "asks again and again",
          "asks repeatedly",
          "despite receiving answers",
          "even after answered",
          "asks 50 times",
          "asks all day",
        ],
        regex: [
          "\\basks?\\s+the\\s+same\\s+question\\s+(\\d+\\s+times|over\\s+and\\s+over|all\\s+day|repeatedly)\\b",
          "\\b(repeatedly\\s+ask(s|ing)|asks?\\s+repeatedly)\\s+(the\\s+same\\s+)?questions?",
          "\\basks?\\s+the\\s+same\\s+questions?\\s+(over\\s+and\\s+over|again\\s+and\\s+again|repeatedly|all\\s+day|\\d+\\s+times)",
          "\\basks?\\s+(again\\s+and\\s+again|repeatedly)\\s+despite",
          "\\bdespite\\s+receiving\\s+answers?\\b",
          "\\beven\\s+after\\s+(I'?ve?\\s+)?answered\\b",
        ],
        negationRequired: false,
        crossTags: ["B2"],
        auContext: false
      },
      {
        label: "Verbal stereotypies / vocal stims",
        weight: 1.4,
        source: "clinician",
        specificity: "very high",
        ageRange: { min: 12, max: 999, unit: "months" },
        keywords: ["verbal stereotypies", "vocal stims", "humming", "throat clearing", "scripted vocalisations"],
        regex: ["\\b(verbal\\s+stereotyp|vocal\\s+stim|hum(ming)?|throat[-\\s]?clear|squeal|scripted\\s+vocalis)"],
        negationRequired: false,
        crossTags: [],
        auContext: false
      },
      {
        label: "Hums constantly / makes the same noise over and over",
        weight: 1.4,
        source: "parent",
        specificity: "high",
        ageRange: { min: 18, max: 999, unit: "months" },
        keywords: ["hums constantly", "makes same noise", "vocal tic", "verbal tic"],
        regex: ["\\bhums?\\s+constantly\\b", "\\bmakes?\\s+the\\s+same\\s+noise\\s+over\\s+and\\s+over\\b", "\\b(vocal|verbal)\\s+tics?\\b"],
        negationRequired: false,
        crossTags: [],
        auContext: false
      },
      {
        label: "Repetitive pacing / motor mannerisms",
        weight: 1.4,
        source: "parent",
        specificity: "high",
        ageRange: { min: 24, max: 999, unit: "months" },
        keywords: [
          "repetitive pacing",
          "paces repetitively",
          "pacing repetitively",
          "repetitive motor mannerism",
          "motor mannerisms",
          "repetitive movements",
        ],
        regex: [
          "\\brepetitive\\s+pacing\\b",
          "\\bpaces?\\s+repetitively\\b",
          "\\bpacing\\s+(behaviour|mannerism|movement)s?\\b",
          "\\brepetitive\\s+motor\\s+mannerisms?\\b",
        ],
        negationRequired: false,
        crossTags: [],
        auContext: false,
      },
      {
        label: "Repetitive finger movements",
        weight: 1.5,
        source: "parent",
        specificity: "very high",
        ageRange: { min: 6, max: 999, unit: "months" },
        keywords: [
          "finger movements",
          "repetitive finger",
          "finger mannerisms",
          "moves fingers repetitively",
          "wiggles fingers",
          "flicks fingers",
          "finger flicking",
        ],
        regex: [
          "\\b(repetitive\\s+)?finger\\s+(movements?|mannerisms?|flicking)\\b",
          "\\b(wiggles?|flicks?|moves?)\\s+(his|her|their)?\\s*fingers?\\s+(repetitively|in\\s+front)?",
        ],
        negationRequired: false,
        crossTags: ["B4"],
        auContext: false,
      },
      {
        label: "Repeats phrases from YouTube / TV / movies (delayed echolalia)",
        weight: 1.6,
        source: "parent",
        specificity: "very high",
        ageRange: { min: 24, max: 999, unit: "months" },
        keywords: [
          "repeats phrases",
          "repeating phrases",
          "repeats lines",
          "phrases from YouTube",
          "phrases from TV",
          "phrases from videos",
          "lines from YouTube",
          "quotes from YouTube",
          "repeats what he hears",
          "echoes phrases",
          "scripted from",
          "scripts from",
        ],
        regex: [
          "\\b(repeats?|repeating|repeated|echoes?|echoing)\\s+(phrases?|lines?|words?|things?)\\s+(from|he('s|s)?\\s+heard|she('s|s)?\\s+heard)",
          "\\b(phrases?|lines?|quotes?)\\s+from\\s+(YouTube|TV|television|videos?|movies?|films?|shows?)",
        ],
        negationRequired: false,
        crossTags: ["A2"],
        auContext: false,
      },
      {
        label: "Repetitive checking behaviours",
        weight: 1.4,
        source: "parent",
        specificity: "high",
        ageRange: { min: 36, max: 999, unit: "months" },
        keywords: [
          "repetitive checking",
          "checking behaviours",
          "checks repeatedly",
          "constantly checking",
          "checks over and over",
        ],
        regex: [
          "\\b(repetitive\\s+)?checking\\s+behaviours?\\b",
          "\\bchecks?\\s+(repeatedly|over\\s+and\\s+over|constantly)\\b",
          "\\b(constantly|repeatedly)\\s+checking\\b",
        ],
        negationRequired: false,
        crossTags: ["B2"],
        auContext: false,
      },
      {
        label: "Mouthing objects past developmental norm / chews on shirts / collars",
        weight: 1.4,
        source: "parent",
        specificity: "high",
        ageRange: { min: 36, max: 999, unit: "months" },
        keywords: ["mouths everything", "chews on shirt", "chews on collar", "chews on sleeves"],
        regex: ["\\bmouths?\\s+(everything|things?|objects?)\\s+still\\b", "\\bchews?\\s+on\\s+(his|her|their)?\\s*(shirt|sleeve|collar|clothes)\\b"],
        negationRequired: false,
        crossTags: ["B4"],
        auContext: false
      }
    ]
  },
  {
    domain: "B2 Rigidity / sameness / transitions",
    code: "B2",
    criterion: "Insistence on sameness, inflexible adherence to routines, ritualised patterns",
    criterionGroup: "B",
    dsmReference: "DSM-5-TR 299.00 Criterion B2",
    severityWeight: 1.2,
    detectionStrategy: "presence-dominant",
    markers: [
      // ============================================================
      // SAMENESS — CLINICIAN
      // ============================================================
      {
        label: "Insistence on sameness",
        weight: 1.5,
        source: "clinician",
        specificity: "very high",
        ageRange: { min: 18, max: 999, unit: "months" },
        keywords: ["insistence on sameness", "needs sameness", "demands sameness"],
        regex: ["\\binsistence\\s+on\\s+sameness\\b", "\\b(needs?|demands?|requires?)\\s+sameness\\b"],
        negationRequired: false,
        crossTags: [],
        auContext: false
      },
      {
        label: "Inflexible adherence to routines",
        weight: 1.5,
        source: "clinician",
        specificity: "very high",
        ageRange: { min: 18, max: 999, unit: "months" },
        keywords: ["inflexible adherence to routines", "rigid routines", "ritualised routines"],
        regex: ["\\binflexible\\s+adherence\\s+to\\s+routines?\\b", "\\b(rigid|ritualised|ritualized)\\s+routines?\\b"],
        negationRequired: false,
        crossTags: [],
        auContext: false
      },
      {
        label: "Rigidity around routines / inflexibility",
        weight: 1.5,
        source: "parent",
        specificity: "very high",
        ageRange: { min: 18, max: 999, unit: "months" },
        keywords: [
          "rigidity around routines",
          "rigid around routines",
          "rigidity in routines",
          "longstanding rigidity",
          "rigid about routines",
          "rigidity around",
          "inflexible about routines",
          "needs routine",
        ],
        regex: [
          "\\b(longstanding\\s+)?rigidit(y|ies)\\s+(around|in|about|with|regarding)\\s+(routines?|expectations?|transitions?|plans?)",
          "\\binflexibility\\s+(around|in|about|with)\\s+(routines?|expectations?|transitions?)",
          "\\brigid\\s+(about|around|with)\\s+(routines?|expectations?|transitions?)",
        ],
        negationRequired: false,
        crossTags: [],
        auContext: false,
      },
      {
        label: "Distress with unpredictability",
        weight: 1.5,
        source: "parent",
        specificity: "very high",
        ageRange: { min: 18, max: 999, unit: "months" },
        keywords: [
          "distressed by unpredictability",
          "unpredictability",
          "distressed by change",
          "can't cope with unpredictable",
          "needs predictability",
          "needs to know what's happening",
          "becomes distressed by unpredictability",
        ],
        regex: [
          "\\bdistressed?\\s+by\\s+(unpredictability|unpredictable|change|changes)",
          "\\b(unpredictability|unpredictable\\s+events?)\\b",
          "\\bneeds?\\s+(predictability|to\\s+know\\s+what's\\s+happening|the\\s+plan)\\b",
        ],
        negationRequired: false,
        crossTags: [],
        auContext: false,
      },
      {
        label: "Catastrophic / extreme distress at minor changes",
        weight: 1.6,
        source: "clinician",
        specificity: "very high",
        ageRange: { min: 18, max: 999, unit: "months" },
        keywords: ["catastrophic response to change", "extreme distress at change", "meltdown at minor change"],
        regex: ["\\b(catastrophic|extreme|severe)\\s+(distress|response|reaction)\\s+(to|at)\\s+(minor\\s+|small\\s+)?changes?\\b"],
        negationRequired: false,
        crossTags: [],
        auContext: false
      },
      {
        label: "Cognitive inflexibility / black-and-white thinking",
        weight: 1.4,
        source: "clinician",
        specificity: "high",
        ageRange: { min: 60, max: 999, unit: "months" },
        keywords: ["cognitive inflexibility", "black and white thinking", "all or nothing", "rigid thinking"],
        regex: ["\\bcognitive\\s+inflexibility\\b", "\\b(black[-\\s]?and[-\\s]?white|all[-\\s]?or[-\\s]?nothing|rigid)\\s+thinking\\b"],
        negationRequired: false,
        crossTags: [],
        auContext: false
      },
      {
        label: "Difficulty with transitions",
        weight: 1.4,
        source: "clinician",
        specificity: "high",
        ageRange: { min: 18, max: 999, unit: "months" },
        keywords: ["difficulty with transitions", "transition difficulties", "trouble transitioning"],
        regex: ["\\b(difficulty|trouble|distress|meltdowns?)\\s+(with\\s+)?transitions?\\b", "\\btransition\\s+(difficulties|distress)"],
        negationRequired: false,
        crossTags: [],
        auContext: false
      },
      {
        label: "Verbal rituals / scripted greetings / mealtime / bedtime rituals",
        weight: 1.5,
        source: "clinician",
        specificity: "very high",
        ageRange: { min: 24, max: 999, unit: "months" },
        keywords: ["verbal rituals", "greeting rituals", "bedtime rituals", "mealtime rituals", "ritualised greetings"],
        regex: ["\\b(verbal|greeting|bedtime|mealtime|morning)\\s+rituals?\\b"],
        negationRequired: false,
        crossTags: ["B1"],
        auContext: false
      },
      {
        label: "Cannot leave a task incomplete / completion compulsion",
        weight: 1.5,
        source: "clinician",
        specificity: "very high",
        ageRange: { min: 36, max: 999, unit: "months" },
        keywords: ["completion compulsion", "cannot leave incomplete", "must finish what started"],
        regex: ["\\bcompletion\\s+compulsion\\b", "\\b(cannot|can't|must)\\s+(leave|finish)\\s+(a\\s+)?task\\s+(incomplete|started)\\b"],
        negationRequired: false,
        crossTags: [],
        auContext: false
      },
      {
        label: "Visual schedules / first-then boards / Social Stories required",
        weight: 1.4,
        source: "clinician",
        specificity: "high",
        ageRange: { min: 36, max: 999, unit: "months" },
        keywords: ["visual schedule", "first-then board", "Social Stories", "needs visual support"],
        regex: ["\\b(visual\\s+schedules?|first[-\\s]?then\\s+boards?|Social\\s+Stor(y|ies)|now[-\\s]?next\\s+boards?)\\s+(required|needed|used)?"],
        negationRequired: false,
        crossTags: [],
        auContext: false
      },

      // ============================================================
      // SAMENESS — PARENT (THE ROUTINE LANGUAGE)
      // ============================================================
      {
        label: "Routine is everything / cannot cope with change",
        weight: 1.5,
        source: "parent",
        specificity: "high",
        ageRange: { min: 18, max: 999, unit: "months" },
        keywords: ["routine is everything", "cannot cope with change", "can't handle change"],
        regex: ["\\broutine\\s+is\\s+everything\\b", "\\b(cannot|can't)\\s+cope\\s+with\\s+change\\b"],
        negationRequired: false,
        crossTags: [],
        auContext: false
      },
      {
        label: "If we change anything she loses it / if anything is different",
        weight: 1.5,
        source: "parent",
        specificity: "very high",
        ageRange: { min: 24, max: 999, unit: "months" },
        keywords: ["if we change anything", "loses it when something changes", "if anything is different"],
        regex: ["\\bif\\s+we\\s+change\\s+anything\\s+(he|she|they)\\s+(loses\\s+it|melts?\\s+down)\\b", "\\bif\\s+anything\\s+is\\s+different\\b"],
        negationRequired: false,
        crossTags: [],
        auContext: false
      },
      {
        label: "Same breakfast / lunch / dinner every day",
        weight: 1.5,
        source: "parent",
        specificity: "very high",
        ageRange: { min: 24, max: 999, unit: "months" },
        keywords: ["same breakfast every day", "same lunch every day", "same food every day"],
        regex: ["\\bsame\\s+(breakfast|lunch|dinner|food|meal)\\s+(every\\s+day|for\\s+(years|months))\\b"],
        negationRequired: false,
        crossTags: ["B4"],
        auContext: false
      },
      {
        label: "Only eats specific brand / refuses if packaging changes",
        weight: 1.7,
        source: "parent",
        specificity: "very high",
        ageRange: { min: 18, max: 999, unit: "months" },
        keywords: ["only Heinz", "only Vegemite", "only the green packet", "won't eat if packaging changed", "brand specific"],
        regex: ["\\bonly\\s+(eats|drinks|uses)\\s+(Heinz|Vegemite|Bega|Kraft|Aldi|the\\s+(blue|green|red|yellow)\\s+(packet|box|bottle))\\b", "\\b(won't|refuses?)\\s+eat\\s+if\\s+packaging\\s+(is\\s+)?(changed|different)\\b", "\\bbrand[-\\s]?specific\\s+eating\\b"],
        negationRequired: false,
        crossTags: ["B4"],
        auContext: true,
        auContextNote: "Vegemite, Bega, Aldi are Australian-specific brand references"
      },
      {
        label: "Same cup / plate / cutlery or meltdown",
        weight: 1.5,
        source: "parent",
        specificity: "very high",
        ageRange: { min: 18, max: 999, unit: "months" },
        keywords: [
          "same cup every day",
          "specific plate",
          "specific cutlery",
          "specific spoon",
          "different plate",
          "same plate",
          "different cup",
          "specific cup",
          "same cup",
          "different cutlery",
          "specific fork",
          "his plate",
          "her cup",
          "using a different plate",
        ],
        regex: [
          "\\b(same|specific)\\s+(cup|plate|bowl|cutlery|spoon|fork|knife)\\s+(every\\s+day|or\\s+meltdown|or\\s+he\\s+won't\\s+eat)?",
          "\\b(different|specific|same|wrong|particular)\\s+(plate|cup|bowl|cutlery|spoon|fork|knife|mug)\\b",
          "\\busing\\s+a\\s+different\\s+(plate|cup|bowl|cutlery|spoon|fork)\\b",
        ],
        negationRequired: false,
        crossTags: [],
        auContext: false
      },
      {
        label: "Same seat in the car / same gate at school / same route",
        weight: 1.5,
        source: "parent",
        specificity: "very high",
        ageRange: { min: 24, max: 999, unit: "months" },
        keywords: ["same seat in car", "same gate at school", "same route home"],
        regex: ["\\bsame\\s+(seat\\s+in\\s+the\\s+car|gate\\s+at\\s+school|route\\s+(home|to\\s+school)|drop[-\\s]?off\\s+spot)\\b"],
        negationRequired: false,
        crossTags: [],
        auContext: false
      },
      {
        label: "Different route home = screaming / meltdown",
        weight: 1.6,
        source: "parent",
        specificity: "very high",
        ageRange: { min: 24, max: 999, unit: "months" },
        keywords: [
          "different route home meltdown",
          "if I take a different route",
          "wrong way home",
          "different road",
          "different route",
          "different way home",
          "taking a different road",
          "different road home",
          "wrong route",
          "changed the route",
        ],
        regex: [
          "\\bif\\s+I\\s+take\\s+a\\s+different\\s+route\\b",
          "\\bdifferent\\s+route\\s+(home\\s+)?=?\\s*(screaming|meltdown|disaster)\\b",
          "\\b(different|new|wrong|alternate|alternative)\\s+(road|route|way)\\s+(home|to\\s+school|to\\s+the\\s+shops?)?",
          "\\btaking\\s+a\\s+different\\s+(road|route|way)\\b",
        ],
        negationRequired: false,
        crossTags: [],
        auContext: false
      },
      {
        label: "Distress with environmental changes (furniture, layout)",
        weight: 1.5,
        source: "parent",
        specificity: "very high",
        ageRange: { min: 24, max: 999, unit: "months" },
        keywords: [
          "moving furniture",
          "moved furniture",
          "rearranging",
          "furniture moved",
          "changed the layout",
          "moved things around",
          "rearranged the room",
        ],
        regex: [
          "\\b(moving|moved|rearrang(e|ing|ed))\\s+(furniture|the\\s+room|things|the\\s+layout)",
          "\\bfurniture\\s+(moved|moving|rearranged)",
          "\\b(changed|changing)\\s+(the\\s+)?(layout|room|set\\s?up)",
        ],
        negationRequired: false,
        crossTags: [],
        auContext: false,
      },
      {
        label: "Distress with schedule or plan changes",
        weight: 1.5,
        source: "parent",
        specificity: "very high",
        ageRange: { min: 36, max: 999, unit: "months" },
        keywords: [
          "changing weekend plans",
          "weekend plans changed",
          "changed plans",
          "schedule change",
          "plans changing",
          "changing the plan",
          "unexpected change",
          "changes to plans",
        ],
        regex: [
          "\\b(changing|changed|change\\s+to|change\\s+in)\\s+(weekend\\s+)?plans?\\b",
          "\\b(weekend|schedule|plan)s?\\s+(change[ds]?|changing)",
          "\\bunexpected\\s+changes?\\b",
        ],
        negationRequired: false,
        crossTags: [],
        auContext: false,
      },
      {
        label: "Difficulty transitioning away from preferred activities",
        weight: 1.6,
        source: "parent",
        specificity: "very high",
        ageRange: { min: 18, max: 999, unit: "months" },
        keywords: [
          "transitions away from preferred",
          "transitioning away",
          "extremely difficult to transition",
          "transitions are difficult",
          "ending preferred activities",
          "stopping preferred activities",
          "electronics are turned off",
          "turning off electronics",
          "screen time ending",
          "stopping the iPad",
          "iPad turned off",
        ],
        regex: [
          "\\btransitions?\\s+away\\s+from\\s+preferred\\s+activities",
          "\\bextremely\\s+difficult\\s+(to\\s+)?transition",
          "\\bwhen\\s+(electronics|screens?|iPads?|TVs?|games?)\\s+are\\s+turned\\s+off",
          "\\b(turning|turned)\\s+off\\s+(electronics|the\\s+iPad|the\\s+TV|screens?|games?)",
          "\\b(stopping|ending)\\s+(preferred\\s+)?(activities|screen\\s+time|iPad|games?)",
        ],
        negationRequired: false,
        crossTags: [],
        auContext: false,
      },
      {
        label: "Repetitive reassurance seeking",
        weight: 1.4,
        source: "parent",
        specificity: "high",
        ageRange: { min: 36, max: 999, unit: "months" },
        keywords: [
          "reassurance seeking",
          "seeks reassurance",
          "repetitive reassurance",
          "repeated reassurance",
          "needs reassurance",
          "constantly seeks reassurance",
          "asks for reassurance repeatedly",
        ],
        regex: [
          "\\b(repetitive|repeated|constant|prolonged)\\s+reassurance\\s+seeking\\b",
          "\\bseeks?\\s+reassurance\\s+(repeatedly|constantly|throughout)\\b",
          "\\brequires?\\s+repeated\\s+reassurance\\b",
        ],
        negationRequired: false,
        crossTags: [],
        auContext: false,
      },
      {
        label: "Meltdowns at transitions or activity endings",
        weight: 1.5,
        source: "parent",
        specificity: "very high",
        ageRange: { min: 24, max: 999, unit: "months" },
        keywords: [
          "meltdowns at transitions",
          "meltdown when",
          "yelling crying pacing",
          "slamming doors",
          "throwing objects when",
          "meltdowns involving",
          "regular meltdowns",
        ],
        regex: [
          "\\bmeltdowns?\\s+(involving|at|when|during)\\s+(transitions?|electronics|screen\\s+time|endings?)",
          "\\b(yelling|crying|pacing|slamming\\s+doors?|throwing\\s+objects?)\\s+when",
          "\\bregular\\s+meltdowns?\\b",
        ],
        negationRequired: false,
        crossTags: [],
        auContext: false,
      },
      {
        label: "Prolonged questioning around routines / plans",
        weight: 1.4,
        source: "parent",
        specificity: "high",
        ageRange: { min: 36, max: 999, unit: "months" },
        keywords: [
          "prolonged questioning",
          "questioning around routines",
          "questions about the plan",
          "asks about plans constantly",
          "questions throughout the day",
        ],
        regex: [
          "\\bprolonged\\s+questioning\\b",
          "\\bquestions?\\s+(around|about)\\s+(routines?|plans?|schedules?)\\b",
          "\\bquestioning\\s+(around|about|regarding)\\s+(routines?|plans?|schedules?)",
        ],
        negationRequired: false,
        crossTags: ["B1"],
        auContext: false,
      },
      {
        label: "School holidays / public holidays are a nightmare",
        weight: 1.5,
        source: "parent",
        specificity: "very high",
        ageRange: { min: 36, max: 999, unit: "months" },
        keywords: ["school holidays nightmare", "term breaks difficult", "long weekends hard"],
        regex: ["\\bschool\\s+holidays?\\s+(are\\s+)?(a\\s+nightmare|hard|difficult|dread)\\b", "\\b(public|term)\\s+(holidays?|breaks?)\\s+(are\\s+)?(a\\s+nightmare|hard|difficult)\\b"],
        negationRequired: false,
        crossTags: [],
        auContext: true,
        auContextNote: "Australian school terms create predictable disruption points"
      },
      {
        label: "Substitute teacher = whole day ruined",
        weight: 1.6,
        source: "parent",
        specificity: "very high",
        ageRange: { min: 60, max: 999, unit: "months" },
        keywords: ["substitute teacher day ruined", "relief teacher meltdown", "different teacher disaster"],
        regex: ["\\b(substitute|relief|different)\\s+teachers?\\s+(=|equals?)?\\s*(whole\\s+day\\s+ruined|disaster|meltdown|day\\s+is\\s+ruined)"],
        negationRequired: false,
        crossTags: [],
        auContext: true,
        auContextNote: "Relief teacher = Australian term for substitute teacher"
      },
      {
        label: "Picked up late = hell to pay / can't deviate from pickup time",
        weight: 1.5,
        source: "parent",
        specificity: "very high",
        ageRange: { min: 36, max: 999, unit: "months" },
        keywords: ["late pickup meltdown", "five minutes late hell to pay", "must be on time"],
        regex: ["\\b(picked\\s+up|pickup)\\s+(late|even\\s+\\d+\\s+minutes?\\s+late)\\s+(=|equals?|there's?)\\s*(hell\\s+to\\s+pay|meltdown|disaster)\\b"],
        negationRequired: false,
        crossTags: [],
        auContext: false
      },
      {
        label: "Has to do morning / bedtime routine in same order",
        weight: 1.4,
        source: "parent",
        specificity: "high",
        ageRange: { min: 24, max: 999, unit: "months" },
        keywords: ["morning routine same order", "bedtime routine same order", "specific order"],
        regex: ["\\b(morning|bedtime|bath|dressing)\\s+routine\\s+(in\\s+)?(the\\s+)?same\\s+order\\b", "\\b(has\\s+to\\s+do\\s+things|does\\s+everything)\\s+in\\s+(the\\s+)?same\\s+order\\b"],
        negationRequired: false,
        crossTags: ["B1"],
        auContext: false
      },
      {
        label: "Has to count steps / touch every fence post / specific number rituals",
        weight: 1.6,
        source: "parent",
        specificity: "very high",
        ageRange: { min: 36, max: 999, unit: "months" },
        keywords: ["counts steps", "touches every fence post", "has to do it 3 times"],
        regex: ["\\b(has\\s+to\\s+)?counts?\\s+(the\\s+)?steps\\b", "\\btouches?\\s+every\\s+(fence\\s+post|tree|crack)\\b", "\\b(has\\s+to\\s+do\\s+it|does\\s+it)\\s+\\d+\\s+times\\b"],
        negationRequired: false,
        crossTags: ["B1"],
        auContext: false
      },
      {
        label: "If I forget a word in bedtime routine we have to start again",
        weight: 1.7,
        source: "parent",
        specificity: "very high",
        ageRange: { min: 36, max: 999, unit: "months" },
        keywords: ["start again if forget word", "ritual must be perfect", "exact words bedtime"],
        regex: ["\\bif\\s+I\\s+(forget|miss|skip)\\s+a\\s+word\\b.*\\b(start|do\\s+it)\\s+again\\b", "\\bhas?\\s+to\\s+say\\s+(goodnight|hello|goodbye)\\s+in\\s+a\\s+specific\\s+(order|way|words?)"],
        negationRequired: false,
        crossTags: ["B1"],
        auContext: false,
        note: "Highly specific verbal ritual marker"
      },
      {
        label: "Watches the same Bluey / Peppa episode 200 times",
        weight: 1.5,
        source: "parent",
        specificity: "very high",
        ageRange: { min: 18, max: 999, unit: "months" },
        keywords: ["watches same Bluey episode", "watches same Peppa", "same episode hundreds of times"],
        regex: ["\\bwatches?\\s+the\\s+same\\s+(episode|Bluey|Peppa|Paw\\s+Patrol|movie|YouTube\\s+video)\\s+(\\d+\\s+times|hundreds\\s+of\\s+times|over\\s+and\\s+over)\\b"],
        negationRequired: false,
        crossTags: ["B3"],
        auContext: true,
        auContextNote: "Bluey and Peppa are dominant Australian children's content"
      },
      {
        label: "Reads the same book every night for years",
        weight: 1.5,
        source: "parent",
        specificity: "very high",
        ageRange: { min: 18, max: 999, unit: "months" },
        keywords: ["same book every night", "same bedtime story for years", "same book over and over"],
        regex: ["\\b(reads?|wants?\\s+the\\s+same)\\s+book\\s+(every\\s+night|over\\s+and\\s+over|for\\s+(\\d+\\s+)?(months|years))\\b"],
        negationRequired: false,
        crossTags: ["B3"],
        auContext: false
      },
      {
        label: "Cannot leave the level / episode / video unfinished",
        weight: 1.5,
        source: "parent",
        specificity: "very high",
        ageRange: { min: 36, max: 999, unit: "months" },
        keywords: ["can't stop in the middle", "must finish the episode", "must finish the level", "meltdown if I turn off"],
        regex: ["\\b(cannot|can't|won't)\\s+(stop|leave)\\s+(in\\s+the\\s+)?middle\\b", "\\b(must|has\\s+to)\\s+finish\\s+(the\\s+)?(episode|level|video|movie)\\b", "\\bmeltdowns?\\s+if\\s+I\\s+turn\\s+(it|the\\s+iPad)\\s+off\\b"],
        negationRequired: false,
        crossTags: [],
        auContext: false
      },
      {
        label: "Coming inside / leaving park / getting in/out of bath = meltdown",
        weight: 1.5,
        source: "parent",
        specificity: "very high",
        ageRange: { min: 24, max: 999, unit: "months" },
        keywords: ["leaving park meltdown", "coming inside meltdown", "bath transitions difficult"],
        regex: ["\\b(coming\\s+inside|leaving\\s+(the\\s+)?park|getting\\s+(in|out)\\s+of\\s+(the\\s+)?bath|trampoline)\\s+=?\\s*meltdowns?\\b"],
        negationRequired: false,
        crossTags: [],
        auContext: false
      },
      {
        label: "Hates surprises / Christmas / birthdays are difficult",
        weight: 1.4,
        source: "parent",
        specificity: "high",
        ageRange: { min: 36, max: 999, unit: "months" },
        keywords: ["hates surprises", "Christmas difficult", "birthdays difficult", "too much change"],
        regex: ["\\bhates?\\s+surprises?\\b", "\\b(Christmas|birthdays?|special\\s+occasions?)\\s+(are\\s+)?(difficult|hard|too\\s+much)\\b"],
        negationRequired: false,
        crossTags: [],
        auContext: false
      },
      {
        label: "Asks 'what's next?' / 'what are we doing today?' constantly",
        weight: 1.5,
        source: "parent",
        specificity: "very high",
        ageRange: { min: 36, max: 999, unit: "months" },
        keywords: ["asks what's next constantly", "asks what are we doing", "needs to know the plan"],
        regex: ["\\basks?\\s+['\"]?what'?s?\\s+next['\"]?\\s+(constantly|all\\s+the\\s+time|repeatedly)", "\\basks?\\s+['\"]?what\\s+are\\s+we\\s+doing(\\s+today)?['\"]?\\b", "\\bneeds?\\s+to\\s+know\\s+the\\s+plan\\b"],
        negationRequired: false,
        crossTags: ["B1"],
        auContext: false
      },
      {
        label: "Refuses new clothes / shoes / seasonal changes / wears same shirt",
        weight: 1.4,
        source: "parent",
        specificity: "high",
        ageRange: { min: 24, max: 999, unit: "months" },
        keywords: ["refuses new clothes", "won't wear new shoes", "wears same shirt every day"],
        regex: ["\\b(refuses?|won't)\\s+(wear|put\\s+on)\\s+new\\s+(clothes?|shoes?)\\b", "\\bwears?\\s+(the\\s+)?same\\s+(shirt|outfit|clothes?)\\s+every\\s+day\\b", "\\brefuses?\\s+seasonal\\s+(clothing|changes?)\\b"],
        negationRequired: false,
        crossTags: ["B4"],
        auContext: false
      }
    ]
  },
  {
    domain: "B3 Restricted/fixated interests",
    code: "B3",
    criterion: "Highly restricted, fixated interests abnormal in intensity or focus",
    criterionGroup: "B",
    dsmReference: "DSM-5-TR 299.00 Criterion B3",
    severityWeight: 1.18,
    detectionStrategy: "presence-dominant",
    markers: [
      // ============================================================
      // CLINICIAN
      // ============================================================
      {
        label: "Restricted / circumscribed / fixated interests",
        weight: 1.4,
        source: "clinician",
        specificity: "high",
        ageRange: { min: 24, max: 999, unit: "months" },
        keywords: ["restricted interests", "circumscribed interests", "fixated interests", "perseverative interests"],
        regex: ["\\b(restricted|circumscribed|fixated|perseverative|narrow)\\s+interests?\\b"],
        negationRequired: false,
        crossTags: [],
        auContext: false
      },
      {
        label: "Abnormal intensity / focus of interest",
        weight: 1.5,
        source: "clinician",
        specificity: "very high",
        ageRange: { min: 24, max: 999, unit: "months" },
        keywords: ["abnormal intensity of interest", "abnormal focus of interest", "all-consuming interest"],
        regex: ["\\babnormal\\s+(intensity|focus)\\s+of\\s+interest\\b", "\\ball[-\\s]?consuming\\s+interest\\b"],
        negationRequired: false,
        crossTags: [],
        auContext: false
      },
      {
        label: "Encyclopaedic knowledge of [topic]",
        weight: 1.5,
        source: "clinician",
        specificity: "very high",
        ageRange: { min: 48, max: 999, unit: "months" },
        keywords: ["encyclopaedic knowledge", "encyclopedic knowledge", "expert-level knowledge"],
        regex: ["\\b(encyclop[ae]dic|expert[-\\s]?level|exhaustive)\\s+knowledge\\b"],
        negationRequired: false,
        crossTags: [],
        auContext: false
      },
      {
        label: "Strong / unusual attachment to objects",
        weight: 1.5,
        source: "clinician",
        specificity: "very high",
        ageRange: { min: 12, max: 999, unit: "months" },
        keywords: ["unusual attachment to objects", "strong attachment to unusual objects", "carries object everywhere"],
        regex: ["\\b(unusual|strong|abnormal)\\s+attachment\\s+to\\s+(unusual\\s+)?objects?\\b", "\\bcarries?\\s+\\w+\\s+everywhere\\b"],
        negationRequired: false,
        crossTags: [],
        auContext: false
      },
      {
        label: "Conversation dominated by special interest",
        weight: 1.6,
        source: "clinician",
        specificity: "very high",
        ageRange: { min: 48, max: 999, unit: "months" },
        keywords: ["conversation dominated by interest", "monologues on special interest", "all conversations return to"],
        regex: ["\\bconversations?\\s+dominated\\s+by\\s+(special\\s+)?interest\\b", "\\bmonologu\\w*\\s+on\\s+(special\\s+)?interest\\b"],
        negationRequired: false,
        crossTags: ["A1"],
        auContext: false
      },
      {
        label: "Interest interferes with functioning / school participation / sleep",
        weight: 1.6,
        source: "clinician",
        specificity: "very high",
        ageRange: { min: 48, max: 999, unit: "months" },
        keywords: ["interest interferes with functioning", "interferes with school", "interferes with sleep"],
        regex: ["\\binterests?\\s+interferes?\\s+with\\s+(functioning|school|sleep|eating|peer\\s+interaction)"],
        negationRequired: false,
        crossTags: ["IMPAIRMENT"],
        auContext: false
      },
      {
        label: "Hoarding / collecting behaviours",
        weight: 1.4,
        source: "clinician",
        specificity: "high",
        ageRange: { min: 36, max: 999, unit: "months" },
        keywords: ["hoarding behaviours", "collecting behaviours", "categorisation of interest"],
        regex: ["\\b(hoarding|collecting|categoris(ing|ation))\\s+behaviours?\\b"],
        negationRequired: false,
        crossTags: ["B1"],
        auContext: false
      },
      {
        label: "Age-atypical / adult-level interests in child",
        weight: 1.5,
        source: "clinician",
        specificity: "very high",
        ageRange: { min: 36, max: 999, unit: "months" },
        keywords: ["age-atypical interests", "adult-level interests in child", "developmentally inappropriate interests"],
        regex: ["\\b(age[-\\s]?atypical|adult[-\\s]?level|developmentally\\s+(in)?appropriate)\\s+interests?\\b"],
        negationRequired: false,
        crossTags: [],
        auContext: false
      },

      {
        label: "All-consuming / intense interests interfering across contexts",
        weight: 1.65,
        source: "parent",
        specificity: "very high",
        ageRange: { min: 36, max: 999, unit: "months" },
        keywords: ["all consuming", "dominates play and conversation", "numerous intense interests"],
        regex: [
          "\\ball[-\\s]?consum\\w*\\b",
          "\\b(numerous|multiple|several)\\s+(intense|highly\\s+specific)\\s+interests?\\b",
          "\\binterests?\\s+(have\\s+)?dominated\\s+(play\\s+and\\s+)?conversation\\b",
        ],
        negationRequired: false,
        crossTags: ["IMPAIRMENT"],
        auContext: false,
      },

      {
        label: "Conversation redirect unsuccessful / perseveration on factual interest content",
        weight: 1.65,
        source: "clinician",
        specificity: "very high",
        ageRange: { min: 48, max: 999, unit: "months" },
        keywords: ["redirect unsuccessful", "could not redirect", "returned to topic", "correcting factual details"],
        regex: [
          "\\b(attempts?\\s+to\\s+)?redirect\\b.*\\b(often\\s+)?unsuccessful\\b",
          "\\b(unable\\s+to\\s+redirect|difficult\\s+to\\s+interrupt|won'?t\\s+drop\\s+the\\s+topic)\\b",
          "\\b(return(s|ed|ing)?|brought)\\s+(discussion\\s+)?back\\s+to\\s+(preferred\\s+)?(topic|interest)\\b",
          "\\b(corrects?|interrupts?\\s+to\\s+correct)\\s+(factual\\s+)?(details?|errors?|information)\\b",
          "\\bdominates?\\s+conversation\\s+with\\s+(factual\\s+)?(content|details?)\\b",
        ],
        negationRequired: false,
        crossTags: ["A1"],
        auContext: false,
      },
      // ============================================================
      // PARENT — INTEREST INTENSITY
      // ============================================================
      {
        label: "Obsessed with [trains / transport / military / coding / factual systems / Pokémon / Minecraft / Roblox / Bluey]",
        weight: 1.55,
        source: "parent",
        specificity: "very high",
        ageRange: { min: 24, max: 999, unit: "months" },
        keywords: ["obsessed with trains", "obsessed with dinosaurs", "obsessed with Pokémon", "obsessed with Minecraft", "obsessed with Roblox", "obsessed with Bluey"],
        regex: ["\\bobsessed\\s+with\\s+(trains?|train\\s+systems?|timetables?|public\\s+transport|military\\s+aircraft|fighter\\s+jets?|wars?|battles?|historical\\s+wars?|dinosaurs?|Pok[eé]mon|Minecraft|Roblox|Bluey|Paw\\s+Patrol|horses?|sharks?|space|flags?|world\\s+flags?|capitals?|elevators?|lifts?|vacuum(?:\\s+cleaners?)?|coding|programming|software\\s+architecture|gaming\\s+hardware|GPUs?|PC\\s+builds?|Star\\s+Wars|Marvel|Harry\\s+Potter|K[-\\s]?pop|anime|cars?|trucks?|trams?|buses|tube\\s+map|rolling\\s+stock)\\b"],
        negationRequired: false,
        crossTags: [],
        auContext: true,
        auContextNote: "Bluey, AFL teams are Australian-specific common interests"
      },
      {
        label: "It's all he talks about / all she thinks about",
        weight: 1.5,
        source: "parent",
        specificity: "very high",
        ageRange: { min: 36, max: 999, unit: "months" },
        keywords: ["all he talks about", "all she thinks about", "every conversation comes back to"],
        regex: ["\\b(it's\\s+|that's\\s+)?all\\s+(he|she|they)\\s+(talks?\\s+about|thinks?\\s+about)\\b", "\\bevery\\s+conversation\\s+comes?\\s+back\\s+to\\b"],
        negationRequired: false,
        crossTags: ["A1"],
        auContext: false
      },
      {
        label: "Knows everything about [topic] / knows more than the experts",
        weight: 1.5,
        source: "parent",
        specificity: "very high",
        ageRange: { min: 48, max: 999, unit: "months" },
        keywords: ["knows everything about", "knows more than the experts", "encyclopaedic knowledge"],
        regex: ["\\bknows?\\s+(everything|more\\s+than\\s+(the\\s+)?experts?|every\\s+(fact|detail))\\b"],
        negationRequired: false,
        crossTags: [],
        auContext: false
      },
      {
        label: "Memorised every Pokémon / dinosaur / train / flag",
        weight: 1.6,
        source: "parent",
        specificity: "very high",
        ageRange: { min: 36, max: 999, unit: "months" },
        keywords: ["memorised every Pokémon", "memorised every dinosaur", "knows every flag", "knows every capital"],
        regex: ["\\b(memorised|knows?)\\s+every\\s+(Pok[eé]mon|dinosaur|train|flag|capital|car\\s+model|country|state|AFL\\s+team)"],
        negationRequired: false,
        crossTags: [],
        auContext: true,
        auContextNote: "AFL teams in Australian context"
      },
      {
        label: "Can recite the train timetable / road signs / supermarket layout",
        weight: 1.7,
        source: "parent",
        specificity: "very high",
        ageRange: { min: 36, max: 999, unit: "months" },
        keywords: ["recites train timetable", "knows road signs", "knows supermarket layout"],
        regex: ["\\b(recites?|knows?)\\s+the\\s+(train\\s+timetable|bus\\s+timetable|road\\s+signs?|supermarket\\s+layout|aisle\\s+numbers?)"],
        negationRequired: false,
        crossTags: [],
        auContext: false,
        note: "Highly specific unusual-content interest"
      },
      {
        label: "Watches the same documentary / YouTube channel for hours",
        weight: 1.5,
        source: "parent",
        specificity: "very high",
        ageRange: { min: 36, max: 999, unit: "months" },
        keywords: ["watches same documentary", "same YouTube channel for hours", "obsessed with one channel"],
        regex: ["\\bwatches?\\s+(the\\s+)?same\\s+(documentary|YouTube\\s+channel|video|playlist)\\s+for\\s+hours\\b", "\\bonly\\s+watches?\\s+(videos?|YouTube)\\s+about\\s+\\w+"],
        negationRequired: false,
        crossTags: ["B2"],
        auContext: false
      },
      {
        label: "Only reads books / draws / writes about [topic]",
        weight: 1.5,
        source: "parent",
        specificity: "very high",
        ageRange: { min: 48, max: 999, unit: "months" },
        keywords: ["only reads about", "only draws", "only writes about"],
        regex: ["\\bonly\\s+(reads?\\s+books?|draws?|writes?)\\s+(about\\s+)?\\w+"],
        negationRequired: false,
        crossTags: [],
        auContext: false
      },
      {
        label: "Won't engage with anything else / refuses non-preferred topics",
        weight: 1.5,
        source: "parent",
        specificity: "very high",
        ageRange: { min: 48, max: 999, unit: "months" },
        keywords: ["won't engage with anything else", "refuses to learn anything else", "only interested in"],
        regex: ["\\b(won't|refuses?\\s+to)\\s+(engage|learn|do)\\s+(with\\s+)?anything\\s+(else|not\\s+related)", "\\bonly\\s+interested\\s+in\\b"],
        negationRequired: false,
        crossTags: ["IMPAIRMENT"],
        auContext: false
      },
      {
        label: "Has to bring [object] everywhere",
        weight: 1.5,
        source: "parent",
        specificity: "very high",
        ageRange: { min: 18, max: 999, unit: "months" },
        keywords: ["brings object everywhere", "won't leave without", "carries everywhere"],
        regex: ["\\b(has\\s+to\\s+bring|brings?|carries?)\\s+\\w+\\s+everywhere\\b", "\\bwon't\\s+(leave|go)\\s+(anywhere\\s+)?without\\b"],
        negationRequired: false,
        crossTags: [],
        auContext: false
      },
      {
        label: "Sleeps with unusual object — vacuum cleaner part / specific stick",
        weight: 1.7,
        source: "parent",
        specificity: "very high",
        ageRange: { min: 24, max: 999, unit: "months" },
        keywords: ["sleeps with unusual object", "sleeps with vacuum part", "specific stick"],
        regex: ["\\bsleeps?\\s+with\\s+(an?\\s+)?(unusual\\s+|specific\\s+|particular\\s+)?(vacuum\\s+(cleaner\\s+)?part|specific\\s+stick|hose|tube|particular\\s+\\w+)"],
        negationRequired: false,
        crossTags: [],
        auContext: false,
        note: "Pathognomonic when the attachment is to an unusual non-comfort object"
      },
      {
        label: "Collection of [bottle caps / rocks / sticks / Bluey figurines / specific items]",
        weight: 1.4,
        source: "parent",
        specificity: "high",
        ageRange: { min: 24, max: 999, unit: "months" },
        keywords: ["collection of", "collects bottle caps", "collects rocks"],
        regex: ["\\bcollection\\s+of\\s+(bottle\\s+caps|rocks|sticks|Bluey\\s+figurines|Pok[eé]mon\\s+cards|specific\\s+\\w+)"],
        negationRequired: false,
        crossTags: ["B1"],
        auContext: false
      },
      {
        label: "Special interest / hyperfixation (parent uses term)",
        weight: 1.5,
        source: "parent",
        specificity: "very high",
        ageRange: { min: 60, max: 999, unit: "months" },
        keywords: ["special interest", "hyperfixation", "current obsession", "his thing is"],
        regex: ["\\b(special\\s+interest|hyperfixation|current\\s+obsession)\\b", "\\b(his|her|their)\\s+thing\\s+is\\b"],
        negationRequired: false,
        crossTags: [],
        auContext: false,
        note: "When parents use clinical terms autonomously, often indicates community familiarity"
      },
      {
        label: "Goes through phases of obsession — Thomas → Pokémon → Minecraft",
        weight: 1.4,
        source: "parent",
        specificity: "high",
        ageRange: { min: 36, max: 999, unit: "months" },
        keywords: ["goes through phases", "was Thomas then Pokémon", "phases of obsession"],
        regex: ["\\bgoes?\\s+through\\s+phases?\\b", "\\bwas\\s+\\w+\\s+then\\s+\\w+\\b", "\\bphases?\\s+of\\s+obsession\\b"],
        negationRequired: false,
        crossTags: [],
        auContext: false
      },

      {
        label: "Multiple circumscribed interests enumerated (3+ specific topics)",
        weight: 1.6,
        source: "parent",
        specificity: "very high",
        ageRange: { min: 60, max: 999, unit: "months" },
        keywords: [],
        regex: [
          "\\b(military\\s+aircraft|historical\\s+battles?|trains?\\s+systems?|gaming\\s+(hardware|systems?)|coding|programming|dinosaurs?|space|astronomy|world\\s+flags?|maps?|elevators?|vacuum\\s+cleaners?|Pok[eé]mon|Minecraft|Roblox|YuGiOh|Magic\\s+the\\s+Gathering|chess|Rubik'?s\\s+cube|weather|earthquakes?|volcanoes?|sharks?|insects?|dog\\s+breeds?|car\\s+models?|aircraft|tanks?|guns?|weapons|history|World\\s+War|Roman\\s+(Empire|history)|Egyptology|periodic\\s+table|chemistry|physics|engineering|architecture)(.{1,80}?(military\\s+aircraft|historical\\s+battles?|trains?\\s+systems?|gaming\\s+(hardware|systems?)|coding|programming|dinosaurs?|space|astronomy|world\\s+flags?|maps?|elevators?|vacuum\\s+cleaners?|Pok[eé]mon|Minecraft|Roblox|chess|weather|sharks?|insects?|dog\\s+breeds?|car\\s+models?|aircraft|tanks?|history|World\\s+War|Roman|chemistry|physics|engineering)){2,}",
        ],
        negationRequired: false,
        crossTags: [],
        auContext: false,
      },
      {
        label: "Interests described as all-consuming / dominate conversation",
        weight: 1.5,
        source: "parent",
        specificity: "very high",
        ageRange: { min: 48, max: 999, unit: "months" },
        keywords: [
          "all consuming",
          "all-consuming",
          "dominates conversation",
          "dominate conversation",
          "dominates topics",
          "dominate topics",
          "dominates daily life",
          "can't talk about anything else",
          "only wants to talk about",
          "obsessed with",
          "consumed by interest",
        ],
        regex: [
          "\\b(all|highly)\\s*[-\\s]?consuming\\b",
          "\\bdominate(s|d)?\\s+(conversation|topics?|daily\\s+life|home|interactions)\\b",
          "\\bcan(no|')t\\s+talk\\s+about\\s+anything\\s+else\\b",
          "\\bonly\\s+(wants?|likes?)\\s+to\\s+talk\\s+about\\b",
          "\\bobsessed\\s+with\\b",
          "\\bconsumed\\s+by\\s+(interest|topic|hobby)\\b",
        ],
        negationRequired: false,
        crossTags: [],
        auContext: false,
      },
      {
        label: "Encyclopaedic / depth-of-knowledge on specific topics",
        weight: 1.4,
        source: "observation",
        specificity: "high",
        ageRange: { min: 60, max: 999, unit: "months" },
        keywords: [
          "encyclopaedic knowledge",
          "encyclopedic knowledge",
          "memorises facts",
          "memorizes facts",
          "memorises detailed",
          "memorizes detailed",
          "knows every",
          "knows everything about",
          "extensive factual knowledge",
          "factual depth",
          "corrects me on details",
          "corrects others on facts",
        ],
        regex: [
          "\\bencyclopa?edic\\s+knowledge\\b",
          "\\bmemoris(es|ed)?\\s+(facts|details|information)\\b",
          "\\bmemoriz(es|ed)?\\s+(facts|details|information)\\b",
          "\\bknows?\\s+(every|everything\\s+about)\\b",
          "\\bextensive\\s+factual\\s+knowledge\\b",
          "\\bcorrect(s|ing|ed)\\s+(me|mum|dad|mother|father|others|teacher)\\s+(on|about)\\s+(facts|details)\\b",
        ],
        negationRequired: false,
        crossTags: [],
        auContext: false,
      },
      {
        label: "Special-interest fluency contrast (more articulate when on topic)",
        weight: 1.3,
        source: "observation",
        specificity: "moderate",
        ageRange: { min: 60, max: 999, unit: "months" },
        keywords: [
          "more fluent when discussing",
          "more animated when discussing",
          "comes alive when talking about",
          "lights up when",
          "different person when discussing",
          "speech became more fluent",
          "engaged when discussing",
        ],
        regex: [
          "\\bmore\\s+(fluent|animated|engaged|articulate)\\s+(when|while)\\s+(discussing|talking\\s+about)\\b",
          "\\bcomes?\\s+alive\\s+(when|talking\\s+about)\\b",
          "\\blights?\\s+up\\s+(when|talking\\s+about|on\\s+the\\s+subject)\\b",
          "\\bdifferent\\s+person\\s+when\\s+(discussing|talking\\s+about)\\b",
          "\\bspeech\\s+became\\s+(more\\s+)?(fluent|animated)\\b",
        ],
        negationRequired: false,
        crossTags: [],
        auContext: false,
      },

      // ============================================================
      // CHILD SELF-REPORT
      // ============================================================
      {
        label: "I love [topic] / it's my special interest",
        weight: 1.4,
        source: "child",
        specificity: "high",
        ageRange: { min: 84, max: 999, unit: "months" },
        keywords: ["it's my special interest", "I love", "I'm hyperfixated"],
        regex: ["\\bit'?s\\s+my\\s+special\\s+interest\\b", "\\bI'm\\s+hyperfixated\\b", "\\bI\\s+could\\s+talk\\s+about\\s+it\\s+forever\\b"],
        negationRequired: false,
        crossTags: [],
        auContext: false
      },
      {
        label: "Other things are boring / I don't care about anything else",
        weight: 1.5,
        source: "child",
        specificity: "very high",
        ageRange: { min: 84, max: 999, unit: "months" },
        keywords: ["other things are boring", "don't care about anything else", "only this matters"],
        regex: ["\\bother\\s+things?\\s+are\\s+boring\\b", "\\b(don't|do\\s+not)\\s+care\\s+about\\s+anything\\s+else\\b"],
        negationRequired: false,
        crossTags: [],
        auContext: false
      },

      // ============================================================
      // CLINIC OBSERVATIONS
      // ============================================================
      {
        label: "Brought interest item to assessment / wore interest-themed clothing",
        weight: 1.4,
        source: "observation",
        specificity: "high",
        ageRange: { min: 36, max: 999, unit: "months" },
        keywords: ["brought interest item", "wore interest-themed clothing", "Pokémon shirt"],
        regex: ["\\bbrought\\s+(interest|special\\s+interest)\\s+item\\b", "\\bwore\\s+(interest[-\\s]?themed|Pok[eé]mon|Minecraft|Bluey)\\s+(clothing|shirt|hat)"],
        negationRequired: false,
        crossTags: [],
        auContext: false
      },
      {
        label: "Demonstrated encyclopaedic knowledge during free conversation",
        weight: 1.6,
        source: "observation",
        specificity: "very high",
        ageRange: { min: 48, max: 999, unit: "months" },
        keywords: ["encyclopaedic knowledge demonstrated", "expert-level facts", "exhaustive recall"],
        regex: ["\\bdemonstrated\\s+encyclop[ae]dic\\s+knowledge\\b", "\\bexpert[-\\s]?level\\s+facts\\s+(during|in)\\s+(free\\s+)?conversation\\b"],
        negationRequired: false,
        crossTags: [],
        auContext: false
      },
      {
        label: "Animated / regulated when discussing interest, dysregulated when not",
        weight: 1.7,
        source: "observation",
        specificity: "very high",
        ageRange: { min: 36, max: 999, unit: "months" },
        keywords: ["animated when discussing interest", "regulated by interest", "dysregulated when interest not discussed"],
        regex: ["\\b(animated|regulated|engaged)\\s+when\\s+discussing\\s+interest\\b", "\\bdysregulated?\\s+when\\s+interest\\s+not\\s+discussed\\b"],
        negationRequired: false,
        crossTags: [],
        auContext: false,
        note: "Highly specific clinical observation - selective engagement"
      },

      // ============================================================
      // DEVELOPMENTAL HISTORY
      // ============================================================
      {
        label: "Was obsessed with [washing machines / fans / lights / wheels] as a baby",
        weight: 1.7,
        source: "history",
        specificity: "very high",
        ageRange: { min: 6, max: 36, unit: "months", retrospective: true },
        keywords: ["obsessed with fans as a baby", "washing machines as a baby", "obsessed with lights"],
        regex: ["\\b(was\\s+)?obsessed\\s+with\\s+(washing\\s+machines?|fans?|ceiling\\s+fans?|lights?|wheels?|spinning\\s+things)\\s+(as\\s+a\\s+baby|when\\s+younger|from\\s+infancy)"],
        negationRequired: false,
        crossTags: ["B1", "B4"],
        auContext: false,
        note: "Pathognomonic early developmental marker"
      },
      {
        label: "Hyperlexia — reading before he could speak in sentences",
        weight: 1.7,
        source: "history",
        specificity: "very high",
        ageRange: { min: 18, max: 60, unit: "months", retrospective: true },
        keywords: ["hyperlexia", "reading before speaking", "knew alphabet at 18 months"],
        regex: ["\\bhyperlexia\\b", "\\breading\\s+before\\s+(he|she|they)\\s+could\\s+speak\\b", "\\bknew\\s+(the\\s+)?alphabet\\s+(at|by)\\s+\\d+\\s+months\\b"],
        negationRequired: false,
        crossTags: ["B1"],
        auContext: false,
        note: "Highly specific ASD profile marker"
      },
      {
        label: "Memorised whole books before age 2",
        weight: 1.6,
        source: "history",
        specificity: "very high",
        ageRange: { min: 12, max: 30, unit: "months", retrospective: true },
        keywords: ["memorised whole books", "knew books by heart"],
        regex: ["\\bmemorised\\s+(whole\\s+)?books?\\s+(before|by)\\s+(age\\s+)?2\\b", "\\bknew\\s+books?\\s+by\\s+heart\\b"],
        negationRequired: false,
        crossTags: ["B1"],
        auContext: false
      }
    ]
  },
  {
    domain: "B4 Sensory processing",
    code: "B4",
    criterion: "Hyper- or hyporeactivity to sensory input or unusual interest in sensory aspects",
    criterionGroup: "B",
    dsmReference: "DSM-5-TR 299.00 Criterion B4",
    severityWeight: 1.2,
    detectionStrategy: "presence-dominant",
    markers: [
      // ============================================================
      // AUDITORY HYPERREACTIVITY
      // ============================================================
      {
        label: "Auditory hypersensitivity / hyperreactivity",
        weight: 1.5,
        source: "clinician",
        specificity: "very high",
        ageRange: { min: 6, max: 999, unit: "months" },
        keywords: ["auditory hypersensitivity", "auditory hyperreactivity", "hyperacusis"],
        regex: ["\\b(auditory|sound)\\s+(hypersensitivity|hyperreactivity)\\b", "\\bhyperacusis\\b"],
        negationRequired: false,
        crossTags: [],
        auContext: false
      },
      {
        label: "Covers ears at loud sounds / specific sounds",
        weight: 1.5,
        source: "clinician",
        specificity: "very high",
        ageRange: { min: 6, max: 999, unit: "months" },
        keywords: [
          "covers ears",
          "ears covered at loud sounds",
          "blocks ears",
          "covering ears",
          "covered ears",
          "ears covered",
          "auditory sensitivity",
          "marked auditory sensitivity",
          "noise sensitivity",
        ],
        regex: [
          "\\bcovers?\\s+(his|her|their)?\\s*ears?\\b",
          "\\bblocks?\\s+(his|her|their)?\\s*ears?\\b",
          "\\b(covers?|covering|covered|blocks?|blocking)\\s+(his|her|their)?\\s*ears?\\b",
          "\\b(marked|significant|severe)\\s+auditory\\s+sensitivity\\b",
          "\\bcovering\\s+ears\\s+(during|at|when)\\b",
        ],
        negationRequired: false,
        crossTags: ["IMPAIRMENT"],
        auContext: false
      },
      {
        label: "Covers ears at loud sounds (assemblies, blenders, vacuums, hand dryers, public toilets)",
        weight: 1.6,
        source: "parent",
        specificity: "very high",
        ageRange: { min: 6, max: 999, unit: "months" },
        keywords: [
          "covering ears",
          "covers ears",
          "covered ears",
          "ears covered",
          "blocks ears",
          "auditory sensitivity",
          "marked auditory sensitivity",
          "noise sensitivity",
        ],
        regex: [
          "\\b(covers?|covering|covered|blocks?|blocking)\\s+(his|her|their)?\\s*ears?\\b",
          "\\b(marked|significant|severe)\\s+auditory\\s+sensitivity\\b",
          "\\bcovering\\s+ears\\s+(during|at|when)\\b",
        ],
        negationRequired: false,
        crossTags: ["IMPAIRMENT"],
        auContext: false
      },
      {
        label: "Cannot tolerate vacuum / hair dryer / blender / lawn mower",
        weight: 1.6,
        source: "parent",
        specificity: "very high",
        ageRange: { min: 6, max: 999, unit: "months" },
        keywords: ["hates the vacuum", "screams at blender", "hair dryer distress", "lawn mower"],
        regex: ["\\b(hates?|screams?\\s+at|cannot\\s+tolerate|distressed?\\s+by)\\s+(the\\s+)?(vacuum|hair\\s+dryer|hairdryer|blender|lawn\\s+mower|whipper\\s+snipper|leaf\\s+blower)"],
        negationRequired: false,
        crossTags: [],
        auContext: true,
        auContextNote: "Whipper snipper = Australian term for line trimmer/strimmer"
      },
      {
        label: "Distress with school bell / fire alarm / assembly hall / hand dryers",
        weight: 1.6,
        source: "parent",
        specificity: "very high",
        ageRange: { min: 36, max: 999, unit: "months" },
        keywords: ["school bell distress", "fire alarm distress", "assembly hall", "hand dryers"],
        regex: ["\\b(distressed?\\s+by|hates?|cannot\\s+tolerate|screams?\\s+at)\\s+(the\\s+)?(school\\s+bell|fire\\s+alarm|fire\\s+drill|assembly|hand\\s+dryers?|public\\s+toilets?|assemblies?)\\b"],
        negationRequired: false,
        crossTags: ["IMPAIRMENT"],
        auContext: true,
        auContextNote: "School bells and fire drills are standard Australian school environment triggers"
      },
      {
        label: "Cannot go to Bunnings / Coles / Westfield / shopping centres",
        weight: 1.7,
        source: "parent",
        specificity: "very high",
        ageRange: { min: 24, max: 999, unit: "months" },
        keywords: ["can't go to Bunnings", "can't go to Coles", "shopping centres too loud", "can't do Westfield"],
        regex: ["\\b(can't|cannot|won't)\\s+go\\s+to\\s+(Bunnings|Coles|Woolworths|Westfield|IKEA|shopping\\s+centres?|the\\s+shops?|Aldi|Kmart|Big\\s+W)"],
        negationRequired: false,
        crossTags: ["IMPAIRMENT"],
        auContext: true,
        auContextNote: "Pathognomonic Australian retail context — Bunnings/Coles/Westfield are universal AU triggers"
      },
      {
        label: "Wears noise-cancelling headphones to school / shops / cinema",
        weight: 1.6,
        source: "parent",
        specificity: "very high",
        ageRange: { min: 24, max: 999, unit: "months" },
        keywords: ["noise-cancelling headphones", "wears headphones to school", "ear defenders"],
        regex: ["\\b(noise[-\\s]?cancelling|noise[-\\s]?cancelling)\\s+headphones?\\b", "\\bear\\s+defenders?\\b", "\\bwears?\\s+headphones?\\s+(to\\s+)?(school|shops?|cinema|movies)"],
        negationRequired: false,
        crossTags: [],
        auContext: false
      },
      {
        label: "Hates birthday parties / cinema / clapping / Happy Birthday song",
        weight: 1.5,
        source: "parent",
        specificity: "very high",
        ageRange: { min: 24, max: 999, unit: "months" },
        keywords: ["hates birthday parties", "hates cinema", "hates clapping", "hates Happy Birthday"],
        regex: ["\\bhates?\\s+(birthday\\s+parties|the\\s+cinema|the\\s+movies|clapping|singing\\s+Happy\\s+Birthday|Happy\\s+Birthday\\s+song)"],
        negationRequired: false,
        crossTags: [],
        auContext: false
      },
      {
        label: "Hears things others can't / notices sounds nobody else does",
        weight: 1.6,
        source: "parent",
        specificity: "very high",
        ageRange: { min: 36, max: 999, unit: "months" },
        keywords: ["hears things I can't", "notices sounds nobody else does", "hears the fridge buzzing"],
        regex: ["\\bhears?\\s+(things|sounds)\\s+(I|we|others)\\s+can't\\b", "\\bnotices?\\s+sounds?\\s+(nobody|no\\s+one)\\s+(else\\s+)?does\\b", "\\bhears?\\s+the\\s+(fridge|air\\s+con(ditioning)?|buzz)\\s+from\\s+(the\\s+)?(next\\s+room|down\\s+the\\s+hall)"],
        negationRequired: false,
        crossTags: [],
        auContext: false
      },
      {
        label: "Misophonia features — distress with chewing / breathing / sniffing",
        weight: 1.5,
        source: "clinician",
        specificity: "very high",
        ageRange: { min: 60, max: 999, unit: "months" },
        keywords: ["misophonia", "hates chewing sounds", "distress with breathing"],
        regex: ["\\bmisophonia\\b", "\\bhates?\\s+(chewing|breathing|sniffing|swallowing)\\s+sounds\\b", "\\bdistress\\s+(with|at)\\s+(chewing|breathing|sniffing)\\b"],
        negationRequired: false,
        crossTags: [],
        auContext: false
      },

      // ============================================================
      // AUDITORY HYPOREACTIVITY
      // ============================================================
      {
        label: "Auditory hyporeactivity / appears not to hear",
        weight: 1.5,
        source: "clinician",
        specificity: "very high",
        ageRange: { min: 6, max: 999, unit: "months" },
        keywords: ["auditory hyporeactivity", "appears not to hear", "doesn't respond to sounds"],
        regex: ["\\b(auditory|sound)\\s+hyporeactivity\\b", "\\bappears?\\s+not\\s+to\\s+hear\\b", "\\bdoesn't\\s+(orient\\s+to|respond\\s+to)\\s+(environmental\\s+)?sounds?\\b"],
        negationRequired: false,
        crossTags: ["A2"],
        auContext: false
      },

      // ============================================================
      // VISUAL
      // ============================================================
      {
        label: "Visual hypersensitivity / light sensitivity",
        weight: 1.4,
        source: "clinician",
        specificity: "high",
        ageRange: { min: 12, max: 999, unit: "months" },
        keywords: ["visual hypersensitivity", "light sensitivity", "photophobia"],
        regex: ["\\b(visual|light)\\s+(hypersensitivity|sensitivity)\\b", "\\bphotophobia\\b"],
        negationRequired: false,
        crossTags: [],
        auContext: false
      },
      {
        label: "Squints / shields eyes / wears sunglasses indoors",
        weight: 1.5,
        source: "parent",
        specificity: "very high",
        ageRange: { min: 24, max: 999, unit: "months" },
        keywords: ["wears sunglasses inside", "squints in fluorescent lighting", "shields eyes"],
        regex: ["\\bwears?\\s+sunglasses?\\s+(inside|indoors)\\b", "\\bsquints?\\s+(in\\s+)?fluorescent\\s+lights?\\b", "\\bshields?\\s+(his|her|their)?\\s*eyes\\b"],
        negationRequired: false,
        crossTags: [],
        auContext: false
      },
      {
        label: "Hates the school lights / fluorescent lights",
        weight: 1.4,
        source: "parent",
        specificity: "high",
        ageRange: { min: 36, max: 999, unit: "months" },
        keywords: ["hates school lights", "hates fluorescent lights"],
        regex: ["\\bhates?\\s+(the\\s+)?(school\\s+lights?|fluorescent\\s+lights?|overhead\\s+lights?)\\b"],
        negationRequired: false,
        crossTags: [],
        auContext: false
      },
      {
        label: "Visual fascination — stares at ceiling fan / lights / spinning things",
        weight: 1.6,
        source: "parent",
        specificity: "very high",
        ageRange: { min: 6, max: 999, unit: "months" },
        keywords: ["stares at ceiling fan", "watches lights", "mesmerised by lights", "loves Christmas lights"],
        regex: ["\\b(stares?|watches?|mesmerised\\s+by)\\s+(the\\s+)?(ceiling\\s+fan|lights?|spinning\\s+things?|fairy\\s+lights?|Christmas\\s+lights?)"],
        negationRequired: false,
        crossTags: ["B3"],
        auContext: false
      },
      {
        label: "Looks at things from the side / tilts head when looking",
        weight: 1.6,
        source: "parent",
        specificity: "very high",
        ageRange: { min: 12, max: 999, unit: "months" },
        keywords: ["looks from the side", "tilts head when looking", "peripheral vision"],
        regex: ["\\blooks?\\s+at\\s+things\\s+from\\s+the\\s+side\\b", "\\btilts?\\s+(his|her|their)?\\s*head\\s+when\\s+(he|she|they)\\s+looks?\\b"],
        negationRequired: false,
        crossTags: ["A2"],
        auContext: false
      },

      // ============================================================
      // TACTILE — DEFENSIVENESS
      // ============================================================
      {
        label: "Tactile defensiveness / hypersensitivity",
        weight: 1.5,
        source: "clinician",
        specificity: "very high",
        ageRange: { min: 6, max: 999, unit: "months" },
        keywords: ["tactile defensiveness", "tactile hypersensitivity", "touch averse"],
        regex: ["\\btactile\\s+(defensiveness|hypersensitivity)\\b", "\\btouch[-\\s]?averse\\b"],
        negationRequired: false,
        crossTags: [],
        auContext: false
      },
      {
        label: "Hates haircuts / nail-cutting / hair washing / teeth brushing",
        weight: 1.6,
        source: "parent",
        specificity: "very high",
        ageRange: { min: 12, max: 999, unit: "months" },
        keywords: [
          "hates haircuts",
          "hates nail cutting",
          "hates hair washing",
          "hates teeth brushing",
          "haircuts are a nightmare",
          "haircut distress",
          "extensive preparation for haircuts",
          "clippers",
          "touch sensations during haircut",
        ],
        regex: [
          "\\bhates?\\s+(haircuts?|having\\s+(his|her|their)?\\s*hair\\s+(cut|washed)|nail\\s+cutting|teeth[-\\s]?brushing|toothbrushing)\\b",
          "\\bhaircuts?\\s+(are\\s+)?(a\\s+)?nightmare\\b",
          "\\bhave\\s+to\\s+cut\\s+(his|her|their)?\\s*nails?\\s+while\\s+(he's|she's|they're)\\s+asleep\\b",
          "\\bhaircuts?\\s+(reportedly\\s+)?(require|need)\\s+(extensive\\s+)?preparation",
          "\\bdistress\\s+(associated\\s+with|during|when)\\s+(clippers?|haircuts?)",
        ],
        negationRequired: false,
        crossTags: [],
        auContext: false
      },
      {
        label: "Haircuts cause distress / require extensive preparation",
        weight: 1.6,
        source: "parent",
        specificity: "very high",
        ageRange: { min: 12, max: 999, unit: "months" },
        keywords: [
          "haircuts",
          "haircut distress",
          "extensive preparation for haircuts",
          "clippers",
          "touch sensations during haircut",
          "haircuts are a nightmare",
          "hates haircuts",
        ],
        regex: [
          "\\bhaircuts?\\s+(reportedly\\s+)?(require|need)\\s+(extensive\\s+)?preparation",
          "\\bdistress\\s+(associated\\s+with|during|when)\\s+(clippers?|haircuts?)",
          "\\bhates?\\s+haircuts?",
          "\\bhaircuts?\\s+(are\\s+)?(a\\s+)?nightmare",
        ],
        negationRequired: false,
        crossTags: [],
        auContext: false
      },
      {
        label: "Cuts tags out / hates seams / specific fabrics only / refuses jeans",
        weight: 1.7,
        source: "parent",
        specificity: "very high",
        ageRange: { min: 24, max: 999, unit: "months" },
        keywords: [
          "cuts tags out",
          "hates tags",
          "hates seams",
          "won't wear jeans",
          "specific fabrics only",
          "clothing textures",
          "textures of clothing",
          "socks",
          "tags",
          "refusing outfits",
          "refuses outfits",
          "won't wear",
          "ongoing difficulties with clothing",
          "tactile defensiveness",
        ],
        regex: [
          "\\bcuts?\\s+tags?\\s+out\\b",
          "\\bhates?\\s+(tags?|seams?|labels?)\\b",
          "\\bwon't\\s+wear\\s+(jeans?|socks?\\s+with\\s+seams?)\\b",
          "\\bonly\\s+wears?\\s+(soft|fleecy|cotton)\\s+(clothes?|fabrics?)",
          "\\b(clothing|fabric)\\s+textures?\\b",
          "\\b(difficulties|issues|problems?)\\s+with\\s+clothing\\s+textures?",
          "\\b(seams|socks|tags|labels?)\\b.*\\b(refus|hate|won't|cuts?\\s+out)",
          "\\brefus(ing|es?|ed)\\s+(certain\\s+)?outfits?",
          "\\btactile\\s+defensiveness\\b",
        ],
        negationRequired: false,
        crossTags: ["B2"],
        auContext: false,
        note: "Pathognomonic clothing-tactile pattern in ASD"
      },
      {
        label: "Tactile defensiveness — clothing textures, seams, socks, tags",
        weight: 1.7,
        source: "parent",
        specificity: "very high",
        ageRange: { min: 12, max: 999, unit: "months" },
        keywords: [
          "clothing textures",
          "textures of clothing",
          "seams",
          "socks",
          "tags",
          "refusing outfits",
          "refuses outfits",
          "won't wear",
          "ongoing difficulties with clothing",
          "tactile defensiveness",
        ],
        regex: [
          "\\b(clothing|fabric)\\s+textures?\\b",
          "\\b(difficulties|issues|problems?)\\s+with\\s+clothing\\s+textures?",
          "\\b(seams|socks|tags|labels?)\\b.*\\b(refus|hate|won't|cuts?\\s+out)",
          "\\brefus(ing|es?|ed)\\s+(certain\\s+)?outfits?",
          "\\btactile\\s+defensiveness\\b",
        ],
        negationRequired: false,
        crossTags: ["B2"],
        auContext: false
      },
      {
        label: "Wears socks inside out / hates socks / hates underwear",
        weight: 1.5,
        source: "parent",
        specificity: "very high",
        ageRange: { min: 24, max: 999, unit: "months" },
        keywords: ["socks inside out", "hates socks", "hates underwear"],
        regex: ["\\bwears?\\s+socks?\\s+inside\\s+out\\b", "\\bhates?\\s+(socks?|underwear|undies)\\b"],
        negationRequired: false,
        crossTags: [],
        auContext: true,
        auContextNote: "Undies = Australian colloquial for underwear"
      },
      {
        label: "Hates grass / sand / paint / glue / playdough textures",
        weight: 1.5,
        source: "parent",
        specificity: "very high",
        ageRange: { min: 18, max: 999, unit: "months" },
        keywords: ["hates grass barefoot", "hates sand", "hates playdough", "won't touch glue"],
        regex: ["\\b(hates?|won't\\s+(walk|touch|walk\\s+on))\\s+(grass\\s+barefoot|sand|paint|glue|playdough|finger\\s+paint|slime|kinetic\\s+sand)"],
        negationRequired: false,
        crossTags: [],
        auContext: false
      },
      {
        label: "Hates getting dirty / messy play",
        weight: 1.4,
        source: "parent",
        specificity: "high",
        ageRange: { min: 18, max: 999, unit: "months" },
        keywords: ["hates getting dirty", "hates messy play"],
        regex: ["\\bhates?\\s+(getting\\s+dirty|messy\\s+play|mud|getting\\s+wet)\\b"],
        negationRequired: false,
        crossTags: [],
        auContext: false
      },

      // ============================================================
      // TACTILE — HYPOREACTIVITY / SEEKING
      // ============================================================
      {
        label: "High pain threshold / didn't cry when broke arm / doesn't notice cuts",
        weight: 1.7,
        source: "parent",
        specificity: "very high",
        ageRange: { min: 18, max: 999, unit: "months" },
        keywords: ["high pain threshold", "didn't cry when broke arm", "doesn't notice cuts", "doesn't feel pain"],
        regex: ["\\bhigh\\s+pain\\s+threshold\\b", "\\bdidn't\\s+cry\\s+when\\s+(he|she|they)\\s+broke\\s+(his|her|their)?\\s*(arm|leg|bone)", "\\b(doesn't|does\\s+not)\\s+notice\\s+(cuts|grazes|injuries|bruises)"],
        negationRequired: false,
        crossTags: [],
        auContext: false,
        note: "Pathognomonic hyporeactive sensory pattern"
      },
      {
        label: "Doesn't feel cold / wears shorts in winter",
        weight: 1.5,
        source: "parent",
        specificity: "very high",
        ageRange: { min: 24, max: 999, unit: "months" },
        keywords: ["doesn't feel cold", "wears shorts in winter", "no temperature awareness"],
        regex: ["\\b(doesn't|does\\s+not)\\s+feel\\s+(the\\s+)?cold\\b", "\\bwears?\\s+shorts?\\s+in\\s+winter\\b"],
        negationRequired: false,
        crossTags: [],
        auContext: false
      },
      {
        label: "Crashes into things / climbs / squeezes too hard / loves being squashed",
        weight: 1.5,
        source: "parent",
        specificity: "very high",
        ageRange: { min: 18, max: 999, unit: "months" },
        keywords: [
          "crashes into things",
          "crashing into furniture",
          "loves being squashed",
          "squeezes too hard",
          "climbs on everything",
          "excessive jumping",
          "deep pressure",
          "seeking deep pressure",
          "chewing objects",
          "chews objects",
          "sensory seeking behaviours",
          "sensory seeking",
        ],
        regex: [
          "\\bcrashes?\\s+(into|on)\\s+(things|the\\s+couch|people|furniture|walls)\\b",
          "\\bcrash(ing|es|ed)\\s+into\\s+(furniture|things|walls|people)\\b",
          "\\bloves?\\s+(being\\s+)?(squashed|squished|under\\s+cushions)\\b",
          "\\bsqueezes?\\s+too\\s+hard\\b",
          "\\bclimbs?\\s+on\\s+everything\\b",
          "\\bexcessive\\s+jumping\\b",
          "\\b(seeking|seeks?)\\s+deep\\s+pressure\\b",
          "\\bchew(ing|s|ed)\\s+objects?\\b",
          "\\bsensory\\s+seeking\\s+(behaviours?)?\\b",
        ],
        negationRequired: false,
        crossTags: ["B1"],
        auContext: false
      },
      {
        label: "Sensory seeking — crashing, jumping, deep pressure, chewing",
        weight: 1.5,
        source: "parent",
        specificity: "very high",
        ageRange: { min: 18, max: 999, unit: "months" },
        keywords: [
          "crashing into",
          "crashes into",
          "excessive jumping",
          "deep pressure",
          "seeking deep pressure",
          "chewing objects",
          "chews objects",
          "sensory seeking behaviours",
          "sensory seeking",
        ],
        regex: [
          "\\bcrash(ing|es|ed)\\s+into\\s+(furniture|things|walls|people)\\b",
          "\\bexcessive\\s+jumping\\b",
          "\\b(seeking|seeks?)\\s+deep\\s+pressure\\b",
          "\\bchew(ing|s|ed)\\s+objects?\\b",
          "\\bsensory\\s+seeking\\s+(behaviours?)?\\b",
        ],
        negationRequired: false,
        crossTags: ["B1"],
        auContext: false
      },
      {
        label: "Sleeps with weighted blanket",
        weight: 1.4,
        source: "parent",
        specificity: "high",
        ageRange: { min: 36, max: 999, unit: "months" },
        keywords: ["weighted blanket", "uses weighted blanket"],
        regex: ["\\b(uses?\\s+|sleeps?\\s+with\\s+)?(a\\s+)?weighted\\s+blankets?\\b"],
        negationRequired: false,
        crossTags: [],
        auContext: false
      },

      // ============================================================
      // VESTIBULAR / PROPRIOCEPTIVE
      // ============================================================
      {
        label: "Spins / loves swings / merry-go-round / hangs upside down",
        weight: 1.5,
        source: "parent",
        specificity: "very high",
        ageRange: { min: 18, max: 999, unit: "months" },
        keywords: ["loves swings", "loves merry-go-round", "hangs upside down", "spins constantly"],
        regex: ["\\bloves?\\s+(swings?|the\\s+merry[-\\s]?go[-\\s]?round|spinning|going\\s+upside\\s+down)\\b", "\\bhangs?\\s+upside\\s+down\\s+(off\\s+everything)?", "\\bspins?\\s+(constantly|for\\s+hours)"],
        negationRequired: false,
        crossTags: ["B1"],
        auContext: false
      },
      {
        label: "Bites / chews shirts / collars / pencils / chewy necklaces",
        weight: 1.5,
        source: "parent",
        specificity: "very high",
        ageRange: { min: 24, max: 999, unit: "months" },
        keywords: ["chews shirt", "bites collar", "chews pencils", "chewy necklace", "tooth grinding"],
        regex: ["\\b(chews?|bites?)\\s+(on\\s+)?(his|her|their)?\\s*(shirt|sleeve|collar|clothes|pencil)\\b", "\\bchewy\\s+necklaces?\\b", "\\b(grinds?|grinding)\\s+(his|her|their)?\\s*teeth\\b"],
        negationRequired: false,
        crossTags: ["B1"],
        auContext: false
      },
      {
        label: "W-sitting / low tone / slumps everywhere",
        weight: 1.3,
        source: "clinician",
        specificity: "moderate",
        ageRange: { min: 24, max: 999, unit: "months" },
        keywords: ["W-sitting", "low muscle tone", "slumps everywhere"],
        regex: ["\\bW[-\\s]?sit(ting|s)?\\b", "\\blow\\s+(muscle\\s+)?tone\\b", "\\bslumps?\\s+everywhere\\b"],
        negationRequired: false,
        crossTags: [],
        auContext: false
      },
      {
        label: "Hates rides / gets carsick / motion sickness",
        weight: 1.3,
        source: "parent",
        specificity: "moderate",
        ageRange: { min: 24, max: 999, unit: "months" },
        keywords: ["hates rides", "gets carsick", "motion sickness"],
        regex: ["\\bhates?\\s+rides\\b", "\\bgets?\\s+carsick\\b", "\\bmotion\\s+sickness\\b"],
        negationRequired: false,
        crossTags: [],
        auContext: false
      },

      // ============================================================
      // ORAL / GUSTATORY
      // ============================================================
      {
        label: "Beige diet / only eats white food / eats less than 10 things",
        weight: 1.7,
        source: "parent",
        specificity: "very high",
        ageRange: { min: 12, max: 999, unit: "months" },
        keywords: ["beige diet", "only white food", "less than 10 foods", "restricted diet"],
        regex: ["\\bbeige\\s+diet\\b", "\\bonly\\s+eats?\\s+(white|yellow|beige)\\s+food\\b", "\\beats?\\s+(less\\s+than|under|fewer\\s+than)\\s+\\d+\\s+(things|foods?)"],
        negationRequired: false,
        crossTags: ["B2", "IMPAIRMENT"],
        auContext: false,
        note: "Pathognomonic ASD/ARFID feeding pattern"
      },
      {
        label: "Won't eat anything new / gags on textures / vomits if vegetables hidden",
        weight: 1.6,
        source: "parent",
        specificity: "very high",
        ageRange: { min: 18, max: 999, unit: "months" },
        keywords: ["won't try new food", "gags on textures", "vomits if vegetables", "ARFID features"],
        regex: ["\\bwon't\\s+(eat|try)\\s+anything\\s+new\\b", "\\bgags?\\s+on\\s+textures?\\b", "\\bvomits?\\s+if\\s+(I\\s+sneak|you\\s+hide|theres?)\\s+(vegetables?|veggies?)", "\\bARFID\\s+features?\\b"],
        negationRequired: false,
        crossTags: [],
        auContext: false
      },
      {
        label: "Foods can't touch on the plate / won't eat mixed foods",
        weight: 1.6,
        source: "parent",
        specificity: "very high",
        ageRange: { min: 24, max: 999, unit: "months" },
        keywords: ["foods can't touch", "won't eat mixed", "no foods touching"],
        regex: ["\\bfoods?\\s+can't\\s+touch\\s+on\\s+the\\s+plate\\b", "\\bwon't\\s+eat\\s+(anything\\s+)?mixed\\b", "\\bno\\s+foods?\\s+touching\\b"],
        negationRequired: false,
        crossTags: ["B2"],
        auContext: false
      },
      {
        label: "Restricted food repertoire / texture aversions / ARFID features",
        weight: 1.7,
        source: "parent",
        specificity: "very high",
        ageRange: { min: 12, max: 999, unit: "months" },
        keywords: [
          "restricted food",
          "food repertoire",
          "extremely restricted food",
          "aversion to mixed textures",
          "mixed textures",
          "unfamiliar foods",
          "won't eat",
          "limited diet",
          "beige diet",
          "fewer than 10 foods",
        ],
        regex: [
          "\\b(food|dietary)\\s+repertoire\\s+(is\\s+)?(extremely\\s+)?(restricted|limited)\\b",
          "\\b(strong\\s+)?aversion\\s+to\\s+(mixed\\s+)?textures?\\b",
          "\\b(restricted|limited)\\s+(food|dietary|eating)",
          "\\bbeige\\s+diet\\b",
        ],
        negationRequired: false,
        crossTags: ["B2", "IMPAIRMENT"],
        auContext: false
      },
      {
        label: "Sniffs food before eating / sniffs strangers / smells everything new",
        weight: 1.6,
        source: "parent",
        specificity: "very high",
        ageRange: { min: 18, max: 999, unit: "months" },
        keywords: ["sniffs food", "sniffs strangers", "smells everything new"],
        regex: ["\\bsniffs?\\s+(food|strangers?|new\\s+(things|people)|everything)", "\\bsmells?\\s+everything\\s+new\\b"],
        negationRequired: false,
        crossTags: ["B1"],
        auContext: false
      },
      {
        label: "Licks objects / mouths non-food items / pica behaviours",
        weight: 1.5,
        source: "parent",
        specificity: "very high",
        ageRange: { min: 24, max: 999, unit: "months" },
        keywords: [
          "licks objects",
          "licks everything",
          "licked the trolley",
          "licks the floor",
          "licks the wall",
          "mouths non-food",
          "mouths objects",
          "pica",
          "pica behaviours",
          "eats non-food items",
          "eats non-food",
          "puts non-food in mouth",
          "chews non-food",
        ],
        regex: [
          "\\blick(s|ed|ing)?\\s+(objects?|things?|everything|the\\s+(trolley|floor|wall|table))",
          "\\bpica(\\s+behaviours?)?\\b",
          "\\bmouths?\\s+non[-\\s]?food",
          "\\b(eats?|eating)\\s+non[-\\s]?food\\s+items?",
          "\\bchews?\\s+non[-\\s]?food",
        ],
        negationRequired: false,
        crossTags: [],
        auContext: false,
        auContextNote: "Trolley = Australian/UK term for shopping cart",
      },
      {
        label: "Hates perfume / cleaning products / candles — can't go to Bath & Body Works",
        weight: 1.5,
        source: "parent",
        specificity: "very high",
        ageRange: { min: 36, max: 999, unit: "months" },
        keywords: ["hates perfume", "hates cleaning products", "can't do Bath & Body Works", "hates candles"],
        regex: ["\\bhates?\\s+(perfume|deodorant|candles?|cleaning\\s+products?|bleach)\\b", "\\bcan't\\s+go\\s+(into|in)\\s+(Bath\\s+&?\\s+Body\\s+Works?|Lush|Mecca|Sephora)"],
        negationRequired: false,
        crossTags: ["IMPAIRMENT"],
        auContext: false
      }
    ]
  },
  {
    domain: "Criterion C — Developmental onset (ONSET)",
    code: "ONSET",
    criterion: "Symptoms present in the early developmental period (Criterion C)",
    criterionGroup: "C",
    dsmReference: "DSM-5-TR 299.00 Criterion C",
    severityWeight: 1.0,
    detectionStrategy: "presence-dominant",
    aliases: ["DEVELOPMENTAL"],
    markers: [
      // ============================================================
      // EARLY CONCERNS
      // ============================================================
      {
        label: "Concerns identified before age 3",
        weight: 1.6,
        source: "parent",
        specificity: "very high",
        ageRange: { min: 0, max: 36, unit: "months", retrospective: true },
        keywords: ["concerns before age 3", "noticed before he was 2", "knew something was different from early"],
        regex: ["\\b(concerns?|knew|noticed|wondered)\\s+(something\\s+was\\s+)?(different|wrong|off|odd)\\s+(before|by|from)\\s+(age\\s+)?(2|3|two|three|18\\s+months|24\\s+months)"],
        negationRequired: false,
        crossTags: [],
        auContext: false
      },
      {
        label: "Personal Health Record / Blue Book entries indicating early concerns",
        weight: 1.5,
        source: "history",
        specificity: "very high",
        ageRange: { min: 0, max: 60, unit: "months", retrospective: true },
        keywords: ["Personal Health Record", "Blue Book", "Red Book", "Purple Book", "child health record"],
        regex: ["\\b(Personal\\s+Health\\s+Record|Blue\\s+Book|Red\\s+Book|Purple\\s+Book|My\\s+Health\\s+Record|child\\s+health\\s+record)\\s+(noted|showed|indicated|flagged|raised)"],
        negationRequired: false,
        crossTags: [],
        auContext: true,
        auContextNote: "Australian state-specific child health records: NSW Blue Book, VIC Green Book, QLD Personal Health Record, WA Purple Book, SA Blue Book"
      },
      {
        label: "Child & adolescent health nurse / community health nurse raised concerns",
        weight: 1.5,
        source: "history",
        specificity: "very high",
        ageRange: { min: 0, max: 36, unit: "months", retrospective: true },
        keywords: ["CAFHS nurse concerns", "community health nurse", "child health nurse raised", "MCH nurse"],
        regex: ["\\b(CAFHS|CAHS|MCH|community\\s+health|child\\s+(\\&|and)\\s+adolescent\\s+health|child\\s+health)\\s+nurses?\\s+(raised|noted|flagged|concerned)\\b"],
        negationRequired: false,
        crossTags: [],
        auContext: true,
        auContextNote: "CAFHS (SA), CAHS (WA), MCH (VIC), Tresillian (NSW) — state-specific child health services"
      },
      {
        label: "Early childhood education / kindy / daycare raised concerns",
        weight: 1.5,
        source: "history",
        specificity: "high",
        ageRange: { min: 12, max: 60, unit: "months", retrospective: true },
        keywords: ["kindy raised concerns", "daycare raised concerns", "ECT raised", "preschool concerns"],
        regex: ["\\b(kindy|kindergarten|daycare|childcare|long\\s+day\\s+care|preschool|ECT|early\\s+childhood\\s+(teacher|educator))\\s+(raised|noted|flagged|concerned|recommended)"],
        negationRequired: false,
        crossTags: [],
        auContext: true,
        auContextNote: "Australian early childhood education context"
      },
      {
        label: "Delayed or atypical milestones",
        weight: 1.5,
        source: "history",
        specificity: "high",
        ageRange: { min: 0, max: 60, unit: "months", retrospective: true },
        keywords: ["delayed milestones", "atypical milestones", "missed milestones", "developmental delay"],
        regex: ["\\b(delayed|atypical|missed|late)\\s+milestones?\\b", "\\bdevelopmental\\s+delays?\\b"],
        negationRequired: false,
        crossTags: [],
        auContext: false
      },
      {
        label: "Language regression — lost words around 18-24 months",
        weight: 1.7,
        source: "history",
        specificity: "very high",
        ageRange: { min: 12, max: 36, unit: "months", retrospective: true },
        keywords: ["language regression", "lost words", "stopped saying mum", "regressed at 18 months"],
        regex: ["\\b(language|verbal|speech)\\s+regression\\b", "\\blost\\s+(his|her|their)?\\s*words?\\b", "\\bstopped\\s+(saying|talking|using\\s+words)\\b", "\\bregressed?\\s+(at|around)\\s+\\d+\\s+months?"],
        negationRequired: false,
        crossTags: [],
        auContext: false,
        note: "Regressive presentation - critical Criterion C marker"
      },
      {
        label: "Late identification with retrospective developmental history consistent with early onset",
        weight: 1.5,
        source: "clinician",
        specificity: "very high",
        ageRange: { min: 60, max: 999, unit: "months" },
        keywords: ["late identification", "retrospective developmental history", "looking back early signs"],
        regex: ["\\blate\\s+(identification|presentation|recognition)\\b", "\\bretrospective\\s+developmental\\s+history\\b", "\\blooking\\s+back\\s+(the\\s+)?(early\\s+)?signs?\\s+were\\s+there\\b"],
        negationRequired: false,
        crossTags: ["MASKING"],
        auContext: false,
        note: "Critical for late-identified, masking, female/AFAB presentations"
      },
      {
        label: "Symptoms not fully manifest until social demands exceeded capacity",
        weight: 1.5,
        source: "clinician",
        specificity: "very high",
        ageRange: { min: 60, max: 999, unit: "months" },
        keywords: ["social demands exceeded capacity", "became apparent at school", "high school is when it became clear"],
        regex: ["\\bsocial\\s+demands?\\s+exceed\\w*\\s+(his|her|their|the\\s+child's)\\s+capacity\\b", "\\bbecame\\s+(apparent|clear)\\s+(at|when)\\s+(school|high\\s+school|year\\s+\\d|grade\\s+\\d)"],
        negationRequired: false,
        crossTags: ["MASKING"],
        auContext: false,
        note: "DSM-5-TR explicit Criterion C clause"
      },
      {
        label: "Parent reports 'always been like this' / 'as long as we can remember'",
        weight: 1.4,
        source: "parent",
        specificity: "high",
        ageRange: { min: 36, max: 999, unit: "months" },
        keywords: ["always been like this", "as long as we can remember", "from day one", "from birth"],
        regex: ["\\b(always\\s+been\\s+like\\s+this|as\\s+long\\s+as\\s+we\\s+can\\s+remember|from\\s+day\\s+one|from\\s+birth|since\\s+(he|she|they)\\s+was\\s+(a\\s+)?baby)\\b"],
        negationRequired: false,
        crossTags: [],
        auContext: false
      },
      {
        label: "M-CHAT-R / ASQ-3 flagged in early childhood",
        weight: 1.6,
        source: "history",
        specificity: "very high",
        ageRange: { min: 16, max: 36, unit: "months", retrospective: true },
        keywords: ["M-CHAT-R flagged", "ASQ-3 flagged", "ASQ flagged", "screening flagged"],
        regex: ["\\b(M[-\\s]?CHAT[-\\s]?R?|ASQ[-\\s]?3?|developmental\\s+screening)\\s+(flagged|positive|red\\s+flagged|raised\\s+concerns?)"],
        negationRequired: false,
        crossTags: [],
        auContext: true,
        auContextNote: "M-CHAT-R is standard Australian 18-month developmental screen"
      },
      {
        label: "First word delayed past 18 months / no words by 16 months",
        weight: 1.6,
        source: "history",
        specificity: "very high",
        ageRange: { min: 12, max: 24, unit: "months", retrospective: true },
        keywords: ["first word delayed", "no words by 16 months", "didn't speak until"],
        regex: ["\\bfirst\\s+words?\\s+(delayed|late|past\\s+\\d+)", "\\bno\\s+words?\\s+by\\s+\\d+\\s+months\\b", "\\bdidn't\\s+(speak|talk)\\s+until\\s+(he|she|they)\\s+was\\s+\\d+"],
        negationRequired: false,
        crossTags: [],
        auContext: false
      },
      {
        label: "GP / paediatrician raised early concerns",
        weight: 1.4,
        source: "history",
        specificity: "high",
        ageRange: { min: 0, max: 60, unit: "months", retrospective: true },
        keywords: ["GP raised concerns", "paediatrician concerns", "doctor flagged"],
        regex: ["\\b(GP|paediatrician|paediatric|doctor|family\\s+doctor)\\s+(raised|noted|flagged|concerned|recommended\\s+assessment)"],
        negationRequired: false,
        crossTags: [],
        auContext: true,
        auContextNote: "Australian primary care referral pathway"
      }
    ]
  },
  {
    domain: "Functional impairment / adaptive functioning / NDIS domains",
    code: "IMPAIRMENT",
    criterion: "Clinically significant impairment in current functioning (Criterion D)",
    criterionGroup: "D",
    dsmReference: "DSM-5-TR 299.00 Criterion D",
    severityWeight: 1.5,
    detectionStrategy: "presence-dominant",
    markers: [
      // ============================================================
      // EDUCATIONAL IMPAIRMENT — AUSTRALIAN-SPECIFIC
      // ============================================================
      {
        label: "NCCD funding / NCCD imputed disability category",
        weight: 1.7,
        source: "history",
        specificity: "very high",
        ageRange: { min: 60, max: 999, unit: "months" },
        keywords: ["NCCD funding", "NCCD imputed", "Nationally Consistent Collection of Data"],
        regex: ["\\bNCCD\\s+(funding|imputed|recognised|loading|category)\\b", "\\bNationally\\s+Consistent\\s+Collection\\s+of\\s+Data\\b"],
        negationRequired: false,
        crossTags: [],
        auContext: true,
        auContextNote: "Australian school disability funding framework — concrete evidence of educational impairment"
      },
      {
        label: "Individual Education Plan (IEP) / Individual Learning Plan (ILP)",
        weight: 1.5,
        source: "history",
        specificity: "high",
        ageRange: { min: 60, max: 999, unit: "months" },
        keywords: ["IEP", "ILP", "Individual Education Plan", "Individual Learning Plan", "Personal Learning Plan"],
        regex: ["\\b(IEP|ILP|PLP)\\b", "\\bIndividual\\s+(Education|Learning)\\s+Plans?\\b", "\\bPersonal(ised)?\\s+Learning\\s+Plans?\\b"],
        negationRequired: false,
        crossTags: [],
        auContext: true,
        auContextNote: "Australian school individualised planning documents"
      },
      {
        label: "Education Assistant / Teacher Aide support",
        weight: 1.6,
        source: "history",
        specificity: "very high",
        ageRange: { min: 60, max: 999, unit: "months" },
        keywords: [
          "education assistant",
          "educational assistant",
          "EA support",
          "EA hours",
          "EA allocated",
          "EA allocation",
          "teacher aide",
          "teaching aide",
          "TA support",
          "classroom support assistant",
        ],
        regex: [
          "\\beducation(al)?\\s+assistants?\\s+(support|hours|allocated|present)?\\b",
          "\\beducational\\s+assistant\\s+support\\b",
          "\\bteachers?\\s+aides?\\s+(support|hours)?\\b",
          "\\bEA\\s+(support|hours|allocated|allocation)\\b",
          "\\bTA\\s+support\\b",
        ],
        negationRequired: false,
        crossTags: [],
        auContext: true,
        auContextNote: "EA = Education Assistant (WA/SA); Teacher Aide (QLD/NSW)",
      },
      {
        label: "Aboriginal Liaison Officer / AEW support",
        weight: 1.6,
        source: "history",
        specificity: "very high",
        ageRange: { min: 60, max: 999, unit: "months" },
        keywords: [
          "Aboriginal Liaison Officer",
          "ALO support",
          "Aboriginal Education Worker",
          "AEW",
          "Indigenous education support",
          "Aboriginal education support",
        ],
        regex: [
          "\\bAboriginal\\s+(Liaison\\s+Officers?|Education\\s+Workers?)\\b",
          "\\b(ALO|AEW)\\s+(support|allocated|present)?\\b",
          "\\b(Indigenous|Aboriginal)\\s+education\\s+support\\b",
        ],
        negationRequired: false,
        crossTags: [],
        auContext: true,
      },
      {
        label: "Reduced timetable / part-time attendance / negotiated absence",
        weight: 1.7,
        source: "history",
        specificity: "very high",
        ageRange: { min: 60, max: 999, unit: "months" },
        keywords: ["reduced timetable", "part-time attendance", "negotiated absence", "soft suspension"],
        regex: ["\\b(reduced\\s+timetables?|part[-\\s]?time\\s+attendance|negotiated\\s+absences?|soft\\s+suspensions?|modified\\s+attendance)\\b"],
        negationRequired: false,
        crossTags: [],
        auContext: true,
      },
      {
        label: "Working below year level (e.g., Year 3 working at Year 1 level)",
        weight: 1.5,
        source: "history",
        specificity: "high",
        ageRange: { min: 60, max: 999, unit: "months" },
        keywords: ["working below year level", "below grade level", "X years behind"],
        regex: ["\\bworking\\s+(below|under)\\s+year\\s+level\\b", "\\b(Year|Grade)\\s+\\d+\\s+(student|child)\\s+working\\s+at\\s+(Year|Grade)\\s+\\d+\\s+level\\b", "\\b\\d+\\s+years?\\s+behind\\s+(year|grade)\\s+level\\b"],
        negationRequired: false,
        crossTags: [],
        auContext: true,
      },
      {
        label: "NAPLAN exemption / withdrawal / adjustments",
        weight: 1.4,
        source: "history",
        specificity: "very high",
        ageRange: { min: 96, max: 999, unit: "months" },
        keywords: ["NAPLAN exemption", "NAPLAN withdrawal", "NAPLAN adjustments"],
        regex: ["\\bNAPLAN\\s+(exempt|withdrawal|withdrawn|adjustments|special\\s+provisions)\\b"],
        negationRequired: false,
        crossTags: [],
        auContext: true,
        auContextNote: "Australian national assessment program"
      },
      {
        label: "Specialist school / Education Support Centre / Engagement Centre placement",
        weight: 1.7,
        source: "history",
        specificity: "very high",
        ageRange: { min: 60, max: 999, unit: "months" },
        keywords: [
          "specialist school",
          "specialist school placement",
          "Education Support Centre",
          "Education Support Centres",
          "Engagement Centre",
          "Engagement Centres",
          "ESC placement",
          "behaviour school",
          "alternative education placement",
        ],
        regex: [
          "\\bspecialist\\s+schools?(?:\\s+(placement|enrolled|attending))?\\b",
          "\\bEducation\\s+Support\\s+Centres?\\b",
          "\\bEngagement\\s+Centres?\\b",
          "\\bESC\\s+placement\\b",
          "\\bbehaviour\\s+schools?\\b",
          "\\balternative\\s+education\\s+placement\\b",
        ],
        negationRequired: false,
        crossTags: [],
        auContext: true,
        auContextNote: "ESC = Education Support Centre (WA); each state has equivalent specialist provision"
      },
      {
        label: "School cannot manage / mainstream placement at risk",
        weight: 1.7,
        source: "history",
        specificity: "very high",
        ageRange: { min: 60, max: 999, unit: "months" },
        keywords: ["school cannot manage", "mainstream at risk", "school requesting external supports"],
        regex: ["\\bschool\\s+(cannot|can't)\\s+manage\\b", "\\bmainstream\\s+placement\\s+at\\s+risk\\b", "\\bschool\\s+requesting\\s+external\\s+supports?\\b"],
        negationRequired: false,
        crossTags: [],
        auContext: true
      },
      {
        label: "Suspensions / behaviour incidents / behaviour support plan",
        weight: 1.5,
        source: "history",
        specificity: "high",
        ageRange: { min: 60, max: 999, unit: "months" },
        keywords: ["suspensions", "behaviour incidents", "behaviour support plan", "BSP"],
        regex: ["\\b(suspended|suspensions?|behaviour\\s+incidents?|behaviour\\s+support\\s+plans?|BSP|behaviour\\s+management\\s+plans?)\\b"],
        negationRequired: false,
        crossTags: [],
        auContext: false
      },
      {
        label: "School refusal / non-attendance / partial attendance",
        weight: 1.6,
        source: "parent",
        specificity: "very high",
        ageRange: { min: 60, max: 999, unit: "months" },
        keywords: ["school refusal", "non-attendance", "won't go to school", "school can't attendance"],
        regex: ["\\bschool\\s+(refusal|can't|cant|avoidance)\\b", "\\b(won't|refuses?\\s+to)\\s+go\\s+to\\s+school\\b", "\\b(non[-\\s]?attendance|partial\\s+attendance)\\b"],
        negationRequired: false,
        crossTags: [],
        auContext: false
      },

      // ============================================================
      // FAMILY SYSTEM IMPAIRMENT
      // ============================================================
      {
        label: "Parent on Carer Payment / Carer Allowance / reduced or ceased employment",
        weight: 1.7,
        source: "parent",
        specificity: "very high",
        ageRange: { min: 0, max: 999, unit: "months" },
        keywords: ["Carer Payment", "Carer Allowance", "ceased employment", "had to stop working", "reduced employment"],
        regex: ["\\b(Carer\\s+(Payment|Allowance)|Centrelink\\s+carer)\\b", "\\b(stopped|reduced|ceased|gave\\s+up)\\s+(work|employment|working|my\\s+job)\\s+(to\\s+care|because\\s+of)"],
        negationRequired: false,
        crossTags: [],
        auContext: true,
        auContextNote: "Centrelink Carer Payment/Allowance — concrete federal disability impact evidence"
      },
      {
        label: "Cannot use mainstream childcare / OOSH / vacation care",
        weight: 1.6,
        source: "parent",
        specificity: "very high",
        ageRange: { min: 12, max: 144, unit: "months" },
        keywords: ["can't use childcare", "OOSH can't manage", "vacation care impossible", "kicked out of daycare"],
        regex: ["\\b(can't|cannot)\\s+use\\s+(mainstream\\s+)?(childcare|daycare|long\\s+day\\s+care)\\b", "\\b(OOSH|out\\s+of\\s+school\\s+hours?\\s+care|vacation\\s+care|holiday\\s+program)\\s+(can't\\s+manage|impossible|kicked\\s+out|asked\\s+to\\s+leave)"],
        negationRequired: false,
        crossTags: [],
        auContext: true,
        auContextNote: "OOSH = Out of School Hours care (Australian terminology)"
      },
      {
        label: "Respite care / NDIS support workers in home",
        weight: 1.6,
        source: "history",
        specificity: "very high",
        ageRange: { min: 36, max: 999, unit: "months" },
        keywords: ["respite care", "NDIS support workers", "in-home support"],
        regex: ["\\b(respite\\s+care|NDIS\\s+support\\s+workers?|in[-\\s]?home\\s+support|support\\s+coordinators?)\\b"],
        negationRequired: false,
        crossTags: [],
        auContext: true
      },
      {
        label: "Home modifications — locks / fencing / sensory room / safe space",
        weight: 1.6,
        source: "parent",
        specificity: "very high",
        ageRange: { min: 24, max: 999, unit: "months" },
        keywords: ["home modifications", "deadlocks", "extra fencing", "sensory room", "safe space at home"],
        regex: ["\\b(home\\s+modifications?|deadlocks?|window\\s+locks?|extra\\s+fencing|sensory\\s+rooms?|safe\\s+spaces?\\s+at\\s+home|GPS\\s+trackers?|door\\s+alarms?)\\b"],
        negationRequired: false,
        crossTags: [],
        auContext: true,
        auContextNote: "Environmental modifications — document whether driven by elopement/safety vs sensory regulation alone"
      },
      {
        label: "Family holidays not possible / restricted / cannot tolerate flights",
        weight: 1.5,
        source: "parent",
        specificity: "high",
        ageRange: { min: 24, max: 999, unit: "months" },
        keywords: ["holidays not possible", "can't fly", "can't do hotels", "no family holidays"],
        regex: ["\\bfamily\\s+holidays?\\s+(not\\s+possible|restricted|impossible|don't\\s+happen)\\b", "\\b(can't|cannot)\\s+(tolerate|do)\\s+(flights?|airports?|hotels?)"],
        negationRequired: false,
        crossTags: [],
        auContext: false
      },

      // ============================================================
      // HEALTHCARE & COMMUNITY ACCESS
      // ============================================================
      {
        label: "GP / dental / blood draw requires sedation or restraint or GA",
        weight: 1.7,
        source: "parent",
        specificity: "very high",
        ageRange: { min: 24, max: 999, unit: "months" },
        keywords: ["dental requires GA", "blood draw requires restraint", "GP requires sedation"],
        regex: ["\\b(dental|GP|paediatric|pathology|blood\\s+draws?|vaccinations?|hospital)\\s+(requires?|needs?)\\s+(GA|general\\s+anaesthetic|sedation|restraint)\\b"],
        negationRequired: false,
        crossTags: [],
        auContext: false
      },
      {
        label: "Cannot access community spaces — playgrounds, parks, public events",
        weight: 1.5,
        source: "parent",
        specificity: "high",
        ageRange: { min: 24, max: 999, unit: "months" },
        keywords: ["can't go to playground", "can't access parks", "can't do public events"],
        regex: ["\\b(can't|cannot)\\s+(go\\s+to|access|tolerate)\\s+(playgrounds?|parks?|public\\s+events|community\\s+events|festivals?|shows?)\\b"],
        negationRequired: false,
        crossTags: ["B4"],
        auContext: false
      },
      {
        label: "Cannot attend birthday parties / removed from sports / dance / Auskick",
        weight: 1.5,
        source: "parent",
        specificity: "very high",
        ageRange: { min: 36, max: 999, unit: "months" },
        keywords: ["can't attend parties", "removed from Auskick", "kicked out of dance", "swimming lessons impossible"],
        regex: ["\\b(can't|cannot)\\s+attend\\s+(birthday\\s+)?parties\\b", "\\b(removed|kicked\\s+out|asked\\s+to\\s+leave)\\s+from\\s+(Auskick|Little\\s+Athletics|Nippers|swimming|dance|gymnastics|sport)\\b"],
        negationRequired: false,
        crossTags: ["A3"],
        auContext: true,
        auContextNote: "Auskick (AFL), Little Athletics, Nippers (Surf Life Saving) are core Australian children's sports"
      },

      // ============================================================
      // SELF-CARE / ADAPTIVE FUNCTIONING
      // ============================================================
      {
        label: "Toilet training delayed / accidents / encopresis / enuresis past age",
        weight: 1.5,
        source: "parent",
        specificity: "high",
        ageRange: { min: 36, max: 999, unit: "months" },
        keywords: ["not toilet trained", "still in nappies", "daytime wetting", "soiling", "encopresis", "enuresis"],
        regex: ["\\b(not\\s+toilet\\s+trained|still\\s+in\\s+nappies|daytime\\s+wetting|soiling|encopresis|enuresis|accidents?\\s+past\\s+age\\s+\\d+)"],
        negationRequired: false,
        crossTags: [],
        auContext: false
      },
      {
        label: "Requires prompting / supervision for self-care (dressing, bathing, eating)",
        weight: 1.7,
        source: "parent",
        specificity: "very high",
        ageRange: { min: 84, max: 999, unit: "months" },
        keywords: [
          "prompting for hygiene",
          "prompting for dressing",
          "prompting for bathing",
          "prompting for eating",
          "supervision for dressing",
          "supervision for bathing",
          "needs prompting to dress",
          "needs prompting to shower",
          "needs help dressing",
          "needs help bathing",
          "won't shower without prompting",
          "doesn't initiate self-care",
          "can't manage hygiene independently",
        ],
        regex: [
          "\\bprompt(ing|s)?\\s+(for|to)\\s+(hygiene|dressing|bathing|eating|showering|tooth\\s*brushing)\\b",
          "\\bsupervision\\s+(for|with)\\s+(hygiene|dressing|bathing|eating|showering)\\b",
          "\\bneeds?\\s+(prompting|help)\\s+(to|with)\\s+(dress|bathe|shower|eat|brush\\s+teeth)\\b",
          "\\bcan(no|')t\\s+manage\\s+(hygiene|self-?care|ADLs?)\\s+independently\\b",
          "\\bdo(esn'?t|n'?t)\\s+initiate\\s+self-?care\\b",
        ],
        negationRequired: false,
        crossTags: [],
        auContext: false,
      },
      {
        label: "School accommodations: EA, regulation breaks, modified expectations",
        weight: 1.7,
        source: "history",
        specificity: "very high",
        ageRange: { min: 60, max: 999, unit: "months" },
        keywords: [
          "educational assistant support",
          "EA support",
          "regulation breaks",
          "modified group expectations",
          "classroom adjustments",
          "school accommodations",
          "sensory regulation adjustments",
        ],
        regex: [
          "\\beducational\\s+assistant\\s+support\\b",
          "\\bregulation\\s+breaks?\\b",
          "\\bmodified\\s+(group\\s+)?expectations?\\b",
          "\\bclassroom\\s+adjustments?\\b",
          "\\bschool\\s+accommodations?\\b",
        ],
        negationRequired: false,
        crossTags: [],
        auContext: true
      },
      {
        label: "Cannot be left alone / requires line-of-sight supervision",
        weight: 1.6,
        source: "parent",
        specificity: "very high",
        ageRange: { min: 36, max: 999, unit: "months" },
        keywords: ["can't be left alone", "line-of-sight supervision", "constant supervision"],
        regex: ["\\b(can't|cannot)\\s+be\\s+left\\s+alone\\b", "\\b(line[-\\s]?of[-\\s]?sight|constant)\\s+supervision\\b"],
        negationRequired: false,
        crossTags: [],
        auContext: false
      },

      // ============================================================
      // GENERAL FUNCTIONAL CAPACITY LANGUAGE
      // ============================================================
      {
        label: "Substantially reduced functional capacity",
        weight: 1.5,
        source: "clinician",
        specificity: "very high",
        ageRange: { min: 24, max: 999, unit: "months" },
        keywords: ["substantially reduced functional capacity", "significantly impaired functioning"],
        regex: ["\\bsubstantially\\s+reduced\\s+functional\\s+capacity\\b", "\\bsignificantly\\s+impaired\\s+functioning\\b"],
        negationRequired: false,
        crossTags: [],
        auContext: true,
        auContextNote: "Direct NDIS Act 2013 s24 language"
      },
      {
        label: "Requires support to / unable to independently / cannot perform without assistance",
        weight: 1.4,
        source: "clinician",
        specificity: "high",
        ageRange: { min: 24, max: 999, unit: "months" },
        keywords: ["requires support to", "unable to independently", "cannot without assistance"],
        regex: ["\\brequires?\\s+support\\s+to\\b", "\\bunable\\s+to\\s+independently\\b", "\\bcannot\\s+perform\\s+without\\s+assistance\\b"],
        negationRequired: false,
        crossTags: [],
        auContext: true,
        auContextNote: "NDIS-aligned functional impact phrasing"
      },
      {
        label: "Below age-expected level / significantly below norm",
        weight: 1.4,
        source: "clinician",
        specificity: "high",
        ageRange: { min: 24, max: 999, unit: "months" },
        keywords: ["below age-expected level", "significantly below norm", "more than 2 SD below"],
        regex: ["\\b(below|significantly\\s+below)\\s+(age[-\\s]?expected|developmental\\s+norm|chronological\\s+age)", "\\b(\\d+)\\s+SD\\s+below\\s+(the\\s+)?mean\\b"],
        negationRequired: false,
        crossTags: [],
        auContext: false
      },
      {
        label: "Vineland-3 / ABAS-3 in low or extremely low range",
        weight: 1.7,
        source: "clinician",
        specificity: "very high",
        ageRange: { min: 24, max: 999, unit: "months" },
        keywords: ["Vineland low range", "ABAS extremely low", "adaptive behaviour composite below 70"],
        regex: ["\\b(Vineland[-\\s]?3?|ABAS[-\\s]?3?)\\s+(in\\s+the\\s+)?(low|extremely\\s+low|below\\s+average)\\s+range\\b", "\\b(adaptive\\s+behaviour\\s+composite|ABC|GAC)\\s+(below|standard\\s+score)\\s+\\d+", "\\bABC\\s+<\\s*70\\b"],
        negationRequired: false,
        crossTags: ["DIFFERENTIAL"],
        auContext: false,
        note: "Standardised adaptive functioning evidence — highest weight for NDIS access"
      }
    ]
  },
  {
    domain: "Criterion E — Differential diagnosis (DIFFERENTIAL)",
    code: "DIFFERENTIAL",
    criterion: "Disturbance not better explained by ID or GDD alone (Criterion E)",
    criterionGroup: "E",
    dsmReference: "DSM-5-TR 299.00 Criterion E",
    severityWeight: 1.0,
    detectionStrategy: "presence-dominant",
    aliases: ["DIFF", "RULEOUT"],
    markers: [
      {
        label: "Cognitive assessment completed (WPPSI-IV / WISC-V / Leiter-3)",
        weight: 1.6,
        source: "clinician",
        specificity: "very high",
        ageRange: { min: 36, max: 999, unit: "months" },
        keywords: ["WPPSI-IV", "WISC-V", "Leiter-3", "cognitive assessment", "IQ assessment"],
        regex: ["\\b(WPPSI[-\\s]?(IV|4)|WISC[-\\s]?(V|5)|Leiter[-\\s]?3|Stanford[-\\s]?Binet|cognitive\\s+assessments?|IQ\\s+(assessments?|tests?))\\b"],
        negationRequired: false,
        crossTags: [],
        auContext: false
      },
      {
        label: "Adaptive functioning assessment completed (Vineland-3 / ABAS-3)",
        weight: 1.6,
        source: "clinician",
        specificity: "very high",
        ageRange: { min: 24, max: 999, unit: "months" },
        keywords: ["Vineland-3", "ABAS-3", "adaptive functioning assessment"],
        regex: ["\\b(Vineland[-\\s]?3?|ABAS[-\\s]?3?|adaptive\\s+(functioning|behaviour)\\s+assessments?)\\b"],
        negationRequired: false,
        crossTags: ["IMPAIRMENT"],
        auContext: false
      },
      {
        label: "Social communication below general developmental level",
        weight: 1.5,
        source: "clinician",
        specificity: "very high",
        ageRange: { min: 36, max: 999, unit: "months" },
        keywords: ["social communication below developmental level", "social-communication discrepancy"],
        regex: ["\\bsocial\\s+communication\\s+below\\s+(general\\s+)?(developmental|cognitive|expected)\\s+level\\b", "\\bsocial[-\\s]?communication\\s+discrepancy\\b"],
        negationRequired: false,
        crossTags: [],
        auContext: false,
        note: "Critical Criterion E differentiator from ID alone"
      },
      {
        label: "ID and ASD co-occurring — dual diagnosis indicated",
        weight: 1.5,
        source: "clinician",
        specificity: "very high",
        ageRange: { min: 36, max: 999, unit: "months" },
        keywords: ["ID and ASD co-occurring", "dual diagnosis", "intellectual disability and autism"],
        regex: ["\\b(ID\\s+and\\s+ASD\\s+co[-\\s]?occurring|dual\\s+diagnosis|intellectual\\s+disability\\s+and\\s+autism)"],
        negationRequired: false,
        crossTags: ["COOCCURRING"],
        auContext: false,
        note: "Both can co-occur — Criterion E is satisfied when both meet criteria independently"
      },
      {
        label: "Language disorder / DLD ruled out as primary",
        weight: 1.4,
        source: "clinician",
        specificity: "high",
        ageRange: { min: 36, max: 999, unit: "months" },
        keywords: ["DLD ruled out", "language disorder ruled out", "speech pathology assessment"],
        regex: ["\\b(DLD|developmental\\s+language\\s+disorders?|language\\s+disorders?)\\s+(ruled\\s+out|excluded|differentiated|primary\\s+excluded)", "\\bspeech\\s+pathology\\s+assessment\\s+(completed|reviewed)"],
        negationRequired: false,
        crossTags: ["COOCCURRING"],
        auContext: false
      },
      {
        label: "Hearing assessment normal (rules out hearing loss as cause)",
        weight: 1.5,
        source: "history",
        specificity: "very high",
        ageRange: { min: 6, max: 999, unit: "months" },
        keywords: ["hearing assessment normal", "audiology normal", "passed hearing test"],
        regex: ["\\b(hearing\\s+(assessments?|tests?)|audiolog\\w+)\\s+(normal|fine|clear|all\\s+clear|passed)", "\\bpassed\\s+(the\\s+)?hearing\\s+(test|screen)\\b"],
        negationRequired: false,
        crossTags: ["A2"],
        auContext: false
      },
      {
        label: "Vision assessment normal (rules out vision loss as cause)",
        weight: 1.3,
        source: "history",
        specificity: "high",
        ageRange: { min: 12, max: 999, unit: "months" },
        keywords: ["vision normal", "optometry normal", "passed vision test"],
        regex: ["\\b(vision\\s+(assessments?|tests?)|optomet\\w+|ophthalmolog\\w+)\\s+(normal|fine|clear|passed)\\b"],
        negationRequired: false,
        crossTags: [],
        auContext: false
      },
      {
        label: "Reactive Attachment Disorder / trauma differential considered",
        weight: 1.4,
        source: "clinician",
        specificity: "high",
        ageRange: { min: 24, max: 999, unit: "months" },
        keywords: ["RAD ruled out", "attachment disorder differential", "trauma differential"],
        regex: ["\\b(Reactive\\s+Attachment\\s+Disorder|RAD|attachment\\s+disorders?|trauma)\\s+(ruled\\s+out|differential|excluded|considered)"],
        negationRequired: false,
        crossTags: [],
        auContext: false
      },
      {
        label: "Selective mutism / social anxiety differential considered",
        weight: 1.4,
        source: "clinician",
        specificity: "high",
        ageRange: { min: 36, max: 999, unit: "months" },
        keywords: ["selective mutism ruled out", "social anxiety differential", "anxiety vs autism"],
        regex: ["\\b(selective\\s+mutism|social\\s+anxiety\\s+disorder?|SAD)\\s+(ruled\\s+out|differential|excluded|considered)"],
        negationRequired: false,
        crossTags: [],
        auContext: false
      },
      {
        label: "Stereotypic movement disorder ruled out as standalone",
        weight: 1.3,
        source: "clinician",
        specificity: "high",
        ageRange: { min: 24, max: 999, unit: "months" },
        keywords: ["stereotypic movement disorder ruled out"],
        regex: ["\\bstereotypic\\s+movement\\s+disorders?\\s+(ruled\\s+out|excluded|differentiated)"],
        negationRequired: false,
        crossTags: [],
        auContext: false
      },
      {
        label: "Genetic / neurological / FASD investigations completed or considered",
        weight: 1.4,
        source: "history",
        specificity: "high",
        ageRange: { min: 12, max: 999, unit: "months" },
        keywords: ["genetic testing", "FASD assessment", "neurology consult", "Fragile X"],
        regex: ["\\b(genetic\\s+(testing|investigations?)|FASD\\s+(assessments?|considered)|neurolog\\w+|Fragile\\s+X|microarray|chromosomal)"],
        negationRequired: false,
        crossTags: ["COOCCURRING"],
        auContext: false
      }
    ]
  },
  {
    domain: "Safety / risk indicators",
    code: "SAFETY",
    criterion: "Safety / risk indicators (clinical modifier)",
    criterionGroup: "MODIFIER",
    severityWeight: 1.0,
    detectionStrategy: "presence-dominant",
    markers: [
      {
        label: "Wandering / eloping in public settings",
        weight: 1.7,
        source: "parent",
        specificity: "very high",
        ageRange: { min: 24, max: 999, unit: "months" },
        keywords: [
          "wandering away",
          "wandered away",
          "wanders off",
          "eloping",
          "eloped",
          "elopement",
          "lost in shopping centre",
          "wandering in shops",
        ],
        regex: [
          "\\bwander(ing|s|ed)\\s+(away|off)\\s+(in\\s+)?(busy\\s+|public\\s+)?(settings?|places?|shopping\\s+centres?|shops?)",
          "\\belop(ing|ed|ement)\\b",
          "\\bprevious\\s+incidents?\\s+of\\s+wandering",
        ],
        negationRequired: false,
        crossTags: ["IMPAIRMENT"],
        auContext: true
      },
      {
        label: "Inconsistent road awareness",
        weight: 1.7,
        source: "parent",
        specificity: "very high",
        ageRange: { min: 36, max: 999, unit: "months" },
        keywords: [
          "road awareness",
          "inconsistent road awareness",
          "no road sense",
          "doesn't look before crossing",
          "no traffic awareness",
        ],
        regex: [
          "\\b(inconsistent|no|reduced|absent|poor)\\s+road\\s+awareness\\b",
          "\\b(doesn't|does\\s+not|won't)\\s+look\\s+(both\\s+ways\\s+)?before\\s+crossing",
          "\\bno\\s+traffic\\s+awareness\\b",
        ],
        negationRequired: false,
        crossTags: ["IMPAIRMENT"],
        auContext: false
      },
      {
        label: "Difficulty recognising environmental danger",
        weight: 1.6,
        source: "parent",
        specificity: "very high",
        ageRange: { min: 36, max: 999, unit: "months" },
        keywords: [
          "recognising danger",
          "recognise environmental danger",
          "doesn't recognise danger",
          "no danger awareness",
          "no sense of danger",
        ],
        regex: [
          "\\bdifficulty\\s+recognising\\s+(environmental\\s+)?dangers?\\b",
          "\\b(doesn't|does\\s+not)\\s+recognise\\s+dangers?\\b",
          "\\bno\\s+(sense\\s+of\\s+)?danger\\s+awareness\\b",
        ],
        negationRequired: false,
        crossTags: ["IMPAIRMENT"],
        auContext: false
      },
      {
        label: "Parents do not feel safe allowing independent community access",
        weight: 1.7,
        source: "parent",
        specificity: "very high",
        ageRange: { min: 60, max: 999, unit: "months" },
        keywords: [
          "do not feel safe",
          "don't feel safe",
          "not safe allowing",
          "independent community access",
          "cannot be left unsupervised",
        ],
        regex: [
          "\\b(do|does)\\s+not\\s+feel\\s+safe\\s+allowing\\s+independent",
          "\\bcannot\\s+be\\s+left\\s+unsupervised",
          "\\bindependent\\s+community\\s+access\\b",
        ],
        negationRequired: false,
        crossTags: ["IMPAIRMENT"],
        auContext: false
      }
    ]
  },
  {
    domain: "ADHD / executive overlap",
    code: "ADHD",
    severityWeight: 0.8,
    markers: [
      { label: "inattention", terms: ["inattention", "distractible", "difficulty sustaining attention", "does not listen", "forgetful", "task completion"] },
      { label: "hyperactivity / impulsivity", terms: ["impulsive", "hyperactive", "cannot sit", "restless", "runs", "elopement", "touching objects"] },
      { label: "executive functioning", terms: ["organisation", "planning", "follow-through", "working memory", "written output", "slow output"] },
    ],
  },
  {
    domain: "Masking / discrepancy",
    code: "MASKING",
    criterion: "Masking / context discrepancy (clinical modifier)",
    criterionGroup: "MODIFIER",
    severityWeight: 1.05,
    detectionStrategy: "presence-dominant",
    markers: [
      {
        label: "Masking / camouflaging (explicit)",
        weight: 1.7,
        source: "child",
        specificity: "very high",
        ageRange: { min: 72, max: 999, unit: "months" },
        keywords: ["masking", "camouflaging", "camouflage", "compensating for autism"],
        regex: ["\\b(masking|camouflag\\w*|compensat\\w*\\s+for\\s+autism)\\b"],
        negationRequired: false,
        crossTags: [],
        auContext: false,
        falsePositiveContexts: ["only social phobia", "social anxiety only diagnosis", "generalised anxiety only"],
      },
      {
        label: "Pretending to be normal / acting normal all day",
        weight: 1.65,
        source: "child",
        specificity: "very high",
        ageRange: { min: 72, max: 999, unit: "months" },
        keywords: ["pretending to be normal", "acting normal all day", "perform normal"],
        regex: [
          "\\bpretend(ing)?\\s+to\\s+be\\s+normal\\b",
          "\\bacting?\\s+normal\\s+all\\s+day\\b",
          "\\bperform(s|ing)?\\s+normal(ity)?\\b",
        ],
        negationRequired: false,
        crossTags: [],
        auContext: false,
      },
      {
        label: "Social performance / performs socially in public",
        weight: 1.55,
        source: "clinician",
        specificity: "high",
        ageRange: { min: 72, max: 999, unit: "months" },
        keywords: ["social performance", "performs socially", "performance at school"],
        regex: [
          "\\bsocial\\s+performance\\b",
          "\\bperform(s|ing)?\\s+socially\\b",
          "\\bhold(s|ing)?\\s+it\\s+together\\s+at\\s+school\\b",
        ],
        negationRequired: false,
        crossTags: [],
        auContext: false,
      },
      {
        label: "Exhausted / collapse / shutdown after school (masking fatigue pattern)",
        weight: 1.65,
        source: "parent",
        specificity: "very high",
        ageRange: { min: 48, max: 999, unit: "months" },
        keywords: [
          "exhausted after school",
          "collapse at home",
          "shutdown after school",
          "emotional collapse after school",
        ],
        regex: [
          "\\b(emotionally\\s+)?exhausted\\s+after\\s+school\\b",
          "\\b(collapse|meltdown)\\s+at\\s+home\\b",
          "\\bshutdown\\s+after\\s+school\\b",
          "\\bemotional\\s+collapse\\s+after\\s+school\\b",
          "\\bafter\\s+school\\b.*\\b(exhausted|drained|shutdown|collapse)\\b",
          "\\b(exhausted|drained|wiped\\s+out)\\b.*\\b(after\\s+school|school\\s+day)\\b",
        ],
        negationRequired: false,
        crossTags: [],
        auContext: false,
      },
      {
        label: "Different presentation at home vs school / context discrepancy",
        weight: 1.6,
        source: "parent",
        specificity: "very high",
        ageRange: { min: 36, max: 999, unit: "months" },
        keywords: ["different at home and school", "fine at school not at home", "school doesn't see"],
        regex: [
          "\\bdifferent\\s+presentation\\s+(at\\s+)?home\\s+(vs?\\.?|versus|compared\\s+to)\\s+school\\b",
          "\\b(home|after\\s+school)\\s+vs?\\.?\\s*school\\b.*\\b(different|contrast|discrepancy)\\b",
          "\\bfine\\s+at\\s+school\\b.*\\b(not\\s+fine|collapse|meltdown|exhausted)\\s+(at\\s+)?home\\b",
          "\\bteacher\\s+(average|fine|no\\s+concerns)\\b.*\\b(parent|home)\\b.*\\b(concern|collapse|distress)\\b",
        ],
        negationRequired: false,
        crossTags: [],
        auContext: false,
      },
      {
        label: "Social exhaustion / burnout / socially drained from interaction",
        weight: 1.55,
        source: "child",
        specificity: "high",
        ageRange: { min: 72, max: 999, unit: "months" },
        keywords: ["social exhaustion", "burnout", "socially drained", "fatigue from social"],
        regex: [
          "\\b(social(ly)?\\s+exhaustion|social(ly)?\\s+fatigue|social(ly)?\\s+drained)\\b",
          "\\bburnout\\s+(from\\s+)?(social|masking|people|interacting)\\b",
          "\\bfatigue\\s+from\\s+social\\s+(interaction|situations?)\\b",
          "\\b(conversations?|people|socialising)\\s+(are\\s+)?(exhausting|draining)\\b",
        ],
        negationRequired: false,
        crossTags: ["A1"],
        auContext: false,
        falsePositiveContexts: ["panic disorder", "agoraphobia as only explanation"],
      },
      {
        label: "Scripting socially / copies peers / rehearses conversations",
        weight: 1.5,
        source: "child",
        specificity: "high",
        ageRange: { min: 72, max: 999, unit: "months" },
        keywords: ["rehearses conversations", "scripts socially", "copies peers"],
        regex: [
          "\\b(script(s|ing)?|rehears(es|ing)?)\\s+(social|conversations?)\\b",
          "\\brehears(es|ing)?\\s+conversations?\\b",
          "\\bcop(y|ies|ying)\\s+peers?\\s+socially\\b",
          "\\blearn(ed|s|ing)?\\s+(social\\s+)?lines?\\b",
        ],
        negationRequired: false,
        crossTags: ["A1"],
        auContext: false,
      },
      {
        label: "Overthinks social interactions / hides difficulties externally",
        weight: 1.5,
        source: "child",
        specificity: "high",
        ageRange: { min: 72, max: 999, unit: "months" },
        keywords: ["overthinks social", "hides difficulties", "subtle presentation externally"],
        regex: [
          "\\boverthink\\w*\\s+social\\s+interactions?\\b",
          "\\bhides?\\s+(his|her|their)?\\s*difficulties\\s+(from\\s+)?(others?|teachers?|externally)\\b",
          "\\bsubtle\\s+presentation\\s+externally\\b",
          "\\binsightful\\s+but\\s+externally\\s+subtle\\b",
        ],
        negationRequired: false,
        crossTags: ["A1"],
        auContext: false,
      },
      {
        label: "Delayed recognition / late identification with compensatory profile",
        weight: 1.45,
        source: "clinician",
        specificity: "high",
        ageRange: { min: 72, max: 999, unit: "months" },
        keywords: ["delayed recognition", "late diagnosis", "missed in childhood"],
        regex: [
          "\\bdelayed\\s+recognition\\b",
          "\\blate(r)?\\s+(diagnosis|identification)\\b",
          "\\bmissed\\s+in\\s+(early\\s+)?childhood\\b",
          "\\bcompensat\\w*\\s+profile\\b.*\\b(autism|ASD)\\b",
        ],
        negationRequired: false,
        crossTags: [],
        auContext: false,
      },
      {
        label: "Post-demand / after-school fatigue and withdrawal (parent report)",
        weight: 1.45,
        source: "parent",
        specificity: "high",
        ageRange: { min: 36, max: 999, unit: "months" },
        keywords: ["withdraws after school", "needs downtime after school", "cannot tolerate demands after school"],
        regex: [
          "\\b(withdraws?|shuts?\\s+down)\\s+after\\s+school\\b",
          "\\b(needs?|requires)\\s+downtime\\s+after\\s+school\\b",
          "\\bunable\\s+to\\s+tolerate\\s+additional\\s+demands\\s+after\\s+school\\b",
        ],
        negationRequired: false,
        crossTags: [],
        auContext: false,
      },
      {
        label: "Scripted compensation / learned social strategies (explicit)",
        weight: 1.45,
        source: "parent",
        specificity: "high",
        ageRange: { min: 36, max: 999, unit: "months" },
        keywords: ["scripted responses", "rehearsed answers", "learned social strategies"],
        regex: [
          "\\b(scripted|rehearsed|memorised|learned)\\s+(responses?|answers?|social\\s+strategies?)\\b",
          "\\bmimic(s|king)?\\s+(peers?|classmates?)\\s+to\\s+fit\\s+in\\b",
        ],
        negationRequired: false,
        crossTags: ["A1"],
        auContext: false,
      },

      {
        label: "Self-reported pretending / performing in social contexts",
        weight: 1.7,
        source: "child",
        specificity: "very high",
        ageRange: { min: 96, max: 999, unit: "months" },
        keywords: [
          "pretending to be normal",
          "pretending to fit in",
          "feels like a performance",
          "feels like an act",
          "I'm acting",
          "I act around people",
          "putting on a face",
          "wearing a mask",
          "having to perform",
          "I have to perform",
          "fake it around people",
          "faking it",
        ],
        regex: [
          "\\bpretend(ing)?\\s+to\\s+be\\s+(normal|fine|okay)\\b",
          "\\bfeels?\\s+like\\s+(a|an)\\s+(performance|act|role)\\b",
          "\\bputting?\\s+on\\s+(a\\s+)?(face|mask|act|show)\\b",
          "\\bwear(ing)?\\s+a\\s+mask\\b",
          "\\bfak(e|ing)\\s+(it\\s+)?(around|with|at)\\b",
        ],
        negationRequired: false,
        crossTags: ["A1", "A3"],
        auContext: false,
      },
      {
        label: "Post-social exhaustion / decompression isolation",
        weight: 1.6,
        source: "parent",
        specificity: "very high",
        ageRange: { min: 60, max: 999, unit: "months" },
        keywords: [
          "exhausted after school",
          "exhausted after social",
          "wiped out after",
          "drained after",
          "isolates in bedroom",
          "retreats to bedroom",
          "needs to be alone after",
          "decompresses",
          "decompression time",
          "shuts down at home",
        ],
        regex: [
          "\\bexhaust(ed|ion)\\s+(after|following)\\s+(school|social|interaction|day)\\b",
          "\\b(isolate|retreat|hide)s?\\s+(in|to)\\s+(bedroom|room|space)\\s+(after|for\\s+hours)\\b",
          "\\bneeds?\\s+to\\s+be\\s+alone\\s+after\\b",
          "\\bdecompress(es|ion)?\\b",
        ],
        negationRequired: false,
        crossTags: ["IMPAIRMENT"],
        auContext: false,
      },
      {
        label: "School / home presentation discrepancy",
        weight: 1.7,
        source: "parent",
        specificity: "very high",
        ageRange: { min: 60, max: 999, unit: "months" },
        keywords: [
          "holds it together at school",
          "fine at school but",
          "keeps it together at school",
          "explodes at home",
          "falls apart at home",
          "emotional collapse at home",
          "different at home than school",
          "masks at school",
        ],
        regex: [
          "\\b(holds|keeps)\\s+it\\s+together\\s+at\\s+school\\b",
          "\\bfine\\s+at\\s+school\\s+but\\b",
          "\\b(explodes|falls\\s+apart|collapse)s?\\s+at\\s+home\\b",
          "\\bemotional\\s+collapse\\s+(at\\s+home|after\\s+school)\\b",
          "\\bmasking\\s+behaviou?r\\s+(externally|at\\s+school)\\b",
          "\\bmasks?\\s+at\\s+school\\b",
        ],
        negationRequired: false,
        crossTags: ["IMPAIRMENT"],
        auContext: false,
      },
      {
        label: "Going non-verbal / shutdown when overwhelmed",
        weight: 1.6,
        source: "child",
        specificity: "very high",
        ageRange: { min: 60, max: 999, unit: "months" },
        keywords: [
          "goes non-verbal",
          "going non-verbal",
          "stops talking when overwhelmed",
          "can't speak when overwhelmed",
          "shutdown state",
          "shutdown states",
          "shuts down at school",
          "freezes up",
          "freeze response",
        ],
        regex: [
          "\\bgo(es|ing)?\\s+non[-\\s]?verbal\\b",
          "\\bshut(down|s\\s+down)\\s+(state|when|at)\\b",
          "\\bcan(no|')t\\s+speak\\s+when\\s+(overwhelmed|stressed)\\b",
          "\\bfreeze(s|\\s+up|\\s+response)\\b",
        ],
        negationRequired: false,
        crossTags: ["A1", "IMPAIRMENT"],
        auContext: false,
      },
      {
        label: "Misperceived as rude / blunt / arrogant without intent",
        weight: 1.5,
        source: "parent",
        specificity: "very high",
        ageRange: { min: 84, max: 999, unit: "months" },
        keywords: [
          "viewed as rude",
          "seen as rude",
          "perceived as arrogant",
          "thought he was arrogant",
          "comes across as blunt",
          "doesn't mean to be rude",
          "didn't intend to offend",
          "unintentionally offended",
        ],
        regex: [
          "\\b(viewed|seen|perceived|thought|came\\s+across)\\s+as\\s+(rude|arrogant|blunt|cold|standoffish)\\b",
          "\\bdid(n'?t|\\s+not)\\s+(mean|intend)\\s+to\\s+(be|sound)\\s+(rude|offensive)\\b",
          "\\bunintentional(ly)?\\s+(offend|rude|hurt)",
          "\\bbluntness\\b",
        ],
        negationRequired: false,
        crossTags: ["A1", "A3"],
        auContext: false,
      },
      {
        label: "Conscious mental effort to navigate social interaction",
        weight: 1.5,
        source: "child",
        specificity: "high",
        ageRange: { min: 96, max: 999, unit: "months" },
        keywords: [
          "have to think about",
          "have to plan what to say",
          "rehearse conversations",
          "rehearsing conversations",
          "scripts in my head",
          "scripted in advance",
          "study how people interact",
          "study people",
          "copy how others",
          "overthinks social",
          "overthink interactions",
        ],
        regex: [
          "\\b(rehearse|practice|plan)s?\\s+(conversations?|what\\s+to\\s+say|interactions?)\\b",
          "\\bscripts?\\s+(in\\s+(my\\s+)?head|in\\s+advance|conversations)\\b",
          "\\bstudy(ing)?\\s+(how\\s+people|people|others)\\b",
          "\\bcopy(ing)?\\s+(how\\s+others|other\\s+people)\\b",
          "\\boverthink(s|ing)?\\s+(social|interactions?|conversations?)\\b",
        ],
        negationRequired: false,
        crossTags: ["A1", "A3"],
        auContext: false,
      },
      {
        label: "Anticipatory anxiety re social demand / school",
        weight: 1.4,
        source: "parent",
        specificity: "high",
        ageRange: { min: 84, max: 999, unit: "months" },
        keywords: [
          "anticipatory anxiety",
          "anxiety before school",
          "worried about presentations",
          "anxiety about group work",
          "dreads social events",
          "Sunday night anxiety",
          "anxiety about lunch break",
        ],
        regex: [
          "\\banticipatory\\s+anxiety\\b",
          "\\banxiety\\s+(before|about|around)\\s+(school|presentations?|group\\s+work|social|lunch)\\b",
          "\\bdread(s|ing)?\\s+(school|social|presentations?|group)",
          "\\b(Sunday\\s+night|night\\s+before)\\s+anxiety\\b",
        ],
        negationRequired: false,
        crossTags: ["IMPAIRMENT"],
        auContext: false,
      },
      {
        label: "School refusal / school avoidance episodes",
        weight: 1.6,
        source: "parent",
        specificity: "very high",
        ageRange: { min: 60, max: 216, unit: "months" },
        keywords: [
          "school refusal",
          "refusing school",
          "won't go to school",
          "school avoidance",
          "missing school due to anxiety",
          "can't get him to school",
          "stays home from school",
        ],
        regex: [
          "\\bschool\\s+refus(al|ing|es)\\b",
          "\\b(won'?t|wouldn'?t|can'?t)\\s+(go\\s+to|attend)\\s+school\\b",
          "\\bschool\\s+avoidance\\b",
          "\\bmissing\\s+school\\s+(due\\s+to|because\\s+of)\\s+(anxiety|overwhelm)\\b",
        ],
        negationRequired: false,
        crossTags: ["IMPAIRMENT"],
        auContext: true,
      },
      {
        label: "Concealment behaviours (hoodie, hat, hair, headphones)",
        weight: 1.3,
        source: "observation",
        specificity: "moderate",
        ageRange: { min: 96, max: 999, unit: "months" },
        keywords: [
          "hoodie up",
          "hoodie over head",
          "hat pulled low",
          "hat pulled down",
          "hair over face",
          "hair covering face",
          "headphones constantly",
          "hiding face",
        ],
        regex: [
          "\\bhoodie\\s+(up|over\\s+(head|face))\\b",
          "\\bhat\\s+(pulled\\s+(low|down)|down\\s+over)\\b",
          "\\bhair\\s+(over|covering|in\\s+front\\s+of)\\s+(face|eyes)\\b",
          "\\bheadphones?\\s+(constantly|always|all\\s+the\\s+time)\\b",
          "\\bhid(ing|es)\\s+(face|behind)\\b",
        ],
        negationRequired: false,
        crossTags: ["A2"],
        auContext: false,
      },
      {
        label: "Late-identified pattern / symptoms more pronounced at transition",
        weight: 1.5,
        source: "history",
        specificity: "high",
        ageRange: { min: 120, max: 999, unit: "months" },
        keywords: [
          "more pronounced in high school",
          "became obvious in high school",
          "became obvious at transition",
          "missed in childhood",
          "flew under the radar",
          "compensated until",
          "managed until high school",
        ],
        regex: [
          "\\bmore\\s+pronounced\\s+(in|at|during)\\s+(high\\s+school|secondary|transition|year\\s+\\d+)\\b",
          "\\bbecame\\s+(obvious|apparent|clear)\\s+(in\\s+high\\s+school|at\\s+transition|in\\s+year\\s+\\d+)\\b",
          "\\bmissed\\s+(in\\s+childhood|earlier|in\\s+primary)\\b",
          "\\bflew\\s+under\\s+the\\s+radar\\b",
          "\\bcompensat(ed|ing)\\s+until\\b",
          "\\bmanag(ed|ing)\\s+until\\s+(high\\s+school|year\\s+\\d+)\\b",
        ],
        negationRequired: false,
        crossTags: ["ONSET", "IMPAIRMENT"],
        auContext: false,
      },
      {
        label: "Self-reported difference / 'don't get people' / 'doesn't fit in'",
        weight: 1.5,
        source: "child",
        specificity: "high",
        ageRange: { min: 96, max: 999, unit: "months" },
        keywords: [
          "don't get people",
          "doesn't get people",
          "I don't understand people",
          "doesn't fit in",
          "feel different",
          "feel like an alien",
          "feel like I'm from a different planet",
          "everyone else seems to know",
          "I missed the manual",
          "missed the rules",
        ],
        regex: [
          "\\bdo(esn'?t|n'?t)\\s+get\\s+(people|others)\\b",
          "\\bdo(esn'?t|n'?t)\\s+understand\\s+people\\b",
          "\\bdo(esn'?t|n'?t)\\s+fit\\s+in\\b",
          "\\bfeels?\\s+(different|like\\s+an\\s+alien|like\\s+I'?m\\s+from)\\b",
          "\\beveryone\\s+else\\s+(seems\\s+to\\s+)?know(s)?\\b",
          "\\bmissed\\s+(the\\s+manual|the\\s+rules|something)\\b",
        ],
        negationRequired: false,
        crossTags: ["A1", "A3"],
        auContext: false,
      },
      {
        label: "Burnout / exhaustion / cumulative load language",
        weight: 1.4,
        source: "child",
        specificity: "moderate",
        ageRange: { min: 120, max: 999, unit: "months" },
        keywords: [
          "autistic burnout",
          "burnout from masking",
          "social battery",
          "low social battery",
          "drained from socialising",
          "overwhelmed by everything",
          "running on empty",
          "can't do this anymore",
        ],
        regex: [
          "\\b(autistic\\s+)?burnout\\s+(from\\s+masking|from\\s+school)?\\b",
          "\\bsocial\\s+battery\\b",
          "\\bdrained\\s+(from|after)\\s+(social|talking|interacting)\\b",
          "\\boverwhelm(ed|ing)\\s+by\\s+everything\\b",
          "\\brunning\\s+on\\s+empty\\b",
        ],
        negationRequired: false,
        crossTags: ["IMPAIRMENT"],
        auContext: false,
      },
      {
        label: "Friendship asymmetry / online-only / 1-2 friends maximum",
        weight: 1.3,
        source: "child",
        specificity: "moderate",
        ageRange: { min: 84, max: 999, unit: "months" },
        keywords: [
          "two friends",
          "2 friends maybe",
          "one friend",
          "1 friend",
          "no real friends",
          "only online friends",
          "all my friends online",
          "rarely initiates",
          "doesn't reach out",
        ],
        regex: [
          "\\b(2|two|1|one)\\s+friends?\\s+(maybe|only|at\\s+most)?\\b",
          "\\bno\\s+real\\s+friends?\\b",
          "\\b(only|all)\\s+(my\\s+)?friends?\\s+(are\\s+)?online\\b",
          "\\brarely\\s+initiate(s|d)?\\s+(in[-\\s]?person|contact|hangouts?)\\b",
          "\\bdo(esn'?t|n'?t)\\s+reach\\s+out\\b",
        ],
        negationRequired: false,
        crossTags: ["A3"],
        auContext: false,
      },
    ],
  },
];

// ---------------------------------------------------------------------------
// detectMarkers — enterprise detection engine (module-level; not inside UI)
// ---------------------------------------------------------------------------

function emptyStats() {
  return {
    totalEvaluated: 0,
    totalDetected: 0,
    primaryDetections: 0,
    crossTagDetections: 0,
    totalRegexMatches: 0,
    totalKeywordMatches: 0,
    totalAgeFiltered: 0,
    totalNegationFiltered: 0,
    totalDedupFiltered: 0,
    totalFalsePositiveFiltered: 0,
    detectionsByCode: {},
    detectionsBySource: {},
    detectionsByConfidenceTier: {},
    averageConfidence: 0,
    highSpecificityCount: 0,
    pathognomonicHits: 0,
    auContextHits: 0,
  };
}

function escapeRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function groupCount(arr: any[], key: string) {
  return arr.reduce((acc: Record<string, number>, item: any) => {
    const k = item[key] ?? "unknown";
    acc[k] = (acc[k] || 0) + 1;
    return acc;
  }, {});
}

function deriveCriterionGroup(code: string) {
  if (["A1", "A2", "A3"].includes(code)) return "A";
  if (["B1", "B2", "B3", "B4"].includes(code)) return "B";
  if (["ONSET", "DEVELOPMENTAL"].includes(code)) return "C";
  if (code === "IMPAIRMENT") return "D";
  if (["DIFFERENTIAL", "DIFF", "RULEOUT"].includes(code)) return "E";
  if (["MASKING", "SAFETY", "RISK", "COOCCURRING", "COMORBID"].includes(code)) return "MODIFIER";
  return "UNKNOWN";
}

function fingerprint(code: string, label: string, verbatim: string) {
  const v = (verbatim || "").toLowerCase().substring(0, 60);
  return `${code}::${label}::${v}`;
}

function resolveSpeaker(declared: string | undefined, markerDefault: string | undefined) {
  if (declared && declared !== "unknown") return declared;
  return markerDefault || "unknown";
}

const NEGATION_CUES = [
  "doesn't",
  "doesn't really",
  "does not",
  "didn't",
  "did not",
  "won't",
  "will not",
  "wouldn't",
  "would not",
  "can't",
  "cannot",
  "couldn't",
  "could not",
  "never",
  "no",
  "not",
  "fails to",
  "failed to",
  "fail to",
  "unable to",
  "isn't able",
  "wasn't able",
  "without",
  "lacking",
  "lacks",
  "absent",
  "absence of",
  "reduced",
  "limited",
  "minimal",
  "diminished",
  "poor",
  "no longer",
  "stopped",
  "rarely",
  "barely",
  "hardly",
  "refuses to",
  "refused to",
];

function checkNegation(sentence: string, matchedText: string) {
  if (!sentence) return { hasNegation: false, cue: null };
  const sLower = sentence.toLowerCase();
  const matchLower = matchedText.toLowerCase();
  const matchPos = sLower.indexOf(matchLower);
  if (matchPos === -1) return { hasNegation: false, cue: null };

  const window = sLower.substring(Math.max(0, matchPos - 60), matchPos);

  for (const cue of NEGATION_CUES) {
    const cueRegex = new RegExp(`\\b${escapeRegex(cue)}\\b`, "i");
    if (cueRegex.test(window)) {
      const otherCues = NEGATION_CUES.filter((c) => c !== cue);
      const doubleNeg = otherCues.some((c) => {
        const splitWindow = window.split(cueRegex)[1] || "";
        return new RegExp(`\\b${escapeRegex(c)}\\b`, "i").test(splitWindow);
      });
      return {
        hasNegation: !doubleNeg,
        cue: cue,
        doubleNegation: doubleNeg,
      };
    }
  }
  return { hasNegation: false, cue: null };
}

function checkFalsePositiveContext(sentence: string, fpContexts: string[] | undefined) {
  if (!fpContexts || !Array.isArray(fpContexts)) return { matched: false, context: null };
  const sLower = sentence.toLowerCase();
  for (const ctx of fpContexts) {
    if (sLower.includes(ctx.toLowerCase())) {
      return { matched: true, context: ctx };
    }
  }
  return { matched: false, context: null };
}

function splitIntoSentences(text: string) {
  const sentences: { text: string; start: number; end: number }[] = [];
  const regex = /[^.!?\n]+(?:[.!?]+|\n\n|$)/g;
  let match;
  while ((match = regex.exec(text)) !== null) {
    const trimmed = match[0].trim();
    if (trimmed.length > 0) {
      sentences.push({
        text: trimmed,
        start: match.index,
        end: match.index + match[0].length,
      });
    }
  }
  if (sentences.length === 0) {
    const t = text.trim();
    sentences.push({ text: t, start: 0, end: text.length });
  }
  return sentences;
}

function findContainingSentence(
  sentences: { text: string; start: number; end: number }[],
  position: number,
  matchLength: number = 0
) {
  if (!sentences || sentences.length === 0) return "";
  if (matchLength === undefined || matchLength === null || Number.isNaN(matchLength)) {
    if (typeof console !== "undefined" && console.warn) {
      console.warn("findContainingSentence: matchLength missing or invalid; using 0");
    }
    matchLength = 0;
  }
  const matchEnd = position + matchLength;

  for (const s of sentences) {
    if (position >= s.start && matchEnd <= s.end) {
      return s.text;
    }
  }

  for (const s of sentences) {
    if (position >= s.start && position < s.end) {
      return s.text;
    }
  }

  let best = sentences[0];
  for (const s of sentences) {
    if (s.start <= position && s.start >= best.start) {
      best = s;
    }
  }
  return best?.text || "";
}

/** Ensure ledger verbatim contains the matched span when the sentence splitter mis-aligns. */
function resolveVerbatimForDetection(
  sentences: { text: string; start: number; end: number }[],
  original: string,
  position: number,
  matchedText: string,
  fallbackSentence: string
): string {
  const mt = (matchedText || "").trim();
  if (!mt) return (fallbackSentence || "").trim();

  let v =
    (findContainingSentence(sentences, position, Math.max(mt.length, 1)) || "").trim() ||
    (fallbackSentence || "").trim();

  if (v && !v.toLowerCase().includes(mt.toLowerCase())) {
    const pad = 120;
    const start = Math.max(0, position - pad);
    const end = Math.min(original.length, position + mt.length + pad);
    v = original.slice(start, end).trim();
  }

  if (v && !v.toLowerCase().includes(mt.toLowerCase())) {
    v = mt;
  }

  return v || (fallbackSentence || "").trim();
}

function checkAgeGate(marker: any, ageMonths: number, retrospectiveMode: boolean) {
  if (!marker.ageRange) return { passes: true, reason: "no age gate" };
  const { min, max, unit, retrospective } = marker.ageRange;
  const ageInUnit = unit === "years" ? ageMonths / 12 : ageMonths;

  if (retrospective || retrospectiveMode) {
    return { passes: true, reason: "retrospective" };
  }

  if (ageInUnit < min) {
    return {
      passes: false,
      reason: `child age (${ageMonths} mo) below marker minimum (${min} ${unit})`,
    };
  }
  if (max < 999 && ageInUnit > max) {
    return {
      passes: false,
      reason: `child age (${ageMonths} mo) above marker maximum (${max} ${unit})`,
    };
  }
  return { passes: true, reason: "in range" };
}

function findMatches(marker: any, lowerTranscript: string, originalTranscript: string, sentences: { text: string; start: number; end: number }[]) {
  const rawMatches: any[] = [];

  if (marker.regex && Array.isArray(marker.regex)) {
    for (const pattern of marker.regex) {
      try {
        const rx = new RegExp(pattern, "gi");
        let m;
        while ((m = rx.exec(originalTranscript)) !== null) {
          const matchStart = m.index;
          const sentence = findContainingSentence(sentences, matchStart, m[0].length);
          rawMatches.push({
            matchedText: m[0],
            position: matchStart,
            sentence: sentence,
            viaRegex: true,
            viaKeyword: false,
            matchedPattern: pattern,
          });
          if (m.index === rx.lastIndex) rx.lastIndex++;
        }
      } catch (e) {
        /* invalid regex */
      }
    }
  }

  const scanPlainStrings = (strings: string[] | undefined) => {
    if (!strings || !Array.isArray(strings)) return;
    for (const kw of strings) {
      const kwLower = kw.toLowerCase();
      let pos = 0;
      while ((pos = lowerTranscript.indexOf(kwLower, pos)) !== -1) {
        const alreadyMatched = rawMatches.some(
          (mm) => pos >= mm.position && pos < mm.position + mm.matchedText.length
        );
        if (!alreadyMatched) {
          const sentence = findContainingSentence(sentences, pos, kw.length);
          rawMatches.push({
            matchedText: originalTranscript.substring(pos, pos + kw.length),
            position: pos,
            sentence: sentence,
            viaRegex: false,
            viaKeyword: true,
            matchedKeyword: kw,
          });
        }
        pos += kwLower.length;
      }
    }
  };

  scanPlainStrings(marker.terms);
  scanPlainStrings(marker.keywords);

  const matchesBySentence = new Map<string, any>();
  for (const m of rawMatches) {
    const key = (m.sentence && String(m.sentence).trim()) || `__pos_${m.position}__`;
    if (!matchesBySentence.has(key)) {
      matchesBySentence.set(key, m);
    }
  }
  return Array.from(matchesBySentence.values());
}

/**
 * detectMarkers — live detection engine (streaming-ready; see createDetectionSession)
 */
function detectMarkers(transcript: string, ageMonths: number, options: any, taxonomy: any[]) {
  if (!transcript || typeof transcript !== "string" || !transcript.trim()) {
    return { markers: [], stats: emptyStats(), warnings: ["Empty transcript"] };
  }
  if (!taxonomy || !Array.isArray(taxonomy)) {
    return { markers: [], stats: emptyStats(), warnings: ["Taxonomy not provided"] };
  }
  if (typeof ageMonths !== "number" || ageMonths < 0) {
    return { markers: [], stats: emptyStats(), warnings: ["Invalid age — provide age in months"] };
  }

  const {
    speaker = "unknown",
    setting = null,
    sessionId = null,
    existingMarkers = [],
    minConfidence = 0.4,
    maxMarkersPerCode = 50,
    timestamp = Date.now(),
    retrospectiveMode = false,
  } = options || {};

  const original = transcript.trim();
  const lower = original.toLowerCase();
  const sentences = splitIntoSentences(original);

  const existingFingerprints = new Set(
    existingMarkers.map((m: any) => fingerprint(m.code, m.label, m.verbatim || (m.hits && m.hits[0]) || ""))
  );

  const detected = [];
  const warnings = [];
  let totalEvaluated = 0;
  let totalRegexMatches = 0;
  let totalKeywordMatches = 0;
  let totalAgeFiltered = 0;
  let totalNegationFiltered = 0;
  let totalDedupFiltered = 0;
  let totalFalsePositiveFiltered = 0;

  for (const criterion of taxonomy) {
    if (!criterion.markers || !Array.isArray(criterion.markers)) continue;

    const codeBucket = [];

    for (const marker of criterion.markers) {
      totalEvaluated++;

      const ageGate = checkAgeGate(marker, ageMonths, retrospectiveMode);
      if (!ageGate.passes) {
        totalAgeFiltered++;
        continue;
      }

      const matches = findMatches(marker, lower, original, sentences);

      if (matches.length === 0) continue;

      if (matches.some((m) => m.viaRegex)) totalRegexMatches++;
      if (matches.some((m) => m.viaKeyword && !m.viaRegex)) totalKeywordMatches++;

      const validatedMatches = matches.filter((m) => {
        const negationStatus = checkNegation(m.sentence, m.matchedText);
        if (marker.negationRequired === true && !negationStatus.hasNegation) {
          totalNegationFiltered++;
          return false;
        }
        if (marker.negationRequired === false && negationStatus.hasNegation) {
          totalNegationFiltered++;
          return false;
        }
        m.negationContext = negationStatus;
        return true;
      });

      if (validatedMatches.length === 0) continue;

      const fpFiltered = validatedMatches.filter((m) => {
        if (!marker.falsePositiveContexts) return true;
        const fpRes = checkFalsePositiveContext(m.sentence, marker.falsePositiveContexts);
        if (fpRes.matched) {
          m.falsePositiveWarning = fpRes.context;
          totalFalsePositiveFiltered++;
          return false;
        }
        return true;
      });

      if (fpFiltered.length === 0) continue;

      for (const match of fpFiltered) {
        const fpKey = fingerprint(criterion.code, marker.label, match.matchedText);
        if (existingFingerprints.has(fpKey)) {
          totalDedupFiltered++;
          continue;
        }
        existingFingerprints.add(fpKey);

        const resolvedSource = resolveSpeaker(speaker, marker.source);

        const sourceMatchBonus =
          resolvedSource === marker.source ? 1.0 : resolvedSource === "unknown" ? 0.85 : 0.7;

        const specMultiplier =
          marker.specificity === "very high"
            ? 1.15
            : marker.specificity === "high"
              ? 1.0
              : marker.specificity === "moderate"
                ? 0.85
                : 0.7;

        const matchQualityMultiplier = match.viaRegex ? 1.0 : 0.85;

        const completenessMultiplier = match.sentence.split(/\s+/).length >= 4 ? 1.0 : 0.9;

        const baseWeight = marker.weight || 1.0;
        const criterionWeight = criterion.severityWeight || 1.0;
        const score = Number(
          (
            baseWeight *
            criterionWeight *
            specMultiplier *
            matchQualityMultiplier *
            sourceMatchBonus *
            completenessMultiplier
          ).toFixed(3)
        );

        const confidence = Number(Math.min(1, score / 2.5).toFixed(3));

        if (confidence < minConfidence) continue;

        const verbatimResolved = resolveVerbatimForDetection(
          sentences,
          original,
          match.position,
          match.matchedText,
          match.sentence
        );

        const detection = {
          code: criterion.code,
          criterion: criterion.criterion,
          criterionGroup: criterion.criterionGroup,
          label: marker.label,
          verbatim: verbatimResolved,
          matchedText: match.matchedText,
          matchPosition: match.position,
          source: resolvedSource,
          declaredSource: marker.source,
          setting: setting,
          sessionId: sessionId,
          timestamp: timestamp,
          speaker: speaker,
          weight: baseWeight,
          score: score,
          confidence: confidence,
          confidenceTier:
            confidence >= 0.8
              ? "Very High"
              : confidence >= 0.65
                ? "High"
                : confidence >= 0.5
                  ? "Moderate"
                  : "Low",
          specificity: marker.specificity,
          viaRegex: match.viaRegex,
          viaKeyword: match.viaKeyword,
          matchedKeyword: match.matchedKeyword || null,
          matchedPattern: match.matchedPattern || null,
          crossTags: marker.crossTags || [],
          auContext: marker.auContext || false,
          auContextNote: marker.auContextNote || null,
          note: marker.note || null,
          ageMonthsAtDetection: ageMonths,
          retrospective: retrospectiveMode || marker.ageRange?.retrospective === true,
          negationDetected: match.negationContext?.hasNegation || false,
          negationCue: match.negationContext?.cue || null,
          falsePositiveWarning: match.falsePositiveWarning || null,
        };

        codeBucket.push(detection);

        if (codeBucket.length >= maxMarkersPerCode) {
          warnings.push(`Per-code limit (${maxMarkersPerCode}) reached for ${criterion.code}`);
          break;
        }
      }
    }

    detected.push(...codeBucket);
  }

  const crossTagged = [];
  for (const det of detected) {
    if (!det.crossTags || det.crossTags.length === 0) continue;
    for (const tag of det.crossTags) {
      const pos = typeof det.matchPosition === "number" ? det.matchPosition : 0;
      const satelliteVerbatim = resolveVerbatimForDetection(
        sentences,
        original,
        pos,
        det.matchedText || "",
        findContainingSentence(sentences, pos, Math.max((det.matchedText || "").length, 1)) || det.verbatim
      );
      const fpKey = fingerprint(tag, det.label, det.matchedText || satelliteVerbatim || det.verbatim);
      if (existingFingerprints.has(fpKey)) continue;
      existingFingerprints.add(fpKey);

      crossTagged.push({
        ...det,
        code: tag,
        criterion: `Cross-tagged from ${det.code}`,
        criterionGroup: deriveCriterionGroup(tag),
        verbatim: satelliteVerbatim || det.verbatim,
        score: Number((det.score * 0.6).toFixed(3)),
        confidence: Number((det.confidence * 0.6).toFixed(3)),
        confidenceTier:
          det.confidence * 0.6 >= 0.65 ? "High" : det.confidence * 0.6 >= 0.5 ? "Moderate" : "Low",
        viaCrossTag: true,
        primaryCode: det.code,
        primaryLabel: det.label,
        inheritedFromPrimary: {
          code: det.code,
          label: det.label,
          matchPosition: det.matchPosition,
          matchedText: det.matchedText,
        },
      });
    }
  }

  const allDetections = [...detected, ...crossTagged];

  const stats = {
    totalEvaluated,
    totalDetected: allDetections.length,
    primaryDetections: detected.length,
    crossTagDetections: crossTagged.length,
    totalRegexMatches,
    totalKeywordMatches,
    totalAgeFiltered,
    totalNegationFiltered,
    totalDedupFiltered,
    totalFalsePositiveFiltered,
    detectionsByCode: groupCount(allDetections, "code"),
    detectionsBySource: groupCount(allDetections, "source"),
    detectionsByConfidenceTier: groupCount(allDetections, "confidenceTier"),
    averageConfidence:
      allDetections.length > 0
        ? Number((allDetections.reduce((s, d) => s + d.confidence, 0) / allDetections.length).toFixed(3))
        : 0,
    highSpecificityCount: allDetections.filter((d) => d.specificity === "very high").length,
    pathognomonicHits: allDetections.filter((d) => d.weight >= 1.7).length,
    auContextHits: allDetections.filter((d) => d.auContext === true).length,
  };

  return {
    markers: allDetections,
    stats,
    warnings,
    transcriptLength: original.length,
    ageMonths,
    speaker,
    setting,
    timestamp,
  };
}

function createDetectionSession(taxonomy: any[], sessionConfig: any) {
  sessionConfig = sessionConfig || {};
  const allMarkers: any[] = [];
  const seenFingerprints = new Set();

  return {
    sessionId: sessionConfig.sessionId || `session-${Date.now()}`,
    ageMonths: sessionConfig.ageMonths,
    startedAt: Date.now(),

    process(chunk: string, chunkOptions: any) {
      chunkOptions = chunkOptions || {};
      const result = detectMarkers(chunk, sessionConfig.ageMonths, {
        ...sessionConfig,
        ...chunkOptions,
        existingMarkers: allMarkers,
        sessionId: this.sessionId,
      }, taxonomy);
      for (const m of result.markers) {
        const fp = fingerprint(m.code, m.label, m.verbatim);
        if (!seenFingerprints.has(fp)) {
          seenFingerprints.add(fp);
          allMarkers.push(m);
        }
      }
      return result;
    },

    getAllMarkers() {
      return [...allMarkers];
    },

    reset() {
      allMarkers.length = 0;
      seenFingerprints.clear();
      this.startedAt = Date.now();
    },

    getSessionStats() {
      return {
        sessionId: this.sessionId,
        startedAt: this.startedAt,
        durationMs: Date.now() - this.startedAt,
        totalMarkers: allMarkers.length,
        byCode: groupCount(allMarkers, "code"),
        bySource: groupCount(allMarkers, "source"),
        bySetting: groupCount(allMarkers, "setting"),
        byConfidenceTier: groupCount(allMarkers, "confidenceTier"),
        pathognomonicHits: allMarkers.filter((m) => m.weight >= 1.7).length,
        auContextHits: allMarkers.filter((m) => m.auContext).length,
      };
    },
  };
}

const REQUIRED_ASD = ["A1", "A2", "A3", "B1", "B2", "B3", "B4", "IMPAIRMENT"];

function normalise(text: string): string {
  if (text == null || typeof text !== "string") return "";
  return text
    .replace(/\r\n/g, "\n")
    .replace(/\u00a0/g, " ")
    .replace(/^[ \t]*#{1,6}\s*/gm, "\n")
    .replace(/^[ \t]*[-*+]\s+/gm, "\n• ")
    .toLowerCase()
    .replace(/[“”]/g, '"')
    .replace(/[’]/g, "'");
}

function inferAgeMonthsFromNotes(rawText: string, fallbackMonths = 120): number {
  if (!rawText) return fallbackMonths;
  const t = rawText.slice(0, 4000);
  const yMatch =
    t.match(/\b(\d{1,2})\s*[-]?\s*years?\s*[-]?\s*old\b/i) ||
    t.match(/\bage(?:d)?\s*:?\s*(\d{1,2})\b/i) ||
    t.match(/\b(\d{1,2})\s*[-]?\s*yo\b/i);
  if (yMatch) {
    const y = parseInt(yMatch[1], 10);
    if (y >= 1 && y <= 25) return y * 12;
  }
  return fallbackMonths;
}

function extractMarkers(rawText: string): any[] {
  const ageMonths = inferAgeMonthsFromNotes(rawText, 120);
  const result = detectMarkers(rawText, ageMonths, { speaker: "unknown", setting: null }, TAXONOMY);
  const byCode = Object.fromEntries(TAXONOMY.map((c: any) => [c.code, c]));
  return result.markers.map((d: any) => {
    const crit = byCode[d.code];
    const hits = [d.matchedText, d.matchedKeyword].filter(Boolean);
    if (!hits.length && d.verbatim) hits.push(d.verbatim);
    return {
      ...d,
      code: d.code,
      domain: crit?.domain ?? d.code,
      label: d.label,
      hits,
      confidence: d.confidence,
      severityWeight: crit?.severityWeight ?? 1,
    };
  });
}

function groupByCode(markers: any[]): Record<string, any[]> {
  return markers.reduce((acc: Record<string, any[]>, item: any) => {
    acc[item.code] = acc[item.code] || [];
    acc[item.code].push(item);
    return acc;
  }, {});
}

function computeMarkerSignalIndex(markers: any[]): number {
  return markers.reduce((sum: number, m: any) => sum + m.confidence * m.severityWeight, 0);
}

/** Clinical threshold tier for DSM snapshot badges and signal line — not driven by raw marker volume alone. */
function deriveAsdThresholdSignalWording(markers: any[], contradictions: string[], notes: string): string {
  const g = groupByCode(markers);
  const aMet = ["A1", "A2", "A3"].every((c) => (g[c]?.length || 0) > 0);
  const bMet = ["B1", "B2", "B3", "B4"].filter((c) => (g[c]?.length || 0) > 0).length >= 2;
  const impairMet = (g.IMPAIRMENT?.length || 0) > 0;
  const coreAsdMarkers = markers.filter((m) =>
    ["A1", "A2", "A3", "B1", "B2", "B3", "B4"].includes(m.code)
  ).length;

  const n = notes || "";
  const traitsOrRuleOut =
    /\btraits?\s*-?\s*only\b|\bsub[- ]?threshold\b|\b(do|does)\s+not\s+meet\b.*\b(asd|criterion|dsm|threshold)\b|\bnot\s+consistent\s+with\s+(an?\s+)?asd\b|\bunlikely\s+to\s+meet\b.*\b(asd|threshold)\b|\bbetter\s+explained\s+by\b|\balternative\s+diagnos\w*\b|\brooling\s+out\s+asd\b|\bno\s+asd\b.*\b(criteria|threshold)\b/i.test(
      n
    );

  if (traitsOrRuleOut) return "Sub-threshold / traits-only signal";

  if (!aMet && !bMet && coreAsdMarkers < 6) return "Sub-threshold / traits-only signal";
  if (!aMet && coreAsdMarkers < 8) return "Sub-threshold / traits-only signal";

  const majorConflict =
    contradictions.length >= 2 ||
    contradictions.some((c) => /non-met|not met|both strong asd/i.test(c));

  if (aMet && bMet && impairMet && contradictions.length === 0 && !majorConflict) {
    return "Strong ASD threshold signal";
  }

  if (aMet && bMet && impairMet && contradictions.length >= 1) return "Partial / mixed ASD signal";
  if (majorConflict) return "Partial / mixed ASD signal";
  if ((aMet || bMet || coreAsdMarkers >= 4) && !(aMet && bMet && impairMet)) {
    return "Partial / mixed ASD signal";
  }

  return "Sub-threshold / traits-only signal";
}

const DOMAIN_FORMULATION_NARRATIVE: Record<string, string> = {
  A1: "social-emotional reciprocity, initiation, and back-and-forth interaction",
  A2: "nonverbal communication and how verbal and nonverbal behaviours fit together in interaction",
  A3: "peer relationships, social understanding, and adjusting behaviour to context",
  B1: "repetitive movements, repetitive use of objects or speech, and stereotyped patterns",
  B2: "insistence on sameness, routines, and difficulty coping with change or transitions",
  B3: "restricted or highly focused interests and how they show up day to day",
  B4: "sensory reactivity and sensory interests, and how these affect participation",
};

function generateDraft(markers: any[], noteText: string, contradictions: string[]) {
  const grouped = groupByCode(markers);
  const thresholdLine = deriveAsdThresholdSignalWording(markers, contradictions || [], noteText);
  const openers = [
    "Current information indicates longstanding differences in",
    "The available information describes",
    "Across parent report, observation, and collateral information documented to date, there are descriptions consistent with",
  ];

  const section = (code: string, fallback: string | null, openerIdx: number) => {
    const items = grouped[code] || [];
    if (!items.length) return fallback;
    const narrative = DOMAIN_FORMULATION_NARRATIVE[code] || "this domain";
    const opener = openers[openerIdx % openers.length];
    return `${opener} ${narrative}. This is a working synthesis from the live notes and should be integrated with full developmental history, structured observation, and differential formulation — not used as a stand-alone diagnosis.`;
  };

  const bCodes = ["B1", "B2", "B3", "B4"];
  const bPresent = bCodes.filter((c) => (grouped[c]?.length || 0) > 0);
  let Bblock: string;
  if (!bPresent.length) {
    Bblock =
      "Further information is required regarding restricted/repetitive patterns, rigidity, sensory processing, repetitive behaviours, and restricted interests.";
  } else {
    const parts = bPresent.map((c) => DOMAIN_FORMULATION_NARRATIVE[c]).join("; ");
    Bblock = `The available information also points to patterns in the restricted/repetitive domain — specifically ${parts}. These descriptions require the same cautious, multi-source interpretation as above.`;
  }

  return {
    A1: section(
      "A1",
      "Further information is required regarding social-emotional reciprocity, including initiation, conversational reciprocity, sharing of interests/emotions, and response to social approaches.",
      0
    ),
    A2: section(
      "A2",
      "Further information is required regarding nonverbal communication, including eye contact, facial expression, gesture use, body language, tone, and integration of verbal and nonverbal behaviour.",
      1
    ),
    A3: section(
      "A3",
      "Further information is required regarding peer relationships, social flexibility, play quality, friendship maintenance, and ability to adjust behaviour across contexts.",
      2
    ),
    B: Bblock,
    formulation: `Taken together, the live notes support the following working impression: ${thresholdLine}. Quantitative marker load (internal index ${computeMarkerSignalIndex(markers).toFixed(1)}) is secondary to criterion-level completeness and clinical context. Diagnostic conclusions should not be finalised from raw notes alone; continue to gather evidence across DSM-5 domains, early developmental history, functional impairment, cross-setting consistency, and alternative explanations including ADHD, anxiety, language disorder, trauma, intellectual disability, and environmental factors.`,
  };
}

function detectContradictions(rawText: string, markers: any[]): string[] {
  const text = normalise(rawText);
  const contradictions: string[] = [];
  const positiveASD = markers.filter((m: any) => ["A1", "A2", "A3", "B1", "B2", "B3", "B4"].includes(m.code)).length;

  if (positiveASD > 4 && (text.includes("teacher average") || text.includes("fine at school") || text.includes("no concerns at school"))) {
    contradictions.push("ASD markers detected, but school functioning may be reported as average or low concern. Treat as context discrepancy, masking, or environmental compensation until clarified.");
  }
  if (positiveASD > 3 && (text.includes("has friends") || text.includes("good friends") || text.includes("socially confident"))) {
    contradictions.push("Social strengths appear alongside ASD markers. Clarify quality, flexibility, reciprocity, sustainability, and social fatigue rather than assuming absence of impairment.");
  }
  if (text.includes("no speech delay") && (text.includes("language disorder") || text.includes("limited verbal") || text.includes("non-verbal"))) {
    contradictions.push("Language history appears inconsistent. Clarify early speech milestones versus current pragmatic or expressive language functioning.");
  }
  if (text.includes("not met") && positiveASD > 5) {
    contradictions.push("Notes contain both strong ASD markers and non-met wording. Review criterion-level evidence carefully before generating conclusion.");
  }

  return contradictions;
}

function buildMissingEvidence(markers: any[]): string[] {
  const grouped = groupByCode(markers);
  return REQUIRED_ASD.filter((code) => !grouped[code]).map((code) => {
    const label = TAXONOMY.find((t) => t.code === code)?.domain || code;
    return label;
  });
}

export const SAMPLE_NOTE = `Mother reports he needs prompting to say hello and does not initiate conversation unless it is about Minecraft. Eye contact limited and he looks away when asked social questions. He has one friend only and prefers to play alone. He becomes distressed with changes in routine and asks repeated questions about what is happening next. Loud noise and clothing tags bother him. Teacher says he is fine at school but he collapses after school and screams when plans change. No B1 repetitive motor behaviours reported yet.`;

function extractEvidenceSnippets(rawText: string, hitTerms: any[]): string[] {
  if (!rawText || !hitTerms?.length) return [];
  const sentences = splitIntoSentences(rawText);
  return sentences
    .map((s) => s.text)
    .filter((sentence: string) =>
      hitTerms.some(
        (term: any) => term && sentence.toLowerCase().includes(String(term).toLowerCase())
      )
    );
}

function markerStatus(confidence: number): string {
  if (confidence >= 0.78) return "use";
  if (confidence >= 0.62) return "clarify";
  return "weak";
}

function clinicalQuestionFor(code: string): string {
  if (code === "A1") return "Clarify initiation, reciprocity, emotional sharing, conversational turn-taking, and whether this occurs across settings.";
  if (code === "A2") return "Clarify eye contact, gesture use, facial expression, tone, body language, and interpretation of social cues.";
  if (code === "A3") return "Clarify friendship quality, social motivation, peer sustainability, social fatigue, play flexibility, and ability to adjust behaviour.";
  if (code === "B1") return "Clarify frequency, onset, context, regulation function, and whether repetitive behaviours are current or historical.";
  if (code === "B2") return "Clarify transition response, routine dependence, change tolerance, repetitive questioning, and functional impact.";
  if (code === "B3") return "Clarify intensity, duration, interference, flexibility, and whether interests dominate conversation or daily routines.";
  if (code === "B4") return "Clarify sensory modality, triggers, avoidance or seeking patterns, recovery time, and impact on school or home participation.";
  if (code === "SAFETY") return "Clarify wandering/elopement, road and environmental danger awareness, supervision needs, and parental safety concerns in community settings.";
  if (code === "ADHD") return "Clarify ADHD overlap and whether social communication issues exceed ADHD alone.";
  if (code === "MASKING") return "Clarify discrepancy pattern, school-home difference, compensation, scripted responding, and post-demand fatigue.";
  if (code === "IMPAIRMENT") return "Clarify educational, adaptive, safety, emotional, family-system, and community participation impact.";
  return "Clarify developmental history, cross-setting consistency, and alternative explanations.";
}

function buildEvidenceLedger(rawText: string, markers: any[]): any[] {
  return markers.map((marker: any, index: number) => {
    const verbatim = (marker.verbatim || "").trim();
    const matched = (marker.matchedText || "").trim();
    const evidence: string[] = [];
    if (verbatim) evidence.push(verbatim);
    if (matched && verbatim && !verbatim.toLowerCase().includes(matched.toLowerCase())) {
      evidence.unshift(`Matched span: “${matched}”`);
    }
    const snippets = extractEvidenceSnippets(rawText, marker.hits);
    for (const s of snippets) {
      if (s && !evidence.some((e) => e.includes(s) || s.includes(e))) evidence.push(s);
    }
    let satelliteNote: string | null = null;
    if (marker.viaCrossTag) {
      const primaryIdx = markers.findIndex(
        (m: any, i: number) =>
          i < index &&
          !m.viaCrossTag &&
          m.code === marker.primaryCode &&
          m.label === marker.primaryLabel &&
          m.matchPosition === marker.matchPosition
      );
      satelliteNote =
        primaryIdx >= 0
          ? `Satellite of EV-${String(primaryIdx + 1).padStart(3, "0")} (${marker.primaryCode}: ${marker.primaryLabel})`
          : `Cross-tag from ${marker.primaryCode}: ${marker.primaryLabel}`;
    }
    return {
      id: `EV-${String(index + 1).padStart(3, "0")}`,
      dsmCode: marker.code,
      domain: marker.domain,
      marker: marker.label,
      evidence: evidence.length ? evidence : snippets,
      hits: marker.hits,
      confidence: marker.confidence,
      status: markerStatus(marker.confidence),
      clinicalQuestion: clinicalQuestionFor(marker.code),
      satelliteNote,
      viaCrossTag: !!marker.viaCrossTag,
    };
  });
}

function domainReadiness(markers: any[]): any[] {
  const grouped = groupByCode(markers);
  return REQUIRED_ASD.map((code) => {
    const count = grouped[code]?.length || 0;
    const label = TAXONOMY.find((t) => t.code === code)?.domain || code;
    let status = "missing";
    if (count >= 3) status = "strong";
    else if (count >= 1) status = "partial";
    return { code, label, count, status };
  });
}
function estimateSupportNeeds(markers: any[]): { level: string; text: string } {
  const impairment = markers.filter((m: any) => m.code === "IMPAIRMENT");
  const masking = markers.filter((m: any) => m.code === "MASKING");

  const labels = impairment.map((m: any) => m.label.toLowerCase()).join(" ");

  let score = impairment.length * 2 + masking.length;

  if (labels.includes("self-care")) score += 2;
  if (labels.includes("self-management")) score += 2;
  if (labels.includes("school")) score += 2;
  if (labels.includes("support")) score += 2;
  if (labels.includes("supervision")) score += 3;
  if (labels.includes("safety")) score += 3;

  if (score >= 10) {
    return {
      level: "High support signal",
      text: "Current notes suggest substantial support needs across adaptive functioning, supervision, emotional regulation, and/or school participation.",
    };
  }

  if (score >= 5) {
    return {
      level: "Moderate support signal",
      text: "Current notes suggest clinically meaningful support needs, with evidence of reduced adaptive functioning and reliance on adult scaffolding.",
    };
  }

  if (score >= 2) {
    return {
      level: "Emerging support signal",
      text: "Some functional impact is present, though support intensity requires further clarification.",
    };
  }

  return {
    level: "Insufficient support data",
    text: "Current notes do not yet provide enough adaptive functioning evidence to estimate support needs.",
  };
}

export function inferSettingFromVerbatim(verbatim: string | undefined | null): string[] {
  const v = (verbatim || "").toLowerCase();
  const settings = new Set<string>();
  if (
    /\b(home|house|family|sibling|brother|sister|parent|mum|dad|mother|father|bedroom|bathroom|dinner|breakfast)\b/.test(
      v
    )
  )
    settings.add("home");
  if (
    /\b(school|classroom|teacher|playground|recess|lunch|class|kindy|prep|ea\b|education assistant|year\s+\d+|grade\s+\d+|assembly)\b/.test(
      v
    )
  )
    settings.add("school");
  if (
    /\b(shopping centre|shopping center|shops?|community|public|park|cinema|restaurant|bunnings|coles|woolworths|westfield|bus|train|public toilets?)\b/.test(
      v
    )
  )
    settings.add("community");
  if (/\b(peers?|friends?|playdate|party|sleepover|other (kids|children))\b/.test(v)) settings.add("peer");
  if (
    /\b(assessment|examiner|clinic|today|in the room|during the (interview|session|assessment))\b/.test(v)
  )
    settings.add("clinic");
  return Array.from(settings);
}

function detectCrossSettingImpact(notes: string, markers?: any[]) {
  const text = notes.toLowerCase();

  const settings: Record<string, string[]> = {
    home: ["home", "mum", "mother", "father", "parent", "dad", "family", "house", "sibling"],
    school: [
      "school",
      "teacher",
      "classroom",
      "education assistant",
      "ea support",
      "playground",
      "recess",
      "prep",
      "kindy",
      "lunch",
    ],
    community: [
      "community",
      "outing",
      "public",
      "shops",
      "shopping centre",
      "shopping center",
      "bunnings",
      "coles",
      "woolworths",
      "westfield",
      "park",
      "cinema",
    ],
    peer: ["friends", "peer", "peers", "friendship", "social", "playdate", "party", "sleepover"],
    clinic: ["assessment", "clinician", "observed", "examiner", "clinic", "session"],
  };

  const detectedSet = new Set<string>();
  for (const [key, terms] of Object.entries(settings)) {
    if (terms.some((term) => text.includes(term))) detectedSet.add(key);
  }
  if (markers && Array.isArray(markers)) {
    for (const m of markers) {
      for (const s of inferSettingFromVerbatim(m.verbatim)) detectedSet.add(s);
      for (const s of inferSettingFromVerbatim(typeof m.matchedText === "string" ? m.matchedText : "")) {
        detectedSet.add(s);
      }
    }
  }
  const detected = Array.from(detectedSet);

  return {
    detected,
    count: detected.length,
    settingsCount: detected.length,
    discrepancy:
      text.includes("fine at school") ||
      text.includes("different at home") ||
      text.includes("home collapse") ||
      text.includes("collapses after school"),
    summary:
      detected.length >= 3
        ? "Cross-setting functional impact is evident across multiple everyday environments."
        : detected.length >= 2
          ? "Functional impact is present across more than one setting."
          : "Cross-setting impact requires further clarification.",
  };
}

function generateClinicalSummary(markers: any[], supportNeeds: any, crossSetting: any): string {
  if (!markers.length) {
    return "No clinical summary can be generated yet. Begin entering live assessment notes.";
  }

  const grouped = groupByCode(markers);
  const a = ["A1", "A2", "A3"].filter((code) => grouped[code]?.length);
  const b = ["B1", "B2", "B3", "B4"].filter((code) => grouped[code]?.length);
  const impairment = grouped["IMPAIRMENT"] || [];
  const masking = grouped["MASKING"] || [];

  if (a.length < 3 || b.length < 2 || impairment.length === 0) {
    return `The current notes indicate emerging neurodevelopmental features. Evidence is present across ${a.length}/3 Criterion A domains, ${b.length}/4 Criterion B domains, and ${impairment.length ? "functional/adaptive impact" : "functional impact requires clarification"}. Further evidence is required before DSM-5 diagnostic wording and level of support can be stated.`;
  }

  return `The available evidence is consistent with a neurodevelopmental profile characterised by persistent differences in social communication and restricted/repetitive patterns of behaviour. Functional impact is evident through adaptive functioning and support needs. ${crossSetting.summary} ${masking.length ? "A masking or context-discrepancy pattern is also suggested. " : ""}Current support-needs estimate: ${supportNeeds.level}. ${supportNeeds.text}`;
}

function buildDSMMatrix(markers: any[]): any {
  const grouped = groupByCode(markers);

  const rows: any = [
    ["A1", "Social-emotional reciprocity", "Required"],
    ["A2", "Nonverbal communication", "Required"],
    ["A3", "Relationships / social understanding", "Required"],
    ["B1", "Repetitive motor/speech/object use", "2 of B1–B4 required"],
    ["B2", "Rigidity / sameness / transitions", "2 of B1–B4 required"],
    ["B3", "Restricted / fixated interests", "2 of B1–B4 required"],
    ["B4", "Sensory processing differences", "2 of B1–B4 required"],
    ["IMPAIRMENT", "Functional / adaptive impairment", "Required"],
    ["SAFETY", "Safety / risk", "Clinical modifier"],
    ["MASKING", "Masking / context discrepancy", "Clinical modifier"],
  ].map(([code, criterion, threshold]) => {
    const items = grouped[code] || [];
    const count = items.length;

    return {
      code,
      criterion,
      threshold,
      count,
      status: count >= 3 ? "Strong" : count >= 1 ? "Partial" : "Missing",
      confidence: count >= 3 ? "High" : count >= 1 ? "Moderate" : "None",
      labels: items.map((item) => item.label),
    };
  });

  rows.summary = {
    criterionA: {
      met: ["A1", "A2", "A3"].every((code) => grouped[code]?.length),
    },
    criterionB: {
      met: ["B1", "B2", "B3", "B4"].filter((code) => grouped[code]?.length).length >= 2,
    },
  };

  return rows;
}


function calculateDiagnosticReadiness(markers: any, crossSetting: any, supportNeeds: any): any {
    
        // ============================================================
        // GUARD
        // ============================================================
        if (!markers || !Array.isArray(markers)) {
          markers = [];
        }
      
        const grouped = groupByCode(markers);
      
        // ============================================================
        // ROW DEFINITIONS — DSM-5-TR aligned, clinically descriptive
        // ============================================================
        const rowDefinitions = [
          // -------------------- CRITERION A --------------------
          {
            code: "A1",
            criterion: "Deficits in social-emotional reciprocity",
            criterionGroup: "A",
            criterionGroupLabel: "Persistent deficits in social communication and social interaction",
            required: true,
            threshold: "Required (all 3 of A1–A3)",
            dsmReference: "DSM-5-TR 299.00 Criterion A1",
            examples: [
              "Reduced sharing of interests, emotions, or affect",
              "Failure of normal back-and-forth conversation",
              "Reduced initiation of social interaction",
            ],
            ndisDomain: "Social interaction",
          },
          {
            code: "A2",
            criterion: "Deficits in nonverbal communicative behaviours",
            criterionGroup: "A",
            criterionGroupLabel: "Persistent deficits in social communication and social interaction",
            required: true,
            threshold: "Required (all 3 of A1–A3)",
            dsmReference: "DSM-5-TR 299.00 Criterion A2",
            examples: [
              "Poorly integrated verbal and nonverbal communication",
              "Abnormalities in eye contact and body language",
              "Deficits in understanding and use of gestures",
              "Lack of facial expressions or nonverbal communication",
            ],
            ndisDomain: "Communication",
          },
          {
            code: "A3",
            criterion: "Deficits in developing, maintaining, and understanding relationships",
            criterionGroup: "A",
            criterionGroupLabel: "Persistent deficits in social communication and social interaction",
            required: true,
            threshold: "Required (all 3 of A1–A3)",
            dsmReference: "DSM-5-TR 299.00 Criterion A3",
            examples: [
              "Difficulties adjusting behaviour to suit social contexts",
              "Difficulties in sharing imaginative play or making friends",
              "Absence of interest in peers",
            ],
            ndisDomain: "Social interaction",
          },
      
          // -------------------- CRITERION B --------------------
          {
            code: "B1",
            criterion: "Stereotyped or repetitive motor movements, use of objects, or speech",
            criterionGroup: "B",
            criterionGroupLabel: "Restricted, repetitive patterns of behaviour, interests, or activities",
            required: false,
            threshold: "≥2 of B1–B4 required",
            dsmReference: "DSM-5-TR 299.00 Criterion B1",
            examples: [
              "Simple motor stereotypies (hand-flapping, finger-flicking)",
              "Lining up toys or flipping objects",
              "Echolalia, scripted speech, or idiosyncratic phrases",
            ],
            ndisDomain: "Self-management",
          },
          {
            code: "B2",
            criterion: "Insistence on sameness, inflexible adherence to routines, or ritualised patterns",
            criterionGroup: "B",
            criterionGroupLabel: "Restricted, repetitive patterns of behaviour, interests, or activities",
            required: false,
            threshold: "≥2 of B1–B4 required",
            dsmReference: "DSM-5-TR 299.00 Criterion B2",
            examples: [
              "Extreme distress at small changes",
              "Difficulties with transitions",
              "Rigid thinking patterns",
              "Need to take same route or eat same food every day",
            ],
            ndisDomain: "Self-management",
          },
          {
            code: "B3",
            criterion: "Highly restricted, fixated interests abnormal in intensity or focus",
            criterionGroup: "B",
            criterionGroupLabel: "Restricted, repetitive patterns of behaviour, interests, or activities",
            required: false,
            threshold: "≥2 of B1–B4 required",
            dsmReference: "DSM-5-TR 299.00 Criterion B3",
            examples: [
              "Strong attachment to or preoccupation with unusual objects",
              "Excessively circumscribed or perseverative interests",
            ],
            ndisDomain: "Learning",
          },
          {
            code: "B4",
            criterion: "Hyper- or hyporeactivity to sensory input or unusual sensory interests",
            criterionGroup: "B",
            criterionGroupLabel: "Restricted, repetitive patterns of behaviour, interests, or activities",
            required: false,
            threshold: "≥2 of B1–B4 required",
            dsmReference: "DSM-5-TR 299.00 Criterion B4",
            examples: [
              "Apparent indifference to pain or temperature",
              "Adverse response to specific sounds or textures",
              "Excessive smelling or touching of objects",
              "Visual fascination with lights or movement",
            ],
            ndisDomain: "Self-care",
          },
      
          // -------------------- CRITERION C --------------------
          {
            code: "ONSET",
            criterion: "Symptoms present in the early developmental period",
            criterionGroup: "C",
            criterionGroupLabel: "Developmental onset",
            required: true,
            threshold: "Required (may not become fully manifest until social demands exceed capacity)",
            dsmReference: "DSM-5-TR 299.00 Criterion C",
            aliases: ["DEVELOPMENTAL"],
            examples: [
              "Concerns identified before age 3 by parent or carer",
              "Personal Health Record / Blue Book entries indicating early differences",
              "Early childhood education / kindy reports of concern",
              "Delayed or atypical milestones",
              "Late identification with retrospective developmental history consistent with early onset",
            ],
            ndisDomain: "Permanence anchor",
          },
      
          // -------------------- CRITERION D --------------------
          {
            code: "IMPAIRMENT",
            criterion: "Clinically significant impairment in social, occupational, or other areas of current functioning",
            criterionGroup: "D",
            criterionGroupLabel: "Functional / adaptive impairment",
            required: true,
            threshold: "Required",
            dsmReference: "DSM-5-TR 299.00 Criterion D",
            examples: [
              "Substantially reduced functional capacity in daily living",
              "Educational adjustments required (NCCD, IEP, EA support)",
              "Reduced peer relationships and social participation",
              "Family system impact (carer payment, reduced employment, respite)",
              "Self-care, communication, learning, mobility, or self-management deficits",
            ],
            ndisDomain: "All six NDIS functional domains",
          },
      
          // -------------------- CRITERION E (differential) --------------------
          {
            code: "DIFFERENTIAL",
            criterion: "Disturbance not better explained by intellectual disability or global developmental delay alone",
            criterionGroup: "E",
            criterionGroupLabel: "Differential diagnosis",
            required: true,
            threshold: "Required",
            dsmReference: "DSM-5-TR 299.00 Criterion E",
            aliases: ["DIFF", "RULEOUT"],
            examples: [
              "Social communication below that expected for general developmental level",
              "Cognitive assessment completed (WPPSI-IV / WISC-V)",
              "Adaptive functioning assessment completed (Vineland-3 / ABAS-3)",
              "ID and ASD may co-occur and require dual diagnosis where both criteria met",
            ],
            ndisDomain: "Diagnostic integrity",
          },
      
          // -------------------- CLINICAL MODIFIERS --------------------
          {
            code: "MASKING",
            criterion: "Masking, camouflaging, or context-dependent presentation",
            criterionGroup: "MODIFIER",
            criterionGroupLabel: "Clinical modifiers",
            required: false,
            threshold: "Clinical modifier (interpretive)",
            dsmReference: "Not a DSM criterion — interpretive overlay",
            examples: [
              "Holds together at school, decompensates at home",
              "Mimicked / scripted social interactions",
              "Late identification, particularly female / AFAB presentations",
              "Internalised distress secondary to camouflaging",
            ],
            ndisDomain: "Modifies interpretation of all domains",
          },
          {
            code: "SAFETY",
            criterion: "Safety / risk indicators",
            criterionGroup: "MODIFIER",
            criterionGroupLabel: "Clinical modifiers",
            required: false,
            threshold: "Clinical modifier (risk-elevating)",
            dsmReference: "Not a DSM criterion — risk overlay",
            aliases: ["RISK"],
            examples: [
              "Eloping / wandering / bolting",
              "Absent road safety awareness",
              "Absent stranger danger awareness",
              "Self-injurious behaviour",
              "Aggression requiring restraint",
            ],
            ndisDomain: "Mobility / self-management / safety planning",
          },
          {
            code: "COOCCURRING",
            criterion: "Co-occurring conditions",
            criterionGroup: "MODIFIER",
            criterionGroupLabel: "Clinical modifiers",
            required: false,
            threshold: "Clinical modifier (compounds impact)",
            dsmReference: "Not a DSM criterion — comorbidity overlay",
            aliases: ["COMORBID"],
            examples: [
              "ADHD",
              "Intellectual Disability",
              "Language Disorder / DLD",
              "Anxiety / OCD / Depression",
              "Tic disorders",
              "DCD / motor coordination difficulties",
              "FASD / genetic syndromes",
            ],
            ndisDomain: "Compounds across all domains",
          },
        ];
      
        // ============================================================
        // ROW STATE COMPUTATION
        // ============================================================
        const rows = rowDefinitions.map((row) => {
          // Pull markers from primary code + any aliases
          const codes = [row.code, ...(row.aliases || [])];
          const items = codes.flatMap((c) => grouped[c] || []);
          const count = items.length;
      
          // ---- Evidence status (granular, not binary) ----
          let evidenceState;
          if (count === 0) evidenceState = "Absent";
          else if (count === 1) evidenceState = "Initial";
          else if (count === 2) evidenceState = "Partial";
          else if (count <= 4) evidenceState = "Established";
          else evidenceState = "Robust";
      
          // ---- Threshold state (per-row contribution to DSM threshold) ----
          let thresholdState;
          if (row.required && count === 0) thresholdState = "Not Met";
          else if (row.required && count >= 1) thresholdState = "Met";
          else if (!row.required && row.criterionGroup === "B") thresholdState = count >= 1 ? "Contributing" : "Not Contributing";
          else thresholdState = count >= 1 ? "Documented" : "Not Documented";
      
          // ---- Confidence (depth × specificity proxy) ----
          let confidence;
          if (count === 0) confidence = "None";
          else if (count === 1) confidence = "Low";
          else if (count === 2) confidence = "Moderate";
          else if (count <= 4) confidence = "High";
          else confidence = "Very High";
      
          // ---- Visual status (legacy compatibility — same values as original) ----
          let status;
          if (count >= 3) status = "Strong";
          else if (count >= 1) status = "Partial";
          else status = "Missing";
      
          // ---- Cross-setting distribution per marker (if available) ----
          const settingDistribution: Record<string, number> = {};
          items.forEach((item: any) => {
            const settings = item.settings || (item.setting ? [item.setting] : []);
            settings.forEach((s: string) => {
              settingDistribution[s] = (settingDistribution[s] || 0) + 1;
            });
          });
          const settingCount = Object.keys(settingDistribution).length;
      
          // ---- Source quality breakdown (clinician/parent/teacher/standardised) ----
          const sourceBreakdown = items.reduce((acc: Record<string, number>, item: any) => {
            const src = item.source || "unspecified";
            acc[src] = (acc[src] || 0) + 1;
            return acc;
          }, {});
      
          return {
            code: row.code,
            criterion: row.criterion,
            criterionGroup: row.criterionGroup,
            criterionGroupLabel: row.criterionGroupLabel,
            required: row.required,
            threshold: row.threshold,
            dsmReference: row.dsmReference,
            ndisDomain: row.ndisDomain,
            examples: row.examples,
            count,
            status, // legacy: Strong / Partial / Missing
            evidenceState, // Absent / Initial / Partial / Established / Robust
            thresholdState, // Met / Not Met / Contributing / Documented
            confidence, // None / Low / Moderate / High / Very High
            markers: items.map((item) => ({
              label: item.label,
              setting: item.setting || item.settings || null,
              source: item.source || null,
              timestamp: item.timestamp || null,
              verbatim: item.verbatim || null,
            })),
            labels: items.map((item) => item.label), // legacy compatibility
            settingDistribution,
            settingCount,
            sourceBreakdown,
          };
        });
      
        // ============================================================
        // CRITERION GROUP ROLL-UPS
        // ============================================================
        const criterionA = rows.filter((r) => r.criterionGroup === "A");
        const criterionB = rows.filter((r) => r.criterionGroup === "B");
        const criterionC = rows.find((r) => r.criterionGroup === "C");
        const criterionD = rows.find((r) => r.criterionGroup === "D");
        const criterionE = rows.find((r) => r.criterionGroup === "E");
        const modifiers = rows.filter((r) => r.criterionGroup === "MODIFIER");
      
        const aSubDomainsPresent = criterionA.filter((r) => r.count > 0).length;
        const bSubDomainsPresent = criterionB.filter((r) => r.count > 0).length;
      
        const summary = {
          criterionA: {
            label: "Persistent deficits in social communication and social interaction",
            met: aSubDomainsPresent === 3,
            subDomainsPresent: aSubDomainsPresent,
            subDomainsRequired: 3,
            subDomainsTotal: 3,
            missing: criterionA.filter((r) => r.count === 0).map((r) => r.code),
            totalMarkers: criterionA.reduce((sum, r) => sum + r.count, 0),
          },
          criterionB: {
            label: "Restricted, repetitive patterns of behaviour, interests, or activities",
            met: bSubDomainsPresent >= 2,
            subDomainsPresent: bSubDomainsPresent,
            subDomainsRequired: 2,
            subDomainsTotal: 4,
            missing: criterionB.filter((r) => r.count === 0).map((r) => r.code),
            contributing: criterionB.filter((r) => r.count > 0).map((r) => r.code),
            totalMarkers: criterionB.reduce((sum, r) => sum + r.count, 0),
          },
          criterionC: {
            label: "Symptoms in the early developmental period",
            met: (criterionC?.count || 0) > 0,
            markerCount: criterionC?.count || 0,
            status: (criterionC?.count || 0) > 0 ? "Documented" : "Pending developmental history",
          },
          criterionD: {
            label: "Clinically significant functional impairment",
            met: (criterionD?.count || 0) > 0,
            markerCount: criterionD?.count || 0,
            depth:
              (criterionD?.count || 0) >= 5 ? "Robust"
              : (criterionD?.count || 0) >= 3 ? "Substantial"
              : (criterionD?.count || 0) >= 1 ? "Limited"
              : "Not documented",
          },
          criterionE: {
            label: "Not better explained by ID or GDD alone",
            met: (criterionE?.count || 0) > 0,
            markerCount: criterionE?.count || 0,
            status: (criterionE?.count || 0) > 0 ? "Addressed" : "Pending cognitive/adaptive assessment",
          },
          modifiers: {
            masking: modifiers.find((r) => r.code === "MASKING")?.count || 0,
            safety: modifiers.find((r) => r.code === "SAFETY")?.count || 0,
            cooccurring: modifiers.find((r) => r.code === "COOCCURRING")?.count || 0,
          },
        };
      
        // ============================================================
        // OVERALL DIAGNOSTIC THRESHOLD STATE
        // ============================================================
        const allCoreCriteriaMet =
          summary.criterionA.met &&
          summary.criterionB.met &&
          summary.criterionC.met &&
          summary.criterionD.met &&
          summary.criterionE.met;
      
        const coreCriteriaMet = [
          summary.criterionA.met,
          summary.criterionB.met,
          summary.criterionC.met,
          summary.criterionD.met,
          summary.criterionE.met,
        ].filter(Boolean).length;
      
        let dsmThresholdState;
        if (allCoreCriteriaMet) dsmThresholdState = "All criteria met";
        else if (coreCriteriaMet >= 4) dsmThresholdState = "Near threshold (1 criterion outstanding)";
        else if (coreCriteriaMet >= 2) dsmThresholdState = "Partial — multiple criteria outstanding";
        else if (coreCriteriaMet >= 1) dsmThresholdState = "Initial — most criteria outstanding";
        else dsmThresholdState = "Insufficient";
      
        // ============================================================
        // MISSING DOMAIN PRIORITISATION
        // ============================================================
        const missingDomains = [];
      
        if (!summary.criterionA.met) {
          summary.criterionA.missing.forEach((code: string) => {
            const row = rows.find((r) => r.code === code);
            if (!row) return;
            missingDomains.push({
              code,
              criterion: row.criterion,
              priority: "Critical",
              reason: "Required for Criterion A — all 3 sub-domains needed",
              suggestedFocus: row.examples,
            });
          });
        }
      
        if (!summary.criterionB.met) {
          const needed = 2 - summary.criterionB.subDomainsPresent;
          missingDomains.push({
            code: "B",
            criterion: "Criterion B sub-domains",
            priority: "Critical",
            reason: `${needed} additional B sub-domain${needed > 1 ? "s" : ""} required (currently ${summary.criterionB.subDomainsPresent}/4, minimum 2)`,
            suggestedFocus: criterionB
              .filter((r) => r.count === 0)
              .map((r) => `${r.code}: ${r.criterion}`),
          });
        }
      
        if (!summary.criterionC.met) {
          missingDomains.push({
            code: "ONSET",
            criterion: "Developmental onset (Criterion C)",
            priority: "Critical",
            reason: "DSM-5-TR requires evidence of early developmental presentation",
            suggestedFocus: criterionC?.examples || [],
          });
        }
      
        if (!summary.criterionD.met) {
          missingDomains.push({
            code: "IMPAIRMENT",
            criterion: "Functional impairment (Criterion D)",
            priority: "Critical",
            reason: "Required for both DSM-5-TR diagnosis and NDIS eligibility",
            suggestedFocus: criterionD?.examples || [],
          });
        } else if (summary.criterionD.depth === "Limited") {
          missingDomains.push({
            code: "IMPAIRMENT",
            criterion: "Functional impairment depth",
            priority: "High",
            reason: "Functional impairment evidence is limited — expand across additional domains",
            suggestedFocus: ["Document impact across home, school, community, peer, and clinic settings"],
          });
        }
      
        if (!summary.criterionE.met) {
          missingDomains.push({
            code: "DIFFERENTIAL",
            criterion: "Differential diagnosis (Criterion E)",
            priority: "High",
            reason: "Cognitive and adaptive functioning assessment required to differentiate from / co-diagnose ID",
            suggestedFocus: criterionE?.examples || [],
          });
        }
      
        // ============================================================
        // SUPPORT EVIDENCE BREAKDOWN
        // ============================================================
        const supportEvidence = {
          sensoryProfile: {
            depth: criterionB.find((r) => r.code === "B4")?.count || 0,
            characterised:
              (criterionB.find((r) => r.code === "B4")?.count || 0) >= 2
                ? "Adequately characterised"
                : "Requires further detail",
          },
          rigidityProfile: {
            depth: criterionB.find((r) => r.code === "B2")?.count || 0,
            characterised:
              (criterionB.find((r) => r.code === "B2")?.count || 0) >= 2
                ? "Adequately characterised"
                : "Requires further detail",
          },
          interestsProfile: {
            depth: criterionB.find((r) => r.code === "B3")?.count || 0,
          },
          stereotypyProfile: {
            depth: criterionB.find((r) => r.code === "B1")?.count || 0,
          },
          masking: {
            present: summary.modifiers.masking > 0,
            depth: summary.modifiers.masking,
            interpretiveImpact:
              summary.modifiers.masking > 0
                ? "Observable presentation may underestimate true support needs"
                : null,
          },
          safety: {
            present: summary.modifiers.safety > 0,
            depth: summary.modifiers.safety,
            escalates: summary.modifiers.safety > 0,
            planningRequired: summary.modifiers.safety > 0,
          },
          cooccurring: {
            present: summary.modifiers.cooccurring > 0,
            depth: summary.modifiers.cooccurring,
            compounds: summary.modifiers.cooccurring > 0,
          },
        };
      
        // ============================================================
        // OVERALL CONFIDENCE
        // ============================================================
        const totalCoreMarkers = [
          ...criterionA,
          ...criterionB,
          criterionC,
          criterionD,
          criterionE,
        ]
          .filter(Boolean)
          .reduce((sum: number, r: any) => sum + (r?.count ?? 0), 0);
      
        let overallConfidence;
        if (allCoreCriteriaMet && totalCoreMarkers >= 20) overallConfidence = "Very High";
        else if (allCoreCriteriaMet && totalCoreMarkers >= 12) overallConfidence = "High";
        else if (coreCriteriaMet >= 4) overallConfidence = "Moderate";
        else if (coreCriteriaMet >= 2) overallConfidence = "Low";
        else overallConfidence = "Very Low";
      
        // ============================================================
        // RETURN — preserves array iterability AND adds rich metadata
        // ============================================================
        // Use defineProperty so the array still iterates/maps as before,
        // but UI can also read matrix.summary, matrix.missingDomains, etc.
        Object.defineProperty(rows, "summary", { value: summary, enumerable: false });
        Object.defineProperty(rows, "dsmThresholdState", { value: dsmThresholdState, enumerable: false });
        Object.defineProperty(rows, "allCoreCriteriaMet", { value: allCoreCriteriaMet, enumerable: false });
        Object.defineProperty(rows, "coreCriteriaMet", { value: coreCriteriaMet, enumerable: false });
        Object.defineProperty(rows, "missingDomains", { value: missingDomains, enumerable: false });
        Object.defineProperty(rows, "supportEvidence", { value: supportEvidence, enumerable: false });
        Object.defineProperty(rows, "overallConfidence", { value: overallConfidence, enumerable: false });
        Object.defineProperty(rows, "totalMarkers", { value: markers.length, enumerable: false });

    // ============================================================
    // GUARD CLAUSES
    // ============================================================
    if (!markers || !Array.isArray(markers) || markers.length === 0) {
      return {
        score: 0,
        level: "Insufficient",
        confidence: "Very Low",
        strengths: [],
        gaps: ["No clinical markers documented yet — begin live note capture"],
        risks: [],
        criteriaStatus: {
          A: { met: false, subDomainsPresent: 0, subDomainsRequired: 3 },
          B: { met: false, subDomainsPresent: 0, subDomainsRequired: 2 },
          C: { met: false, status: "Not yet documented" },
          D: { met: false, status: "Not yet documented" },
        },
        recommendation: "Begin entering structured assessment notes across DSM-5-TR criteria, functional impairment, and cross-setting observations.",
        nextActions: [
          "Document social-emotional reciprocity observations (A1)",
          "Document nonverbal communication observations (A2)",
          "Document relationship/peer functioning observations (A3)",
          "Document restricted/repetitive behaviour observations (B1–B4)",
          "Document functional impact across home, school, community, peer, clinic settings",
        ],
      };
    }

    const getMarkers = (code: string) => grouped[code] || [];
    const countCode = (code: string) => getMarkers(code).length;
    const hasCode = (code: string) => countCode(code) > 0;
  
    // Criterion A sub-domains
    const a1Count = countCode("A1");
    const a2Count = countCode("A2");
    const a3Count = countCode("A3");
    const aCriterionMet = aSubDomainsPresent === 3;

    // Criterion B sub-domains
    const b1Count = countCode("B1");
    const b2Count = countCode("B2");
    const b3Count = countCode("B3");
    const b4Count = countCode("B4");
    const bCriterionMet = bSubDomainsPresent >= 2;
  
    // Other domains
    const impairmentCount = countCode("IMPAIRMENT");
    const maskingCount = countCode("MASKING");
    const onsetCount = countCode("ONSET") + countCode("DEVELOPMENTAL");
    const sensoryCount = countCode("SENSORY") + b4Count;
    const safetyCount = countCode("SAFETY") + countCode("RISK");
    const cooccurringCount = countCode("COOCCURRING") + countCode("COMORBID");
  
    const hasImpairment = impairmentCount > 0;
    const hasMasking = maskingCount > 0;
    const hasOnset = onsetCount > 0;
    const hasSafety = safetyCount > 0;
    const hasCooccurring = cooccurringCount > 0;
  
    // Cross-setting analysis
    const settingsCount = crossSetting?.count || crossSetting?.settingsCount || 0;
    const hasCrossSetting = settingsCount >= 2;
    const hasStrongCrossSetting = settingsCount >= 3;
    const hasFullPervasiveness = settingsCount >= 4;
  
    const totalMarkers = markers.length;
  
    // ============================================================
    // SCORING — WEIGHTED BY DSM-5-TR DIAGNOSTIC ARCHITECTURE
    // ============================================================
    let score = 0;
    const strengths = [];
    const gaps = [];
    const risks = [];
    const criticalGaps = [];
  
    // --- CRITERION A: 36 points total (12 per sub-domain, all required) ---
    if (a1Count >= 1) {
      const a1Score = a1Count >= 3 ? 12 : a1Count >= 2 ? 10 : 8;
      score += a1Score;
      strengths.push(`A1 social-emotional reciprocity (${a1Count} marker${a1Count > 1 ? "s" : ""})`);
    } else {
      criticalGaps.push("A1 social-emotional reciprocity — required for Criterion A");
    }
  
    if (a2Count >= 1) {
      const a2Score = a2Count >= 3 ? 12 : a2Count >= 2 ? 10 : 8;
      score += a2Score;
      strengths.push(`A2 nonverbal communicative behaviours (${a2Count} marker${a2Count > 1 ? "s" : ""})`);
    } else {
      criticalGaps.push("A2 nonverbal communicative behaviours — required for Criterion A");
    }
  
    if (a3Count >= 1) {
      const a3Score = a3Count >= 3 ? 12 : a3Count >= 2 ? 10 : 8;
      score += a3Score;
      strengths.push(`A3 developing/maintaining/understanding relationships (${a3Count} marker${a3Count > 1 ? "s" : ""})`);
    } else {
      criticalGaps.push("A3 relationships — required for Criterion A");
    }
  
    // --- CRITERION B: 24 points total (≥2 of 4 sub-domains required) ---
    if (bSubDomainsPresent >= 2) {
      const baseB = 18;
      const breadthBonus = bSubDomainsPresent === 4 ? 6 : bSubDomainsPresent === 3 ? 4 : 0;
      score += baseB + breadthBonus;
      strengths.push(`Criterion B threshold met across ${bSubDomainsPresent}/4 sub-domains${breadthBonus ? " (broad presentation)" : ""}`);
    } else if (bSubDomainsPresent === 1) {
      score += 9;
      criticalGaps.push(`Criterion B currently at ${bSubDomainsPresent}/4 sub-domains — minimum of 2 required for diagnostic threshold`);
    } else {
      criticalGaps.push("Criterion B has no documented sub-domains — minimum of 2 of 4 required (B1 stereotyped behaviours, B2 sameness/routines, B3 restricted interests, B4 sensory)");
    }
  
    // --- CRITERION C: 8 points (developmental onset) ---
    if (hasOnset) {
      score += 8;
      strengths.push("Criterion C developmental onset evidence documented");
    } else {
      gaps.push("Criterion C — confirm symptoms present in early developmental period via developmental history, Personal Health Record, or early childhood reports");
    }
  
    // --- CRITERION D: 20 points (functional impairment) ---
    if (impairmentCount >= 5) {
      score += 20;
      strengths.push(`Robust functional impairment evidence (${impairmentCount} markers across multiple domains)`);
    } else if (impairmentCount >= 3) {
      score += 16;
      strengths.push(`Substantial functional impairment evidence (${impairmentCount} markers)`);
    } else if (impairmentCount >= 1) {
      score += 10;
      gaps.push(`Functional impairment evidence is present but limited (${impairmentCount} marker${impairmentCount > 1 ? "s" : ""}) — expand documentation across daily living, communication, social, learning, and self-management domains`);
    } else {
      criticalGaps.push("Criterion D — functional impairment not yet documented (required for DSM-5-TR diagnosis and NDIS eligibility)");
    }
  
    // --- CROSS-SETTING PERVASIVENESS: 12 points ---
    if (hasFullPervasiveness) {
      score += 12;
      strengths.push(`Pervasive impact across ${settingsCount}/5 settings — supports neurodevelopmental aetiology`);
    } else if (hasStrongCrossSetting) {
      score += 9;
      strengths.push(`Cross-setting impact across ${settingsCount}/5 settings`);
    } else if (hasCrossSetting) {
      score += 5;
      gaps.push(`Cross-setting evidence at ${settingsCount}/5 settings — strengthen by documenting impact across additional contexts (home, school, community, peer/social, clinic)`);
    } else if (settingsCount === 1) {
      score += 2;
      gaps.push("Impact currently documented in only one setting — neurodevelopmental presentations require evidence of pervasiveness across contexts");
    } else {
      gaps.push("No cross-setting evidence documented — confirm impairment across home, school/educational, community, peer, and clinic contexts");
    }
  
    // --- DIFFERENTIAL & CONTEXT MODIFIERS ---
  
    // Masking (additive — doesn't replace direct observation but contextualises it)
    if (hasMasking) {
      score += 4;
      strengths.push("Masking/camouflaging pattern documented — supports interpretation of context-dependent presentation");
      risks.push("Masking detected: observable presentation in structured settings may underestimate true support needs. Document post-demand decompensation, internalised distress, and home-vs-school discrepancy.");
    }
  
    // Co-occurring conditions
    if (hasCooccurring) {
      score += 3;
      strengths.push(`Co-occurring conditions identified (${cooccurringCount}) — relevant to differential diagnosis and support planning`);
    }
  
    // Safety markers (auto-elevate clinical concern)
    if (hasSafety) {
      score += 2;
      risks.push(`Safety markers identified (${safetyCount}) — eloping, road safety, stranger awareness, or self-injury concerns require explicit risk management documentation and elevated support needs consideration`);
    }
  
    // Sensory profile depth
    if (sensoryCount >= 3) {
      strengths.push(`Sensory profile well-characterised (${sensoryCount} markers)`);
    }
  
    // --- EVIDENCE DENSITY BONUSES ---
    if (totalMarkers >= 30) {
      score += 4;
      strengths.push("High-density evidence base (30+ markers)");
    } else if (totalMarkers >= 20) {
      score += 3;
    } else if (totalMarkers >= 12) {
      score += 1;
    }
  
    // --- SUPPORT NEEDS COHERENCE CHECK ---
    const supportLevel = supportNeeds?.level?.toLowerCase() || "";
    const isHighSupport = /high|substantial|level\s*[23]/i.test(supportLevel);
    const isLowSupport = /low|level\s*1|requiring support/i.test(supportLevel);
  
    if (isHighSupport) {
      if (impairmentCount < 3 || !hasSafety) {
        risks.push("High support level signalled but adaptive functioning and/or safety evidence is sparse — ensure functional impairment is explicitly documented across self-care, communication, and safety domains to substantiate Level 2/3 designation");
      }
    }
  
    if (isLowSupport && hasMasking) {
      risks.push("Low support level signalled alongside masking evidence — verify whether observable functioning reflects true capacity or compensated/camouflaged presentation, particularly relevant for female/AFAB and late-identified presentations");
    }
  
    if (crossSetting?.discrepancy) {
      risks.push("Setting-discrepancy detected — clarify whether differences reflect masking, environmental scaffolding, demand-avoidance, or genuine context-specific functioning");
    }
  
    // ============================================================
    // CRITERIA STATUS OBJECT (machine-readable)
    // ============================================================
    const criteriaStatus = {
      A: {
        met: aCriterionMet,
        subDomainsPresent: aSubDomainsPresent,
        subDomainsRequired: 3,
        detail: {
          A1: { present: a1Count > 0, count: a1Count },
          A2: { present: a2Count > 0, count: a2Count },
          A3: { present: a3Count > 0, count: a3Count },
        },
      },
      B: {
        met: bCriterionMet,
        subDomainsPresent: bSubDomainsPresent,
        subDomainsRequired: 2,
        detail: {
          B1: { present: b1Count > 0, count: b1Count },
          B2: { present: b2Count > 0, count: b2Count },
          B3: { present: b3Count > 0, count: b3Count },
          B4: { present: b4Count > 0, count: b4Count },
        },
      },
      C: {
        met: hasOnset,
        status: hasOnset ? "Documented" : "Pending developmental history",
      },
      D: {
        met: hasImpairment,
        markerCount: impairmentCount,
        status: impairmentCount >= 3 ? "Substantial" : impairmentCount >= 1 ? "Limited" : "Not yet documented",
      },
    };
  
    const allCriteriaMet =
      criteriaStatus.A.met &&
      criteriaStatus.B.met &&
      criteriaStatus.C.met &&
      criteriaStatus.D.met;
  
    // ============================================================
    // READINESS LEVEL & CONFIDENCE
    // ============================================================
    score = Math.min(score, 100);
  
    let level;
    let confidence;
    let recommendation;
    const nextActions = [];
  
    if (score >= 88 && allCriteriaMet && criticalGaps.length === 0 && hasFullPervasiveness) {
      level = "Formulation-Ready";
      confidence = "High";
      recommendation = "Evidence base is comprehensive and meets all DSM-5-TR criteria with strong cross-setting pervasiveness. Proceed to clinician-led diagnostic formulation, integrating standardised assessment outcomes (ADOS-2/MIGDAS-2, Vineland-3 or ABAS-3, Sensory Profile-2, cognitive assessment), developmental history, and multi-informant report.";
      nextActions.push(
        "Finalise standardised assessment scoring",
        "Consolidate multi-informant convergence (parent, teacher, clinician)",
        "Draft DSM-5-TR formulation with severity specifier",
        "Determine level of support (Level 1/2/3) per Criterion A and B specifiers"
      );
    } else if (score >= 75 && allCriteriaMet && criticalGaps.length === 0) {
      level = "Substantially Ready";
      confidence = "Moderate-High";
      recommendation = "All DSM-5-TR criteria are met. Diagnostic formulation is supportable but would be strengthened by broader cross-setting evidence and additional functional impairment documentation before final wording.";
      if (!hasFullPervasiveness) nextActions.push("Strengthen cross-setting evidence across all 5 contexts");
      if (impairmentCount < 5) nextActions.push("Expand functional impairment documentation across additional adaptive domains");
      if (!hasOnset) nextActions.push("Confirm developmental history and early presentation");
    } else if (score >= 60 && criticalGaps.length <= 1) {
      level = "Substantial";
      confidence = "Moderate";
      recommendation = "Evidence is clinically substantial across most diagnostic domains. Resolve identified critical gaps before final diagnostic wording.";
      nextActions.push(...criticalGaps.map((g) => `Address: ${g}`));
    } else if (score >= 40) {
      level = "Emerging";
      confidence = "Low-Moderate";
      recommendation = "Evidence is emerging across key domains but does not yet meet diagnostic threshold. Targeted follow-up required across missing DSM-5-TR criteria and functional impact areas.";
      nextActions.push(...criticalGaps.slice(0, 4).map((g) => `Priority: ${g}`));
    } else if (score >= 20) {
      level = "Preliminary";
      confidence = "Low";
      recommendation = "Initial markers documented but evidence base is insufficient for diagnostic consideration. Continue structured note capture across DSM-5-TR criteria and functional settings.";
      nextActions.push("Continue gathering evidence across all DSM-5-TR criteria");
      nextActions.push("Document observations across home, school, community, peer, and clinic settings");
    } else {
      level = "Insufficient";
      confidence = "Very Low";
      recommendation = "Evidence base is insufficient for diagnostic readiness assessment. Continue live note capture.";
    }
  
    // Combine critical gaps + general gaps for output
    const allGaps = [...criticalGaps, ...gaps];
  
    return {
      score,
      level,
      confidence,
      strengths,
      gaps: allGaps,
      criticalGaps,
      risks,
      criteriaStatus,
      pervasiveness: {
        settingsCount,
        settingsRequired: 2,
        level: hasFullPervasiveness ? "Pervasive" : hasStrongCrossSetting ? "Strong" : hasCrossSetting ? "Adequate" : "Limited",
      },
      evidenceDensity: {
        totalMarkers,
        tier: totalMarkers >= 30 ? "Robust" : totalMarkers >= 20 ? "Substantial" : totalMarkers >= 12 ? "Emerging" : totalMarkers >= 6 ? "Preliminary" : "Sparse",
      },
      recommendation,
      nextActions,
    };
  }

// -----------------------------------------------------------------------------
// Reasoning layer — DSM level of support, clinician prompts, NDIS domain rollup
// -----------------------------------------------------------------------------

function findRow(matrix: any, code: any): any {
  if (!matrix) return null;
  if (typeof matrix.find === "function") {
    return matrix.find((r: any) => r.code === code);
  }
  if (Array.isArray(matrix)) {
    return matrix.find((r: any) => r.code === code);
  }
  return null;
}

function countHighSpecificity(rows: any[]): number {
  let count = 0;
  for (const row of rows) {
    if (!row) continue;
    if (row.markers && row.markers.length) {
      for (const m of row.markers) {
        const spec = (m.specificity || "").toLowerCase();
        const w = typeof m.weight === "number" ? m.weight : 0;
        if (spec === "high" || w >= 1.5) count += 1;
      }
      continue;
    }
    if (row.evidenceState === "Established" || row.evidenceState === "Robust") {
      count += row.count || 0;
      continue;
    }
    if (row.status === "Strong") {
      count += row.count || 0;
      continue;
    }
    if ((row.count || 0) >= 2) count += row.count || 0;
  }
  return count;
}

function countPathognomonic(rows: any[]): number {
  let count = 0;
  for (const row of rows) {
    if (!row) continue;
    if (row.markers && row.markers.length) {
      for (const m of row.markers) {
        const w = typeof m.weight === "number" ? m.weight : 0;
        if (w >= 1.7) count += 1;
      }
      continue;
    }
    if (row.evidenceState === "Robust") {
      count += Math.max(0, Math.min(row.count || 0, Math.floor((row.count || 0) / 3)));
      continue;
    }
    if ((row.count || 0) >= 5) count += 1;
    if ((row.count || 0) >= 10) count += 1;
  }
  return count;
}

function deriveNDISAlignment(args: any): any {
  const {
    overallLevel,
    levelA,
    levelB,
    vinelandABC,
    abasGAC,
    settingsCount,
    safetyDepth,
    cooccurringDepth,
    maskingDepth,
    impairmentDepth,
  } = args;

  if (overallLevel === null) {
    return {
      eligibilitySignal: "Not yet determinable",
      reasoning: ["DSM-5-TR level not yet established"],
      functionalCapacityLanguage: null,
      supportTier: null,
    };
  }

  let eligibilitySignal;
  const reasoning = [];
  let supportTier;

  if (
    overallLevel >= 2 ||
    (vinelandABC !== null && vinelandABC < 70) ||
    (abasGAC !== null && abasGAC < 70)
  ) {
    eligibilitySignal =
      "Evidence may support consideration of NDIS disability criteria (Act 2013 s24)—eligibility is not guaranteed and requires individual assessment.";
    reasoning.push(
      "Higher DSM-5-TR support level (2–3) and/or adaptive composite in the lower range may indicate possible substantially reduced functional capacity; confirm with standardised and functional evidence."
    );
    if (overallLevel === 3) {
      supportTier = "High intensity supports may warrant consideration";
    } else if (overallLevel === 2) {
      supportTier = "Moderate to high intensity supports may warrant consideration";
    } else {
      supportTier = "Adaptive functioning evidence may support further functional-capacity assessment";
    }
  } else if (overallLevel === 1 && (vinelandABC === null || vinelandABC >= 70)) {
    if (maskingDepth >= 2) {
      eligibilitySignal =
        "Masking documented—true functional capacity may be underestimated; further assessment is appropriate.";
      reasoning.push(
        "Level 1 observable presentation with masking; recommend structured functional assessment of unmasked capacity before conclusions about supports."
      );
      supportTier = "Tailored capacity-building supports; assessment of unmasked functioning";
    } else {
      eligibilitySignal =
        "Whether disability requirements are met depends on substantially reduced functional capacity evidence; level designation alone is insufficient.";
      reasoning.push(
        "Level 1 with adaptive functioning in or near typical range; gather cross-domain functional capacity documentation if NDIS planning is relevant."
      );
      supportTier = "Capacity-building and consultative supports";
    }
  } else {
    eligibilitySignal =
      "Functional capacity evidence is required before drawing conclusions about access or support intensity.";
    reasoning.push("Level designation alone is insufficient; gather adaptive functioning data");
    supportTier = "To be determined following functional assessment";
  }

  if (settingsCount >= 4) {
    reasoning.push("Pervasive impact across several settings supports cross-contextual disability formulation (not eligibility by itself).");
  } else if (settingsCount <= 1) {
    reasoning.push(
      "Limited cross-setting evidence — strengthen with documentation across home, school, community, peer, and clinic"
    );
  }

  if (safetyDepth >= 2) {
    reasoning.push(
      `Safety markers (${safetyDepth}) require explicit support planning and may elevate intensity needs in care planning`
    );
  }

  if (cooccurringDepth >= 1) {
    reasoning.push(
      `Co-occurring conditions (${cooccurringDepth}) may compound functional impact across NDIS domains when documented`
    );
  }

  const functionalCapacityLanguage = generateNDISLanguage({
    level: overallLevel,
    vinelandABC,
    safetyDepth,
    settingsCount,
    impairmentDepth,
  });

  return {
    eligibilitySignal,
    reasoning,
    supportTier,
    functionalCapacityLanguage,
    sixDomainsToAddress: [
      "Communication",
      "Social interaction",
      "Learning",
      "Mobility",
      "Self-care",
      "Self-management",
    ],
  };
}

function generateNDISLanguage(args: any): string[] {
  const { level, vinelandABC, safetyDepth, settingsCount, impairmentDepth } = args;
  const phrases = [];

  if (level === 3) {
    phrases.push(
      "Permanent and lifelong neurodevelopmental condition with evidence suggesting substantially reduced functional capacity across several areas of daily living"
    );
    phrases.push("May require very substantial support across multiple domains pending individual assessment");
  } else if (level === 2) {
    phrases.push(
      "Permanent and lifelong neurodevelopmental condition with evidence suggesting substantially reduced functional capacity"
    );
    phrases.push("May require substantial support across multiple domains pending individual assessment");
  } else if (level === 1) {
    phrases.push(
      "Permanent and lifelong neurodevelopmental condition with evidence of reduced functional capacity in social, communication, and adaptive domains in some contexts"
    );
    phrases.push("May require support across daily life domains where impact is documented");
  }

  if (vinelandABC !== null && vinelandABC < 70) {
    phrases.push(
      `Vineland-3 Adaptive Behaviour Composite (${vinelandABC}) in the low range, suggesting reduced adaptive capacity that should be interpreted alongside other assessments`
    );
  }

  if (safetyDepth >= 2) {
    phrases.push("Safety risks may require active management and supervision in care planning");
  }

  if (settingsCount >= 3) {
    phrases.push("Functional impact documented across several everyday settings (home, education, community, or clinical)");
  }

  if (impairmentDepth === "Robust" || impairmentDepth === "Substantial") {
    phrases.push(
      "Functional impairment appears persistent; reasonable and necessary supports may be appropriate where eligibility criteria are met"
    );
  }

  return phrases;
}

function buildReasoningSnapshot(matrix: any): any {
  if (!matrix || typeof matrix.find !== "function") return null;

  const fr = (code: any) => findRow(matrix, code);
  const aCodes = ["A1", "A2", "A3"];
  const bCodes = ["B1", "B2", "B3", "B4"];

  const aPresent = aCodes.filter((c: any) => (fr(c)?.count || 0) > 0).length;
  const bPresent = bCodes.filter((c: any) => (fr(c)?.count || 0) > 0).length;
  const aTotal = aCodes.reduce((s: any, c: any) => s + (fr(c)?.count || 0), 0);
  const bTotal = bCodes.reduce((s: any, c: any) => s + (fr(c)?.count || 0), 0);

  const impairRow = fr("IMPAIRMENT");
  const impairCount = impairRow?.count || 0;
  const onsetRow = fr("ONSET") || fr("DEVELOPMENTAL");
  const onsetCount = onsetRow?.count || 0;
  const diffRow = fr("DIFFERENTIAL") || fr("DIFF") || fr("RULEOUT");
  const diffCount = diffRow?.count || 0;

  const summary = {
    ...(matrix.summary || {}),
    criterionA: {
      label: "Persistent deficits in social communication and social interaction",
      met: matrix.summary?.criterionA?.met ?? aPresent === 3,
      subDomainsPresent: matrix.summary?.criterionA?.subDomainsPresent ?? aPresent,
      subDomainsRequired: 3,
      totalMarkers: matrix.summary?.criterionA?.totalMarkers ?? aTotal,
      missing:
        matrix.summary?.criterionA?.missing ??
        aCodes.filter((c: any) => (fr(c)?.count || 0) === 0),
    },
    criterionB: {
      label: "Restricted, repetitive patterns of behaviour, interests, or activities",
      met: matrix.summary?.criterionB?.met ?? bPresent >= 2,
      subDomainsPresent: matrix.summary?.criterionB?.subDomainsPresent ?? bPresent,
      subDomainsRequired: 2,
      totalMarkers: matrix.summary?.criterionB?.totalMarkers ?? bTotal,
      missing:
        matrix.summary?.criterionB?.missing ??
        bCodes.filter((c: any) => (fr(c)?.count || 0) === 0),
    },
    criterionC: {
      label: "Symptoms in the early developmental period",
      met: matrix.summary?.criterionC?.met ?? onsetCount > 0,
      markerCount: matrix.summary?.criterionC?.markerCount ?? onsetCount,
      status:
        matrix.summary?.criterionC?.status ??
        (onsetCount > 0 ? "Documented" : "Pending developmental history"),
    },
    criterionD: {
      label: "Clinically significant functional impairment",
      met: matrix.summary?.criterionD?.met ?? impairCount > 0,
      markerCount: matrix.summary?.criterionD?.markerCount ?? impairCount,
      depth:
        matrix.summary?.criterionD?.depth ??
        (impairCount >= 5
          ? "Robust"
          : impairCount >= 3
            ? "Substantial"
            : impairCount >= 1
              ? "Limited"
              : "Not documented"),
    },
    criterionE: {
      label: "Not better explained by ID or GDD alone",
      met: matrix.summary?.criterionE?.met ?? diffCount > 0,
      markerCount: matrix.summary?.criterionE?.markerCount ?? diffCount,
      status:
        matrix.summary?.criterionE?.status ??
        (diffCount > 0 ? "Addressed" : "Pending cognitive/adaptive assessment"),
    },
    modifiers: {
      masking: matrix.summary?.modifiers?.masking ?? fr("MASKING")?.count ?? 0,
      safety: matrix.summary?.modifiers?.safety ?? fr("SAFETY")?.count ?? 0,
      cooccurring:
        matrix.summary?.modifiers?.cooccurring ?? fr("COOCCURRING")?.count ?? 0,
    },
  };

  const bRows = bCodes.map((c: any) => fr(c)).filter(Boolean);
  const supportEvidence = matrix.supportEvidence || {
    sensoryProfile: {
      depth: fr("B4")?.count || 0,
      characterised:
        (fr("B4")?.count || 0) >= 2 ? "Adequately characterised" : "Requires further detail",
    },
    rigidityProfile: {
      depth: fr("B2")?.count || 0,
      characterised:
        (fr("B2")?.count || 0) >= 2 ? "Adequately characterised" : "Requires further detail",
    },
    interestsProfile: { depth: fr("B3")?.count || 0 },
    stereotypyProfile: { depth: fr("B1")?.count || 0 },
    masking: {
      present: summary.modifiers.masking > 0,
      depth: summary.modifiers.masking,
      interpretiveImpact:
        summary.modifiers.masking > 0
          ? "Observable presentation may underestimate true support needs"
          : null,
    },
    safety: {
      present: summary.modifiers.safety > 0,
      depth: summary.modifiers.safety,
      escalates: summary.modifiers.safety > 0,
      planningRequired: summary.modifiers.safety > 0,
    },
    cooccurring: {
      present: summary.modifiers.cooccurring > 0,
      depth: summary.modifiers.cooccurring,
      compounds: summary.modifiers.cooccurring > 0,
    },
  };

  let missingDomains = Array.isArray(matrix.missingDomains)
    ? [...matrix.missingDomains]
    : [];

  if (!missingDomains.length) {
    if (!summary.criterionA.met) {
      summary.criterionA.missing.forEach((code: any) => {
        const row = fr(code);
        if (!row) return;
        missingDomains.push({
          code,
          criterion: row.criterion,
          priority: "Critical",
          reason: "Required for Criterion A — all 3 sub-domains needed",
          suggestedFocus: row.examples || [],
        });
      });
    }
    if (!summary.criterionB.met) {
      const needed = 2 - summary.criterionB.subDomainsPresent;
      missingDomains.push({
        code: "B",
        criterion: "Criterion B sub-domains",
        priority: "Critical",
        reason: `${needed} additional B sub-domain${needed > 1 ? "s" : ""} required (currently ${summary.criterionB.subDomainsPresent}/4, minimum 2)`,
        suggestedFocus: bRows
          .filter((r) => (r.count || 0) === 0)
          .map((r) => `${r.code}: ${r.criterion}`),
      });
    }
    if (!summary.criterionC.met) {
      missingDomains.push({
        code: "ONSET",
        criterion: "Developmental onset (Criterion C)",
        priority: "Critical",
        reason: "DSM-5-TR requires evidence of early developmental presentation",
        suggestedFocus: onsetRow?.examples || [],
      });
    }
    if (!summary.criterionD.met) {
      missingDomains.push({
        code: "IMPAIRMENT",
        criterion: "Functional impairment (Criterion D)",
        priority: "Critical",
        reason: "Required for DSM-5-TR diagnosis and for documentation relevant to functional capacity considerations",
        suggestedFocus: impairRow?.examples || [],
      });
    } else if (summary.criterionD.depth === "Limited") {
      missingDomains.push({
        code: "IMPAIRMENT",
        criterion: "Functional impairment depth",
        priority: "High",
        reason: "Functional impairment evidence is limited — expand across additional domains",
        suggestedFocus: [
          "Document impact across home, school, community, peer, and clinic settings",
        ],
      });
    }
    if (!summary.criterionE.met) {
      missingDomains.push({
        code: "DIFFERENTIAL",
        criterion: "Differential diagnosis (Criterion E)",
        priority: "High",
        reason: "Cognitive and adaptive functioning assessment required to differentiate from / co-diagnose ID",
        suggestedFocus: diffRow?.examples || [],
      });
    }
  }

  const pervasiveness = matrix.pervasiveness || { settingsCount: 0 };

  return { summary, supportEvidence, missingDomains, pervasiveness };
}

function countExternalImpairmentMarkers(allMarkers: any[]): number {
  if (!allMarkers || !Array.isArray(allMarkers)) return 0;
  const patterns = [
    /\beducation\s+assistant\b/i,
    /\bteacher\s+aide\b/i,
    /\bspecialist\s+school\b/i,
    /\bEducation\s+Support\s+Centre\b/i,
    /\bEngagement\s+Centre\b/i,
    /\bIEP\b/i,
    /\bILP\b/i,
    /\bNCCD\b/i,
    /\brequires?\s+prompting.*self-care\b/i,
    /\brequires?\s+supervision.*self-care\b/i,
    /\bwandering.*public\b/i,
    /\beloping\b/i,
    /\binconsistent\s+road\s+awareness\b/i,
    /\benvironmental\s+danger\b/i,
    /\bcarer\s+payment\b/i,
    /\bspecialist\s+placement\b/i,
  ];
  let n = 0;
  for (const m of allMarkers) {
    const text = `${m.label || ""} ${m.verbatim || ""}`;
    if (patterns.some((p) => p.test(text))) n += 1;
  }
  return n;
}

function deriveLevelOfSupport(matrix: any, adjuncts: any = {}): any {
  const snap = buildReasoningSnapshot(matrix);
  if (!snap) {
    return {
      determinable: false,
      reason: "Matrix not provided or incomplete",
      criterionA: null,
      criterionB: null,
      overallLevel: null,
      formattedSpecifier: null,
      ndisAlignment: null,
      levelOneFloorApplied: false,
      derivationNote: null,
      levelOneFloorMaskingNote: null,
    };
  }

  const {
    vinelandABC = null,
    abasGAC = null,
    cognitiveFSIQ = null,
    sensoryProfile2 = null,
    ados2ComparisonScore = null,
    srs2TScore = null,
  } = adjuncts;

  const summary = snap.summary;
  const supportEvidence = matrix.supportEvidence || snap.supportEvidence;
  const modifiers = summary.modifiers;
  const d = summary.criterionD;

  const safetyDepth = modifiers?.safety || 0;
  const cooccurringDepth = modifiers?.cooccurring || 0;
  const maskingDepth = modifiers?.masking || 0;
  const settingsCount =
    matrix.pervasiveness?.settingsCount ?? snap.pervasiveness?.settingsCount ?? 0;

  const a = summary.criterionA;
  const b = summary.criterionB;

  const aRow_A1 = matrix.find?.((r: any) => r.code === "A1") || findRow(matrix, "A1");
  const aRow_A2 = matrix.find?.((r: any) => r.code === "A2") || findRow(matrix, "A2");
  const aRow_A3 = matrix.find?.((r: any) => r.code === "A3") || findRow(matrix, "A3");

  const aMarkerCount = a?.totalMarkers || 0;
  const aSubDomainsPresent = a?.subDomainsPresent || 0;
  const aHighSpecCount = countHighSpecificity([aRow_A1, aRow_A2, aRow_A3]);
  const aPathognomonicCount = countPathognomonic([aRow_A1, aRow_A2, aRow_A3]);

  const criterionA_evidence = {
    subDomainsMet: a?.met || false,
    subDomainsPresent: aSubDomainsPresent,
    totalMarkers: aMarkerCount,
    highSpecificityMarkers: aHighSpecCount,
    pathognomonicMarkers: aPathognomonicCount,
    crossSettingPervasiveness: settingsCount,
    maskingDocumented: maskingDepth > 0,
  };

  let levelA = null;
  const levelA_rationale = [];

  if (!a?.met) {
    levelA = null;
    levelA_rationale.push("Criterion A not met — all 3 sub-domains required");
  } else {
    let level3Score = 0;
    if (aMarkerCount >= 12) level3Score++;
    if (aPathognomonicCount >= 3) level3Score++;
    if (aHighSpecCount >= 6) level3Score++;
    if (
      aRow_A1?.markers?.some((m: any) =>
        /no\s+spontaneous|primarily\s+(requesting|instrumental)|minimal\s+response/i.test(
          m.label || ""
        )
      )
    )
      level3Score++;
    if (cognitiveFSIQ !== null && cognitiveFSIQ < 70) level3Score++;
    if (vinelandABC !== null && vinelandABC < 55) level3Score++;
    if (ados2ComparisonScore !== null && ados2ComparisonScore >= 8) level3Score++;
    if (settingsCount >= 4 && safetyDepth >= 2) level3Score++;

    let level1Score = 0;
    if (aMarkerCount <= 8 && aMarkerCount >= 3) level1Score++;
    if (aPathognomonicCount <= 1) level1Score++;
    if (vinelandABC !== null && vinelandABC >= 70) level1Score++;
    if (cognitiveFSIQ !== null && cognitiveFSIQ >= 85) level1Score++;
    if (ados2ComparisonScore !== null && ados2ComparisonScore <= 5) level1Score++;
    if (maskingDepth >= 2) level1Score++;
    if (settingsCount <= 2) level1Score++;

    if (level3Score >= 4) {
      levelA = 3;
      levelA_rationale.push(
        `Severe deficits across all 3 A sub-domains with ${aMarkerCount} markers, ${aPathognomonicCount} pathognomonic`,
        "Marked impairment in functioning even with supports in place"
      );
    } else if (level1Score >= 3 && level3Score <= 1) {
      levelA = 1;
      levelA_rationale.push(
        "Noticeable social-communication deficits but able to function with supports",
        maskingDepth > 0
          ? "Note: masking pattern may underestimate true support needs"
          : "Difficulties with initiation and atypical responses to overtures"
      );
    } else {
      levelA = 2;
      levelA_rationale.push(
        "Marked deficits in verbal and nonverbal social communication",
        "Social impairments apparent even with supports in place",
        "Limited initiation of social interactions and reduced response to overtures"
      );
    }

    if (levelA === 1 && maskingDepth >= 3 && aMarkerCount >= 8 && settingsCount >= 3) {
      levelA = 2;
      levelA_rationale.push(
        "ADJUSTED UPWARD: Masking documented across multiple settings; observable presentation underestimates true support needs"
      );
    }
  }

  const bRow_B1 = findRow(matrix, "B1");
  const bRow_B2 = findRow(matrix, "B2");
  const bRow_B3 = findRow(matrix, "B3");
  const bRow_B4 = findRow(matrix, "B4");

  const bMarkerCount = b?.totalMarkers || 0;
  const bSubDomainsPresent = b?.subDomainsPresent || 0;
  const bHighSpecCount = countHighSpecificity([bRow_B1, bRow_B2, bRow_B3, bRow_B4]);
  const bPathognomonicCount = countPathognomonic([bRow_B1, bRow_B2, bRow_B3, bRow_B4]);

  const criterionB_evidence = {
    subDomainsMet: b?.met || false,
    subDomainsPresent: bSubDomainsPresent,
    totalMarkers: bMarkerCount,
    highSpecificityMarkers: bHighSpecCount,
    pathognomonicMarkers: bPathognomonicCount,
    sensoryProfileDepth: supportEvidence.sensoryProfile?.depth || 0,
    rigidityProfileDepth: supportEvidence.rigidityProfile?.depth || 0,
    safetyDepth,
    sensoryProfile2: sensoryProfile2 || "Not assessed",
  };

  let levelB = null;
  const levelB_rationale = [];

  if (!b?.met) {
    levelB = null;
    levelB_rationale.push("Criterion B not met — minimum 2 of 4 sub-domains required");
  } else {
    let level3Score = 0;
    if (bMarkerCount >= 14) level3Score++;
    if (bPathognomonicCount >= 4) level3Score++;
    if (bSubDomainsPresent === 4) level3Score++;
    if (sensoryProfile2 === "Definite Difference") level3Score++;
    if (
      bRow_B2?.markers?.some((m: any) =>
        /catastrophic|extreme\s+distress|meltdown|cannot\s+cope/i.test(m.label || "")
      )
    )
      level3Score++;
    if (
      bRow_B4?.markers?.some((m: any) =>
        /cannot\s+(go|tolerate|access)|removed\s+from|requires?\s+restraint/i.test(
          m.label || ""
        )
      )
    )
      level3Score++;
    if (safetyDepth >= 3) level3Score++;
    if (settingsCount >= 4) level3Score++;

    let level1Score = 0;
    if (bMarkerCount <= 8 && bMarkerCount >= 3) level1Score++;
    if (bPathognomonicCount <= 1) level1Score++;
    if (bSubDomainsPresent === 2) level1Score++;
    if (sensoryProfile2 === "Probable Difference" || sensoryProfile2 === "Typical") level1Score++;
    if (safetyDepth === 0) level1Score++;
    if (settingsCount <= 2) level1Score++;

    if (level3Score >= 4) {
      levelB = 3;
      levelB_rationale.push(
        `Inflexibility of behaviour and extreme difficulty coping with change`,
        `${bSubDomainsPresent}/4 B sub-domains met with ${bMarkerCount} markers, ${bPathognomonicCount} pathognomonic`,
        "RRBs and/or sensory differences markedly interfere with functioning across all spheres"
      );
    } else if (level1Score >= 3 && level3Score <= 1) {
      levelB = 1;
      levelB_rationale.push(
        "Inflexibility causes significant interference in at least one context",
        "Difficulty switching between activities; problems with organisation and planning"
      );
    } else {
      levelB = 2;
      levelB_rationale.push(
        "Inflexibility of behaviour and difficulty coping with change",
        "Restricted/repetitive behaviours frequent enough to be obvious to casual observer",
        "Distress and/or difficulty changing focus or action"
      );
    }

    if (levelB === 1 && safetyDepth >= 2) {
      levelB = 2;
      levelB_rationale.push(
        "ADJUSTED UPWARD: Safety markers present require active risk management"
      );
    }
  }

  const determinable = levelA !== null && levelB !== null;
  let overallLevel = determinable ? Math.max(levelA as number, levelB as number) : null;

  const structuredInputs = {
    vinelandABC,
    abasGAC,
    cognitiveFSIQ,
    sensoryProfile2,
    ados2ComparisonScore,
    srs2TScore,
  };
  if (
    determinable &&
    !level3PermittedByEvidence(structuredInputs, adjuncts?.sourceNotes || "")
  ) {
    if (overallLevel === 3) overallLevel = 2;
    if (levelA === 3) levelA = 2;
    if (levelB === 3) levelB = 2;
  }

  const allMarkers = matrix.allMarkers || [];
  const externalImpairmentMarkers = countExternalImpairmentMarkers(allMarkers);
  const primaryImpairmentHits = allMarkers.filter(
    (m: any) => m.code === "IMPAIRMENT" && !m.viaCrossTag
  ).length;
  const maskingMarkerHits = allMarkers.filter((m: any) => m.code === "MASKING").length;

  let levelOneFloorApplied = false;
  let derivationNote: string | null = null;
  let levelOneFloorMaskingNote: string | null = null;

  const meetsLevel1FloorConditions =
    determinable &&
    overallLevel !== null &&
    externalImpairmentMarkers <= 1 &&
    safetyDepth === 0 &&
    primaryImpairmentHits <= 3 &&
    !hasStructuredAssessmentInput(structuredInputs) &&
    !notesIndicateExplicitLevel3(adjuncts?.sourceNotes || "");

  if (meetsLevel1FloorConditions) {
    levelOneFloorApplied = true;
    levelA = 1;
    levelB = 1;
    overallLevel = 1;
    derivationNote =
      "Level 1 floor applied: external impairment markers <= 1, no safety markers, low primary IMPAIRMENT-domain count (cross-mapped sensory flags excluded). Presentation consistent with high-masking, mainstream-functioning, late-identified or AFAB profile.";
    if (maskingMarkerHits >= 3) {
      levelOneFloorMaskingNote =
        "Significant masking / camouflaging detected. Level 1 supports profile may underestimate true cost — consider supplementary masking-fatigue and burnout language in functional capacity statements.";
    }
    levelA_rationale.push(
      "Level 1 floor: minimal external supports and no safety markers — designation aligned with mainstream presentation despite high A/B marker volume."
    );
    levelB_rationale.push(
      "Level 1 floor: minimal external supports and no safety markers — designation aligned with mainstream presentation despite high A/B marker volume."
    );
  }

  const levelLabels: Record<number, string> = {
    1: "Level 1: Requiring support",
    2: "Level 2: Requiring substantial support",
    3: "Level 3: Requiring very substantial support",
  };

  const formattedSpecifier =
    determinable && overallLevel != null && levelA != null && levelB != null
    ? `Autism Spectrum Disorder, ${levelLabels[overallLevel]}\n` +
      `   Criterion A (social communication): ${levelLabels[levelA]}\n` +
      `   Criterion B (restricted/repetitive): ${levelLabels[levelB]}` +
      (cooccurringDepth > 0
        ? `\n   With co-occurring conditions (${cooccurringDepth} documented)`
        : "") +
      (cognitiveFSIQ !== null && cognitiveFSIQ < 70
        ? "\n   With accompanying intellectual impairment"
        : "")
    : "Insufficient evidence to determine level of support";

  let ndisAlignment = deriveNDISAlignment({
    overallLevel,
    levelA,
    levelB,
    vinelandABC,
    abasGAC,
    settingsCount,
    safetyDepth,
    cooccurringDepth,
    maskingDepth,
    impairmentDepth: d?.depth,
  });

  if (levelOneFloorApplied) {
    ndisAlignment = {
      ...ndisAlignment,
      eligibilitySignal:
        "L1 supports profile — NDIS eligibility uncertain; functional capacity language should emphasise cumulative masking cost, school participation impact, and post-school recovery time rather than overt behavioural markers.",
      reasoning: [
        ...(Array.isArray(ndisAlignment.reasoning) ? ndisAlignment.reasoning : []),
        ...(derivationNote ? [derivationNote] : []),
        ...(levelOneFloorMaskingNote ? [levelOneFloorMaskingNote] : []),
      ],
    };
  }

  const coherenceFlags = [];
  if (vinelandABC !== null) {
    if (overallLevel === 1 && vinelandABC < 55) {
      coherenceFlags.push({
        type: "incongruence",
        severity: "high",
        message: `Level 1 designation incongruent with Vineland ABC ${vinelandABC} (extremely low). Re-evaluate — adaptive functioning suggests Level 2-3.`,
      });
    }
    if (overallLevel === 3 && vinelandABC >= 80) {
      coherenceFlags.push({
        type: "incongruence",
        severity: "moderate",
        message: `Level 3 designation incongruent with Vineland ABC ${vinelandABC} (average). Confirm functional impact and consider Level 2.`,
      });
    }
  }
  if (ados2ComparisonScore !== null) {
    if (overallLevel === 1 && ados2ComparisonScore >= 8) {
      coherenceFlags.push({
        type: "incongruence",
        severity: "high",
        message: `Level 1 designation incongruent with ADOS-2 Comparison Score ${ados2ComparisonScore} (very high). Re-evaluate.`,
      });
    }
    if (overallLevel === 3 && ados2ComparisonScore <= 4) {
      coherenceFlags.push({
        type: "incongruence",
        severity: "moderate",
        message: `Level 3 designation incongruent with ADOS-2 Comparison Score ${ados2ComparisonScore} (low). Confirm clinical observations.`,
      });
    }
  }

  return {
    determinable,
    overallLevel,
    levelA,
    levelB,
    formattedSpecifier,
    criterionA: {
      level: levelA,
      label: levelA ? levelLabels[levelA] : "Not yet determinable",
      evidence: criterionA_evidence,
      rationale: levelA_rationale,
    },
    criterionB: {
      level: levelB,
      label: levelB ? levelLabels[levelB] : "Not yet determinable",
      evidence: criterionB_evidence,
      rationale: levelB_rationale,
    },
    modifiers: {
      withIntellectualImpairment: cognitiveFSIQ !== null && cognitiveFSIQ < 70,
      withLanguageImpairment: cooccurringDepth > 0,
      coOccurringConditions: cooccurringDepth,
      safetyMarkers: safetyDepth,
      maskingDocumented: maskingDepth > 0,
    },
    ndisAlignment,
    coherenceFlags,
    standardisedAssessmentInputs: {
      vinelandABC,
      abasGAC,
      cognitiveFSIQ,
      sensoryProfile2,
      ados2ComparisonScore,
      srs2TScore,
    },
    levelOneFloorApplied,
    derivationNote,
    levelOneFloorMaskingNote,
  };
}

function getMissingBSubDomainPrompts(summary: any, ageYears: any): string[] {
  const followUps = [];
  const missing = summary.criterionB?.missing || [];
  if (missing.includes("B1")) followUps.push(...getB1Probes(ageYears));
  if (missing.includes("B2")) followUps.push(...getB2Probes(ageYears));
  if (missing.includes("B3")) followUps.push(...getB3Probes(ageYears));
  if (missing.includes("B4")) followUps.push(...getB4Probes(ageYears));
  return followUps;
}

function getB1Probes(ageYears?: any): string[] {
  void ageYears;
  return [
    "Hand-flapping or finger-flicking when excited?",
    "Toe-walking, spinning, rocking?",
    "Lines up toys, sorts them by colour, watches wheels spin?",
    "Echoes phrases, quotes Bluey/Peppa/Paw Patrol all day, repeats movie lines?",
    "Asks the same question over and over even after you've answered?",
  ];
}

function getB2Probes(ageYears: any): string[] {
  const y = typeof ageYears === "number" ? ageYears : 0;
  return [
    "Same breakfast every day? Specific cup or plate?",
    "Different route home or substitute teacher = meltdown?",
    y < 4
      ? "Bath transitions difficult — getting in or getting out?"
      : "School holidays / public holidays / Christmas difficult because of disruption?",
    "Has to finish what she's doing — can't stop the episode mid-way?",
    "Asks 'what's next?' or 'what are we doing today?' constantly?",
    "Refuses new clothes / shoes / wears the same outfit?",
  ];
}

function getB3Probes(ageYears?: any): string[] {
  void ageYears;
  return [
    "What's her thing right now? How long has it been her thing?",
    "Knows everything about [topic]? Memorised facts most adults don't know?",
    "Carries an object everywhere? Sleeps with an unusual object?",
    "Refuses to learn or talk about anything else?",
    "Has she gone through phases — Thomas, then Pokémon, then Minecraft?",
  ];
}

function getB4Probes(ageYears?: any): string[] {
  void ageYears;
  return [
    "Covers ears at vacuum, hair dryer, blender, school bell, fire alarm, hand dryers?",
    "Cannot tolerate Bunnings, Coles, Westfield, shopping centres?",
    "Wears noise-cancelling headphones to school or shops?",
    "Hates haircuts, nail-cutting, hair washing, teeth brushing?",
    "Cuts tags out of clothing, hates seams, wears socks inside out, refuses jeans?",
    "Beige diet — fewer than 10 foods? Won't try new things? Brand-specific?",
    "High pain threshold — didn't cry when broke arm? Doesn't notice cuts? Doesn't feel cold?",
    "Crashes into things, climbs everything, loves being squashed, weighted blanket?",
    "Sniffs food, smells everything new, licks objects?",
    "Watches washing machine / ceiling fan / spinning things for ages?",
  ];
}

function getCrossSettingFollowUps(currentCount: any): string[] {
  void currentCount;
  return [
    "HOME — meltdowns after school, sibling conflict, can't be left alone, bedtime/feeding/toileting issues?",
    "SCHOOL — IEP, EA hours, NCCD, suspensions, working below year level, school refusal?",
    "COMMUNITY — Bunnings/Coles meltdowns, can't fly, GP requires sedation, hairdresser refusal?",
    "PEER/SOCIAL — friends, parties, playdates, sleepovers, recess/lunch experience?",
    "CLINIC — observable in this room? Behaviour today indicative?",
  ];
}

function buildBSubDomainPrompt(code: any, ageYears: any): any {
  const config = {
    B1: {
      category: "Stereotyped/repetitive behaviours",
      promptForClinician:
        "Ask: 'Are there movements, sounds, or actions she does over and over? Hand-flapping, finger-flicking, toe-walking, lining up toys, echoing phrases?'",
      followUps: getB1Probes(ageYears),
    },
    B2: {
      category: "Insistence on sameness",
      promptForClinician:
        "Ask: 'How is she with change, transitions, surprises? What about routines — same breakfast, same route, same cup?'",
      followUps: getB2Probes(ageYears),
    },
    B3: {
      category: "Restricted interests",
      promptForClinician:
        "Ask: 'Is there a topic, character, or thing she's intensely interested in? How much does it dominate her time, conversations, play?'",
      followUps: getB3Probes(ageYears),
    },
    B4: {
      category: "Sensory differences",
      promptForClinician:
        "Ask about every sensory channel: hearing (covers ears? loud places?), vision (lights? squinting?), touch (tags, fabrics, haircuts?), oral (food repertoire?), proprioceptive (crashes, climbs?), olfactory (sniffs things?).",
      followUps: getB4Probes(ageYears),
    },
  };

  const c = (config as Record<string, { category: string; promptForClinician: string; followUps: string[] }>)[code];
  if (!c) {
    return {
      priority: "Moderate",
      criterion: code,
      category: "Criterion B",
      promptForClinician: "Probe this B sub-domain with concrete examples from home and school.",
      expectedSignal: `${code} markers`,
      rationale: "Criterion B sub-domain documentation",
      followUps: [],
      auContext: false,
    };
  }

  return {
    priority: "Critical",
    criterion: code,
    category: c.category,
    promptForClinician: c.promptForClinician,
    expectedSignal: `${code} markers`,
    rationale: `Criterion B sub-domain — needed to reach 2-of-4 threshold`,
    followUps: c.followUps,
    auContext: code === "B4" || code === "B2",
  };
}

function generateClinicianPrompts(matrix: any, ageMonths: any, options: any = {}): any {
  const snap = buildReasoningSnapshot(matrix);
  if (!snap) {
    return {
      prompts: [],
      summary: "Matrix not provided",
      priorityScore: 0,
    };
  }

  const {
    setting = "clinic",
    presentInRoom = ["parent", "child"],
    minutesElapsed = 0,
    transcriptThemes = [],
  } = options;
  void setting;
  void minutesElapsed;
  void transcriptThemes;

  const prompts = [];
  const markersForSettings =
    matrix.allMarkers ||
    matrix.markers ||
    (Array.isArray(matrix) ? matrix.flatMap((row: any) => row.markers || []) : []);

  const settingsDetected = new Set<string>();
  for (const m of markersForSettings) {
    if (!m || typeof m !== "object") continue;
    for (const s of inferSettingFromVerbatim(m.verbatim)) settingsDetected.add(s);
    for (const s of inferSettingFromVerbatim(typeof m.matchedText === "string" ? m.matchedText : "")) {
      settingsDetected.add(s);
    }
  }
  const settingsCountFromMarkers = settingsDetected.size;
  const settingsList = Array.from(settingsDetected);

  const { summary, missingDomains: snapMissing } = snap;
  const missingDomains = matrix.missingDomains?.length
    ? matrix.missingDomains
    : snapMissing;
  const supportEvidence = matrix.supportEvidence || snap.supportEvidence;
  void supportEvidence;

  const ageYears = Math.floor(ageMonths / 12);

  for (const gap of missingDomains as any[]) {
    if (gap.priority !== "Critical") continue;

    if (gap.code === "A1") {
      prompts.push({
        priority: "Critical",
        criterion: "A1",
        category: "Social-emotional reciprocity",
        promptForClinician:
          ageYears < 4
            ? "Ask the parent: 'Does she share her excitement with you — bringing toys to show, looking at your face when something interesting happens?'"
            : ageYears < 7
              ? "Ask the parent: 'When [child] is excited about something, does he share that with you? Does he ask about your day, or notice when you're upset?'"
              : "Ask the parent: 'Tell me about conversations at home. Does [child] ask about other people, or do conversations tend to be one-sided?' Then ask child directly: 'Tell me about your friends and what you talk about.'",
        expectedSignal:
          "A1 markers — sharing of interests/affect, response to others' emotions, reciprocal conversation",
        ifAbsentSays:
          "If parent says no/limited — that's strong A1 evidence. If parent says yes — probe for examples.",
        rationale: "Required for Criterion A — all 3 sub-domains needed for diagnostic threshold",
        followUps: [
          "When something exciting happens (like a plane goes overhead), does she look up and share that moment?",
          "If you're crying or hurt, does he come over and check on you?",
          "Does she ask you how your day was, or about other people in the family?",
        ],
        auContext: false,
      });
    }

    if (gap.code === "A2") {
      prompts.push({
        priority: "Critical",
        criterion: "A2",
        category: "Nonverbal communicative behaviours",
        promptForClinician:
          ageYears < 3
            ? "Ask the parent: 'Has she had her hearing tested? Does she respond to her name? Does she point at things she wants AND things she's interested in?'"
            : ageYears < 7
              ? "Ask the parent: 'When she was little, did she point at things to share — like pointing out a plane in the sky? Did she wave bye-bye? Did she bring you toys to show?'"
              : "Ask the parent: 'Does [child] use gestures naturally when talking? What's his eye contact like? Does his face match what he's saying?'",
        expectedSignal:
          "A2 markers — eye contact, pointing (proto-declarative), gestures, joint attention, prosody",
        ifAbsentSays:
          "Hearing-test-normal-but-no-name-response is near-pathognomonic. Hand-leading is pathognomonic.",
        rationale: "Required for Criterion A — joint attention and pointing are gold-standard early ASD markers",
        followUps: [
          "Hearing test was normal but does he respond when you call his name across the room?",
          "When you point at something, does she look at your finger or at the thing?",
          "Does he pull your hand to what he wants instead of pointing?",
          "How's eye contact when he's talking to you — fleeting, sideways, only when requesting?",
        ],
        auContext: true,
        auContextNote:
          "Reference Personal Health Record/Blue Book hearing screen results if available",
      });
    }

    if (gap.code === "A3") {
      prompts.push({
        priority: "Critical",
        criterion: "A3",
        category: "Relationships",
        promptForClinician:
          ageYears < 5
            ? "Ask the parent: 'Tell me about kindy/daycare — how does she interact with other children? Does she play with them, alongside them, or on her own?'"
            : ageYears < 9
              ? "Ask the parent: 'Does [child] have a best friend? Does he get invited to birthday parties? What does he do at recess and lunch?'"
              : "Ask the child: 'Tell me about your friends. What do you do together? Who do you sit with at lunch?' AND ask parent: 'Does she have reciprocated friendships, or are they one-sided?'",
        expectedSignal:
          "A3 markers — peer interest, friendship maintenance, imaginative play, social hierarchy understanding",
        ifAbsentSays:
          "Plays alone at lunch / hides in library / plays with teachers / no party invitations are all high-value markers",
        rationale: "Required for Criterion A — relationships sub-domain",
        followUps: [
          "Does she play imaginatively — house, shops, doctors — or does she line up toys / sort them / play scripted scenes?",
          "When you watch him with peers, does he play WITH them or ALONGSIDE them?",
          "Does she have a best friend? When you ask her to name a friend, who does she name?",
          "Has she been to a sleepover? Does she get invited to birthday parties?",
        ],
        auContext: true,
        auContextNote:
          "Australian context: kindy, prep, lunch/recess, Auskick, Little Athletics, Nippers participation",
      });
    }

    if (gap.code === "B") {
      const stillNeeded = 2 - (summary.criterionB?.subDomainsPresent || 0);
      prompts.push({
        priority: "Critical",
        criterion: "B",
        category: `Restricted/repetitive behaviours (${stillNeeded} more sub-domain${stillNeeded > 1 ? "s" : ""} needed)`,
        promptForClinician:
          "Probe the four B sub-domains systematically. Each one a parent confirms with examples counts toward the 2-of-4 threshold.",
        expectedSignal:
          "Stereotypies (B1), insistence on sameness (B2), restricted interests (B3), sensory differences (B4)",
        rationale: `Criterion B requires minimum 2 of 4 sub-domains; currently ${summary.criterionB?.subDomainsPresent || 0}/4`,
        followUps: getMissingBSubDomainPrompts(summary, ageYears),
        auContext: true,
      });
    }

    if (gap.code === "ONSET") {
      prompts.push({
        priority: "Critical",
        criterion: "C",
        category: "Developmental onset",
        promptForClinician:
          "Ask the parent: 'Looking back at the early years — before age 3 — were there things you noticed that, in hindsight, were the early signs?' AND 'Do you have your Personal Health Record / Blue Book? Were any concerns raised by the child health nurse, GP, or kindy?'",
        expectedSignal: "Early developmental concerns, milestone delays, regression, screening flags",
        rationale: "DSM-5-TR Criterion C requires symptoms in early developmental period",
        followUps: [
          "Did anyone — the child health nurse, GP, kindy teacher — raise concerns before age 3?",
          "Was there ever a period where she lost words or skills she previously had?",
          "Did she meet milestones on time? First words, walking, pointing, waving?",
          "M-CHAT-R or ASQ-3 screening — was either ever done?",
          "Was she a 'too good' baby — content alone, not demanding attention?",
        ],
        auContext: true,
        auContextNote:
          "Personal Health Record/Blue Book/Purple Book/Red Book is state-specific Australian record",
      });
    }

    if (gap.code === "IMPAIRMENT") {
      prompts.push({
        priority: "Critical",
        criterion: "D",
        category: "Functional impairment",
        promptForClinician:
          "Ask the parent: 'Across home, school, community, friendships — where does this most affect daily life? What can't she do that her peers do?' Ask about NCCD/IEP/EA hours specifically.",
        expectedSignal:
          "School adjustments, family system impact, healthcare access, self-care, community participation",
        rationale:
          "Required for DSM-5-TR Criterion D and for documentation relevant to functional capacity considerations",
        followUps: [
          "Is she on NCCD / does she have an IEP / does she have EA hours allocated?",
          "Are you on Carer Payment / Carer Allowance? Have you had to reduce or stop work?",
          "Can she go to Bunnings, Coles, Westfield without difficulty? What about birthday parties, the cinema, hairdresser, dentist?",
          "Tell me about toilet training / dressing / bathing / eating — does she need prompting or supervision?",
          "Has she ever been suspended, put on a behaviour plan, or had a reduced timetable?",
        ],
        auContext: true,
        auContextNote:
          "Explicit Australian-specific functional impact evidence — NCCD, IEP, EA hours, Carer Payment, Bunnings/Coles/Westfield",
      });
    }
  }

  if (summary.criterionB && summary.criterionB.subDomainsPresent < 2) {
    const missingB = ["B1", "B2", "B3", "B4"].filter((c: any) => {
      const row = findRow(matrix, c);
      return !row || row.count === 0;
    });
    for (const code of missingB) {
      prompts.push(buildBSubDomainPrompt(code, ageYears));
    }
  }

  if (summary.criterionA?.met && summary.criterionA.totalMarkers < 6) {
    prompts.push({
      priority: "Moderate",
      criterion: "A",
      category: "Strengthen Criterion A evidence",
      promptForClinician:
        "Criterion A is met but evidence is thin. Probe for additional examples in each sub-domain to support level-of-support designation.",
      rationale: "More markers = higher confidence and supports Level 2/3 designation",
      followUps: [
        "Tell me about specific moments where you noticed [behaviour] — what does it actually look like?",
        "Has anyone else commented on this — teachers, family members, friends?",
      ],
      auContext: false,
    });
  }

  if (summary.criterionD?.depth === "Limited") {
    prompts.push({
      priority: "High",
      criterion: "D",
      category: "Strengthen functional impairment evidence",
      promptForClinician:
        "Functional impairment is documented but limited. Expand across all six NDIS domains for funding-application-ready evidence.",
      rationale:
        "Planners often weight functional impact heavily; thin Criterion D evidence can weaken planning submissions",
      followUps: [
        "Communication — can she order food, ask for help, advocate for herself?",
        "Social interaction — friendships, peer participation, community engagement?",
        "Learning — accessing the curriculum without support, completing tasks independently?",
        "Mobility — getting to and from school, using public transport, navigating community?",
        "Self-care — hygiene, dressing, toileting, eating, sleep, medication?",
        "Self-management — emotional regulation, planning, decision-making, money, safety?",
      ],
      auContext: true,
    });
  }

  if (settingsCountFromMarkers < 3) {
    prompts.push({
      priority: "High",
      criterion: "PERVASIVENESS",
      category: "Cross-setting evidence",
      promptForClinician: `Currently documented in ${settingsCountFromMarkers}/5 settings (${settingsList.join(", ") || "none yet"}). Probe additional contexts — home, school, community, peer/social, clinic.`,
      rationale: "Pervasiveness across settings is the hallmark of neurodevelopmental aetiology",
      followUps: getCrossSettingFollowUps(settingsCountFromMarkers),
      auContext: true,
    });
  } else if (settingsCountFromMarkers >= 3 && settingsCountFromMarkers < 5) {
    prompts.push({
      priority: "Low",
      criterion: "PERVASIVENESS",
      category: "Cross-setting evidence",
      promptForClinician: `Documented in ${settingsCountFromMarkers}/5 settings (${settingsList.join(", ")}). Consider probing remaining contexts to complete picture.`,
      rationale: "Strong cross-setting evidence; remaining settings would refine the picture",
      followUps: [],
      auContext: true,
    });
  } else {
    prompts.push({
      priority: "Low",
      criterion: "PERVASIVENESS",
      category: "Cross-setting evidence",
      promptForClinician: `Pervasive evidence across all 5 settings (${settingsList.join(", ")}).`,
      rationale: "Comprehensive cross-setting documentation — consistent with neurodevelopmental aetiology",
      followUps: [],
      auContext: true,
    });
  }

  const maskingDepth = summary.modifiers?.masking || 0;
  if (maskingDepth === 0 && ageYears >= 6) {
    prompts.push({
      priority: "Moderate",
      criterion: "MASKING",
      category: "Masking / camouflaging assessment",
      promptForClinician:
        "Probe for masking — particularly important if school presentation differs from home, or if presentation is subtle in clinic.",
      rationale:
        "Late-identified and female/AFAB presentations frequently show observable Level 1 with hidden Level 2-3 needs; missing this leads to under-diagnosis and under-resourcing",
      followUps: [
        "Does she 'hold it together' at school but fall apart at home?",
        "After school, does she need to decompress — meltdown, withdraw, screen time, sleep?",
        "Does he study how to act socially? Mimic peers? Rehearse conversations?",
        "Does she copy phrases from TV/YouTube to use in social interactions?",
        "Has the school ever said 'we don't see any concerns' while you see significant difficulties at home?",
      ],
      auContext: false,
    });
  }

  const safetyDepth = summary.modifiers?.safety || 0;
  if (safetyDepth === 0) {
    prompts.push({
      priority: "Moderate",
      criterion: "SAFETY",
      category: "Safety screen",
      promptForClinician:
        "Always probe safety markers — eloping, road awareness, stranger awareness, self-injury. Document for risk planning where relevant.",
      rationale: "Safety markers are required for risk planning and may inform support intensity in care planning",
      followUps: [
        "Has she ever wandered off — at the shops, at home, at school?",
        "Does he have road awareness? Would he look both ways before crossing?",
        "Stranger danger — does she understand it? Has she ever gone off with someone she didn't know?",
        "Any history of self-injury — head-banging, hitting herself, biting, scratching?",
        "Have police ever been called for missing-person?",
      ],
      auContext: false,
    });
  }

  if (!summary.criterionE?.met) {
    prompts.push({
      priority: "High",
      criterion: "E",
      category: "Differential diagnosis",
      promptForClinician:
        "Confirm cognitive, adaptive, hearing, and language assessments completed or planned. Required to differentiate ASD from ID/GDD/DLD or confirm co-occurrence.",
      rationale:
        "DSM-5-TR Criterion E requires that disturbance is not better explained by ID or GDD alone",
      followUps: [
        "Has cognitive assessment been completed (WPPSI-IV / WISC-V / Leiter-3)?",
        "Vineland-3 or ABAS-3 for adaptive functioning?",
        "Speech pathology assessment to rule out / co-diagnose DLD?",
        "Hearing and vision recently confirmed normal?",
        "Any genetic testing — Fragile X, microarray, FASD assessment?",
      ],
      auContext: false,
    });
  }

  if (presentInRoom.includes("child") && ageYears >= 7) {
    prompts.push({
      priority: "Moderate",
      criterion: "CHILD_VOICE",
      category: "Direct child interview",
      promptForClinician:
        "Build rapport via the child's interest, then probe their own experience. Self-report has high diagnostic value especially for masking presentations.",
      rationale: "Child voice adds direct phenomenology — autistic self-description is often distinctive",
      followUps: [
        "What's your favourite thing to do? Tell me everything about it.",
        "What's the best part of school? What's the hardest part?",
        "Recess and lunch — where do you go, who do you sit with?",
        "Are eyes ever 'too much'? Do certain sounds or smells bother you?",
        "If you could change one thing about school, what would it be?",
        "Do you ever feel like you have to act differently around different people?",
      ],
      auContext: true,
    });
  }

  const priorityOrder: Record<string, number> = { Critical: 0, High: 1, Moderate: 2, Low: 3 };
  prompts.sort(
    (a: any, b: any) =>
      (priorityOrder[a.priority] ?? 99) - (priorityOrder[b.priority] ?? 99)
  );

  const criticalCount = prompts.filter((p: any) => p.priority === "Critical").length;
  const highCount = prompts.filter((p: any) => p.priority === "High").length;

  return {
    prompts,
    summary:
      criticalCount > 0
        ? `${criticalCount} critical gap${criticalCount > 1 ? "s" : ""} block diagnostic threshold; address first.`
        : highCount > 0
          ? `Diagnostic threshold likely met; ${highCount} high-priority probe${highCount > 1 ? "s" : ""} would strengthen evidence and support level-of-support designation.`
          : "Strong evidence base; remaining probes are refinements.",
    priorityScore: prompts.reduce(
      (s: any, p: any) =>
        s +
        (p.priority === "Critical"
          ? 10
          : p.priority === "High"
            ? 5
            : p.priority === "Moderate"
              ? 2
              : 1),
      0
    ),
    promptsByPriority: {
      critical: prompts.filter((p: any) => p.priority === "Critical"),
      high: prompts.filter((p: any) => p.priority === "High"),
      moderate: prompts.filter((p: any) => p.priority === "Moderate"),
    },
  };
}

function emptyDomain(label: any): any {
  return {
    label,
    evidence: [],
    markerCount: 0,
    ndisWeightedCount: 0,
    weightTotal: 0,
    pathognomonicCount: 0,
    auContextCount: 0,
    severity: "None",
    statement: "",
    functionalCapacityLanguage: "",
  };
}

function deriveDomainSeverity(domain: any, key: string): string {
  if (domain.markerCount === 0) return "None";
  const mc = domain.markerCount;
  const pc = domain.pathognomonicCount || 0;
  const ev = domain.evidence || [];
  const t = ev.map((e: any) => `${e.code} ${e.label} ${e.verbatim || ""}`).join(" ").toLowerCase();

  if (key === "mobility") {
    const hard =
      /wander|elope|elop(e|ing)|abscond|ran\s+off|ran\s+into\s+traffic|road\s+safety|traffic\s+awareness|stranger\s+danger|unsafe\s+(in\s+)?(public|community)|lost\s+in\s+(shop|mall|centre|center)|cannot\s+cross|supervision\s+in\s+public|independent\s+community\s+access|do\s+not\s+feel\s+safe\s+allowing|environmental\s+danger/i;
    const nHard = ev.filter((e: any) => hard.test(`${e.label} ${e.verbatim}`)).length;
    if ((nHard >= 3 && mc >= 2) || (nHard >= 2 && mc >= 4)) return "Severe";
    if (nHard >= 2 || (nHard >= 1 && mc >= 5)) return "Substantial";
    if (nHard >= 1 && mc >= 2) return "Mild";
    if (nHard >= 1) return "Limited";
    if (mc >= 6 && /school|education|mobility|participation/i.test(t)) return "Mild";
    return "Limited";
  }

  if (key === "selfCare") {
    const severeAdl =
      /dependen(ce|t)\s+for\s+(adl|daily|hygiene|dress|bath|toilet|feed)|cannot\s+(dress|bathe|toilet|feed|eat)\s+independently|requires\s+help\s+(with\s+)?(eating|dressing|bathing|hygiene|toileting)|direct\s+supervision\s+for\s+(hygiene|dress|toilet|bath)|refuses\s+to\s+(eat|brush)|encopresis|enuresis|sleep\s+(disruption|refusal|avoidance)|major\s+impairment\s+in\s+daily|feeding\s+impairment|hygiene\s+refusal/i;
    const modAdl =
      /prompting\s+for\s+(hygiene|dress|school|eating)|assistance\s+with\s+(dressing|bathing|toileting|feeding)|restricted\s+(diet|food)|food\s+repertoire|extremely\s+restricted\s+food|arfid|beige\s+diet|tasks?\s+not\s+completed\s+without/i;
    const sensoryCosmetic =
      /haircut|clothing\s+tags|texture|seams|socks|tags|sensory\s+aversion|noise\s+sensitivity|auditory\s+sensitivity/i;
    const hasSevere = severeAdl.test(t);
    const hasModAdl = modAdl.test(t);
    const sensoryHeavy = sensoryCosmetic.test(t) && !hasSevere && ev.filter((e: any) => /IMPAIRMENT|ONSET/i.test(e.code)).length === 0;

    if (hasSevere && mc >= 2) return "Severe";
    if (hasSevere || (hasModAdl && mc >= 5 && pc >= 1)) return "Substantial";
    if (hasModAdl && mc >= 3) return "Substantial";
    if (hasModAdl && mc >= 2) return "Mild";
    if (sensoryHeavy && mc < 8) return mc >= 4 ? "Mild" : "Limited";
    if (mc >= 8 && pc >= 2) return "Severe";
    if (mc >= 6 || pc >= 2) return "Substantial";
    if (mc >= 3) return "Mild";
    return "Limited";
  }

  if (key === "learning") {
    const edu =
      /iep|ilp|nccd|below\s+year|naplan|curriculum|ea\s+hours|education\s+assistant|modified\s+expectations|suspension|school\s+refusal|non[-\s]?attendance|specialist\s+school|cannot\s+manage|accommodations?|learning\s+support|significant\s+difficult/i;
    if (edu.test(t) && mc >= 4) return "Substantial";
    if (edu.test(t) && mc >= 2) return "Mild";
    if (mc >= 8 && pc >= 2) return "Severe";
    if (mc >= 6 && edu.test(t)) return "Substantial";
    if (mc >= 5) return "Mild";
    if (mc >= 3) return "Limited";
    return "Limited";
  }

  if (key === "selfManagement") {
    const exec =
      /executive|emotional\s+regulation|self[-\s]?regulation|meltdown|planning|organisation|transition|anxiety\s+avoid|school\s+refusal|shutdown|demand\s+avoid/i;
    const b1Only =
      mc > 0 &&
      ev.every((e: any) => /^(B1|B3)$/i.test(String(e.code))) &&
      !exec.test(t);
    if (b1Only && mc < 8) return mc >= 4 ? "Mild" : "Limited";
    if (mc >= 8 && pc >= 2 && exec.test(t)) return "Severe";
    if (mc >= 6 && exec.test(t)) return "Substantial";
    if (mc >= 4 && exec.test(t)) return "Mild";
    if (mc >= 6) return "Mild";
    if (mc >= 3) return "Limited";
    return "Limited";
  }

  if (mc >= 8 && pc >= 3) return "Severe";
  if (mc >= 6 || pc >= 2) return "Substantial";
  if (mc >= 3) return "Mild";
  return "Limited";
}

function buildDomainStatement(domain: any, key: any): string {
  void key;
  if (domain.markerCount === 0) {
    return `${domain.label}: No specific markers documented in this domain.`;
  }
  const severityPhrase =
    domain.severity === "Severe"
      ? "severe and pervasive impairment"
      : domain.severity === "Substantial"
        ? "substantial impairment"
        : domain.severity === "Mild"
          ? "mild but consistent impairment"
          : "limited evidence of impairment";

  const w = typeof domain.ndisWeightedCount === "number" ? domain.ndisWeightedCount : domain.markerCount;
  const examples = (domain.evidence || [])
    .filter((e: any) => !isHistoricalContext(e.verbatim))
    .slice(0, 3)
    .map((e: any) => e.label)
    .join("; ");
  return `${domain.label}: ${severityPhrase} documented across ${domain.markerCount} mapped markers (NDIS-weighted load ${Number(w).toFixed(1)}). Representative current-context examples: ${examples}.`;
}

function buildFunctionalCapacityLanguage(domain: any, key: any): string | null {
  if (domain.markerCount === 0) return null;

  const templates = {
    communication:
      domain.severity === "Severe" || domain.severity === "Substantial"
        ? "The participant may have substantially reduced functional capacity in communication, requiring support to engage in reciprocal exchange, use and interpret nonverbal communication, and adapt communication to listener needs across daily life."
        : "The participant may have reduced functional capacity in communication and benefit from communication-related support across daily contexts.",
    socialInteraction:
      domain.severity === "Severe" || domain.severity === "Substantial"
        ? "The participant may have substantially reduced functional capacity in social interaction, requiring support to develop and maintain age-appropriate peer relationships, navigate social contexts, and participate in social activities."
        : "The participant may have reduced functional capacity in social interaction and require support to engage with peers and community.",
    learning:
      domain.severity === "Severe" || domain.severity === "Substantial"
        ? "The participant may have substantially reduced functional capacity in learning, requiring substantial educational adjustments and adult-mediated support to access curriculum and complete learning tasks."
        : "The participant may have reduced functional capacity in learning and benefit from educational adjustments and learning support.",
    mobility:
      domain.severity === "Severe" || domain.severity === "Substantial"
        ? "The participant may have substantially reduced functional capacity in mobility and community navigation, requiring supervision and support to move safely through community environments."
        : "The participant may have reduced functional capacity in mobility/community access in specific high-stimulation contexts.",
    selfCare:
      domain.severity === "Severe" || domain.severity === "Substantial"
        ? "The participant may have substantially reduced functional capacity in self-care, requiring prompting, supervision, or direct assistance for daily living tasks including hygiene, dressing, eating, and toileting."
        : "The participant may have reduced functional capacity in specific self-care tasks and require prompting or support.",
    selfManagement:
      domain.severity === "Severe" || domain.severity === "Substantial"
        ? "The participant may have substantially reduced functional capacity in self-management, requiring support for emotional regulation, planning and organisation, decision-making, and managing transitions and unexpected events."
        : "The participant may have reduced functional capacity in self-management and require scaffolding for executive functioning and emotional regulation.",
  };

  return (templates as Record<string, string | null>)[key] || null;
}

function buildFullNDISStatement(domains: any, overallSeverity: any): string {
  const entries = Object.entries(domains) as [string, any][];
  const affected = entries
    .filter(([, d]) => d.severity !== "None" && d.severity !== "Limited")
    .map(([, d]) => d.functionalCapacityLanguage)
    .filter(Boolean);

  if (affected.length === 0) {
    return "Insufficient documented impairment to describe substantially reduced functional capacity across NDIS domains in this draft.";
  }

  return [
    `The participant presents with ${overallSeverity.toLowerCase()} functional impact consistent with a permanent and lifelong neurodevelopmental condition when interpreted alongside full clinical assessment. Functional capacity has been mapped across the six NDIS domains as follows:`,
    "",
    ...affected,
    "",
    "These difficulties may be long-standing; supports should be framed as reasonable and necessary where eligibility criteria are met, pending individual NDIS determination.",
  ].join("\n\n");
}

function isHistoricalContext(verbatim: string | null | undefined): boolean {
  if (!verbatim) return false;
  const v = verbatim.toLowerCase();
  return /\b(when (he|she|they) was (a|an)?\s*(baby|toddler|child|young)|early childhood|in childhood|developmentally|as a child|when (he|she|they) were (younger|little)|toddler(hood)?|preschool(\s+years)?|primary\s+school\s+years|in\s+early\s+years|developmental\s+history|historically|used\s+to|from\s+an?\s+early\s+age)\b/.test(
    v
  );
}

function deriveNdisSeverityFromWeightedCount(w: number): string {
  if (w <= 0) return "None";
  if (w >= 8) return "Severe";
  if (w >= 4) return "Substantial";
  if (w >= 2) return "Mild";
  return "Limited";
}

function isAdlSelfCareEvidenceText(text: string): boolean {
  return /\b(prompt(ing|ed)?\s+(for|to|with)|supervision\s+(for|with))\b.*\b(hygiene|dress|bath|shower|toilet|feed|eat|brush)|\bneeds?\s+(help|assistance|support|caregiver)\b.*\b(dress|bath|shower|toilet|feed|hygiene|meals)\b|\b(depend\w+|unable\s+to)\b.*\b(adl|daily\s+living|self-?care|hygiene|toilet|feeding)\b|\b(encopresis|enuresis|incontinen|sleep\s+disruption|night\s+waking|medication\s+management)\b|\barfid\b|\bbeige\s+diet\b|\b(won'?t|refuses?)\s+(eat|feed|dress|shower)\b|\brequires?\s+ongoing\b.*\b(hygiene|dress|adl|self-?care)\b/i.test(
    text
  );
}

function isSensorySelfCareSecondaryText(text: string): boolean {
  return /\b(covers?\s+ears|hand\s+dryer|auditory|hyperacusis|noise|haircut|tags?|seams?|texture|clothing|socks|fluorescent|sensory\s+avers|sensory\s+seek)\b/i.test(
    text
  );
}

function selfManagementThemeForClustering(e: any): string {
  const t = `${e.code || ""} ${e.label || ""}`.toLowerCase();
  if (/^b4|\bsensory\b|auditory|tactile|visual|smell|texture|noise|ear|cover|fluorescent/.test(t)) return "sensory";
  if (/^b2|\brigid|\bsameness|\broutine|\btransition|\bmeltdown|\binflex/.test(t)) return "rigidity";
  if (/^b1|motor|stereotyp|echolal|repetitive\s+speech|finger\s+flick/.test(t)) return "stereo";
  if (/^b3|interest|obsess|fixat|circumscrib|restricted\s+interest/.test(t)) return "interest";
  if (/masking|camouflag|exhaust|performance|school.*home|holds\s+it\s+together/.test(t)) return "masking";
  if (/exec|organis|plan|regulation|anxiety|refusal|shutdown|demand|self[-\s]?reg/.test(t)) return "exec";
  return "other";
}

function selfManagementClusteredWeightedSum(evidence: any[]): number {
  const byTheme: Record<string, number> = {};
  for (const e of evidence) {
    const th = selfManagementThemeForClustering(e);
    const w = typeof e.ndisWeight === "number" ? e.ndisWeight : 1;
    byTheme[th] = (byTheme[th] || 0) + w;
  }
  const cap: Record<string, number> = {
    sensory: 2.35,
    rigidity: 2.35,
    stereo: 2.15,
    interest: 2.15,
    masking: 2.0,
    exec: 2.65,
    other: 2.85,
  };
  let total = 0;
  for (const [k, v] of Object.entries(byTheme)) {
    total += Math.min(v, cap[k] ?? 2.5);
  }
  return total;
}

function mapToNDISDomains(markers: any, matrix: any): any {
  void matrix;
  if (!markers || !Array.isArray(markers)) {
    return {
      domains: {},
      summary: "No markers provided",
      overallSeverity: "Unknown",
    };
  }

  const domains: Record<string, any> = {
    communication: emptyDomain("Communication"),
    socialInteraction: emptyDomain("Social interaction"),
    learning: emptyDomain("Learning"),
    mobility: emptyDomain("Mobility"),
    selfCare: emptyDomain("Self-care"),
    selfManagement: emptyDomain("Self-management"),
  };

  const codeToDomain: Record<string, string[]> = {
    A1: ["socialInteraction", "communication"],
    A2: ["communication", "socialInteraction"],
    A3: ["socialInteraction"],
    B1: ["selfManagement"],
    B2: ["selfManagement", "learning"],
    B3: ["learning"],
    B4: ["selfManagement"],
    SAFETY: ["mobility", "selfManagement"],
    MASKING: ["selfManagement"],
    COOCCURRING: ["learning", "selfManagement"],
  };

  const keywordOverrides = [
    { keywords: ["toilet", "encopresis", "enuresis", "wetting", "soiling", "nappies"], domains: ["selfCare"] },
    { keywords: ["dressing", "bathing", "haircut", "teeth brushing", "hygiene"], domains: ["selfCare"] },
    { keywords: ["food", "eat", "feeding", "ARFID", "beige diet"], domains: ["selfCare"] },
    { keywords: ["sleep", "bedtime", "night waking"], domains: ["selfCare"] },
    {
      keywords: [
        "road safety",
        "road awareness",
        "traffic awareness",
        "stranger danger",
        "wandering away in public",
        "eloping in public",
        "elopement",
        "public transport",
        "uses bus",
        "uses train",
        "navigation",
        "getting around independently",
        "motor coordination",
        "DCD",
        "dyspraxia",
        "low muscle tone",
        "W-sitting",
        "independent community access",
      ],
      domains: ["mobility"],
    },
    {
      keywords: ["IEP", "ILP", "NCCD", "EA hours", "education assistant", "below year level"],
      domains: ["learning"],
    },
    {
      keywords: ["school refusal", "non-attendance", "suspension"],
      domains: ["learning", "selfManagement"],
    },
    { keywords: ["NAPLAN", "homework", "curriculum"], domains: ["learning"] },
    {
      keywords: [
        "meltdown",
        "regulation",
        "self-regulation",
        "executive function",
        "planning",
        "organisation",
      ],
      domains: ["selfManagement"],
    },
    { keywords: ["money", "decision-making", "independence"], domains: ["selfManagement"] },
    {
      keywords: ["pretend play", "imaginative play", "friendship", "playdate", "party", "peer"],
      domains: ["socialInteraction"],
    },
    {
      keywords: ["eye contact", "pointing", "gesture", "joint attention", "echolalia", "prosody"],
      domains: ["communication"],
    },
    {
      keywords: ["Bunnings", "Coles", "Westfield", "shopping centre", "cinema"],
      domains: ["selfManagement"],
    },
  ];

  const seen = new Set<string>();
  for (const marker of markers) {
    if (marker.viaCrossTag) continue;
    const key = `${marker.code}::${marker.label}::${(marker.verbatim || "").slice(0, 40)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const codeDomains = codeToDomain[marker.code] || [];
    const labelLower = (marker.label || "").toLowerCase();
    const verbatimLower = (marker.verbatim || "").toLowerCase();
    const text = labelLower + " " + verbatimLower;

    const mappedDomains = new Set(codeDomains);

    for (const override of keywordOverrides) {
      if (override.keywords.some((k: string) => text.includes(k.toLowerCase()))) {
        for (const d of override.domains) mappedDomains.add(d);
      }
    }

    for (const domainKey of mappedDomains) {
      if (!domains[domainKey]) continue;
      const blob = labelLower + " " + verbatimLower;
      let ndisW = isHistoricalContext(marker.verbatim) ? 0.3 : 1;
      if (domainKey === "selfCare") {
        if (isSensorySelfCareSecondaryText(blob) && !isAdlSelfCareEvidenceText(blob)) {
          ndisW *= 0.32;
        }
      }
      domains[domainKey].evidence.push({
        code: marker.code,
        label: marker.label,
        verbatim: marker.verbatim,
        weight: marker.weight,
        confidence: marker.confidence,
        source: marker.source,
        setting: marker.setting,
        auContext: marker.auContext,
        ndisWeight: ndisW,
      });
      domains[domainKey].markerCount++;
      domains[domainKey].weightTotal += marker.weight || 1.0;
      if (marker.weight >= 1.7) domains[domainKey].pathognomonicCount++;
      if (marker.auContext) domains[domainKey].auContextCount++;
    }
  }

  for (const [key, domain] of Object.entries(domains)) {
    if (key === "selfManagement") {
      domain.ndisWeightedCount = selfManagementClusteredWeightedSum(domain.evidence || []);
    } else {
      domain.ndisWeightedCount = (domain.evidence || []).reduce(
        (s: number, e: any) => s + (typeof e.ndisWeight === "number" ? e.ndisWeight : 1),
        0
      );
    }
    domain.severity = deriveNdisSeverityFromWeightedCount(domain.ndisWeightedCount);
    if (key === "selfCare") {
      const adlW = (domain.evidence || [])
        .filter((e: any) =>
          isAdlSelfCareEvidenceText(`${e.label || ""} ${e.verbatim || ""}`)
        )
        .reduce(
          (s: number, e: any) => s + (typeof e.ndisWeight === "number" ? e.ndisWeight : 1),
          0
        );
      if (domain.severity === "Severe" && adlW < 3.0) domain.severity = "Substantial";
    }
    domain.statement = buildDomainStatement(domain, key);
    domain.functionalCapacityLanguage = buildFunctionalCapacityLanguage(domain, key);
  }

  const severityScores = Object.values(domains).map((d: any) =>
    d.severity === "Severe" ? 3 : d.severity === "Substantial" ? 2 : d.severity === "Mild" ? 1 : 0
  );
  const maxSeverity = Math.max(...severityScores);
  const domainsAtSubstantialOrAbove = severityScores.filter((s: number) => s >= 2).length;
  const overallSeverity =
    maxSeverity === 3
      ? "Severe across one or more domains"
      : domainsAtSubstantialOrAbove >= 3
        ? "Substantial across multiple domains"
        : maxSeverity === 2
          ? "Substantial in at least one domain"
          : maxSeverity === 1
            ? "Mild"
            : "Insufficient evidence";

  const ndisAct24Met =
    domainsAtSubstantialOrAbove >= 1 ||
    Object.values(domains).some((d: any) => d.pathognomonicCount >= 2);

  return {
    domains,
    overallSeverity,
    ndisAct24Met,
    domainsAtSubstantialOrAbove,
    summary: ndisAct24Met
      ? `Clinical note markers suggest possible substantially reduced functional capacity across ${domainsAtSubstantialOrAbove} domain(s) — this supports consideration of NDIS Act 2013 s24(1)(c) wording only after full assessment; it is not a determination of eligibility.`
      : "Evidence does not yet clearly describe substantially reduced functional capacity across NDIS domains in this draft.",
    fullStatement: buildFullNDISStatement(domains, overallSeverity),
    priorityDomains: (Object.entries(domains) as [string, any][])
      .filter(([, d]) => d.severity === "Severe" || d.severity === "Substantial")
      .map(([key, d]) => ({
        key,
        label: d.label,
        severity: d.severity,
        markerCount: d.markerCount,
        ndisWeightedCount: d.ndisWeightedCount,
      })),
  };
}

function passesPicaLicksEvidenceGate(marker: any): boolean {
  const label = (marker.label || "").toLowerCase();
  if (!label.includes("licks objects") && !label.includes("pica")) return true;
  const v = (marker.verbatim || "").toLowerCase();
  const terms = [
    "lick",
    "licks",
    "licking",
    "mouth",
    "mouths",
    "mouthing",
    "pica",
    "non-food",
    "non food",
    "eats non",
    "chews non",
    "puts non",
  ];
  return terms.some((t) => v.includes(t));
}

function filterMarkersForClinicalPipeline(markers: any[]): any[] {
  if (!markers || !Array.isArray(markers)) return [];
  return markers.filter(passesPicaLicksEvidenceGate);
}

function dedupeMarkersForEvidenceList(markers: any[]): any[] {
  const seen = new Set<string>();
  const out: any[] = [];
  for (const m of markers) {
    const k = `${m.code}|${m.label}|${(m.verbatim || "").slice(0, 120)}`;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(m);
  }
  return out;
}

function matrixRowByCode(matrix: any, code: string): any {
  if (!matrix || typeof matrix.find !== "function") return null;
  return matrix.find((r: any) => r?.code === code) || null;
}

function signalStatusFromCounts(total: number, strongAt: number, moderateAt: number): "Strong" | "Moderate" | "Emerging" {
  if (total >= strongAt) return "Strong";
  if (total >= moderateAt) return "Moderate";
  return "Emerging";
}

function buildKeyClinicalSignalRows(markers: any[], matrix: any): { title: string; status: "Strong" | "Moderate" | "Emerging"; sentence: string }[] {
  const row = (code: string) => matrixRowByCode(matrix, code);
  const a1 = row("A1");
  const a2 = row("A2");
  const a3 = row("A3");
  const b1 = row("B1");
  const b2 = row("B2");
  const b3 = row("B3");
  const b4 = row("B4");
  const imp = row("IMPAIRMENT");

  const st = (r: any): "Strong" | "Moderate" | "Emerging" => {
    if (!r || !r.count) return "Emerging";
    if (r.status === "Strong") return "Strong";
    if (r.status === "Partial") return "Moderate";
    return "Emerging";
  };

  const socialCommN = (a1?.count || 0) + (a2?.count || 0);
  const socialCommStatus = signalStatusFromCounts(socialCommN, 6, 2);
  const peerStatus = st(a3);
  const rigidStatus = st(b2);
  const rrbN = (b1?.count || 0) + (b3?.count || 0);
  const rrbStatus = signalStatusFromCounts(rrbN, 6, 2);
  const sensoryStatus = st(b4);
  const funcStatus = st(imp);

  const safetyN = markers.filter((m: any) => m.code === "SAFETY").length;
  const communityN = markers.filter((m: any) => {
    const t = `${m.label || ""} ${m.verbatim || ""}`.toLowerCase();
    return /wander|elope|elop(e|ing)|abscond|ran\s+off|road\s+safety|traffic\s+awareness|stranger\s+danger|unsafe\s+(community|public|navigation)|supervision\s+in\s+public|got\s+lost|lost\s+in\s+(shop|mall|centre|center)|independent\s+community\s+access|do\s+not\s+feel\s+safe\s+allowing|environmental\s+danger/i.test(
      t
    );
  }).length;
  const safetyCombo = safetyN + communityN;
  const safetyStatus = signalStatusFromCounts(safetyCombo, 4, 2);

  const line = (status: "Strong" | "Moderate" | "Emerging", strong: string, mod: string, em: string) =>
    status === "Strong" ? strong : status === "Moderate" ? mod : em;

  return [
    {
      title: "Social communication",
      status: socialCommStatus,
      sentence: line(
        socialCommStatus,
        "Reciprocal and nonverbal communication differences are well described across the note.",
        "There are clear social-communication features, with room to add more concrete back-and-forth examples.",
        "Early social-communication features are suggested; probe sharing, initiation, and nonverbal integration."
      ),
    },
    {
      title: "Peer relationships",
      status: peerStatus,
      sentence: line(
        peerStatus,
        "Peer-related and relationship patterns are substantively documented.",
        "Relationship and peer-context difficulties are emerging in the narrative.",
        "Peer play, friendships, and context-appropriate behaviour need clearer examples."
      ),
    },
    {
      title: "Rigidity and transitions",
      status: rigidStatus,
      sentence: line(
        rigidStatus,
        "Insistence on sameness, routines, and transition breakdowns are prominent.",
        "Rigidity or transition stress is present; detail typical antecedents and settings.",
        "Limited documentation of sameness or transition difficulty so far."
      ),
    },
    {
      title: "Repetitive behaviours",
      status: rrbStatus,
      sentence: line(
        rrbStatus,
        "Motor/speech stereotypy and/or fixated interests are repeatedly noted.",
        "Repetitive patterns or circumscribed interests are suggested.",
        "Add specific examples of stereotypy, rituals, or intense interests."
      ),
    },
    {
      title: "Sensory profile",
      status: sensoryStatus,
      sentence: line(
        sensoryStatus,
        "Sensory reactivity or unusual sensory interests are well represented.",
        "Some sensory differences are described; expand modalities and everyday impact.",
        "Sensory profile is not yet clearly characterised in the notes."
      ),
    },
    {
      title: "Functional impact",
      status: funcStatus,
      sentence: line(
        funcStatus,
        "Adaptive and everyday functional impact is clearly tied to the presentation.",
        "Functional impact is emerging—strengthen links to school, home, and supports.",
        "Criterion D-style impairment is not yet clearly documented."
      ),
    },
    {
      title: "Safety / community access",
      status: safetyStatus,
      sentence: line(
        safetyStatus,
        "Safety or community-navigation concerns are explicitly documented.",
        "Some safety or community-context vulnerability is hinted; confirm and plan.",
        "No clear safety or community-access stressors are documented yet."
      ),
    },
  ];
}

function hasStructuredAssessmentInput(adjuncts: any): boolean {
  if (!adjuncts) return false;
  return (
    adjuncts.vinelandABC != null ||
    adjuncts.abasGAC != null ||
    adjuncts.cognitiveFSIQ != null ||
    adjuncts.sensoryProfile2 != null ||
    adjuncts.ados2ComparisonScore != null ||
    adjuncts.srs2TScore != null
  );
}

function notesIndicateExplicitLevel3(text: string): boolean {
  if (!text || !String(text).trim()) return false;
  const t = text.toLowerCase();
  const patterns = [
    /\blevel\s*3\b/,
    /\bdsm[- ]?5[- ]?tr.*level\s*3\b/,
    /\bvery substantial support\b/,
    /\brequir(e|ing) very substantial\b/,
    /\b24\s*\/\s*7\b/,
    /\b24\s*[-–]\s*7\b/,
    /\bconstant (1:1|one[- ]to[- ]one|supervision)\b/,
    /\bnon[- ]?verbal\b.*\b(minimal|no)\b.*\b(reciprocal|functional)\b.*\bcommunication\b/,
    /\bprofound\b.*\b(intellectual|support)\b/,
    /\bsevere\s+adaptive\b/,
    /\badaptive\s+functioning.*\b(severely|profoundly)\s+(impaired|limited|low)\b/,
    /\bextreme\s+safety\b/,
    /\bimminent\s+risk\b/,
    /\bunable\s+to\s+(function|participate|remain)\b.*\bwithout\b.*\b(major|intensive|constant|substantial|full[- ]time)\b.*\b(support|supervision|1:1|one[- ]to[- ]one)\b/,
    /\binability\s+to\s+function\b.*\b(without|unless)\b.*\b(major|intensive|very substantial|constant)\b/,
  ];
  return patterns.some((re) => re.test(t));
}

/** Level 3 is not inferred from marker volume alone. Allow L3 only with explicit note wording or severe structured scores. */
function level3PermittedByEvidence(structuredInputs: any, sourceNotes: string): boolean {
  if (notesIndicateExplicitLevel3(sourceNotes || "")) return true;
  if (!structuredInputs) return false;
  const { vinelandABC, abasGAC, cognitiveFSIQ, ados2ComparisonScore } = structuredInputs;
  if (vinelandABC != null && typeof vinelandABC === "number" && vinelandABC < 55) return true;
  if (abasGAC != null && typeof abasGAC === "number" && abasGAC < 55) return true;
  if (cognitiveFSIQ != null && typeof cognitiveFSIQ === "number" && cognitiveFSIQ < 50) return true;
  if (ados2ComparisonScore != null && typeof ados2ComparisonScore === "number" && ados2ComparisonScore >= 9)
    return true;
  return false;
}

export function buildClinicianSelfCareStatement(domain: any): string {
  if (domain.markerCount === 0) {
    return `${domain.label}: No specific markers documented in this domain.`;
  }
  const severityPhrase =
    domain.severity === "Severe"
      ? "severe and pervasive impairment"
      : domain.severity === "Substantial"
        ? "substantial impairment"
        : domain.severity === "Mild"
          ? "mild but consistent impairment"
          : "limited evidence of impairment";

  const allowed =
    /hygiene|dress|dressing|bath|toilet|toileting|feed|feeding|eating|arfid|restricted food|beige diet|food refusal|sleep|bedtime|night waking|medication|groom|haircut|teeth|brushing|daily living|adl|shower|wash|nappy|nappies|diaper|encopresis|enuresis|wetting|soiling|incontinen/i;
  const exclude =
    /echolalia|youtube|repeated questions|repetitive speech|spinning|lining up|scripted speech|echopraxia|peppa|paw patrol/i;

  const picked = (domain.evidence || []).filter((e: any) => {
    const t = `${e.label || ""} ${e.verbatim || ""}`;
    if (exclude.test(t)) return false;
    return allowed.test(t);
  });

  if (!picked.length) {
    return `${domain.label}: ${severityPhrase} suggested in this domain; everyday self-care examples (hygiene, meals, sleep, toileting) are not yet clearly excerpted—see Evidence view for the full marker map.`;
  }

  const examples = picked
    .slice(0, 3)
    .map((e: any) => e.label)
    .join("; ");
  return `${domain.label}: ${severityPhrase} documented across ${domain.markerCount} markers. Representative self-care examples: ${examples}.`;
}


export function reportAsdFixture(rawNotes: string) {
  const markers = filterMarkersForClinicalPipeline(extractMarkers(rawNotes));
  const crossSetting = detectCrossSettingImpact(rawNotes, markers);
  const m = buildDSMMatrix(markers) as any;
  m.allMarkers = markers;
  m.pervasiveness = {
    settingsCount: crossSetting.settingsCount ?? crossSetting.count ?? 0,
  };
  const level = deriveLevelOfSupport(m, { sourceNotes: rawNotes });
  const ndis = mapToNDISDomains(markers, m);
  const codes = ["A1", "A2", "A3", "B1", "B2", "B3", "B4", "MASKING", "IMPAIRMENT", "SAFETY"];
  const byCode: Record<string, number> = {};
  for (const c of codes) byCode[c] = markers.filter((x: any) => x.code === c).length;
  const maskingSamples = markers
    .filter((x: any) => x.code === "MASKING")
    .slice(0, 14)
    .map((x: any) => ({ label: x.label, verbatim: x.verbatim }));
  return { byCode, level, ndis, crossSetting, maskingSamples };
}

export function useAsdEnginePipeline(rawNotes: string) {
  const markers = useMemo(
    () => filterMarkersForClinicalPipeline(extractMarkers(rawNotes)),
    [rawNotes]
  );
  const evidenceMarkersList = useMemo(() => dedupeMarkersForEvidenceList(markers), [markers]);
  const contradictions = useMemo(() => detectContradictions(rawNotes, markers), [rawNotes, markers]);
  const severity = useMemo(
    () => ({
      score: computeMarkerSignalIndex(markers),
      label: deriveAsdThresholdSignalWording(markers, contradictions, rawNotes),
    }),
    [markers, contradictions, rawNotes]
  );
  const draft = useMemo(() => generateDraft(markers, rawNotes, contradictions), [markers, rawNotes, contradictions]);
  const missing = useMemo(() => buildMissingEvidence(markers), [markers]);
  const evidenceLedger = useMemo(() => buildEvidenceLedger(rawNotes, markers), [rawNotes, markers]);
  const supportNeeds = useMemo(() => estimateSupportNeeds(markers), [markers]);
  const crossSetting = useMemo(
    () => detectCrossSettingImpact(rawNotes, markers),
    [rawNotes, markers]
  );

  const dsmMatrix = useMemo(() => {
    const m = buildDSMMatrix(markers) as any;
    m.allMarkers = markers;
    m.pervasiveness = {
      settingsCount: crossSetting.settingsCount ?? crossSetting.count ?? 0,
    };
    return m;
  }, [markers, crossSetting]);

  const levelOfSupport = useMemo(
    () => deriveLevelOfSupport(dsmMatrix, { sourceNotes: rawNotes }),
    [dsmMatrix, rawNotes]
  );

  const clinicianPrompts = useMemo(
    () => generateClinicianPrompts(dsmMatrix, 120),
    [dsmMatrix]
  );

  const ndisDomains = useMemo(
    () => mapToNDISDomains(markers, dsmMatrix),
    [markers, dsmMatrix]
  );

  const keyClinicalSignalRows = useMemo(
    () => buildKeyClinicalSignalRows(markers, dsmMatrix),
    [markers, dsmMatrix]
  );

  return {
    rawNotes,
    markers,
    evidenceMarkersList,
    contradictions,
    severity,
    draft,
    missing,
    evidenceLedger,
    supportNeeds,
    crossSetting,
    dsmMatrix,
    levelOfSupport,
    clinicianPrompts,
    ndisDomains,
    keyClinicalSignalRows,
  };
}
