# Universal Review V2 changelog

One review route serves the ASD and ADHD editors. SLD marker questions are specified in `lib/texlex-finalize-review/universal/markers.ts` and are not asked, because no SLD report editor exists.

## Changed for this pass

- `app/api/generate/finalize-review/route.ts` — shared pipeline, flag, coverage, dedupe, no heading rewrite when V2 is on.
- `lib/texlex-finalize-review/llm-prompt.ts` — V2 prompt asks only the active pack's questions.
- `lib/texlex-finalize-review/universal/` — flag, markers, coverage, dedupe, display, policy, locked-value guard, explicit source contradictions, synthetic acceptance.
- `app/api/generate/observation-reframe/route.ts` — returns 409 while V2 is on.
- `app/asd-engine/report/components/TexlexFinalizeReviewPanel.tsx` — quiet Review panel on the report surface.
- `app/asd-engine/report/page.tsx` — Apply refuses a locked level or conclusion flip. Formulation anchor for findings.
- `app/adhd-engine/report/page.tsx` — section anchors so a finding can open the matching section.

## Left as they were

Diagnostic conclusion writers, severity confirmation, section generation, PDF builders, the send lock (`openBlockingCount === 0`), and issued PDFs.

## Rollback

`TEXLEX_UNIVERSAL_REVIEW_V2=false` runs the previous ASD phrase and length checks and the previous model prompt. Stored review runs are not deleted.

## Not built

SLD review execution. A stored `reviewedVersionId`. In-place amendment of issued PDFs. A time-trace for when a sentence was added. The external AHPRA audit.
