#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import shutil
from pathlib import Path


PLUGIN_NAME = "obsidian-knowledge-kit"
DEFAULT_MARKETPLACE_NAME = "local-plugins"
DEFAULT_MARKETPLACE_DISPLAY_NAME = "Local Plugins"


def script_root() -> Path:
    return Path(__file__).resolve().parents[1]


def plugin_source_root() -> Path:
    root = script_root()
    if (root / ".codex-plugin" / "plugin.json").exists():
        return root
    return root / "plugins" / PLUGIN_NAME


def home_root() -> Path:
    return Path.home()


def target_plugin_root(home: Path) -> Path:
    return home / "plugins" / PLUGIN_NAME


def target_marketplace_path(home: Path) -> Path:
    return home / ".agents" / "plugins" / "marketplace.json"


def copy_plugin_tree(src: Path, dst: Path, force: bool) -> None:
    if src.resolve() == dst.resolve():
        return
    if dst.exists():
        if not force:
            raise FileExistsError(f"Target plugin path already exists: {dst}")
        shutil.rmtree(dst)
    dst.parent.mkdir(parents=True, exist_ok=True)
    shutil.copytree(src, dst, ignore=shutil.ignore_patterns("__pycache__", "*.pyc", ".DS_Store"))


def load_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def save_json(path: Path, payload: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def build_default_marketplace() -> dict:
    return {
        "name": DEFAULT_MARKETPLACE_NAME,
        "interface": {
            "displayName": DEFAULT_MARKETPLACE_DISPLAY_NAME,
        },
        "plugins": [],
    }


def upsert_marketplace_entry(path: Path, force: bool) -> tuple[dict, str]:
    if path.exists():
        payload = load_json(path)
    else:
        payload = build_default_marketplace()

    plugins = payload.setdefault("plugins", [])
    new_entry = {
        "name": PLUGIN_NAME,
        "source": {
            "source": "local",
            "path": f"./plugins/{PLUGIN_NAME}",
        },
        "policy": {
            "installation": "AVAILABLE",
            "authentication": "ON_INSTALL",
        },
        "category": "Productivity",
    }

    for index, entry in enumerate(plugins):
        if isinstance(entry, dict) and entry.get("name") == PLUGIN_NAME:
            if not force:
                raise FileExistsError(f"Marketplace entry already exists for {PLUGIN_NAME!r}: {path}")
            plugins[index] = new_entry
            save_json(path, payload)
            return payload, "updated"

    plugins.append(new_entry)
    save_json(path, payload)
    return payload, "created" if len(plugins) == 1 else "appended"


def main() -> int:
    parser = argparse.ArgumentParser(description="Install the repo-local Codex plugin into the user's home-local plugin marketplace.")
    parser.add_argument("--home", help="Alternate home directory root. Defaults to the current user's home directory.")
    parser.add_argument("--force", action="store_true", help="Overwrite an existing plugin copy and marketplace entry.")
    parser.add_argument("--dry-run", action="store_true", help="Do not write anything; emit the installation plan only.")
    parser.add_argument("--json", action="store_true", help="Emit the installation report as JSON.")
    args = parser.parse_args()

    home = Path(args.home).expanduser() if args.home else home_root()
    source_root = plugin_source_root()
    plugin_target = target_plugin_root(home)
    marketplace_target = target_marketplace_path(home)

    payload = {
        "source_plugin_root": str(source_root),
        "target_plugin_root": str(plugin_target),
        "target_marketplace_path": str(marketplace_target),
        "dry_run": args.dry_run,
        "force": args.force,
    }

    same_installation = source_root.resolve() == plugin_target.resolve()
    payload["source_equals_target"] = same_installation

    if not args.dry_run:
        copy_plugin_tree(source_root, plugin_target, force=args.force)
        marketplace_payload, marketplace_status = upsert_marketplace_entry(marketplace_target, force=args.force)
        payload["marketplace_status"] = marketplace_status
        payload["marketplace_name"] = marketplace_payload.get("name")

    if args.json:
        print(json.dumps(payload, ensure_ascii=False, indent=2))
    else:
        for key, value in payload.items():
            print(f"{key}: {value}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
