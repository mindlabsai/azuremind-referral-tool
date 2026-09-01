# Reeboot Gen 2 prototype

Single-process async Python kernel implementing the design-frozen
`docs/REEBOOT_GEN2_MASTER_SPEC_v1.2.md` vertical slice.

The model generates language. Reeboot owns state, safety, intervention
selection, consent, escalation, and session behaviour.

## Setup

```bash
cd reeboot-engine
/opt/homebrew/opt/python@3.11/bin/python3.11 -m venv .venv
source .venv/bin/activate
pip install -e ".[dev]"
```

## Run

```bash
python -m reeboot --demo
python -m reeboot --once "I can't start this report"
python -m reeboot
```

## Test

```bash
pytest -q
```

RED and EMERGENCY remove generative authority and use deterministic responses.
A mock `GenerationProvider` is the default so missing API keys cannot block the kernel.

## Safety backends

Layer 0 (`SafetyEngine`) is frozen and remains the default.

```bash
# baseline (default)
python eval/run_safety_eval.py --backend baseline --split holdout

# Layer-1 decision table
REEBOOT_SAFETY_BACKEND=structured python -m reeboot --once "..."
python eval/run_safety_eval.py --backend structured --split holdout --outdir eval/structured/holdout
```

Locked holdout: `eval/LOCK_STRUCTURED_SAFETY_v1.md` (398 cases; junk rows removed). Split IDs in `eval/data/splits/`. Do not regenerate after scoring.
