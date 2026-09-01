"""GEP slot model and extraction. Never ask what is already filled."""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from enum import Enum

from reeboot.safety.features import extract_features


class Duration(str, Enum):
    LT_2WK = "<2wk"
    WK_2_6 = "2-6wk"
    GT_6WK = ">6wk"
    CHRONIC_UNCLEAR = "chronic_unclear"


class Pervasiveness(str, Enum):
    SITUATIONAL = "situational"
    MOST_DAYS = "most_days"
    CONSTANT = "constant"


class Connection(str, Enum):
    PROFESSIONAL_ENGAGED = "professional_engaged"
    SOMEONE_KNOWS = "someone_knows"
    NOBODY_KNOWS = "nobody_knows"


class History(str, Enum):
    NONE = "none"
    SELF_HARM = "self_harm_history"
    ATTEMPT = "attempt_history"
    BOTH = "both"


class SafetyGate(str, Enum):
    CLEAR = "clear"
    INTENT_SIGNAL = "intent_signal"
    PLAN_SIGNAL = "plan_signal"
    MEANS_SIGNAL = "means_signal"
    CURRENT_ACTION = "current_action"


class IdeationCharacter(str, Enum):
    PASSIVE_WISH = "passive_wish"
    ACTIVE_THOUGHT = "active_thought"
    UNCLEAR = "unclear"


DURATION_GT6 = re.compile(
    r"\b(?:months|since (?:easter|christmas|last year|january|february|march|april|"
    r"may|june|july|august|september|october|november|december)|years?|"
    r"(?:two|2|three|3|four|4|five|5|six|6) months)\b",
    re.I,
)
DURATION_2_6 = re.compile(
    r"\b(?:(?:a |one |1 )?(?:few |couple of )?(?:weeks)|(?:two|2|three|3|four|4|five|5) weeks|"
    r"(?:a |one |1 )?month)\b",
    re.I,
)
DURATION_LT2 = re.compile(
    r"\b(?:few days|couple of days|this week|yesterday|since monday|a few days|"
    r"last few days|just started|this past week)\b",
    re.I,
)
DURATION_CHRONIC = re.compile(
    r"\b(?:a (?:long )?while|as long as i can remember|forever|ages|for years|"
    r"keeps coming back)\b",
    re.I,
)
PERV_CONSTANT = re.compile(r"\b(?:all the time|always|constant|every day|24/7|the whole time)\b", re.I)
PERV_MOST = re.compile(r"\b(?:most days|most of the time|nearly every day|almost every day)\b", re.I)
PERV_SIT = re.compile(r"\b(?:comes and goes|on and off|only (?:at|when)|situational)\b", re.I)
CONN_NONE = re.compile(
    r"\b(?:nobody knows|no one knows|haven['’]?t told anyone|i haven['’]?t told|"
    r"not told anyone|keeps it to myself|no one in my life knows)\b",
    re.I,
)
CONN_PRO = re.compile(
    r"\b(?:my (?:gp|doctor|therapist|psychologist|psychiatrist|counsellor|counselor)|"
    r"seeing a (?:gp|doctor|therapist|psychologist)|already (?:have|seeing) (?:a )?(?:gp|therapist))\b",
    re.I,
)
CONN_SOMEONE = re.compile(
    r"\b(?:(?:mum|mom|dad|friend|partner|sister|brother|wife|husband) knows|"
    r"i told (?:my )?(?:mum|mom|dad|friend|partner)|someone knows)\b",
    re.I,
)
HIST_ATTEMPT = re.compile(
    r"\b(?:attempted|suicide attempt|tried to (?:kill|end)|came close to acting)\b",
    re.I,
)
HIST_SH = re.compile(r"\b(?:cut myself|hurt myself|self[- ]harm|old habits)\b", re.I)
HIST_NONE = re.compile(
    r"\b(?:never gone further|just thoughts|only thoughts|never acted|hasn['’]?t gone further)\b",
    re.I,
)
RETRACTION = re.compile(
    r"\b(?:forget it|i['’]?m fine|lol nvm|never mind|nvm|don['’]?t worry about it)\b",
    re.I,
)
TETHER_EMPTY = re.compile(r"^\s*(?:i don['’]?t know|dont know|nothing|no idea|idk)\s*[.!]?\s*$", re.I)


@dataclass
class GepSlots:
    ideation_character: IdeationCharacter | None = None
    duration: Duration | None = None
    pervasiveness: Pervasiveness | None = None
    connection: Connection | None = None
    history: History | None = None
    tethers: list[str] = field(default_factory=list)
    safety_gate: SafetyGate = SafetyGate.CLEAR
    notes: list[str] = field(default_factory=list)

    def prefill_from_text(self, text: str) -> None:
        raw = text.strip()
        features = extract_features(raw)
        if self.ideation_character is None:
            if features.ideation.value == "PASSIVE":
                self.ideation_character = IdeationCharacter.PASSIVE_WISH
            elif features.ideation.value == "ACTIVE":
                self.ideation_character = IdeationCharacter.ACTIVE_THOUGHT
            elif features.ideation.value == "UNSPECIFIED":
                self.ideation_character = IdeationCharacter.UNCLEAR

        if self.duration is None:
            if DURATION_GT6.search(raw):
                self.duration = Duration.GT_6WK
                self.notes.append("prefill:duration>6wk")
            elif DURATION_2_6.search(raw):
                self.duration = Duration.WK_2_6
                self.notes.append("prefill:duration2-6wk")
            elif DURATION_LT2.search(raw):
                self.duration = Duration.LT_2WK
                self.notes.append("prefill:duration<2wk")
            elif DURATION_CHRONIC.search(raw):
                self.duration = Duration.CHRONIC_UNCLEAR
                self.notes.append("prefill:duration_chronic")

        if self.pervasiveness is None:
            if PERV_CONSTANT.search(raw):
                self.pervasiveness = Pervasiveness.CONSTANT
            elif PERV_MOST.search(raw):
                self.pervasiveness = Pervasiveness.MOST_DAYS
            elif PERV_SIT.search(raw):
                self.pervasiveness = Pervasiveness.SITUATIONAL

        if self.connection is None:
            if CONN_NONE.search(raw):
                self.connection = Connection.NOBODY_KNOWS
            elif CONN_PRO.search(raw):
                self.connection = Connection.PROFESSIONAL_ENGAGED
            elif CONN_SOMEONE.search(raw):
                self.connection = Connection.SOMEONE_KNOWS

        if self.history is None:
            attempt = bool(HIST_ATTEMPT.search(raw))
            sh = bool(HIST_SH.search(raw))
            if attempt and sh:
                self.history = History.BOTH
            elif attempt:
                self.history = History.ATTEMPT
            elif sh:
                self.history = History.SELF_HARM
            elif HIST_NONE.search(raw):
                self.history = History.NONE

        self.safety_gate = safety_gate_from_features(features)


def safety_gate_from_features(features) -> SafetyGate:
    if features.plan.value == "CURRENT_ACTION":
        return SafetyGate.CURRENT_ACTION
    if features.plan.value in {"MEANS", "PREPARATORY"}:
        return SafetyGate.MEANS_SIGNAL
    if features.plan.value != "NONE":
        return SafetyGate.PLAN_SIGNAL
    if features.intent.value != "NONE":
        return SafetyGate.INTENT_SIGNAL
    return SafetyGate.CLEAR


def is_retraction(text: str) -> bool:
    return bool(RETRACTION.search(text))


def is_tether_empty(text: str) -> bool:
    return bool(TETHER_EMPTY.search(text.strip()))
