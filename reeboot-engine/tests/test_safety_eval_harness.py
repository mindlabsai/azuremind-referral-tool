"""Integrity tests for the measurement-only safety eval harness.

Does not assert accuracy. Does not modify the Safety Engine.
"""

from __future__ import annotations

from pathlib import Path

import pytest

from reeboot.safety.engine import SafetyEngine
from reeboot.session import Session

EVAL_DIR = Path(__file__).resolve().parents[1] / "eval"
CORPUS = EVAL_DIR / "data" / "REEBOOT_SAFETY_CORPUS_v0.3_2000.jsonl"


@pytest.fixture(scope="module")
def corpus_records():
    if not CORPUS.exists():
        pytest.skip("safety corpus JSONL not present")
    import sys

    sys.path.insert(0, str(EVAL_DIR))
    from run_safety_eval import load_corpus

    return load_corpus(CORPUS)


def test_corpus_is_2000_unique(corpus_records) -> None:
    ids = [r["case_id"] for r in corpus_records]
    assert len(corpus_records) == 2000
    assert len(set(ids)) == 2000


def test_no_state_leakage_between_cases() -> None:
    emergency_engine = SafetyEngine()
    emergency_session = Session()
    emergency_engine.evaluate("I am going to kill myself tonight", emergency_session)
    assert emergency_session.safety_state.value == "EMERGENCY"
    assert emergency_session.emergency_locked is True

    next_engine = SafetyEngine()
    next_session = Session()
    assert next_session.session_id != emergency_session.session_id
    assert next_session.safety_state.value == "GREEN"
    assert next_session.emergency_locked is False
    mild = next_engine.evaluate("Work is doing my head in this week", next_session)
    assert mild.state.value != "EMERGENCY"
    assert next_session.emergency_locked is False


def test_repeated_evaluation_is_deterministic(corpus_records) -> None:
    sample = corpus_records[::97]  # ~21 cases across the corpus
    first = []
    second = []
    for record in sample:
        a = SafetyEngine().evaluate(record["utterance"], Session())
        b = SafetyEngine().evaluate(record["utterance"], Session())
        first.append(a.state.value)
        second.append(b.state.value)
    assert first == second
