"""Domain resolver — Reeboot owns domain selection, not the LLM."""

from __future__ import annotations

from dataclasses import dataclass

from reeboot.domain.registry import DomainRegistry
from reeboot.schemas.enums import Domain


NEURO_CUES = (
    "can't start",
    "cannot start",
    "can't begin",
    "cannot begin",
    "won't start",
    "can't get started",
    "can't begin this",
    "stuck on the first",
    "initiation",
    "procrastinat",
    "blank on the task",
    "too many steps",
    "can't focus on this task",
    "freeze when i try",
    "executive",
    "my brain won't",
    "can't start this",
    "won't begin",
    "task initiation",
    "can't get going",
)

WORK_CUES = (
    "work",
    "boss",
    "deadline",
    "meeting",
    "inbox",
    "job",
    "colleague",
    "overtime",
    "sprint",
    "client call",
    "manager",
    "office",
    "workload",
    "standup",
    "performance review",
)

DISTRESS_CUES = (
    "sad",
    "upset",
    "down",
    "rough day",
    "feeling off",
    "lonely",
    "anxious",
    "low",
    "heavy",
    "teary",
)


@dataclass(frozen=True)
class DomainResolution:
    primary: Domain
    secondary: tuple[Domain, ...]
    scores: dict[Domain, int]


class DomainResolver:
    def __init__(self, registry: DomainRegistry | None = None) -> None:
        self.registry = registry

    def resolve(self, user_text: str) -> DomainResolution:
        text = user_text.lower()
        scores = {
            Domain.NEURO_EXEC_FUNCTION: _score(text, NEURO_CUES),
            Domain.WORK_STRESS: _score(text, WORK_CUES),
            Domain.MILD_DISTRESS: _score(text, DISTRESS_CUES),
        }

        if self.registry:
            for domain, package in self.registry.packages.items():
                for state in package.states:
                    cues = tuple(state.get("cues") or [])
                    scores[domain] = scores.get(domain, 0) + _score(text, cues)

        ranked = sorted(scores, key=lambda d: scores[d], reverse=True)
        if scores[ranked[0]] == 0:
            primary = Domain.MILD_DISTRESS
            secondary: tuple[Domain, ...] = ()
        else:
            primary = ranked[0]
            secondary = tuple(d for d in ranked[1:] if scores[d] > 0)

        # Initiation language at work stays neuro-primary with work secondary.
        if scores[Domain.NEURO_EXEC_FUNCTION] > 0 and scores[Domain.WORK_STRESS] > 0:
            if scores[Domain.NEURO_EXEC_FUNCTION] >= scores[Domain.WORK_STRESS]:
                primary = Domain.NEURO_EXEC_FUNCTION
                secondary = tuple(
                    d for d in (Domain.WORK_STRESS, Domain.MILD_DISTRESS) if scores[d] > 0
                )

        return DomainResolution(primary=primary, secondary=secondary, scores=scores)


def _score(text: str, cues: tuple[str, ...] | list[str]) -> int:
    return sum(1 for cue in cues if cue.lower() in text)
