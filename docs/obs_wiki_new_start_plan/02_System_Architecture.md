# obs-wiki 系统架构

## 总体架构

```text
User task
        ↓
Agent / AI Client
Codex / Claude / Cursor / ChatGPT / Local Agent
        ↓ MCP
obs-wiki MCP Server
        ↓
obs-wiki Memory Runtime
        ↓
Obsidian Vault
        ↓
obs-wiki Obsidian Plugin
        ↓
Human Review / Audit / Approval in Obsidian App
```

## 四层职责

### 1. Obsidian Plugin

Obsidian 插件是用户信任界面和治理入口，不是资料提交或维护动作入口。

职责：

- 展示 Agent Activity。
- 展示 Review Queue。
- 展示 Audit Log。
- 展示 Agent 生成的 Source Status / Context Pack / Runtime Status。
- 展示 Memory Inspector。
- 展示权限策略。
- 监听 vault 文件变化。
- 对 proposal 执行 approve / reject / defer / request revision。
- 触发 Runtime 执行 approved writeback。
- 只写入审核状态、审核意见、审计事件和 UI settings。

明确不负责：

- Analyze URL / Analyze Local File / Analyze Current Note / Analyze Selection。
- Capture Source / Build Context Pack / Run Ingest / Run Lint / Run Distill。
- 创建 source note / context pack / source-analysis report / session note / memory proposal。

### 2. Memory Runtime

Runtime 是执行内核。

职责：

- note parser。
- metadata index。
- wikilink / block / claim / source ref 解析。
- context pack 构建。
- memory recall。
- source analysis。
- lint / health checks。
- writeback planner。
- approved writeback executor。
- permission engine。
- audit event 生成。

### 3. MCP Server

MCP Server 是 Agent 调用入口。

职责：

- 暴露 `obs_wiki.*` tools。
- 暴露 resources。
- 暴露 prompts。
- 对所有请求执行权限检查。
- 调用 Runtime，而不是复制业务逻辑。
- 默认 read-only，写入受 allowlist 和 review policy 控制。
- 用户提交 URL / 文件 / source analysis / context pack / lint / distill 等任务时，由 Agent 调用 MCP 发起。

### 4. CLI

CLI 是自动化和调试入口，不是用户主产品入口，也不是 Obsidian 插件按钮背后的资料提交入口。

职责：

- doctor。
- index rebuild。
- benchmark。
- lint。
- debug。
- 作为 MCP Server 的 fallback 调用方式。

## 推荐技术栈

### MVP

```text
Obsidian Plugin: TypeScript
MCP Server: TypeScript
Runtime Core: TypeScript first, 可后续拆 Rust/Go
Index: SQLite or JSON cache first
CLI: TypeScript
UI: Obsidian ItemView + SettingsTab
```

### 后期

```text
Performance core: Rust/Go optional
Vector search: optional local / provider adapter
Persistent index: SQLite + FTS
```

## 新仓库结构建议

```text
obs-wiki/
├── apps/
│   ├── obsidian-plugin/
│   │   ├── manifest.json
│   │   ├── package.json
│   │   ├── src/
│   │   │   ├── main.ts
│   │   │   ├── views/
│   │   │   │   ├── AgentActivityView.ts
│   │   │   │   ├── ReviewQueueView.ts
│   │   │   │   ├── SourceStatusView.ts
│   │   │   │   ├── MemoryInspectorView.ts
│   │   │   │   ├── AuditLogView.ts
│   │   │   │   ├── RuntimeStatusView.ts
│   │   │   │   └── PermissionPolicyView.ts
│   │   │   ├── commands/
│   │   │   ├── settings/
│   │   │   ├── bridge/
│   │   │   └── styles/
│   │   └── styles.css
│   │
│   ├── mcp-server/
│   │   ├── package.json
│   │   └── src/
│   │       ├── server.ts
│   │       ├── tools/
│   │       ├── resources/
│   │       └── prompts/
│   │
│   └── cli/
│       ├── package.json
│       └── src/
│           ├── index.ts
│           └── commands/
│
├── packages/
│   ├── core/
│   │   └── src/
│   │       ├── memory/
│   │       ├── retrieval/
│   │       ├── source/
│   │       ├── lint/
│   │       ├── audit/
│   │       ├── permissions/
│   │       └── index/
│   │
│   ├── schemas/
│   │   └── src/
│   │       ├── memory.ts
│   │       ├── agent-task.ts
│   │       ├── source.ts
│   │       ├── proposal.ts
│   │       └── audit.ts
│   │
│   └── shared/
│       └── src/
│           ├── paths.ts
│           ├── markdown.ts
│           └── safety.ts
│
├── docs/
├── tests/
└── package.json
```

## 生命周期设计

### Obsidian 插件

跟随 Obsidian App 开启和关闭。

### MCP Server / Runtime

三种模式：

1. Obsidian-bound：只在 Obsidian 打开时可用。
2. Agent-session：由 Agent 客户端按需启动，推荐 MVP 默认。
3. Background daemon：高级用户可常驻后台。

MVP 推荐：Agent-session + Obsidian 插件负责审计和复核。
