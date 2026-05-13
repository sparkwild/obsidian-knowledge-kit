# obs-wiki Obsidian 插件新方向方案包

版本：2026-05-12
适用仓库：`sparkwild/obs-wiki`
执行者：本地 Codex App
目标：将 obs-wiki 作为 Agent-first 外置记忆系统和 Obsidian 审核治理插件重新设计与实现。

## 本方案的核心判断

这是一个全新的开始，不要求保留或兼容旧的 Codex 插件形态。

旧项目中值得借鉴的是：

- active Obsidian vault 是唯一知识和记忆载体。
- context pack 让 Agent 在任务开始前获得聚焦上下文。
- source / evidence / claim / synthesis 的知识治理思路。
- lint / review / dashboard 的知识健康管理思路。
- MCP tools / resources / prompts 的 Agent 接入边界。

旧项目中应该推翻的是：

- Codex plugin-first 的产品形态。
- skills / commands / Python scripts 作为主要入口的使用体验。
- global AGENTS hint 作为唤醒机制。
- 让 Agent 自己想起插件、自己读说明书、自己跑脚本的工作方式。
- 以 query / lint / ingest / refine 作为 Agent 的主要心智入口。

新的产品定位：

> obs-wiki 让 Agent 使用 Obsidian vault 作为外置长期记忆库和知识库。Agent 通过 MCP / runtime 发起资料提交、分析、context pack、lint、distill 和 proposal；Obsidian 插件负责审核、批准、拒绝、审计、权限、状态和可视化监督。

## 方案包目录

- `01_Product_Vision.md`：产品愿景与原则。
- `02_System_Architecture.md`：整体架构。
- `03_Knowledge_And_Memory_Model.md`：知识库与长期记忆模型。
- `04_Obsidian_Plugin_Design.md`：Obsidian 插件界面、命令、设置与交互。
- `05_Agent_Memory_API.md`：Agent-first API / MCP tools 设计。
- `06_Runtime_And_MCP_Design.md`：Memory Runtime、MCP Server、生命周期和权限。
- `07_Phased_Execution_Plan.md`：分阶段执行计划。
- `08_Codex_Task_Prompts.md`：可复制给 Codex 的任务提示词。
- `09_Acceptance_Checklists.md`：验收清单。
- `10_Open_Questions.md`：需要和用户继续沟通的问题。
- `12_First_Batch_Adjustment.md`：Agent 发起、Obsidian 审核的第一批调整记录。
- `IMPLEMENTATION_MANIFEST.json`：机器可读的阶段清单。

## 给 Codex 的总指令

请先完整阅读本方案包，然后在当前仓库新建分支执行。不要把旧的 Codex 插件形态视为必须保留的约束。可以重构、替换、归档或移除旧结构，但每一步都需要做到可解释、可验证、可回滚。

优先实现 Agent-first 记忆工作流与 Obsidian 审核治理插件骨架，而不是继续优化旧的 Codex 插件体验。
