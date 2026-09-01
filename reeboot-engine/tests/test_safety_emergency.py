from __future__ import annotations

import pytest

from reeboot.constants import DETERMINISTIC_EMERGENCY_RESPONSE
from reeboot.engine import ReebootEngine
from reeboot.providers.mock import ExplodingGenerationProvider
from reeboot.schemas.enums import PolicyDecision, SafetyState
from reeboot.turn.fsm import TurnState


@pytest.mark.asyncio
async def test_emergency_takeover_blocks_generation() -> None:
    engine = ReebootEngine(generation=ExplodingGenerationProvider(), show_telemetry=False)
    session = engine.new_session()
    result = await engine.process_text(session, "I am going to kill myself tonight")
    assert result.safety_state == SafetyState.EMERGENCY
    assert result.used_generation is False
    assert result.response == DETERMINISTIC_EMERGENCY_RESPONSE
    assert result.contract.policy.decision == PolicyDecision.BLOCK_GENERATIVE
    assert session.emergency_locked is True
    assert session.fsm.state == TurnState.SAFETY_MODE


@pytest.mark.asyncio
async def test_emergency_is_session_locked() -> None:
    engine = ReebootEngine(generation=ExplodingGenerationProvider(), show_telemetry=False)
    session = engine.new_session()
    await engine.process_text(session, "I am going to kill myself tonight")
    follow = await engine.process_text(session, "Actually I feel better and this is manageable")
    assert follow.safety_state == SafetyState.EMERGENCY
    assert follow.used_generation is False
    assert follow.response == DETERMINISTIC_EMERGENCY_RESPONSE
