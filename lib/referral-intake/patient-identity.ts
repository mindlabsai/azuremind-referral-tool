import type { ReferralReaderExtract } from "@/lib/referral-reader/types";

export type PatientIdentity = {
  childFirst: string;
  childLast: string;
  childDob: string;
};

function normName(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

export function hasChildName(identity: PatientIdentity): boolean {
  return Boolean(normName(identity.childFirst) && normName(identity.childLast));
}

export function identityFromExtract(
  extract: Pick<ReferralReaderExtract, "childFirst" | "childLast" | "childDob">
): PatientIdentity {
  return {
    childFirst: extract.childFirst ?? "",
    childLast: extract.childLast ?? "",
    childDob: (extract.childDob ?? "").trim(),
  };
}

export function formatPatientIdentity(identity: PatientIdentity): string {
  const name = [identity.childFirst, identity.childLast].map((s) => s.trim()).filter(Boolean).join(" ");
  if (name && identity.childDob) return `${name} (DOB ${identity.childDob})`;
  if (name) return name;
  if (identity.childDob) return `DOB ${identity.childDob}`;
  return "Unknown child";
}

/**
 * True when two extracts clearly refer to different children.
 * Missing names/DOBs do not count as a conflict (insufficient evidence).
 */
export function patientIdentitiesConflict(a: PatientIdentity, b: PatientIdentity): boolean {
  const aFirst = normName(a.childFirst);
  const aLast = normName(a.childLast);
  const bFirst = normName(b.childFirst);
  const bLast = normName(b.childLast);
  const aDob = a.childDob.trim();
  const bDob = b.childDob.trim();

  const aNamed = Boolean(aFirst && aLast);
  const bNamed = Boolean(bFirst && bLast);

  if (aNamed && bNamed && (aFirst !== bFirst || aLast !== bLast)) {
    return true;
  }

  if (aDob && bDob && aDob !== bDob) {
    // Different DOBs always conflict when both present (even if one name is missing).
    return true;
  }

  return false;
}
