"""Reeboot Gen 2 runtime engine.

The model generates language. Reeboot owns state, safety, intervention
selection, consent, escalation, and session behaviour.
"""

__version__ = "2.0.0"

from reeboot.engine import ReebootEngine
from reeboot.session import Session

__all__ = ["ReebootEngine", "Session", "__version__"]
