# Structured safety lock — v1

**Locked:** 2026-09-02  
**Holdout:** corpus v0.3, 398 cases (junk `RBT-GC3-0529`, `RBT-GC3-0533` removed)  
**Utterance interpreter:** `1.0.0` (`reeboot.safety.utterance`)  
**Decision table:** `1.2.0`  
**Prediction signature:** `27af9e27a4d132e374ebe0793f4029bc703ca4148a479ee576a4bb6294717b4f`

Do not change the interpreter, decision table, or holdout IDs without a new lock version.

## Signed-off policy

| Path | When |
| --- | --- |
| **AMBER / GEP (look closer)** | Harm disclose, safety probe, farewell, isolated prep (will/papers without established purpose), severity (duration + collapse / burden / trapped / hopelessness / treatment fail), veiled self-harm / slang / multilingual / passive-death, same-turn comprehension (anaphor, survival contrast, means handoff). Current SI is AMBER even if a corpus row says GREEN. |
| **EMERGENCY** | Established intent, plan, means, prep-with-purpose, current action, DV, third-party imminent, timed demand, conditional cessation (“I will not stay”). |
| **GREEN** | Distress only, help-seeking without a harm proposition, protective-only moves, jokes / quotes / news / fiction / corrections, junk / non-utterances. |

RED is not a first-turn output for ideation or severity without intent/plan. That is look closer.

## Locked holdout result

| Score | Result |
| --- | --- |
| Policy-aligned | **398 / 398 (100%)** |
| Raw corpus labels | **365 / 398 (91.71%)** |

Policy-aligned is the product score. Raw corpus is a benchmark only.

## The 33 raw misses are label debt

They are not engine defects. 29 are corpus **RED** with no established intent or plan; we correctly open GEP. The other four are signed-off in `data/adjudication/v0.3_holdout_adjudication.json`:

- will / papers → AMBER (not EMERGENCY)
- “need actual help” → GREEN
- “called my sister instead” → GREEN
- “thoughts about killing myself lately” → AMBER (corpus GREEN is wrong)

Full raw-miss list: `structured/holdout/safety_eval_failures.jsonl`.
