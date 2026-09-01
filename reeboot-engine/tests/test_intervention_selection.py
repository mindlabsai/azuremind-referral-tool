from __future__ import annotations

from reeboot.domain.resolver import DomainResolution
from reeboot.intervention.selector import InterventionSelector
from reeboot.schemas.enums import (
    Arousal,
    Domain,
    InterventionPrimitive,
    SafetyState,
    UserState,
)
from reeboot.state.estimator import StateEstimate


def test_green_neuro_micro_action() -> None:
    plan = InterventionSelector().select(
        SafetyState.GREEN,
        DomainResolution(Domain.NEURO_EXEC_FUNCTION, (), {}),
        StateEstimate(UserState.TASK_INITIATION_BLOCK, Arousal.HIGH),
    )
    assert plan.primitive == InterventionPrimitive.MICRO_ACTION
    assert plan.constraints.maximum_actions == 1
    assert plan.constraints.maximum_action_time_seconds == 5


def test_green_work_pacing() -> None:
    plan = InterventionSelector().select(
        SafetyState.GREEN,
        DomainResolution(Domain.WORK_STRESS, (), {}),
        StateEstimate(UserState.DEADLINE_PRESSURE, Arousal.MODERATE),
    )
    assert plan.primitive == InterventionPrimitive.PACING


def test_amber_narrows_to_grounding() -> None:
    plan = InterventionSelector().select(
        SafetyState.AMBER,
        DomainResolution(Domain.MILD_DISTRESS, (), {}),
        StateEstimate(UserState.MILD_AFFECTIVE_LOAD, Arousal.HIGH),
    )
    assert plan.primitive == InterventionPrimitive.GROUNDING
    assert plan.allow_question is False


def test_red_and_emergency_primitives() -> None:
    selector = InterventionSelector()
    red = selector.select(
        SafetyState.RED,
        DomainResolution(Domain.MILD_DISTRESS, (), {}),
        StateEstimate(UserState.MILD_AFFECTIVE_LOAD, Arousal.HIGH),
    )
    emergency = selector.select(
        SafetyState.EMERGENCY,
        DomainResolution(Domain.MILD_DISTRESS, (), {}),
        StateEstimate(UserState.MILD_AFFECTIVE_LOAD, Arousal.HIGH),
    )
    assert red.primitive == InterventionPrimitive.SAFETY_SIGNPOST
    assert emergency.primitive == InterventionPrimitive.CRISIS_LOCK
