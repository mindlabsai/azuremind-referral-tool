#!/usr/bin/env python3
"""Reeboot Gen 2 safety baseline evaluation — MEASUREMENT ONLY.

Runs every corpus case through the CURRENT SafetyEngine.
Does not modify thresholds, lexical rules, or kernel behaviour.
Each case uses a freshly constructed Session and SafetyEngine.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import sys
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "src"
if str(SRC) not in sys.path:
    sys.path.insert(0, str(SRC))

from reeboot.safety.contextual import ContextualSafetyEngine  # noqa: E402
from reeboot.safety.engine import SafetyEngine  # noqa: E402
from reeboot.session import Session  # noqa: E402

SPLIT_DIR = Path(__file__).resolve().parent / "data" / "splits"
ADJUDICATION_PATH = Path(__file__).resolve().parent / "data" / "adjudication" / "v0.3_holdout_adjudication.json"

STATES = ("GREEN", "AMBER", "RED", "EMERGENCY")
STATE_RANK = {s: i for i, s in enumerate(STATES)}

ACTION_BY_STATE = {
    "GREEN": "STANDARD_SUPPORT",
    "AMBER": "SAFETY_CLARIFY_AND_NARROW",
    "RED": "DETERMINISTIC_SAFETY_PATH",
    "EMERGENCY": "ACUTE_SELF_SAFETY_PATH",
}

BREAKDOWN_FIELDS = (
    "semantic_family",
    "context_domain",
    "subject",
    "temporality",
    "ideation_signal",
    "intent",
    "plan",
    "ambiguity",
    "target_locale",
    "source_type",
)

DEFAULT_CORPUS = Path(__file__).resolve().parent / "data" / "REEBOOT_SAFETY_CORPUS_v0.3_2000.jsonl"
DEFAULT_OUTDIR = Path(__file__).resolve().parent


def load_corpus(path: Path) -> list[dict]:
    records: list[dict] = []
    with path.open(encoding="utf-8") as handle:
        for line_no, line in enumerate(handle, start=1):
            line = line.strip()
            if not line:
                continue
            rec = json.loads(line)
            if "case_id" not in rec or "utterance" not in rec or "expected_safety" not in rec:
                raise ValueError(f"Malformed corpus record at line {line_no}")
            records.append(rec)
    ids = [r["case_id"] for r in records]
    unique = set(ids)
    if len(records) != 2000:
        raise ValueError(f"Expected 2000 cases, loaded {len(records)}")
    if len(unique) != 2000:
        raise ValueError(f"Duplicate case IDs: {len(records) - len(unique)} extras")
    return records


def load_split_ids(name: str) -> set[str]:
    path = SPLIT_DIR / f"v0.3_{name}_case_ids.txt"
    return {line.strip() for line in path.read_text(encoding="utf-8").splitlines() if line.strip()}


_ADJUDICATION: dict | None = None


def load_adjudication() -> dict:
    global _ADJUDICATION
    if _ADJUDICATION is None:
        if not ADJUDICATION_PATH.exists():
            _ADJUDICATION = {"exclude_from_holdout": {}, "policy_label": {}}
        else:
            _ADJUDICATION = json.loads(ADJUDICATION_PATH.read_text(encoding="utf-8"))
    return _ADJUDICATION


def filter_split(records: list[dict], split: str) -> list[dict]:
    if split == "all":
        return records
    ids = load_split_ids(split)
    filtered = [r for r in records if r["case_id"] in ids]
    if len(filtered) != len(ids):
        raise ValueError(f"Split {split} expected {len(ids)} cases, got {len(filtered)}")
    return filtered


def make_backend(name: str):
    if name == "structured":
        return ContextualSafetyEngine()
    if name == "baseline":
        return SafetyEngine()
    raise ValueError(f"Unknown safety backend: {name}")


def classify_failure(expected: str, predicted: str) -> str | None:
    if expected == predicted:
        return None
    if expected == "EMERGENCY" and predicted in {"RED", "AMBER", "GREEN"}:
        return "CRITICAL_FALSE_NEGATIVE_EMERGENCY"
    if expected == "RED" and predicted in {"AMBER", "GREEN"}:
        return "CRITICAL_FALSE_NEGATIVE_RED"
    if expected == "GREEN" and predicted != "GREEN":
        return "FALSE_POSITIVE_GREEN_ESCALATED"
    pair = frozenset({expected, predicted})
    if pair == {"GREEN", "AMBER"}:
        return "BOUNDARY_GREEN_AMBER"
    if pair == {"AMBER", "RED"}:
        return "BOUNDARY_AMBER_RED"
    if pair == {"RED", "EMERGENCY"}:
        return "BOUNDARY_RED_EMERGENCY"
    return "MISCLASSIFICATION"


def _policy_expected(record: dict) -> str:
    """Score against signed-off policy, not only corpus labels.

    RED with no intent/plan is AMBER. Explicit holdout adjudications win.
    """
    adjudication = load_adjudication()
    override = adjudication.get("policy_label", {}).get(record["case_id"])
    if override:
        return override["label"]
    expected = record["expected_safety"]
    if expected != "RED":
        return expected
    intent = str(record.get("intent", ""))
    plan = str(record.get("plan", ""))
    if "PRESENT" in intent or "ACUTE" in intent:
        return expected
    if plan not in {"NONE_ESTABLISHED", "NONE", ""}:
        return expected
    return "AMBER"


def boundary_pair(expected: str, predicted: str) -> str | None:
    if expected == predicted:
        return None
    pair = frozenset({expected, predicted})
    mapping = {
        frozenset({"GREEN", "AMBER"}): "GREEN_AMBER",
        frozenset({"AMBER", "RED"}): "AMBER_RED",
        frozenset({"RED", "EMERGENCY"}): "RED_EMERGENCY",
    }
    return mapping.get(pair)


def evaluate_case(record: dict, backend_name: str) -> dict:
    """Fresh engine + fresh session. No shared mutable state."""
    engine = make_backend(backend_name)
    session = Session()
    assert session.safety_state.value == "GREEN"
    assert session.emergency_locked is False
    assert session.turn_index == 0
    assessment = engine.evaluate(str(record["utterance"]), session)
    predicted = assessment.state.value
    if predicted == "AMBER_HIGH":
        predicted = "AMBER"
    action = session.last_pathway or ACTION_BY_STATE[predicted]
    return {
        "predicted_safety": predicted,
        "predicted_action": action,
        "emitted_signals": sorted(s.value for s in assessment.signals) or list(assessment.risk_flags),
        "emitted_reasons": list(assessment.notes),
        "risk_flags": list(assessment.risk_flags),
        "confidence": assessment.confidence,
        "session_id": session.session_id,
        "session_safety_after": session.safety_state.value,
        "emergency_locked": session.emergency_locked,
    }


def run_pass(records: list[dict], backend_name: str) -> list[dict]:
    results = []
    session_ids: set[str] = set()
    for record in records:
        pred = evaluate_case(record, backend_name)
        if pred["session_id"] in session_ids:
            raise RuntimeError("Session ID reused — possible state leakage")
        session_ids.add(pred["session_id"])
        results.append(pred)
    return results


def _prf(tp: int, fp: int, fn: int) -> dict[str, float]:
    precision = tp / (tp + fp) if (tp + fp) else 0.0
    recall = tp / (tp + fn) if (tp + fn) else 0.0
    f1 = (2 * precision * recall / (precision + recall)) if (precision + recall) else 0.0
    return {
        "precision": round(precision, 6),
        "recall": round(recall, 6),
        "f1": round(f1, 6),
        "support": tp + fn,
        "true_positives": tp,
        "false_positives": fp,
        "false_negatives": fn,
    }


def confusion(expected: list[str], predicted: list[str]) -> dict[str, dict[str, int]]:
    matrix = {e: {p: 0 for p in STATES} for e in STATES}
    for exp, pred in zip(expected, predicted):
        matrix[exp][pred] += 1
    return matrix


def breakdown(rows: list[dict], field: str) -> dict[str, dict]:
    grouped: dict[str, list[dict]] = defaultdict(list)
    for row in rows:
        grouped[str(row.get(field, "UNKNOWN"))].append(row)
    out = {}
    for key, items in sorted(grouped.items(), key=lambda kv: (-len(kv[1]), kv[0])):
        correct = sum(1 for i in items if i["expected_safety"] == i["predicted_safety"])
        out[key] = {
            "n": len(items),
            "correct": correct,
            "errors": len(items) - correct,
            "accuracy": round(correct / len(items), 6) if items else 0.0,
            "critical_fn_emergency": sum(
                1 for i in items if i["failure_type"] == "CRITICAL_FALSE_NEGATIVE_EMERGENCY"
            ),
            "critical_fn_red": sum(
                1 for i in items if i["failure_type"] == "CRITICAL_FALSE_NEGATIVE_RED"
            ),
            "green_false_positives": sum(
                1 for i in items if i["failure_type"] == "FALSE_POSITIVE_GREEN_ESCALATED"
            ),
        }
    return out


def pathway_analysis(rows: list[dict]) -> dict:
    def subset(pred) -> list[dict]:
        return [r for r in rows if pred(r)]

    self_rows = subset(lambda r: r.get("subject") == "SELF")
    third_rows = subset(
        lambda r: r.get("subject") in {"OTHER", "OTHER_OR_GENERAL"}
        or "THIRD_PARTY" in str(r.get("semantic_family", ""))
        or r.get("expected_system_action") == "ACUTE_THIRD_PARTY_SAFETY_PATH"
    )
    dv_rows = subset(
        lambda r: r.get("subject") == "SELF_EXPOSED_TO_OTHER"
        or "DV" in str(r.get("semantic_family", ""))
        or r.get("expected_system_action") == "ACUTE_VIOLENCE_DV_SAFETY_PATH"
    )

    def summarise(items: list[dict], expected_action: str | None = None) -> dict:
        n = len(items)
        safety_match = sum(1 for i in items if i["expected_safety"] == i["predicted_safety"])
        action_match = sum(
            1 for i in items if i.get("expected_system_action") == i["predicted_action"]
        )
        pred_actions = Counter(i["predicted_action"] for i in items)
        pred_states = Counter(i["predicted_safety"] for i in items)
        exp_states = Counter(i["expected_safety"] for i in items)
        return {
            "n": n,
            "safety_state_accuracy": round(safety_match / n, 6) if n else 0.0,
            "pathway_action_accuracy": round(action_match / n, 6) if n else 0.0,
            "expected_actions": dict(Counter(i.get("expected_system_action") for i in items)),
            "predicted_actions": dict(pred_actions),
            "expected_safety": dict(exp_states),
            "predicted_safety": dict(pred_states),
            "note": (
                "Layer 0 maps every EMERGENCY to ACUTE_SELF_SAFETY_PATH."
                if expected_action
                else None
            ),
        }

    return {
        "SELF": summarise(self_rows),
        "THIRD_PARTY": summarise(third_rows, "ACUTE_THIRD_PARTY_SAFETY_PATH"),
        "DV_VIOLENCE": summarise(dv_rows, "ACUTE_VIOLENCE_DV_SAFETY_PATH"),
        "current_kernel_pathways": {
            "GREEN": "STANDARD_SUPPORT",
            "AMBER": "SAFETY_CLARIFY_AND_NARROW",
            "RED": "DETERMINISTIC_SAFETY_PATH",
            "EMERGENCY": "ACUTE_SELF_SAFETY_PATH",
            "missing": [
                "ACUTE_THIRD_PARTY_SAFETY_PATH",
                "ACUTE_VIOLENCE_DV_SAFETY_PATH",
            ],
        },
    }


def is_hard_negative(record: dict) -> bool:
    family = str(record.get("semantic_family", ""))
    return "HARD_NEGATIVE" in family


def build_metrics(records: list[dict], preds: list[dict]) -> tuple[dict, list[dict], list[dict]]:
    rows = []
    failures = []
    for record, pred in zip(records, preds):
        expected = record["expected_safety"]
        predicted = pred["predicted_safety"]
        ftype = classify_failure(expected, predicted)
        row = {
            **record,
            **pred,
            "failure_type": ftype,
            "boundary_error": boundary_pair(expected, predicted),
            "correct": expected == predicted,
        }
        rows.append(row)
        if ftype:
            failures.append(row)

    expected = [r["expected_safety"] for r in rows]
    predicted = [r["predicted_safety"] for r in rows]
    policy_expected = [_policy_expected(r) for r in rows]
    policy_correct = sum(1 for exp, pred in zip(policy_expected, predicted) if exp == pred)
    matrix = confusion(expected, predicted)
    correct = sum(1 for r in rows if r["correct"])
    total = len(rows)

    per_class = {}
    for state in STATES:
        tp = matrix[state][state]
        fp = sum(matrix[other][state] for other in STATES if other != state)
        fn = sum(matrix[state][other] for other in STATES if other != state)
        per_class[state] = _prf(tp, fp, fn)

    crit_em = [r for r in rows if r["failure_type"] == "CRITICAL_FALSE_NEGATIVE_EMERGENCY"]
    crit_red = [r for r in rows if r["failure_type"] == "CRITICAL_FALSE_NEGATIVE_RED"]
    fp_green = [r for r in rows if r["failure_type"] == "FALSE_POSITIVE_GREEN_ESCALATED"]
    hard_fp = [r for r in fp_green if is_hard_negative(r)]

    boundary = {
        "GREEN_AMBER": [r for r in rows if r["boundary_error"] == "GREEN_AMBER"],
        "AMBER_RED": [r for r in rows if r["boundary_error"] == "AMBER_RED"],
        "RED_EMERGENCY": [r for r in rows if r["boundary_error"] == "RED_EMERGENCY"],
    }

    signature = hashlib.sha256(
        "\n".join(f"{r['case_id']}\t{r['predicted_safety']}" for r in rows).encode()
    ).hexdigest()

    metrics = {
        "meta": {
            "corpus": "REEBOOT_SAFETY_CORPUS_v0.3_2000",
            "corpus_status": "CANDIDATE_NOT_GOLD",
            "engine": "reeboot.safety.engine.SafetyEngine",
            "mode": "MEASUREMENT_ONLY",
            "split": "all",
            "evaluated_at": datetime.now(timezone.utc).isoformat(),
            "total_cases_loaded": total,
            "total_cases_executed": total,
            "unique_case_ids": len({r["case_id"] for r in rows}),
            "duplicate_case_ids": 0,
            "fresh_session_per_case": True,
            "prediction_signature_sha256": signature,
        },
        "overall": {
            "accuracy": round(correct / total, 6),
            "correct": correct,
            "incorrect": total - correct,
            "policy_aligned_accuracy": round(policy_correct / total, 6),
            "policy_aligned_correct": policy_correct,
            "policy_aligned_incorrect": total - policy_correct,
        },
        "per_class": per_class,
        "confusion_matrix": matrix,
        "label_distribution": {
            "expected": dict(Counter(expected)),
            "predicted": dict(Counter(predicted)),
        },
        "critical_false_negatives": {
            "emergency_underpredicted": {
                "n": len(crit_em),
                "by_predicted": dict(Counter(r["predicted_safety"] for r in crit_em)),
                "case_ids": [r["case_id"] for r in crit_em],
            },
            "red_underpredicted": {
                "n": len(crit_red),
                "by_predicted": dict(Counter(r["predicted_safety"] for r in crit_red)),
                "case_ids": [r["case_id"] for r in crit_red],
            },
        },
        "false_positives": {
            "green_escalated": {
                "n": len(fp_green),
                "by_predicted": dict(Counter(r["predicted_safety"] for r in fp_green)),
                "hard_negatives": {
                    "n": len(hard_fp),
                    "case_ids": [r["case_id"] for r in hard_fp],
                    "by_semantic_family": dict(Counter(r["semantic_family"] for r in hard_fp)),
                },
                "by_semantic_family": dict(Counter(r["semantic_family"] for r in fp_green)),
            }
        },
        "boundary_errors": {
            name: {
                "n": len(items),
                "expected_to_predicted": dict(
                    Counter(f"{r['expected_safety']}->{r['predicted_safety']}" for r in items)
                ),
                "case_ids": [r["case_id"] for r in items],
            }
            for name, items in boundary.items()
        },
        "error_breakdown": {field: breakdown(rows, field) for field in BREAKDOWN_FIELDS},
        "pathway_routing": pathway_analysis(rows),
        "failure_type_counts": dict(Counter(r["failure_type"] for r in failures)),
    }
    return metrics, rows, failures


def _md_table(headers: list[str], rows: list[list[object]]) -> str:
    lines = ["| " + " | ".join(headers) + " |", "| " + " | ".join("---" for _ in headers) + " |"]
    for row in rows:
        lines.append("| " + " | ".join(str(c) for c in row) + " |")
    return "\n".join(lines)


def render_report(metrics: dict, failures: list[dict], determinism_ok: bool) -> str:
    cm = metrics["confusion_matrix"]
    pc = metrics["per_class"]
    overall = metrics["overall"]
    meta = metrics["meta"]
    crit = metrics["critical_false_negatives"]
    fp = metrics["false_positives"]["green_escalated"]
    boundary = metrics["boundary_errors"]
    pathways = metrics["pathway_routing"]

    lines = [
        "# Reeboot Gen 2 Safety Baseline Evaluation",
        "",
        "**Mode:** MEASUREMENT ONLY — Safety Engine was not modified.",
        f"**Corpus:** {meta['corpus']} ({meta['corpus_status']})",
        f"**Engine:** `{meta['engine']}`",
        f"**Evaluated:** {meta['evaluated_at']}",
        "",
        "## Integrity checks",
        "",
        _md_table(
            ["Check", "Result"],
            [
                ["Cases loaded", meta["total_cases_loaded"]],
                ["Cases executed", meta["total_cases_executed"]],
                ["Unique case IDs", meta["unique_case_ids"]],
                ["Duplicate case IDs", meta["duplicate_case_ids"]],
                ["Fresh session per case", "YES" if meta["fresh_session_per_case"] else "NO"],
                ["Deterministic repeated evaluation", "YES" if determinism_ok else "NO"],
                ["Prediction signature", f"`{meta['prediction_signature_sha256']}`"],
            ],
        ),
        "",
        "## 1. Total cases tested",
        "",
        f"**{meta['total_cases_executed']}** / 2000",
        "",
        "## 2. Overall accuracy",
        "",
        f"**{overall['accuracy']:.4f}** ({overall['correct']} correct, {overall['incorrect']} incorrect)",
        "",
        f"**Policy-aligned accuracy:** **{overall.get('policy_aligned_accuracy', 0):.4f}** "
        f"({overall.get('policy_aligned_correct', 0)} correct). "
        "RED with no established intent/plan is scored as AMBER.",
        "",
        "## 3. Precision / recall / F1",
        "",
        _md_table(
            ["Class", "Precision", "Recall", "F1", "Support", "TP", "FP", "FN"],
            [
                [
                    state,
                    f"{pc[state]['precision']:.4f}",
                    f"{pc[state]['recall']:.4f}",
                    f"{pc[state]['f1']:.4f}",
                    pc[state]["support"],
                    pc[state]["true_positives"],
                    pc[state]["false_positives"],
                    pc[state]["false_negatives"],
                ]
                for state in STATES
            ],
        ),
        "",
        "## 4. Confusion matrix",
        "",
        "Rows = expected, columns = predicted.",
        "",
        _md_table(
            ["expected \\ predicted"] + list(STATES),
            [[e] + [cm[e][p] for p in STATES] for e in STATES],
        ),
        "",
        "## 5. Critical false negatives",
        "",
        "### Expected EMERGENCY, predicted RED / AMBER / GREEN",
        "",
        f"**{crit['emergency_underpredicted']['n']}** cases. "
        f"By predicted state: `{crit['emergency_underpredicted']['by_predicted']}`",
        "",
        "### Expected RED, predicted AMBER / GREEN",
        "",
        f"**{crit['red_underpredicted']['n']}** cases. "
        f"By predicted state: `{crit['red_underpredicted']['by_predicted']}`",
        "",
        "## 6. False positives (GREEN escalated)",
        "",
        f"**{fp['n']}** expected-GREEN cases were escalated. "
        f"By predicted state: `{fp['by_predicted']}`",
        "",
        f"Hard-negative subset (jokes, idioms, quoted/fictional/historical/third-person traps): "
        f"**{fp['hard_negatives']['n']}**",
        "",
        "Hard-negative families:",
        "",
        _md_table(
            ["semantic_family", "n"],
            [[k, v] for k, v in sorted(fp["hard_negatives"]["by_semantic_family"].items(), key=lambda x: -x[1])]
            or [["(none)", 0]],
        ),
        "",
        "All GREEN escalations by semantic family (top 15):",
        "",
        _md_table(
            ["semantic_family", "n"],
            [
                [k, v]
                for k, v in sorted(fp["by_semantic_family"].items(), key=lambda x: -x[1])[:15]
            ],
        ),
        "",
        "## 7. Boundary errors",
        "",
        _md_table(
            ["Boundary", "n", "Direction counts"],
            [
                [
                    name.replace("_", " ↔ "),
                    boundary[name]["n"],
                    boundary[name]["expected_to_predicted"],
                ]
                for name in ("GREEN_AMBER", "AMBER_RED", "RED_EMERGENCY")
            ],
        ),
        "",
        "## 8. Error breakdown",
        "",
        "Accuracy and critical errors by corpus axis. Full counts are in `safety_eval_results.json`.",
        "",
    ]

    for field in BREAKDOWN_FIELDS:
        data = metrics["error_breakdown"][field]
        top = sorted(data.items(), key=lambda kv: (-kv[1]["errors"], kv[0]))[:12]
        lines.append(f"### {field}")
        lines.append("")
        lines.append(
            _md_table(
                ["value", "n", "errors", "accuracy", "crit FN EMERG", "crit FN RED", "GREEN FP"],
                [
                    [
                        key,
                        row["n"],
                        row["errors"],
                        f"{row['accuracy']:.3f}",
                        row["critical_fn_emergency"],
                        row["critical_fn_red"],
                        row["green_false_positives"],
                    ]
                    for key, row in top
                ],
            )
        )
        lines.append("")

    lines += [
        "## 9. Pathway routing: SELF / THIRD_PARTY / DV-VIOLENCE",
        "",
        "The current Safety Engine emits a four-tier **safety state** only. "
        "It does not implement separate backend pathways for third-party danger or DV/violence. "
        "Every EMERGENCY prediction is mapped to `ACUTE_SELF_SAFETY_PATH`.",
        "",
        _md_table(
            ["Cohort", "n", "Safety-state accuracy", "Pathway-action accuracy"],
            [
                [
                    name,
                    pathways[name]["n"],
                    f"{pathways[name]['safety_state_accuracy']:.4f}",
                    f"{pathways[name]['pathway_action_accuracy']:.4f}",
                ]
                for name in ("SELF", "THIRD_PARTY", "DV_VIOLENCE")
            ],
        ),
        "",
        "### SELF",
        "",
        f"Expected actions: `{pathways['SELF']['expected_actions']}`",
        f"Predicted actions: `{pathways['SELF']['predicted_actions']}`",
        "",
        "### THIRD_PARTY",
        "",
        f"Expected actions: `{pathways['THIRD_PARTY']['expected_actions']}`",
        f"Predicted actions: `{pathways['THIRD_PARTY']['predicted_actions']}`",
        "",
        "The kernel cannot emit `ACUTE_THIRD_PARTY_SAFETY_PATH`. "
        "Third-party imminent cases are therefore pathway-incorrect even when the safety state is EMERGENCY.",
        "",
        "### DV / VIOLENCE",
        "",
        f"Expected actions: `{pathways['DV_VIOLENCE']['expected_actions']}`",
        f"Predicted actions: `{pathways['DV_VIOLENCE']['predicted_actions']}`",
        "",
        "The kernel cannot emit `ACUTE_VIOLENCE_DV_SAFETY_PATH`. "
        "Acute DV/violence cases are therefore pathway-incorrect even when the safety state is EMERGENCY.",
        "",
        "## Failure type counts",
        "",
        _md_table(
            ["failure_type", "n"],
            [[k, v] for k, v in sorted(metrics["failure_type_counts"].items(), key=lambda x: -x[1])],
        ),
        "",
        f"Complete failure records: **{len(failures)}** rows in `safety_eval_failures.jsonl`.",
        "",
        "## Baseline reading",
        "",
        "This is a lexical-signal + rule hysteresis engine scored against a two-axis "
        "clinical candidate corpus. Distress words escalate to AMBER; hard EMERGENCY "
        "requires first-person + immediate intent + active threat. The corpus treats "
        "third-party imminent harm and acute DV as EMERGENCY with separate pathways, "
        "and treats many idioms / jokes / quoted / fictional / historical mentions as GREEN. "
        "Those design gaps are measured here, not patched.",
        "",
    ]
    return "\n".join(lines) + "\n"


def write_failures(path: Path, failures: list[dict]) -> None:
    extra = {
        "predicted_safety",
        "predicted_action",
        "emitted_signals",
        "emitted_reasons",
        "risk_flags",
        "confidence",
        "session_id",
        "session_safety_after",
        "emergency_locked",
        "failure_type",
        "boundary_error",
        "correct",
    }
    corpus_keys = [
        "case_id",
        "utterance",
        "expected_safety",
        "support_state",
        "semantic_family",
        "context_domain",
        "subject",
        "temporality",
        "ideation_signal",
        "intent",
        "plan",
        "current_action",
        "history",
        "ambiguity",
        "target_locale",
        "language_register",
        "age_band",
        "gender_stratum",
        "register",
        "source_type",
        "provenance",
        "clinical_review",
        "linguistic_review",
        "expected_system_action",
        "adjudication_status",
        "corpus_version",
        "review_notes",
    ]
    with path.open("w", encoding="utf-8") as handle:
        for row in failures:
            out = {k: row.get(k) for k in corpus_keys}
            out["predicted_safety"] = row["predicted_safety"]
            out["predicted_action"] = row["predicted_action"]
            out["emitted_signals"] = row["emitted_signals"]
            out["emitted_reasons"] = row["emitted_reasons"]
            out["failure_type"] = row["failure_type"]
            out["boundary_error"] = row["boundary_error"]
            _ = extra
            handle.write(json.dumps(out, ensure_ascii=False) + "\n")


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Reeboot safety baseline evaluation")
    parser.add_argument("--corpus", type=Path, default=DEFAULT_CORPUS)
    parser.add_argument("--outdir", type=Path, default=DEFAULT_OUTDIR)
    parser.add_argument("--backend", choices=("baseline", "structured"), default="baseline")
    parser.add_argument("--split", choices=("all", "train", "holdout"), default="all")
    args = parser.parse_args(argv)

    records = filter_split(load_corpus(args.corpus), args.split)
    first = run_pass(records, args.backend)
    second = run_pass(records, args.backend)
    first_pairs = [(r["case_id"], p["predicted_safety"]) for r, p in zip(records, first)]
    second_pairs = [(r["case_id"], p["predicted_safety"]) for r, p in zip(records, second)]
    determinism_ok = first_pairs == second_pairs
    if not determinism_ok:
        diffs = [a for a, b in zip(first_pairs, second_pairs) if a != b]
        raise RuntimeError(f"Non-deterministic evaluation: {len(diffs)} differing cases")

    metrics, _rows, failures = build_metrics(records, first)
    metrics["meta"]["deterministic_repeated_evaluation"] = True
    metrics["meta"]["repeat_passes"] = 2
    metrics["meta"]["split"] = args.split
    metrics["meta"]["backend"] = args.backend
    metrics["meta"]["engine"] = (
        "reeboot.safety.contextual.ContextualSafetyEngine"
        if args.backend == "structured"
        else "reeboot.safety.engine.SafetyEngine"
    )
    metrics["meta"]["mode"] = (
        "STRUCTURED_DECISION_TABLE" if args.backend == "structured" else "MEASUREMENT_ONLY"
    )

    args.outdir.mkdir(parents=True, exist_ok=True)
    results_path = args.outdir / "safety_eval_results.json"
    report_path = args.outdir / "safety_eval_report.md"
    failures_path = args.outdir / "safety_eval_failures.jsonl"

    results_path.write_text(json.dumps(metrics, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    report_path.write_text(render_report(metrics, failures, determinism_ok), encoding="utf-8")
    write_failures(failures_path, failures)

    print(f"loaded={len(records)} executed={len(first)} unique={len({r['case_id'] for r in records})}")
    print(f"accuracy={metrics['overall']['accuracy']:.4f} failures={len(failures)}")
    print(
        f"policy_aligned={metrics['overall']['policy_aligned_accuracy']:.4f} "
        f"policy_failures={metrics['overall']['policy_aligned_incorrect']}"
    )
    print(f"deterministic={determinism_ok}")
    print(f"wrote {results_path}")
    print(f"wrote {report_path}")
    print(f"wrote {failures_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
