"""Executable consent — no persistence when transcript_retention is false."""

from __future__ import annotations

import hashlib

from reeboot.session import Session


class ConsentEngine:
    def complete_turn(self, session: Session, user_text: str) -> str | None:
        """Dereference ephemeral user data. Return anonymized hash for audit only."""
        digest = hashlib.sha256(user_text.encode("utf-8")).hexdigest()
        session.clear_ephemeral()
        if session.consent.transcript_retention:
            return None
        return digest
