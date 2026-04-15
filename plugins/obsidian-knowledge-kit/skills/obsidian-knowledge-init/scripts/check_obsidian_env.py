#!/usr/bin/env python3
from pathlib import Path
import sys

LIB = Path(__file__).resolve().parents[3] / "lib"
sys.path.insert(0, str(LIB))

from obsidian_knowledge_shared.preflight import main


if __name__ == "__main__":
    raise SystemExit(main())
