"""Layer-1 contextual safety backend.

Sits beside the frozen Layer 0 SafetyEngine. Selected by REEBOOT_SAFETY_BACKEND=structured.
Reuses baseline hysteresis so RED→GREEN remains prohibited and EMERGENCY stays session-locked.
"""

from __future__ import annotations

from reeboot.safety.decision_table import Decision, apply_decision_table
from reeboot.safety.engine import SafetyAssessment, SafetyEngine
from reeboot.safety.features import extract_features
from reeboot.safety.utterance import parse_utterance
from reeboot.schemas.enums import SafetySignal, SafetyState, SupportState
from reeboot.session import Session

DECISION_TABLE_VERSION = "1.2.0"


class ContextualSafetyEngine:
    """Structured feature extractor + decision table. Does not edit Layer 0 rules."""

    source = "USER_AUDIO_ONLY"

    def __init__(self) -> None:
        self._hysteresis = SafetyEngine()

    def evaluate(self, user_text: str, session: Session) -> SafetyAssessment:
        features = extract_features(user_text)
        utterance = parse_utterance(user_text, features)
        decision = apply_decision_table(features, utterance)
        escalation = decision.state in {SafetyState.RED, SafetyState.EMERGENCY}
        state = self._hysteresis._next_state(
            session=session,
            proposed=decision.state,
            confidence=0.9 if decision.state != SafetyState.GREEN else 0.8,
            escalation=escalation,
            positive=False,
            safety_oriented=False,
        )
        session.safety_state = state
        if (
            session.support_state == SupportState.UNRESOLVED
            and features.severity_moderate
            and state in {SafetyState.AMBER, SafetyState.AMBER_HIGH}
        ):
            session.support_state = features.support_hint
        session.last_pathway = _pathway_for_state(state, decision)
        session.last_features = features.as_signals() + utterance.as_signals()
        session.last_escalation_indicators = escalation

        flags = tuple(features.as_signals() + utterance.as_signals())
        return SafetyAssessment(
            state=state,
            signals=frozenset(_signals_from_features(features, decision)),
            risk_flags=flags,
            confidence=0.9 if state != SafetyState.GREEN else 0.8,
            escalation_indicators=escalation,
            positive_evidence=False,
            safety_oriented=False,
            notes=decision.reasons + (f"rule:{decision.rule_id}", f"pathway:{session.last_pathway}"),
        )


def _pathway_for_state(state: SafetyState, decision: Decision) -> str:
    if state == SafetyState.EMERGENCY:
        return decision.pathway
    if state == SafetyState.RED:
        return "DETERMINISTIC_SAFETY_PATH"
    if state in {SafetyState.AMBER, SafetyState.AMBER_HIGH}:
        return "SAFETY_CLARIFY_AND_NARROW"
    return "STANDARD_SUPPORT"


def _signals_from_features(features, decision: Decision) -> set[SafetySignal]:
    out: set[SafetySignal] = set()
    if features.ideation.value == "PASSIVE":
        out.add(SafetySignal.PASSIVE_IDEATION)
    if features.ideation.value == "ACTIVE":
        out.add(SafetySignal.SELF_HARM_LEXICAL_MATCH)
    if features.intent.value != "NONE":
        out.add(SafetySignal.IMMEDIATE_INTENT)
    if features.subject.value == "SELF":
        out.add(SafetySignal.SELF_REFERENCE)
    if decision.state == SafetyState.EMERGENCY:
        out.add(SafetySignal.ACTIVE_THREAT)
    return out
