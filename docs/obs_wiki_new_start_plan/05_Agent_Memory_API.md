# obs-wiki Agent Memory API

## 设计原则

Agent 不应该通过读说明书和跑脚本来使用知识库。Agent 应该调用明确的记忆 API。

MCP tools 前缀：

```text
obs_wiki.*
```

## Task Lifecycle Tools

### `obs_wiki.start_task`

用途：Agent 开始任务时调用。

输入：

- `goal`: string
- `client`: optional string
- `project_hint`: optional string

输出：

- `task_id`
- `related_projects`
- `recent_sessions`
- `user_preferences`
- `open_gaps`
- `recommended_next_tool`

副作用：

- 可写入 agent-task note。
- 可写入 audit event。

### `obs_wiki.finish_task`

用途：Agent 结束任务。

输入：

- `task_id`
- `summary`
- `outcomes`
- `next_actions`

输出：

- session note path
- proposals
- audit event

## Recall / Retrieval Tools

### `obs_wiki.recall`

用途：低摩擦记忆召回。应成为 Agent 任务开始后的默认工具。

输入：

- `task_id`
- `query`
- `max_items`

输出：

- project context
- user preferences
- recent decisions
- relevant notes
- source evidence
- warnings
- whether deep context pack is recommended

### `obs_wiki.build_context_pack`

用途：构建深度上下文包。

输入：

- `task_id`
- `query`
- `candidate_limit`
- `write`: boolean

输出：

- context pack summary
- candidate notes
- source candidates
- claims
- gaps
- stale warnings
- writeback targets

### `obs_wiki.search_memory`

用途：搜索长期记忆和资料。

输入：

- `query`
- `scope`
- `limit`

输出：

- matched notes
- matched blocks
- match reason
- evidence refs

### `obs_wiki.read_note`

用途：读取指定 note 或片段。

输入：

- `path`
- `excerpt_only`: boolean
- `heading`: optional
- `block_id`: optional

安全：

- 不允许 vault 外路径。
- 不允许读取 `.obsidian/`。
- 长 note 返回摘要和 excerpt。

## Source Tools

### `obs_wiki.capture_source`

用途：Agent 在任务中捕获 URL / 文件 / 当前 note / snippet。

输入：

- `source`
- `source_kind`
- `capture_reason`
- `task_id`
- `related_project`
- `mode`: external_reference | extracted_snapshot | local_copy

输出：

- source note path
- capture status
- warnings

### `obs_wiki.analyze_source`

用途：分析 source，提取 evidence / claims / gaps。

输入：

- `source_id` or `source_path`
- `analysis_mode`

输出：

- summary
- evidence blocks
- claims
- related memories
- conflicts
- proposals

## Proposal / Writeback Tools

### `obs_wiki.propose_memory`

用途：创建长期记忆提案。

输入：

- `proposal_kind`
- `content`
- `evidence`
- `target_note`
- `risk_level`
- `task_id`

输出：

- proposal path
- approval status

### `obs_wiki.distill_session`

用途：将任务结果沉淀为 session 和 proposals。

输入：

- `task_id`
- `summary`
- `decisions`
- `next_actions`
- `possible_preferences`

输出：

- session path
- proposals
- audit event

## Governance Tools

### `obs_wiki.list_review_queue`

输出：

- pending source analysis
- pending proposals
- pending claims
- pending preferences
- pending gaps

### `obs_wiki.lint`

输出：

- errors
- warnings
- stale memories
- broken evidence
- fix plan

### `obs_wiki.audit_recent`

输出：

- recent reads
- recent writes
- recent proposals
- recent source captures
- recent task starts/finishes

## Resources

```text
obs-wiki://system
obs-wiki://active-context
obs-wiki://review-queue
obs-wiki://agent-activity
obs-wiki://audit/recent
obs-wiki://context-pack/latest
obs-wiki://source/{source_id}
obs-wiki://note/{path}
obs-wiki://task/{task_id}
```

## Prompts

```text
obs-wiki Start Task
obs-wiki Recall Memory
obs-wiki Analyze Source
obs-wiki Propose Memory
obs-wiki Distill Session
obs-wiki Review Queue
```
