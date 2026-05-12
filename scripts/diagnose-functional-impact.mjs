const baseUrl = process.env.TEXLEX_BASE_URL ?? "http://localhost:3000";

async function callFunctionalImpact(label, payload) {
  const response = await fetch(`${baseUrl}/api/generate/functional-impact`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok || !response.body) {
    throw new Error(`${label} failed: ${response.status} ${await response.text()}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let assembled = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      const data = line.slice(6).trim();
      if (data === "[DONE]") continue;
      try {
        const parsed = JSON.parse(data);
        if (typeof parsed.delta === "string") assembled += parsed.delta;
        if (parsed.error) throw new Error(parsed.error);
      } catch (error) {
        if (!(error instanceof SyntaxError)) throw error;
      }
    }
  }

  console.log(`\n=== ${label} ===`);
  console.log(`response length: ${assembled.length}`);
  console.log(assembled.slice(0, 500));
  return assembled;
}

const basePayload = {
  clientName: "Allan McRobbie",
  clientFirstName: "Allan",
  pronouns: "he/him",
  chronologicalAge: "5y 2m",
  yearLevel: "Kindergarten",
  rawNotes:
    "Allan presents with severe rigidity around routines, marked sensory sensitivities across multiple modalities, and longstanding circumscribed interests. Parent report indicates substantial adult scaffolding is required across home and school settings.",
  presentingConcerns: "",
  backgroundText: "",
  criteriaState: "",
  collateralSummary: "",
  clinicalFormulation: "",
};

const populatedPayload = {
  ...basePayload,
  presentingConcerns:
    "Parents report longstanding concerns regarding social reciprocity, rigidity, sensory reactivity, and restricted interests.",
  backgroundText:
    "## Early development\nAllan demonstrated early developmental differences in social engagement and sensory regulation.",
  criteriaState:
    "## A1\nAllan demonstrates reduced social-emotional reciprocity across home and school.\n\n## B2\nAllan demonstrates significant rigidity and severe distress with unexpected change.\n\n## B3\nAllan demonstrates intense and longstanding circumscribed interests.\n\n## B4\nAllan demonstrates clear sensory sensitivities across multiple modalities.",
  collateralSummary:
    "Caregiver observations indicate longstanding concerns across social, behavioural, and sensory domains.",
  clinicalFormulation:
    "Allan's presentation is consistent with a neurodevelopmental profile characterised by marked rigidity, sensory reactivity, and restricted interests requiring substantial family and educational support.",
};

async function main() {
  await callFunctionalImpact("EMPTY_SOURCE_SNAPSHOT", basePayload);
  await callFunctionalImpact("POPULATED_SOURCE_SNAPSHOT", populatedPayload);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
