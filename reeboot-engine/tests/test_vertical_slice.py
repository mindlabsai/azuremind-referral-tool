from __future__ import annotations

import pytest

from reeboot.engine import ReebootEngine
from reeboot.schemas.enums import Domain, PolicyDecision, SafetyState, TurnState
from reeboot.telemetry.dev import format_telemetry


@pytest.mark.asyncio
async def test_text_vertical_slice_pipeline(engine: ReebootEngine) -> None:
    session = engine.new_session()
    assert session.fsm.state == TurnState.LISTENING
    result = await engine.process_text(
        session, "I can't start this assignment, my brain won't begin"
    )
    assert result.safety_state == SafetyState.GREEN
    assert result.contract.user_state.primary_domain == Domain.NEURO_EXEC_FUNCTION
    assert result.used_generation is True
    assert result.contract.policy.decision == PolicyDecision.ALLOW
    assert session.fsm.state == TurnState.LISTENING
    assert session.ephemeral_user_text is None
    blob = format_telemetry(result.telemetry)
    assert "safety" in blob
    assert "NEURO_EXEC_FUNCTION" in blob
    assert "MICRO_ACTION" in blob
    assert "ALLOW" in blob
    assert "$schema" in blob


@pytest.mark.asyncio
async def test_three_domains_in_one_session(engine: ReebootEngine) -> None:
    session = engine.new_session()
    neuro = await engine.process_text(session, "I can't start this, my brain won't begin")
    work = await engine.process_text(
        session, "I have a work deadline and my manager added a meeting"
    )
    mild = await engine.process_text(session, "I'm feeling a bit down after a rough day")
    assert neuro.contract.user_state.primary_domain == Domain.NEURO_EXEC_FUNCTION
    assert work.contract.user_state.primary_domain == Domain.WORK_STRESS
    assert mild.contract.user_state.primary_domain == Domain.MILD_DISTRESS
