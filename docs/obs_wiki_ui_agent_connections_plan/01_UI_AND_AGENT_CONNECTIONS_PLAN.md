# obs-wiki UI 与 Agent Connection Center 升级方案

版本：2026-05-13  
适用仓库：`sparkwild/obs-wiki`  
目标执行者：本地 Codex App

---

## 0. 当前状态判断

当前仓库已经完成方向重置：

- `obs-wiki` 是 Agent-first memory system。
- Obsidian vault 是 durable knowledge layer。
- Obsidian 插件是 human governance surface。
- Agent clients 是 URL / 文件提交、source analysis、context pack、lint、distill、memory proposal 的唯一操作入口。
- Obsidian 插件负责 review、audit、permission、status、approval。
- MCP 是 Agent 的主要接口。
- 旧 Codex plugin-first 代码属于 legacy reference。

当前已经存在：

```text
apps/obsidian-plugin/
apps/mcp-server/
packages/core/
docs/obs_wiki_new_start_plan/
```

Obsidian 插件当前已经有：

```text
Agent Activity
Source Status
Review Queue
Memory Inspector
Audit Log
Runtime Status
Permission Policy
```

MCP server 当前已经有：

```text
initialize
tools/list
tools/call
resources/list
prompts/list
obs_wiki.status
obs_wiki.start_task
obs_wiki.recall
obs_wiki.read_note
obs_wiki.list_review_queue
obs_wiki.list_source_requests
obs_wiki.audit_recent
controlled write / source / proposal 相关工具雏形
```

当前主要问题：

```text
1. UI 仍是 scaffold 级别，缺乏 Agent governance dashboard 的信息层级。
2. styles.css 太薄，缺少 card / badge / metric / timeline / empty-state / tabs 设计系统。
3. Agent Activity 页面没有突出 MCP / Runtime / Review / Agent 连接状态。
4. Review Queue 缺少筛选、风险标识、详情摘要和治理流程可见性。
5. 缺少 Agent Connection Center，用户不知道如何从 Codex / Claude / Cursor / Custom Agent 接入。
6. MCP server 需要记录连接事件和 tool-call 事件，否则 Obsidian 插件无法追踪“哪些 Agent 连接过”。
7. `main.ts` 过于集中，需要逐步拆分。
```

---

## 1. 产品目标

本轮升级的产品目标：

> 把 obs-wiki Obsidian 插件从“简单状态面板”升级为 “Agent 外置记忆治理台 + Agent 连接控制台”。

插件应帮助用户回答：

```text
Agent 是否连接了？
哪些 Agent / IDE 工具连接过？
如何配置 Codex / Claude / Cursor / Custom Agent？
Agent 最近读了什么、写了什么、调用了哪些工具？
哪些 memory proposals 等待审核？
哪些 source requests 等待处理或被阻塞？
当前 Runtime / MCP / Permission 是否健康？
```

---

## 2. 不变的最高边界

### 2.1 Single Agent Operation Entry

所有知识库维护动作都由 Agent 发起：

```text
URL / 文件提交
source capture
source analysis
context pack
lint
distill
memory proposal generation
source comparison
claim extraction
```

这些动作不得作为 Obsidian 插件按钮或命令入口出现。

### 2.2 Obsidian Human Governance Entry

Obsidian 插件可以提供：

```text
Agent Activity 查看
Review Queue 审核
Approve / Reject / Defer / Request Revision
Apply Approved Writeback
Audit Log 查看
Runtime Status 查看
Permission Policy 查看
Agent Connections 配置与追踪
```

### 2.3 No Dual Source Submission

不要在 Obsidian 插件中提供：

```text
Analyze URL
Analyze Local File
Analyze Current Note
Analyze Selection
Capture Source
Add Source to Inbox
```

用户要让 Agent 分析 URL / 文件，必须在 Agent 客户端中说，例如：

```text
把这篇文章加入 obs-wiki，并分析它与当前项目的关系：
https://example.com/article
```

---

## 3. UI 升级方案

## 3.1 设计系统

新增轻量 CSS 设计系统，不引入重型 UI 框架。

建议 CSS class：

```text
.obs-wiki-shell
.obs-wiki-header
.obs-wiki-header__title
.obs-wiki-header__meta
.obs-wiki-toolbar
.obs-wiki-status-bar
.obs-wiki-badge
.obs-wiki-badge--success
.obs-wiki-badge--warning
.obs-wiki-badge--danger
.obs-wiki-badge--muted
.obs-wiki-card
.obs-wiki-card-grid
.obs-wiki-metric
.obs-wiki-metric__value
.obs-wiki-metric__label
.obs-wiki-timeline
.obs-wiki-timeline-item
.obs-wiki-empty-state
.obs-wiki-filter-tabs
.obs-wiki-filter-tab
.obs-wiki-action-row
.obs-wiki-detail-panel
.obs-wiki-kv
.obs-wiki-code-block
.obs-wiki-copy-row
.obs-wiki-risk--low
.obs-wiki-risk--medium
.obs-wiki-risk--high
```

颜色必须使用 Obsidian CSS variables，例如：

```text
var(--background-primary)
var(--background-secondary)
var(--background-modifier-border)
var(--text-normal)
var(--text-muted)
var(--interactive-accent)
var(--text-accent)
var(--color-green)
var(--color-yellow)
var(--color-red)
```

---

## 3.2 Agent Activity View

### 目标

从简单卡片列表升级为 Agent Governance Dashboard。

### 新布局

```text
Header
- obs-wiki Agent Activity
- Last refresh
- Refresh / Open Review Queue / Open Agent Connections

Status Bar
- MCP: Connected / Waiting / Unknown
- Runtime: Healthy / Warning / Missing
- Vault: Initialized / Missing structure
- Mode: Read-only / Controlled Write / Review-gated

Metric Cards
- Active Task
- Pending Review
- Source Requests
- Recent Tool Calls

Activity Timeline
- task.started
- context.created
- source.captured
- source.analyzed
- proposal.created
- proposal.approved
- audit.write
```

### Empty State 文案

如果没有任务：

```text
No Agent activity yet.
Start from your Agent client and ask it to use obs-wiki memory.
Suggested first tool: obs_wiki.start_task.
```

如果缺少目录：

```text
Agent task folder is missing.
The runtime or initialization flow should create 02_timeline/agent_tasks.
```

---

## 3.3 Review Queue View

### 目标

成为插件的核心治理界面。

### 新布局

```text
Header
- Review Queue
- counts by status

Filter Tabs
- Pending
- Approved
- Rejected
- Revision Requested
- Applied
- All

Proposal Cards
- proposal kind
- risk level
- approval status
- target note
- evidence count
- task id
- proposed by
- created time
- snippet
```

### 允许按钮

```text
Approve
Reject
Defer
Request Revision
Apply Approved Writeback
```

### 禁止按钮

```text
Analyze URL
Analyze File
Capture Source
Run Lint
Build Context Pack
Distill
```

### Proposal Detail

点击卡片后显示：

```text
Proposed change
Target note
Evidence links
Source links
Risk explanation
Agent reason
Audit trail
```

---

## 3.4 Agent Connections View

### 目标

新增 Agent 连接控制台，解决用户“安装插件后不知道怎么连接 Agent”的问题。

### 视图名称

```text
obs-wiki Agent Connections
```

### 新增命令

```text
obs-wiki: Open Agent Connections
obs-wiki: Copy Codex MCP Config
obs-wiki: Copy Claude MCP Config
obs-wiki: Copy Cursor MCP Config
obs-wiki: Check MCP Runtime
```

这些是连接 / 配置 / 查看类命令，不属于知识库维护入口，允许存在。

### 页面结构

```text
Runtime Status
- runtime mode
- MCP transport
- server command
- current vault root
- build status
- last connection

Connected / Recently Seen Agents
- Codex
- Claude
- Cursor
- Custom
- status
- last seen
- last tool call
- permission profile

Connect New Agent
- Codex config
- Claude config
- Cursor config
- Custom config
- Copy buttons

Permission Matrix
- read-only tools
- controlled write tools
- review-gated tools
- forbidden actions

Recent Tool Calls
- time
- agent
- tool
- target
- result
- risk
```

### 配置生成

#### stdio 示例

```json
{
  "mcpServers": {
    "obs-wiki": {
      "command": "node",
      "args": [
        "/path/to/obs-wiki/apps/mcp-server/dist/server.js",
        "--vault-root",
        "/path/to/current/vault"
      ]
    }
  }
}
```

#### HTTP daemon 示例，后期预留

```json
{
  "mcpServers": {
    "obs-wiki": {
      "url": "http://127.0.0.1:37241/mcp",
      "headers": {
        "Authorization": "Bearer <token>"
      }
    }
  }
}
```

MVP 先支持 stdio 配置生成即可。

---

## 3.5 Source Status View

### 目标

只显示 Agent 已创建或待处理的 source request，不提供手动提交 URL / 文件入口。

显示：

```text
Pending Sources
Blocked Sources
Analyzed Sources
Sources With Proposals
```

字段：

```text
source_kind
status
related_project
analysis_mode
created
claim_count
proposal_count
```

允许操作：

```text
Open source note
Open analysis report
Open related proposals
```

不允许：

```text
Add source
Analyze URL
Analyze File
```

---

## 3.6 Runtime Status View

### 目标

形成 runtime / MCP / vault health dashboard。

显示：

```text
MCP Server
- connected / waiting
- transport
- last tool call
- available tools count

Vault
- root path
- memory structure initialized
- missing folders / files

Runtime
- core version
- mcp server version
- plugin version
- build status

Permissions
- default permission profile
- controlled write enabled
- review required for long-term memory
```

---

## 4. Agent Connection Tracking

## 4.1 为什么需要

用户需要知道：

```text
哪些 Agent 连接过 obs-wiki？
最近哪个 Agent 调用了什么工具？
工具调用是否成功？
是否发生了写入？
是否产生了待审核 proposal？
```

## 4.2 MCP Server 需要记录的事件

### initialize

MCP client 调用 `initialize` 时记录：

```yaml
type: agent-connection-event
event: connected
agent_id: unknown-or-detected
client_name:
transport: stdio
timestamp:
runtime_version:
```

### tools/call

每次工具调用记录：

```yaml
type: agent-tool-call
agent_id:
tool_name:
args_summary:
result_status:
target_paths:
timestamp:
duration_ms:
risk_level:
```

不要记录完整敏感参数。需要做参数脱敏：

```text
token
secret
api_key
password
cookie
authorization
```

### 写入位置

MVP 可写入：

```text
00_control/audit_log.md
```

后期可拆分：

```text
00_control/agent_connections/
00_control/audit/tool_calls_YYYY-MM-DD.md
```

---

## 5. MCP 工具权限分层

新增文档：

```text
docs/MCP_Tool_Permission_Matrix.md
```

推荐矩阵：

### Read-only tools

```text
obs_wiki.status
obs_wiki.start_task
obs_wiki.recall
obs_wiki.read_note
obs_wiki.list_review_queue
obs_wiki.list_source_requests
obs_wiki.audit_recent
```

### Low-risk write tools

```text
obs_wiki.write_context_pack
obs_wiki.write_session_note
obs_wiki.capture_source
obs_wiki.propose_memory
obs_wiki.write_source_analysis_report
```

这些只能写入 allowlist：

```text
06_outputs/context_packs/
02_timeline/sessions/
03_sources/
01_inbox/review_queue/
06_outputs/source_analysis/
00_control/audit_log.md
```

### Review-gated tools

```text
obs_wiki.apply_approved_writeback
```

要求：

```text
proposal status must be approved
writeback plan must be explicit
target path must be allowed
audit event must be written
repeat apply must be rejected
```

### Forbidden actions

```text
delete note
bulk migration
read outside vault
read .obsidian/
write secrets
commit user preference without approval
commit high-confidence claim without review
arbitrary shell
arbitrary Obsidian command
```

---

## 6. 代码结构改进计划

当前 `main.ts` 承载过多逻辑。下一步逐步拆分。

推荐结构：

```text
apps/obsidian-plugin/src/
├── main.ts
├── constants.ts
├── settings/
│   └── ObsWikiSettingTab.ts
├── services/
│   ├── AgentActivityService.ts
│   ├── AgentConnectionService.ts
│   ├── ReviewQueueService.ts
│   ├── SourceStatusService.ts
│   ├── AuditService.ts
│   ├── PermissionPolicyService.ts
│   └── MemoryStructureService.ts
├── views/
│   ├── AgentActivityView.ts
│   ├── AgentConnectionsView.ts
│   ├── ReviewQueueView.ts
│   ├── SourceStatusView.ts
│   ├── MemoryInspectorView.ts
│   ├── AuditLogView.ts
│   ├── RuntimeStatusView.ts
│   └── PermissionPolicyView.ts
├── components/
│   ├── StatusBadge.ts
│   ├── MetricCard.ts
│   ├── EmptyState.ts
│   ├── Timeline.ts
│   ├── ProposalCard.ts
│   ├── ConnectionCard.ts
│   └── KeyValueList.ts
└── utils/
    ├── frontmatter.ts
    ├── markdown.ts
    ├── time.ts
    ├── mcpConfig.ts
    └── dom.ts
```

MVP 允许轻量拆分：

```text
先抽 constants.ts
先抽 AgentConnectionsView.ts
先抽一个 AgentConnectionService.ts
先扩展 styles.css
```

---

## 7. 分批执行计划

## Batch A：UI Design System + Agent Activity Dashboard

目标：

```text
把 Activity 从简单 section 列表升级为 dashboard。
```

任务：

```text
1. 扩展 styles.css。
2. 新增 status bar、metric cards、timeline、empty state 样式。
3. Agent Activity View 增加顶部状态栏。
4. Agent Activity View 增加 4 个 metric cards。
5. Agent Activity View 合并 recent tasks / context packs / source captures / proposals / audit events 为 timeline。
6. 保持 Refresh Views 命令。
```

验收：

```text
插件 build 通过。
打开 Agent Activity 后不再只是空 section。
没有维护入口按钮。
```

---

## Batch B：Review Queue UI

目标：

```text
把 Review Queue 做成真正的治理界面。
```

任务：

```text
1. 增加 filter tabs。
2. 增加 proposal card。
3. 增加 risk badge / status badge。
4. 显示 evidence count / target note / task id / created time。
5. 保留 Approve / Reject / Defer / Request Revision / Apply Approved Writeback。
6. 不增加 Analyze / Capture / Build Context / Run Lint 入口。
```

验收：

```text
pending proposal 可读性明显提升。
不同状态可过滤。
审计写入仍可用。
```

---

## Batch C：Agent Connection Center MVP

目标：

```text
新增 Agent Connections 视图，帮助用户配置和追踪 Agent 连接。
```

任务：

```text
1. 新增 OBS_WIKI_AGENT_CONNECTIONS_VIEW。
2. 新增 Open Agent Connections 命令。
3. 新增 ribbon 或 toolbar 入口。
4. 新增 AgentConnectionsView。
5. 显示当前 vault root。
6. 显示 MCP server command。
7. 生成 Codex / Claude / Cursor / Custom config。
8. 提供 Copy Config 按钮。
9. 显示 recently seen agents 和 recent tool calls。
10. 增加 troubleshooting empty state。
```

验收：

```text
用户不需要回 Agent 对话询问如何连接。
可从 Obsidian 复制 MCP 配置。
可看到最近连接/调用信息。
```

---

## Batch D：MCP Connection / Tool-call Audit

目标：

```text
让 Agent Connections 能看到真实连接和 tool call。
```

任务：

```text
1. MCP server initialize 时写 connection event。
2. tools/call 前后写 tool-call event。
3. 记录 agent_id / client / tool / result / timestamp / target paths。
4. 对 args_summary 做脱敏。
5. 插件读取这些事件并展示。
```

验收：

```text
Agent 连接一次后，Obsidian Agent Connections 能显示 recently seen agent。
调用工具后，Recent Tool Calls 有记录。
```

---

## Batch E：MCP Tool Permission Matrix

目标：

```text
明确 read-only / low-risk write / review-gated / forbidden。
```

任务：

```text
1. 新增 docs/MCP_Tool_Permission_Matrix.md。
2. 更新 MCP server package description。
3. 更新 initialize instructions。
4. 在 Agent Connections / Permission Policy 中展示权限矩阵。
5. 写工具必须返回 audit_path。
```

验收：

```text
用户能看懂每个 Agent 能做什么。
MCP 文案不再自称纯 read-only。
```

---

## Batch F：main.ts 拆分

目标：

```text
降低维护复杂度。
```

任务：

```text
1. 抽 constants.ts。
2. 抽 AgentConnectionsView.ts。
3. 抽 AgentActivityView.ts 或 ReviewQueueView.ts。
4. 抽 service / utils。
5. 保持行为不变。
```

验收：

```text
main.ts 明显瘦身。
typecheck/build/package 通过。
```

---

## 8. 验证命令

Codex 完成每批后至少运行：

```bash
npm run --prefix apps/obsidian-plugin typecheck
npm run --prefix apps/obsidian-plugin build
npm run --prefix apps/obsidian-plugin package

npm run --prefix apps/mcp-server typecheck
npm run --prefix apps/mcp-server build
npm run --prefix apps/mcp-server smoke
```

如果根目录 workspace 已经实现，则运行：

```bash
npm run verify
```

---

## 9. 非目标

本轮不做：

```text
不新增 Analyze URL / File 的 Obsidian 入口
不新增 Capture Source 的 Obsidian 入口
不新增 Build Context Pack 的 Obsidian 入口
不新增 Run Lint / Distill 的 Obsidian 入口
不实现完整后台 daemon
不重写 core runtime
不引入 React / Vue 等重型 UI 框架
不删除 legacy code
```

---

## 10. 成功标准

本轮完成后，obs-wiki 插件应该让用户一眼看到：

```text
Agent 最近做了什么
哪些 proposal 等待审核
哪些 source request 等待处理
哪些 Agent / IDE 工具连接过
如何连接新的 Agent
最近有哪些 tool calls
MCP / Runtime / Permission 是否健康
```

一句话：

> obs-wiki Obsidian 插件应从简单面板升级为 Agent 外置记忆系统的连接控制台与治理台。
