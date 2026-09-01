from __future__ import annotations

import pytest

from reeboot.engine import ReebootEngine
from reeboot.schemas.enums import PolicyDecision, SafetyState
from reeboot.turn.fsm import TurnState


@pytest.mark.asyncio
async def test_amber_narrows_but_still_generates(engine: ReebootEngine) -> None:
    session = engine.new_session()
    result = await engine.process_text(
        session, "I'm completely overwhelmed and I can't cope"
    )
    assert result.safety_state == SafetyState.AMBER
    assert result.used_generation is True
    assert result.contract.policy.decision == PolicyDecision.NARROW
    assert session.fsm.state == TurnState.LISTENING


@pytest.mark.asyncio
async def test_amber_requires_window_before_green(engine: ReebootEngine) -> None:
    session = engine.new_session()
    first = await engine.process_text(session, "I'm completely overwhelmed")
    assert first.safety_state == SafetyState.AMBER
    second = await engine.process_text(session, "I feel better and this is manageable")
    assert second.safety_state == SafetyState.AMBER
    third = await engine.process_text(session, "I feel better and this is manageable")
    assert third.safety_state == SafetyState.AMBER
    fourth = await engine.process_text(session, "I feel better and this is manageable")
    assert fourth.safety_state == SafetyState.GREEN
