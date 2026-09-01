"""Policy decision — ALLOW / NARROW / BLOCK_GENERATIVE."""

from __future__ import annotations

from dataclasses import dataclass

from reeboot.constants import POLICY_BUNDLE
from reeboot.schemas.enums import InterventionPrimitive, PolicyDecision, SafetyState


@dataclass(frozen=True)
class PolicyVerdict:
    policy_bundle: str
    decision: PolicyDecision
    authorised_primitive: InterventionPrimitive


class PolicyEngine:
    def decide(
        self,
        safety: SafetyState,
        primitive: InterventionPrimitive,
    ) -> PolicyVerdict:
        if safety in (SafetyState.RED, SafetyState.EMERGENCY):
            decision = PolicyDecision.BLOCK_GENERATIVE
        elif safety in (SafetyState.AMBER, SafetyState.AMBER_HIGH):
            decision = PolicyDecision.NARROW
        else:
            decision = PolicyDecision.ALLOW
        return PolicyVerdict(
            policy_bundle=POLICY_BUNDLE,
            decision=decision,
            authorised_primitive=primitive,
        )
