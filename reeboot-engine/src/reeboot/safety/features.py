"""Structured Layer-1 feature extractor.

Independent of Layer 0 lexical.py. Emits features, never a safety state.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from enum import Enum

from reeboot.schemas.enums import SupportState
from reeboot.safety.severity import extract_severity


class Subject(str, Enum):
    SELF = "SELF"
    OTHER = "OTHER"
    SELF_EXPOSED_TO_OTHER = "SELF_EXPOSED_TO_OTHER"


class Temporality(str, Enum):
    HISTORICAL = "HISTORICAL"
    CURRENT = "CURRENT"
    IMMEDIATE = "IMMEDIATE"


class Ideation(str, Enum):
    NONE = "NONE"
    PASSIVE = "PASSIVE"
    ACTIVE = "ACTIVE"
    UNSPECIFIED = "UNSPECIFIED"


class Intent(str, Enum):
    NONE = "NONE"
    PRESENT = "PRESENT"
    ACUTE = "ACUTE"


class Plan(str, Enum):
    NONE = "NONE"
    NONSPECIFIC = "NONSPECIFIC"
    MEANS = "MEANS"
    PREPARATORY = "PREPARATORY"
    CURRENT_ACTION = "CURRENT_ACTION"


class Frame(str, Enum):
    LITERAL = "LITERAL"
    NEGATED = "NEGATED"
    QUOTED = "QUOTED"
    FICTIONAL = "FICTIONAL"
    NEWS = "NEWS"
    IDIOM = "IDIOM"
    HISTORICAL_DISCLOSURE = "HISTORICAL_DISCLOSURE"
    BEREAVEMENT = "BEREAVEMENT"
    CORRECTION = "CORRECTION"


@dataclass(frozen=True)
class SafetyFeatures:
    subject: Subject
    temporality: Temporality
    ideation: Ideation
    intent: Intent
    plan: Plan
    frame: Frame
    third_party_imminent: bool
    dv_acute: bool
    self_harm_disclosure: bool
    ambiguous_safety: bool
    severity_moderate: bool = False
    severity_families: tuple[str, ...] = ()
    support_hint: SupportState = SupportState.UNRESOLVED
    discourse_look_closer: bool = False
    discourse_ops: tuple[str, ...] = ()
    notes: tuple[str, ...] = ()

    def as_signals(self) -> list[str]:
        flags = [
            f"SUBJECT_{self.subject.value}",
            f"TEMPORALITY_{self.temporality.value}",
            f"IDEATION_{self.ideation.value}",
            f"INTENT_{self.intent.value}",
            f"PLAN_{self.plan.value}",
            f"FRAME_{self.frame.value}",
        ]
        if self.third_party_imminent:
            flags.append("THIRD_PARTY_IMMINENT")
        if self.dv_acute:
            flags.append("DV_ACUTE")
        if self.self_harm_disclosure:
            flags.append("SELF_HARM_DISCLOSURE")
        if self.ambiguous_safety:
            flags.append("AMBIGUOUS_SAFETY")
        if self.severity_moderate:
            flags.append("SEVERITY_MODERATE")
            flags.extend(self.severity_families)
        if self.discourse_look_closer:
            flags.append("DISCOURSE_LOOK_CLOSER")
            flags.extend(self.discourse_ops)
        return flags


def _rx(*patterns: str) -> re.Pattern[str]:
    return re.compile("|".join(f"(?:{p})" for p in patterns), re.IGNORECASE)


IDIOM = _rx(
    r"\bdying to\b",
    r"\bdead (?:tired|set|serious|right)\b",
    r"\bbattery is dead\b",
    r"\bphone battery\b",
    r"\bkill time\b",
    r"\bkilling time\b",
    r"\bdeadline is killing\b",
    r"\bthis (?:job|meeting|week|inbox) is killing me\b",
    r"\bover my dead body\b",
    r"\bdrop dead gorgeous\b",
    r"\bdead easy\b",
    r"\bdead quiet\b",
)
NEWS = _rx(
    r"\barticle\b",
    r"\bnews\b",
    r"\bstatistics\b",
    r"\bprevention\b",
    r"\bawareness\b",
    r"\bdocumentary\b",
    r"\bheadline\b",
    r"\bstudy (?:says|found|shows)\b",
)
FICTION = _rx(
    r"\bcharacter\b",
    r"\bin the (?:book|movie|novel|show|episode|game|film|series)\b",
    r"\bthe book i(?:['’]m| am) reading\b",
    r"\bplot\b",
    r"\bfictional\b",
)
QUOTED = _rx(
    r"\bsays\s+[“”\"']",
    r"\bsaid\s+[“”\"']",
    r"[“\"][^“”\"]*(?:want to die|kill myself|suicide)[^“”\"]*[”\"]",
)
HISTORICAL = _rx(
    r"\byears ago\b",
    r"\ba long time ago\b",
    r"\bwhen i was (?:a kid|younger|little|teen)\b",
    r"\bin the past\b",
    r"\bused to\b",
    r"\bpart of my history\b",
    r"\bback then\b",
)
BEREAVEMENT = _rx(
    r"\bdied by suicide\b",
    r"\blost (?:my )?(?:dad|mum|mom|father|mother|friend|brother|sister|partner) to suicide\b",
    r"\bstill miss (?:him|her|them)\b",
    r"\b(?:friend|dad|mum|mom|father|mother|he|she) .{0,40}used to be suicidal\b",
    r"\btold me she used to be suicidal\b",
    r"\bsays she is safe now\b",
)
CORRECTION = _rx(
    r"\bi mean at this (?:party|work|job|meeting|dinner|place|house)\b",
    r"\bi mean (?:the party|work|here at)\b",
)
NEGATION = _rx(
    r"\bdon['’]?t want to (?:die|kill|hurt)\b",
    r"\bdo not want to (?:die|kill|hurt)\b",
    r"\bnot suicidal\b",
    r"\bno (?:intent|plan) to\b",
    r"\bi(?:['’]m| am) not going to (?:do it|hurt|kill)\b",
    r"\bi would never\b",
)
IMMEDIATE = _rx(
    r"\btonight\b",
    r"\bright now\b",
    r"\babout to\b",
    r"\bthis (?:morning|afternoon|evening|weekend)\b",
    r"\bin the next (?:hour|few hours)\b",
    r"\bbefore (?:sunrise|morning|dawn)\b",
    r"\bdo it now\b",
    r"\bmean to do it now\b",
    r"\bact on it (?:now|soon|tonight)\b",
    r"\babout an hour ago\b",
)
PASSIVE = _rx(
    r"\bwish i (?:was|were|could be) dead\b",
    r"\bwant to die\b",
    r"\bbetter off dead\b",
    r"\bbetter off without me\b",
    r"\bdon['’]?t want to be here\b",
    r"\bwish i (?:wasn['’]?t|weren['’]?t|was not|were not) here\b",
    r"\bwish i (?:wasn['’]?t|was not) around\b",
    r"\bjust wish i wasn['’]?t around\b",
    r"\bnothing will (?:ever )?change\b",
    r"\bwhat['’]?s the point of (?:living|life|going on)\b",
    r"\bi can['’]?t see a way (?:out|through)\b",
    r"\bwish i could just disappear\b",
    r"\bjust disappear\b",
    r"\btake me in my sleep\b",
    r"\bwish god would\b",
    r"\bfantasize about getting a serious illness\b",
    r"\bstop existing\b",
    r"\bnggak bangun lagi\b",
    r"\bjeene ka mann nahi\b",
    r"\b躺平\b",
    r"\bwouldn['’]?t mind if i didn['’]?t wake up\b",
    r"\bdidn['’]?t wake up tomorrow\b",
    r"\b(?:go to sleep|go to bed).{0,40}not wake up\b",
    r"\bsimply not wake up\b",
    r"\bwant out\b.{0,80}\b(?:of all of (?:it|this)|not of the (?:job|work))\b",
    r"\bwant out\b.{0,40}\bof all of it\b",
    r"\bif a (?:bus|car|truck) hit me\b",
    r"\bwouldn['’]?t be that bothered\b",
    r"\bmove on (?:fine )?without me\b",
    r"\btired of living\b",
    r"\bno reason to live\b",
    r"\bcan['’]?t go on\b",
    r"\bworld would be better without me\b",
    r"\bnak hilang\b",
    r"\bhilang .{0,20}dunia\b",
    r"\btak nak hidup\b",
)
ACTIVE = _rx(
    r"\bkill(?:ing)? myself\b",
    r"\bend my life\b",
    r"\bend it all\b",
    r"\bsuicide\b",
    r"\bsuicidal\b",
    r"\bthoughts about (?:killing|dying|suicide|ending)\b",
    r"\bthinking about (?:killing myself|ending (?:it|my life)|suicide)\b",
    r"\bunalive\b",
    r"\btamatkan\b",
    r"\bzindagi se chutkara\b",
    r"\bchutkara chahiye\b",
    r"\bsuicide has been on my mind\b",
    r"\bhurt myself\b",
    r"\bharm(?:ing)? myself\b",
    r"\bself[- ]harm\b",
    r"\bbunuh diri\b",
    r"\b伤害自己\b",
    r"\b结束\b",
)
INTENT_PRESENT = _rx(
    r"\bnot doing this anymore.{0,30}life\b",
    r"\blife, i mean\b",
    r"\bstopped fighting\b",
    r"\bgone quiet\b",
    r"\bdone with (?:life|living|all of this)\b",
    r"\bi(?:['’]m| am) ready to (?:go|die|end)\b",
    r"\bthis is goodbye\b",
    r"\bsaid my goodbyes\b",
    r"\bby the time anyone reads this\b",
    r"\bi won['’]?t be (?:here|around)\b",
    r"\bi(?:['’]m| am) not going to be here\b",
    r"\bi(?:['’]m| am) (?:going to|gonna|about to) (?:do it|end|hurt|kill|go)\b",
    r"\babout to (?:do something to )?(?:hurt|harm|kill) myself\b",
    r"\bcan['’]?t stop myself from hurting\b",
    r"\bit ends tonight\b",
    r"\bit will be done\b",
    r"\baaj raat\b",
    r"\bmalam ni aku akan pergi\b",
    r"\bkhatam kar\b",
    r"\bmengakhiri hidup\b",
    r"\b今晚\b",
    r"\bi mean to do it\b",
    r"\bi intend to act\b",
    r"\bintend to act on it\b",
    r"\bi(?:['’]m| am) planning to do it\b",
    r"\bplanning to do it soon\b",
    r"\bit['’]?s decided\b",
    r"\bwhen this (?:battery|phone) dies, so do i\b",
    r"\bi can['’]?t keep myself safe\b",
    r"\bnot safe with myself\b",
    r"غير آمن مع نفسي",
)
PLAN_NONSPECIFIC = _rx(
    r"\bi know how i['’]?d do it\b",
    r"\bhow i would do it\b",
    r"\bthought it through.{0,40}in detail\b",
    r"\bin detail.{0,20}thought\b",
    r"\bi have a (?:suicide )?plan\b",
    r"\bi(?:['’]ve| have) (?:made a )?planned? to\b",
    r"\bmade a plan\b",
    r"\bsuicide plan\b",
    r"\bi know what i(?:['’]d| would) do\b",
)
PLAN_MEANS = _rx(
    r"\bi have what i need\b",
    r"\bi have the means\b",
    r"\baccess to (?:pills|medication|a weapon|means)\b",
    r"\bpills (?:in|at) (?:the house|home)\b",
    r"\bif i ever chose to\b",
    r"\bcollecting what i['’]?d need\b",
    r"\bthere are ways\b",
)
PLAN_PREP = _rx(
    r"\bgiving (?:my|away) (?:my )?things away\b",
    r"\bgiving my things away\b",
    r"\bsaying goodbye\b",
    r"\bgoodbye (?:letters|notes|messages)\b",
    r"\bputting (?:my )?affairs in order\b",
    r"\bwrote letters\b",
    r"\bwritten the apology\b",
    r"\brehomed\b",
    r"\bletters to my (?:kids|children|parents)\b",
    r"\bpreparing to end my life\b",
    r"\bstarted preparing\b",
)
CURRENT_ACTION = _rx(
    r"\bi (?:already|just) (?:took|done|did) it\b",
    r"\bi(?:['’]m| am) doing it (?:now|right now)\b",
    r"\bi have just\b",
    r"\bin progress\b",
    r"\bin the middle of hurting\b",
    r"\bhurting myself (?:right now|at the moment|now)\b",
    r"\balready started hurting\b",
    r"\bstarted (?:doing something to )?harm myself\b",
    r"\bstarted hurting myself\b",
    r"\balready begun harming\b",
    r"\bbegun harming myself\b",
    r"\bdid something to myself\b",
    r"\budah minum\b",
    r"\bsudah minum\b",
)
SH_DISCLOSURE = _rx(
    r"\bcut myself\b",
    r"\bself[- ]harm(?:ed|ing)?\b",
    r"\bold habits.{0,20}coming back\b",
    r"\bi(?:['’]ve| have) been (?:cutting|hurting|scratching) myself\b",
    r"\bscratch(?:ing|ed)? myself\b",
    r"\bold scars\b",
    r"\bthe cutting\b",
    r"\bcutting isn['’]?t enough\b",
    r"\battempted suicide\b",
    r"\bprior attempt\b",
    r"\bpernah cuba\b",
    r"\bcuba sekali\b",
)
DV_ACUTE = _rx(
    r"\b(?:he|she|they|partner|boyfriend|girlfriend|husband|wife|ex) .*(?:kill me|hurt me|weapon|threatening)\b",
    r"\bkill me\b",
    r"\bhurt me\b",
    r"\bthreatening (?:to )?(?:hurt|kill|serious violence)",
    r"\boutside (?:the )?(?:house|door|waiting)\b",
    r"\bweapon in the (?:house|car)\b",
    r"\bi(?:['’]m| am) hiding\b",
    r"\bscared to open the door\b",
    r"\bif i (?:leave|try to leave).{0,30}kill me\b",
    r"\bthreatened to kill me\b",
)
DV_ACTOR = _rx(
    r"\b(?:my )?(?:partner|boyfriend|girlfriend|husband|wife|ex)\b",
    r"\bhe['’]?s\b",
    r"\bshe['’]?s\b",
)
THIRD_PARTY_PERSON = _rx(
    r"\bmy (?:friend|mate|sister|brother|dad|mum|mom|mother|father|son|daughter|colleague|roommate)\b",
    r"\bsomeone i (?:care|love)\b",
    r"\bsomeone i care about\b",
)
THIRD_PARTY_HARM = _rx(
    r"\bkill themselves\b",
    r"\bkilling themselves\b",
    r"\bhurt themselves\b",
    r"\bend (?:their|her|his) life\b",
    r"\bplans to die\b",
    r"\bintend(?:s|ed)? to kill themselves\b",
    r"\bgoodbye message\b",
    r"\bmessaged me goodbye\b",
    r"\blocked (?:himself|herself|themselves)\b",
    r"\ba way to hurt (?:himself|herself|themselves)\b",
    r"\bnot (?:answering|replying)\b",
    r"\baren['’]?t (?:answering|replying)\b",
    r"\bcan['’]?t reach (?:her|him|them)\b",
    r"\bstopped answering\b",
    r"\bsuicide plan\b",
    r"\bhe means it\b",
)
AMBIGUOUS = _rx(
    r"\bdark thoughts\b",
    r"\bdon['’]?t know if i(?:['’]m| am) safe\b",
    r"\bnot sure (?:if|whether) i(?:['’]m| am) safe\b",
    r"\bhow much longer i can\b",
    r"\bsomething(?:'s| has) (?:gone )?wrong (?:with me|inside)\b",
    r"\bi don['’]?t know if this is dangerous\b",
    r"\bupdated my will\b",
    r"\bsorted my papers\b",
    r"\bgive me one reason\b",
    r"\byou have five minutes\b",
    r"\bi will not stay\b",
    r"\bwhatever happens\b.{0,48}\bthank you\b",
    r"\bthank you\b.{0,48}\bwhatever happens\b",
    r"\bremember me in (?:your )?prayers\b",
    r"\bforgive me for everything\b",
)
SELF_PRON = _rx(
    r"\bi\b",
    r"\bi['’]m\b",
    r"\bi am\b",
    r"\bmy\b",
    r"\bmyself\b",
    r"\baku\b",
    r"\bsaya\b",
    r"أنا",
)


def extract_features(text: str) -> SafetyFeatures:
    raw = text.strip()
    lowered = raw.lower()
    notes: list[str] = []

    frame = Frame.LITERAL
    if CORRECTION.search(lowered):
        frame = Frame.CORRECTION
        notes.append("frame:correction")
    elif BEREAVEMENT.search(lowered) and not re.search(
        r"\b(?:kill myself|end my life|harming myself|hurt myself)\b", lowered
    ):
        frame = Frame.BEREAVEMENT
        notes.append("frame:bereavement_or_other_history")
    elif IDIOM.search(lowered):
        frame = Frame.IDIOM
        notes.append("frame:idiom")
    elif FICTION.search(lowered):
        frame = Frame.FICTIONAL
        notes.append("frame:fictional")
    elif NEWS.search(lowered) and (ACTIVE.search(lowered) or re.search(r"\bsuicide\b", lowered)):
        frame = Frame.NEWS
        notes.append("frame:news")
    elif QUOTED.search(raw):
        frame = Frame.QUOTED
        notes.append("frame:quoted")
    elif HISTORICAL.search(lowered) and re.search(
        r"\b(?:not anymore|don['’]?t feel that way now|haven['’]?t done it recently)\b",
        lowered,
    ):
        frame = Frame.NEGATED
        notes.append("frame:closed_historical")
    elif HISTORICAL.search(lowered) and (ACTIVE.search(lowered) or SH_DISCLOSURE.search(lowered) or PASSIVE.search(lowered)):
        frame = Frame.HISTORICAL_DISCLOSURE
        notes.append("frame:historical_disclosure")
    elif NEGATION.search(lowered):
        frame = Frame.NEGATED
        notes.append("frame:negated")

    threat_to_user = bool(
        re.search(
            r"\b(?:kill me|hurt me|threatened to|threatening|scared to open|weapon|serious violence)\b",
            lowered,
        )
    )
    named_actor = bool(DV_ACTOR.search(lowered))
    pronoun_threat = bool(
        re.search(
            r"\b(?:he|she|they)\b.{0,60}(?:kill me|hurt me|threatening|outside|weapon|here now)",
            lowered,
        )
    )
    dv_acute = threat_to_user and (named_actor or pronoun_threat)

    third_party = bool(THIRD_PARTY_PERSON.search(lowered) and THIRD_PARTY_HARM.search(lowered))
    if re.search(r"\b(?:they|she|he) (?:intend|plan).{0,24}(?:kill themselves|die|hurt themselves)\b", lowered):
        third_party = True
    if re.search(r"\bgoodbye\b", lowered) and THIRD_PARTY_PERSON.search(lowered) and re.search(
        r"\b(?:not|isn['’]?t|aren['’]?t|can['’]?t) (?:answering|replying|reach)", lowered
    ):
        third_party = True

    if dv_acute:
        subject = Subject.SELF_EXPOSED_TO_OTHER
        notes.append("subject:self_exposed")
    elif third_party:
        subject = Subject.OTHER
        notes.append("subject:other")
    elif SELF_PRON.search(lowered):
        subject = Subject.SELF
    else:
        subject = Subject.OTHER

    ideation = Ideation.NONE
    if ACTIVE.search(lowered) and frame not in {
        Frame.IDIOM,
        Frame.NEWS,
        Frame.FICTIONAL,
        Frame.QUOTED,
        Frame.BEREAVEMENT,
        Frame.CORRECTION,
    }:
        ideation = Ideation.ACTIVE
        notes.append("ideation:active")
    elif PASSIVE.search(lowered) and frame not in {
        Frame.IDIOM,
        Frame.FICTIONAL,
        Frame.QUOTED,
        Frame.CORRECTION,
    }:
        ideation = Ideation.PASSIVE
        notes.append("ideation:passive")
    elif INTENT_PRESENT.search(lowered) and re.search(r"\b(?:life|living|gone quiet|fighting)\b", lowered):
        ideation = Ideation.UNSPECIFIED
        notes.append("ideation:unspecified_cessation")

    plan = Plan.NONE
    if CURRENT_ACTION.search(lowered):
        plan = Plan.CURRENT_ACTION
        notes.append("plan:current_action")
    elif PLAN_PREP.search(lowered):
        plan = Plan.PREPARATORY
        notes.append("plan:preparatory")
    elif PLAN_MEANS.search(lowered):
        plan = Plan.MEANS
        notes.append("plan:means")
    elif PLAN_NONSPECIFIC.search(lowered) and (
        ideation != Ideation.NONE
        or re.search(r"\b(?:do it|plan|chose to|end|die|life|in detail)\b", lowered)
    ):
        plan = Plan.NONSPECIFIC
        notes.append("plan:nonspecific")

    self_harm = bool(SH_DISCLOSURE.search(lowered) and frame not in {Frame.FICTIONAL, Frame.QUOTED, Frame.NEWS, Frame.IDIOM})

    intent = Intent.NONE
    if (
        subject == Subject.OTHER
        and not third_party
        and not dv_acute
        and (ideation != Ideation.NONE or self_harm or plan != Plan.NONE or INTENT_PRESENT.search(lowered))
    ):
        subject = Subject.SELF
        notes.append("subject:implied_self")

    if (
        re.search(r"\btonight is the night\b", lowered)
        and re.search(r"\b(?:decided|calm|goodbye)\b", lowered)
        and frame == Frame.LITERAL
    ):
        intent = Intent.ACUTE
        if ideation == Ideation.NONE:
            ideation = Ideation.UNSPECIFIED
        notes.append("intent:timed_veiled_decision")
    elif INTENT_PRESENT.search(lowered) and frame == Frame.LITERAL:
        intent = Intent.ACUTE if IMMEDIATE.search(lowered) else Intent.PRESENT
        notes.append(f"intent:{intent.value.lower()}")
    elif IMMEDIATE.search(lowered) and (ideation != Ideation.NONE or self_harm) and frame == Frame.LITERAL:
        intent = Intent.ACUTE
        notes.append("intent:immediate_plus_harm")
    elif plan != Plan.NONE and subject == Subject.SELF and frame == Frame.LITERAL:
        intent = Intent.ACUTE if IMMEDIATE.search(lowered) else Intent.PRESENT
        notes.append("intent:inferred_from_plan")
    elif ideation == Ideation.UNSPECIFIED and frame == Frame.LITERAL:
        intent = Intent.PRESENT
        notes.append("intent:veiled_cessation")

    if IMMEDIATE.search(lowered):
        temporality = Temporality.IMMEDIATE
    elif frame == Frame.HISTORICAL_DISCLOSURE:
        temporality = Temporality.HISTORICAL
    else:
        temporality = Temporality.CURRENT

    ambiguous = bool(AMBIGUOUS.search(lowered) and ideation == Ideation.NONE and plan == Plan.NONE and not dv_acute and not third_party)

    severity = extract_severity(raw)
    notes.extend(severity.notes)

    built = SafetyFeatures(
        subject=subject,
        temporality=temporality,
        ideation=ideation,
        intent=intent,
        plan=plan,
        frame=frame,
        third_party_imminent=third_party,
        dv_acute=dv_acute,
        self_harm_disclosure=self_harm,
        ambiguous_safety=ambiguous,
        severity_moderate=severity.moderate,
        severity_families=severity.families,
        support_hint=severity.support_hint,
        notes=tuple(notes),
    )
    from reeboot.safety.comprehension import apply_comprehension

    return apply_comprehension(raw, built)
