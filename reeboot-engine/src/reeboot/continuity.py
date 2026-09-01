"""No-Gap continuity record. No partner API. Cadence flags only."""

from __future__ import annotations

from dataclasses import dataclass, field

from reeboot.schemas.enums import SafetyState


@dataclass
class ContinuityRecord:
    followup_hours: int | None = None
    followup_scheduled: bool = False
    reduced_acuity_contacts: int = 0
    gone_quiet: bool = False
    retraction_held: bool = False
    criteria_discharge_ready: bool = False
    events: list[str] = field(default_factory=list)

    def schedule(self, safety: SafetyState, history_flag: bool) -> None:
        if history_flag and safety in {SafetyState.AMBER, SafetyState.AMBER_HIGH, SafetyState.RED}:
            self.followup_hours = 24
        elif safety == SafetyState.AMBER_HIGH:
            self.followup_hours = 48
        elif safety == SafetyState.AMBER:
            self.followup_hours = 72
        elif safety == SafetyState.RED:
            self.followup_hours = 24
        else:
            self.followup_hours = 72
        self.followup_scheduled = True
        self.events.append(f"scheduled_{self.followup_hours}h")

    def mark_retraction(self) -> None:
        self.retraction_held = True
        self.followup_scheduled = True
        if self.followup_hours is None:
            self.followup_hours = 72
        self.events.append("retraction_held")

    def mark_missed_amber_high(self) -> None:
        self.gone_quiet = True
        self.events.append("gone_quiet_r14")

    def mark_reduced_acuity(self) -> None:
        self.reduced_acuity_contacts += 1
        if self.reduced_acuity_contacts >= 2:
            self.criteria_discharge_ready = True
            self.events.append("criteria_discharge_ready")
