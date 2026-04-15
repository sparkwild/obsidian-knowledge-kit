#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import os
import shutil
from pathlib import Path

SKILL_NAMES = (
    "obsidian-knowledge-init",
    "obsidian-knowledge-ingest",
    "obsidian-knowledge-refine",
)

SHARED_LIB_NAME = "obsidian_knowledge_shared"


def default_codex_home() -> Path:
    return Path.home() / ".codex"


def detect_codex_home() -> Path:
    return Path(os.environ.get("CODEX_HOME", default_codex_home())).expanduser()


def repo_root() -> Path:
    return Path(__file__).resolve().parents[1]


def ensure_target_parent(target: Path) -> None:
    target.parent.mkdir(parents=True, exist_ok=True)


def install_symlink(source: Path, target: Path) -> dict:
    ensure_target_parent(target)
    if target.is_symlink():
        resolved = target.resolve(strict=False)
        if resolved == source:
            return {"target": str(target), "source": str(source), "status": "already_linked"}
        raise RuntimeError(f"Refusing to replace existing symlink: {target} -> {resolved}")
    if target.exists():
        raise RuntimeError(f"Refusing to replace existing path: {target}")
    target.symlink_to(source, target_is_directory=source.is_dir())
    return {"target": str(target), "source": str(source), "status": "linked"}


def install_copy(source: Path, target: Path) -> dict:
    ensure_target_parent(target)
    if target.exists():
        raise RuntimeError(f"Refusing to replace existing path: {target}")
    shutil.copytree(source, target)
    return {"target": str(target), "source": str(source), "status": "copied"}


def install_one(source: Path, target: Path, mode: str) -> dict:
    if not source.exists():
        raise FileNotFoundError(f"Missing source path: {source}")
    if mode == "symlink":
        return install_symlink(source, target)
    return install_copy(source, target)


def build_targets(codex_home: Path) -> list[tuple[Path, Path]]:
    root = repo_root()
    targets = []
    for skill_name in SKILL_NAMES:
        targets.append((root / "skills" / skill_name, codex_home / "skills" / skill_name))
    targets.append(
        (root / "lib" / SHARED_LIB_NAME, codex_home / "lib" / SHARED_LIB_NAME)
    )
    return targets


def main() -> int:
    parser = argparse.ArgumentParser(description="Install this repository's skills and shared library into CODEX_HOME.")
    parser.add_argument(
        "--mode",
        choices=("symlink", "copy"),
        default="symlink",
        help="Installation mode for skills and shared library.",
    )
    parser.add_argument(
        "--json",
        action="store_true",
        help="Emit the installation report as JSON.",
    )
    args = parser.parse_args()

    codex_home = detect_codex_home()
    results = []
    for source, target in build_targets(codex_home):
        results.append(install_one(source, target, args.mode))

    payload = {
        "codex_home": str(codex_home),
        "mode": args.mode,
        "results": results,
    }
    if args.json:
        print(json.dumps(payload, ensure_ascii=False, indent=2))
    else:
        for result in results:
            print(f'{result["status"]}: {result["target"]} <- {result["source"]}')
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
