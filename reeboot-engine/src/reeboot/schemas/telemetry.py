"""Development-only telemetry and turn result types."""

from __future__ import annotations

from pydantic import BaseModel, ConfigDict

from reeboot.schemas.contract import RuntimeContract
from reeboot.schemas.enums import (
    ConversationMove,
    Domain,
    InterventionPrimitive,
    PolicyDecision,
    SafetyState,
    SupportState,
    TurnState,
    UserState,
)


class DevTelemetry(BaseModel):
    model_config = ConfigDict(frozen=True)

    safety_state: SafetyState
    support_state: SupportState = SupportState.UNRESOLVED
    gep_stage: str | None = None
    safety_plan_present: bool = False
    domain: Domain
    state: UserState
    intervention_primitive: InterventionPrimitive
    policy_decision: PolicyDecision
    conversation_move: ConversationMove
    fsm_state: TurnState
    processing_latency_ms: float
    used_generation: bool
    contract: RuntimeContract


class TurnResult(BaseModel):
    model_config = ConfigDict(frozen=True)

    response: str
    used_generation: bool
    telemetry: DevTelemetry

    @property
    def contract(self) -> RuntimeContract:
        return self.telemetry.contract

    @property
    def safety_state(self) -> SafetyState:
        return self.telemetry.safety_state
