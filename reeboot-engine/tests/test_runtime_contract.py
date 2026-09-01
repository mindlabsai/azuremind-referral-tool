from __future__ import annotations

import pytest

from reeboot.contract.compiler import RuntimeContractCompiler
from reeboot.domain.resolver import DomainResolution
from reeboot.engine import ReebootEngine
from reeboot.intervention.selector import InterventionSelector
from reeboot.policy.engine import PolicyEngine
from reeboot.schemas.contract import RuntimeContract
from reeboot.schemas.enums import (
    Arousal,
    Domain,
    PolicyDecision,
    SafetyState,
    SessionMode,
    UserState,
)
from reeboot.session import Session
from reeboot.state.estimator import StateEstimate


def test_contract_matches_canonical_shape() -> None:
    session = Session(session_id="sess_883011", mode=SessionMode.VOICE)
    resolution = DomainResolution(
        Domain.NEURO_EXEC_FUNCTION, (Domain.WORK_STRESS,), {}
    )
    estimate = StateEstimate(UserState.TASK_INITIATION_BLOCK, Arousal.HIGH)
    plan = InterventionSelector().select(SafetyState.GREEN, resolution, estimate)
    verdict = PolicyEngine().decide(SafetyState.GREEN, plan.primitive)
    contract = RuntimeContractCompiler("sha256:test").compile(
        session=session,
        turn_id="turn_10492",
        safety_state=SafetyState.GREEN,
        risk_flags=(),
        resolution=resolution,
        estimate=estimate,
        plan=plan,
        verdict=verdict,
    )
    payload = contract.model_dump(by_alias=True, mode="json")
    assert payload["$schema"] == "https://schema.reeboot.ai/v1/runtime_contract.json"
    assert payload["session"]["session_id"] == "sess_883011"
    assert payload["session"]["turn_id"] == "turn_10492"
    assert payload["session"]["mode"] == "VOICE"
    assert payload["safety"]["state"] == "GREEN"
    assert payload["user_state"]["primary_domain"] == "NEURO_EXEC_FUNCTION"
    assert payload["user_state"]["secondary_domains"] == ["WORK_STRESS"]
    assert payload["user_state"]["state"] == "TASK_INITIATION_BLOCK"
    assert payload["intervention"]["primitive"] == "MICRO_ACTION"
    assert payload["intervention"]["objective"] == "REDUCE_INITIATION_THRESHOLD"
    assert payload["intervention"]["constraints"]["maximum_actions"] == 1
    assert payload["conversation"]["move"] == "DIRECTIVE_MICRO_PROMPT"
    assert payload["claims"]["clinical_actions_allowed"] is False
    assert payload["claims"]["diagnostic_inference_allowed"] is False
    assert payload["policy"]["decision"] == "ALLOW"
    assert payload["policy"]["policy_bundle"] == "AU_WELLBEING_V1"
    assert "provenance" in payload
    assert contract.generation_allowed() is True


def test_contract_is_frozen() -> None:
    session = Session()
    resolution = DomainResolution(Domain.MILD_DISTRESS, (), {})
    estimate = StateEstimate(UserState.MILD_AFFECTIVE_LOAD, Arousal.LOW)
    plan = InterventionSelector().select(SafetyState.GREEN, resolution, estimate)
    verdict = PolicyEngine().decide(SafetyState.GREEN, plan.primitive)
    contract = RuntimeContractCompiler("sha256:test").compile(
        session, "turn_00001", SafetyState.GREEN, (), resolution, estimate, plan, verdict
    )
    with pytest.raises(Exception):
        contract.safety.state = SafetyState.RED  # type: ignore[misc]


@pytest.mark.asyncio
async def test_engine_emits_valid_contract() -> None:
    engine = ReebootEngine(show_telemetry=False)
    session = engine.new_session()
    result = await engine.process_text(
        session, "I can't start this assignment, my brain won't begin"
    )
    RuntimeContract.model_validate(result.contract.model_dump(by_alias=True))
    assert result.contract.policy.decision == PolicyDecision.ALLOW
    assert result.contract.user_state.primary_domain == Domain.NEURO_EXEC_FUNCTION
