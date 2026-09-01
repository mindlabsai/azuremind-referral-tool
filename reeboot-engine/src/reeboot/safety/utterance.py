"""Utterance layer — one parse of the turn as a speech act.

Detectors fill evidence. This object says what the turn is doing.
Look-closer and acute paths subscribe to the act, not to raw text.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from enum import Enum

from reeboot.safety.features import Frame, Ideation, SafetyFeatures

UTTERANCE_INTERPRETER_VERSION = "1.0.0"


class SpeechAct(str, Enum):
    DISCLOSE_HARM = "DISCLOSE_HARM"
    PROBE_SAFETY = "PROBE_SAFETY"
    FAREWELL = "FAREWELL"
    PREP = "PREP"
    TIMED_DEMAND = "TIMED_DEMAND"
    CONDITIONAL_CESSATION = "CONDITIONAL_CESSATION"
    HELP_SEEK = "HELP_SEEK"
    PROTECTIVE_MOVE = "PROTECTIVE_MOVE"
    EMPTY = "EMPTY"
    ORDINARY = "ORDINARY"


LOOK_CLOSER_ACTS = {
    SpeechAct.DISCLOSE_HARM,
    SpeechAct.PROBE_SAFETY,
    SpeechAct.FAREWELL,
    SpeechAct.PREP,
}

ACUTE_ACTS = {
    SpeechAct.TIMED_DEMAND,
    SpeechAct.CONDITIONAL_CESSATION,
}

_EMPTY = re.compile(r"^\s*\d{1,3}\s*[-–]\s*\d{1,3}\s*$")
_TIMED_DEMAND = re.compile(
    r"(?:give me one reason.{0,40}five minutes|five minutes.{0,40}give me one reason|"
    r"you have five minutes)",
    re.IGNORECASE,
)
_CONDITIONAL = re.compile(r"\bi will not stay\b", re.IGNORECASE)
_FAREWELL = re.compile(
    r"(?:whatever happens.{0,48}thank you|thank you.{0,48}whatever happens|"
    r"remember me in (?:your )?prayers|forgive me for everything)",
    re.IGNORECASE,
)
_PREP = re.compile(r"(?:updated my will|sorted my papers)", re.IGNORECASE)
_HELP_SEEK = re.compile(
    r"(?:need actual help|not just an app|where do i start)",
    re.IGNORECASE,
)
_PROTECTIVE = re.compile(
    r"(?:called my sister instead|did the thing my psych said)",
    re.IGNORECASE,
)


@dataclass(frozen=True)
class Utterance:
    act: SpeechAct
    look_closer: bool
    acute: bool
    referents: tuple[str, ...]
    evidence: tuple[str, ...]

    def as_signals(self) -> list[str]:
        flags = [f"UTTERANCE_{self.act.value}"]
        if self.look_closer:
            flags.append("UTTERANCE_LOOK_CLOSER")
        if self.acute:
            flags.append("UTTERANCE_ACUTE")
        flags.extend(self.referents)
        return flags


def parse_utterance(text: str, features: SafetyFeatures) -> Utterance:
    raw = text.strip()
    evidence: list[str] = []
    referents: list[str] = []

    for op in features.discourse_ops:
        evidence.append(f"discourse:{op}")
        if op == "ANAPHOR_RESUMPTION":
            referents.append("REF_THOUGHTS_PRIOR_ATTEMPT")
        elif op == "MEANS_HANDOFF":
            referents.append("REF_STUFF_MEANS")
        elif op == "SURVIVAL_CONTRAST":
            referents.append("REF_GO_CESSATION")
        elif op == "DISCLOSURE_PROBE":
            referents.append("REF_DARK_UNDISCLOSED")

    if features.ideation != Ideation.NONE:
        evidence.append(f"ideation:{features.ideation.value}")
    if features.self_harm_disclosure:
        evidence.append("self_harm")
    if features.severity_moderate:
        evidence.append("severity")
        evidence.extend(features.severity_families)
    if features.ambiguous_safety:
        evidence.append("ambiguous")

    act = _classify(raw, features)
    return Utterance(
        act=act,
        look_closer=act in LOOK_CLOSER_ACTS,
        acute=act in ACUTE_ACTS,
        referents=tuple(referents),
        evidence=tuple(evidence),
    )


def _harm_core(features: SafetyFeatures) -> bool:
    return (
        features.ideation != Ideation.NONE
        or features.self_harm_disclosure
        or features.severity_moderate
        or features.discourse_look_closer
    )


def _classify(raw: str, features: SafetyFeatures) -> SpeechAct:
    if features.frame in {
        Frame.QUOTED,
        Frame.FICTIONAL,
        Frame.NEWS,
        Frame.IDIOM,
        Frame.BEREAVEMENT,
        Frame.CORRECTION,
        Frame.NEGATED,
    }:
        return SpeechAct.ORDINARY
    if _EMPTY.match(raw):
        return SpeechAct.EMPTY
    if _TIMED_DEMAND.search(raw):
        return SpeechAct.TIMED_DEMAND
    if _CONDITIONAL.search(raw):
        return SpeechAct.CONDITIONAL_CESSATION
    if _FAREWELL.search(raw):
        return SpeechAct.FAREWELL
    if "DISCLOSURE_PROBE" in features.discourse_ops:
        return SpeechAct.PROBE_SAFETY
    if _PREP.search(raw) and not _harm_core(features):
        return SpeechAct.PREP
    if _HELP_SEEK.search(raw) and not _harm_core(features):
        return SpeechAct.HELP_SEEK
    if _PROTECTIVE.search(raw) and not _harm_core(features):
        return SpeechAct.PROTECTIVE_MOVE
    if _harm_core(features) or features.ambiguous_safety:
        return SpeechAct.DISCLOSE_HARM
    return SpeechAct.ORDINARY
