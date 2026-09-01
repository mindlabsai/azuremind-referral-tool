"""Semantic Output Guardian — claim ceiling, referrals allowed, user echo ignored."""

from __future__ import annotations

import re

from reeboot.constants import DOMAIN_FALLBACKS

PROHIBITED_CLAIM_PATTERNS = (
    r"\bi (can|will) (diagnose|treat|cure|heal)\b",
    r"\bthis is (a treatment for|therapy for|a cure for)\b",
    r"\byou have (adhd|depression|anxiety|ptsd)\b",
    r"\bpromise (?:me )?to stay safe\b",
    r"\bno-suicide (?:contract|pact|promise)\b",
    r"\bswear you won['’]?t (?:hurt|kill)\b",
)

GOVERNANCE_EVENTS: list[dict[str, str]] = []


def log_governance_event(event_type: str, pattern: str) -> None:
    GOVERNANCE_EVENTS.append({"event_type": event_type, "pattern": pattern})


class OutputGuardian:
    def validate(self, text: str, user_text: str, domain: str) -> str:
        normalized_gen = text.lower()
        normalized_user = user_text.lower()
        for pattern in PROHIBITED_CLAIM_PATTERNS:
            if re.search(pattern, normalized_gen):
                if re.search(pattern, normalized_user):
                    continue
                log_governance_event(event_type="CLAIM_VIOLATION", pattern=pattern)
                return DOMAIN_FALLBACKS.get(domain, DOMAIN_FALLBACKS["DEFAULT"])
        return text
