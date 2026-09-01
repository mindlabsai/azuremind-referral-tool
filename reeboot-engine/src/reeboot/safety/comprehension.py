"""Same-turn comprehension. Resolves meaning, not extra harm words.

Intra-utterance only. Fresh-session eval has no prior turns.
Does not set intent or plan — look-closer, not EMERGENCY.
"""

from __future__ import annotations

import re
from dataclasses import replace

from reeboot.safety.features import Frame, Ideation, SafetyFeatures, Subject

_NON_LITERAL = {
    Frame.QUOTED,
    Frame.FICTIONAL,
    Frame.NEWS,
    Frame.IDIOM,
    Frame.BEREAVEMENT,
    Frame.CORRECTION,
}

_ANTECEDENT = re.compile(
    r"\b(?:tried once|once before|attempted|pernah cuba|cuba sekali|years ago|prior attempt)\b",
    re.IGNORECASE,
)
_RESUMPTION = re.compile(
    r"\b(?:the )?thoughts (?:are |were )?(?:back|again)\b",
    re.IGNORECASE,
)
_DISCLOSURE_PROBE = re.compile(
    r"(?:dark.{0,80}report me|report me.{0,80}dark)",
    re.IGNORECASE,
)
_SURVIVAL = re.compile(
    r"(?:still here.{0,100}didn['’]?t think i would|"
    r"didn['’]?t think i would.{0,100}still here|"
    r"if i go\b.{0,80}(?:who carries|so i stay|i stay))",
    re.IGNORECASE,
)
_MEANS_HANDOFF = re.compile(
    r"\bgave the stuff\b.{0,48}\bto hold\b",
    re.IGNORECASE,
)


def apply_comprehension(text: str, features: SafetyFeatures) -> SafetyFeatures:
    if features.frame in _NON_LITERAL:
        return features
    if features.dv_acute or features.third_party_imminent:
        return features

    lowered = text.strip()
    ops: list[str] = []
    if _ANTECEDENT.search(lowered) and _RESUMPTION.search(lowered):
        ops.append("ANAPHOR_RESUMPTION")
    if _DISCLOSURE_PROBE.search(lowered):
        ops.append("DISCLOSURE_PROBE")
    if _SURVIVAL.search(lowered):
        ops.append("SURVIVAL_CONTRAST")
    if _MEANS_HANDOFF.search(lowered):
        ops.append("MEANS_HANDOFF")
    if not ops:
        return features

    notes = list(features.notes)
    ideation = features.ideation
    frame = features.frame
    subject = features.subject

    if "ANAPHOR_RESUMPTION" in ops:
        if ideation == Ideation.NONE:
            ideation = Ideation.PASSIVE
        if frame == Frame.HISTORICAL_DISCLOSURE:
            frame = Frame.LITERAL
        notes.append("discourse:anaphor_resumption")
    if "DISCLOSURE_PROBE" in ops:
        notes.append("discourse:disclosure_probe")
    if "SURVIVAL_CONTRAST" in ops:
        notes.append("discourse:survival_contrast")
    if "MEANS_HANDOFF" in ops:
        notes.append("discourse:means_handoff")

    if subject != Subject.SELF:
        subject = Subject.SELF
        notes.append("subject:implied_self_discourse")

    return replace(
        features,
        subject=subject,
        ideation=ideation,
        frame=frame,
        discourse_look_closer=True,
        discourse_ops=tuple(ops),
        notes=tuple(notes),
    )
