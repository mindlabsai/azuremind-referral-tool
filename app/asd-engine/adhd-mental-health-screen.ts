// ADHD mental-health & risk screen.
// RISK: always surfaced, no green light, no count gate (inherited safety floor).
// DEPRESSION / ANXIETY: surfaced only when greenLight=true, and only as clusters for
// the clinician to characterise. The engine NEVER decides depression vs ASD-feature,
// NEVER decides contextual vs standalone. The clinician's framing in the notes is final.
//
// DEBT: the risk regex set is copied verbatim from asd-engine-core.tsx (self-directed
// risk marker). Consolidate both into a shared lib/clinical-risk-detector.ts later.

const RISK_PATTERNS: RegExp[] = [
  /want(s|ed)?\s+to\s+(die|not\s+be\s+(alive|here))/i,
  /(doesn'?t|does\s+not|don'?t|did\s+not|didn'?t)\s+want\s+to\s+(live|be\s+(alive|here|around))/i,
  /not\s+want(ing)?\s+to\s+be\s+(alive|here|around)/i,
  /wish(es|ed)?\s+(she|he|they|i)\s+(was|were|wasn'?t|weren'?t)\s+(never\s+born|not\s+here|here|dead|gone)/i,
  /(talk(s|ed|ing)?|thinking)\s+about\s+not\s+(being\s+(here|around|alive)|existing)/i,
  /(go|going)\s+to\s+sleep\s+and\s+not\s+wak(e|ing)\s+up/i,
  /want(s|ed)?\s+to\s+be\s+(gone|dead)/i,
  /kill\s+(her|him|them|my)self/i,
  /end\s+(her|his|their|my)\s+(life|it\s+all)/i,
  /hit(s|ting)?\s+(her|him|them|it)self/i,
  /hit(s|ting)?\s+(her|his|their)\s+(own\s+)?(arms?|head|body)/i,
  /punch(es|ing)?\s+(her|him|them)self/i,
  /bang(s|ing)?\s+(her|his|their)\s+head/i,
  /head[-\s]?bang/i,
  /bit(es|ing)?\s+(her|him|them)self/i,
  /scratch(es|ing)?\s+(at\s+)?(her|his|their)\s+(own\s+)?(skin|arms?|face)/i,
  /pinch(es|ing)?\s+(her|him|them)self/i,
  /pick(s|ing)?\s+(at\s+)?(her|his|their)\s+(own\s+)?(skin|arms?|scabs?)/i,
  /cut(s|ting)?\s+(her|him|them)self/i,
  /scratch(es|ing)?\s+(her|him|them)self/i,
  /self[-\s]?harm/i,
  /self[-\s]?injur/i,
  /self[-\s]?destruct/i,
  /hurt(s|ing)?\s+(her|him|them)self/i,
  /suicid/i,
  /passive\s+(SI|ideation)/i,
  /wants?\s+to\s+disappear/i,
  /better\s+off\s+(dead|without|if)/i,
  /life\s+(isn.?t|is\s+not|ain.?t|not)\s+(being\s+)?worth/i,
  /(not|never|no\s+longer)\s+worth\s+living/i,
  /no\s+point\s+(in\s+)?(living|life|going\s+on|being\s+here)/i,
  /thoughts?\s+about\s+(life|living).{0,20}(not\s+)?worth/i,
  /(there'?s|there\s+is)\s+no\s+point/i,
  /hat(es|ed|ing)?\s+(her|him|them)self/i,
];

// Depression markers. "motivationPreferred" (loss of drive even for enjoyed/preferred
// activities) is the cleanest depressive signal and is weighted by being its own marker.
const DEPRESSION = {
  lowMood: /low\s+mood|persistently\s+sad|down\s+(most|a lot)|tearful|flat\s+affect|depress/i,
  motivationPreferred:
    /(no|not|lost|reduced|less)\s+(motivation|interest|drive)\b|stopped\s+enjoying|no\s+longer\s+enjoys?|even\s+(the\s+)?(things|activities)\s+(she|he|they)\s+(used\s+to\s+)?(love|enjoy)|not\s+interested\s+in\s+(anything|things\s+(she|he)\s+(loved|enjoyed))/i,
  worthlessness:
    /worthless|negative\s+self[-\s]?talk|hates?\s+(her|him|them)self|letting\s+(everyone|them|her|him)\s+down|cannot\s+do\s+anything|good\s+for\s+nothing/i,
  selfCare: /(decline|stopped|neglect).{0,15}(self[-\s]?care|hygiene|showering|eating)|not\s+looking\s+after\s+(her|him)self/i,
  sleep: /sleep.{0,20}(disturb|problem|hard|waking|cannot\s+sleep|early\s+waking)|insomnia|wakes?\s+(early|at\s+night)/i,
};

// Anxiety markers, with context capture for the situational-vs-pervasive read.
const ANXIETY = {
  worryRumination:
    /worr(y|ies|ied)|ruminat|over[-\s]?think|plays?\s+(it|this)\s+over|social[-\s]?evaluat|worries\s+about\s+saying\s+the\s+right\s+thing/i,
  avoidance: /avoid|school\s+refus|withdr(aw|ew)|won'?t\s+(go|leave)|refuses?\s+to\s+(go|attend)/i,
  somatic: /stomach\s+ache|tummy\s+(ache|pain)|headache|feels?\s+sick|racing\s+heart|panic/i,
  context: /crowds?|change|new\s+(teacher|situation|environment)|performance|exams?|social\s+situations?/i,
};

export type MentalHealthScreen = {
  risk: { present: boolean; matches: string[] };
  depression: { count: number; markers: string[]; surfaced: boolean };
  anxiety: { count: number; markers: string[]; contexts: string[]; surfaced: boolean };
};

export function screenMentalHealth(text: string, greenLight: boolean): MentalHealthScreen {
  // RISK — always, no gate.
  const riskMatches: string[] = [];
  for (const p of RISK_PATTERNS) {
    const m = p.exec(text);
    if (m) riskMatches.push(m[0]);
  }

  // DEPRESSION / ANXIETY — only on green light.
  const depMarkers: string[] = [];
  const anxMarkers: string[] = [];
  const anxContexts: string[] = [];

  if (greenLight) {
    for (const [name, p] of Object.entries(DEPRESSION)) {
      if (p.test(text)) depMarkers.push(name);
    }
    for (const [name, p] of Object.entries(ANXIETY)) {
      if (name === "context") {
        let m: RegExpExecArray | null;
        const g = new RegExp(p.source, "ig");
        while ((m = g.exec(text)) !== null) anxContexts.push(m[0]);
      } else if (p.test(text)) {
        anxMarkers.push(name);
      }
    }
  }

  return {
    risk: { present: riskMatches.length > 0, matches: riskMatches },
    depression: { count: depMarkers.length, markers: depMarkers, surfaced: greenLight && depMarkers.length >= 3 },
    anxiety: { count: anxMarkers.length, markers: anxMarkers, contexts: anxContexts, surfaced: greenLight && (anxMarkers.length >= 3 || (anxMarkers.length >= 2 && anxContexts.length >= 2)) },
  };
}
