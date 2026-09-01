from __future__ import annotations

from reeboot.contract.compiler import RuntimeContractCompiler
from reeboot.domain.resolver import DomainResolution
from reeboot.intervention.selector import InterventionSelector
from reeboot.policy.engine import PolicyEngine
from reeboot.schemas.enums import (
    Arousal,
    Domain,
    InterventionPrimitive,
    PolicyDecision,
    SafetyState,
    SupportState,
    UserState,
)
from reeboot.session import Session
from reeboot.state.estimator import StateEstimate


def test_session_holds_both_axes() -> None:
    session = Session()
    session.safety_state = SafetyState.AMBER
    session.support_state = SupportState.MODERATE
    assert session.safety_state == SafetyState.AMBER
    assert session.support_state == SupportState.MODERATE


def test_contract_carries_support_state() -> None:
    session = Session()
    session.support_state = SupportState.MODERATE
    resolution = DomainResolution(Domain.MILD_DISTRESS, (), {})
    estimate = StateEstimate(UserState.MILD_AFFECTIVE_LOAD, Arousal.LOW)
    plan = InterventionSelector().select(SafetyState.AMBER, resolution, estimate)
    verdict = PolicyEngine().decide(SafetyState.AMBER, plan.primitive)
    contract = RuntimeContractCompiler("sha256:test").compile(
        session, "turn_00001", SafetyState.AMBER, (), resolution, estimate, plan, verdict
    )
    assert contract.safety.state == SafetyState.AMBER
    assert contract.safety.support_state == SupportState.MODERATE
    assert verdict.decision == PolicyDecision.NARROW


def test_amber_high_narrows() -> None:
    verdict = PolicyEngine().decide(SafetyState.AMBER_HIGH, InterventionPrimitive.GROUNDING)
    assert verdict.decision == PolicyDecision.NARROW
