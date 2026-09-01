"""In-memory session. No durable persistence when retention is false."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any
from uuid import uuid4

from reeboot.continuity import ContinuityRecord
from reeboot.plan import SafetyPlan
from reeboot.schemas.contract import ConsentBlock
from reeboot.schemas.enums import Domain, SafetyState, SessionMode, SupportState
from reeboot.turn.fsm import TurnFSM


def _new_session_id() -> str:
    return f"sess_{uuid4().hex[:8]}"


@dataclass
class Session:
    session_id: str = field(default_factory=_new_session_id)
    mode: SessionMode = SessionMode.TEXT
    fsm: TurnFSM = field(default_factory=TurnFSM)
    safety_state: SafetyState = SafetyState.GREEN
    support_state: SupportState = SupportState.UNRESOLVED
    identified_minor: bool = False
    history_flag: bool = False
    isolation_flag: bool = False
    gep: Any | None = None
    gep_completed: bool = False
    safety_plan: SafetyPlan | None = None
    continuity: ContinuityRecord = field(default_factory=ContinuityRecord)
    emergency_locked: bool = False
    red_checks_completed: bool = False
    amber_clean_turns: int = 0
    turn_index: int = 0
    consent: ConsentBlock = field(default_factory=ConsentBlock)
    last_primary_domain: Domain | None = None
    ephemeral_user_text: str | None = None
    last_positive_evidence: bool = False
    last_safety_oriented: bool = False
    last_escalation_indicators: bool = False
    last_pathway: str | None = None
    last_features: list[str] | None = None

    def next_turn_id(self) -> str:
        self.turn_index += 1
        return f"turn_{self.turn_index:05d}"

    def clear_ephemeral(self) -> None:
        """Dereference user text at turn completion (retention=false)."""
        self.ephemeral_user_text = None
