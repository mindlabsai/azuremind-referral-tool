// Deterministic US -> AU spelling normalisation for generated report text.
// Runs after the voice critic, before display and save.
// Protected phrases (instrument and scale names) are never altered.

const PROTECTED_PHRASES = [
  "Autism Spectrum Rating Scales",
  "Unusual Behaviors",
  "Behavioral Rigidity",
  "Peer Socialization",
  "Adult Socialization",
  "Social/Emotional Reciprocity",
  "Attention/Self-Regulation",
];

const WORD_MAP: Array<[RegExp, string]> = [
  [/\bbehavior\b/gi, "behaviour"], [/\bbehaviors\b/gi, "behaviours"],
  [/\bbehavioral\b/gi, "behavioural"], [/\bbehaviorally\b/gi, "behaviourally"],
  [/\bcolor\b/gi, "colour"], [/\bcolors\b/gi, "colours"], [/\bcolored\b/gi, "coloured"],
  [/\bfavor\b/gi, "favour"], [/\bfavorite\b/gi, "favourite"],
  [/\bpediatric\b/gi, "paediatric"], [/\bpediatrics\b/gi, "paediatrics"],
  [/\bpediatrician\b/gi, "paediatrician"], [/\borthopedic\b/gi, "orthopaedic"],
  [/\banesthesia\b/gi, "anaesthesia"], [/\bestrogen\b/gi, "oestrogen"],
  [/\bcenter\b/gi, "centre"], [/\bcentered\b/gi, "centred"], [/\bfiber\b/gi, "fibre"],
  [/\bdefense\b/gi, "defence"], [/\boffense\b/gi, "offence"], [/\bgray\b/gi, "grey"],
  [/\bmold\b/gi, "mould"], [/\bfulfill\b/gi, "fulfil"], [/\benrollment\b/gi, "enrolment"],
  [/\blabeled\b/gi, "labelled"], [/\blabeling\b/gi, "labelling"],
  [/\bmodeled\b/gi, "modelled"], [/\bmodeling\b/gi, "modelling"],
  [/\bcanceled\b/gi, "cancelled"], [/\bcanceling\b/gi, "cancelling"],
  [/\btraveled\b/gi, "travelled"], [/\btraveling\b/gi, "travelling"],
  [/\bpracticing\b/gi, "practising"],
];

const IZE_EXCEPTIONS = /\b(size|sizes|sized|sizing|prize|prizes|prized|capsize|maize|seize|seizes|seized|seizing)\b/i;

function matchCase(orig: string, repl: string): string {
  if (orig === orig.toUpperCase()) return repl.toUpperCase();
  if (orig[0] === orig[0].toUpperCase()) return repl[0].toUpperCase() + repl.slice(1);
  return repl;
}

function applyIseFamily(text: string): string {
  text = text.replace(/([A-Za-z]+?)ization\b/g, (m, s) => matchCase(m, s + "isation"));
  text = text.replace(/([A-Za-z]+?)izations\b/g, (m, s) => matchCase(m, s + "isations"));
  text = text.replace(/([A-Za-z]+?)(ize|izes|ized|izing)\b/g, (m, s, suf) => {
    if (IZE_EXCEPTIONS.test(m)) return m;
    const map: Record<string,string> = { ize:"ise", izes:"ises", ized:"ised", izing:"ising" };
    return matchCase(m, s + map[suf.toLowerCase()]);
  });
  text = text.replace(/([A-Za-z]+?)(yze|yzes|yzed|yzing)\b/g, (m, s, suf) => {
    const map: Record<string,string> = { yze:"yse", yzes:"yses", yzed:"ysed", yzing:"ysing" };
    return matchCase(m, s + map[suf.toLowerCase()]);
  });
  return text;
}

export function normaliseEnAU(input: string): string {
  if (!input) return input;
  const tokens: string[] = [];
  let text = input;
  for (const phrase of PROTECTED_PHRASES) {
    const re = new RegExp(phrase.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&"), "g");
    text = text.replace(re, () => { tokens.push(phrase); return `\u0000${tokens.length - 1}\u0000`; });
  }
  text = applyIseFamily(text);
  for (const [re, rep] of WORD_MAP) text = text.replace(re, (m) => matchCase(m, rep));
  text = text.replace(/\u0000(\d+)\u0000/g, (_, i) => tokens[Number(i)]);
  return text;
}
