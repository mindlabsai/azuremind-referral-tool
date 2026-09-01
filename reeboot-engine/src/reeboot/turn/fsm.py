"""Deterministic turn-controller FSM.

Transitions are exhaustive and explicit. No implicit jumps.
"""

from __future__ import annotations

from dataclasses import dataclass, field

from reeboot.schemas.enums import Arousal, Domain, InterventionPrimitive, TurnEvent, TurnState


class InvalidTransitionError(ValueError):
    """Raised when an event is illegal in the current FSM state."""


TRANSITIONS: dict[tuple[TurnState, TurnEvent], TurnState] = {
    (TurnState.IDLE, TurnEvent.SESSION_CONNECT): TurnState.LISTENING,
    (TurnState.LISTENING, TurnEvent.SPEECH_START): TurnState.USER_SPEAKING,
    (TurnState.LISTENING, TurnEvent.SAFETY_TRIGGER): TurnState.SAFETY_MODE,
    (TurnState.USER_SPEAKING, TurnEvent.ENDPOINT_SILENCE): TurnState.ENDPOINT_PENDING,
    (TurnState.USER_SPEAKING, TurnEvent.SAFETY_TRIGGER): TurnState.SAFETY_MODE,
    (TurnState.ENDPOINT_PENDING, TurnEvent.STATE_SAFETY_PASS): TurnState.PROCESSING,
    (TurnState.ENDPOINT_PENDING, TurnEvent.SAFETY_TRIGGER): TurnState.SAFETY_MODE,
    (TurnState.PROCESSING, TurnEvent.FIRST_TOKEN): TurnState.SPEAKING,
    (TurnState.PROCESSING, TurnEvent.SAFETY_TRIGGER): TurnState.SAFETY_MODE,
    (TurnState.SPEAKING, TurnEvent.TURN_COMPLETE): TurnState.LISTENING,
    (TurnState.SPEAKING, TurnEvent.BARGE_IN): TurnState.INTERRUPTED,
    (TurnState.SPEAKING, TurnEvent.SAFETY_TRIGGER): TurnState.SAFETY_MODE,
    (TurnState.INTERRUPTED, TurnEvent.USER_SPOKE): TurnState.USER_SPEAKING,
    (TurnState.INTERRUPTED, TurnEvent.SAFETY_TRIGGER): TurnState.SAFETY_MODE,
    (TurnState.SAFETY_MODE, TurnEvent.SPEECH_START): TurnState.USER_SPEAKING,
    (TurnState.SAFETY_MODE, TurnEvent.SAFETY_HOLD): TurnState.SAFETY_MODE,
    (TurnState.SAFETY_MODE, TurnEvent.SAFETY_RELEASE): TurnState.LISTENING,
}


def silence_threshold_ms(
    domain: Domain,
    arousal: Arousal,
    primitive: InterventionPrimitive,
) -> int:
    """Inject adaptive VAD silence (250ms micro-action … 1500ms emotional)."""
    if arousal == Arousal.HIGH:
        return 1200
    if primitive == InterventionPrimitive.MICRO_ACTION:
        return 250
    if domain == Domain.MILD_DISTRESS:
        return 1500
    return 800


@dataclass
class TurnFSM:
    state: TurnState = TurnState.IDLE
    silence_threshold_ms: int = 800
    history: list[tuple[TurnState, TurnEvent, TurnState]] = field(default_factory=list)

    def apply(self, event: TurnEvent | str) -> TurnState:
        event = TurnEvent(event)
        key = (self.state, event)
        if key not in TRANSITIONS:
            raise InvalidTransitionError(
                f"Illegal transition: {self.state.value} --{event.value}-->"
            )
        nxt = TRANSITIONS[key]
        self.history.append((self.state, event, nxt))
        self.state = nxt
        return self.state

    def can(self, event: TurnEvent | str) -> bool:
        return (self.state, TurnEvent(event)) in TRANSITIONS

    def set_silence_threshold(self, ms: int) -> None:
        if ms < 250 or ms > 1500:
            raise ValueError("endpoint silence threshold must be 250–1500ms")
        self.silence_threshold_ms = ms
