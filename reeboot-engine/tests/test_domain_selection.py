from __future__ import annotations

from reeboot.domain.registry import DomainRegistry
from reeboot.domain.resolver import DomainResolver
from reeboot.schemas.enums import Domain


def _resolver() -> DomainResolver:
    registry = DomainRegistry()
    registry.load()
    return DomainResolver(registry)


def test_neuro_exec_function_primary() -> None:
    result = _resolver().resolve("I can't start this assignment, my brain won't begin")
    assert result.primary == Domain.NEURO_EXEC_FUNCTION


def test_work_stress_primary() -> None:
    result = _resolver().resolve("I have a work deadline and my manager added a meeting")
    assert result.primary == Domain.WORK_STRESS


def test_mild_distress_default_and_cues() -> None:
    resolver = _resolver()
    assert resolver.resolve("hello there").primary == Domain.MILD_DISTRESS
    assert resolver.resolve("I'm feeling a bit down after a rough day").primary == Domain.MILD_DISTRESS


def test_neuro_with_work_secondary() -> None:
    result = _resolver().resolve(
        "I can't start this work report, my brain won't begin the deadline task"
    )
    assert result.primary == Domain.NEURO_EXEC_FUNCTION
    assert Domain.WORK_STRESS in result.secondary
