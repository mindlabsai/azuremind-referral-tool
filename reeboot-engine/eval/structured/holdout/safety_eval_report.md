# Reeboot Gen 2 Safety Baseline Evaluation

**Mode:** MEASUREMENT ONLY — Safety Engine was not modified.
**Corpus:** REEBOOT_SAFETY_CORPUS_v0.3_2000 (CANDIDATE_NOT_GOLD)
**Engine:** `reeboot.safety.contextual.ContextualSafetyEngine`
**Evaluated:** 2026-09-01T17:23:18.998248+00:00

## Integrity checks

| Check | Result |
| --- | --- |
| Cases loaded | 398 |
| Cases executed | 398 |
| Unique case IDs | 398 |
| Duplicate case IDs | 0 |
| Fresh session per case | YES |
| Deterministic repeated evaluation | YES |
| Prediction signature | `27af9e27a4d132e374ebe0793f4029bc703ca4148a479ee576a4bb6294717b4f` |

## 1. Total cases tested

**398** / 2000

## 2. Overall accuracy

**0.9171** (365 correct, 33 incorrect)

**Policy-aligned accuracy:** **1.0000** (398 correct). RED with no established intent/plan is scored as AMBER.

## 3. Precision / recall / F1

| Class | Precision | Recall | F1 | Support | TP | FP | FN |
| --- | --- | --- | --- | --- | --- | --- | --- |
| GREEN | 0.9934 | 0.9967 | 0.9950 | 302 | 301 | 2 | 1 |
| AMBER | 0.4038 | 0.9130 | 0.5600 | 23 | 21 | 31 | 2 |
| RED | 0.0000 | 0.0000 | 0.0000 | 29 | 0 | 0 | 29 |
| EMERGENCY | 1.0000 | 0.9773 | 0.9885 | 44 | 43 | 0 | 1 |

## 4. Confusion matrix

Rows = expected, columns = predicted.

| expected \ predicted | GREEN | AMBER | RED | EMERGENCY |
| --- | --- | --- | --- | --- |
| GREEN | 301 | 1 | 0 | 0 |
| AMBER | 2 | 21 | 0 | 0 |
| RED | 0 | 29 | 0 | 0 |
| EMERGENCY | 0 | 1 | 0 | 43 |

## 5. Critical false negatives

### Expected EMERGENCY, predicted RED / AMBER / GREEN

**1** cases. By predicted state: `{'AMBER': 1}`

### Expected RED, predicted AMBER / GREEN

**29** cases. By predicted state: `{'AMBER': 29}`

## 6. False positives (GREEN escalated)

**1** expected-GREEN cases were escalated. By predicted state: `{'AMBER': 1}`

Hard-negative subset (jokes, idioms, quoted/fictional/historical/third-person traps): **0**

Hard-negative families:

| semantic_family | n |
| --- | --- |
| (none) | 0 |

All GREEN escalations by semantic family (top 15):

| semantic_family | n |
| --- | --- |
| SUICIDAL_IDEATION | 1 |

## 7. Boundary errors

| Boundary | n | Direction counts |
| --- | --- | --- |
| GREEN ↔ AMBER | 3 | {'GREEN->AMBER': 1, 'AMBER->GREEN': 2} |
| AMBER ↔ RED | 29 | {'RED->AMBER': 29} |
| RED ↔ EMERGENCY | 0 | {} |

## 8. Error breakdown

Accuracy and critical errors by corpus axis. Full counts are in `safety_eval_results.json`.

### semantic_family

| value | n | errors | accuracy | crit FN EMERG | crit FN RED | GREEN FP |
| --- | --- | --- | --- | --- | --- | --- |
| ACTIVE_IDEATION | 6 | 6 | 0.000 | 0 | 6 | 0 |
| PASSIVE_DEATH_WISH | 7 | 4 | 0.429 | 0 | 4 | 0 |
| CURRENT_SAFETY_WITH_IDEATION | 3 | 3 | 0.000 | 0 | 3 | 0 |
| SELF_HARM_DISCLOSURE | 3 | 3 | 0.000 | 0 | 3 | 0 |
| SUICIDAL_IDEATION | 3 | 3 | 0.000 | 0 | 2 | 1 |
| FAREWELL_VEILED | 2 | 2 | 0.000 | 0 | 2 | 0 |
| PASSIVE_IDEATION | 2 | 2 | 0.000 | 0 | 2 | 0 |
| PRIOR_ATTEMPT_DISCLOSURE | 2 | 2 | 0.000 | 0 | 2 | 0 |
| PROTECTIVE_PROTECTIVE_ENGAGEMENT | 3 | 2 | 0.333 | 0 | 0 | 0 |
| SELF_HARM_NON_SUICIDAL | 2 | 2 | 0.000 | 0 | 2 | 0 |
| HOPELESSNESS_FIXED | 1 | 1 | 0.000 | 0 | 1 | 0 |
| PREPARATORY_BEHAVIOUR | 6 | 1 | 0.833 | 1 | 0 | 0 |

### context_domain

| value | n | errors | accuracy | crit FN EMERG | crit FN RED | GREEN FP |
| --- | --- | --- | --- | --- | --- | --- |
| SAFETY | 47 | 15 | 0.681 | 0 | 13 | 0 |
| SUICIDE | 19 | 11 | 0.421 | 1 | 10 | 0 |
| SELF_HARM | 3 | 3 | 0.000 | 0 | 3 | 0 |
| GENERAL | 288 | 2 | 0.993 | 0 | 1 | 1 |
| MOOD | 8 | 2 | 0.750 | 0 | 2 | 0 |
| ACADEMIC | 1 | 0 | 1.000 | 0 | 0 | 0 |
| FAMILY | 5 | 0 | 1.000 | 0 | 0 | 0 |
| FINANCIAL | 5 | 0 | 1.000 | 0 | 0 | 0 |
| GRIEF_ADJACENT | 1 | 0 | 1.000 | 0 | 0 | 0 |
| HEALTH | 3 | 0 | 1.000 | 0 | 0 | 0 |
| PARENTING | 5 | 0 | 1.000 | 0 | 0 | 0 |
| PERINATAL | 1 | 0 | 1.000 | 0 | 0 | 0 |

### subject

| value | n | errors | accuracy | crit FN EMERG | crit FN RED | GREEN FP |
| --- | --- | --- | --- | --- | --- | --- |
| SELF | 383 | 33 | 0.914 | 1 | 29 | 1 |
| OTHER | 9 | 0 | 1.000 | 0 | 0 | 0 |
| SELF_EXPOSED_TO_OTHER | 6 | 0 | 1.000 | 0 | 0 | 0 |

### temporality

| value | n | errors | accuracy | crit FN EMERG | crit FN RED | GREEN FP |
| --- | --- | --- | --- | --- | --- | --- |
| CURRENT | 359 | 31 | 0.914 | 1 | 27 | 1 |
| HISTORICAL_OR_RECENT_HISTORY | 3 | 2 | 0.333 | 0 | 2 | 0 |
| IMMEDIATE | 36 | 0 | 1.000 | 0 | 0 | 0 |

### ideation_signal

| value | n | errors | accuracy | crit FN EMERG | crit FN RED | GREEN FP |
| --- | --- | --- | --- | --- | --- | --- |
| SUICIDAL_IDEATION_OR_RELATED | 25 | 17 | 0.320 | 1 | 16 | 0 |
| PASSIVE_DEATH_WISH | 6 | 6 | 0.000 | 0 | 6 | 0 |
| SELF_HARM_RELATED | 5 | 5 | 0.000 | 0 | 5 | 0 |
| UNKNOWN_OR_PROTECTIVE_AMBIVALENCE | 6 | 3 | 0.500 | 0 | 1 | 0 |
| NONE_ESTABLISHED | 303 | 2 | 0.993 | 0 | 1 | 1 |
| ACUTE_SAFETY_THREAT | 35 | 0 | 1.000 | 0 | 0 | 0 |
| NOT_ESTABLISHED | 18 | 0 | 1.000 | 0 | 0 | 0 |

### intent

| value | n | errors | accuracy | crit FN EMERG | crit FN RED | GREEN FP |
| --- | --- | --- | --- | --- | --- | --- |
| UNKNOWN_OR_NOT_ESTABLISHED | 28 | 28 | 0.000 | 0 | 28 | 0 |
| NONE_ESTABLISHED | 326 | 4 | 0.988 | 0 | 1 | 1 |
| PRESENT_OR_ACUTE | 44 | 1 | 0.977 | 1 | 0 | 0 |

### plan

| value | n | errors | accuracy | crit FN EMERG | crit FN RED | GREEN FP |
| --- | --- | --- | --- | --- | --- | --- |
| NONE_ESTABLISHED | 384 | 32 | 0.917 | 0 | 29 | 1 |
| PREPARATORY_BEHAVIOUR | 6 | 1 | 0.833 | 1 | 0 | 0 |
| MEANS_OR_ACCESS_SIGNAL | 5 | 0 | 1.000 | 0 | 0 | 0 |
| PRESENT_NON_METHOD_SPECIFIC | 3 | 0 | 1.000 | 0 | 0 | 0 |

### ambiguity

| value | n | errors | accuracy | crit FN EMERG | crit FN RED | GREEN FP |
| --- | --- | --- | --- | --- | --- | --- |
| LOW | 320 | 27 | 0.916 | 1 | 25 | 1 |
| HIGH | 67 | 6 | 0.910 | 0 | 4 | 0 |
| MEDIUM | 11 | 0 | 1.000 | 0 | 0 | 0 |

### target_locale

| value | n | errors | accuracy | crit FN EMERG | crit FN RED | GREEN FP |
| --- | --- | --- | --- | --- | --- | --- |
| UNIVERSAL | 349 | 29 | 0.917 | 1 | 26 | 0 |
| SOUTH_AFRICA | 8 | 2 | 0.750 | 0 | 1 | 1 |
| INDIA | 6 | 1 | 0.833 | 0 | 1 | 0 |
| INDONESIA | 8 | 1 | 0.875 | 0 | 1 | 0 |
| AFRICAN_ENGLISH | 2 | 0 | 1.000 | 0 | 0 | 0 |
| ARABIC | 5 | 0 | 1.000 | 0 | 0 | 0 |
| AU | 4 | 0 | 1.000 | 0 | 0 | 0 |
| CHINESE | 3 | 0 | 1.000 | 0 | 0 | 0 |
| MALAYSIA | 4 | 0 | 1.000 | 0 | 0 | 0 |
| UK | 7 | 0 | 1.000 | 0 | 0 | 0 |
| US | 2 | 0 | 1.000 | 0 | 0 | 0 |

### source_type

| value | n | errors | accuracy | crit FN EMERG | crit FN RED | GREEN FP |
| --- | --- | --- | --- | --- | --- | --- |
| CURATED_LIST_SOURCE_RELABELED | 60 | 16 | 0.733 | 1 | 15 | 0 |
| V0.3_EXPANSION | 295 | 12 | 0.959 | 0 | 12 | 0 |
| UPLOADED_PROTECTIVE_RETAINED | 6 | 3 | 0.500 | 0 | 1 | 0 |
| REEBOOT_V0.1_SEED_RETAINED | 37 | 2 | 0.946 | 0 | 1 | 1 |

## 9. Pathway routing: SELF / THIRD_PARTY / DV-VIOLENCE

The current Safety Engine emits a four-tier **safety state** only. It does not implement separate backend pathways for third-party danger or DV/violence. Every EMERGENCY prediction is mapped to `ACUTE_SELF_SAFETY_PATH`.

| Cohort | n | Safety-state accuracy | Pathway-action accuracy |
| --- | --- | --- | --- |
| SELF | 383 | 0.9138 | 0.9138 |
| THIRD_PARTY | 9 | 1.0000 | 1.0000 |
| DV_VIOLENCE | 6 | 1.0000 | 1.0000 |

### SELF

Expected actions: `{'STANDARD_SUPPORT': 301, 'DETERMINISTIC_SAFETY_PATH': 29, 'SAFETY_CLARIFY_AND_NARROW': 23, 'ACUTE_SELF_SAFETY_PATH': 30}`
Predicted actions: `{'STANDARD_SUPPORT': 302, 'SAFETY_CLARIFY_AND_NARROW': 52, 'ACUTE_SELF_SAFETY_PATH': 29}`

### THIRD_PARTY

Expected actions: `{'STANDARD_SUPPORT': 1, 'ACUTE_THIRD_PARTY_SAFETY_PATH': 8}`
Predicted actions: `{'STANDARD_SUPPORT': 1, 'ACUTE_THIRD_PARTY_SAFETY_PATH': 8}`

The kernel cannot emit `ACUTE_THIRD_PARTY_SAFETY_PATH`. Third-party imminent cases are therefore pathway-incorrect even when the safety state is EMERGENCY.

### DV / VIOLENCE

Expected actions: `{'ACUTE_VIOLENCE_DV_SAFETY_PATH': 6}`
Predicted actions: `{'ACUTE_VIOLENCE_DV_SAFETY_PATH': 6}`

The kernel cannot emit `ACUTE_VIOLENCE_DV_SAFETY_PATH`. Acute DV/violence cases are therefore pathway-incorrect even when the safety state is EMERGENCY.

## Failure type counts

| failure_type | n |
| --- | --- |
| CRITICAL_FALSE_NEGATIVE_RED | 29 |
| BOUNDARY_GREEN_AMBER | 2 |
| CRITICAL_FALSE_NEGATIVE_EMERGENCY | 1 |
| FALSE_POSITIVE_GREEN_ESCALATED | 1 |

Complete failure records: **33** rows in `safety_eval_failures.jsonl`.

## Baseline reading

This is a lexical-signal + rule hysteresis engine scored against a two-axis clinical candidate corpus. Distress words escalate to AMBER; hard EMERGENCY requires first-person + immediate intent + active threat. The corpus treats third-party imminent harm and acute DV as EMERGENCY with separate pathways, and treats many idioms / jokes / quoted / fictional / historical mentions as GREEN. Those design gaps are measured here, not patched.

