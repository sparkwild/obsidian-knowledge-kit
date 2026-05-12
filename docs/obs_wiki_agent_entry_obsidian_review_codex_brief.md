# obs-wiki Codex 调整任务文档：Agent 发起，Obsidian 审核

版本：2026-05-12
适用仓库：`sparkwild/obs-wiki`
目标执行者：本地 Codex App
文档用途：作为 Codex 可直接读取和执行的产品/架构调整任务说明。
核心方向：推翻 Codex plugin-first 路线，转向 Obsidian 原生插件 + Agent-first 外置记忆库。

---

## 0. 给 Codex 的一句话任务

请基于当前 `obs-wiki` 仓库，调整新方案文档与后续实现计划，使产品边界明确为：

> **所有知识库维护、资料抓取、分析、整理、写回提案都由 Agent 通过 MCP / Agent Memory API 发起；Obsidian 插件不提供资料提交或维护动作入口，只提供 Agent Activity、Review Queue、Audit、Memory Inspector、Runtime Status 与人类审核批准入口。**

也就是：

```text
Agent 发起操作
Obsidian 承载记忆
Obsidian 插件负责审核、批准、拒绝、审计、可视化
Runtime 执行已批准写回
```

---

## 1. 背景与当前修正

此前讨论过一个 Obsidian 插件新方向：`obs-wiki` 不再作为 Codex 插件优先产品，而是重建为 **Agent-first Obsidian 外置记忆库 + 长期知识库**。

当前需要进一步修正的是：

1. **不要在 Agent 和 Obsidian 插件两边同时开放操作入口。**
2. **URL、本地文件、资料抓取、source analysis、context pack、lint、distill 等动作全部由 Agent 发起。**
3. **Obsidian 插件不再提供 Analyze URL / Analyze File / Capture Source / Build Context Pack / Run Lint / Run Distill 这类操作按钮。**
4. **审核批准类操作可以放在 Obsidian 插件中。**
5. **Obsidian 插件是人类治理入口，不是资料入口。**

最终原则：

```text
Single Agent Operation Entry
Human Governance in Obsidian
No Dual Source Submission
No Silent Long-term Memory Commit
```

---

## 2. 新产品边界

### 2.1 Agent 是唯一操作入口

以下动作只能由 Agent 通过 MCP / Agent Memory API 发起：

```text
start_task
recall_memory
build_context_pack
search_memory
read_note
capture_source
analyze_source
extract_evidence
extract_claims
compare_with_memory
propose_memory
distill_session
run_lint
create_fix_plan
finish_task
```

用户如果想让系统处理 URL / 文件，应该在 Agent 对话中说：

```text
把这篇文章加入 obs-wiki，分析它是否应该进入长期知识库：<URL>
```

或者：

```text
分析这个本地文档，提取和当前项目相关的 claims：<file path>
```

然后 Agent 调用 `obs_wiki.capture_source`、`obs_wiki.analyze_source`、`obs_wiki.propose_memory` 等工具。

### 2.2 Obsidian 插件是人类治理入口

Obsidian 插件保留这些入口：

```text
Open Agent Activity
Open Review Queue
Open Memory Inspector
Open Audit Log
Open Runtime Status
Open Permission Policy Viewer
Refresh Views
Approve Selected Proposal
Reject Selected Proposal
Defer Selected Proposal
Request Revision for Selected Proposal
Apply Approved Writeback
```

Obsidian 插件取消这些入口：

```text
Analyze URL
Analyze Local File
Analyze Current Note
Analyze Selection
Add Source to Inbox
Capture Source
Build Context Pack
Run Ingest
Run Lint
Run Distill
Create Source Analysis Request
```

### 2.3 长期记忆必须经过审核

Agent 可以自动写入低风险工作产物：

```text
source note
source analysis report
context pack
session note
audit event
memory proposal
knowledge gap proposal
lint report
fix plan
```

Agent 默认不能直接提交：

```text
committed memory
user preference
identity memory
important project decision
high-confidence claim
bulk migration
delete / archive
stable knowledge overwrite
```

这些必须进入 Review Queue，由用户在 Obsidian 插件中批准或拒绝。

---

## 3. 修正后的总体架构

```text
User
  ↓
Agent Client
Codex / Claude / Cursor / ChatGPT / local agent
  ↓ MCP
obs-wiki MCP Server / Agent Memory API
  ↓
obs-wiki Memory Runtime
  ↓
Obsidian Vault
Markdown / Properties / Wikilinks / Blocks / Bases
  ↓
obs-wiki Obsidian Plugin
Agent Activity / Review Queue / Audit / Inspector / Status
  ↓
Human approval / rejection / revision request
  ↓
Runtime applies approved writeback
```

职责分配：

| 模块 | 职责 |
|---|---|
| Agent | 接收用户任务，抓取资料，分析资料，生成提案，执行任务 |
| MCP / Agent Memory API | Agent 调用 obs-wiki 的工具接口 |
| Memory Runtime | 检索、索引、context pack、source analysis、proposal、lint、approved writeback |
| Obsidian Vault | 唯一知识和长期记忆载体 |
| Obsidian Plugin | 审核、批准、拒绝、审计、状态展示、权限查看 |

---

## 4. Agent 工作流

### 4.1 用户在 Agent 中提交资料

用户：

```text
把这篇文章加入 obs-wiki，分析它是否能支持我的 MCP 权限模型设计：
https://example.com/article
```

Agent 应执行：

```text
obs_wiki.start_task
obs_wiki.capture_source
obs_wiki.analyze_source
obs_wiki.extract_evidence
obs_wiki.extract_claims
obs_wiki.search_memory
obs_wiki.compare_with_memory
obs_wiki.propose_memory
obs_wiki.distill_session
obs_wiki.audit_event
```

产物写入 Obsidian vault：

```text
03_sources/...
06_outputs/source_analysis/...
01_inbox/review_queue/...
02_timeline/sessions/...
00_control/audit_log.md
```

### 4.2 用户在 Obsidian 中审核

Obsidian 插件展示 Review Queue。

每条 proposal 显示：

```text
Proposal ID
Proposal type
Risk level
Target note
Proposed change
Evidence links
Source links
Agent reason
Affected notes
Diff / Patch preview
Audit trail
```

用户可执行：

```text
Approve
Reject
Defer
Request revision
Apply approved writeback
```

### 4.3 批准后的写回

如果 proposal 包含明确 patch，Obsidian 插件可以触发 Runtime：

```text
obs_wiki.apply_approved_writeback(proposal_id)
```

Runtime 执行：

```text
update target note
update proposal status
write audit event
refresh index
```

如果 proposal 只是方向性建议，则状态变为：

```text
approved_for_agent
```

Agent 下次调用：

```text
obs_wiki.list_approved_writebacks
```

再继续处理。

---

## 5. Obsidian 插件设计修正

### 5.1 保留的 Views

```text
AgentActivityView
ReviewQueueView
MemoryInspectorView
AuditLogView
RuntimeStatusView
PermissionPolicyView
SourceStatusView
ContextPackViewer
```

### 5.2 保留的 Commands

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

### 5.3 明确取消的 Commands

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

### 5.4 插件允许写入的内容

插件可以写入治理状态：

```text
proposal approval_status
review_comment
reviewed_by
reviewed_at
revision_request
approval audit event
UI settings
```

插件不直接写入：

```text
source note
context pack
source analysis report
claim extraction
memory proposal
committed memory
project update
session note
```

这些由 Agent / Runtime 创建。

---

## 6. 数据模型修正

### 6.1 Agent Task

```yaml
type: agent-task
task_id: task_...
agent: codex | claude | cursor | local
status: running | finished | failed
goal: string
started_at: datetime
finished_at: datetime
context_pack: path
memory_reads: []
memory_writes: []
```

### 6.2 Source Note

```yaml
type: source
source_id: src_...
source_kind: web | file | transcript | reference
captured_by: agent
capture_reason: string
related_task: task_id
related_project: string
source_hash: string
capture_status: captured | blocked | failed
analysis_status: pending | done | needs_review
claim_count: number
synthesis_targets: []
```

### 6.3 Memory Proposal

```yaml
type: memory-proposal
proposal_id: proposal_...
proposal_kind: claim | project_update | procedure | preference | gap | source_synthesis
proposed_by: agent
target_note: path
risk_level: low | medium | high
evidence: []
approval_status: pending_review | approved | rejected | deferred | revision_requested | applied
reviewed_by: user | none
reviewed_at: datetime
```

### 6.4 Audit Event

```yaml
type: audit-event
event_id: audit_...
actor: agent | user | runtime | plugin
action: memory.read | source.capture | proposal.create | proposal.approve | writeback.apply
target: path | proposal_id | source_id
reason: string
task_id: string
timestamp: datetime
```

---

## 7. MCP / Agent Memory API 修正

Agent-facing tools：

```text
obs_wiki.status
obs_wiki.start_task
obs_wiki.recall
obs_wiki.build_context_pack
obs_wiki.search_memory
obs_wiki.read_note
obs_wiki.read_block
obs_wiki.capture_source
obs_wiki.analyze_source
obs_wiki.extract_evidence
obs_wiki.extract_claims
obs_wiki.compare_with_memory
obs_wiki.propose_memory
obs_wiki.list_review_queue
obs_wiki.list_approved_writebacks
obs_wiki.apply_approved_writeback
obs_wiki.distill_session
obs_wiki.audit_recent
obs_wiki.finish_task
```

Human governance tools / plugin actions：

```text
approve_proposal
reject_proposal
defer_proposal
request_revision
apply_approved_writeback
```

注意：这些治理动作可以由 Obsidian 插件触发，但资料提交和分析动作不能由 Obsidian 插件触发。

---

## 8. 分批执行计划

### Phase 0：文档与产品边界重置

目标：让仓库文档明确新方向。

任务：

1. 新增或更新产品愿景文档，写入：Agent 发起，Obsidian 审核。
2. 更新架构文档，删除 Obsidian 资料提交入口。
3. 更新 MCP / Agent Memory API 文档。
4. 更新 Obsidian 插件设计文档。
5. 明确 `obs-wiki` 为插件名，不使用 VaultThread。

验收：

```text
所有文档统一使用 obs-wiki。
明确 Single Agent Operation Entry。
明确 Human Governance in Obsidian。
不再建议 Obsidian 插件提供 Analyze URL / File。
```

---

### Phase 1：Obsidian 插件 Scaffold

目标：建立 Obsidian 原生插件骨架。

任务：

```text
apps/obsidian-plugin/manifest.json
apps/obsidian-plugin/package.json
apps/obsidian-plugin/src/main.ts
apps/obsidian-plugin/src/settings/
apps/obsidian-plugin/src/views/
apps/obsidian-plugin/styles.css
```

插件命令只包含：

```text
Open Agent Activity
Open Review Queue
Open Memory Inspector
Open Audit Log
Open Runtime Status
Open Permission Policy
Refresh Views
```

验收：

```text
插件可加载。
插件不包含 Analyze URL / File / Capture Source / Build Context Pack / Run Lint / Distill 命令。
```

---

### Phase 2：Review Queue 与审核操作

目标：Obsidian 插件成为人类治理入口。

任务：

1. 实现 Review Queue View。
2. 读取 `01_inbox/review_queue/` 或等价 proposal 文件。
3. 展示 proposal 内容、证据、目标 note、风险、diff。
4. 实现 approve / reject / defer / request revision。
5. 审核动作只修改 proposal 状态和 audit event。

验收：

```text
用户可以在 Obsidian 中审核 Agent 生成的 proposal。
审核不会直接抓取资料或生成新提案。
所有审核动作有 audit event。
```

---

### Phase 3：Agent Activity / Audit / Inspector

目标：用户能观察 Agent 如何使用知识库。

任务：

1. Agent Activity View 展示最近任务、context packs、source captures、proposals。
2. Audit Log View 展示 agent/user/runtime/plugin 事件。
3. Memory Inspector View 展示当前 note 的 sources、claims、evidence、agent usage。

验收：

```text
插件能展示 Agent 读写活动。
插件能显示当前 note 的记忆关系。
不提供资料提交入口。
```

---

### Phase 4：Runtime / MCP API 实现或适配

目标：让 Agent 真正成为操作入口。

任务：

1. 实现或适配 read-only MCP MVP。
2. 实现 source capture / analysis / proposal tools。
3. 实现 `apply_approved_writeback`。
4. 确保所有 Agent 写入都有 audit event。
5. 确保长期记忆写入需要 proposal approval。

验收：

```text
Agent 可以通过 MCP 提交 URL / 文件并生成 proposal。
Obsidian 插件能看到 proposal。
用户在 Obsidian approve 后，Runtime 可执行 approved writeback。
```

---

### Phase 5：权限与安全

目标：防止 Agent 越权。

任务：

1. 实现 write allowlist。
2. 实现 vault path safety。
3. 禁止 vault 外路径，除非用户在 Agent 中明确提供。
4. 禁止任意 shell。
5. 禁止 secrets 写入。
6. 高风险 proposal 必须审核。

验收：

```text
MCP 工具无法读取 vault 外路径。
MCP 工具无法执行任意 shell。
Agent 无法直接提交 preference / high-confidence claim / delete / bulk migration。
```

---

## 9. Codex 执行提示词

下面这段可以直接复制给本地 Codex：

```text
请基于当前 obs-wiki 仓库调整新方案方向。核心边界如下：

1. 插件名称统一使用 obs-wiki，不使用 VaultThread。
2. 产品方向是 Obsidian 原生插件 + Agent-first 外置记忆库。
3. Agent 是唯一操作入口：资料抓取、URL / 文件分析、context pack、lint、distill、memory proposal、source analysis 都只能由 Agent 通过 MCP / Agent Memory API 发起。
4. Obsidian 插件不提供 Analyze URL、Analyze Local File、Capture Source、Build Context Pack、Run Lint、Run Distill、Create Agent Request 等操作入口。
5. Obsidian 插件可以作为人类治理入口，提供 Review Queue、Approve、Reject、Defer、Request Revision、Apply Approved Writeback、Audit Log、Memory Inspector、Runtime Status。
6. Agent 可以自动生成 source note、context pack、analysis report、session note、memory proposal、audit event。
7. Agent 默认不能直接提交长期记忆、用户偏好、重要项目决策、高置信 claim、删除或批量迁移。必须先生成 proposal，由用户在 Obsidian Review Queue 中审核。
8. 批准后的写回由 Runtime 执行，不由 Obsidian 插件直接拼接长期记忆内容。
9. 先更新 docs 和方案，再做插件 scaffold。不要直接重写旧 runtime。
10. 完成后输出修改摘要、文件清单、验证步骤和后续建议。

请第一批只做文档和 Obsidian 插件 scaffold 计划，不实现完整 MCP Server。
```

---

## 10. Definition of Done

第一批完成标准：

```text
1. 文档中明确 Agent 发起，Obsidian 审核。
2. 文档中明确取消 Obsidian 资料提交入口。
3. 文档中明确保留 Obsidian 审核批准入口。
4. 插件设计中只包含观察、审核、审计、状态、权限视图。
5. MCP / Agent API 文档中包含 source capture、analyze source、propose memory、apply approved writeback。
6. 不再使用 VaultThread 命名。
7. 不要求兼容旧 Codex plugin-first 方案。
```

完整产品完成标准：

```text
1. 用户在 Agent 中提交 URL / 文件。
2. Agent 通过 obs-wiki MCP 处理资料。
3. 资料写入 Obsidian vault。
4. Agent 生成 proposal。
5. 用户在 Obsidian Review Queue 中审核。
6. Runtime 执行已批准写回。
7. Audit Log 记录全过程。
8. Obsidian vault 始终是唯一知识和记忆载体。
```
