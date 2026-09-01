"""Compile the immutable Runtime Contract — sole generation input."""

from __future__ import annotations

from reeboot.constants import (
    CLAIM_POLICY_VERSION,
    CONSENT_POLICY_VERSION,
    GENERATION_MODEL_VERSION,
    RUNTIME_BUILD,
    SAFETY_POLICY_VERSION,
    STT_MODEL_VERSION,
    TTS_MODEL_VERSION,
)
from reeboot.domain.resolver import DomainResolution
from reeboot.intervention.selector import InterventionPlan
from reeboot.policy.engine import PolicyVerdict
from reeboot.schemas.contract import (
    ClaimsBlock,
    ConsentBlock,
    ConversationBlock,
    InterventionBlock,
    PolicyBlock,
    ProvenanceBlock,
    RuntimeContract,
    SafetyBlock,
    SessionBlock,
    UserStateBlock,
    VoiceBlock,
)
from reeboot.schemas.enums import Arousal, SafetyState, VoicePace
from reeboot.session import Session
from reeboot.state.estimator import StateEstimate
from reeboot.turn.fsm import silence_threshold_ms


class RuntimeContractCompiler:
    def __init__(self, domain_package_hash: str) -> None:
        self.domain_package_hash = domain_package_hash

    def compile(
        self,
        session: Session,
        turn_id: str,
        safety_state: SafetyState,
        risk_flags: tuple[str, ...],
        resolution: DomainResolution,
        estimate: StateEstimate,
        plan: InterventionPlan,
        verdict: PolicyVerdict,
    ) -> RuntimeContract:
        threshold = silence_threshold_ms(
            resolution.primary, estimate.arousal, plan.primitive
        )
        session.fsm.set_silence_threshold(threshold)
        pace = _voice_pace(safety_state, estimate.arousal)
        barge_in = safety_state != SafetyState.EMERGENCY
        return RuntimeContract.model_validate(
            {
                "$schema": "https://schema.reeboot.ai/v1/runtime_contract.json",
                "session": SessionBlock(
                    session_id=session.session_id,
                    turn_id=turn_id,
                    mode=session.mode,
                ),
                "safety": SafetyBlock(
                    state=safety_state,
                    support_state=session.support_state,
                    risk_flags=risk_flags,
                ),
                "user_state": UserStateBlock(
                    primary_domain=resolution.primary,
                    secondary_domains=resolution.secondary,
                    state=estimate.state,
                    arousal=estimate.arousal,
                ),
                "intervention": InterventionBlock(
                    primitive=plan.primitive,
                    objective=plan.objective,
                    constraints=plan.constraints,
                ),
                "conversation": ConversationBlock(
                    move=plan.move,
                    maximum_words=plan.maximum_words,
                    allow_question=plan.allow_question,
                ),
                "voice": VoiceBlock(
                    pace=pace,
                    barge_in_enabled=barge_in,
                    endpoint_silence_threshold_ms=threshold,
                ),
                "claims": ClaimsBlock(),
                "consent": session.consent,
                "policy": PolicyBlock(
                    policy_bundle=verdict.policy_bundle,
                    decision=verdict.decision,
                    authorised_primitive=verdict.authorised_primitive,
                ),
                "provenance": ProvenanceBlock(
                    runtime_build=RUNTIME_BUILD,
                    domain_package_hash=self.domain_package_hash,
                    safety_policy_version=SAFETY_POLICY_VERSION,
                    consent_policy_version=CONSENT_POLICY_VERSION,
                    claim_policy_version=CLAIM_POLICY_VERSION,
                    stt_model_version=STT_MODEL_VERSION,
                    generation_model_version=GENERATION_MODEL_VERSION,
                    tts_model_version=TTS_MODEL_VERSION,
                ),
            }
        )


def _voice_pace(safety: SafetyState, arousal: Arousal) -> VoicePace:
    if safety in (SafetyState.RED, SafetyState.EMERGENCY) or arousal == Arousal.HIGH:
        return VoicePace.CALM_SLOW
    if arousal == Arousal.MODERATE:
        return VoicePace.LOW_AROUSAL
    return VoicePace.NEUTRAL
