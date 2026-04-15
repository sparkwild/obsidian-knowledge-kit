from __future__ import annotations

import argparse
import json
import os
import shutil
import tempfile
import urllib.error
import urllib.request
import zipfile
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path

from .constants import REPO_NAME, REPO_OWNER, REPO_REF, default_codex_home


@dataclass
class SkillState:
    name: str
    install_path: Path
    target_path: Path
    is_symlink: bool
    exists: bool
    source_manifest: dict | None
    remote_tree_sha: str | None
    remote_path: str | None


def detect_codex_home() -> Path:
    return Path(os.environ.get("CODEX_HOME", default_codex_home())).expanduser()


def github_json(url: str) -> dict | list:
    req = urllib.request.Request(url, headers={"Accept": "application/vnd.github+json"})
    with urllib.request.urlopen(req, timeout=20) as resp:
        return json.loads(resp.read().decode("utf-8"))


def remote_skill_sha(skill_name: str) -> tuple[str | None, str | None]:
    candidates = [
        ("", skill_name),
        ("skills", skill_name),
    ]
    for parent, child in candidates:
        rel = f"{parent}/{child}".strip("/")
        url = f"https://api.github.com/repos/{REPO_OWNER}/{REPO_NAME}/contents/{parent}?ref={REPO_REF}".rstrip("/")
        try:
            payload = github_json(url)
        except urllib.error.HTTPError as exc:
            if exc.code == 404:
                continue
            raise
        if isinstance(payload, list):
            for item in payload:
                if item.get("name") == child and item.get("type") == "dir":
                    return item.get("sha"), rel
    return None, None


def manifest_path(target_path: Path) -> Path:
    return target_path / ".obsidian-skill-source.json"


def read_manifest(target_path: Path) -> dict | None:
    path = manifest_path(target_path)
    if not path.exists():
        return None
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return None


def resolve_target(skill_name: str, codex_home: Path) -> tuple[Path, Path, bool, bool]:
    install_path = codex_home / "skills" / skill_name
    if install_path.is_symlink():
        target = install_path.resolve(strict=False)
        return install_path, target, True, target.exists()
    return install_path, install_path, False, install_path.exists()


def current_state(skill_name: str, codex_home: Path | None = None) -> SkillState:
    codex_home = codex_home or detect_codex_home()
    install_path, target_path, is_symlink, exists = resolve_target(skill_name, codex_home)
    remote_sha, remote_path = remote_skill_sha(skill_name)
    manifest = read_manifest(target_path) if exists else None
    return SkillState(
        name=skill_name,
        install_path=install_path,
        target_path=target_path,
        is_symlink=is_symlink,
        exists=exists,
        source_manifest=manifest,
        remote_tree_sha=remote_sha,
        remote_path=remote_path,
    )


def locate_skill_dir(extracted_root: Path, skill_name: str) -> Path:
    for candidate in extracted_root.rglob(skill_name):
        if candidate.is_dir() and (candidate / "SKILL.md").exists():
            return candidate
    raise FileNotFoundError(f"Could not locate skill directory for {skill_name!r} in extracted archive")


def download_repo_archive() -> Path:
    tmpdir = Path(tempfile.mkdtemp(prefix="kepano-skills-"))
    archive_path = tmpdir / "repo.zip"
    url = f"https://codeload.github.com/{REPO_OWNER}/{REPO_NAME}/zip/refs/heads/{REPO_REF}"
    urllib.request.urlretrieve(url, archive_path)
    with zipfile.ZipFile(archive_path) as zf:
        zf.extractall(tmpdir)
    return tmpdir


def write_manifest(target_path: Path, skill_name: str, remote_path: str, remote_tree_sha: str) -> None:
    payload = {
        "source_repo": f"{REPO_OWNER}/{REPO_NAME}",
        "source_path": remote_path,
        "source_ref": REPO_REF,
        "source_tree_sha": remote_tree_sha,
        "installed_at": datetime.now(timezone.utc).isoformat(),
    }
    manifest_path(target_path).write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")


def atomic_replace_dir(src_dir: Path, dst_dir: Path) -> None:
    if dst_dir.exists() and not dst_dir.is_dir():
        raise RuntimeError(f"Destination is not a directory: {dst_dir}")
    tmp_dst = dst_dir.parent / f".{dst_dir.name}.tmp-replace"
    if tmp_dst.exists():
        shutil.rmtree(tmp_dst)
    shutil.copytree(src_dir, tmp_dst)
    if dst_dir.exists():
        shutil.rmtree(dst_dir)
    tmp_dst.replace(dst_dir)


def install_or_update(skill_name: str, codex_home: Path | None = None) -> dict:
    codex_home = codex_home or detect_codex_home()
    state = current_state(skill_name, codex_home)
    if not state.remote_tree_sha or not state.remote_path:
        raise RuntimeError(f"Could not find remote path for official skill {skill_name}")

    extracted = download_repo_archive()
    src_skill = locate_skill_dir(extracted, skill_name)
    state.target_path.parent.mkdir(parents=True, exist_ok=True)
    atomic_replace_dir(src_skill, state.target_path)
    write_manifest(state.target_path, skill_name, state.remote_path, state.remote_tree_sha)
    return {
        "skill": skill_name,
        "install_path": str(state.install_path),
        "target_path": str(state.target_path),
        "is_symlink_install": state.is_symlink,
        "remote_tree_sha": state.remote_tree_sha,
        "remote_path": state.remote_path,
        "status": "installed" if not state.exists else "updated",
    }


def as_dict(state: SkillState) -> dict:
    local_sha = state.source_manifest.get("source_tree_sha") if state.source_manifest else None
    return {
        "skill": state.name,
        "install_path": str(state.install_path),
        "target_path": str(state.target_path),
        "is_symlink_install": state.is_symlink,
        "exists": state.exists,
        "local_source_tree_sha": local_sha,
        "remote_source_tree_sha": state.remote_tree_sha,
        "remote_path": state.remote_path,
        "status": (
            "missing"
            if not state.exists
            else "unknown_local_source"
            if not state.source_manifest
            else "up_to_date"
            if state.remote_tree_sha == local_sha
            else "outdated"
        ),
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="Check and install/update official kepano/obsidian-skills.")
    parser.add_argument("skills", nargs="+", help="Skill names, e.g. obsidian-cli obsidian-markdown")
    parser.add_argument("--apply", action="store_true", help="Install missing skills and update outdated ones")
    args = parser.parse_args()

    codex_home = detect_codex_home()
    states = [current_state(name, codex_home) for name in args.skills]
    report = [as_dict(state) for state in states]
    if args.apply:
        changed = []
        for item in report:
            if item["status"] in {"missing", "outdated", "unknown_local_source"}:
                changed.append(install_or_update(item["skill"], codex_home))
        print(json.dumps({"checked": report, "changed": changed}, ensure_ascii=False, indent=2))
    else:
        print(json.dumps(report, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
