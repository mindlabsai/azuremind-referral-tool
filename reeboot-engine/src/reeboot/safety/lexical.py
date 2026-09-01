"""Layer 0 lexical floor — emits signals, never absolute safety states."""

from __future__ import annotations

import re

from reeboot.schemas.enums import SafetySignal

_WORD = r"(?:^|[\s,.;:!?'\"])"

SELF_HARM_PATTERNS = (
    r"\bkill(?:ing)? myself\b",
    r"\bsuicide\b",
    r"\bend my life\b",
    r"\bend it all\b",
    r"\bself[- ]harm\b",
    r"\bcut myself\b",
    r"\boverdose\b",
    r"\bhang myself\b",
    r"\bshoot myself\b",
    r"\bjump off\b",
    r"\bjump in front\b",
    r"\btake all my pills\b",
)

ACTIVE_THREAT_PATTERNS = (
    r"\bkill(?:ing)? myself\b",
    r"\bend my life\b",
    r"\bend it all\b",
    r"\boverdose\b",
    r"\bhang myself\b",
    r"\bshoot myself\b",
    r"\bjump off\b",
    r"\bjump in front\b",
    r"\btake all my pills\b",
    r"\bsuicide\b",
)

IMMEDIATE_INTENT_PATTERNS = (
    r"\bgoing to\b",
    r"\bgonna\b",
    r"\babout to\b",
    r"\btonight\b",
    r"\bright now\b",
    r"\bplanning to\b",
    r"\bintend to\b",
)

PASSIVE_IDEATION_PATTERNS = (
    r"\bwish i (was|were) dead\b",
    r"\bwant to die\b",
    r"\bbetter off dead\b",
    r"\bdon'?t want to be here\b",
    r"\bno reason to live\b",
    r"\bcan'?t go on\b",
    r"\bwish i wasn'?t here\b",
)

HOPELESSNESS_PATTERNS = (
    r"\bhopeless\b",
    r"\bno point\b",
    r"\bnothing matters\b",
    r"\bno way (out|through)\b",
    r"\bcan'?t see a way\b",
    r"\bnever get better\b",
)

DISTRESS_PATTERNS = (
    r"\boverwhelmed\b",
    r"\bdrowning\b",
    r"\bcan'?t cope\b",
    r"\bbreaking down\b",
    r"\bpanic\b",
    r"\bfalling apart\b",
    r"\btoo much\b",
    r"\bcan'?t take (this|it)\b",
)

SELF_REFERENCE_PATTERNS = (
    r"\bi\b",
    r"\bi['’]m\b",
    r"\bi am\b",
    r"\bi['’]ll\b",
    r"\bmy\b",
)

NEGATION_PATTERNS = (
    r"\bdon['’]?t\b",
    r"\bdo not\b",
    r"\bnot\b",
    r"\bnever\b",
    r"\bwon['’]?t\b",
)

POSITIVE_EVIDENCE_PATTERNS = (
    r"\bbetter\b",
    r"\bfeeling better\b",
    r"\ba bit better\b",
    r"\bi can try\b",
    r"\bi'?ll try\b",
    r"\bready to\b",
    r"\bthat helped\b",
    r"\bokay now\b",
    r"\bi'?m okay\b",
    r"\bmanageable\b",
)

SAFETY_ORIENTED_PATTERNS = (
    r"\bi('?m| am) safe\b",
    r"\bi will (call|stay|wait)\b",
    r"\bi('?ll| will) contact\b",
    r"\bi don['’]?t want to (die|kill)\b",
    r"\bi want (help|support)\b",
    r"\bi can wait\b",
    r"\bstay here\b",
)


def _any(patterns: tuple[str, ...], text: str) -> bool:
    return any(re.search(p, text) for p in patterns)


def scan(text: str) -> set[SafetySignal]:
    lowered = text.lower()
    signals: set[SafetySignal] = set()
    if _any(SELF_HARM_PATTERNS, lowered):
        signals.add(SafetySignal.SELF_HARM_LEXICAL_MATCH)
    if _any(ACTIVE_THREAT_PATTERNS, lowered):
        signals.add(SafetySignal.ACTIVE_THREAT)
    if _any(IMMEDIATE_INTENT_PATTERNS, lowered):
        signals.add(SafetySignal.IMMEDIATE_INTENT)
    if _any(PASSIVE_IDEATION_PATTERNS, lowered):
        signals.add(SafetySignal.PASSIVE_IDEATION)
    if _any(HOPELESSNESS_PATTERNS, lowered):
        signals.add(SafetySignal.HOPELESSNESS)
    if _any(DISTRESS_PATTERNS, lowered):
        signals.add(SafetySignal.DISTRESS)
    if _any(SELF_REFERENCE_PATTERNS, lowered):
        signals.add(SafetySignal.SELF_REFERENCE)
    if _any(NEGATION_PATTERNS, lowered):
        signals.add(SafetySignal.NEGATION)
    if _any(POSITIVE_EVIDENCE_PATTERNS, lowered):
        signals.add(SafetySignal.POSITIVE_EVIDENCE)
    if _any(SAFETY_ORIENTED_PATTERNS, lowered):
        signals.add(SafetySignal.SAFETY_ORIENTED)
    return signals
