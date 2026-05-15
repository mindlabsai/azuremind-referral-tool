import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

const {
  sanitiseExtractedNumber,
  normalizeCriterionState,
  sanitiseForPdf,
  stripScientificNotationGarbageFromText,
} = require("../lib/texlex-pdf-sanitize.ts");

assert.equal(sanitiseExtractedNumber("42"), 42);
assert.equal(sanitiseExtractedNumber(-8.854437155380585e21), null);
assert.equal(sanitiseExtractedNumber(Number.NaN), null);
assert.equal(sanitiseExtractedNumber("NaN"), null);
assert.equal(sanitiseExtractedNumber(Number.POSITIVE_INFINITY), null);

const normalized = normalizeCriterionState({
  rating: -8.854437155380585e21,
  suggestedRating: 2,
  markerCount: Number.NaN,
});
assert.equal(normalized.rating, null);
assert.equal(normalized.suggestedRating, 2);
assert.equal(normalized.markerCount, 0);

const warnings = [];
const originalWarn = console.warn;
console.warn = (...args) => {
  warnings.push(args);
  originalWarn(...args);
};

const dirty = {
  patientDetails: { clientName: "Test Client" },
  criteria: {
    A1: {
      rating: -8.854437155380585e21,
      suggestedRating: 1,
      markerCount: 3,
      indicators: "Contains NaN and Infinity tokens",
    },
  },
};

const clean = sanitiseForPdf(dirty);
assert.equal(clean.criteria.A1.rating, "");
assert.equal(clean.criteria.A1.suggestedRating, 1);
assert.equal(clean.criteria.A1.indicators, "Contains and tokens");
assert.ok(warnings.some((entry) => String(entry[0]).includes("Sanitised garbage number from PDF render")));

assert.deepEqual(sanitiseForPdf({ ts: 1_735_689_600_000 }), { ts: 1_735_689_600_000 });

const prosePass10w2 =
  "Speech pathology intervention. Her strategies for transitions. The energy of the assessment. Newman College student.";
assert.equal(
  stripScientificNotationGarbageFromText(prosePass10w2, "pass10w2.prose"),
  prosePass10w2
);
assert.deepEqual(sanitiseForPdf({ body: { text: prosePass10w2 } }), { body: { text: prosePass10w2 } });

const garbageIn = "rating: -8.854437155380585e+21 corrupted";
const infos = [];
const originalInfo = console.info;
console.info = (...args) => {
  infos.push(args);
  originalInfo(...args);
};
const garbageOut = stripScientificNotationGarbageFromText(garbageIn, "pass10w2.garbage");
console.info = originalInfo;
assert.equal(garbageOut.replace(/\s+/g, " ").trim(), "rating: corrupted");
assert.ok(
  infos.some((entry) =>
    String(entry[0]).includes('[Texlex] Sanitiser stripped numeric token "-8.854437155380585e+21"')
  )
);

for (const w of ["pathology", "her strategies", "Vegemite", "during"]) {
  const s = `before ${w} after`;
  assert.equal(stripScientificNotationGarbageFromText(s, "words"), s);
}

console.warn = originalWarn;
console.log("texlex-pdf-sanitize tests passed");
