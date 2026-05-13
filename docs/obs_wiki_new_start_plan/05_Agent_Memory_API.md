# obs-wiki Agent Memory API

## 设计原则

Agent 不应该通过读说明书和跑脚本来使用知识库。Agent 应该调用明确的 MCP 记忆 API。

MCP tools 前缀：

```text
obs_wiki.*
```

核心边界：

- Agent 是唯一操作入口。
- URL / 文件 / 资料分析 / context pack / lint / distill / proposal 生成都由 Agent 通过 MCP 发起。
- Obsidian 插件只提供 Review Queue、审核、审计、状态和权限界面。
- 长期记忆、用户偏好、重要项目决策、高置信 claim 默认必须先进入 proposal。
- 批准后的写回由 Runtime 执行。

## 当前工具集

本文件与 `apps/mcp-server/src/tools.ts`、`docs/MCP_Tool_Permission_Matrix.md` 保持一致。MCP server 是 read-only default + controlled write：只读工具不产生 vault 写入；低风险写入只写白名单工作记录；受保护记忆只能通过 Review Queue 批准后由 Runtime apply。

| Tool | 权限等级 | 当前状态 | 主要用途 |
| --- | --- | --- | --- |
| `obs_wiki.status` | read-only | implemented | 扫描 vault 并返回 notes/errors/type counts。 |
| `obs_wiki.start_task` | read-only | implemented | 生成任务 id、上下文摘要、相关项目、近期 session、用户偏好摘要。 |
| `obs_wiki.finish_task` | low-risk write | implemented | 结束任务并写入 session note 与 audit event。 |
| `obs_wiki.recall` | read-only | implemented | 按 query 返回相关 note 摘要。 |
| `obs_wiki.build_context_pack` | read-only / low-risk write | implemented | 生成 context pack，可选写入 `06_outputs/context_packs/`。 |
| `obs_wiki.read_note` | read-only | implemented | 读取 vault 内 markdown/text note。 |
| `obs_wiki.lint` | read-only | implemented | 返回 broken wikilink、claim missing source 等 lint preview。 |
| `obs_wiki.list_source_requests` | read-only | implemented | 读取 `01_inbox/agent_requests/` 下的 source-analysis request。 |
| `obs_wiki.capture_source` | low-risk write | implemented | 写入 `03_sources/` source capture note 与 audit event。 |
| `obs_wiki.analyze_source_request` | low-risk write | implemented | 处理一个 agent-request，写 source note、analysis report、proposals、request status、audit。 |
| `obs_wiki.propose_memory` | low-risk write | implemented | 写入 `01_inbox/review_queue/` memory proposal。 |
| `obs_wiki.distill_session` | low-risk write | implemented | 将任务总结沉淀为 session note，并为 decision/preference 创建 proposal。 |
| `obs_wiki.list_review_queue` | read-only | implemented | 读取 pending memory proposal。 |
| `obs_wiki.list_approved_writebacks` | read-only | implemented | 列出已批准且可 apply 的 writeback proposal。 |
| `obs_wiki.apply_approved_writeback` | review-gated apply | implemented | 将 approved proposal 的显式 writeback 内容追加到目标 note。 |
| `obs_wiki.audit_recent` | read-only | implemented | 读取 `00_control/audit_log.md` 中的最近审计记录。 |

## Task Lifecycle Tools

### `obs_wiki.start_task`

用途：Agent 开始任务时调用，建立任务上下文。当前实现不写 vault。

输入：

- `goal`: string, required
- `client`: optional string
- `project_hint`: optional string

输出：

- `task_id`
- `context_pack_summary`
- `related_projects`
- `recent_sessions`
- `user_preferences`
- `recommended_next_tool`

### `obs_wiki.finish_task`

用途：Agent 结束任务时调用，写入低风险 session note 和 audit event。

输入：

- `task_id`: string, required
- `summary`: string, required
- `outcomes`: optional string | string[]
- `next_actions`: optional string | string[]
- `client`: optional string
- `project_hint`: optional string
- `filename`: optional string

输出：

- session note path
- audit event path
- captured outcome / next action counts

安全：

- 只写 `02_timeline/sessions/`。
- 不直接写长期记忆。
- 内容疑似 secret 时拒绝写入。

## Recall / Retrieval Tools

### `obs_wiki.recall`

用途：低摩擦记忆召回。

输入：

- `query`: string, required
- `max_items`: optional integer

输出：

- matched note path / title / type
- score
- matched tokens

### `obs_wiki.build_context_pack`

用途：构建深度 context pack。默认只返回数据；`write=true` 时写入 context pack note。

输入：

- `query`: string, required
- `task_id`: optional string
- `candidate_limit`: optional integer
- `stale_after_days`: optional integer
- `write`: optional boolean
- `filename`: optional string
- `title`: optional string

输出：

- context pack data
- relevant notes
- source candidates
- evidence candidates
- gaps
- stale warnings
- optional written note path / audit path

安全：

- `write=false` 时 read-only。
- `write=true` 时只写 `06_outputs/context_packs/` 并写 audit event。

### `obs_wiki.read_note`

用途：读取指定 note。

输入：

- `path`: string, required

输出：

- path
- title
- mime type
- content
- excerpt

安全：

- 不允许 vault 外路径。
- 不允许读取 `.obsidian/`。
- 只读取 markdown/text-like 文件。

### `obs_wiki.lint`

用途：返回知识库健康检查预览，不自动修复。

输入：

- `max_items`: optional integer

输出：

- issue count
- issues
- fix plan summary

安全：

- read-only。
- 不写 repair patch，不自动改 note。

## Source Tools

### `obs_wiki.list_source_requests`

用途：读取 Agent 已创建的 source-analysis request。

输入：

- `status`: optional string, default `pending`
- `source_kind`: optional string
- `max_items`: optional integer

输出：

- request path
- source / source kind / purpose / analysis mode / status

### `obs_wiki.capture_source`

用途：Agent 捕获 URL / 文件 / 当前 note / snippet 的 source metadata 或快照。

输入：

- `source`: string, required
- `mode`: `external_reference | extracted_snapshot | local_copy`, required
- `source_kind`: optional string
- `capture_reason`: optional string
- `task_id`: optional string
- `related_project`: optional string
- `filename`: optional string
- `title`: optional string
- `content` / `text`: required when mode is `extracted_snapshot` or `local_copy`

输出：

- source note path
- audit path
- warnings

### `obs_wiki.analyze_source_request`

用途：处理一个 pending source-analysis request。

输入：

- `request_path` or `path`: string, required
- `update_request_status`: optional boolean, default true
- `force_reprocess`: optional boolean

输出：

- source note path
- source-analysis report path
- generated proposal paths
- warnings

安全：

- 不做任意网络抓取；URL 作为 external reference 处理。
- 本地文件读取必须是 vault 内 markdown/text-like 文件。
- 写入范围限制在 `03_sources/`、`06_outputs/source_analysis/`、`01_inbox/review_queue/`、`01_inbox/agent_requests/`、`00_control/audit_log.md`。

## Proposal / Writeback Tools

### `obs_wiki.propose_memory`

用途：创建长期记忆提案。

输入：

- `proposal_kind`: string, required
- `content`: string, required
- `evidence`: optional string
- `target_note`: optional string
- `risk_level`: optional string
- `task_id`: optional string
- `filename`: optional string
- `title`: optional string

输出：

- proposal path
- audit path

安全：

- 默认写入 `01_inbox/review_queue/`。
- 不直接提交 `04_memory/` 或 `05_projects/`。
- preference / identity / important decision / high-confidence claim / bulk migration 必须等待用户审核。

### `obs_wiki.distill_session`

用途：将任务结果沉淀为 session note，并把重要 decision / preference 变成 proposal。

输入：

- `task_id`: string, required
- `summary`: string, required
- `decisions`: optional string | string[]
- `next_actions`: optional string | string[]
- `possible_preferences`: optional string | string[]
- `outcomes`: optional string | string[]
- `project_hint`: optional string
- `filename`: optional string

输出：

- session note path
- generated proposal paths
- audit path

安全：

- session note 写入 `02_timeline/sessions/`。
- decision / preference 只写 proposal，不直接写长期记忆。

### `obs_wiki.list_review_queue`

用途：读取 pending proposal。

输入：

- `max_items`: optional integer

输出：

- pending proposal path / title / status / proposal kind / risk level

### `obs_wiki.list_approved_writebacks`

用途：查询已批准但尚未应用的 writeback。

输入：

- `scope`: optional string
- `max_items` / `limit`: optional integer

输出：

- approved proposal list
- target note
- ready-to-apply blocker
- risk level

### `obs_wiki.apply_approved_writeback`

用途：Runtime 执行用户已批准的写回。

输入：

- `proposal_id` or `proposal_path` / `path`: required
- `dry_run`: optional boolean

输出：

- writeback result
- touched notes
- audit event

安全：

- 只能处理 `approval_status=approved` 或 `status=approved` 的 proposal。
- 必须存在显式 `## Writeback` / `## Writeback content`。
- 不允许插件直接拼接长期记忆内容。
- 执行后必须更新 proposal 状态并写 audit event。

## Audit Tools

### `obs_wiki.audit_recent`

用途：读取最近审计记录。

输入：

- `max_items`: optional integer

输出：

- audit log path
- parsed sections

## Resources

当前实现：

```text
obs-wiki://system
obs-wiki://active-context
obs-wiki://review-queue
obs-wiki://agent-activity
obs-wiki://audit/recent
```

后续可扩展：

```text
obs-wiki://context-pack/latest
obs-wiki://source/{source_id}
obs-wiki://note/{path}
obs-wiki://task/{task_id}
```

## Prompts

当前实现：

```text
obs-wiki Start Task
obs-wiki Recall Memory
```

后续可扩展：

```text
obs-wiki Analyze Source
obs-wiki Propose Memory
obs-wiki Distill Session
obs-wiki Review Queue
```
