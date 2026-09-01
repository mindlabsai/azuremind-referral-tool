from __future__ import annotations

import pytest

from reeboot.constants import DOMAIN_FALLBACKS
from reeboot.engine import ReebootEngine
from reeboot.generation.guardian import GOVERNANCE_EVENTS, OutputGuardian
from reeboot.providers.mock import ScriptedGenerationProvider
from reeboot.schemas.enums import Domain


def test_claim_violation_replaced_with_domain_fallback() -> None:
    GOVERNANCE_EVENTS.clear()
    guardian = OutputGuardian()
    out = guardian.validate(
        "I can diagnose ADHD from what you said",
        "I can't start this task",
        Domain.NEURO_EXEC_FUNCTION.value,
    )
    assert out == DOMAIN_FALLBACKS["NEURO_EXEC_FUNCTION"]
    assert any(e["event_type"] == "CLAIM_VIOLATION" for e in GOVERNANCE_EVENTS)


def test_you_have_diagnosis_blocked() -> None:
    out = OutputGuardian().validate(
        "you have depression and should start treatment",
        "I feel low today",
        Domain.MILD_DISTRESS.value,
    )
    assert out == DOMAIN_FALLBACKS["MILD_DISTRESS"]


def test_clinician_referral_allowed() -> None:
    text = "A therapist, psychologist, or GP can help if you want clinical support."
    assert OutputGuardian().validate(text, "I had a rough day", Domain.MILD_DISTRESS.value) == text


def test_echoed_user_claim_is_not_a_violation() -> None:
    user = "someone told me you have adhd which is not true"
    generated = "you have adhd is what they said, and we will not treat that as a diagnosis."
    out = OutputGuardian().validate(generated, user, Domain.NEURO_EXEC_FUNCTION.value)
    assert out == generated


@pytest.mark.asyncio
async def test_engine_guardian_intercepts_bad_generation() -> None:
    engine = ReebootEngine(
        generation=ScriptedGenerationProvider(["This is a treatment for anxiety."]),
        show_telemetry=False,
    )
    session = engine.new_session()
    result = await engine.process_text(session, "I'm feeling a bit down after a rough day")
    assert result.used_generation is True
    assert result.response == DOMAIN_FALLBACKS["MILD_DISTRESS"]
