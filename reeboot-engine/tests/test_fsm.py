from __future__ import annotations

import pytest

from reeboot.schemas.enums import Arousal, Domain, InterventionPrimitive, TurnEvent, TurnState
from reeboot.turn.fsm import InvalidTransitionError, TurnFSM, silence_threshold_ms


def test_happy_path_text_turn() -> None:
    fsm = TurnFSM()
    assert fsm.state == TurnState.IDLE
    fsm.apply(TurnEvent.SESSION_CONNECT)
    fsm.apply(TurnEvent.SPEECH_START)
    fsm.apply(TurnEvent.ENDPOINT_SILENCE)
    fsm.apply(TurnEvent.STATE_SAFETY_PASS)
    fsm.apply(TurnEvent.FIRST_TOKEN)
    fsm.apply(TurnEvent.TURN_COMPLETE)
    assert fsm.state == TurnState.LISTENING
    assert [s.value for _, _, s in fsm.history] == [
        "LISTENING",
        "USER_SPEAKING",
        "ENDPOINT_PENDING",
        "PROCESSING",
        "SPEAKING",
        "LISTENING",
    ]


def test_barge_in_then_user_spoke() -> None:
    fsm = TurnFSM()
    fsm.apply(TurnEvent.SESSION_CONNECT)
    fsm.apply(TurnEvent.SPEECH_START)
    fsm.apply(TurnEvent.ENDPOINT_SILENCE)
    fsm.apply(TurnEvent.STATE_SAFETY_PASS)
    fsm.apply(TurnEvent.FIRST_TOKEN)
    fsm.apply(TurnEvent.BARGE_IN)
    assert fsm.state == TurnState.INTERRUPTED
    fsm.apply(TurnEvent.USER_SPOKE)
    assert fsm.state == TurnState.USER_SPEAKING


def test_safety_mode_from_endpoint() -> None:
    fsm = TurnFSM()
    fsm.apply(TurnEvent.SESSION_CONNECT)
    fsm.apply(TurnEvent.SPEECH_START)
    fsm.apply(TurnEvent.ENDPOINT_SILENCE)
    fsm.apply(TurnEvent.SAFETY_TRIGGER)
    assert fsm.state == TurnState.SAFETY_MODE
    fsm.apply(TurnEvent.SPEECH_START)
    assert fsm.state == TurnState.USER_SPEAKING


def test_illegal_transition_rejected() -> None:
    fsm = TurnFSM()
    with pytest.raises(InvalidTransitionError):
        fsm.apply(TurnEvent.FIRST_TOKEN)


def test_cannot_skip_processing() -> None:
    fsm = TurnFSM()
    fsm.apply(TurnEvent.SESSION_CONNECT)
    with pytest.raises(InvalidTransitionError):
        fsm.apply(TurnEvent.TURN_COMPLETE)


def test_silence_threshold_bounds() -> None:
    assert silence_threshold_ms(
        Domain.NEURO_EXEC_FUNCTION, Arousal.LOW, InterventionPrimitive.MICRO_ACTION
    ) == 250
    assert silence_threshold_ms(
        Domain.NEURO_EXEC_FUNCTION, Arousal.HIGH, InterventionPrimitive.MICRO_ACTION
    ) == 1200
    assert silence_threshold_ms(
        Domain.MILD_DISTRESS, Arousal.LOW, InterventionPrimitive.REFRAME
    ) == 1500
    fsm = TurnFSM()
    with pytest.raises(ValueError):
        fsm.set_silence_threshold(200)
