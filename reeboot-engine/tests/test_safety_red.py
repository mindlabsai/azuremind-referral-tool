from __future__ import annotations

import pytest

from reeboot.constants import DETERMINISTIC_RED_RESPONSE
from reeboot.engine import ReebootEngine
from reeboot.providers.mock import ExplodingGenerationProvider
from reeboot.schemas.enums import PolicyDecision, SafetyState
from reeboot.turn.fsm import TurnState


@pytest.mark.asyncio
async def test_red_takeover_blocks_generation(
    exploding_engine: ReebootEngine,
) -> None:
    session = exploding_engine.new_session()
    result = await exploding_engine.process_text(
        session, "I wish I were dead and I can't see a way through this"
    )
    assert result.safety_state == SafetyState.RED
    assert result.used_generation is False
    assert result.response == DETERMINISTIC_RED_RESPONSE
    assert result.contract.policy.decision == PolicyDecision.BLOCK_GENERATIVE
    assert result.contract.generation_allowed() is False
    assert session.fsm.state == TurnState.SAFETY_MODE


@pytest.mark.asyncio
async def test_red_cannot_jump_to_green(engine: ReebootEngine) -> None:
    session = engine.new_session()
    red = await engine.process_text(
        session, "I wish I were dead and I can't see a way through this"
    )
    assert red.safety_state == SafetyState.RED
    attempt = await engine.process_text(session, "I feel better and this is manageable")
    assert attempt.safety_state != SafetyState.GREEN
    assert attempt.safety_state in (SafetyState.RED, SafetyState.AMBER)


@pytest.mark.asyncio
async def test_red_releases_only_to_amber(engine: ReebootEngine) -> None:
    session = engine.new_session()
    await engine.process_text(
        session, "I wish I were dead and I can't see a way through this"
    )
    released = await engine.process_text(session, "I am safe and I will wait here")
    assert released.safety_state == SafetyState.AMBER
    assert released.used_generation is True
    assert released.safety_state != SafetyState.GREEN
