# obs-wiki 系统架构

## 总体架构

```text
Agent / AI Client
Codex / Claude / Cursor / ChatGPT / Local Agent
        ↓ MCP
obs-wiki MCP Server
        ↓
obs-wiki Memory Runtime
        ↓
obs-wiki Obsidian Plugin Bridge
        ↓
Obsidian Vault
        ↓
Human Review / Audit / Correction in Obsidian App
```

## 四层职责

### 1. Obsidian Plugin

Obsidian 插件是用户信任界面和 vault bridge。

职责：

- 初始化 vault memory structure。
- 展示 Agent Activity。
- 展示 Review Queue。
- 展示 Audit Log。
- 展示 Source Analysis Queue。
- 展示 Memory Inspector。
- 管理权限。
- 监听 vault 文件变化。
- 通过 Obsidian Vault API 安全读写。
- 显示 runtime / MCP 状态。

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

### 4. CLI

CLI 是自动化和调试入口，不是主产品入口。

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
│   │   │   │   ├── SourceAnalysisView.ts
│   │   │   │   ├── MemoryInspectorView.ts
│   │   │   │   └── PermissionCenterView.ts
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
