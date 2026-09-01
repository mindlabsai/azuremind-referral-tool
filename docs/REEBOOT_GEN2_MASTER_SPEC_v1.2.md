# Reeboot Gen 2 Master Specification

**Version:** 1.2  
**Status:** DESIGN FROZEN — PROTOTYPE IMPLEMENTATION AUTHORISED
Final Reeboot Gen 2 Engineering Master Specification (v1.2) — Design Freeze Candidate
Core Axiom: The model generates language. Reeboot owns state, safety, intervention selection, consent, escalation, and session behavior.
Deployment Model: Single-Process Modular Monolith Micro-Kernel (Async Python Core Engine)
Target Latency: < 500ms Perceived Turnaround (Time-to-First-Audio)
Launch Scope: 3 Core Domains (MILD_DISTRESS, NEURO_EXEC_FUNCTION, WORK_STRESS)
1. System Architecture: Modular Monolith Micro-Kernel
Gen 2 executes all turn-handling logic within a single process (reeboot-engine). Sub-systems operate as in-memory modules communicating via strictly typed schemas over an internal event loop. Network microservices are explicitly prohibited for core turn-handling to prevent serial latency accumulation.
┌────────────────────────────────────────────────────────────────────────┐
│                          CLIENT EDGE DEVICE                            │
│ ┌────────────────────────┐  ┌─────────────────────┐  ┌──────────────┐ │
│ │ Edge VAD (Silero C++)  │  │ Hardware AEC (WebRTC│  │ Playback Ctrl│ │
│ └───────────┬────────────┘  └──────────┬──────────┘  └──────┬───────┘ │
└─────────────┼──────────────────────────┼────────────────────┼─────────┘
              │ PCM Audio Bytes          │ Barge-In Signal    │ Audio Offset
              └──────────────────────────┴──────────┬─────────┘
                                                    │ Encrypted WSS
                                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│             REEBOOT GEN 2 RUNTIME ENGINE (SINGLE CONTAINER)            │
│                                                                        │
│ ┌────────────────────────────────────────────────────────────────────┐ │
│ │ 1. Session Gateway & Executable Consent Engine                     │ │
│ └──────────────────────────────────┬─────────────────────────────────┘ │
│                                    ▼                                   │
│ ┌────────────────────────────────────────────────────────────────────┐ │
│ │ 2. Dynamic Turn Controller (Adaptive VAD FSM)                      │ │
│ └──────────────────────────────────┬─────────────────────────────────┘ │
│                                    ▼                                   │
│ ┌────────────────────────────────────────────────────────────────────┐ │
│ │ 3. Streaming STT Ingest (Deepgram Nova-3 Async Client)             │ │
│ └──────────────────────────────────┬─────────────────────────────────┘ │
│                                    ▼                                   │
│ ┌────────────────────────────────────────────────────────────────────┐ │
│ │ 4. Multi-Layer Safety Engine (All-State Evaluator + Echo Sanitiser)│ │
│ └──────────────────────────────────┬─────────────────────────────────┘ │
│                                    ▼                                   │
│ ┌────────────────────────────────────────────────────────────────────┐ │
│ │ 5. State Estimator & Domain Resolver                               │ │
│ └──────────────────────────────────┬─────────────────────────────────┘ │
│                                    ▼                                   │
│ ┌────────────────────────────────────────────────────────────────────┐ │
│ │ 6. Intervention & Feature Regulatory Matrix Engine                 │ │
│ └──────────────────────────────────┬─────────────────────────────────┘ │
│                                    ▼                                   │
│ ┌────────────────────────────────────────────────────────────────────┐ │
│ │ 7. Runtime Contract Compiler (Contract + Policy Provenance)        │ │
│ └──────────────────────────────────┬─────────────────────────────────┘ │
│                                    ▼                                   │
│ ┌────────────────────────────────────────────────────────────────────┐ │
│ │ 8. Constrained LLM Generation Engine (Groq Llama-3.3-70B)          │ │
│ └──────────────────────────────────┬─────────────────────────────────┘ │
│                                    ▼                                   │
│ ┌────────────────────────────────────────────────────────────────────┐ │
│ │ 9. Semantic Output Guardian (Domain Fallbacks & Direct Referral)   │ │
│ └──────────────────────────────────┬─────────────────────────────────┘ │
│                                    ▼                                   │
│ ┌────────────────────────────────────────────────────────────────────┐ │
│ │ 10. Streaming TTS Synthesizer (Cartesia Sonic Client)              │ │
│ └────────────────────────────────────────────────────────────────────┘ │
└────────────────────────────────────┬───────────────────────────────────┘
                                     │ Streamed Audio / Canvas UI Payload
                                     ▼
                            [ USER AUDIO PLAYER ]

2. Dynamic Turn Controller FSM & Echo-Sanitised Input
The Turn Controller drives session state via a deterministic state machine. Dynamic VAD silence thresholds are dynamically injected into the FSM per turn based on domain and arousal context (250ms for micro-actions; up to 1,500ms for emotional processing).
Safety classifiers run across all states but are strictly bound to user-originating audio to prevent feedback classification of system TTS output.
                  ┌────────────────┐
                  │      IDLE      │
                  └───────┬────────┘
                          │ Session Connect
                          ▼
┌────────────────────────►│   LISTENING    │◄─────────────────────────┐
│                         └───────┬────────┘                          │
│                                 │                                   │
│                  [ Edge VAD: User Speech Start ]                    │
│                                 │                                   │
│                                 ▼                                   │
│                         ┌────────────────┐                          │
│                         │ USER_SPEAKING  │                          │
│                         └───────┬────────┘                          │
│                                 │                                   │
│                  [ Dynamic Endpoint Silence Met ]                   │
│                  [ Domain/Arousal Dependent: 250-1500ms ]           │
│                                 │                                   │
│                                 ▼                                   │
│                         ┌────────────────┐                          │
│                         │ENDPOINT_PENDING│                          │
│                         └───────┬────────┘                          │
│                                 │                                   │
│                       [ State & Safety Pass ]                       │
│                                 │                                   │
│                                 ▼                                   │
│                         ┌────────────────┐                          │
│                         │   PROCESSING   │                          │
│                         └───────┬────────┘                          │
│                                 │                                   │
│                      [ First Audio Token Out ]                      │
│                                 │                                   │
│                                 ▼                                   │
│                         ┌────────────────┐                          │
│                         │    SPEAKING    ├──────────────────────────┤
│                         └───────┬────────┘ Turn Complete            │
│                                 │                                   │
│                  [ Client Barge-In Event ]                          │
│                                 │                                   │
│                                 ▼                                   │
│                         ┌────────────────┐                          │
│                         │  INTERRUPTED   ├──────────────────────────┘
│                         └────────────────┘ User Spoke
│                                 │
│                   [ Safety Trigger Evaluation ]
│                   (Evaluated on User Audio ONLY)
│                                 │
│                                 ▼
│                         ┌────────────────┐
│                         │  SAFETY_MODE   │
│                         └────────────────┘
│                (RED/EMERGENCY Override Applied)

Safety Classifier Audio Ingest Constraint
safety_classifier_input_source: USER_AUDIO_ONLY
aec_required: true
ignore_sources:
  - agent_playback_reference
  - probable_echo_transcript

3. Four-Tier Safety Engine & Sticky De-Escalation Protocol
Lexical matches emit signals, not absolute safety states. A lexical hit (e.g., "suicide") generates SELF_HARM_LEXICAL_MATCH for contextual evaluation rather than an automatic hard escalation to EMERGENCY. Hard escalation requires self-reference + immediate intent + active threat criteria.
                           [ User Input Stream ]
                                     │
           ┌─────────────────────────┴─────────────────────────┐
           ▼                                                   ▼
 [ Layer 0: Lexical Floor ]                           [ Layer 1: Contextual Model ]
   Emits Contextual Signals                            Edge Semantic Classifier
           │                                                   │
           └─────────────────────────┬─────────────────────────┘
                                     ▼
                        ┌──────────────────────────┐
                        │ Evaluated Safety State   │
                        └────────────┬─────────────┘
                                     │
       ┌───────────────────┬─────────┴───────────┬───────────────────┐
       ▼                   ▼                     ▼                   ▼
 ┌───────────┐       ┌───────────┐         ┌───────────┐       ┌───────────┐
 │   GREEN   │       │   AMBER   │         │    RED    │       │ EMERGENCY │
 └─────┬─────┘       └─────┬─────┘         └─────┬─────┘       └─────┬─────┘
       │                   │                     │                   │
  Standard            Narrowed               Deterministic       Deterministic
  Generation          Primitives             Safety Path         Safety Path +
                      & Constraints          (No LLM)            1-Tap UI Cards

State Transition & De-Escalation Hysteresis Rules
GREEN  ──► AMBER: Threshold crossing on contextual distress classifier.
AMBER  ──► GREEN: Requires:
                   - Minimum observation window (3 turns)
                   - Zero escalation indicators
                   - Classifier confidence above release threshold
                   - Positive state evidence supporting reduction

AMBER  ──► RED:    High distress, severe hopelessness, passive ideation.
RED    ──► AMBER:  Permitted ONLY when:
                   - Immediate-risk indicators no longer present
                   - Deterministic safety checks completed
                   - User provides safety-oriented responses
                   - Classifier confidence meets release threshold
RED    ──► GREEN:  PROHIBITED DIRECTLY (Must transition via AMBER).

*      ──► EMERGENCY: Lexical match containing self-reference + immediate intent + active threat.
EMERGENCY ──► ANY:    LOCKED FOR SESSION DURATION. Requires session termination.

4. Canonical Runtime Contract (with Policy Provenance)
The Runtime Contract Compiler produces an immutable JSON payload every turn, representing the sole input provided to the generation LLM.
{
  "$schema": "https://schema.reeboot.ai/v1/runtime_contract.json",
  "session": {
    "session_id": "sess_883011",
    "turn_id": "turn_10492",
    "mode": "VOICE"
  },
  "safety": {
    "state": "GREEN",
    "risk_flags": []
  },
  "user_state": {
    "primary_domain": "NEURO_EXEC_FUNCTION",
    "secondary_domains": ["WORK_STRESS"],
    "state": "TASK_INITIATION_BLOCK",
    "arousal": "HIGH"
  },
  "intervention": {
    "primitive": "MICRO_ACTION",
    "objective": "REDUCE_INITIATION_THRESHOLD",
    "constraints": {
      "maximum_actions": 1,
      "maximum_action_time_seconds": 5
    }
  },
  "conversation": {
    "move": "DIRECTIVE_MICRO_PROMPT",
    "maximum_words": 18,
    "allow_question": true
  },
  "voice": {
    "pace": "LOW_AROUSAL",
    "barge_in_enabled": true,
    "endpoint_silence_threshold_ms": 1200
  },
  "claims": {
    "product_mode": "WELLBEING",
    "claim_ceiling": "NON_DIAGNOSTIC_NON_TREATMENT",
    "jurisdiction": "AU",
    "clinical_actions_allowed": false,
    "medication_guidance_allowed": false,
    "diagnostic_inference_allowed": false
  },
  "consent": {
    "voice_processing": true,
    "raw_audio_retention": false,
    "transcript_retention": false,
    "longitudinal_memory": false,
    "research_use": false
  },
  "policy": {
    "policy_bundle": "AU_WELLBEING_V1",
    "decision": "ALLOW",
    "authorised_primitive": "MICRO_ACTION"
  },
  "provenance": {
    "runtime_build": "2.0.0",
    "domain_package_hash": "sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    "safety_policy_version": "1.3.0",
    "consent_policy_version": "1.1.0",
    "claim_policy_version": "1.2.0",
    "stt_model_version": "deepgram-nova-3",
    "generation_model_version": "groq-llama-3.3-70b",
    "tts_model_version": "cartesia-sonic-2026-04"
  }
}

5. Executable Consent & Privacy Compliance Engine
Lifecycle Memory Policy
No application-level persistence occurs when transcript_retention: false. Ephemeral turn buffers in memory are dereferenced immediately at turn completion and explicitly excluded from application logs, cache tiers, and durable storage. Downstream vendor zero-retention policies are contractually enforced via API configurations.
                         [ Engine Event Triggered ]
                                     │
                     [ Event Classification Check ]
                                    ╱ \
                                   ╱   \
                      [ USER DATA ]     [ GOVERNANCE / SAFETY ]
                                 ╱       \
                                ╱         \
                               ▼           ▼
                   [ Consent Ledger Check ]  [ Hash Raw Audio / Text ]
                    transcript_retention?   [ Write Anonymized Hash ]
                           ╱ \                      │
                  [ TRUE ]╱   \[ FALSE ]            │
                         ╱     \                    │
                        ▼       ▼                   │
                ┌──────────┐  ┌──────────────────┐  │
                │ Write DB │  │ DEREFERENCE MEM  │  │
                └──────────┘  │ Exclude Logs/DB  │  │
                              └──────────────────┘  │
                                        │           │
                                        ▼           ▼
                               ┌──────────────────────────┐
                               │ Immutable Audit Trail    │
                               └──────────────────────────┘

6. Semantic Output Guardian
The Output Guardian screens generated content for non-diagnostic claim compliance while permitting valid clinician referrals and ignoring echoed user statements.
ALLOWED_REFERRAL_VOCABULARY = {
    "therapist", "psychologist", "counsellor", "gp", "doctor",
    "health professional", "clinical support", "lifeline"
}

PROHIBITED_CLAIM_PATTERNS = [
    r"\bi (can|will) (diagnose|treat|cure|heal)\b",
    r"\bthis is (a treatment for|therapy for|a cure for)\b",
    r"\byou have (adhd|depression|anxiety|ptsd)\b"
]

DOMAIN_FALLBACKS = {
    "NEURO_EXEC_FUNCTION": "Let's pause and pick just one 5-second action.",
    "WORK_STRESS": "That sounds overwhelming. Let's take a single breath together.",
    "MILD_DISTRESS": "I hear you. If you'd like, we can step through this slowly.",
    "DEFAULT": "I'm here with you. What feels manageable right now?"
}

def validate_generated_output(text: str, user_text: str, domain: str) -> str:
    normalized_gen = text.lower()
    for pattern in PROHIBITED_CLAIM_PATTERNS:
        if re.search(pattern, normalized_gen):
            log_governance_event(event_type="CLAIM_VIOLATION", pattern=pattern)
            return DOMAIN_FALLBACKS.get(domain, DOMAIN_FALLBACKS["DEFAULT"])
    return text

7. Clinical Governance & Domain Registry
Domains are configured as versioned packages under /domain_registry.
File Structure
/domain_registry
├── /neuro_exec_function
│   ├── manifest.yaml
│   ├── states.yaml
│   ├── interventions.yaml
│   ├── language_rules.yaml
│   ├── safety_overrides.yaml
│   ├── evidence.md
│   └── tests.yaml
├── /work_stress
│   └── ...
└── /mild_wellbeing_distress
    └── ...

8. Integrated Engineering Roadmap & Safety Eval Harness
Safety eval datasets, classifier precision/recall targets, and continuous red-teaming harnesses are bound directly to Milestone 2.
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                              RESEQUENCED MILESTONE ROADMAP                             │
├───────────┬────────────────────────────────┬───────────────────────────────────────────┤
│ Milestone │ Focus Scope                    │ Verified Deliverable & Acceptance Gate    │
├───────────┼────────────────────────────────┼───────────────────────────────────────────┤
│ M0        │ Runtime Foundation             │ Turn FSM, Runtime Contract compiler,      │
│           │                                │ session state, consent engine.            │
├───────────┼────────────────────────────────┼───────────────────────────────────────────┤
│ M1        │ Voice Pipeline & Edge Controls │ Full-duplex WebSocket, adaptive VAD,      │
│           │                                │ barge-in, playback offset tracking.       │
├───────────┼────────────────────────────────┼───────────────────────────────────────────┤
│ M2        │ Safety Core & Eval Harness     │ 4-level safety engine, Layer 0/1          │
│           │                                │ classifiers, test corpus (>99% recall).   │
├───────────┼────────────────────────────────┼───────────────────────────────────────────┤
│ M3        │ Domain Runtime Engine          │ Registry compiler loading initial 3       │
│           │                                │ domains and intervention primitives.      │
├───────────┼────────────────────────────────┼───────────────────────────────────────────┤
│ M4        │ Generation & Output Guardian   │ Constrained LLM execution, semantic claim │
│           │                                │ validator, domain-aware fallbacks.        │
├───────────┼────────────────────────────────┼───────────────────────────────────────────┤
│ M5        │ Resilience & Failover          │ Voice-to-text silent fallback, auto-     │
│           │                                │ reconnect, streaming degradation.         │
├───────────┼────────────────────────────────┼───────────────────────────────────────────┤
│ M6        │ Governance & Audit Engine      │ Versioned package approval verification,  │
│           │                                │ hashed privacy-safe audit logging.        │
├───────────┼────────────────────────────────┼───────────────────────────────────────────┤
│ M7        │ Longitudinal Vault (Opt-in)    │ Consent-governed profile store, retention │
│           │                                │ controls, user export/purge pipelines.    │
├───────────┼────────────────────────────────┼───────────────────────────────────────────┤
│ M8        │ System Validation & Trial      │ End-to-end integration testing, latency  │
│           │                                │ distribution check (<500ms TTFA), trial.  │
└───────────┴────────────────────────────────┴───────────────────────────────────────────┘

Regulatory Position Paper (v1.2)
1. Australian Regulatory Design Position
Reeboot Gen 2 is engineered so that applicable functionality can be evaluated against exclusions in Schedule 1 of the Therapeutic Goods (Excluded Goods) Determination 2018, including Item 14E (digital mental health tools based on established clinical practice guidelines) and Item 14C (behavioural change and coaching software). Exclusion status is determined feature-by-feature based on intended purpose, claims, and underlying guideline mappings prior to commercial release.
Regulatory Feature Matrix
| Capability | Intended Purpose | Target Exclusion / Regulatory Framework |
|---|---|---|
| Work Overload Coaching | General wellbeing / behavioural change | Item 14C Exclusion Assessment |
| Executive Function Coaching | Behavioural support & micro-actions | Item 14C / Non-SaMD Boundary Assessment |
| Wellbeing Reframing | Digital Mental Health Tool (DMHT) | Item 14E Exclusion (Requires guideline display) |
| Crisis Signposting | Access & safety signposting | Assessed under overall non-clinical intended purpose |
| Diagnostic Inference / Tx | Medical Device Functionality | PROHIBITED IN GEN 2 RUNTIME |
2. UAE Sovereign Deployment Policy
Jurisdictional policies conform to Federal Law No. 2 of 2019 and Ministerial Resolution No. 51 of 2021. In-region data processing is configured as the default architecture policy:
jurisdiction: UAE
default_processing_region: UAE (aws-me-central-1)
cross_border_processing: DENY_BY_DEFAULT
exception_requires:
  - legal_basis
  - authority_basis
  - governance_approval
  - processor_record

3. New Zealand Regulatory Framework
Where deployed to provide health or disability services within New Zealand, system functionality and consent flows comply with the Code of Health and Disability Services Consumers' Rights and the Privacy Act 2020.
EMERGENCY Duty-of-Care Protocol (v1.2)
1. Disconnection & Silence Protocol in EMERGENCY State
When a session enters EMERGENCY state (triggered by explicit self-harm intent with active threat):
 * Server Non-Termination: The server never terminates the WebSocket connection.
 * Audio Overrides: LLM generation ceases. The server pipes static audio: "I hear how much pain you're in, and I want to make sure you're safe. I'm staying right here, but please connect directly with crisis support."
 * Safety Canvas Lock: Client UI locks to an un-dismissible UI displaying 1-tap dialers (13 11 14 Lifeline, 000 Emergency Services).
 * Disconnection Scope: Reeboot functions as a non-diagnostic sub-acute wellbeing tool without direct human clinical monitoring. It does not perform active emergency service dispatch or PII location tracking upon user drop. Reconnection attempts persist for 120 seconds, restoring directly to the Safety Canvas upon re-establishment.
2. Medico-Legal Approvals
Release of this runtime requires formal sign-off by the Reeboot Clinical Governance Committee and an active AHPRA-registered clinical lead signature recorded in /domain_registry/manifest.yaml.
