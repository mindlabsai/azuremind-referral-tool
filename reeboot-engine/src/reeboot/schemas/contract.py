"""Canonical Runtime Contract — sole LLM input surface."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from reeboot.constants import RUNTIME_SCHEMA
from reeboot.schemas.enums import (
    Arousal,
    ClaimCeiling,
    ConversationMove,
    Domain,
    InterventionObjective,
    InterventionPrimitive,
    PolicyDecision,
    ProductMode,
    SafetyState,
    SessionMode,
    SupportState,
    UserState,
    VoicePace,
)


class FrozenModel(BaseModel):
    model_config = ConfigDict(frozen=True, extra="forbid")


class SessionBlock(FrozenModel):
    session_id: str
    turn_id: str
    mode: SessionMode


class SafetyBlock(FrozenModel):
    state: SafetyState
    support_state: SupportState = SupportState.UNRESOLVED
    risk_flags: tuple[str, ...] = ()


class UserStateBlock(FrozenModel):
    primary_domain: Domain
    secondary_domains: tuple[Domain, ...] = ()
    state: UserState
    arousal: Arousal


class InterventionConstraints(FrozenModel):
    maximum_actions: int = 1
    maximum_action_time_seconds: int = 5


class InterventionBlock(FrozenModel):
    primitive: InterventionPrimitive
    objective: InterventionObjective
    constraints: InterventionConstraints = Field(default_factory=InterventionConstraints)


class ConversationBlock(FrozenModel):
    move: ConversationMove
    maximum_words: int
    allow_question: bool


class VoiceBlock(FrozenModel):
    pace: VoicePace
    barge_in_enabled: bool
    endpoint_silence_threshold_ms: int


class ClaimsBlock(FrozenModel):
    product_mode: ProductMode = ProductMode.WELLBEING
    claim_ceiling: ClaimCeiling = ClaimCeiling.NON_DIAGNOSTIC_NON_TREATMENT
    jurisdiction: Literal["AU", "NZ", "UAE"] = "AU"
    clinical_actions_allowed: Literal[False] = False
    medication_guidance_allowed: Literal[False] = False
    diagnostic_inference_allowed: Literal[False] = False


class ConsentBlock(FrozenModel):
    voice_processing: bool = True
    raw_audio_retention: bool = False
    transcript_retention: bool = False
    longitudinal_memory: bool = False
    research_use: bool = False


class PolicyBlock(FrozenModel):
    policy_bundle: str
    decision: PolicyDecision
    authorised_primitive: InterventionPrimitive


class ProvenanceBlock(FrozenModel):
    runtime_build: str
    domain_package_hash: str
    safety_policy_version: str
    consent_policy_version: str
    claim_policy_version: str
    stt_model_version: str
    generation_model_version: str
    tts_model_version: str


class RuntimeContract(FrozenModel):
    """Immutable per-turn contract. This is the only payload given to generation."""

    schema_url: str = Field(default=RUNTIME_SCHEMA, alias="$schema")
    session: SessionBlock
    safety: SafetyBlock
    user_state: UserStateBlock
    intervention: InterventionBlock
    conversation: ConversationBlock
    voice: VoiceBlock
    claims: ClaimsBlock
    consent: ConsentBlock
    policy: PolicyBlock
    provenance: ProvenanceBlock

    model_config = ConfigDict(frozen=True, extra="forbid", populate_by_name=True)

    def generation_allowed(self) -> bool:
        return self.policy.decision != PolicyDecision.BLOCK_GENERATIVE
