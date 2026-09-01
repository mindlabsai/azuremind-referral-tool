"""DEVELOPMENT-ONLY telemetry. Does not persist user text."""

from __future__ import annotations

import json
import sys

from reeboot.schemas.telemetry import DevTelemetry


def format_telemetry(telemetry: DevTelemetry) -> str:
    contract_json = telemetry.contract.model_dump(by_alias=True, mode="json")
    lines = [
        "────────────────────────────────────────",
        "REEBOOT DEV TELEMETRY",
        f"safety          {telemetry.safety_state.value}",
        f"support         {telemetry.support_state.value}",
        f"gep_stage       {telemetry.gep_stage or '-'}",
        f"safety_plan     {telemetry.safety_plan_present}",
        f"domain          {telemetry.domain.value}",
        f"state           {telemetry.state.value}",
        f"primitive       {telemetry.intervention_primitive.value}",
        f"policy          {telemetry.policy_decision.value}",
        f"move            {telemetry.conversation_move.value}",
        f"fsm             {telemetry.fsm_state.value}",
        f"used_generation {telemetry.used_generation}",
        f"latency_ms      {telemetry.processing_latency_ms:.1f}",
        "runtime_contract:",
        json.dumps(contract_json, indent=2),
        "────────────────────────────────────────",
    ]
    return "\n".join(lines)


def print_telemetry(telemetry: DevTelemetry) -> None:
    print(format_telemetry(telemetry), file=sys.stderr)
