"""In-process mock providers. Default generation path for the prototype."""

from __future__ import annotations

from collections.abc import AsyncIterator
from typing import Iterable

from reeboot.schemas.contract import RuntimeContract, VoiceBlock
from reeboot.schemas.enums import ConversationMove, Domain, InterventionPrimitive


class MockSTTProvider:
    async def transcribe(self, audio: bytes) -> str:
        return audio.decode("utf-8", errors="replace")

    async def stream_transcribe(self, chunks: AsyncIterator[bytes]) -> AsyncIterator[str]:
        async for chunk in chunks:
            yield chunk.decode("utf-8", errors="replace")


class MockTTSProvider:
    async def synthesize(self, text: str, voice: VoiceBlock) -> bytes:
        _ = voice
        return text.encode("utf-8")


class MockGenerationProvider:
    """Constrained language from the contract. No safety or intervention authority."""

    async def generate(self, contract: RuntimeContract, user_text: str) -> str:
        if not contract.generation_allowed():
            raise RuntimeError("GenerationProvider invoked under BLOCK_GENERATIVE")
        _ = user_text
        text = _template(contract)
        return _trim_words(text, contract.conversation.maximum_words)


class ScriptedGenerationProvider:
    def __init__(self, outputs: Iterable[str]) -> None:
        self._outputs = list(outputs)
        self.calls = 0

    async def generate(self, contract: RuntimeContract, user_text: str) -> str:
        if not contract.generation_allowed():
            raise RuntimeError("GenerationProvider invoked under BLOCK_GENERATIVE")
        _ = user_text
        if self.calls >= len(self._outputs):
            raise RuntimeError("ScriptedGenerationProvider exhausted")
        text = self._outputs[self.calls]
        self.calls += 1
        return text


class ExplodingGenerationProvider:
    """Fails if generation is attempted — used to prove RED/EMERGENCY takeover."""

    async def generate(self, contract: RuntimeContract, user_text: str) -> str:
        raise AssertionError(
            "GenerationProvider must not be called when generative authority is removed"
        )


def _template(contract: RuntimeContract) -> str:
    primitive = contract.intervention.primitive
    domain = contract.user_state.primary_domain
    move = contract.conversation.move
    ask = contract.conversation.allow_question

    if primitive == InterventionPrimitive.MICRO_ACTION:
        base = "Let's pause and pick just one 5-second action."
        return f"{base} Ready to try that first step?" if ask else base
    if primitive == InterventionPrimitive.EXTERNALIZE_STEP:
        return "Park the rest. Name only the next visible step."
    if primitive == InterventionPrimitive.PACING:
        return "That load is a lot. We can take one piece at a time."
    if primitive == InterventionPrimitive.BOUNDARY_PROMPT:
        return "You can hold one boundary and leave the rest for later."
    if primitive == InterventionPrimitive.GROUNDING:
        if domain == Domain.WORK_STRESS:
            return "That sounds overwhelming. Let's take a single breath together."
        return "I'm here with you. Let's take one slow breath together."
    if primitive == InterventionPrimitive.REFRAME:
        if move == ConversationMove.REFLECTIVE_ACK:
            return "I hear you. If you'd like, we can step through this slowly."
        return "I hear you. We can keep this small and manageable."
    return "I'm here with you. What feels manageable right now?"


def _trim_words(text: str, maximum_words: int) -> str:
    words = text.split()
    if len(words) <= maximum_words:
        return text
    trimmed = " ".join(words[:maximum_words])
    return trimmed.rstrip(".,;:") + "."
