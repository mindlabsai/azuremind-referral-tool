"""Versioned domain package loader."""

from __future__ import annotations

import hashlib
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import yaml

from reeboot.schemas.enums import Domain


def default_registry_root() -> Path:
    return Path(__file__).resolve().parents[3] / "domain_registry"


@dataclass(frozen=True)
class DomainPackage:
    domain: Domain
    version: str
    title: str
    path: Path
    package_hash: str
    states: tuple[dict[str, Any], ...]
    interventions: tuple[dict[str, Any], ...]
    language_rules: dict[str, Any]
    safety_overrides: dict[str, Any]


def _hash_package(path: Path) -> str:
    digest = hashlib.sha256()
    for item in sorted(path.iterdir()):
        if item.is_file() and item.suffix in {".yaml", ".md"}:
            digest.update(item.name.encode())
            digest.update(item.read_bytes())
    return f"sha256:{digest.hexdigest()}"


def _load_yaml(path: Path) -> Any:
    if not path.exists():
        return {}
    return yaml.safe_load(path.read_text()) or {}


@dataclass
class DomainRegistry:
    root: Path = field(default_factory=default_registry_root)
    packages: dict[Domain, DomainPackage] = field(default_factory=dict)

    def load(self) -> None:
        mapping = {
            "mild_distress": Domain.MILD_DISTRESS,
            "neuro_exec_function": Domain.NEURO_EXEC_FUNCTION,
            "work_stress": Domain.WORK_STRESS,
        }
        for folder, domain in mapping.items():
            path = self.root / folder
            if not path.exists():
                continue
            manifest = _load_yaml(path / "manifest.yaml")
            states = _load_yaml(path / "states.yaml")
            interventions = _load_yaml(path / "interventions.yaml")
            language = _load_yaml(path / "language_rules.yaml")
            overrides = _load_yaml(path / "safety_overrides.yaml")
            self.packages[domain] = DomainPackage(
                domain=domain,
                version=str(manifest.get("version", "1.0.0")),
                title=str(manifest.get("title", domain.value)),
                path=path,
                package_hash=_hash_package(path),
                states=tuple(states.get("states", [])),
                interventions=tuple(interventions.get("primitives", [])),
                language_rules=language,
                safety_overrides=overrides,
            )

    def get(self, domain: Domain) -> DomainPackage | None:
        return self.packages.get(domain)

    def combined_hash(self) -> str:
        digest = hashlib.sha256()
        for domain in sorted(self.packages, key=lambda d: d.value):
            digest.update(self.packages[domain].package_hash.encode())
        return f"sha256:{digest.hexdigest()}"
