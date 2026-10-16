# Texlex Review repository map

Filled from the working tree. SLD is named in booking only. It is not a live report type.

| Capability | Actual file/function/line | Confirmed? | Note/blocker |
|---|---|---|---|
| Review entry point and API | `app/api/generate/finalize-review/route.ts` `POST` line 65 | Yes | One route for ASD and ADHD |
| Report-type discriminator | Same file, line 68. `pathway === "adhd"` is ADHD. Anything else is ASD. Type is `"asd" \| "adhd"` in `lib/texlex-finalize-review/llm-prompt.ts` | Yes | No `sld` value is accepted |
| ASD editor call | `app/asd-engine/report/page.tsx` `runFinalizeReview` line 4170 | Yes | Posts section text and raw notes |
| ADHD editor call | `app/adhd-engine/report/page.tsx` `runFinalizeReview` line 2113 | Yes | Same route, `pathway: "adhd"` |
| Review panel | `app/asd-engine/report/components/TexlexFinalizeReviewPanel.tsx` | Yes | Used by both editors |
| ASD phrase/length checks | `lib/texlex-finalize-review/ahpra-audit-checks.ts` `runAhpraAuditChecks` line 79 | Yes | Skipped when Universal Review V2 is on |
| ADHD checks | `lib/texlex-finalize-review/deterministic.ts` `runDeterministicReview` line 195, plus the shared model prompt | Yes | No separate ADHD review service |
| SLD review support | None. `markerPackForPathway("sld")` in `lib/texlex-finalize-review/universal/markers.ts` | Yes | Questions are specified. `active` is false. No `sld-engine` |
| Model prompt | `finalizeReviewSystemPromptV2` in `lib/texlex-finalize-review/llm-prompt.ts`. Called from the route at line 174 | Yes | Active pack questions only |
| Deterministic checks | `runDeterministicReview` line 195. Explicit score and attribution checks in `lib/texlex-finalize-review/universal/explicit.ts` | Yes | Identity, dates, modality contradiction, locked opening |
| Sources sent to Review | Posted `sections`, demographics, optional `sourceNotes` | Yes | Collateral file bytes are not parsed |
| Unreadable sources | `describeSourceCoverage` in `lib/texlex-finalize-review/universal/coverage.ts` | Yes | Named on the panel. Not treated as empty evidence |
| Finding consumers | Panel, `computeReviewSummary` in `lib/texlex-finalize-review/types.ts` line 124 | Yes | Required keys unchanged. V2 fields optional |
| Apply / Fix | `placeReviewAlternative` in `lib/texlex-finalize-review/apply-minimal.ts` line 214. Locked level and conclusion guards in `universal/locked.ts` | Yes | Writes the unsigned draft section only |
| Versioning | Review runs live in `finalizeReviewRuns` on the editor. No `reviewedVersionId` | Gap | Clearance is the latest run |
| Send gate | ASD `finalPdfUnlocked` line 4015 and `sendUnlocked` line 4813. ADHD line 2107 and line 2600. Drawer: `TexlexSendDrawer` | Yes | Open only when `openBlockingCount === 0` |
| Preview | ASD `handlePreviewPdf` line 4413. ADHD line 1877 | Yes | Builds a blob. Does not write the review run |
| Issued PDF amendment | Not implemented | Gap | Originals are not rewritten |
| Clearance invalidation on later edits | Not a stored version | Gap | Send stays tied to the latest run |
| Feature flag | `TEXLEX_UNIVERSAL_REVIEW_V2` in `lib/texlex-finalize-review/universal/flag.ts`. `"false"` restores the ASD phrase checks | Yes | Default is on |
| Automated tests | `lib/texlex-finalize-review/universal/acceptance.ts` | Yes | Synthetic only |

## Call chain

The editor posts the current draft to `POST /api/generate/finalize-review`. The route runs deterministic checks, then the active marker questions through one model prompt when the model is enabled. Phrase and length checks run only when the flag is off. Findings are deduped, stamped with the active pack, and returned. The panel shows the result. Apply writes a section on the unsigned draft. Send reads `openBlockingCount`.

## Marker packs that can run

- ASD: report editor and this route exist. Questions cover A1–B4, development, source attribution, function, differentials and Criterion E, locked support levels, and material modality limits.
- ADHD: report editor and this route exist. Questions cover symptoms, onset, settings, function, differentials, instruments actually used, and age context.
- SLD: questions are written in the registry and are not asked. There is no SLD report page and the route cannot select an SLD pack.

## Protected paths

Report generation routes under `app/api/generate/` other than `finalize-review` and the V2 refusal on `observation-reframe`. Diagnostic conclusion and severity confirmation. PDF builders. The send drawer implementation. Referral email. Halaxy upload. This change does not add a generator or a meets/does-not-meet decision.

## Apply on an unsigned draft

Already possible through Apply to draft / the existing Fix path. It does not edit raw notes or an issued PDF.

## Sources Review cannot read

Attached PDFs that were not extracted into the draft. Practice-system files and tasks. Another person's record. The panel states that limit on each pass.

## Issued records and the external audit

Issued PDFs are not amended here. The external AHPRA audit of child ASD assessments is a separate engagement. Review does not select those records.
