# obs-wiki

[English README](./README.md)

obs-wiki 的新方向是一个 Obsidian 原生插件：让 Agent 使用 Obsidian vault 作为外置长期记忆库和知识库。

当前项目正在从旧的 Codex plugin-first 工作流，重置为 Obsidian plugin-first + Agent memory-first 架构。Obsidian 插件负责用户侧的复核、审计、权限、资料分析入口和可视化监督；MCP 是 Agent 的主调用接口；Obsidian vault 是唯一长期记忆与知识载体。

## 当前方向

- 产品名：`obs-wiki`
- 插件 id：`obs-wiki`
- 主产品形态：Obsidian 原生插件
- Agent 接口：MCP tools、resources、prompts
- 记忆载体：Obsidian vault 中的 notes、Properties、wikilinks、block references、review queue、audit log
- Runtime 职责：索引、召回、context pack、lint preview、source analysis、writeback planning、权限检查和 audit event 生成

仓库中仍保留上一代 Codex 本地插件包和 Python runtime。它们现在应作为历史参考使用，不再作为新产品主线。是否归档或删除旧结构，需要后续明确决策。

## 产品原则

- Agent-first：让 Agent 在执行任务时主动召回上下文、历史决策、用户偏好和资料。
- Obsidian-native：知识本体始终保存在 vault 中，索引和缓存只是加速层。
- Review-first：Agent 可以提出长期记忆建议，但不能默认静默提交高风险长期记忆。
- Evidence-first：重要结论必须能追溯到 source、evidence block 和 review state。
- Audit-first：Agent 的关键读写必须在 Obsidian 中可见、可解释、可复核。
- MCP-first for agent access：对 Agent 暴露记忆语义工具，而不是任意文件系统操作。
- Plugin-first for user supervision：Obsidian 插件是用户监督、复核、权限和资料队列界面。

## 目标架构

```text
Agent / AI Client
Codex / Claude / Cursor / ChatGPT / Local Agent
        ↓ MCP
obs-wiki MCP Server
        ↓
obs-wiki Memory Runtime
        ↓
obs-wiki Obsidian Plugin Bridge
        ↓
Obsidian Vault
        ↓
Human Review / Audit / Correction in Obsidian App
```

## 规划中的仓库结构

```text
obs-wiki/
├─ apps/
│  ├─ obsidian-plugin/
│  ├─ mcp-server/
│  └─ cli/
├─ packages/
│  ├─ core/
│  ├─ schemas/
│  └─ shared/
├─ docs/
├─ tests/
└─ package.json
```

## 第一条实施主线

第一条实施主线来自 [docs/obs_wiki_new_start_plan](./docs/obs_wiki_new_start_plan/00_README.md)：

1. 方向重置与文档落地。
2. 在 `apps/obsidian-plugin/` 新增 Obsidian 插件 scaffold。
3. 实现 vault memory structure 初始化。
4. 实现 Agent Activity 和 Audit UI。
5. 实现 Review Queue。
6. 实现 Source Analysis Request。
7. 实现 Memory Runtime v0。
8. 实现只读 MCP Server MVP。

第一阶段编码目标是一个可构建的 Obsidian 插件 scaffold，至少包含：

- id 为 `obs-wiki` 的 `manifest.json`
- TypeScript 项目配置
- `main.ts`
- ribbon icon
- command palette 命令
- 可持久化配置的 settings tab
- 基础 ItemView

## 新方向文档

- [方案包 README](./docs/obs_wiki_new_start_plan/00_README.md)
- [产品愿景](./docs/obs_wiki_new_start_plan/01_Product_Vision.md)
- [系统架构](./docs/obs_wiki_new_start_plan/02_System_Architecture.md)
- [知识库与长期记忆模型](./docs/obs_wiki_new_start_plan/03_Knowledge_And_Memory_Model.md)
- [Obsidian 插件设计](./docs/obs_wiki_new_start_plan/04_Obsidian_Plugin_Design.md)
- [Agent Memory API](./docs/obs_wiki_new_start_plan/05_Agent_Memory_API.md)
- [Runtime 与 MCP 设计](./docs/obs_wiki_new_start_plan/06_Runtime_And_MCP_Design.md)
- [分阶段执行计划](./docs/obs_wiki_new_start_plan/07_Phased_Execution_Plan.md)
- [Codex 任务提示词](./docs/obs_wiki_new_start_plan/08_Codex_Task_Prompts.md)
- [验收清单](./docs/obs_wiki_new_start_plan/09_Acceptance_Checklists.md)
- [开放问题](./docs/obs_wiki_new_start_plan/10_Open_Questions.md)
- [机器可读实施清单](./docs/obs_wiki_new_start_plan/IMPLEMENTATION_MANIFEST.json)

## 旧实现参考

现有 `skills/`、`plugins/obs-wiki/`、`lib/obs_wiki_shared/`、`scripts/` 属于上一代 Codex plugin-first 实现。它们可以作为 context pack、lint、evidence scaffold、MCP 边界和 vault-only 规则的参考，但不再是新产品的主要用户入口。

在迁移决策完成前：

- 默认不删除旧代码。
- 不继续把旧 skills 或 commands 作为主产品路径优化。
- 除非任务明确要求，不写入真实 Obsidian vault。
- 新的 Obsidian-native 工作放在 `apps/` 和 `packages/` 下。

## 许可证

本项目采用 [MIT License](./LICENSE)。
