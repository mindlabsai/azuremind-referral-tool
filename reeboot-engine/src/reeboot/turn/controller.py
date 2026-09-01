"""Dynamic Turn Controller — drives the FSM for a text or voice turn."""

from __future__ import annotations

from typing import TYPE_CHECKING

from reeboot.schemas.enums import SafetyState, TurnEvent, TurnState
from reeboot.turn.fsm import InvalidTransitionError, TurnFSM

if TYPE_CHECKING:
    from reeboot.session import Session


class TurnController:
    """Owns turn sequencing. Does not select interventions or generate language."""

    def attach(self, session: Session) -> TurnFSM:
        return session.fsm

    def begin_session(self, session: Session) -> None:
        if session.fsm.state == TurnState.IDLE:
            session.fsm.apply(TurnEvent.SESSION_CONNECT)

    def ingest_user_text(self, session: Session) -> None:
        """Advance to ENDPOINT_PENDING as if VAD endpointed a text utterance."""
        self.begin_session(session)
        if session.fsm.state == TurnState.SPEAKING:
            session.fsm.apply(TurnEvent.TURN_COMPLETE)
        if session.fsm.state == TurnState.SAFETY_MODE:
            session.fsm.apply(TurnEvent.SPEECH_START)
        elif session.fsm.state == TurnState.LISTENING:
            session.fsm.apply(TurnEvent.SPEECH_START)
        elif session.fsm.state == TurnState.INTERRUPTED:
            session.fsm.apply(TurnEvent.USER_SPOKE)
        if session.fsm.state != TurnState.USER_SPEAKING:
            raise InvalidTransitionError(
                f"Expected USER_SPEAKING before endpoint, got {session.fsm.state}"
            )
        session.fsm.apply(TurnEvent.ENDPOINT_SILENCE)

    def pass_to_processing(self, session: Session) -> None:
        session.fsm.apply(TurnEvent.STATE_SAFETY_PASS)

    def enter_safety_mode(self, session: Session) -> None:
        if session.fsm.state != TurnState.SAFETY_MODE:
            session.fsm.apply(TurnEvent.SAFETY_TRIGGER)

    def begin_speaking(self, session: Session) -> None:
        session.fsm.apply(TurnEvent.FIRST_TOKEN)

    def complete_turn(self, session: Session, safety: SafetyState) -> None:
        if safety in (SafetyState.RED, SafetyState.EMERGENCY):
            if session.fsm.state != TurnState.SAFETY_MODE:
                self.enter_safety_mode(session)
            return
        if session.fsm.state == TurnState.PROCESSING:
            session.fsm.apply(TurnEvent.FIRST_TOKEN)
        if session.fsm.state == TurnState.SPEAKING:
            session.fsm.apply(TurnEvent.TURN_COMPLETE)
        if session.fsm.state == TurnState.SAFETY_MODE and safety in (
            SafetyState.GREEN,
            SafetyState.AMBER,
        ):
            session.fsm.apply(TurnEvent.SAFETY_RELEASE)

    def barge_in(self, session: Session) -> None:
        session.fsm.apply(TurnEvent.BARGE_IN)
