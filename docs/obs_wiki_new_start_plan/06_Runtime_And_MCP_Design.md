# obs-wiki Runtime 与 MCP 设计

## Runtime 目标

Memory Runtime 是执行内核，负责：

- 解析 vault notes。
- 构建索引。
- 支持 recall / context pack。
- 支持 source analysis。
- 支持 lint / governance。
- 支持 audit。
- 支持 permission policy。
- 支持 MCP tools 调用。

## Runtime 模块

```text
VaultScanner
MarkdownParser
FrontmatterParser
LinkGraphBuilder
ClaimParser
EvidenceResolver
SourceAnalyzer
MemoryRetriever
ContextPackBuilder
LintEngine
ProposalEngine
PermissionEngine
AuditLogger
IndexStore
```

## Index 设计

MVP 可先用 JSON cache；更推荐 SQLite。

建议缓存：

- note path。
- title。
- aliases。
- tags。
- type。
- frontmatter。
- headings。
- block ids。
- wikilinks。
- backlinks。
- claim blocks。
- evidence blocks。
- source refs。
- mtime / size / hash。

Index 是缓存，不是知识本体。

## MCP 生命周期

三种模式：

### Agent-session mode

默认 MVP。

```text
Agent Client starts obs-wiki-mcp via stdio
→ MCP calls Runtime
→ Runtime reads/writes Obsidian vault under policy
→ Task ends, process exits
```

### Obsidian-bound mode

```text
Obsidian App open
→ Plugin active
→ Runtime available
→ Obsidian close, Runtime unavailable
```

### Background daemon mode

高级模式。

```text
obs-wiki daemon always running
→ indexes vault changes
→ serves MCP HTTP endpoint
```

MVP 只需要 Agent-session mode。

## MCP 安全边界

默认只读。

允许自动写入：

- context packs。
- session notes。
- source notes。
- analysis reports。
- proposals。
- audit events。

需要确认：

- committed memory。
- user preferences。
- project status update。
- stable knowledge note update。

禁止：

- arbitrary shell。
- delete files。
- bulk migration。
- vault-external path access。
- `.obsidian/` access。
- write secrets。
- bypass review to commit protected memory。

## MCP 与 Obsidian 插件关系

MCP Server 不应直接成为 Obsidian UI。它只做 Agent 接口。

Obsidian 插件负责：

- 展示 activity。
- 展示 review queue。
- 展示 audit log。
- 提供权限设置。
- 显示 MCP status。
- 给用户复制 MCP config。

## Local file 与 Obsidian API

Obsidian 插件内读写应优先使用 Obsidian Vault API。

MCP / Runtime 在 Obsidian 未打开时可以读取 vault 文件，但写入策略要更保守：

允许：

- session。
- context pack。
- source。
- proposal。
- audit。

禁止：

- protected memory commit。
- destructive operations。
- bulk updates。

## Source Analysis Runtime

用户手动指定 URL / 文件后：

```text
create agent-request
→ capture source
→ extract text / metadata
→ create source note
→ extract evidence / claims
→ compare with memory
→ create analysis report
→ create proposals
→ write audit event
```

MVP 先支持：

- URL external reference。
- Markdown / TXT。
- PDF 文本提取可选。
- 当前 note / 当前选区。

暂缓：

- OCR。
- 音频转写。
- 登录网页自动抓取。
- 浏览器扩展。
