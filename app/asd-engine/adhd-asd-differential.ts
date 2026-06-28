// ASD-differential detector for the ADHD engine.
// Scans ADHD-referral notes for ASD-consistent features, tagged by domain.
// Validated against four real cases (George, Luna, Paige -> FLAG; Emmy -> clear).
// The disconfirming scrape captures the ABSENCE of features as evidence-against,
// so a clean case stays clean for the right reason (the negatives do diagnostic work).
//
// NOTE: marker vocabulary is a v1 tuned to real note phrasings. The 3-domain
// threshold and the disconfirming logic are durable; the regex list grows over time.
// Battery-test any additions before relying on them.

export type AsdDifferentialResult = {
  domains: string[];        // distinct ASD domains with positive signal
  flagged: boolean;         // true when features touch >= 3 domains
  evidenceAgainst: string[];// disconfirming cues (negated features, positive cues)
};

// Negation in the immediate lead-in flips a matched feature to evidence-against.
const NEG = /(no|not|without|never|doesn.?t|does not|did not|none|nil)\s+([a-z]+\s+){0,3}$/i;

// Disconfirming cues captured directly as evidence-against ASD.
const POSITIVE_CUE =
  /(eats? what.?s given|no (food )?aversion|no concerns?|good (eye contact|social)|social(ly)? progress|reaching out|seeks? out (friends|others)|makes? friends? eas)/i;

const DOMAINS: Record<string, RegExp[]> = {
  social: [
    /no eye contact|sporadic eye contact|limited eye contact|poor eye contact/i,
    /(does not|doesn.?t|not)\s+read(ing)?.{0,15}(social cue|context|cues)/i,
    /one[- ]sided.{0,10}friendship|socially exhaust|social(ly)? exhaust/i,
    /baby talk|baby[- ]like|repeat(s|ing)? (certain )?phrase|rehears|plays? (this|it) over/i,
    /(very )?literal|takes things literally/i,
    /needs? prompting to (greet|say hello)|prompted to (greet|say)/i,
  ],
  sensory: [
    /cover(s|ing)? (her|his)? ?ears|sensitive to (sound|noise)|too loud|tone of voice/i,
    /large crowds?|big crowds?|lock(s|ed)? (her|him)self|hides? in (the )?cupboard/i,
    /beige (food )?diet|texture.{0,15}(aversion|avoid)|(does not|doesn.?t).{0,10}(like|eat).{0,15}(soft|squishy|texture)/i,
    /(does not|doesn.?t|did not) like.{0,15}(clothes|clothing|socks|tags|jacket)|same clothes|strip(s|ped)? off|removed.{0,10}tags/i,
  ],
  rrb: [
    /line(s|d|ing)? up|lining up/i,
    /re[- ]?watch|watched.{0,20}(times|series)|same (tv |show)|cannot move to a new/i,
    /same (routine|uniform)|need(s)? (the|her|his) night ?light|same morning routine/i,
    /(does not|doesn.?t).{0,10}(cope|like).{0,15}(change|cancel)|distress.{0,15}change|upset.{0,15}(change|plans)|scream.{0,15}chang/i,
    /(broken|do not work|does not work).{0,20}bin|need(s)? to be (in the )?bin/i,
  ],
  play: [
    /makes? (her|his)? ?own rules|sets? the rules|on (her|his) own terms/i,
    /one[- ]?sided (play|hide)|will (hide|not seek)|refuses? to seek/i,
    /go(es)? along with anyone|just go along/i,
  ],
};

export function detectAsdDifferential(text: string): AsdDifferentialResult {
  const hitDomains = new Set<string>();
  const evidenceAgainst: string[] = [];

  let m: RegExpExecArray | null;
  const pc = new RegExp(POSITIVE_CUE.source, "ig");
  while ((m = pc.exec(text)) !== null) {
    evidenceAgainst.push(m[0]);
  }

  for (const [domain, patterns] of Object.entries(DOMAINS)) {
    for (const p of patterns) {
      const mm = p.exec(text);
      if (mm) {
        const lead = text.slice(Math.max(0, mm.index - 25), mm.index);
        if (NEG.test(lead)) {
          evidenceAgainst.push("(neg) " + mm[0]);
        } else {
          hitDomains.add(domain);
        }
      }
    }
  }

  const domains = [...hitDomains];
  return { domains, flagged: domains.length >= 3, evidenceAgainst };
}
