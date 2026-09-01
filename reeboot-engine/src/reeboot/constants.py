"""Runtime constants bound to the Gen 2 master specification."""

RUNTIME_BUILD = "2.0.0"
RUNTIME_SCHEMA = "https://schema.reeboot.ai/v1/runtime_contract.json"

SAFETY_POLICY_VERSION = "1.4.0"

GEP_DURATION_MODERATE_GATE = ">6wk"
GEP_MAX_QUESTIONS = 5
GEP_COOLDOWN_TURNS = 40

GEP_ACKNOWLEDGE = (
    "Thank you for saying that here — that's not a small thing to put into "
    "words. I want to understand it properly, if you're okay with that."
)
GEP_Q_DURATION = "How long has it been feeling like this?"
GEP_Q_PERVASIVENESS = "Is it there most days, or does it come and go?"
GEP_Q_CONNECTION = (
    "Does anyone in your life know it's been like this — a doctor, or someone close to you?"
)
GEP_Q_HISTORY = (
    "Has there ever been a time it went further than thoughts — times you hurt "
    "yourself, or came close to acting on it?"
)
GEP_Q_TETHER = (
    "You've been carrying this for a while and you're still here, still "
    "talking to me. What's kept you going through it — even on the worst days?"
)
GEP_TETHER_EMPTY = (
    "Something has, though — you're here. We don't have to name it tonight."
)
GEP_RETRACTION = (
    "Okay. We don't have to tonight. What you said still matters, and the check-in still stands."
)
GEP_MINOR_BLOCK = (
    "I hear you. For anyone under 18 I need to use a different path that includes a parent or guardian. "
    "If you need support now, Lifeline is 13 11 14."
)
GEP_AMBIENT_RESOURCES = (
    "And separately — not because of anything you've said, I do this for everyone "
    "I have these conversations with — these are the numbers that answer at 3am, "
    "saved here whenever you want them. Lifeline 13 11 14, Suicide Call Back Service "
    "1300 659 467, and 000 for emergencies."
)
GEP_PROFESSIONAL_BRIDGE = (
    "A GP can be a first step — they can write a Mental Health Treatment Plan for "
    "subsidised sessions. You don't have to arrive with the right words. We can write "
    "down what you'd want them to know."
)
GEP_DISCLOSURE_BRIDGE = (
    "If one person in your life were going to know — just one — who would make it "
    "hardest to regret telling?"
)
GEP_FOLLOWUP = (
    "I'm going to check in with you. You don't have to be better by then. You just have to be there."
)
CONSENT_POLICY_VERSION = "1.1.0"
CLAIM_POLICY_VERSION = "1.2.0"
POLICY_BUNDLE = "AU_WELLBEING_V1"

STT_MODEL_VERSION = "deepgram-nova-3"
GENERATION_MODEL_VERSION = "mock-constrained-v1"
TTS_MODEL_VERSION = "cartesia-sonic-2026-04"

AMBER_RELEASE_TURNS = 3
AMBER_RELEASE_CONFIDENCE = 0.7
RED_RELEASE_CONFIDENCE = 0.75

DETERMINISTIC_RED_RESPONSE = (
    "I hear how much you're carrying. Let's slow this down and keep you safe. "
    "If you need support now, contact Lifeline on 13 11 14 or a health professional."
)

DETERMINISTIC_EMERGENCY_RESPONSE = (
    "I hear how much pain you're in, and I want to make sure you're safe. "
    "I'm staying right here, but please connect directly with crisis support."
)

DETERMINISTIC_THIRD_PARTY_RESPONSE = (
    "I hear that someone else may be in immediate danger. "
    "Please contact emergency services now (000 in Australia) if they may be at risk. "
    "I'm staying here with you."
)

DETERMINISTIC_DV_RESPONSE = (
    "I hear that you may be in immediate danger from someone else. "
    "If you can, contact 000 or a domestic violence service now. I'm staying here with you."
)

DOMAIN_FALLBACKS = {
    "NEURO_EXEC_FUNCTION": "Let's pause and pick just one 5-second action.",
    "WORK_STRESS": "That sounds overwhelming. Let's take a single breath together.",
    "MILD_DISTRESS": "I hear you. If you'd like, we can step through this slowly.",
    "DEFAULT": "I'm here with you. What feels manageable right now?",
}

ALLOWED_REFERRAL_VOCABULARY = (
    "therapist",
    "psychologist",
    "counsellor",
    "gp",
    "doctor",
    "health professional",
    "clinical support",
    "lifeline",
)
