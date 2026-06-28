// Tier-2 lighter differential channels for the ADHD engine: SLD, motor/DCD, speech.
// Each channel returns one of: "not-indicated" | "present-assessed" | "present-investigate".
// The engine compiles evidence and tracks assessment state; it never concludes the
// channel is positive. The clinician's flag is authoritative.

export type ChannelState = "not-indicated" | "present-assessed" | "present-investigate";

export type ChannelResult = {
  channel: string;
  state: ChannelState;
  evidence: string[];
  ratifyingAssessment: string; // what closes this channel if not yet assessed
};

type ChannelDef = {
  name: string;
  ratifyingAssessment: string;
  indicators: RegExp[];
  assessedCues: RegExp[]; // evidence that the ratifying assessment has been done
};

const CHANNELS: ChannelDef[] = [
  {
    name: "SLD (learning)",
    ratifyingAssessment: "formal cognitive and academic-achievement assessment (e.g. WISC-V with WIAT)",
    indicators: [
      /struggl(es|ing)?\s+with\s+(reading|maths?|math|writing|spelling|learning)/i,
      /(reading|maths?|math|writing|spelling|literacy|numeracy)\s+(difficult|delay|behind|struggle|concern)/i,
      /cannot\s+do\s+the\s+work|below\s+(grade|year)\s+level|academic\s+(difficult|concern)/i,
      /did\s+some\s+(literacy|numeracy)\s+screening|screened\s+(literacy|reading|maths)/i,
      /expressive\s+language\s+and\s+struggling\s+with\s+reading/i,
    ],
    assessedCues: [
      /(WISC|WIAT|cognitive\s+assessment|educational\s+assessment|psychometric)\s+(done|completed|conducted|on\s+record)/i,
    ],
  },
  {
    name: "Motor / DCD",
    ratifyingAssessment: "occupational therapy assessment",
    indicators: [
      /(gross|fine)\s+motor\s+(delay|difficult|concern|behind)/i,
      /motor\s+(delay|difficult|concern|coordination)/i,
      /clumsy|poor\s+coordination|coordination\s+(difficult|issue)/i,
      /(handwriting|pencil\s+grip|cutting)\s+(difficult|poor|behind)/i,
    ],
    assessedCues: [
      /(OT|occupational\s+therap)\w*\s+(assessment|done|completed|seen|input|report)/i,
    ],
  },
  {
    name: "Speech / Language",
    ratifyingAssessment: "speech pathology assessment",
    indicators: [
      /speech\s+(delay|difficult|concern|therapy)/i,
      /(expressive|receptive)\s+language\s+(delay|difficult|concern)/i,
      /(articulation|pronunciation)\s+(difficult|concern|issue)/i,
      /hard\s+to\s+understand|unclear\s+speech|stutter/i,
      /still\s+developing\s+(more\s+)?expressive/i,
    ],
    assessedCues: [
      /(speech\s+path\w*|speech\s+therap\w*)\s+(assessment|done|completed|seen|input|report|engaged)/i,
      /(receiv|attend|engaged)\w*\s+(in\s+)?speech\s+(therapy|sessions?)/i,
    ],
  },
];

export function detectDifferentialChannels(text: string): ChannelResult[] {
  return CHANNELS.map((c) => {
    const evidence: string[] = [];
    for (const p of c.indicators) {
      const m = p.exec(text);
      if (m) evidence.push(m[0]);
    }
    const assessed = c.assessedCues.some((p) => p.test(text));
    let state: ChannelState;
    if (evidence.length === 0) state = "not-indicated";
    else if (assessed) state = "present-assessed";
    else state = "present-investigate";
    return {
      channel: c.name,
      state,
      evidence,
      ratifyingAssessment: c.ratifyingAssessment,
    };
  });
}
