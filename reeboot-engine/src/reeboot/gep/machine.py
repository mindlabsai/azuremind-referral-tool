"""Guided Exploration Pathway — SAFETY_CLARIFY_AND_NARROW."""

from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum

from reeboot.constants import (
    GEP_ACKNOWLEDGE,
    GEP_AMBIENT_RESOURCES,
    GEP_DISCLOSURE_BRIDGE,
    GEP_FOLLOWUP,
    GEP_MAX_QUESTIONS,
    GEP_MINOR_BLOCK,
    GEP_PROFESSIONAL_BRIDGE,
    GEP_Q_CONNECTION,
    GEP_Q_DURATION,
    GEP_Q_HISTORY,
    GEP_Q_PERVASIVENESS,
    GEP_Q_TETHER,
    GEP_RETRACTION,
    GEP_TETHER_EMPTY,
)
from reeboot.gep.slots import (
    Connection,
    Duration,
    GepSlots,
    History,
    Pervasiveness,
    SafetyGate,
    is_retraction,
    is_tether_empty,
)
from reeboot.plan import SafetyPlan
from reeboot.schemas.enums import SafetyState, SupportState
from reeboot.safety.features import extract_features
from reeboot.session import Session


class GepStage(str, Enum):
    INACTIVE = "INACTIVE"
    ACKNOWLEDGE = "ACKNOWLEDGE"
    Q_DURATION = "Q_DURATION"
    Q_PERVASIVENESS = "Q_PERVASIVENESS"
    Q_CONNECTION = "Q_CONNECTION"
    Q_HISTORY = "Q_HISTORY"
    Q_TETHER = "Q_TETHER"
    RESOLVE = "RESOLVE"
    INTERVENE = "INTERVENE"
    CLOSE = "CLOSE"
    PARKED = "PARKED"
    BLOCKED_MINOR = "BLOCKED_MINOR"


QUESTION_COPY = {
    GepStage.Q_DURATION: GEP_Q_DURATION,
    GepStage.Q_PERVASIVENESS: GEP_Q_PERVASIVENESS,
    GepStage.Q_CONNECTION: GEP_Q_CONNECTION,
    GepStage.Q_HISTORY: GEP_Q_HISTORY,
    GepStage.Q_TETHER: GEP_Q_TETHER,
}


@dataclass
class GepRuntime:
    stage: GepStage = GepStage.INACTIVE
    questions_asked: int = 0
    slots: GepSlots = field(default_factory=GepSlots)
    score: int = 0
    isolation_flag: bool = False
    tether_empty: bool = False
    pathway: str = ""
    parked: bool = False
    retraction: bool = False
    waiting_for: GepStage | None = None


@dataclass(frozen=True)
class GepTurn:
    response: str | None
    used_script: bool = True
    blocked_minor: bool = False


class GepEngine:
    def step(self, session: Session, user_text: str) -> GepTurn | None:
        if session.identified_minor:
            if session.safety_state == SafetyState.AMBER and (
                session.gep is None or session.gep.stage == GepStage.INACTIVE
            ):
                if session.gep is None:
                    session.gep = GepRuntime(stage=GepStage.BLOCKED_MINOR)
                else:
                    session.gep.stage = GepStage.BLOCKED_MINOR
                return GepTurn(response=GEP_MINOR_BLOCK, blocked_minor=True)
            return None

        if session.gep_completed:
            return None

        if session.gep and session.gep.stage in {GepStage.CLOSE, GepStage.PARKED, GepStage.BLOCKED_MINOR}:
            return None

        if session.safety_state in {SafetyState.RED, SafetyState.EMERGENCY}:
            if session.gep and session.gep.stage not in {GepStage.INACTIVE, GepStage.CLOSE}:
                session.gep.stage = GepStage.PARKED
                session.gep.parked = True
            return None

        if session.safety_state not in {SafetyState.AMBER, SafetyState.AMBER_HIGH} and (
            session.gep is None or session.gep.stage == GepStage.INACTIVE
        ):
            return None

        if session.gep is None or session.gep.stage == GepStage.INACTIVE:
            return self._start(session, user_text)

        return self._continue(session, user_text)

    def _start(self, session: Session, user_text: str) -> GepTurn:
        runtime = GepRuntime(stage=GepStage.ACKNOWLEDGE)
        runtime.slots.prefill_from_text(user_text)
        if session.history_flag and runtime.slots.history is None:
            runtime.slots.history = History.ATTEMPT
        session.gep = runtime
        runtime.waiting_for = None
        return GepTurn(response=GEP_ACKNOWLEDGE)

    def _continue(self, session: Session, user_text: str) -> GepTurn:
        runtime = session.gep
        assert runtime is not None
        features = extract_features(user_text)
        runtime.slots.prefill_from_text(user_text)
        gate = runtime.slots.safety_gate
        if gate != SafetyGate.CLEAR:
            runtime.stage = GepStage.PARKED
            runtime.parked = True
            if gate in {SafetyGate.CURRENT_ACTION, SafetyGate.MEANS_SIGNAL}:
                session.safety_state = SafetyState.EMERGENCY
            else:
                session.safety_state = SafetyState.RED
            return GepTurn(response=None)

        if is_retraction(user_text):
            runtime.retraction = True
            session.continuity.mark_retraction()
            self._score_and_apply(session, conservative=True)
            runtime.stage = GepStage.CLOSE
            session.gep_completed = True
            return GepTurn(response=GEP_RETRACTION)

        if runtime.stage == GepStage.ACKNOWLEDGE:
            nxt = self._next_question(runtime, session)
            if nxt in QUESTION_COPY:
                runtime.stage = nxt
                runtime.waiting_for = nxt
                runtime.questions_asked += 1
                return GepTurn(response=QUESTION_COPY[nxt])
            return self._resolve_and_intervene(session)

        waiting = runtime.waiting_for
        if waiting == GepStage.Q_TETHER:
            if is_tether_empty(user_text):
                runtime.tether_empty = True
                runtime.slots.tethers = []
            else:
                runtime.slots.tethers = [user_text.strip()]
            runtime.waiting_for = None
            return self._resolve_and_intervene(session)

        if waiting == GepStage.Q_DURATION and runtime.slots.duration is None:
            runtime.slots.duration = Duration.CHRONIC_UNCLEAR
        if waiting == GepStage.Q_PERVASIVENESS and runtime.slots.pervasiveness is None:
            runtime.slots.pervasiveness = Pervasiveness.MOST_DAYS
        if waiting == GepStage.Q_CONNECTION and runtime.slots.connection is None:
            runtime.slots.connection = Connection.NOBODY_KNOWS
        if waiting == GepStage.Q_HISTORY and runtime.slots.history is None:
            features = extract_features(user_text)
            if features.self_harm_disclosure or "attempt" in user_text.lower() or "came close" in user_text.lower():
                runtime.slots.history = History.ATTEMPT if "attempt" in user_text.lower() else History.SELF_HARM
            elif any(w in user_text.lower() for w in ("yes", "yeah", "i have", "i did")):
                runtime.slots.history = History.SELF_HARM
            else:
                runtime.slots.history = History.NONE

        if runtime.questions_asked >= GEP_MAX_QUESTIONS:
            return self._resolve_and_intervene(session)

        nxt = self._next_question(runtime, session)
        if nxt in QUESTION_COPY:
            runtime.stage = nxt
            runtime.waiting_for = nxt
            runtime.questions_asked += 1
            return GepTurn(response=QUESTION_COPY[nxt])
        return self._resolve_and_intervene(session)

    def _next_question(self, runtime: GepRuntime, session: Session) -> GepStage:
        slots = runtime.slots
        if slots.duration is None:
            return GepStage.Q_DURATION
        if slots.pervasiveness is None and slots.duration in {Duration.CHRONIC_UNCLEAR}:
            return GepStage.Q_PERVASIVENESS
        if slots.connection is None:
            return GepStage.Q_CONNECTION
        if slots.history is None and not session.history_flag:
            return GepStage.Q_HISTORY
        if not slots.tethers and not runtime.tether_empty:
            return GepStage.Q_TETHER
        return GepStage.RESOLVE

    def _resolve_and_intervene(self, session: Session) -> GepTurn:
        runtime = session.gep
        assert runtime is not None
        self._score_and_apply(session, conservative=True)
        runtime.stage = GepStage.INTERVENE
        parts: list[str] = []
        if runtime.tether_empty:
            parts.append(GEP_TETHER_EMPTY)
        elif runtime.slots.tethers:
            quoted = runtime.slots.tethers[0]
            parts.append(
                f"You said the thing that's kept you going is {quoted}. "
                "I want you to notice that you knew the answer."
            )
        if runtime.isolation_flag:
            parts.append(GEP_DISCLOSURE_BRIDGE)
        parts.append(GEP_PROFESSIONAL_BRIDGE)
        parts.append(GEP_AMBIENT_RESOURCES)
        parts.append(GEP_FOLLOWUP)
        _write_safety_plan(session)
        session.continuity.schedule(session.safety_state, session.history_flag)
        runtime.stage = GepStage.CLOSE
        session.gep_completed = True
        runtime.pathway = session.last_pathway or runtime.pathway
        return GepTurn(response=" ".join(parts))

    def _score_and_apply(self, session: Session, conservative: bool) -> None:
        runtime = session.gep
        assert runtime is not None
        slots = runtime.slots
        if conservative:
            if slots.duration is None:
                slots.duration = Duration.CHRONIC_UNCLEAR
            if slots.connection is None:
                slots.connection = Connection.NOBODY_KNOWS

        score = 0
        if slots.duration in {Duration.GT_6WK, Duration.CHRONIC_UNCLEAR}:
            score += 2
        elif slots.duration == Duration.WK_2_6:
            score += 1
        if slots.pervasiveness in {Pervasiveness.MOST_DAYS, Pervasiveness.CONSTANT}:
            score += 1
        if slots.connection == Connection.NOBODY_KNOWS:
            score += 2
            runtime.isolation_flag = True
            session.isolation_flag = True
        elif slots.connection == Connection.SOMEONE_KNOWS:
            score += 1
        if runtime.tether_empty:
            score += 1

        history_positive = session.history_flag or (
            slots.history is not None and slots.history != History.NONE
        )
        if history_positive:
            session.history_flag = True

        runtime.score = score
        support, safety, pathway = resolve_matrix(
            score=score,
            isolation=runtime.isolation_flag,
            history=session.history_flag,
            tether_empty=runtime.tether_empty,
        )
        session.support_state = support
        session.safety_state = safety
        session.last_pathway = pathway
        runtime.pathway = pathway


def resolve_matrix(
    score: int,
    isolation: bool,
    history: bool,
    tether_empty: bool,
) -> tuple[SupportState, SafetyState, str]:
    if tether_empty and isolation and history:
        return SupportState.SEVERE_PENDING, SafetyState.RED, "DETERMINISTIC_SAFETY_PATH"
    if history:
        return SupportState.MODERATE_HIGH, SafetyState.AMBER_HIGH, "SAFETY_CLARIFY_AND_NARROW"
    if isolation and score >= 2:
        return SupportState.MODERATE_HIGH, SafetyState.AMBER_HIGH, "SAFETY_CLARIFY_AND_NARROW"
    if score >= 2:
        return SupportState.MODERATE, SafetyState.AMBER, "SAFETY_CLARIFY_AND_NARROW"
    return SupportState.MILD_TO_MODERATE, SafetyState.AMBER, "SAFETY_CLARIFY_AND_NARROW"


def _write_safety_plan(session: Session) -> None:
    runtime = session.gep
    if runtime is None:
        return
    plan = session.safety_plan or SafetyPlan()
    if session.ephemeral_user_text:
        plan.warning_signs.append(session.ephemeral_user_text)
    plan.tethers_verbatim = list(runtime.slots.tethers)
    if runtime.slots.connection == Connection.SOMEONE_KNOWS:
        plan.people_i_can_tell.append("someone who already knows")
    session.safety_plan = plan
