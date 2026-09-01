# Reeboot Gen 2 Safety Baseline Evaluation

**Mode:** MEASUREMENT ONLY — Safety Engine was not modified.
**Corpus:** REEBOOT_SAFETY_CORPUS_v0.3_2000 (CANDIDATE_NOT_GOLD)
**Engine:** `reeboot.safety.engine.SafetyEngine`
**Evaluated:** 2026-09-01T14:57:18.970332+00:00

## Integrity checks

| Check | Result |
| --- | --- |
| Cases loaded | 400 |
| Cases executed | 400 |
| Unique case IDs | 400 |
| Duplicate case IDs | 0 |
| Fresh session per case | YES |
| Deterministic repeated evaluation | YES |
| Prediction signature | `f16366a97639f86a7d4ba91e8c8fcf77bb51c15418294a9808a1fa4ad48238f5` |

## 1. Total cases tested

**400** / 2000

## 2. Overall accuracy

**0.7300** (292 correct, 108 incorrect)

## 3. Precision / recall / F1

| Class | Precision | Recall | F1 | Support | TP | FP | FN |
| --- | --- | --- | --- | --- | --- | --- | --- |
| GREEN | 0.7849 | 0.9305 | 0.8515 | 302 | 281 | 77 | 21 |
| AMBER | 0.0000 | 0.0000 | 0.0000 | 25 | 0 | 12 | 25 |
| RED | 0.1739 | 0.1379 | 0.1538 | 29 | 4 | 19 | 25 |
| EMERGENCY | 1.0000 | 0.1591 | 0.2745 | 44 | 7 | 0 | 37 |

## 4. Confusion matrix

Rows = expected, columns = predicted.

| expected \ predicted | GREEN | AMBER | RED | EMERGENCY |
| --- | --- | --- | --- | --- |
| GREEN | 281 | 3 | 18 | 0 |
| AMBER | 25 | 0 | 0 | 0 |
| RED | 19 | 6 | 4 | 0 |
| EMERGENCY | 33 | 3 | 1 | 7 |

## 5. Critical false negatives

### Expected EMERGENCY, predicted RED / AMBER / GREEN

**37** cases. By predicted state: `{'GREEN': 33, 'RED': 1, 'AMBER': 3}`

### Expected RED, predicted AMBER / GREEN

**25** cases. By predicted state: `{'GREEN': 19, 'AMBER': 6}`

## 6. False positives (GREEN escalated)

**21** expected-GREEN cases were escalated. By predicted state: `{'AMBER': 3, 'RED': 18}`

Hard-negative subset (jokes, idioms, quoted/fictional/historical/third-person traps): **19**

Hard-negative families:

| semantic_family | n |
| --- | --- |
| HARD_NEGATIVE_CONTEXT | 19 |

All GREEN escalations by semantic family (top 15):

| semantic_family | n |
| --- | --- |
| HARD_NEGATIVE_CONTEXT | 19 |
| EVERYDAY_FRUSTRATION | 1 |
| SUICIDAL_IDEATION | 1 |

## 7. Boundary errors

| Boundary | n | Direction counts |
| --- | --- | --- |
| GREEN ↔ AMBER | 28 | {'GREEN->AMBER': 3, 'AMBER->GREEN': 25} |
| AMBER ↔ RED | 6 | {'RED->AMBER': 6} |
| RED ↔ EMERGENCY | 1 | {'EMERGENCY->RED': 1} |

## 8. Error breakdown

Accuracy and critical errors by corpus axis. Full counts are in `safety_eval_results.json`.

### semantic_family

| value | n | errors | accuracy | crit FN EMERG | crit FN RED | GREEN FP |
| --- | --- | --- | --- | --- | --- | --- |
| HARD_NEGATIVE_CONTEXT | 42 | 19 | 0.548 | 0 | 0 | 19 |
| ACTIVE_IDEATION | 6 | 6 | 0.000 | 0 | 6 | 0 |
| DV_VIOLENCE_IMMINENT | 6 | 6 | 0.000 | 6 | 0 | 0 |
| THIRD_PARTY_IMMINENT | 8 | 6 | 0.250 | 6 | 0 | 0 |
| PLAN_ACCESS_INTENT | 5 | 5 | 0.000 | 5 | 0 | 0 |
| IMMINENT_INTENT_TIMED | 4 | 4 | 0.000 | 4 | 0 | 0 |
| PASSIVE_DEATH_WISH | 7 | 4 | 0.429 | 0 | 4 | 0 |
| AMBIGUOUS_CONTINUATION | 3 | 3 | 0.000 | 0 | 0 | 0 |
| AMBIGUOUS_DISAPPEAR | 3 | 3 | 0.000 | 0 | 0 | 0 |
| BURDENSOMENESS | 3 | 3 | 0.000 | 0 | 0 | 0 |
| CURRENT_ACTION | 3 | 3 | 0.000 | 3 | 0 | 0 |
| HOPELESSNESS_EARLY | 3 | 3 | 0.000 | 0 | 0 | 0 |

### context_domain

| value | n | errors | accuracy | crit FN EMERG | crit FN RED | GREEN FP |
| --- | --- | --- | --- | --- | --- | --- |
| SAFETY | 49 | 38 | 0.224 | 22 | 9 | 0 |
| GENERAL | 288 | 35 | 0.878 | 6 | 1 | 21 |
| SUICIDE | 19 | 19 | 0.000 | 9 | 10 | 0 |
| MOOD | 8 | 4 | 0.500 | 0 | 2 | 0 |
| FAMILY | 5 | 3 | 0.400 | 0 | 0 | 0 |
| SELF_HARM | 3 | 3 | 0.000 | 0 | 3 | 0 |
| FINANCIAL | 5 | 2 | 0.600 | 0 | 0 | 0 |
| RELATIONSHIP | 5 | 2 | 0.600 | 0 | 0 | 0 |
| HEALTH | 3 | 1 | 0.667 | 0 | 0 | 0 |
| PARENTING | 5 | 1 | 0.800 | 0 | 0 | 0 |
| ACADEMIC | 1 | 0 | 1.000 | 0 | 0 | 0 |
| GRIEF_ADJACENT | 1 | 0 | 1.000 | 0 | 0 | 0 |

### subject

| value | n | errors | accuracy | crit FN EMERG | crit FN RED | GREEN FP |
| --- | --- | --- | --- | --- | --- | --- |
| SELF | 385 | 96 | 0.751 | 25 | 25 | 21 |
| OTHER | 9 | 6 | 0.333 | 6 | 0 | 0 |
| SELF_EXPOSED_TO_OTHER | 6 | 6 | 0.000 | 6 | 0 | 0 |

### temporality

| value | n | errors | accuracy | crit FN EMERG | crit FN RED | GREEN FP |
| --- | --- | --- | --- | --- | --- | --- |
| CURRENT | 361 | 77 | 0.787 | 8 | 23 | 21 |
| IMMEDIATE | 36 | 29 | 0.194 | 29 | 0 | 0 |
| HISTORICAL_OR_RECENT_HISTORY | 3 | 2 | 0.333 | 0 | 2 | 0 |

### ideation_signal

| value | n | errors | accuracy | crit FN EMERG | crit FN RED | GREEN FP |
| --- | --- | --- | --- | --- | --- | --- |
| ACUTE_SAFETY_THREAT | 35 | 28 | 0.200 | 28 | 0 | 0 |
| NONE_ESTABLISHED | 303 | 22 | 0.927 | 0 | 1 | 21 |
| SUICIDAL_IDEATION_OR_RELATED | 25 | 21 | 0.160 | 9 | 12 | 0 |
| NOT_ESTABLISHED | 18 | 18 | 0.000 | 0 | 0 | 0 |
| UNKNOWN_OR_PROTECTIVE_AMBIVALENCE | 8 | 8 | 0.000 | 0 | 1 | 0 |
| PASSIVE_DEATH_WISH | 6 | 6 | 0.000 | 0 | 6 | 0 |
| SELF_HARM_RELATED | 5 | 5 | 0.000 | 0 | 5 | 0 |

### intent

| value | n | errors | accuracy | crit FN EMERG | crit FN RED | GREEN FP |
| --- | --- | --- | --- | --- | --- | --- |
| NONE_ESTABLISHED | 328 | 47 | 0.857 | 0 | 1 | 21 |
| PRESENT_OR_ACUTE | 44 | 37 | 0.159 | 37 | 0 | 0 |
| UNKNOWN_OR_NOT_ESTABLISHED | 28 | 24 | 0.143 | 0 | 24 | 0 |

### plan

| value | n | errors | accuracy | crit FN EMERG | crit FN RED | GREEN FP |
| --- | --- | --- | --- | --- | --- | --- |
| NONE_ESTABLISHED | 386 | 99 | 0.744 | 28 | 25 | 21 |
| MEANS_OR_ACCESS_SIGNAL | 5 | 5 | 0.000 | 5 | 0 | 0 |
| PREPARATORY_BEHAVIOUR | 6 | 3 | 0.500 | 3 | 0 | 0 |
| PRESENT_NON_METHOD_SPECIFIC | 3 | 1 | 0.667 | 1 | 0 | 0 |

### ambiguity

| value | n | errors | accuracy | crit FN EMERG | crit FN RED | GREEN FP |
| --- | --- | --- | --- | --- | --- | --- |
| LOW | 320 | 60 | 0.812 | 37 | 21 | 2 |
| HIGH | 69 | 37 | 0.464 | 0 | 4 | 19 |
| MEDIUM | 11 | 11 | 0.000 | 0 | 0 | 0 |

### target_locale

| value | n | errors | accuracy | crit FN EMERG | crit FN RED | GREEN FP |
| --- | --- | --- | --- | --- | --- | --- |
| UNIVERSAL | 351 | 89 | 0.746 | 30 | 22 | 20 |
| INDIA | 6 | 4 | 0.333 | 1 | 1 | 0 |
| SOUTH_AFRICA | 8 | 4 | 0.500 | 1 | 1 | 1 |
| AU | 4 | 3 | 0.250 | 1 | 0 | 0 |
| INDONESIA | 8 | 3 | 0.625 | 1 | 1 | 0 |
| MALAYSIA | 4 | 3 | 0.250 | 1 | 0 | 0 |
| ARABIC | 5 | 1 | 0.800 | 1 | 0 | 0 |
| US | 2 | 1 | 0.500 | 1 | 0 | 0 |
| AFRICAN_ENGLISH | 2 | 0 | 1.000 | 0 | 0 | 0 |
| CHINESE | 3 | 0 | 1.000 | 0 | 0 | 0 |
| UK | 7 | 0 | 1.000 | 0 | 0 | 0 |

### source_type

| value | n | errors | accuracy | crit FN EMERG | crit FN RED | GREEN FP |
| --- | --- | --- | --- | --- | --- | --- |
| V0.3_EXPANSION | 295 | 56 | 0.810 | 22 | 8 | 19 |
| CURATED_LIST_SOURCE_RELABELED | 60 | 29 | 0.517 | 9 | 15 | 1 |
| REEBOOT_V0.1_SEED_RETAINED | 37 | 15 | 0.595 | 6 | 1 | 1 |
| UPLOADED_PROTECTIVE_RETAINED | 8 | 8 | 0.000 | 0 | 1 | 0 |

## 9. Pathway routing: SELF / THIRD_PARTY / DV-VIOLENCE

The current Safety Engine emits a four-tier **safety state** only. It does not implement separate backend pathways for third-party danger or DV/violence. Every EMERGENCY prediction is mapped to `ACUTE_SELF_SAFETY_PATH`.

| Cohort | n | Safety-state accuracy | Pathway-action accuracy |
| --- | --- | --- | --- |
| SELF | 385 | 0.7506 | 0.7506 |
| THIRD_PARTY | 9 | 0.3333 | 0.1111 |
| DV_VIOLENCE | 6 | 0.0000 | 0.0000 |

### SELF

Expected actions: `{'STANDARD_SUPPORT': 301, 'DETERMINISTIC_SAFETY_PATH': 29, 'SAFETY_CLARIFY_AND_NARROW': 25, 'ACUTE_SELF_SAFETY_PATH': 30}`
Predicted actions: `{'STANDARD_SUPPORT': 345, 'SAFETY_CLARIFY_AND_NARROW': 12, 'DETERMINISTIC_SAFETY_PATH': 23, 'ACUTE_SELF_SAFETY_PATH': 5}`

### THIRD_PARTY

Expected actions: `{'STANDARD_SUPPORT': 1, 'ACUTE_THIRD_PARTY_SAFETY_PATH': 8}`
Predicted actions: `{'STANDARD_SUPPORT': 7, 'ACUTE_SELF_SAFETY_PATH': 2}`

The kernel cannot emit `ACUTE_THIRD_PARTY_SAFETY_PATH`. Third-party imminent cases are therefore pathway-incorrect even when the safety state is EMERGENCY.

### DV / VIOLENCE

Expected actions: `{'ACUTE_VIOLENCE_DV_SAFETY_PATH': 6}`
Predicted actions: `{'STANDARD_SUPPORT': 6}`

The kernel cannot emit `ACUTE_VIOLENCE_DV_SAFETY_PATH`. Acute DV/violence cases are therefore pathway-incorrect even when the safety state is EMERGENCY.

## Failure type counts

| failure_type | n |
| --- | --- |
| CRITICAL_FALSE_NEGATIVE_EMERGENCY | 37 |
| CRITICAL_FALSE_NEGATIVE_RED | 25 |
| BOUNDARY_GREEN_AMBER | 25 |
| FALSE_POSITIVE_GREEN_ESCALATED | 21 |

Complete failure records: **108** rows in `safety_eval_failures.jsonl`.

## Baseline reading

This is a lexical-signal + rule hysteresis engine scored against a two-axis clinical candidate corpus. Distress words escalate to AMBER; hard EMERGENCY requires first-person + immediate intent + active threat. The corpus treats third-party imminent harm and acute DV as EMERGENCY with separate pathways, and treats many idioms / jokes / quoted / fictional / historical mentions as GREEN. Those design gaps are measured here, not patched.

