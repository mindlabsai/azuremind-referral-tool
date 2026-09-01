"""User-state and arousal estimator. Deterministic, not generative."""

from __future__ import annotations

from dataclasses import dataclass

from reeboot.domain.resolver import DomainResolution
from reeboot.schemas.enums import Arousal, Domain, UserState


@dataclass(frozen=True)
class StateEstimate:
    state: UserState
    arousal: Arousal


class StateEstimator:
    def estimate(self, user_text: str, resolution: DomainResolution) -> StateEstimate:
        text = user_text.lower()
        domain = resolution.primary
        state = self._state_for(text, domain)
        arousal = self._arousal(text)
        return StateEstimate(state=state, arousal=arousal)

    def _state_for(self, text: str, domain: Domain) -> UserState:
        if domain == Domain.NEURO_EXEC_FUNCTION:
            if any(k in text for k in ("too many", "can't hold", "forgot", "scattered")):
                return UserState.WORKING_MEMORY_OVERLOAD
            if any(k in text for k in ("switch", "jumping", "can't finish")):
                return UserState.TASK_SWITCH_FRICTION
            return UserState.TASK_INITIATION_BLOCK
        if domain == Domain.WORK_STRESS:
            if any(k in text for k in ("deadline", "due", "tonight", "sprint")):
                return UserState.DEADLINE_PRESSURE
            if any(k in text for k in ("boss", "colleague", "manager", "review")):
                return UserState.INTERPERSONAL_FRICTION
            return UserState.ROLE_OVERLOAD
        if any(k in text for k in ("loop", "ruminat", "over and over", "can't stop thinking")):
            return UserState.RUMINATION
        if any(k in text for k in ("tired", "exhausted", "no energy", "drained")):
            return UserState.LOW_ENERGY
        return UserState.MILD_AFFECTIVE_LOAD

    def _arousal(self, text: str) -> Arousal:
        high = (
            "overwhelmed",
            "panic",
            "drowning",
            "urgent",
            "can't",
            "cannot",
            "breaking",
            "falling apart",
        )
        moderate = ("stressed", "hard", "struggling", "heavy", "anxious", "too much")
        if any(k in text for k in high):
            return Arousal.HIGH
        if any(k in text for k in moderate):
            return Arousal.MODERATE
        return Arousal.LOW
