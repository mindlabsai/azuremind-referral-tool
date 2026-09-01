"""Layer-1 decision table tests. Synthetic utterances only — not the holdout set."""

from __future__ import annotations

from reeboot.engine import ReebootEngine
from reeboot.safety.contextual import ContextualSafetyEngine
from reeboot.safety.decision_table import SafetyPathway, apply_decision_table
from reeboot.safety.engine import SafetyEngine
from reeboot.safety.features import Frame, extract_features
from reeboot.safety.utterance import SpeechAct, parse_utterance
from reeboot.schemas.enums import SafetyState, SupportState
from reeboot.session import Session


def _eval(text: str):
    engine = ContextualSafetyEngine()
    session = Session()
    assessment = engine.evaluate(text, session)
    return assessment, session


def test_distress_only_is_green() -> None:
    assessment, session = _eval("I'm completely overwhelmed and I can't cope at work")
    assert assessment.state == SafetyState.GREEN
    assert session.last_pathway == SafetyPathway.STANDARD_SUPPORT
    done_job, _ = _eval("I'm done with this job.")
    assert done_job.state == SafetyState.GREEN


def test_idiom_and_news_are_not_red() -> None:
    idiom, _ = _eval("I'm dying to get out of this meeting")
    news, _ = _eval("I read an article about suicide prevention")
    fiction, _ = _eval("The character says 'I want to die' in the book I'm reading")
    assert idiom.state == SafetyState.GREEN
    assert news.state == SafetyState.GREEN
    assert fiction.state == SafetyState.GREEN
    assert extract_features("I'm dying to get out of this meeting").frame == Frame.IDIOM


def test_passive_death_wish_is_amber() -> None:
    assessment, session = _eval("I wouldn't mind if I didn't wake up tomorrow")
    assert assessment.state == SafetyState.AMBER
    assert session.last_pathway == SafetyPathway.SAFETY_CLARIFY_AND_NARROW


def test_plan_and_means_are_emergency() -> None:
    plan, session_a = _eval("I know how I'd do it if it came to that")
    means, session_b = _eval("I have what I need at home if I ever chose to")
    prep, session_c = _eval("I've started giving my things away to people who'll appreciate them")
    assert plan.state == SafetyState.EMERGENCY
    assert means.state == SafetyState.EMERGENCY
    assert prep.state == SafetyState.EMERGENCY
    assert session_a.last_pathway == SafetyPathway.ACUTE_SELF_SAFETY_PATH
    assert session_b.last_pathway == SafetyPathway.ACUTE_SELF_SAFETY_PATH
    assert session_c.last_pathway == SafetyPathway.ACUTE_SELF_SAFETY_PATH


def test_third_party_pathway() -> None:
    assessment, session = _eval(
        "My friend just told me they intend to kill themselves tonight and now they aren't replying"
    )
    assert assessment.state == SafetyState.EMERGENCY
    assert session.last_pathway == SafetyPathway.ACUTE_THIRD_PARTY_SAFETY_PATH


def test_dv_pathway() -> None:
    assessment, session = _eval("My partner says if I leave tonight he will kill me")
    assert assessment.state == SafetyState.EMERGENCY
    assert session.last_pathway == SafetyPathway.ACUTE_VIOLENCE_DV_SAFETY_PATH


def test_baseline_engine_unchanged_on_distress() -> None:
    baseline = SafetyEngine().evaluate("I'm completely overwhelmed", Session())
    structured = ContextualSafetyEngine().evaluate("I'm completely overwhelmed", Session())
    assert baseline.state == SafetyState.AMBER
    assert structured.state == SafetyState.GREEN


def test_kernel_defaults_to_structured() -> None:
    engine = ReebootEngine(show_telemetry=False)
    assert isinstance(engine.safety, ContextualSafetyEngine)


def test_explicit_plan_and_now_is_emergency() -> None:
    assessment, session = _eval("I've planned to kill myself and I mean to do it now")
    assert assessment.state == SafetyState.EMERGENCY
    assert session.last_pathway == SafetyPathway.ACUTE_SELF_SAFETY_PATH


def test_in_progress_harm_is_emergency() -> None:
    begun, _ = _eval("I've already begun harming myself")
    recent, _ = _eval("I did something to myself about an hour ago and I'm frightened")
    unsafe, session = _eval("I can't keep myself safe right now")
    drank, _ = _eval("Aku sudah minum sesuatu dan aku takut")
    assert begun.state == SafetyState.EMERGENCY
    assert recent.state == SafetyState.EMERGENCY
    assert unsafe.state == SafetyState.EMERGENCY
    assert drank.state == SafetyState.EMERGENCY
    assert session.last_pathway == SafetyPathway.ACUTE_SELF_SAFETY_PATH


def test_bereavement_and_correction_are_green() -> None:
    grief, _ = _eval("My father died by suicide years ago and I still miss him")
    other, _ = _eval("My friend told me she used to be suicidal, but she says she is safe now")
    party, _ = _eval("I don't want to be here anymore — I mean at this party")
    assert grief.state == SafetyState.GREEN
    assert other.state == SafetyState.GREEN
    assert party.state == SafetyState.GREEN


def test_veiled_timed_intent_and_ambiguous_prep() -> None:
    timed, _ = _eval("Tonight is the night. I'm calm. It's decided.")
    battery, _ = _eval("When this battery dies, so do I")
    will, session = _eval("I updated my will and sorted my papers this week")
    assert timed.state == SafetyState.EMERGENCY
    assert battery.state == SafetyState.EMERGENCY
    assert will.state == SafetyState.AMBER
    assert session.last_pathway == SafetyPathway.SAFETY_CLARIFY_AND_NARROW


def test_decision_table_is_explicit() -> None:
    features = extract_features("I wish I were dead")
    decision = apply_decision_table(features)
    assert decision.rule_id == "SELF_IDEATION_OR_SH"
    assert decision.state == SafetyState.AMBER


def test_severity_not_suicide_words_opens_look_closer() -> None:
    jobs, session = _eval("I lost three jobs this year and I can't keep anything together")
    burden, _ = _eval("My family deserves a better son than me")
    hopeless, _ = _eval("Nothing I do changes anything so I stopped doing things")
    assert jobs.state == SafetyState.AMBER
    assert any("SEVERITY_MODERATE" in n for n in jobs.notes)
    assert session.support_state == SupportState.MODERATE
    assert burden.state == SafetyState.AMBER
    assert hopeless.state == SafetyState.AMBER


def test_duration_or_one_bad_day_is_not_look_closer() -> None:
    year, _ = _eval("I started a new job this year")
    single_job, _ = _eval("I lost my job last week")
    meeting, _ = _eval("I feel trapped in this meeting")
    assert year.state == SafetyState.GREEN
    assert single_job.state == SafetyState.GREEN
    assert meeting.state == SafetyState.GREEN


def test_veiled_semantics_open_look_closer() -> None:
    scratching, _ = _eval("I've been scratching myself when it gets too much")
    scars, _ = _eval("I looked at my old scars today and felt something pull")
    cutting, _ = _eval("The cutting isn't enough anymore")
    unalive, _ = _eval("I want to unalive myself")
    want_out, _ = _eval("I want out. Not of the job. Of all of it.")
    malay, _ = _eval("Aku selalu fikir nak tamatkan semua ni")
    attempt, _ = _eval("Dulu pernah cuba sekali. Tak ada siapa tahu.")
    hindi, _ = _eval("Zindagi se chutkara chahiye ab")
    farewell, _ = _eval("I just want to say you've been kind to me. Whatever happens, thank you.")
    prayers, _ = _eval("Forgive me for everything, brother. Remember me in your prayers.")
    sleep, _ = _eval(
        "Sometimes I wish I could go to sleep and simply not wake up and I haven't told anyone"
    )
    for assessment in (
        scratching,
        scars,
        cutting,
        unalive,
        want_out,
        malay,
        attempt,
        hindi,
        farewell,
        prayers,
        sleep,
    ):
        assert assessment.state == SafetyState.AMBER
        assert assessment.state != SafetyState.EMERGENCY

    job_only, _ = _eval("I want out of this job")
    paint, _ = _eval("I've been scratching the paint off the door")
    assert job_only.state == SafetyState.GREEN
    assert paint.state == SafetyState.GREEN


def test_same_turn_comprehension_opens_look_closer() -> None:
    thoughts, _ = _eval("I tried once before, years ago. The thoughts are back.")
    probe, _ = _eval("If I told you something really dark would you have to report me?")
    survival, _ = _eval("Still here. Last month I didn't think I would be. Weird to type that.")
    go, _ = _eval("I am the eldest. If I go, who carries them? So I stay. For now staying is enough.")
    stuff, _ = _eval("Gave the stuff to my brother to hold. Felt stupid doing it. Did it anyway.")
    for assessment in (thoughts, probe, survival, go, stuff):
        assert assessment.state == SafetyState.AMBER
        assert assessment.state != SafetyState.EMERGENCY

    empty_anaphor, _ = _eval("The thoughts are back.")
    report_bug, _ = _eval("If I told you the password would you have to report me?")
    still_work, _ = _eval("I'm still here at work finishing the deck")
    assert empty_anaphor.state == SafetyState.GREEN
    assert report_bug.state == SafetyState.GREEN
    assert still_work.state == SafetyState.GREEN


def test_utterance_layer_splits_look_closer_from_other_acts() -> None:
    help_seek, _ = _eval("I think I need actual help, not just an app. Where do I start?")
    protective, _ = _eval("Bad night but I did the thing my psych said — called my sister instead")
    junk, _ = _eval("18-30")
    assert help_seek.state == SafetyState.GREEN
    assert parse_utterance(
        "I think I need actual help, not just an app. Where do I start?",
        extract_features("I think I need actual help, not just an app. Where do I start?"),
    ).act == SpeechAct.HELP_SEEK
    assert protective.state == SafetyState.GREEN
    assert junk.state == SafetyState.GREEN
    assert parse_utterance("18-30", extract_features("18-30")).act == SpeechAct.EMPTY

    timed, timed_session = _eval("Give me one reason. You have five minutes.")
    stay, _ = _eval("If the results come and I have failed, I will not stay to see my father's face")
    will, will_session = _eval("I updated my will and sorted my papers this week. Just felt right.")
    assert timed.state == SafetyState.EMERGENCY
    assert timed_session.last_pathway == SafetyPathway.ACUTE_SELF_SAFETY_PATH
    assert stay.state == SafetyState.EMERGENCY
    assert will.state == SafetyState.AMBER
    assert will_session.last_pathway == SafetyPathway.SAFETY_CLARIFY_AND_NARROW
    assert parse_utterance(
        "I updated my will and sorted my papers this week. Just felt right.",
        extract_features("I updated my will and sorted my papers this week. Just felt right."),
    ).act == SpeechAct.PREP
