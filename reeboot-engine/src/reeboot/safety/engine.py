"""Four-tier safety engine with sticky de-escalation hysteresis.

Lexical matches emit signals. Hard EMERGENCY requires
self-reference + immediate intent + active threat.
RED/EMERGENCY remove generative authority in the kernel, not here.
"""

from __future__ import annotations

from dataclasses import dataclass, field

from reeboot.constants import (
    AMBER_RELEASE_CONFIDENCE,
    AMBER_RELEASE_TURNS,
    RED_RELEASE_CONFIDENCE,
)
from reeboot.safety.lexical import scan
from reeboot.schemas.enums import SafetySignal, SafetyState
from reeboot.session import Session


@dataclass(frozen=True)
class SafetyAssessment:
    state: SafetyState
    signals: frozenset[SafetySignal]
    risk_flags: tuple[str, ...]
    confidence: float
    escalation_indicators: bool
    positive_evidence: bool
    safety_oriented: bool
    notes: tuple[str, ...] = field(default_factory=tuple)


class SafetyEngine:
    """All-state evaluator. Bound to user-originating text only."""

    source = "USER_AUDIO_ONLY"

    def evaluate(self, user_text: str, session: Session) -> SafetyAssessment:
        signals = scan(user_text)
        proposed, confidence, notes = self._propose(signals)
        escalation = self._has_escalation(signals, proposed)
        positive = SafetySignal.POSITIVE_EVIDENCE in signals
        safety_oriented = SafetySignal.SAFETY_ORIENTED in signals

        session.last_escalation_indicators = escalation
        session.last_positive_evidence = positive
        session.last_safety_oriented = safety_oriented

        state = self._next_state(
            session=session,
            proposed=proposed,
            confidence=confidence,
            escalation=escalation,
            positive=positive,
            safety_oriented=safety_oriented,
        )

        session.safety_state = state
        flags = tuple(sorted(s.value for s in signals if s not in {
            SafetySignal.SELF_REFERENCE,
            SafetySignal.NEGATION,
            SafetySignal.POSITIVE_EVIDENCE,
        }))
        return SafetyAssessment(
            state=state,
            signals=frozenset(signals),
            risk_flags=flags,
            confidence=confidence,
            escalation_indicators=escalation,
            positive_evidence=positive,
            safety_oriented=safety_oriented,
            notes=notes,
        )

    def _propose(
        self, signals: set[SafetySignal]
    ) -> tuple[SafetyState, float, tuple[str, ...]]:
        negated = SafetySignal.NEGATION in signals
        self_ref = SafetySignal.SELF_REFERENCE in signals
        immediate = SafetySignal.IMMEDIATE_INTENT in signals
        threat = SafetySignal.ACTIVE_THREAT in signals
        passive = SafetySignal.PASSIVE_IDEATION in signals
        hopeless = SafetySignal.HOPELESSNESS in signals
        distress = SafetySignal.DISTRESS in signals
        lexical = SafetySignal.SELF_HARM_LEXICAL_MATCH in signals

        notes: list[str] = []

        if self_ref and immediate and threat and not negated:
            notes.append("hard-escalation: self-reference + immediate intent + active threat")
            return SafetyState.EMERGENCY, 0.99, tuple(notes)

        if lexical and not self_ref:
            notes.append("lexical signal without self-reference — not hard-escalated")
            if distress or hopeless:
                return SafetyState.AMBER, 0.7, tuple(notes)
            return SafetyState.GREEN, 0.65, tuple(notes)

        if negated and (lexical or threat or passive):
            notes.append("negated threat language — contained")
            return SafetyState.AMBER, 0.72, tuple(notes)

        if self_ref and (passive or (hopeless and lexical) or (threat and not immediate)):
            notes.append("self-referential ideation without full emergency triad")
            return SafetyState.RED, 0.9, tuple(notes)

        if hopeless and distress and self_ref:
            notes.append("high distress + hopelessness")
            return SafetyState.RED, 0.82, tuple(notes)

        if hopeless or (distress and self_ref):
            notes.append("threshold crossing on distress/hopelessness")
            return SafetyState.AMBER, 0.78, tuple(notes)

        if distress:
            notes.append("distress signal")
            return SafetyState.AMBER, 0.7, tuple(notes)

        return SafetyState.GREEN, 0.8, tuple(notes)

    def _has_escalation(self, signals: set[SafetySignal], proposed: SafetyState) -> bool:
        if proposed in (SafetyState.RED, SafetyState.EMERGENCY):
            return True
        hot = {
            SafetySignal.SELF_HARM_LEXICAL_MATCH,
            SafetySignal.PASSIVE_IDEATION,
            SafetySignal.HOPELESSNESS,
            SafetySignal.ACTIVE_THREAT,
        }
        if SafetySignal.IMMEDIATE_INTENT in signals and SafetySignal.ACTIVE_THREAT in signals:
            return True
        return bool(signals & hot)

    def _next_state(
        self,
        session: Session,
        proposed: SafetyState,
        confidence: float,
        escalation: bool,
        positive: bool,
        safety_oriented: bool,
    ) -> SafetyState:
        current = session.safety_state

        if session.emergency_locked or proposed == SafetyState.EMERGENCY:
            session.emergency_locked = True
            session.amber_clean_turns = 0
            return SafetyState.EMERGENCY

        if proposed == SafetyState.RED:
            session.red_checks_completed = True
            session.amber_clean_turns = 0
            return SafetyState.RED

        if current == SafetyState.RED:
            if self._can_release_red(session, confidence, escalation, safety_oriented):
                session.amber_clean_turns = 0
                return SafetyState.AMBER
            return SafetyState.RED

        if proposed == SafetyState.AMBER_HIGH:
            session.amber_clean_turns = 0
            return SafetyState.AMBER_HIGH

        if proposed == SafetyState.AMBER:
            session.amber_clean_turns = 0
            if current == SafetyState.AMBER_HIGH:
                return SafetyState.AMBER_HIGH
            return SafetyState.AMBER

        if current in (SafetyState.AMBER, SafetyState.AMBER_HIGH):
            if not escalation and positive:
                session.amber_clean_turns += 1
            else:
                session.amber_clean_turns = 0
            if (
                session.amber_clean_turns >= AMBER_RELEASE_TURNS
                and confidence >= AMBER_RELEASE_CONFIDENCE
            ):
                session.amber_clean_turns = 0
                return SafetyState.GREEN
            return current

        session.amber_clean_turns = 0
        return SafetyState.GREEN

    def _can_release_red(
        self,
        session: Session,
        confidence: float,
        escalation: bool,
        safety_oriented: bool,
    ) -> bool:
        return (
            session.red_checks_completed
            and not escalation
            and safety_oriented
            and confidence >= RED_RELEASE_CONFIDENCE
        )

    def _can_release_amber(
        self,
        session: Session,
        confidence: float,
        escalation: bool,
        positive: bool,
    ) -> bool:
        return (
            session.amber_clean_turns >= AMBER_RELEASE_TURNS
            and not escalation
            and confidence >= AMBER_RELEASE_CONFIDENCE
            and positive
        )
