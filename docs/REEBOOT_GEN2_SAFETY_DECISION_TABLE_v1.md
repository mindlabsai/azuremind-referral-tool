# Reeboot Gen 2 Safety Decision Table v1.0

**Status:** v1.1 IMPLEMENTATION — clinical sign-off still required before Gold  
**Relation:** Addendum to `REEBOOT_GEN2_MASTER_SPEC_v1.2.md`  
**Does not replace:** baseline `SafetyEngine` (Layer 0). This is Layer 1, selected by flag.

## Axiom

Lexical matches are signals. Safety state is assigned only after structured features are extracted.

Distress is a support-state input. It is not a safety state.

## Features (extracted every turn)

| Feature | Values |
|---|---|
| subject | SELF / OTHER / SELF_EXPOSED_TO_OTHER |
| temporality | HISTORICAL / CURRENT / IMMEDIATE |
| ideation | NONE / PASSIVE / ACTIVE / UNSPECIFIED |
| intent | NONE / PRESENT / ACUTE |
| plan | NONE / NONSPECIFIC / MEANS / PREPARATORY / CURRENT_ACTION |
| frame | LITERAL / NEGATED / QUOTED / FICTIONAL / NEWS / IDIOM / HISTORICAL_DISCLOSURE |

Derived flags: `third_party_imminent`, `dv_acute`, `self_harm_disclosure`, `ambiguous_safety`.

## Decision table (first matching row wins)

| When | State | Pathway |
|---|---|---|
| Frame ∈ {QUOTED, FICTIONAL, NEWS, IDIOM} and no independent literal acute risk | GREEN | STANDARD_SUPPORT |
| Frame = HISTORICAL_DISCLOSURE and no current/immediate intent or plan | RED | DETERMINISTIC_SAFETY_PATH |
| `dv_acute` | EMERGENCY | ACUTE_VIOLENCE_DV_SAFETY_PATH |
| `third_party_imminent` | EMERGENCY | ACUTE_THIRD_PARTY_SAFETY_PATH |
| SELF + literal + (intent PRESENT/ACUTE ∨ plan ≠ NONE) | EMERGENCY | ACUTE_SELF_SAFETY_PATH |
| SELF + literal + (passive/active ideation ∨ self-harm disclosure) | RED | DETERMINISTIC_SAFETY_PATH |
| Safety language present but insufficient to classify | AMBER | SAFETY_CLARIFY_AND_NARROW |
| Else, including distress-only | GREEN | STANDARD_SUPPORT |

## Hard rules (from corpus schema v0.3)

- Passive death wish → RED
- Current self-harm disclosure → RED
- Current intent / plan-access / preparation / current action → EMERGENCY
- Third-party imminent danger → EMERGENCY + third-party pathway
- Acute DV/violence → EMERGENCY + DV pathway
- Distress severity is not safety state

## Runtime selection

```
REEBOOT_SAFETY_BACKEND=structured    # Layer 1 decision table (runtime default)
REEBOOT_SAFETY_BACKEND=baseline      # frozen Layer 0 (measurement comparison only)
```

Baseline lexical engine remains unmodified.

## Evaluation protocol

- Frozen split: 1600 train / 400 holdout, stratified by `expected_safety`
- Iterate only on train
- Score holdout once per implementation revision
- Do not add failure-file phrases into Layer 0 `lexical.py`
