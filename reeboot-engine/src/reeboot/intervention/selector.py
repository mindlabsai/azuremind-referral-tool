"""Intervention selection — owned by Reeboot, never the LLM."""

from __future__ import annotations

from dataclasses import dataclass

from reeboot.domain.resolver import DomainResolution
from reeboot.schemas.contract import InterventionConstraints
from reeboot.schemas.enums import (
    ConversationMove,
    Domain,
    InterventionObjective,
    InterventionPrimitive,
    SafetyState,
    UserState,
)
from reeboot.state.estimator import StateEstimate


@dataclass(frozen=True)
class InterventionPlan:
    primitive: InterventionPrimitive
    objective: InterventionObjective
    constraints: InterventionConstraints
    move: ConversationMove
    maximum_words: int
    allow_question: bool


class InterventionSelector:
    def select(
        self,
        safety: SafetyState,
        resolution: DomainResolution,
        estimate: StateEstimate,
    ) -> InterventionPlan:
        if safety == SafetyState.EMERGENCY:
            return InterventionPlan(
                primitive=InterventionPrimitive.CRISIS_LOCK,
                objective=InterventionObjective.HOLD_CRISIS,
                constraints=InterventionConstraints(maximum_actions=0, maximum_action_time_seconds=0),
                move=ConversationMove.CRISIS_HOLD,
                maximum_words=40,
                allow_question=False,
            )
        if safety == SafetyState.RED:
            return InterventionPlan(
                primitive=InterventionPrimitive.SAFETY_SIGNPOST,
                objective=InterventionObjective.SIGNPOST_SAFETY,
                constraints=InterventionConstraints(maximum_actions=0, maximum_action_time_seconds=0),
                move=ConversationMove.SAFETY_DIRECTIVE,
                maximum_words=40,
                allow_question=False,
            )
        if safety in (SafetyState.AMBER, SafetyState.AMBER_HIGH):
            return self._amber(resolution.primary, estimate.state)
        return self._green(resolution.primary, estimate.state)

    def _amber(self, domain: Domain, state: UserState) -> InterventionPlan:
        if domain == Domain.NEURO_EXEC_FUNCTION and state == UserState.TASK_INITIATION_BLOCK:
            return InterventionPlan(
                primitive=InterventionPrimitive.MICRO_ACTION,
                objective=InterventionObjective.REDUCE_INITIATION_THRESHOLD,
                constraints=InterventionConstraints(maximum_actions=1, maximum_action_time_seconds=5),
                move=ConversationMove.DIRECTIVE_MICRO_PROMPT,
                maximum_words=16,
                allow_question=False,
            )
        return InterventionPlan(
            primitive=InterventionPrimitive.GROUNDING,
            objective=InterventionObjective.REDUCE_AROUSAL,
            constraints=InterventionConstraints(maximum_actions=1, maximum_action_time_seconds=10),
            move=ConversationMove.GROUNDING_PROMPT,
            maximum_words=16,
            allow_question=False,
        )

    def _green(self, domain: Domain, state: UserState) -> InterventionPlan:
        if domain == Domain.NEURO_EXEC_FUNCTION:
            if state == UserState.WORKING_MEMORY_OVERLOAD:
                return InterventionPlan(
                    primitive=InterventionPrimitive.EXTERNALIZE_STEP,
                    objective=InterventionObjective.RESTORE_AGENCY,
                    constraints=InterventionConstraints(maximum_actions=1, maximum_action_time_seconds=10),
                    move=ConversationMove.DIRECTIVE_MICRO_PROMPT,
                    maximum_words=18,
                    allow_question=True,
                )
            return InterventionPlan(
                primitive=InterventionPrimitive.MICRO_ACTION,
                objective=InterventionObjective.REDUCE_INITIATION_THRESHOLD,
                constraints=InterventionConstraints(maximum_actions=1, maximum_action_time_seconds=5),
                move=ConversationMove.DIRECTIVE_MICRO_PROMPT,
                maximum_words=18,
                allow_question=True,
            )
        if domain == Domain.WORK_STRESS:
            if state == UserState.INTERPERSONAL_FRICTION:
                return InterventionPlan(
                    primitive=InterventionPrimitive.BOUNDARY_PROMPT,
                    objective=InterventionObjective.RESTORE_AGENCY,
                    constraints=InterventionConstraints(maximum_actions=1, maximum_action_time_seconds=15),
                    move=ConversationMove.PACING_PROMPT,
                    maximum_words=20,
                    allow_question=True,
                )
            return InterventionPlan(
                primitive=InterventionPrimitive.PACING,
                objective=InterventionObjective.HOLD_PACE,
                constraints=InterventionConstraints(maximum_actions=1, maximum_action_time_seconds=15),
                move=ConversationMove.PACING_PROMPT,
                maximum_words=20,
                allow_question=True,
            )
        if state == UserState.RUMINATION:
            return InterventionPlan(
                primitive=InterventionPrimitive.GROUNDING,
                objective=InterventionObjective.CONTAIN_AFFECT,
                constraints=InterventionConstraints(maximum_actions=1, maximum_action_time_seconds=15),
                move=ConversationMove.GROUNDING_PROMPT,
                maximum_words=20,
                allow_question=False,
            )
        return InterventionPlan(
            primitive=InterventionPrimitive.REFRAME,
            objective=InterventionObjective.CONTAIN_AFFECT,
            constraints=InterventionConstraints(maximum_actions=1, maximum_action_time_seconds=20),
            move=ConversationMove.REFLECTIVE_ACK,
            maximum_words=22,
            allow_question=True,
        )
