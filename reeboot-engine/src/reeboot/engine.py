"""Reeboot Gen 2 kernel — single-process async modular monolith."""

from __future__ import annotations

import time

import os

from reeboot.consent.engine import ConsentEngine
from reeboot.constants import (
    DETERMINISTIC_DV_RESPONSE,
    DETERMINISTIC_EMERGENCY_RESPONSE,
    DETERMINISTIC_RED_RESPONSE,
    DETERMINISTIC_THIRD_PARTY_RESPONSE,
)
from reeboot.contract.compiler import RuntimeContractCompiler
from reeboot.domain.registry import DomainRegistry
from reeboot.domain.resolver import DomainResolver
from reeboot.generation.guardian import OutputGuardian
from reeboot.gep.machine import GepEngine
from reeboot.intervention.selector import InterventionSelector
from reeboot.policy.engine import PolicyEngine
from reeboot.providers.base import GenerationProvider, STTProvider, TTSProvider
from reeboot.providers.mock import MockGenerationProvider, MockSTTProvider, MockTTSProvider
from reeboot.safety.engine import SafetyEngine
from reeboot.schemas.enums import SafetyState, SessionMode
from reeboot.schemas.telemetry import DevTelemetry, TurnResult
from reeboot.session import Session
from reeboot.state.estimator import StateEstimator
from reeboot.turn.controller import TurnController


class ReebootEngine:
    """Owns the turn pipeline. Providers are adapters only."""

    def __init__(
        self,
        generation: GenerationProvider | None = None,
        stt: STTProvider | None = None,
        tts: TTSProvider | None = None,
        registry: DomainRegistry | None = None,
        show_telemetry: bool = True,
        safety_backend: str | None = None,
    ) -> None:
        self.registry = registry or DomainRegistry()
        if not self.registry.packages:
            self.registry.load()
        self.turn = TurnController()
        self.safety_backend = safety_backend or os.getenv("REEBOOT_SAFETY_BACKEND", "structured")
        if self.safety_backend == "structured":
            from reeboot.safety.contextual import ContextualSafetyEngine

            self.safety = ContextualSafetyEngine()
        else:
            self.safety = SafetyEngine()
        self.estimator = StateEstimator()
        self.resolver = DomainResolver(self.registry)
        self.selector = InterventionSelector()
        self.policy = PolicyEngine()
        self.compiler = RuntimeContractCompiler(self.registry.combined_hash())
        self.generation = generation or MockGenerationProvider()
        self.stt = stt or MockSTTProvider()
        self.tts = tts or MockTTSProvider()
        self.guardian = OutputGuardian()
        self.consent = ConsentEngine()
        self.gep = GepEngine()
        self.show_telemetry = show_telemetry

    def new_session(self, mode: SessionMode = SessionMode.TEXT) -> Session:
        session = Session(mode=mode)
        self.turn.begin_session(session)
        return session

    async def process_text(self, session: Session, user_text: str) -> TurnResult:
        started = time.perf_counter()
        session.ephemeral_user_text = user_text
        turn_id = session.next_turn_id()
        self.turn.ingest_user_text(session)

        assessment = self.safety.evaluate(user_text, session)
        gep_turn = None
        if self.safety_backend == "structured":
            gep_turn = self.gep.step(session, user_text)

        safety_state = session.safety_state
        resolution = self.resolver.resolve(user_text)
        estimate = self.estimator.estimate(user_text, resolution)
        plan = self.selector.select(safety_state, resolution, estimate)
        verdict = self.policy.decide(safety_state, plan.primitive)
        contract = self.compiler.compile(
            session=session,
            turn_id=turn_id,
            safety_state=safety_state,
            risk_flags=assessment.risk_flags,
            resolution=resolution,
            estimate=estimate,
            plan=plan,
            verdict=verdict,
        )

        used_generation = False
        if safety_state in (SafetyState.RED, SafetyState.EMERGENCY):
            self.turn.enter_safety_mode(session)
            response = _deterministic_response(safety_state, session.last_pathway)
        elif gep_turn and gep_turn.response:
            self.turn.pass_to_processing(session)
            response = gep_turn.response
            self.turn.complete_turn(session, safety_state)
        else:
            self.turn.pass_to_processing(session)
            raw = await self.generation.generate(contract, user_text)
            used_generation = True
            response = self.guardian.validate(raw, user_text, resolution.primary.value)
            self.turn.complete_turn(session, safety_state)

        session.last_primary_domain = resolution.primary
        self.consent.complete_turn(session, user_text)

        latency_ms = (time.perf_counter() - started) * 1000
        gep_stage = session.gep.stage.value if session.gep is not None else None
        telemetry = DevTelemetry(
            safety_state=safety_state,
            support_state=session.support_state,
            gep_stage=gep_stage,
            safety_plan_present=bool(session.safety_plan and session.safety_plan.present()),
            domain=resolution.primary,
            state=estimate.state,
            intervention_primitive=plan.primitive,
            policy_decision=verdict.decision,
            conversation_move=plan.move,
            fsm_state=session.fsm.state,
            processing_latency_ms=latency_ms,
            used_generation=used_generation,
            contract=contract,
        )
        result = TurnResult(response=response, used_generation=used_generation, telemetry=telemetry)
        if self.show_telemetry:
            from reeboot.telemetry.dev import print_telemetry

            print_telemetry(telemetry)
        return result


def _deterministic_response(state: SafetyState, pathway: str | None) -> str:
    if state == SafetyState.RED:
        return DETERMINISTIC_RED_RESPONSE
    if pathway == "ACUTE_VIOLENCE_DV_SAFETY_PATH":
        return DETERMINISTIC_DV_RESPONSE
    if pathway == "ACUTE_THIRD_PARTY_SAFETY_PATH":
        return DETERMINISTIC_THIRD_PARTY_RESPONSE
    return DETERMINISTIC_EMERGENCY_RESPONSE
