#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
from pathlib import Path


PLUGIN_NAME = "obsidian-knowledge-kit"
EXPECTED_SKILLS = (
    "obsidian-knowledge-init",
    "obsidian-knowledge-ingest",
    "obsidian-knowledge-refine",
)
EXPECTED_COMMANDS = ("setup.md", "start.md", "doctor.md", "init.md", "ingest.md", "refine.md", "distill.md")
EXPECTED_SCRIPTS = (
    "check_codex_plugin.py",
    "install_global_knowledge_hint.py",
    "install_home_local_plugin.py",
    "load_knowledge_context.py",
    "prepare_ingest_source.py",
    "render_session_skeleton.py",
)


def repo_root() -> Path:
    return Path(__file__).resolve().parents[1]


def load_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def build_report() -> dict:
    root = repo_root()
    plugin_root = root / "plugins" / PLUGIN_NAME
    manifest_path = plugin_root / ".codex-plugin" / "plugin.json"
    marketplace_path = root / ".agents" / "plugins" / "marketplace.json"
    home_marketplace_path = Path.home() / ".agents" / "plugins" / "marketplace.json"
    skills_link = plugin_root / "skills"
    lib_path = plugin_root / "lib" / "obsidian_knowledge_shared"
    agents_path = plugin_root / "agents" / "openai.yaml"
    commands_path = plugin_root / "commands"
    assets_path = plugin_root / "assets"
    scripts_path = plugin_root / "scripts"

    issues: list[str] = []

    if not manifest_path.exists():
        issues.append(f"Missing plugin manifest: {manifest_path}")
        manifest = {}
    else:
        manifest = load_json(manifest_path)

    if marketplace_path.exists():
        issues.append(f"Repo-local marketplace should be removed after home-local installation: {marketplace_path}")
        marketplace = load_json(marketplace_path)
    else:
        marketplace = {}

    if not home_marketplace_path.exists():
        issues.append(f"Missing home-local marketplace manifest: {home_marketplace_path}")
        home_marketplace = {}
    else:
        home_marketplace = load_json(home_marketplace_path)

    plugin_entry = None
    for entry in home_marketplace.get("plugins", []):
        if isinstance(entry, dict) and entry.get("name") == PLUGIN_NAME:
            plugin_entry = entry
            break

    if plugin_entry is None:
        issues.append(f"Home-local marketplace entry for {PLUGIN_NAME!r} not found.")

    manifest_name = manifest.get("name")
    if manifest and manifest_name != PLUGIN_NAME:
        issues.append(f"Plugin manifest name mismatch: expected {PLUGIN_NAME!r}, got {manifest_name!r}")
    if manifest:
        if manifest.get("skills") != "./skills/":
            issues.append("Plugin manifest should point `skills` to `./skills/`.")
        interface = manifest.get("interface", {})
        for field_name in ("displayName", "shortDescription", "longDescription", "developerName", "category", "websiteURL", "composerIcon", "logo"):
            if not interface.get(field_name):
                issues.append(f"Plugin interface is missing `{field_name}`.")
        default_prompt = interface.get("defaultPrompt", [])
        if not isinstance(default_prompt, list) or not default_prompt:
            issues.append("Plugin interface should include a non-empty `defaultPrompt` list.")
        elif len(default_prompt) > 3:
            issues.append("Plugin interface `defaultPrompt` should include at most 3 entries.")

    source_path = plugin_entry.get("source", {}).get("path") if plugin_entry else None
    expected_source_path = f"./plugins/{PLUGIN_NAME}"
    if source_path and source_path != expected_source_path:
        issues.append(
            f"Marketplace source path mismatch: expected {expected_source_path!r}, got {source_path!r}"
        )

    if not skills_link.exists():
        issues.append(f"Missing plugin skills path: {skills_link}")
        skill_targets: list[str] = []
    else:
        if skills_link.is_symlink():
            issues.append("Plugin skills path is a symlink. Local plugins should be self-contained for cache installs.")
        skill_targets = sorted(
            child.name
            for child in skills_link.iterdir()
            if child.is_dir() and (child / "SKILL.md").exists()
        )

    if not lib_path.exists():
        issues.append(f"Missing bundled plugin library: {lib_path}")
    if not agents_path.exists():
        issues.append(f"Missing plugin agent metadata: {agents_path}")
    if not commands_path.exists():
        issues.append(f"Missing plugin commands directory: {commands_path}")
    else:
        for command_name in EXPECTED_COMMANDS:
            if not (commands_path / command_name).exists():
                issues.append(f"Missing plugin command: {commands_path / command_name}")
    if not assets_path.exists():
        issues.append(f"Missing plugin assets directory: {assets_path}")
    if not scripts_path.exists():
        issues.append(f"Missing plugin scripts directory: {scripts_path}")
    else:
        for script_name in EXPECTED_SCRIPTS:
            if not (scripts_path / script_name).exists():
                issues.append(f"Missing plugin script: {scripts_path / script_name}")

    missing_skills = [name for name in EXPECTED_SKILLS if name not in skill_targets]
    if missing_skills:
        issues.append(f"Missing plugin skills: {', '.join(missing_skills)}")

    return {
        "ok": not issues,
        "repo_root": str(root),
        "plugin_root": str(plugin_root),
        "plugin_manifest": str(manifest_path),
        "repo_marketplace_manifest": str(marketplace_path),
        "home_marketplace_manifest": str(home_marketplace_path),
        "skills_path": str(skills_link),
        "bundled_lib_path": str(lib_path),
        "plugin_agents_path": str(agents_path),
        "plugin_commands_path": str(commands_path),
        "plugin_assets_path": str(assets_path),
        "plugin_scripts_path": str(scripts_path),
        "skills_is_symlink": skills_link.is_symlink(),
        "discovered_skills": skill_targets,
        "issues": issues,
        "next_steps": [
            "Open Codex and verify the plugin appears under the home-local marketplace.",
            "If the plugin does not appear immediately, reopen the repository or restart Codex.",
        ],
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="Validate the repo-local Codex plugin package.")
    parser.add_argument("--json", action="store_true", help="Emit the validation report as JSON.")
    args = parser.parse_args()

    report = build_report()
    if args.json:
        print(json.dumps(report, ensure_ascii=False, indent=2))
    else:
        for key, value in report.items():
            print(f"{key}: {value}")
    return 0 if report["ok"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
