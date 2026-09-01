"""Vendor adapters. They transport bytes/tokens only — no behavioural control."""

from __future__ import annotations

import os
from collections.abc import AsyncIterator

from reeboot.schemas.contract import RuntimeContract, VoiceBlock


class ProviderUnavailableError(RuntimeError):
    pass


class DeepgramNova3STTAdapter:
    """Deepgram Nova-3 adapter stub. Does not classify safety or domain."""

    def __init__(self, api_key: str | None = None) -> None:
        self.api_key = api_key or os.getenv("DEEPGRAM_API_KEY")

    async def transcribe(self, audio: bytes) -> str:
        _ = audio
        if not self.api_key:
            raise ProviderUnavailableError("DEEPGRAM_API_KEY not set")
        raise ProviderUnavailableError("Deepgram live client is not wired in this prototype")

    async def stream_transcribe(self, chunks: AsyncIterator[bytes]) -> AsyncIterator[str]:
        _ = chunks
        raise ProviderUnavailableError("Deepgram live client is not wired in this prototype")
        yield ""  # pragma: no cover


class GroqGenerationAdapter:
    """Groq Llama adapter stub. Language only; contract is already compiled."""

    def __init__(self, api_key: str | None = None) -> None:
        self.api_key = api_key or os.getenv("GROQ_API_KEY")

    async def generate(self, contract: RuntimeContract, user_text: str) -> str:
        _ = contract, user_text
        if not self.api_key:
            raise ProviderUnavailableError("GROQ_API_KEY not set")
        raise ProviderUnavailableError("Groq client is not wired in this prototype")


class CartesiaSonicTTSAdapter:
    """Cartesia Sonic adapter stub. Playback only."""

    def __init__(self, api_key: str | None = None) -> None:
        self.api_key = api_key or os.getenv("CARTESIA_API_KEY")

    async def synthesize(self, text: str, voice: VoiceBlock) -> bytes:
        _ = text, voice
        if not self.api_key:
            raise ProviderUnavailableError("CARTESIA_API_KEY not set")
        raise ProviderUnavailableError("Cartesia client is not wired in this prototype")
