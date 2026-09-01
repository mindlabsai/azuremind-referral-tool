"""Compiled Layer-1 decision table. Features in, state + pathway out."""

from __future__ import annotations

from dataclasses import dataclass

from reeboot.schemas.enums import SafetyState
from reeboot.safety.features import Frame, Ideation, Intent, Plan, SafetyFeatures, Subject
from reeboot.safety.utterance import Utterance, parse_utterance


class SafetyPathway(str):
    STANDARD_SUPPORT = "STANDARD_SUPPORT"
    SAFETY_CLARIFY_AND_NARROW = "SAFETY_CLARIFY_AND_NARROW"
    DETERMINISTIC_SAFETY_PATH = "DETERMINISTIC_SAFETY_PATH"
    ACUTE_SELF_SAFETY_PATH = "ACUTE_SELF_SAFETY_PATH"
    ACUTE_THIRD_PARTY_SAFETY_PATH = "ACUTE_THIRD_PARTY_SAFETY_PATH"
    ACUTE_VIOLENCE_DV_SAFETY_PATH = "ACUTE_VIOLENCE_DV_SAFETY_PATH"


NON_LITERAL_FRAMES = {
    Frame.QUOTED,
    Frame.FICTIONAL,
    Frame.NEWS,
    Frame.IDIOM,
    Frame.BEREAVEMENT,
    Frame.CORRECTION,
}


@dataclass(frozen=True)
class Decision:
    state: SafetyState
    pathway: str
    rule_id: str
    reasons: tuple[str, ...]


def apply_decision_table(features: SafetyFeatures, utterance: Utterance | None = None) -> Decision:
    utterance = utterance or parse_utterance("", features)
    reasons = list(features.notes)
    if utterance.act.value != "ORDINARY":
        reasons.append(f"utterance:{utterance.act.value}")

    if features.frame in NON_LITERAL_FRAMES and not features.dv_acute and not features.third_party_imminent:
        reasons.append("non-literal frame: lexical match is a signal only")
        return Decision(
            state=SafetyState.GREEN,
            pathway=SafetyPathway.STANDARD_SUPPORT,
            rule_id="FRAME_NON_LITERAL",
            reasons=tuple(reasons),
        )

    if features.frame == Frame.NEGATED and features.intent == Intent.NONE and features.plan == Plan.NONE:
        reasons.append("explicit negation of harm; no independent acute features")
        return Decision(
            state=SafetyState.GREEN,
            pathway=SafetyPathway.STANDARD_SUPPORT,
            rule_id="FRAME_NEGATED",
            reasons=tuple(reasons),
        )

    if (
        features.frame == Frame.HISTORICAL_DISCLOSURE
        and features.intent == Intent.NONE
        and features.plan == Plan.NONE
        and not features.dv_acute
        and not features.third_party_imminent
    ):
        reasons.append("historical disclosure without current intent or plan")
        return Decision(
            state=SafetyState.GREEN,
            pathway=SafetyPathway.STANDARD_SUPPORT,
            rule_id="HISTORICAL_DISCLOSURE",
            reasons=tuple(reasons),
        )

    if features.dv_acute:
        reasons.append("acute DV/violence against the user")
        return Decision(
            state=SafetyState.EMERGENCY,
            pathway=SafetyPathway.ACUTE_VIOLENCE_DV_SAFETY_PATH,
            rule_id="DV_ACUTE",
            reasons=tuple(reasons),
        )

    if features.third_party_imminent:
        reasons.append("third-party imminent harm")
        return Decision(
            state=SafetyState.EMERGENCY,
            pathway=SafetyPathway.ACUTE_THIRD_PARTY_SAFETY_PATH,
            rule_id="THIRD_PARTY_IMMINENT",
            reasons=tuple(reasons),
        )

    self_literal = features.subject == Subject.SELF and features.frame in {
        Frame.LITERAL,
        Frame.HISTORICAL_DISCLOSURE,
    }
    acute_self = features.intent in {Intent.PRESENT, Intent.ACUTE} or features.plan != Plan.NONE
    if self_literal and acute_self:
        reasons.append("self + current intent or plan/means/preparation/action")
        return Decision(
            state=SafetyState.EMERGENCY,
            pathway=SafetyPathway.ACUTE_SELF_SAFETY_PATH,
            rule_id="SELF_ACUTE",
            reasons=tuple(reasons),
        )

    if utterance.acute and features.frame == Frame.LITERAL:
        reasons.append("utterance act is timed demand or conditional cessation")
        return Decision(
            state=SafetyState.EMERGENCY,
            pathway=SafetyPathway.ACUTE_SELF_SAFETY_PATH,
            rule_id="UTTERANCE_ACUTE",
            reasons=tuple(reasons),
        )

    if utterance.look_closer and features.frame == Frame.LITERAL:
        amber_ideation = features.ideation in {
            Ideation.PASSIVE,
            Ideation.ACTIVE,
            Ideation.UNSPECIFIED,
        } or features.self_harm_disclosure
        if self_literal and amber_ideation:
            reasons.append("self + ideation or self-harm disclosure without established intent/plan")
            rule_id = "SELF_IDEATION_OR_SH"
        elif features.severity_moderate:
            reasons.append("clinical severity markers without acute intent/plan")
            rule_id = "SEVERITY_MODERATE"
        elif features.discourse_look_closer:
            reasons.append("same-turn comprehension: look closer without established intent/plan")
            rule_id = "DISCOURSE_LOOK_CLOSER"
        else:
            reasons.append("utterance look-closer without established intent/plan")
            rule_id = "UTTERANCE_LOOK_CLOSER"
        return Decision(
            state=SafetyState.AMBER,
            pathway=SafetyPathway.SAFETY_CLARIFY_AND_NARROW,
            rule_id=rule_id,
            reasons=tuple(reasons),
        )

    reasons.append("no structured safety disclosure; distress is not a safety state")
    return Decision(
        state=SafetyState.GREEN,
        pathway=SafetyPathway.STANDARD_SUPPORT,
        rule_id="DEFAULT_GREEN",
        reasons=tuple(reasons),
    )
