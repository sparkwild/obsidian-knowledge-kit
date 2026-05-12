# obs-wiki Obsidian 插件设计

## 插件定位

obs-wiki Obsidian 插件是：

- Agent Activity 观察窗。
- Memory Review Queue。
- Source Analysis 入口。
- Permission Center。
- Audit UI。
- Vault Bridge。

它不是：

- 普通 AI 聊天插件。
- Codex 插件。
- 任意文件读写工具。
- 自动长期记忆提交器。

## 插件 ID 和显示名

```text
Plugin ID: obs-wiki
Display Name: obs-wiki
```

## 核心界面

### Agent Activity View

显示：

- 当前 Agent task。
- 最近 context packs。
- 最近 memory reads。
- 最近 memory writes。
- 最近 source captures。
- 最近 proposals。
- 最近 audit events。
- 最近 lint reports。

### Review Queue View

显示：

- Pending memory proposals。
- Pending source analysis。
- Pending claim reviews。
- Pending project updates。
- Pending preference approvals。
- Pending knowledge gaps。

操作：

- Approve。
- Edit。
- Reject。
- Defer。
- Mark stale。
- Open evidence。
- Open target note。

### Source Analysis View

用户手动让 Agent 分析资料的入口：

- Analyze URL with Agent。
- Analyze Local File with Agent。
- Analyze Current Note。
- Analyze Current Selection。
- Add Source to Agent Inbox。

表单字段：

- source。
- analysis purpose。
- related project。
- analysis mode。
- write policy。

### Memory Inspector View

打开任意 note 时显示：

- note type。
- source refs。
- claim blocks。
- evidence blocks。
- related projects。
- related memories。
- lint issues。
- used by agent tasks。
- stale status。

### Permission Center

设置：

- Agent read scope。
- Agent write scope。
- Safe write folders。
- Protected folders。
- 是否允许 source capture。
- 是否允许自动写 context pack。
- 是否允许自动写 session note。
- 是否允许自动提交 proposal。
- Preference memory 是否必须显式确认。
- MCP mode。
- Audit level。

### Runtime Status View

显示：

- Runtime mode。
- MCP status。
- Indexed note count。
- Last context pack。
- Last lint report。
- Last source analysis。
- Last benchmark。

## Command Palette 命令

```text
obs-wiki: Open Agent Activity
obs-wiki: Open Review Queue
obs-wiki: Open Source Analysis
obs-wiki: Open Memory Inspector
obs-wiki: Open Permission Center
obs-wiki: Initialize Memory Structure
obs-wiki: Analyze URL with Agent
obs-wiki: Analyze Local File with Agent
obs-wiki: Analyze Current Note
obs-wiki: Analyze Current Selection
obs-wiki: Build Context Pack
obs-wiki: Run Memory Lint
obs-wiki: Rebuild Index
obs-wiki: Show Runtime Status
obs-wiki: Copy MCP Config
```

## Ribbon 按钮

建议：

- Agent Activity。
- Review Queue。
- Analyze Source。
- Runtime Status。

## 写入策略

### 可自动写入

- `06_outputs/context_packs/`
- `06_outputs/reports/`
- `02_timeline/sessions/`
- `02_timeline/agent_tasks/`
- `03_sources/`
- `01_inbox/agent_requests/`
- `01_inbox/review_queue/`
- audit events。

### 需要用户确认

- `04_memory/`
- `05_projects/`
- `00_control/permissions.md`
- protected memory。

### 禁止默认写入

- 删除文件。
- 批量迁移路径。
- 写入 `.obsidian/`。
- 读取或写入 vault 外路径。
- 保存 secrets / API key / tokens。
- 静默提交用户偏好。

## 第一代插件 MVP

第一代只需要完成：

- 插件可加载。
- 初始化 vault memory structure。
- Agent Activity View。
- Review Queue View。
- Source Analysis Request 创建。
- Audit Log 展示。
- Permission Settings。
- Runtime Status。
- 基础 Memory Inspector。

不需要第一版内置完整 AI 聊天。
