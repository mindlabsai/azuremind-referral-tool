/**
 * Phase 1 synthetic verification (no Google credentials).
 * Requires TEXLEX_REFERRAL_INTAKE_ENABLED=1 and applied Supabase migration.
 *
 * Usage: node --env-file=.env.local scripts/test-referral-intake-synthetic.mjs
 * Or with a running server: SYNTHETIC_VIA_HTTP=1 BASE_URL=http://localhost:3001 ...
 */

import { createHash } from "node:crypto";

const BASE = process.env.BASE_URL || "http://localhost:3001";
const viaHttp = process.env.SYNTHETIC_VIA_HTTP === "1";

const extract = {
  childFirst: "Ava",
  childLast: "Synthetic",
  childDob: "2016-06-14",
  parentFirst: "Morgan",
  parentLast: "Synthetic",
  parentEmail: "parent.synthetic@example.com",
  parentMobile: "0499000111",
  assessmentType: "ADHD",
  referrerName: "Dr Pat Example",
  referrerType: "GP",
  referrerEmail: "gp.synthetic@example.com",
  internalNotes: "Synthetic Phase 1 intake verification — do not contact.",
  confidence: "high",
  warnings: [],
};

const messageId = `synthetic-verify-${createHash("sha1")
  .update(String(Date.now()))
  .digest("hex")
  .slice(0, 12)}`;

async function viaApi() {
  const res = await fetch(`${BASE}/api/referral-intake/process-synthetic`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      clinicSlug: "perth-paediatrics",
      messageId,
      extract,
      subject: "Synthetic GP referral — Phase 1",
    }),
  });
  const json = await res.json();
  console.log(JSON.stringify(json, null, 2));
  if (!json.success) process.exitCode = 1;
  if (!json.idempotency?.sameReferralId) {
    console.error("FAIL: idempotency check did not return the same referral id");
    process.exitCode = 1;
  } else {
    console.log("PASS: synthetic create + duplicate prevention");
  }
}

async function main() {
  if (viaHttp) {
    await viaApi();
    return;
  }
  console.log(
    "Set SYNTHETIC_VIA_HTTP=1 with the Next server running, or run unit tests:\n  npm run test:referral-intake"
  );
  console.log(`Prepared synthetic messageId=${messageId}`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
