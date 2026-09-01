# Reeboot Gen 2 Safety Baseline Evaluation

**Mode:** MEASUREMENT ONLY — Safety Engine was not modified.
**Corpus:** REEBOOT_SAFETY_CORPUS_v0.3_2000 (CANDIDATE_NOT_GOLD)
**Engine:** `reeboot.safety.contextual.ContextualSafetyEngine`
**Evaluated:** 2026-09-01T16:32:13.615523+00:00

## Integrity checks

| Check | Result |
| --- | --- |
| Cases loaded | 1600 |
| Cases executed | 1600 |
| Unique case IDs | 1600 |
| Duplicate case IDs | 0 |
| Fresh session per case | YES |
| Deterministic repeated evaluation | YES |
| Prediction signature | `b5d41cdfbce78698ba5f7a5498051ea670c6b3da2274982625a05b0be181fa1d` |

## 1. Total cases tested

**1600** / 2000

## 2. Overall accuracy

**0.8413** (1346 correct, 254 incorrect)

## 3. Precision / recall / F1

| Class | Precision | Recall | F1 | Support | TP | FP | FN |
| --- | --- | --- | --- | --- | --- | --- | --- |
| GREEN | 0.8677 | 0.9934 | 0.9263 | 1208 | 1200 | 183 | 8 |
| AMBER | 0.0800 | 0.0600 | 0.0686 | 100 | 6 | 69 | 94 |
| RED | 0.0000 | 0.0000 | 0.0000 | 116 | 0 | 0 | 116 |
| EMERGENCY | 0.9859 | 0.7955 | 0.8805 | 176 | 140 | 2 | 36 |

## 4. Confusion matrix

Rows = expected, columns = predicted.

| expected \ predicted | GREEN | AMBER | RED | EMERGENCY |
| --- | --- | --- | --- | --- |
| GREEN | 1200 | 7 | 0 | 1 |
| AMBER | 94 | 6 | 0 | 0 |
| RED | 55 | 60 | 0 | 1 |
| EMERGENCY | 34 | 2 | 0 | 140 |

## 5. Critical false negatives

### Expected EMERGENCY, predicted RED / AMBER / GREEN

**36** cases. By predicted state: `{'GREEN': 34, 'AMBER': 2}`

### Expected RED, predicted AMBER / GREEN

**115** cases. By predicted state: `{'AMBER': 60, 'GREEN': 55}`

## 6. False positives (GREEN escalated)

**8** expected-GREEN cases were escalated. By predicted state: `{'AMBER': 7, 'EMERGENCY': 1}`

Hard-negative subset (jokes, idioms, quoted/fictional/historical/third-person traps): **0**

Hard-negative families:

| semantic_family | n |
| --- | --- |
| (none) | 0 |

All GREEN escalations by semantic family (top 15):

| semantic_family | n |
| --- | --- |
| RECENT_IDEATION | 3 |
| SUICIDAL_IDEATION | 2 |
| HISTORY_REQUIRES_REVIEW | 1 |
| THIRD_PARTY_NON_SELF | 1 |
| SELF_HARM_DISCLOSURE | 1 |

## 7. Boundary errors

| Boundary | n | Direction counts |
| --- | --- | --- |
| GREEN ↔ AMBER | 101 | {'AMBER->GREEN': 94, 'GREEN->AMBER': 7} |
| AMBER ↔ RED | 60 | {'RED->AMBER': 60} |
| RED ↔ EMERGENCY | 1 | {'RED->EMERGENCY': 1} |

## 8. Error breakdown

Accuracy and critical errors by corpus axis. Full counts are in `safety_eval_results.json`.

### semantic_family

| value | n | errors | accuracy | crit FN EMERG | crit FN RED | GREEN FP |
| --- | --- | --- | --- | --- | --- | --- |
| SUICIDAL_IDEATION | 25 | 22 | 0.120 | 0 | 20 | 2 |
| SELF_HARM_DISCLOSURE | 20 | 20 | 0.000 | 0 | 19 | 1 |
| BURDENSOMENESS | 16 | 16 | 0.000 | 0 | 0 | 0 |
| PASSIVE_DEATH_WISH | 21 | 16 | 0.238 | 0 | 16 | 0 |
| ACTIVE_IDEATION | 14 | 14 | 0.000 | 0 | 14 | 0 |
| HOPELESSNESS | 13 | 13 | 0.000 | 0 | 0 | 0 |
| HOPELESSNESS_EARLY | 13 | 13 | 0.000 | 0 | 0 | 0 |
| AMBIGUOUS_DISAPPEAR | 13 | 12 | 0.077 | 0 | 0 | 0 |
| PASSIVE_IDEATION | 11 | 11 | 0.000 | 0 | 11 | 0 |
| TRAPPEDNESS | 11 | 11 | 0.000 | 0 | 0 | 0 |
| HISTORY_PLUS_RECURRENCE | 10 | 10 | 0.000 | 0 | 10 | 0 |
| BURDEN_EARLY | 7 | 7 | 0.000 | 0 | 0 | 0 |

### context_domain

| value | n | errors | accuracy | crit FN EMERG | crit FN RED | GREEN FP |
| --- | --- | --- | --- | --- | --- | --- |
| SAFETY | 194 | 94 | 0.515 | 1 | 72 | 0 |
| GENERAL | 1123 | 51 | 0.955 | 14 | 5 | 8 |
| SUICIDE | 62 | 45 | 0.274 | 19 | 26 | 0 |
| MOOD | 48 | 22 | 0.542 | 0 | 11 | 0 |
| FAMILY | 24 | 11 | 0.542 | 0 | 0 | 0 |
| ACADEMIC | 18 | 6 | 0.667 | 0 | 0 | 0 |
| FINANCIAL | 16 | 4 | 0.750 | 0 | 0 | 0 |
| HEALTH | 15 | 4 | 0.733 | 0 | 0 | 0 |
| SLEEP | 13 | 4 | 0.692 | 0 | 0 | 0 |
| WORK_STRESS | 26 | 4 | 0.846 | 0 | 0 | 0 |
| PARENTING | 9 | 3 | 0.667 | 0 | 0 | 0 |
| RELATIONSHIP | 13 | 3 | 0.769 | 0 | 0 | 0 |

### subject

| value | n | errors | accuracy | crit FN EMERG | crit FN RED | GREEN FP |
| --- | --- | --- | --- | --- | --- | --- |
| SELF | 1539 | 251 | 0.837 | 35 | 115 | 7 |
| OTHER | 27 | 1 | 0.963 | 0 | 0 | 0 |
| OTHER_OR_GENERAL | 4 | 1 | 0.750 | 0 | 0 | 1 |
| SELF_EXPOSED_TO_OTHER | 30 | 1 | 0.967 | 1 | 0 | 0 |

### temporality

| value | n | errors | accuracy | crit FN EMERG | crit FN RED | GREEN FP |
| --- | --- | --- | --- | --- | --- | --- |
| CURRENT | 1466 | 238 | 0.838 | 24 | 112 | 8 |
| IMMEDIATE | 127 | 12 | 0.906 | 12 | 0 | 0 |
| HISTORICAL_OR_RECENT_HISTORY | 7 | 4 | 0.429 | 0 | 3 | 0 |

### ideation_signal

| value | n | errors | accuracy | crit FN EMERG | crit FN RED | GREEN FP |
| --- | --- | --- | --- | --- | --- | --- |
| SUICIDAL_IDEATION_OR_RELATED | 98 | 81 | 0.173 | 19 | 62 | 0 |
| NOT_ESTABLISHED | 80 | 74 | 0.075 | 0 | 0 | 0 |
| PASSIVE_DEATH_WISH | 27 | 27 | 0.000 | 0 | 27 | 0 |
| UNKNOWN_OR_PROTECTIVE_AMBIVALENCE | 23 | 23 | 0.000 | 0 | 3 | 0 |
| SELF_HARM_RELATED | 18 | 18 | 0.000 | 0 | 18 | 0 |
| ACUTE_SAFETY_THREAT | 140 | 17 | 0.879 | 17 | 0 | 0 |
| NONE_ESTABLISHED | 1214 | 14 | 0.988 | 0 | 5 | 8 |

### intent

| value | n | errors | accuracy | crit FN EMERG | crit FN RED | GREEN FP |
| --- | --- | --- | --- | --- | --- | --- |
| UNKNOWN_OR_NOT_ESTABLISHED | 113 | 113 | 0.000 | 0 | 112 | 0 |
| NONE_ESTABLISHED | 1311 | 105 | 0.920 | 0 | 3 | 8 |
| PRESENT_OR_ACUTE | 176 | 36 | 0.795 | 36 | 0 | 0 |

### plan

| value | n | errors | accuracy | crit FN EMERG | crit FN RED | GREEN FP |
| --- | --- | --- | --- | --- | --- | --- |
| NONE_ESTABLISHED | 1561 | 246 | 0.842 | 28 | 115 | 8 |
| PRESENT_NON_METHOD_SPECIFIC | 18 | 4 | 0.778 | 4 | 0 | 0 |
| MEANS_OR_ACCESS_SIGNAL | 11 | 3 | 0.727 | 3 | 0 | 0 |
| PREPARATORY_BEHAVIOUR | 10 | 1 | 0.900 | 1 | 0 | 0 |

### ambiguity

| value | n | errors | accuracy | crit FN EMERG | crit FN RED | GREEN FP |
| --- | --- | --- | --- | --- | --- | --- |
| LOW | 1281 | 156 | 0.878 | 36 | 111 | 8 |
| HIGH | 274 | 53 | 0.807 | 0 | 4 | 0 |
| MEDIUM | 45 | 45 | 0.000 | 0 | 0 | 0 |

### target_locale

| value | n | errors | accuracy | crit FN EMERG | crit FN RED | GREEN FP |
| --- | --- | --- | --- | --- | --- | --- |
| UNIVERSAL | 1385 | 182 | 0.869 | 19 | 102 | 0 |
| INDONESIA | 30 | 13 | 0.567 | 4 | 3 | 0 |
| INDIA | 34 | 11 | 0.676 | 1 | 2 | 1 |
| MALAYSIA | 39 | 11 | 0.718 | 2 | 3 | 1 |
| CHINESE | 21 | 9 | 0.571 | 3 | 3 | 0 |
| AFRICAN_ENGLISH | 16 | 8 | 0.500 | 1 | 1 | 3 |
| ARABIC | 16 | 6 | 0.625 | 3 | 0 | 0 |
| AU | 19 | 5 | 0.737 | 0 | 0 | 1 |
| UK | 19 | 5 | 0.737 | 2 | 0 | 1 |
| SOUTH_AFRICA | 13 | 3 | 0.769 | 0 | 1 | 1 |
| US | 8 | 1 | 0.875 | 1 | 0 | 0 |

### source_type

| value | n | errors | accuracy | crit FN EMERG | crit FN RED | GREEN FP |
| --- | --- | --- | --- | --- | --- | --- |
| V0.3_EXPANSION | 1172 | 96 | 0.918 | 0 | 68 | 0 |
| CURATED_LIST_SOURCE_RELABELED | 242 | 84 | 0.653 | 22 | 39 | 0 |
| REEBOOT_V0.1_SEED_RETAINED | 163 | 51 | 0.687 | 14 | 5 | 8 |
| UPLOADED_PROTECTIVE_RETAINED | 23 | 23 | 0.000 | 0 | 3 | 0 |

## 9. Pathway routing: SELF / THIRD_PARTY / DV-VIOLENCE

The current Safety Engine emits a four-tier **safety state** only. It does not implement separate backend pathways for third-party danger or DV/violence. Every EMERGENCY prediction is mapped to `ACUTE_SELF_SAFETY_PATH`.

| Cohort | n | Safety-state accuracy | Pathway-action accuracy |
| --- | --- | --- | --- |
| SELF | 1539 | 0.8369 | 0.8369 |
| THIRD_PARTY | 31 | 0.9355 | 0.9355 |
| DV_VIOLENCE | 31 | 0.9355 | 0.9355 |

### SELF

Expected actions: `{'STANDARD_SUPPORT': 1202, 'SAFETY_CLARIFY_AND_NARROW': 100, 'DETERMINISTIC_SAFETY_PATH': 115, 'ACUTE_SELF_SAFETY_PATH': 122}`
Predicted actions: `{'STANDARD_SUPPORT': 1377, 'SAFETY_CLARIFY_AND_NARROW': 74, 'ACUTE_SELF_SAFETY_PATH': 88}`

### THIRD_PARTY

Expected actions: `{'DETERMINISTIC_SAFETY_PATH': 1, 'ACUTE_THIRD_PARTY_SAFETY_PATH': 26, 'STANDARD_SUPPORT': 4}`
Predicted actions: `{'ACUTE_VIOLENCE_DV_SAFETY_PATH': 1, 'ACUTE_THIRD_PARTY_SAFETY_PATH': 26, 'STANDARD_SUPPORT': 3, 'SAFETY_CLARIFY_AND_NARROW': 1}`

The kernel cannot emit `ACUTE_THIRD_PARTY_SAFETY_PATH`. Third-party imminent cases are therefore pathway-incorrect even when the safety state is EMERGENCY.

### DV / VIOLENCE

Expected actions: `{'STANDARD_SUPPORT': 2, 'DETERMINISTIC_SAFETY_PATH': 1, 'ACUTE_VIOLENCE_DV_SAFETY_PATH': 28}`
Predicted actions: `{'STANDARD_SUPPORT': 4, 'ACUTE_VIOLENCE_DV_SAFETY_PATH': 27}`

The kernel cannot emit `ACUTE_VIOLENCE_DV_SAFETY_PATH`. Acute DV/violence cases are therefore pathway-incorrect even when the safety state is EMERGENCY.

## Failure type counts

| failure_type | n |
| --- | --- |
| CRITICAL_FALSE_NEGATIVE_RED | 115 |
| BOUNDARY_GREEN_AMBER | 94 |
| CRITICAL_FALSE_NEGATIVE_EMERGENCY | 36 |
| FALSE_POSITIVE_GREEN_ESCALATED | 8 |
| BOUNDARY_RED_EMERGENCY | 1 |

Complete failure records: **254** rows in `safety_eval_failures.jsonl`.

## Baseline reading

This is a lexical-signal + rule hysteresis engine scored against a two-axis clinical candidate corpus. Distress words escalate to AMBER; hard EMERGENCY requires first-person + immediate intent + active threat. The corpus treats third-party imminent harm and acute DV as EMERGENCY with separate pathways, and treats many idioms / jokes / quoted / fictional / historical mentions as GREEN. Those design gaps are measured here, not patched.

