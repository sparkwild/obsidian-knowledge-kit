#!/usr/bin/env python3
from __future__ import annotations

import shutil
from pathlib import Path


PLUGIN_NAME = "obsidian-knowledge-kit"


def repo_root() -> Path:
    return Path(__file__).resolve().parents[1]


def reset_directory(path: Path) -> None:
    if path.is_symlink() or path.is_file():
        path.unlink()
    elif path.exists():
        shutil.rmtree(path)
    path.mkdir(parents=True, exist_ok=True)


def copy_tree(src: Path, dst: Path) -> None:
    if dst.is_symlink() or dst.is_file():
        dst.unlink()
    elif dst.exists():
        shutil.rmtree(dst)
    shutil.copytree(src, dst, ignore=shutil.ignore_patterns("__pycache__", "*.pyc", ".DS_Store"))


def main() -> int:
    root = repo_root()
    plugin_root = root / "plugins" / PLUGIN_NAME
    if not plugin_root.exists():
        raise SystemExit(f"Missing plugin root: {plugin_root}")

    copy_tree(root / "skills", plugin_root / "skills")
    copy_tree(root / "lib", plugin_root / "lib")
    copy_tree(root / "scripts", plugin_root / "scripts")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
