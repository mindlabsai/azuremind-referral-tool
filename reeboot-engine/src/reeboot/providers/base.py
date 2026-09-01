"""Provider abstractions. Adapters must not control Reeboot behaviour."""

from __future__ import annotations

from typing import AsyncIterator, Protocol

from reeboot.schemas.contract import RuntimeContract, VoiceBlock


class STTProvider(Protocol):
    async def transcribe(self, audio: bytes) -> str: ...

    def stream_transcribe(
        self, chunks: AsyncIterator[bytes]
    ) -> AsyncIterator[str]: ...


class GenerationProvider(Protocol):
    """Language only. Receives a compiled Runtime Contract. Never selects state."""

    async def generate(self, contract: RuntimeContract, user_text: str) -> str: ...


class TTSProvider(Protocol):
    async def synthesize(self, text: str, voice: VoiceBlock) -> bytes: ...
