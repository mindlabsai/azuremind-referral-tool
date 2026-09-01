from __future__ import annotations

import pytest

from reeboot.constants import GEP_ACKNOWLEDGE, GEP_Q_DURATION, GEP_Q_TETHER
from reeboot.engine import ReebootEngine
from reeboot.gep.machine import resolve_matrix
from reeboot.schemas.enums import SafetyState, SupportState


def _engine() -> ReebootEngine:
    return ReebootEngine(show_telemetry=False, safety_backend="structured")


@pytest.mark.asyncio
async def test_acknowledge_has_no_question() -> None:
    engine = _engine()
    session = engine.new_session()
    result = await engine.process_text(session, "I just wish I wasn't around, things are too hard")
    assert result.safety_state == SafetyState.AMBER
    assert result.response == GEP_ACKNOWLEDGE
    assert "?" not in result.response
    assert result.used_generation is False
    assert session.gep is not None
    assert session.gep.stage.value == "ACKNOWLEDGE"


@pytest.mark.asyncio
async def test_prefill_skips_filled_slots() -> None:
    engine = _engine()
    session = engine.new_session()
    await engine.process_text(session, "I wish I weren't here")
    result = await engine.process_text(
        session, "I've felt like this since Easter and nobody knows"
    )
    assert GEP_Q_DURATION not in result.response
    assert session.gep is not None
    assert session.gep.slots.duration is not None
    assert session.gep.slots.connection is not None


@pytest.mark.asyncio
async def test_tether_wording_is_frozen() -> None:
    engine = _engine()
    session = engine.new_session()
    await engine.process_text(session, "I wish I were dead")
    await engine.process_text(session, "since Easter and nobody knows")
    # history unknown — may ask history first
    text = ""
    for _ in range(4):
        nxt = await engine.process_text(session, "just thoughts, never gone further")
        text = nxt.response
        if GEP_Q_TETHER in text:
            break
    assert text == GEP_Q_TETHER


@pytest.mark.asyncio
async def test_retraction_holds_followup() -> None:
    engine = _engine()
    session = engine.new_session()
    await engine.process_text(session, "I wish I were dead")
    result = await engine.process_text(session, "forget it I'm fine")
    assert "still stands" in result.response
    assert session.continuity.retraction_held is True
    assert session.continuity.followup_scheduled is True
    assert session.safety_state != SafetyState.GREEN


@pytest.mark.asyncio
async def test_mid_gep_emergency_aborts_same_turn() -> None:
    engine = _engine()
    session = engine.new_session()
    await engine.process_text(session, "I wish I were dead")
    result = await engine.process_text(session, "I am going to kill myself tonight")
    assert result.safety_state == SafetyState.EMERGENCY
    assert result.used_generation is False
    assert session.gep is not None
    assert session.gep.parked is True


@pytest.mark.asyncio
async def test_history_lifts_to_amber_high() -> None:
    engine = _engine()
    session = engine.new_session()
    session.history_flag = True
    await engine.process_text(session, "I wish I were dead")
    await engine.process_text(session, "for months and nobody knows")
    result = await engine.process_text(session, "my daughter and the dog")
    if GEP_Q_TETHER == result.response:
        result = await engine.process_text(session, "my daughter and the dog")
    assert session.safety_state == SafetyState.AMBER_HIGH
    assert session.support_state == SupportState.MODERATE_HIGH


@pytest.mark.asyncio
async def test_identified_minor_blocks_gep() -> None:
    engine = _engine()
    session = engine.new_session()
    session.identified_minor = True
    result = await engine.process_text(session, "I wish I were dead")
    assert "under 18" in result.response
    assert session.gep is not None
    assert session.gep.stage.value == "BLOCKED_MINOR"


def test_resolution_matrix_spec() -> None:
    mild, amber, _ = resolve_matrix(score=1, isolation=False, history=False, tether_empty=False)
    assert mild == SupportState.MILD_TO_MODERATE
    assert amber == SafetyState.AMBER
    mod, _, _ = resolve_matrix(score=2, isolation=False, history=False, tether_empty=False)
    assert mod == SupportState.MODERATE
    high, ah, _ = resolve_matrix(score=4, isolation=True, history=False, tether_empty=False)
    assert high == SupportState.MODERATE_HIGH
    assert ah == SafetyState.AMBER_HIGH
    hist, floor, _ = resolve_matrix(score=1, isolation=False, history=True, tether_empty=False)
    assert hist == SupportState.MODERATE_HIGH
    assert floor == SafetyState.AMBER_HIGH
    sev, red, _ = resolve_matrix(score=5, isolation=True, history=True, tether_empty=True)
    assert sev == SupportState.SEVERE_PENDING
    assert red == SafetyState.RED


@pytest.mark.asyncio
async def test_functional_collapse_without_death_words_opens_look_closer() -> None:
    engine = _engine()
    session = engine.new_session()
    result = await engine.process_text(
        session, "I lost three jobs this year and I can't keep anything together"
    )
    assert result.safety_state == SafetyState.AMBER
    assert result.response == GEP_ACKNOWLEDGE
    assert session.support_state == SupportState.MODERATE
    assert session.gep is not None
    assert session.gep.stage.value == "ACKNOWLEDGE"
