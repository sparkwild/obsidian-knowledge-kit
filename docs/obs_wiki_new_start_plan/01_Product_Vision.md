# obs-wiki 产品愿景

## 一句话定位

**obs-wiki：让 Agent 通过 MCP 使用 Obsidian vault 作为外置长期记忆库和知识库，并让用户在 Obsidian 中审核治理。**

英文定位：

> obs-wiki turns your Obsidian vault into an external memory and knowledge layer for AI agents.

## 角色定义

### Agent 是主使用者

Agent 是唯一操作入口。用户提交 URL、文件、资料分析、context pack、lint、distill、长期记忆提案等任务时，应在 Agent 客户端中发起，由 Agent 主动调用 obs-wiki：

- 获取项目上下文。
- 获取用户长期偏好。
- 获取历史决策。
- 获取已收集资料。
- 构建 context pack。
- 抓取和分析新资料。
- 运行 lint / distill / source analysis。
- 提出长期记忆写入建议。
- 完成任务后沉淀 session 和 proposals。

### Obsidian vault 是记忆载体

所有知识和长期记忆都保存在 Obsidian vault 内：

- Markdown notes。
- Properties / frontmatter。
- Wikilinks。
- Block references。
- Bases dashboards。
- Source notes。
- Context packs。
- Review queue。
- Audit log。

插件索引、缓存和数据库只能作为加速层，不能成为唯一知识本体。

### Obsidian App 是监督界面

用户主要在 Obsidian 中完成治理动作：

- 查看 Agent 最近读写了什么。
- 审核 memory proposals。
- 批准、拒绝、延期、请求修订或触发已批准写回。
- 查看 source / evidence / claim 链路。
- 修改错误记忆。
- 管理权限。
- 查看 audit log。

Obsidian 插件不提供资料提交或维护动作入口。以下动作不应出现在插件命令或按钮中：

- Analyze URL / Analyze Local File / Analyze Current Note / Analyze Selection。
- Capture Source / Add Source to Inbox。
- Build Context Pack。
- Run Lint。
- Run Distill。
- Create Source Analysis Request。

### MCP 是 Agent 主入口

外部 Agent 通过 MCP 调用 obs-wiki：

- Codex。
- Claude。
- Cursor。
- ChatGPT。
- 本地 Agent。

MCP 不应暴露任意文件系统操作，而应暴露高层记忆语义工具。

## 产品原则

1. **Agent-first**：首要目标是让 Agent 在任务执行中使用记忆，而不是让用户手动整理笔记。
2. **Obsidian-native**：知识本体始终在 Obsidian vault 中。
3. **Review-first**：Agent 可以提出长期记忆，但不能默认静默提交高风险长期记忆。
4. **Evidence-first**：重要结论必须能追溯到 source / evidence block / claim。
5. **Audit-first**：Agent 的关键读写必须可见、可解释、可撤销。
6. **MCP-first for Agent access**：Agent 通过 MCP 使用记忆。
7. **Human Governance in Obsidian**：Obsidian 插件是审核、批准、拒绝、修订请求、审计和状态界面。
8. **Runtime as engine**：Memory Runtime 负责检索、索引、context pack、lint、source analysis、proposal 和 approved writeback。
9. **Single Agent Operation Entry**：所有资料提交、分析、整理和提案生成都由 Agent 发起。

## 从旧 obs-wiki 借鉴的内容

- Context pack。
- Source register。
- Evidence / claim scaffold。
- Knowledge lint。
- Obsidian vault-only 原则。
- MCP adapter 边界。

## 明确推翻的内容

- Codex 插件作为主产品。
- 让 Agent 自己读 markdown command 后运行脚本。
- 用 global AGENTS hint 作为主要唤醒方式。
- 使用 query/lint/ingest/refine 作为主要用户心智。
- 旧 Vaultwright 命名。
- 在 Obsidian 插件和 Agent 两边同时开放资料提交入口。
- 由 Obsidian 插件直接生成 source、analysis、context、session 或 memory proposal。

新名称统一使用：`obs-wiki`。
