# obs-wiki 知识库与长期记忆模型

## Vault 结构

初始化后建议创建：

```text
00_control/
  system.md
  memory_policy.md
  permissions.md
  audit_log.md
  dashboards/

01_inbox/
  agent_requests/
  review_queue/

02_timeline/
  sessions/
  agent_tasks/

03_sources/
  web/
  files/
  transcripts/
  attachments/

04_memory/
  concepts/
  claims/
  procedures/
  preferences/
  reflections/

05_projects/

06_outputs/
  context_packs/
  reports/
  source_analysis/
  summaries/

07_archive/
```

## 关键数据类型

### Agent Task

记录 Agent 执行任务的生命周期。

```yaml
type: agent-task
task_id: task_...
agent: codex | claude | cursor | local
objective: string
status: active | completed | failed | cancelled
started_at: datetime
finished_at: datetime
context_pack: path
related_project: path
memory_reads: []
memory_writes: []
source_captures: []
proposals: []
```

### Context Pack

Agent 开始任务或深度查询时生成。

```yaml
type: context-pack
context_pack_id: ctx_...
task_id: task_...
query: string
generated_by: agent
status: active | archived
created: datetime
read_budget: number
```

内容应包括：

- User goal。
- Relevant projects。
- Recent sessions。
- User preferences。
- Related concepts。
- Source candidates。
- Evidence candidates。
- Open gaps。
- Stale warnings。
- Suggested writeback targets。

### Source Note

Agent 或用户投喂资料时创建。

```yaml
type: source
source_id: src_...
source_kind: url | local_file | current_note | selection | transcript
captured_by: agent | user
capture_reason: string
related_task: task_id
related_project: path
source_url: optional
source_path: optional
attachment_path: optional
content_hash: sha256:...
capture_status: referenced | captured | blocked | failed
analysis_status: pending | analyzed | skipped
claim_count: number
evidence_count: number
synthesis_targets: []
```

### Evidence Block

默认存在于 source note 内，以 block reference 定位。

```text
> [!evidence] Evidence 001
> 原文摘录或结构化片段
^evidence-001
```

### Claim

默认存在于 source / memory note 内。高价值或冲突 claim 才升级为独立 note。

```text
> [!claim] Claim text
> source:: [[source-note#^evidence-001]]
> status:: proposed
> confidence:: medium
^claim-001
```

### Memory Proposal

Agent 不能默认直接提交长期记忆，而是创建 proposal。

```yaml
type: memory-proposal
proposal_id: prop_...
proposal_kind: claim | project_update | procedure | preference | gap | concept_update
proposed_by: agent
task_id: task_...
target_note: path
evidence: []
risk_level: low | medium | high
approval_status: pending | approved | rejected | deferred
created: datetime
```

### Committed Memory

用户批准或策略允许后进入长期记忆。

```yaml
type: memory
memory_kind: concept | claim | procedure | preference | project | reflection
status: active | stale | deprecated | archived
confidence: low | medium | high
source_count: number
review_after: date
approved_by: user | policy
source_proposal: path
```

### Audit Event

记录 Agent 关键行为。

```yaml
type: audit-event
audit_id: audit_...
actor: agent | user | runtime
action: memory.read | memory.write | memory.propose | source.capture | task.start | task.finish
target: path or id
reason: string
task_id: task_...
timestamp: datetime
```

## 从 obs-wiki 借鉴的知识运作逻辑

### Context Pack

旧 obs-wiki 的 context pack 包含 candidate notes、source candidates、knowledge gaps、writeback target。新插件保留这个思想，但作为 Agent 任务启动的默认上下文。

### Evidence / Claim

旧 obs-wiki 的 source register 已包含 source_id、source_hash、claim_count、synthesis_targets、evidence scaffold。新插件将其升级为 source note + evidence blocks + memory proposals。

### Lint

旧 obs-wiki 的 lint 检查 sources、claim_count、broken links、stale notes。新插件将其升级为 Memory Health，直接驱动 Review Queue 和 Agent fix plan。

## 长期记忆权限分级

```text
L0 Scratch
临时上下文，不进入长期记忆。

L1 Session
会话和任务记录，可自动生成。

L2 Proposal
Agent 提议保存的记忆，进入 Review Queue。

L3 Committed
用户批准或低风险策略允许后进入长期记忆。

L4 Protected
用户偏好、身份、隐私、长期原则，必须显式批准，可撤销。
```
