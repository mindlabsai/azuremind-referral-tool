#!/usr/bin/env python3
"""Freeze a stratified 1600/400 split. Do not regenerate after evaluation starts."""

from __future__ import annotations

import hashlib
import json
from collections import defaultdict
from pathlib import Path

CORPUS = Path(__file__).resolve().parent / "data" / "REEBOOT_SAFETY_CORPUS_v0.3_2000.jsonl"
SPLIT_DIR = Path(__file__).resolve().parent / "data" / "splits"
SEED = "REEBOOT_SAFETY_SPLIT_v0.3"
HOLDOUT_PER_LABEL = {
    "GREEN": 302,
    "AMBER": 25,
    "RED": 29,
    "EMERGENCY": 44,
}


def _key(case_id: str) -> str:
    return hashlib.sha256(f"{SEED}:{case_id}".encode()).hexdigest()


def main() -> None:
    records = [json.loads(line) for line in CORPUS.read_text(encoding="utf-8").splitlines() if line.strip()]
    by_label: dict[str, list[dict]] = defaultdict(list)
    for rec in records:
        by_label[rec["expected_safety"]].append(rec)

    train_ids: list[str] = []
    holdout_ids: list[str] = []
    for label, n_hold in HOLDOUT_PER_LABEL.items():
        items = sorted(by_label[label], key=lambda r: (_key(r["case_id"]), r["case_id"]))
        holdout_ids.extend(r["case_id"] for r in items[:n_hold])
        train_ids.extend(r["case_id"] for r in items[n_hold:])

    assert len(holdout_ids) == 400, len(holdout_ids)
    assert len(train_ids) == 1600, len(train_ids)
    assert len(set(train_ids) & set(holdout_ids)) == 0
    assert len(set(train_ids) | set(holdout_ids)) == 2000

    SPLIT_DIR.mkdir(parents=True, exist_ok=True)
    (SPLIT_DIR / "v0.3_train_case_ids.txt").write_text("\n".join(sorted(train_ids)) + "\n")
    (SPLIT_DIR / "v0.3_holdout_case_ids.txt").write_text("\n".join(sorted(holdout_ids)) + "\n")
    manifest = {
        "seed": SEED,
        "train": 1600,
        "holdout": 400,
        "holdout_per_label": HOLDOUT_PER_LABEL,
        "rule": "sha256(seed:case_id) sort within expected_safety; first N held out",
    }
    (SPLIT_DIR / "v0.3_split_manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")
    print(f"train={len(train_ids)} holdout={len(holdout_ids)}")
    print(f"wrote {SPLIT_DIR}")


if __name__ == "__main__":
    main()
