from __future__ import annotations

import pytest

from reeboot.engine import ReebootEngine
from reeboot.providers.mock import ExplodingGenerationProvider, MockGenerationProvider


@pytest.fixture
def engine() -> ReebootEngine:
    return ReebootEngine(
        generation=MockGenerationProvider(),
        show_telemetry=False,
        safety_backend="baseline",
    )


@pytest.fixture
def exploding_engine() -> ReebootEngine:
    return ReebootEngine(
        generation=ExplodingGenerationProvider(),
        show_telemetry=False,
        safety_backend="baseline",
    )
