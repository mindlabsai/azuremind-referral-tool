from __future__ import annotations

import pytest

from reeboot.continuity import ContinuityRecord
from reeboot.engine import ReebootEngine
from reeboot.schemas.enums import SafetyState


def test_cadence_hours() -> None:
    rec = ContinuityRecord()
    rec.schedule(SafetyState.AMBER, history_flag=False)
    assert rec.followup_hours == 72
    rec.schedule(SafetyState.AMBER_HIGH, history_flag=False)
    assert rec.followup_hours == 48
    rec.schedule(SafetyState.AMBER_HIGH, history_flag=True)
    assert rec.followup_hours == 24


def test_retraction_keeps_followup() -> None:
    rec = ContinuityRecord()
    rec.mark_retraction()
    assert rec.retraction_held is True
    assert rec.followup_scheduled is True


def test_two_reduced_contacts_ready_discharge() -> None:
    rec = ContinuityRecord()
    rec.mark_reduced_acuity()
    assert rec.criteria_discharge_ready is False
    rec.mark_reduced_acuity()
    assert rec.criteria_discharge_ready is True


def test_missed_amber_high_gone_quiet() -> None:
    rec = ContinuityRecord()
    rec.mark_missed_amber_high()
    assert rec.gone_quiet is True


@pytest.mark.asyncio
async def test_continuity_survives_red_turn() -> None:
    engine = ReebootEngine(show_telemetry=False, safety_backend="structured")
    session = engine.new_session()
    await engine.process_text(session, "I wish I were dead")
    session.continuity.schedule(SafetyState.AMBER, False)
    await engine.process_text(session, "I am going to kill myself tonight")
    assert session.continuity.followup_scheduled is True
    assert session.safety_state.value == "EMERGENCY"
