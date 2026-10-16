/** Rollback: set TEXLEX_UNIVERSAL_REVIEW_V2=false to restore the previous phrase and length checks. */
export function isUniversalReviewV2Enabled(): boolean {
  return process.env.TEXLEX_UNIVERSAL_REVIEW_V2 !== "false";
}
