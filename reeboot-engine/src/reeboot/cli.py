"""Text vertical-slice runner for the Gen 2 kernel."""

from __future__ import annotations

import argparse
import asyncio
import sys

from reeboot.engine import ReebootEngine
from reeboot.schemas.telemetry import TurnResult


DEMO_TURNS = (
    "I can't start this report, my brain won't begin.",
    "Work is drowning me, my boss piled on another deadline.",
    "I'm feeling a bit down after a rough day.",
    "I'm completely overwhelmed and I can't cope.",
    "I wish I were dead and I can't see a way through this.",
    "I am going to kill myself tonight.",
)


def _print_result(result: TurnResult) -> None:
    print(f"\nReeboot: {result.response}\n")


async def _once(text: str, show_telemetry: bool) -> int:
    engine = ReebootEngine(show_telemetry=show_telemetry)
    session = engine.new_session()
    result = await engine.process_text(session, text)
    _print_result(result)
    return 0


async def _demo(show_telemetry: bool) -> int:
    engine = ReebootEngine(show_telemetry=show_telemetry)
    session = engine.new_session()
    for text in DEMO_TURNS:
        print(f"You: {text}")
        result = await engine.process_text(session, text)
        _print_result(result)
        if result.safety_state.value == "EMERGENCY":
            print("Session locked in EMERGENCY. Further turns remain deterministic.")
            break
    return 0


async def _repl(show_telemetry: bool) -> int:
    engine = ReebootEngine(show_telemetry=show_telemetry)
    session = engine.new_session()
    print("Reeboot Gen 2 prototype. Type text. /quit to exit.")
    while True:
        try:
            text = input("You: ").strip()
        except (EOFError, KeyboardInterrupt):
            print()
            return 0
        if not text:
            continue
        if text in {"/quit", "/exit"}:
            return 0
        result = await engine.process_text(session, text)
        _print_result(result)
    return 0


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="reeboot", description="Reeboot Gen 2 prototype")
    parser.add_argument("--once", help="Process a single user utterance and exit")
    parser.add_argument("--demo", action="store_true", help="Run canned vertical-slice turns")
    parser.add_argument("--quiet", action="store_true", help="Hide development telemetry")
    args = parser.parse_args(argv)
    show = not args.quiet
    if args.once:
        return asyncio.run(_once(args.once, show))
    if args.demo:
        return asyncio.run(_demo(show))
    if not sys.stdin.isatty() and not args.once:
        text = sys.stdin.read().strip()
        if text:
            return asyncio.run(_once(text, show))
    return asyncio.run(_repl(show))


if __name__ == "__main__":
    raise SystemExit(main())
