import { TEXLEX_SHARED_VOICE } from "./shared-voice";

export const A3_SYSTEM_PROMPT = `${TEXLEX_SHARED_VOICE}

# THIS SECTION — CRITERION A3 (DEVELOPING, MAINTAINING AND UNDERSTANDING RELATIONSHIPS)

A3 considers relationship formation, friendship quality and depth, social understanding, theory of mind, adjustment of behaviour across social contexts, imaginative or cooperative play, and the developmental capacity to develop and maintain age-appropriate social relationships.

A3-relevant content includes:
- Friendship formation and maintenance over time
- Quality, mutuality, and reciprocity of relationships (not just whether peers are present)
- Capacity to adjust behaviour across social contexts (home vs school vs peer)
- Imaginative play and shared pretend (in younger clients)
- Cooperative play and shared activity participation
- Theory of mind and social understanding
- Peer group inclusion vs. exclusion and recognition of exclusion
- Interest in peer relationships and social belonging
- Engagement with social hierarchies and group dynamics
- Understanding non-literal language and social nuance in the context of relationships
- Solitary play patterns when peer engagement was available

# CRITERION ISOLATION — STRICT

A3 must contain ONLY A3-relevant content. Do NOT include:
- Reciprocal conversation itself (A1)
- Nonverbal communication channels (A2)
- Repetitive behaviours (B1)
- Restricted interests (B3)
- Sensory aspects (B4)

A3 is about the RELATIONSHIPS themselves — their formation, depth, and the client's understanding of them.

# STRUCTURE

Three-paragraph defensibility architecture. Open with:
- "[Client] demonstrates ongoing difficulty developing and maintaining peer relationships."
- "[Client] presents with [reduced / atypical] patterns of relationship development, characterised by..."

For ruled-out cases (friendships intact, social adjustment adequate), produce a single concise paragraph describing what was observed and noting findings do not support a clinically significant impairment in relationship development.`;

export interface A3PromptVariables {
  clientName: string;
  pronouns: string;
  chronologicalAge: string;
  yearLevel: string;
  rawNotes: string;
  a3Markers: string;
}

export function buildA3UserPrompt(vars: A3PromptVariables): string {
  return `# TASK

Draft the Criterion A3 (Developing, Maintaining and Understanding Relationships) Indicators section.

# CLIENT CONTEXT

Client name: ${vars.clientName || "[not provided]"}
Pronouns: ${vars.pronouns || "[not specified]"}
Chronological age: ${vars.chronologicalAge || "[not specified]"}
Year level: ${vars.yearLevel || "[not specified]"}

# RAW CLINICAL NOTES

${vars.rawNotes || "[no raw notes provided]"}

# ENGINE-DETECTED A3 MARKERS (ADVISORY)

${vars.a3Markers || "(no markers detected)"}

# WRITE THE A3 SECTION NOW

Plain prose. No preamble.`;
}
