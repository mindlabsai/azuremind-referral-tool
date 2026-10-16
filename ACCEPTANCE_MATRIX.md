# Universal Review — acceptance results

Synthetic fixtures only. Runner: `npx tsx lib/texlex-finalize-review/universal/acceptance.ts`. Result: 48 rows, 0 failed. Live route check used Alex Example on `POST /api/generate/finalize-review` with the model skipped. The open ASD editor was not reviewed.

| ID | Result | Evidence |
|---|---|---|
| U01 | pass | Coherent in-clinic draft produces no observation-source finding. |
| U02 | pass | Concise draft produces no length or boilerplate finding. |
| U03 | n/a | No SLD report editor. Pack stays off. |
| U04 | pass | Legacy phrase check flags a parent account. V2 does not run it. |
| U05 | pass | Notes that deny a clinic observation become one finding. No replacement sentence. |
| U06 | pass | A quiet in-session presentation is not a missing-observation finding. |
| U07 | pass | Uneven criterion length produces no length finding. |
| U08 | pass | A proposal that replaces locked Level 2 is refused. |
| U09 | pass | Differential language in Criterion E does not raise a missing-keyword finding. |
| U10 | pass | No observation sentence is generated. |
| U11 | pass | Home and school in different sections produce no missing-setting finding. |
| U12 | pass | The ADHD prompt does not mandate a child instrument. |
| U13 | pass | A draft that says DIVA was not administered produces no invented score. |
| U14 | pass | ADHD formulation versus locked does-not-meet is reported. The route leaves `suggestedEdit` null. Live check: open blocking count 1. |
| U15 | n/a | No SLD report path, so WIAT comparison is not run. |
| U16 | pass | SLD pack is inactive. |
| U17 | pass | "School input was not available" does not raise a short-collateral finding. |
| U18 | pass | A recorded teacher/parent difference is not a contradiction. |
| U19 | pass | An explicit video reason is not a finding and is not auto-applied. |
| U20 | pass | Regional address plus video does not become travel hardship. |
| U21 | pass | Video with no reason produces no reason finding. |
| U22 | pass | Coverage states raw notes were absent and unextracted files were not read. |
| U23 | pass | In-clinic wording against video modality stays a blocking mismatch. |
| U24 | pass | Hybrid in-clinic and video wording is kept. |
| U25 | pass | A caveat in formulation does not raise a short-limitations finding. |
| U26 | pass | Disagreeing Full Scale IQ figures are reported. The draft score is not changed. |
| U27 | pass | A name outside locked demographics is blocking. |
| U28 | pass | Three copies of one title collapse to one finding. |
| U29 | pass | Display string is "No material issues found in the material available". Live ASD synthetic post returned that string and zero findings. |
| U30 | pass | Instruction text is not an Apply proposal. A conclusion flip is refused. |
| U31 | n/a | No reviewedVersionId. Apply writes the unsigned section only. |
| U32 | pass | Reject changes finding status only. |
| U33 | n/a | Send stays on the latest `openBlockingCount`. Edits do not mint a version id. |
| U34 | pass | Preview builds a blob. On the open editor, Preview PDF left Send report disabled. |
| U35 | n/a | No issued-PDF amendment workflow. |
| U36 | n/a | External AHPRA audit is a separate engagement. |
| U37 | pass | Coverage says other people's records were not opened. |
| U38 | pass | Review does not search or merge by name. |
| U39 | pass | `TEXLEX_UNIVERSAL_REVIEW_V2=false` restores the legacy ASD phrase checks. |
| U40 | pass | ASD and ADHD share one route and receive their own questions. SLD questions are specified and not asked. |
| U41 | pass | A does-not-meet conflict is reported. The replacement is not a meets sentence. |
| U42 | pass | An empty source set is disclosed. |
| U43 | pass | A school-name swap leaves the rest of the sentence. |
| U44 | pass | A major finding does not block Send. An accepted blocking finding still does. |
| U45 | pass | Older findings keep the required keys. V2 fields are optional. |
| U46 | pass | 14 coherent ASD/ADHD drafts produced 0 deterministic findings. 6 SLD drafts were not run. |
| U47 | n/a | No stored review version. |
| U48 | n/a | No time-trace for when a sentence was added. Labeled dates still use the existing date check. |

Sample findings: `lib/texlex-finalize-review/universal/sample-findings.json`.
