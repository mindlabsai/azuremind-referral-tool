from __future__ import annotations

import pytest

from reeboot.engine import ReebootEngine
from reeboot.generation.guardian import OutputGuardian
from reeboot.plan import SafetyPlan


@pytest.mark.asyncio
async def test_plan_stores_verbatim_tether() -> None:
    engine = ReebootEngine(show_telemetry=False, safety_backend="structured")
    session = engine.new_session()
    await engine.process_text(session, "I wish I were dead")
    await engine.process_text(session, "since Easter and nobody knows")
    await engine.process_text(session, "never gone further than thoughts")
    result = await engine.process_text(session, "my daughter and the dog needing his morning walk")
    if "What's kept you going" in result.response:
        result = await engine.process_text(session, "my daughter and the dog needing his morning walk")
    assert session.safety_plan is not None
    assert session.safety_plan.present()
    assert any("daughter" in t for t in session.safety_plan.tethers_verbatim)
    assert "daughter" in session.safety_plan.retrieve()


def test_guardian_rejects_pledge_language() -> None:
    out = OutputGuardian().validate(
        "Promise me to stay safe and we can continue",
        "I feel low",
        "MILD_DISTRESS",
    )
    assert "promise" not in out.lower()


def test_empty_plan_not_present() -> None:
    assert SafetyPlan().present() is False
