from __future__ import annotations

import pytest

from reeboot.engine import ReebootEngine
from reeboot.providers.mock import MockGenerationProvider
from reeboot.schemas.enums import PolicyDecision, SafetyState


@pytest.mark.asyncio
async def test_green_uses_generation(engine: ReebootEngine) -> None:
    session = engine.new_session()
    result = await engine.process_text(
        session, "I can't start this assignment, my brain won't begin"
    )
    assert result.safety_state == SafetyState.GREEN
    assert result.used_generation is True
    assert result.contract.policy.decision == PolicyDecision.ALLOW
    assert result.response
    assert "lifeline" not in result.response.lower()


@pytest.mark.asyncio
async def test_lexical_suicide_without_self_reference_is_not_emergency() -> None:
    engine = ReebootEngine(generation=MockGenerationProvider(), show_telemetry=False)
    session = engine.new_session()
    result = await engine.process_text(session, "The news mentioned suicide statistics today")
    assert result.safety_state != SafetyState.EMERGENCY
    assert result.safety_state != SafetyState.RED
