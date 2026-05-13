# obs-wiki Obsidian 插件设计

## 插件定位

obs-wiki Obsidian 插件是：

- Agent Activity 观察窗。
- Memory Review Queue。
- Source / Context / Runtime 状态查看器。
- Permission Policy Viewer。
- Audit UI。
- 人类审核批准入口。

它不是：

- 普通 AI 聊天插件。
- Codex 插件。
- 任意文件读写工具。
- 自动长期记忆提交器。
- 资料提交入口。
- source analysis / lint / distill / context pack 的执行入口。

## 插件 ID 和显示名

```text
Plugin ID: obs-wiki
Display Name: 知识库 / Obswiki
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
- Reject。
- Defer。
- Request Revision。
- Apply Approved Writeback。
- Open evidence。
- Open target note。

说明：

- Review Queue 只修改 proposal 审核状态、review comment、revision request 和 audit event。
- Apply Approved Writeback 只触发 Runtime 执行已批准写回，不由插件直接拼接长期记忆。

### Source Status View

显示 Agent 已生成或正在处理的 source 状态：

- source note。
- source kind。
- capture status。
- analysis status。
- related task。
- related project。
- linked proposals。
- audit trail。

不提供：

- Analyze URL。
- Analyze Local File。
- Analyze Current Note / Selection。
- Add Source to Inbox。
- Capture Source。

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

### Audit Log View

显示：

- Agent read / write events。
- Runtime approved writeback events。
- Plugin review events。
- Failed or blocked operations。

### Runtime Status View

显示：

- Runtime mode。
- MCP status。
- Indexed note count。
- Last context pack。
- Last lint report。
- Last source analysis。
- Last benchmark。

### Permission Policy View

显示：

- Agent read scope。
- Agent write scope。
- Safe write folders。
- Protected folders。
- source capture policy。
- context pack / session note write policy。
- proposal auto-create policy。
- preference memory explicit-confirm policy。
- MCP mode。
- Audit level。

## Command Palette 命令

```text
obs-wiki: Open Agent Activity
obs-wiki: Open Review Queue
obs-wiki: Open Memory Inspector
obs-wiki: Open Audit Log
obs-wiki: Open Runtime Status
obs-wiki: Open Permission Policy
obs-wiki: Refresh Views
obs-wiki: Approve Selected Proposal
obs-wiki: Reject Selected Proposal
obs-wiki: Defer Selected Proposal
obs-wiki: Request Revision for Selected Proposal
obs-wiki: Apply Approved Writeback
```

明确取消的命令：

```text
obs-wiki: Analyze URL
obs-wiki: Analyze Local File
obs-wiki: Analyze Current Note
obs-wiki: Analyze Selection
obs-wiki: Capture Source
obs-wiki: Add Source to Inbox
obs-wiki: Build Context Pack
obs-wiki: Run Ingest
obs-wiki: Run Lint
obs-wiki: Distill Session
obs-wiki: Create Agent Request
```

## Ribbon 按钮

建议：

- Agent Activity。
- Review Queue。
- Runtime Status。

## 写入策略

### Agent / Runtime 可自动写入

- `06_outputs/context_packs/`
- `06_outputs/reports/`
- `02_timeline/sessions/`
- `02_timeline/agent_tasks/`
- `03_sources/`
- `01_inbox/review_queue/`
- audit events。

### Obsidian 插件可写入

- proposal `approval_status`。
- `review_comment`。
- `reviewed_by`。
- `reviewed_at`。
- `revision_request`。
- approval audit event。
- UI settings。

### 需要用户确认并由 Runtime 写回

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
- Obsidian 插件直接生成 source note / context pack / source analysis report / memory proposal。

## 第一代插件 MVP

第一代只需要完成：

- 插件可加载。
- Agent Activity View。
- Review Queue View。
- Audit Log 展示。
- Memory Inspector。
- Runtime Status。
- Permission Policy。
- Source Status 只读展示。

不需要第一版内置完整 AI 聊天。
不需要第一版提供资料提交或维护动作入口。
