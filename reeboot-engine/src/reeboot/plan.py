"""User-owned Safety Plan. Coping architecture, not a pledge."""

from __future__ import annotations

from dataclasses import dataclass, field


AMBIENT_SERVICES = (
    "Lifeline 13 11 14",
    "Suicide Call Back Service 1300 659 467",
    "000",
)


@dataclass
class SafetyPlan:
    warning_signs: list[str] = field(default_factory=list)
    internal_coping: list[str] = field(default_factory=list)
    people_and_places: list[str] = field(default_factory=list)
    people_i_can_tell: list[str] = field(default_factory=list)
    professionals: list[str] = field(default_factory=lambda: list(AMBIENT_SERVICES))
    environment_safer: list[str] = field(default_factory=list)
    tethers_verbatim: list[str] = field(default_factory=list)

    def present(self) -> bool:
        return bool(self.tethers_verbatim or self.warning_signs or self.people_i_can_tell)

    def retrieve(self) -> str:
        parts: list[str] = []
        if self.tethers_verbatim:
            parts.append("What has kept you going: " + "; ".join(self.tethers_verbatim))
        if self.people_i_can_tell:
            parts.append("People you can tell: " + "; ".join(self.people_i_can_tell))
        if self.professionals:
            parts.append("Services: " + "; ".join(self.professionals))
        return " ".join(parts)
