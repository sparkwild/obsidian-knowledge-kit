from __future__ import annotations

import shutil
import subprocess
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path


@dataclass(frozen=True)
class ActiveVaultInfo:
    name: str
    path: Path


def _run_obsidian(args: list[str], timeout: int = 20) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        ["obsidian", *args],
        capture_output=True,
        text=True,
        timeout=timeout,
    )


def _cli_escape(value: str) -> str:
    return value.replace("\\", "\\\\").replace("\n", "\\n").replace("\t", "\\t")


@lru_cache(maxsize=1)
def detect_active_vault_info() -> ActiveVaultInfo | None:
    if shutil.which("obsidian") is None:
        return None

    path_proc = _run_obsidian(["vault", "info=path"])
    if path_proc.returncode != 0:
        return None
    vault_path = path_proc.stdout.strip()
    if not vault_path:
        return None

    name_proc = _run_obsidian(["vault", "info=name"])
    if name_proc.returncode != 0:
        return None
    vault_name = name_proc.stdout.strip()
    if not vault_name:
        return None

    return ActiveVaultInfo(name=vault_name, path=Path(vault_path).expanduser())


def can_use_obsidian_cli(vault_path: Path) -> bool:
    info = detect_active_vault_info()
    if info is None:
        return False
    try:
        return info.path.resolve() == vault_path.expanduser().resolve()
    except FileNotFoundError:
        return False


def obsidian_cli_args(vault_path: Path, command: list[str]) -> list[str]:
    info = detect_active_vault_info()
    if info is not None and can_use_obsidian_cli(vault_path):
        return [f"vault={info.name}", *command]
    return command


def list_markdown_notes(vault_path: Path, folder: str | None = None) -> list[str]:
    if can_use_obsidian_cli(vault_path):
        command = ["files"]
        if folder:
            command.append(f"folder={folder}")
        command.append("ext=md")
        proc = _run_obsidian(obsidian_cli_args(vault_path, command))
        if proc.returncode == 0:
            return [line.strip() for line in proc.stdout.splitlines() if line.strip()]

    base = vault_path / folder if folder else vault_path
    return sorted(path.relative_to(vault_path).as_posix() for path in base.rglob("*.md") if path.is_file())


def read_note_content(vault_path: Path, note_path: str) -> str | None:
    if can_use_obsidian_cli(vault_path):
        proc = _run_obsidian(obsidian_cli_args(vault_path, ["read", f"path={note_path}"]))
        if proc.returncode == 0:
            return proc.stdout
    absolute = vault_path / note_path
    if not absolute.exists():
        return None
    return absolute.read_text(encoding="utf-8")


def write_note_content(vault_path: Path, note_path: str, content: str) -> None:
    if can_use_obsidian_cli(vault_path):
        proc = _run_obsidian(
            obsidian_cli_args(vault_path, ["create", f"path={note_path}", f"content={_cli_escape(content)}", "overwrite"])
        )
        if proc.returncode == 0:
            return

    absolute = vault_path / note_path
    absolute.parent.mkdir(parents=True, exist_ok=True)
    absolute.write_text(content, encoding="utf-8")


def append_note_content(vault_path: Path, note_path: str, content: str) -> None:
    if can_use_obsidian_cli(vault_path):
        proc = _run_obsidian(obsidian_cli_args(vault_path, ["append", f"path={note_path}", f"content={_cli_escape(content)}"]))
        if proc.returncode == 0:
            return

    absolute = vault_path / note_path
    absolute.parent.mkdir(parents=True, exist_ok=True)
    if absolute.exists():
        existing = absolute.read_text(encoding="utf-8").rstrip()
        absolute.write_text(existing + content + "\n", encoding="utf-8")
    else:
        absolute.write_text(content, encoding="utf-8")
