from __future__ import annotations

import argparse
import json
from datetime import date

from .constants import BASE_DIRECTORIES


def build_notes() -> dict:
    today = date.today().isoformat()
    notes = {
        "00_system/system.md": f"""---
title: system
aliases:
  - 系统规则
created: {today}
updated: {today}
type: manual
---

# 系统规则（system）

> [!important]
> 本仓库运行在当前打开的 Obsidian 应用中。核心目标是让 Codex 在 Obsidian 原生环境里长期稳定工作，同时保留可审计、可维护、可扩展的知识闭环。

## top_level_structure 顶层结构

- `00_system/`：治理规则与导航骨架
- `01_ai_core/`：当前上下文与长期上下文
- `02_timeline/`：daily notes、sessions、weekly reviews
- `03_raw/`：不可直接改写的原始资料
- `04_projects/`：项目执行与阶段追踪
- `05_knowledge/`：稳定知识页
- `06_experience/`：错误、成功、检查清单、决策模式
- `07_archive/`：归档内容

## runtime_boundaries 运行边界

- 依赖 Obsidian 原生 Markdown、frontmatter、wikilinks、search、backlinks 以及活动仓库能力
- 依赖 Obsidian CLI 执行仓库感知的创建、读取、搜索、追加和校验
- 核心闭环不依赖社区插件、外部 Web 服务或非必要脚本
- 如果变更涉及结构、元数据策略、归档策略或自动化边界，先和用户确认
""",
        "00_system/index.md": f"""# 索引（index）

> updated: {today}
> scope: 活跃上下文 / 项目 / 知识 / 经验 / 来源登记

## active_context 当前上下文

- [[01_ai_core/active_context|当前上下文]]
- [[01_ai_core/longterm_context|长期上下文]]

## projects 项目

- [[04_projects/knowledge_base/project_overview|知识库项目总览]]
""",
        "00_system/log.md": """# log

> append only
> event types: `ingest / update / session / review / archive / decision`
""",
        "00_system/decision_records.md": f"""---
title: decision_records
aliases:
  - 决策记录
created: {today}
updated: {today}
type: decision
---

# 决策记录（decision_records）
""",
        "01_ai_core/active_context.md": f"""---
title: active_context
aliases:
  - 当前上下文
created: {today}
updated: {today}
type: ai-context
---

# 当前上下文（active_context）

## current_focus 当前重点
""",
        "01_ai_core/longterm_context.md": f"""---
title: longterm_context
aliases:
  - 长期上下文
created: {today}
updated: {today}
type: ai-context
---

# 长期上下文（longterm_context）
""",
        "04_projects/knowledge_base/project_overview.md": f"""---
title: project_overview
aliases:
  - 项目总览
  - 知识库项目总览
created: {today}
updated: {today}
type: project
status: active
---

# 项目总览（project_overview）
""",
        "05_knowledge/manuals/codex_native_workflow.md": f"""---
title: codex_native_workflow
aliases:
  - 运行手册
created: {today}
updated: {today}
type: manual
---

# 运行手册（codex_native_workflow）
""",
        "05_knowledge/manuals/external_material_ingest_guide.md": f"""---
title: external_material_ingest_guide
aliases:
  - 外部资料导入规范
created: {today}
updated: {today}
type: manual
---

# 外部资料导入规范（external_material_ingest_guide）
""",
    }
    return {"directories": list(BASE_DIRECTORIES), "notes": notes}


def main() -> int:
    parser = argparse.ArgumentParser(description="Render the minimal Obsidian knowledge-base bootstrap notes.")
    parser.add_argument("--json", action="store_true", help="Emit note and directory manifest as JSON")
    args = parser.parse_args()

    payload = build_notes()
    if args.json:
        print(json.dumps(payload, ensure_ascii=False, indent=2))
    else:
        print(payload)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
