"""Clinical severity markers. Independent of suicide-word safety.

Look-closer (AMBER / GEP) is a severity door: duration, role collapse,
burden, trapped, hopelessness-as-impact, treatment failure.
Duration alone is not enough. One bad day at work is not enough.
"""

from __future__ import annotations

import re
from dataclasses import dataclass

from reeboot.schemas.enums import SupportState


def _rx(*patterns: str) -> re.Pattern[str]:
    return re.compile("|".join(f"(?:{p})" for p in patterns), re.IGNORECASE)


DURATION_LONG = _rx(
    r"\b(?:for )?(?:months|years)\b",
    r"\bthis year\b",
    r"\bsince last year\b",
    r"\ba long time\b",
    r"\bkeeps coming back\b",
    r"\bfor a while\b",
    r"\blast month\b",
)
ROLE_COLLAPSE = _rx(
    r"\blost\b.{0,40}\bjobs\b",
    r"\blost another job\b",
    r"\bcan['’]?t keep (?:a job|anything together|work|a house)\b",
    r"\bcan['’]?t (?:hold|keep) (?:down )?a job\b",
    r"\bkeep getting (?:let go|fired)\b",
    r"\bhaven['’]?t been able to work\b",
)
FUNCTION_DROP = _rx(
    r"\bstopped doing things\b",
    r"\bcan['’]?t function\b",
    r"\bfalling apart\b",
    r"\bswitch off from the world\b",
)
HOPELESS_IMPACT = _rx(
    r"\bnothing i do changes\b",
    r"\bcan['’]?t see (?:things|.{0,24}) getting better\b",
    r"\blose hope\b",
    r"\bdon['’]?t see the point\b",
    r"\bwhat['’]?s the (?:use|point) of\b",
    r"\bout of options\b",
    r"\bhilang harapan\b",
    r"\bterlalu berat\b",
)
BURDEN = _rx(
    r"\bbetter (?:son|daughter|parent|partner|person) than me\b",
    r"\bmaking life harder for everyone\b",
    r"\bdeserve(?:s)? a better\b",
)
TRAPPED = _rx(
    r"\bfeel trapped\b(?! (?:in (?:this |the )?(?:meeting|job|office|traffic)))",
    r"\bevery option feels closed\b",
    r"\bno way through (?:this|it)\b",
)
TREATMENT_FAIL = _rx(
    r"\btried (?:therapy|meds|medication|praying|everything)\b",
    r"\bwhat['’]?s the use of these treatments\b",
)
WITHDRAWAL = _rx(
    r"\bvanish from\b",
    r"\bwish i could vanish\b",
    r"\bswitch off from the world\b",
)

_CORE_SCANNERS = (
    ("ROLE_COLLAPSE", ROLE_COLLAPSE),
    ("FUNCTION_DROP", FUNCTION_DROP),
    ("HOPELESS_IMPACT", HOPELESS_IMPACT),
    ("BURDEN", BURDEN),
    ("TRAPPED", TRAPPED),
    ("TREATMENT_FAIL", TREATMENT_FAIL),
    ("WITHDRAWAL", WITHDRAWAL),
)


@dataclass(frozen=True)
class SeverityAssessment:
    moderate: bool
    families: tuple[str, ...]
    support_hint: SupportState
    notes: tuple[str, ...]


def extract_severity(text: str) -> SeverityAssessment:
    raw = text.strip()
    core: list[str] = []
    for name, pattern in _CORE_SCANNERS:
        if pattern.search(raw):
            core.append(name)
    families = list(core)
    if DURATION_LONG.search(raw):
        families.append("DURATION_LONG")

    unique = tuple(dict.fromkeys(families))
    # Duration alone is not a look-closer trigger (e.g. "I started a job this year").
    moderate = len(core) >= 1
    if "ROLE_COLLAPSE" in unique or len(core) >= 2:
        hint = SupportState.MODERATE
    elif core:
        hint = SupportState.MILD_TO_MODERATE
    else:
        hint = SupportState.UNRESOLVED
    notes = tuple(f"severity:{f}" for f in unique)
    return SeverityAssessment(moderate=moderate, families=unique, support_hint=hint, notes=notes)
