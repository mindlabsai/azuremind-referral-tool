# Reeboot Gen 2 Safety Baseline Evaluation

**Mode:** MEASUREMENT ONLY — Safety Engine was not modified.
**Corpus:** REEBOOT_SAFETY_CORPUS_v0.3_2000 (CANDIDATE_NOT_GOLD)
**Engine:** `reeboot.safety.engine.SafetyEngine`
**Evaluated:** 2026-09-01T14:27:56.728108+00:00

## Integrity checks

| Check | Result |
| --- | --- |
| Cases loaded | 2000 |
| Cases executed | 2000 |
| Unique case IDs | 2000 |
| Duplicate case IDs | 0 |
| Fresh session per case | YES |
| Deterministic repeated evaluation | YES |
| Prediction signature | `15a03dcc0ed4b966ecc291a17374f19ef06c8f24acd1db3ff5a19795e574e1d2` |

## 1. Total cases tested

**2000** / 2000

## 2. Overall accuracy

**0.7425** (1485 correct, 515 incorrect)

## 3. Precision / recall / F1

| Class | Precision | Recall | F1 | Support | TP | FP | FN |
| --- | --- | --- | --- | --- | --- | --- | --- |
| GREEN | 0.7886 | 0.9364 | 0.8562 | 1510 | 1414 | 379 | 96 |
| AMBER | 0.0541 | 0.0320 | 0.0402 | 125 | 4 | 70 | 121 |
| RED | 0.2826 | 0.1793 | 0.2194 | 145 | 26 | 66 | 119 |
| EMERGENCY | 1.0000 | 0.1864 | 0.3142 | 220 | 41 | 0 | 179 |

## 4. Confusion matrix

Rows = expected, columns = predicted.

| expected \ predicted | GREEN | AMBER | RED | EMERGENCY |
| --- | --- | --- | --- | --- |
| GREEN | 1414 | 31 | 65 | 0 |
| AMBER | 121 | 4 | 0 | 0 |
| RED | 96 | 23 | 26 | 0 |
| EMERGENCY | 162 | 16 | 1 | 41 |

## 5. Critical false negatives

### Expected EMERGENCY, predicted RED / AMBER / GREEN

**179** cases. By predicted state: `{'GREEN': 162, 'RED': 1, 'AMBER': 16}`

### Expected RED, predicted AMBER / GREEN

**119** cases. By predicted state: `{'GREEN': 96, 'AMBER': 23}`

## 6. False positives (GREEN escalated)

**96** expected-GREEN cases were escalated. By predicted state: `{'AMBER': 31, 'RED': 65}`

Hard-negative subset (jokes, idioms, quoted/fictional/historical/third-person traps): **80**

Hard-negative families:

| semantic_family | n |
| --- | --- |
| HARD_NEGATIVE_CONTEXT | 80 |

All GREEN escalations by semantic family (top 15):

| semantic_family | n |
| --- | --- |
| HARD_NEGATIVE_CONTEXT | 80 |
| EVERYDAY_FRUSTRATION | 4 |
| SUICIDAL_IDEATION | 3 |
| THIRD_PARTY_NON_SELF | 2 |
| HISTORY_REQUIRES_REVIEW | 2 |
| FUNCTIONING_STUCK | 2 |
| ANXIETY_CLINICAL | 1 |
| EVERYDAY_STRESS | 1 |
| ESCALATING_DISTRESS | 1 |

## 7. Boundary errors

| Boundary | n | Direction counts |
| --- | --- | --- |
| GREEN ↔ AMBER | 152 | {'GREEN->AMBER': 31, 'AMBER->GREEN': 121} |
| AMBER ↔ RED | 23 | {'RED->AMBER': 23} |
| RED ↔ EMERGENCY | 1 | {'EMERGENCY->RED': 1} |

## 8. Error breakdown

Accuracy and critical errors by corpus axis. Full counts are in `safety_eval_results.json`.

### semantic_family

| value | n | errors | accuracy | crit FN EMERG | crit FN RED | GREEN FP |
| --- | --- | --- | --- | --- | --- | --- |
| HARD_NEGATIVE_CONTEXT | 208 | 80 | 0.615 | 0 | 0 | 80 |
| DV_VIOLENCE_IMMINENT | 32 | 32 | 0.000 | 32 | 0 | 0 |
| THIRD_PARTY_IMMINENT | 34 | 26 | 0.235 | 26 | 0 | 0 |
| SELF_HARM_DISCLOSURE | 23 | 22 | 0.043 | 0 | 22 | 0 |
| PASSIVE_DEATH_WISH | 28 | 20 | 0.286 | 0 | 20 | 0 |
| SUICIDAL_IDEATION | 28 | 20 | 0.286 | 0 | 17 | 3 |
| ACTIVE_IDEATION | 20 | 19 | 0.050 | 0 | 19 | 0 |
| BURDENSOMENESS | 19 | 19 | 0.000 | 0 | 0 | 0 |
| CURRENT_INTENT | 31 | 18 | 0.419 | 18 | 0 | 0 |
| IMMEDIATE_SELF_HARM | 18 | 18 | 0.000 | 18 | 0 | 0 |
| AMBIGUOUS_DISAPPEAR | 16 | 16 | 0.000 | 0 | 0 | 0 |
| HOPELESSNESS_EARLY | 16 | 16 | 0.000 | 0 | 0 | 0 |

### context_domain

| value | n | errors | accuracy | crit FN EMERG | crit FN RED | GREEN FP |
| --- | --- | --- | --- | --- | --- | --- |
| SAFETY | 243 | 183 | 0.247 | 96 | 61 | 0 |
| GENERAL | 1411 | 164 | 0.884 | 36 | 6 | 93 |
| SUICIDE | 81 | 80 | 0.012 | 45 | 35 | 0 |
| MOOD | 56 | 26 | 0.536 | 0 | 13 | 0 |
| FAMILY | 29 | 15 | 0.483 | 0 | 0 | 1 |
| ACADEMIC | 19 | 8 | 0.579 | 0 | 0 | 1 |
| FINANCIAL | 21 | 6 | 0.714 | 0 | 0 | 0 |
| HEALTH | 18 | 6 | 0.667 | 0 | 0 | 0 |
| PARENTING | 14 | 5 | 0.643 | 0 | 0 | 0 |
| RELATIONSHIP | 18 | 5 | 0.722 | 0 | 0 | 0 |
| SELF_HARM | 5 | 5 | 0.000 | 1 | 4 | 0 |
| SLEEP | 15 | 5 | 0.667 | 0 | 0 | 0 |

### subject

| value | n | errors | accuracy | crit FN EMERG | crit FN RED | GREEN FP |
| --- | --- | --- | --- | --- | --- | --- |
| SELF | 1924 | 452 | 0.765 | 119 | 118 | 94 |
| SELF_EXPOSED_TO_OTHER | 36 | 34 | 0.056 | 34 | 0 | 0 |
| OTHER | 36 | 27 | 0.250 | 26 | 1 | 0 |
| OTHER_OR_GENERAL | 4 | 2 | 0.500 | 0 | 0 | 2 |

### temporality

| value | n | errors | accuracy | crit FN EMERG | crit FN RED | GREEN FP |
| --- | --- | --- | --- | --- | --- | --- |
| CURRENT | 1827 | 383 | 0.790 | 55 | 114 | 94 |
| IMMEDIATE | 163 | 124 | 0.239 | 124 | 0 | 0 |
| HISTORICAL_OR_RECENT_HISTORY | 10 | 8 | 0.200 | 0 | 5 | 2 |

### ideation_signal

| value | n | errors | accuracy | crit FN EMERG | crit FN RED | GREEN FP |
| --- | --- | --- | --- | --- | --- | --- |
| ACUTE_SAFETY_THREAT | 175 | 134 | 0.234 | 134 | 0 | 0 |
| NONE_ESTABLISHED | 1517 | 103 | 0.932 | 0 | 7 | 96 |
| SUICIDAL_IDEATION_OR_RELATED | 123 | 97 | 0.211 | 45 | 52 | 0 |
| NOT_ESTABLISHED | 98 | 95 | 0.031 | 0 | 0 | 0 |
| PASSIVE_DEATH_WISH | 33 | 33 | 0.000 | 0 | 33 | 0 |
| UNKNOWN_OR_PROTECTIVE_AMBIVALENCE | 31 | 30 | 0.032 | 0 | 4 | 0 |
| SELF_HARM_RELATED | 23 | 23 | 0.000 | 0 | 23 | 0 |

### intent

| value | n | errors | accuracy | crit FN EMERG | crit FN RED | GREEN FP |
| --- | --- | --- | --- | --- | --- | --- |
| NONE_ESTABLISHED | 1639 | 221 | 0.865 | 0 | 4 | 96 |
| PRESENT_OR_ACUTE | 220 | 179 | 0.186 | 179 | 0 | 0 |
| UNKNOWN_OR_NOT_ESTABLISHED | 141 | 115 | 0.184 | 0 | 115 | 0 |

### plan

| value | n | errors | accuracy | crit FN EMERG | crit FN RED | GREEN FP |
| --- | --- | --- | --- | --- | --- | --- |
| NONE_ESTABLISHED | 1947 | 482 | 0.752 | 146 | 119 | 96 |
| MEANS_OR_ACCESS_SIGNAL | 16 | 16 | 0.000 | 16 | 0 | 0 |
| PRESENT_NON_METHOD_SPECIFIC | 21 | 9 | 0.571 | 9 | 0 | 0 |
| PREPARATORY_BEHAVIOUR | 16 | 8 | 0.500 | 8 | 0 | 0 |

### ambiguity

| value | n | errors | accuracy | crit FN EMERG | crit FN RED | GREEN FP |
| --- | --- | --- | --- | --- | --- | --- |
| LOW | 1601 | 306 | 0.809 | 179 | 111 | 16 |
| HIGH | 343 | 156 | 0.545 | 0 | 8 | 80 |
| MEDIUM | 56 | 53 | 0.054 | 0 | 0 | 0 |

### target_locale

| value | n | errors | accuracy | crit FN EMERG | crit FN RED | GREEN FP |
| --- | --- | --- | --- | --- | --- | --- |
| UNIVERSAL | 1736 | 403 | 0.768 | 136 | 103 | 83 |
| MALAYSIA | 43 | 20 | 0.535 | 6 | 3 | 4 |
| INDIA | 40 | 19 | 0.525 | 7 | 3 | 1 |
| INDONESIA | 38 | 19 | 0.500 | 6 | 4 | 2 |
| CHINESE | 24 | 13 | 0.458 | 5 | 3 | 2 |
| SOUTH_AFRICA | 21 | 10 | 0.524 | 3 | 2 | 3 |
| ARABIC | 21 | 8 | 0.619 | 5 | 0 | 0 |
| UK | 26 | 8 | 0.692 | 5 | 0 | 0 |
| AFRICAN_ENGLISH | 18 | 7 | 0.611 | 3 | 1 | 1 |
| AU | 23 | 6 | 0.739 | 1 | 0 | 0 |
| US | 10 | 2 | 0.800 | 2 | 0 | 0 |

### source_type

| value | n | errors | accuracy | crit FN EMERG | crit FN RED | GREEN FP |
| --- | --- | --- | --- | --- | --- | --- |
| V0.3_EXPANSION | 1467 | 267 | 0.818 | 92 | 55 | 80 |
| CURATED_LIST_SOURCE_RELABELED | 302 | 136 | 0.550 | 51 | 54 | 5 |
| REEBOOT_V0.1_SEED_RETAINED | 200 | 82 | 0.590 | 36 | 6 | 11 |
| UPLOADED_PROTECTIVE_RETAINED | 31 | 30 | 0.032 | 0 | 4 | 0 |

## 9. Pathway routing: SELF / THIRD_PARTY / DV-VIOLENCE

The current Safety Engine emits a four-tier **safety state** only. It does not implement separate backend pathways for third-party danger or DV/violence. Every EMERGENCY prediction is mapped to `ACUTE_SELF_SAFETY_PATH`.

| Cohort | n | Safety-state accuracy | Pathway-action accuracy |
| --- | --- | --- | --- |
| SELF | 1924 | 0.7651 | 0.7651 |
| THIRD_PARTY | 40 | 0.2750 | 0.0750 |
| DV_VIOLENCE | 37 | 0.0541 | 0.0541 |

### SELF

Expected actions: `{'STANDARD_SUPPORT': 1503, 'SAFETY_CLARIFY_AND_NARROW': 125, 'DETERMINISTIC_SAFETY_PATH': 144, 'ACUTE_SELF_SAFETY_PATH': 152}`
Predicted actions: `{'STANDARD_SUPPORT': 1727, 'SAFETY_CLARIFY_AND_NARROW': 73, 'DETERMINISTIC_SAFETY_PATH': 91, 'ACUTE_SELF_SAFETY_PATH': 33}`

### THIRD_PARTY

Expected actions: `{'DETERMINISTIC_SAFETY_PATH': 1, 'ACUTE_THIRD_PARTY_SAFETY_PATH': 34, 'STANDARD_SUPPORT': 5}`
Predicted actions: `{'STANDARD_SUPPORT': 30, 'DETERMINISTIC_SAFETY_PATH': 1, 'SAFETY_CLARIFY_AND_NARROW': 1, 'ACUTE_SELF_SAFETY_PATH': 8}`

The kernel cannot emit `ACUTE_THIRD_PARTY_SAFETY_PATH`. Third-party imminent cases are therefore pathway-incorrect even when the safety state is EMERGENCY.

### DV / VIOLENCE

Expected actions: `{'STANDARD_SUPPORT': 2, 'DETERMINISTIC_SAFETY_PATH': 1, 'ACUTE_VIOLENCE_DV_SAFETY_PATH': 34}`
Predicted actions: `{'STANDARD_SUPPORT': 37}`

The kernel cannot emit `ACUTE_VIOLENCE_DV_SAFETY_PATH`. Acute DV/violence cases are therefore pathway-incorrect even when the safety state is EMERGENCY.

## Failure type counts

| failure_type | n |
| --- | --- |
| CRITICAL_FALSE_NEGATIVE_EMERGENCY | 179 |
| BOUNDARY_GREEN_AMBER | 121 |
| CRITICAL_FALSE_NEGATIVE_RED | 119 |
| FALSE_POSITIVE_GREEN_ESCALATED | 96 |

Complete failure records: **515** rows in `safety_eval_failures.jsonl`.

## Baseline reading

This is a lexical-signal + rule hysteresis engine scored against a two-axis clinical candidate corpus. Distress words escalate to AMBER; hard EMERGENCY requires first-person + immediate intent + active threat. The corpus treats third-party imminent harm and acute DV as EMERGENCY with separate pathways, and treats many idioms / jokes / quoted / fictional / historical mentions as GREEN. Those design gaps are measured here, not patched.

