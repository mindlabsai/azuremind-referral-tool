/**
 * PASS 10x-1 isolation test — POST /api/generate/critic with Romy A1 paragraph payload.
 * Usage: node scripts/test-critic-isolation.mjs [baseUrl]
 * Default baseUrl: http://127.0.0.1:3000
 */
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dirname, "../.env.local");
try {
  const env = readFileSync(envPath, "utf8");
  for (const line of env.split("\n")) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (m) process.env[m[1].trim()] = m[2].trim();
  }
} catch {
  /* optional */
}

const baseUrl = process.argv[2] ?? "http://127.0.0.1:3000";

const draftContent =
  "Romy demonstrates difficulties in social-emotional reciprocity, characterised by reduced spontaneous initiation of social interaction and inconsistent response to others' bids for engagement. During assessment, Romy did not independently offer greetings and required adult-led structuring to enter into reciprocal exchange. While she engaged with sensory items and demonstrated capacity for shared enjoyment when the assessor introduced humour into the interaction, including laughing and correcting the assessor when a toy was deliberately misnamed, her broader conversational pattern was one-sided. Romy spoke at length about her own areas of interest and demonstrated reduced capacity to sustain balanced back-and-forth exchange.";

const payload = {
  sectionType: "criterion-narrative",
  draftContent,
  caseContext: {
    patientDetails: { name: "Romy Nara Scarvaci", age: "5y 9m" },
    rawNotes: {
      sessionObservations:
        "brought a stuffed kitten named Pinky to the session, discussed it openly, did not greet the assessor independently, mother prompted her three times before she engaged, laughed and corrected assessor when toy deliberately misnamed",
    },
    diagnosticConclusion: "does_not_meet",
    ratingsAssigned: { A1: 1 },
  },
};

console.log("POST", `${baseUrl}/api/generate/critic`);
const res = await fetch(`${baseUrl}/api/generate/critic`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(payload),
});
const json = await res.json();
console.log(JSON.stringify(json, null, 2));
console.log("\n--- DRAFT LENGTH ---", draftContent.length);
console.log("--- REWRITE LENGTH ---", json.rewrittenContent?.length ?? 0);
