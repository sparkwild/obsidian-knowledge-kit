# Vaultwright 下一阶段升级方案：MCP-first for AI Conversation, CLI-first for Execution

版本：2026-05-10
适用仓库：`sparkwild/Vaultwright`
建议执行分支：当前 `main` 已合并 `feat/vaultwright-core-workflows`，后续可基于 `main` 新建下一阶段分支。
执行者：本地 Codex App
文档角色：需求、边界、路线、验收标准；不包含实现代码。

---

## 0. 当前仓库状态判断

仓库已经从旧的 Obsidian knowledge prototype 收敛为 `Vaultwright`。当前产品展示名、插件名、安装路径和 skill 前缀都应统一为 `Vaultwright` / `vaultwright`。

当前 `main` 已包含上一阶段核心成果：

- Vaultwright 品牌文案。
- `vaultwright-query` skill。
- `vaultwright-lint` skill。
- `query.md` / `lint.md` commands。
- `scripts/build_context_pack.py`。
- `scripts/lint_knowledge_vault.py`。
- `lib/obsidian_knowledge_shared/context_pack.py`。
- `lib/obsidian_knowledge_shared/knowledge_lint.py`。
- `lib/obsidian_knowledge_shared/obsidian_runtime.py`。
- Obsidian Bases dashboard 渲染脚本。
- evidence-ready source register / claim-count / block-level evidence 相关增强。

因此下一阶段不是重做 Phase 1，而是在当前 `main` 的 `vaultwright` 路径基础上继续推进。

---

## 1. 本阶段核心战略

本阶段引入新的产品架构原则：

> **MCP-first for AI conversation, CLI-first for execution.**

中文解释：

> **AI 对话中的知识库查询优先走 MCP；本地任务执行、写入、校验、批处理优先走 CLI / local runtime。**

这不是二选一，而是分层。

```text
AI Chat Client / AI IDE / Codex / Claude / Cursor
        ↓
Vaultwright MCP Adapter
        ↓
Vaultwright Query / Context / Lint / Review Tools
        ↓
Vaultwright CLI Runtime + Local Scripts
        ↓
Obsidian CLI + Active Obsidian Vault
        ↓
Obsidian Notes / Properties / Wikilinks / Blocks / Bases
```

### 1.1 MCP 的角色

MCP 是 AI 对话工具访问 Vaultwright 的统一协议层，负责让模型在对话中发现、选择和调用知识库资源与工具。

MCP 负责：

- 向 AI 客户端暴露 Vaultwright 的高层语义工具。
- 暴露只读 Resources，如 active context、index、latest lint report、context packs、review queues。
- 暴露 Prompts，如 Vaultwright Query / Lint / Ingest / Distill。
- 把用户的自然语言问题转换为可控的 Vaultwright 查询动作。
- 默认只读，写操作必须清晰标记并经过用户确认。

MCP 不负责：

- 直接绕过 Vaultwright runtime 任意读写文件。
- 直接替代 Obsidian vault。
- 建立 vault 外部的第二知识库。
- 让模型无确认地执行破坏性操作。

### 1.2 CLI 的角色

CLI 是确定性执行层，负责稳定地完成本地任务：detect active vault、读取上下文、生成 context pack、运行 lint、创建 session、写 log、生成 dashboards、执行 doctor 等。

CLI 负责：

- 本地 Codex App 执行任务。
- 读写 Obsidian vault 内部笔记。
- 运行环境检查、插件结构检查、知识 lint。
- 批量扫描、报告生成、写回 session/log/context pack。
- 作为 MCP adapter 的底层执行内核。

CLI 不负责：

- 在 AI 对话端暴露一堆底层 shell 命令。
- 替代 MCP 的工具发现和资源暴露能力。
- 把 AI 对话查询变成不可审计的 shell 流程。

---

## 2. 本阶段新增目标

### 2.1 产品目标

1. 让 Vaultwright 在 AI 对话工具中成为可发现、可调用、可解释的知识库入口。
2. 让本地执行仍然保持确定性、可验证、可回滚。
3. 建立 MCP adapter，但不让 MCP 成为核心硬依赖。
4. 评估 Python 脚本是否需要替换为更高性能框架；优先用数据而不是直觉决策。
5. 对大 vault 的扫描、query、lint 性能建立基准线。

### 2.2 技术目标

1. 先增加 MCP adapter 设计文档，明确 tools/resources/prompts 与权限边界。
2. 在 README 与项目文档中明确 MCP/CLI 分工。
3. 增加 runtime performance evaluation，明确 Python / uv / Rust / Go / TypeScript 的取舍。
4. 增加 benchmark 设计文档与测试场景，先量化再重写。
5. 改进现有 Python runtime 的性能风险点，尤其是大 vault 扫描时的 per-note CLI subprocess 读文件问题。
6. 形成“高层 MCP tool -> Vaultwright runtime -> Obsidian CLI / vault”的稳定调用链。
7. 本轮不实现完整 MCP server，除非文档评审后单独批准。

---

## 3. 重要架构约束

### 3.1 Obsidian-native 约束

- Active Obsidian vault 仍然是唯一知识载体。
- 不允许创建外部 raw/wiki 第二知识库系统。
- 文件夹只是 Obsidian 导航与归档辅助，不是独立知识模型。
- 稳定知识必须继续使用 Obsidian notes、Properties、wikilinks、block references、index/log、Bases dashboards。
- Context pack 是 vault 内工作笔记，不是外部数据库。

### 3.2 MCP 约束

- MCP adapter 只暴露高层 Vaultwright 语义工具，不暴露任意文件系统命令。
- 默认只读。
- 写入工具必须以 `apply`、`write`、`distill`、`ingest` 等语义明确命名。
- 破坏性操作不进入 MVP。
- MCP 工具返回结构化结果，必须包含 evidence/source/path/status 等可审计字段。
- MCP 不直接决定稳定知识写回；写回仍走 Vaultwright CLI/runtime 并产生 log/session/report。

### 3.3 CLI 约束

- CLI-first 指的是执行边界，不代表每个文件读取都必须调用一次 `obsidian read`。
- 对 active vault 的批量只读扫描，可以在确认 active vault 后使用本地文件读取优化性能。
- 写操作优先保持 Obsidian-aware：通过 Obsidian CLI、明确路径、原子写、报告式写回、或受控 runtime。
- 所有批量写入必须有 dry-run / read-only first / apply 后缀或等价机制。

---

## 4. MCP Adapter 需求设计

### 4.1 MCP Tools MVP

MVP 阶段只做高价值、低风险、可测试工具。

#### 只读工具

1. `vaultwright_status`
   - 返回 active vault、核心 notes 是否存在、插件 runtime 是否可用、最近 lint/context 状态。
   - 底层调用 doctor / context loader / plugin check，但不写入。

2. `vaultwright_query`
   - 输入用户问题。
   - 生成或预览 context pack。
   - 返回 candidate notes、source candidates、knowledge gaps、suggested writeback target。
   - 默认不写入 context pack；可选参数允许写入，但需要用户确认。

3. `vaultwright_search_notes`
   - 面向 AI 对话的轻量搜索。
   - 返回 note path、title、type、score、evidence block candidate。
   - 不返回整库内容。

4. `vaultwright_read_note`
   - 读取单篇笔记或指定 heading/block。
   - 必须限制在 active vault 内。
   - 返回路径、frontmatter 摘要、正文片段、links、source refs。

5. `vaultwright_list_review_queue`
   - 返回 pending raw、unverified claims、knowledge gaps、stale concepts、latest lint report。
   - 供 AI 对话中主动建议下一步。

6. `vaultwright_lint_preview`
   - 运行或读取 lint summary。
   - 默认不写 report。

#### 受控写入工具

7. `vaultwright_write_context_pack`
   - 把 context pack 写入 `01_ai_core/context_packs/`。
   - 必须返回 written path。

8. `vaultwright_write_lint_report`
   - 把 lint report 写入 `00_system/reports/`。
   - 不自动修复。

9. `vaultwright_distill_session`
   - 生成 session skeleton 或应用 distill updates。
   - 必须要求明确 summary。

MVP 阶段不做：

- 删除文件。
- 移动/重命名大量路径。
- 任意执行 Obsidian command palette command。
- 任意 shell command。
- 自动批量改写 `05_knowledge/`。

### 4.2 MCP Resources MVP

建议暴露以下 Resources：

- `vaultwright://system`
- `vaultwright://active-context`
- `vaultwright://longterm-context`
- `vaultwright://index`
- `vaultwright://log/recent`
- `vaultwright://context-pack/latest`
- `vaultwright://lint/latest`
- `vaultwright://dashboard/knowledge-inbox`
- `vaultwright://dashboard/unverified-claims`
- `vaultwright://dashboard/stale-concepts`
- `vaultwright://note/{path}`
- `vaultwright://search/{query}`

Resource 原则：

- Resource 默认只读。
- Resource 要带 title、description、mimeType、lastModified、priority。
- Resource 内容不应过大；长笔记应返回摘要和可进一步读取的 anchors。
- 不暴露 `.obsidian/`、`.trash/`、secret 文件、系统配置敏感内容。

### 4.3 MCP Prompts MVP

建议暴露：

1. `Vaultwright Query`
   - 先生成 context pack，再回答。

2. `Vaultwright Lint`
   - 检查知识健康，不自动修复。

3. `Vaultwright Review Source`
   - 对一个 raw/source register 做 evidence/claim/synthesis review。

4. `Vaultwright Review Gap`
   - 对 knowledge gap 做上下文查找和下一步建议。

5. `Vaultwright Distill`
   - 把当前 AI 对话结果回写成 session/log/active_context。

---

## 5. 现有 Python 脚本性能评估

### 5.1 当前 Python runtime 的优势

当前 Python 脚本适合作为 Phase 1/2 的 runtime，原因：

- 代码简单，适合 Codex 本地执行和快速修改。
- 与现有 repo 结构一致，不需要新增复杂构建链。
- 对 Obsidian vault 的文件、frontmatter、Markdown 操作易于表达。
- `--json` / `--apply` 这类命令接口已经形成雏形。
- 当前风险更多是 I/O 策略和索引策略，而不是 Python 语言本身。

### 5.2 当前 Python runtime 的主要风险

1. **大 vault 扫描性能**
   - `context_pack.py` 和 `knowledge_lint.py` 需要遍历 Markdown notes。
   - 如果每篇 note 都经由 `obsidian read` subprocess 读取，会产生高额进程启动成本。
   - 对 500 篇笔记影响不大；对 5000+ 篇笔记会明显拖慢。

2. **重复解析**
   - frontmatter parser 在多个模块中重复出现。
   - claim block / evidence block / wikilink / heading 解析也有重复逻辑。
   - 重复解析会增加维护成本，并影响性能优化。

3. **无持久索引**
   - context pack 当前主要靠实时扫描和简单 token scoring。
   - lint 也实时构建 note maps。
   - 当 vault 达到数千至数万笔记时，增量索引会更重要。

4. **无 benchmark 基线**
   - 现在还不能回答“Python 慢到需要重写吗”。
   - 必须先建立基准测试，再决定替换框架。

### 5.3 初步结论

当前不建议立刻把 Python 全部替换。

更合理的路线是：

1. 先保留 Python runtime。
2. 引入 `uv` 做依赖、脚本运行、锁文件和跨平台开发环境管理。
3. 优化 Python 读写策略：active vault 检测走 CLI，批量只读扫描可直接读取 vault 文件，写入继续受控。
4. 建立 benchmark。
5. 如果 benchmark 证明瓶颈主要在扫描/解析/搜索，再把性能关键内核迁移为 Rust 或 Go。
6. MCP adapter 可以独立选择 TypeScript 或 Python，不强行绑定现有脚本语言。

---

## 6. 替代框架评估

### 6.1 方案 A：继续 Python，但引入 uv 和结构化项目管理

推荐级别：P0 推荐
定位：短期最稳方案

收益：

- 提升依赖安装、脚本运行、Python 版本管理、lockfile 的稳定性。
- 对本地 Codex App 更友好：环境更可重复。
- 不破坏现有脚本。
- 可逐步把散落脚本整理成统一 CLI package。

限制：

- uv 提升的是环境和依赖效率，不会自动让 Markdown 扫描逻辑变快。
- 核心算法和 I/O 策略仍需单独优化。

适合任务：

- 当前所有 scripts。
- doctor / init / ingest / query / lint / distill。
- benchmark harness。

决策：

> **立即采用。** 不作为“替换 Python”，而作为 Python runtime 的基础设施升级。

### 6.2 方案 B：TypeScript MCP adapter + Python runtime

推荐级别：P1 推荐
定位：MCP-first conversation 的产品入口

收益：

- TypeScript/Node 生态更贴近 MCP server 常见实现和 AI 客户端集成。
- MCP adapter 可以作为薄层，调用现有 Vaultwright scripts/runtime。
- 不要求重写 Python。
- 有利于把 tools/resources/prompts 产品化。

限制：

- Node/TypeScript 不一定比 Python 扫描 Markdown 更快。
- 会引入第二语言栈。
- 如果只做 MCP adapter，性能瓶颈仍在底层 runtime。

适合任务：

- MCP server。
- Tools / Resources / Prompts 定义。
- JSON-RPC protocol adapter。
- AI 客户端集成。

决策：

> **推荐作为 MCP adapter 第一选择。** 但不要用它重写所有 vault scanning。

### 6.3 方案 C：Python MCP adapter + Python runtime

推荐级别：P1 备选
定位：最小复杂度 MCP MVP

收益：

- 单语言栈，Codex 更容易持续维护。
- 可以快速把现有 scripts 封装成 MCP tools。
- 适合 MVP 验证。

限制：

- 对 MCP 客户端生态和打包分发的适配可能不如 TypeScript 直观。
- MCP adapter 和 runtime 容易耦合过深。
- 对性能没有本质提升。

决策：

> **如果本地 Codex App 更容易维护 Python，则可先用 Python 做 MCP MVP。** 但长期产品化仍建议把 MCP adapter 与 runtime 解耦。

### 6.4 方案 D：Rust performance core + Python/TypeScript adapter

推荐级别：P2 条件推荐
定位：大 vault 扫描、索引、lint、search 的性能内核

收益：

- 非常适合高性能 Markdown 扫描、frontmatter 解析、索引构建、link graph 构建。
- 可输出单独 binary，供 Python scripts 和 MCP adapter 调用。
- 可作为长期 `vaultwright-core`。
- 可选通过 PyO3 暴露给 Python，但更推荐先做 binary，降低绑定复杂度。

限制：

- 开发复杂度显著增加。
- 跨平台打包、签名、发布、fallback 都要设计。
- 过早重写会拖慢产品节奏。

触发条件：

- 10k notes vault 下 context pack P95 超过 8 秒。
- 10k notes vault 下 lint P95 超过 20 秒。
- 单次 lint 内存超过 512MB。
- per-note subprocess 读取优化后仍无法满足目标。
- 需要持久全文索引、link graph、增量扫描。

决策：

> **不立即采用；先 benchmark。若性能瓶颈成立，再做 Rust core。**

### 6.5 方案 E：Go single-binary core

推荐级别：P2 备选
定位：比 Rust 更简单的单 binary CLI core

收益：

- 编译和跨平台分发相对简单。
- 单 binary 适合本地工具。
- 对文件扫描、并发、CLI 都足够强。

限制：

- Markdown/frontmatter/Obsidian 语义处理生态可能不如 Python 快速，也不如 Rust 在高性能索引方面极致。
- 与 Python / TypeScript 的互操作多半还是靠 subprocess。

决策：

> **作为 Rust core 的备选。** 如果团队更熟 Go，可选择 Go；否则 Rust 更适合 performance core。

### 6.6 方案 F：Bun / Deno / Node 全量重写

推荐级别：不推荐
定位：不适合当前阶段

原因：

- 会混淆 MCP adapter 与 Vaultwright runtime。
- 对性能瓶颈没有充分证据。
- 会破坏现有 Python scripts 的稳定性。
- 对本地 Codex App 的执行可预测性不一定更好。

决策：

> **不做全量重写。**

---

## 7. 性能路线图

### 7.1 Benchmark 场景

本阶段必须建立 benchmark，而不是直接重写。

测试 vault 规模：

- S：100 notes
- M：1,000 notes
- L：5,000 notes
- XL：10,000 notes
- XXL：50,000 notes（可选）

测试任务：

1. `status / doctor`
2. `build_context_pack`
3. `lint_knowledge_vault`
4. `render_bases_dashboards`
5. `reconcile_source_register`
6. note search / related notes ranking
7. broken link scan
8. claim/evidence scan

指标：

- cold start latency
- warm run latency
- total notes scanned
- total bytes scanned
- subprocess count
- Obsidian CLI calls count
- direct file reads count
- peak memory
- output size
- error count

目标阈值：

- 1,000 notes：context pack < 2s；lint < 5s。
- 5,000 notes：context pack < 5s；lint < 12s。
- 10,000 notes：context pack < 8s；lint < 20s。
- 内存：常规任务 < 512MB。
- CLI subprocess：批量扫描不应为每篇 note 启动一次 subprocess。

### 7.2 性能优化优先级

P0：减少 subprocess

- active vault 检测使用 Obsidian CLI。
- 列文件可以使用 CLI 或直接文件系统。
- 批量只读扫描应避免 per-note `obsidian read`。
- 写入仍保持受控，并明确记录是否通过 CLI 或 runtime fallback。

P1：统一解析器

- frontmatter、wikilink、heading、block id、claim/evidence block 解析统一到一个模块。
- context pack 和 lint 共享 note metadata cache。

P2：增量缓存

- 建立 vault 内或用户缓存目录中的轻量 index manifest。
- 使用 file mtime/hash 判断是否重新解析。
- 缓存 note metadata、links、block ids、source refs。

P3：全文检索或混合检索

- 小 vault：token scoring 足够。
- 中 vault：SQLite FTS/BM25。
- 大 vault：Rust/Tantivy 或等价高性能索引。

P4：Rust/Go core

- 只在 benchmark 证明需要时启动。
- 先迁移扫描、解析、索引、link graph。
- Python/TypeScript adapter 保持高层产品语义。

---

## 8. 本阶段建议 PR 拆分

### PR A：分支收敛与品牌完整性

目标：让 `main`、feature branch 和 `vaultwright` 命名状态明确。

任务：

- 确认当前工作分支没有和 `main` 分叉。
- 如果出现分叉，先报告状态和建议，不强制 merge/rebase。
- 修正 `plugin.json` 中 homepage / repository / websiteURL / privacyPolicyURL / termsOfServiceURL 指向新仓库 `sparkwild/Vaultwright`。
- README 中确认产品名、插件名、安装路径都统一为 Vaultwright / `vaultwright`。
- `check_codex_plugin.py` 继续检查 `plugins/vaultwright`、`skills/vaultwright-*` 和 `~/.codex/plugins/vaultwright`。

验收：

- 本地运行 plugin check 通过。
- README 英中一致。
- 产品名、repo URL、插件名和安装路径说明清楚。

### PR B：MCP / CLI 架构文档

目标：先把边界定死，避免后续实现跑偏。

新增或更新：

- `docs/architecture/mcp_cli_runtime.md`
- `docs/architecture/mcp_tool_contract.md`
- `docs/architecture/security_boundaries.md`

验收：

- 明确 MCP-first for AI conversation。
- 明确 CLI-first for execution。
- 明确 MCP 只暴露高层 Vaultwright tools/resources/prompts。
- 明确 read-only default 和 write confirmation。
- 明确不创建外部 raw/wiki 系统。

### PR C：MCP Adapter MVP

目标：让 AI 对话工具能通过 MCP 查询 Vaultwright。该 PR 需要单独确认后再执行，不能由文档补充任务直接实现。

范围：

- 新建 MCP adapter package。
- 暴露只读 tools/resources/prompts。
- Tools 调用现有 runtime/scripts，而不是复制业务逻辑。
- 默认只读；写 context pack / lint report 是可选受控动作。

MVP Tools：

- `vaultwright_status`
- `vaultwright_query`
- `vaultwright_search_notes`
- `vaultwright_read_note`
- `vaultwright_list_review_queue`
- `vaultwright_lint_preview`

MVP Resources：

- system
- active-context
- index
- latest context pack
- latest lint report
- selected note
- review queues

MVP Prompts：

- Vaultwright Query
- Vaultwright Lint
- Vaultwright Review Source
- Vaultwright Review Gap
- Vaultwright Distill

验收：

- MCP Inspector 可以连接。
- tools/list、resources/list、prompts/list 正常。
- `vaultwright_query` 能返回 context pack summary。
- `vaultwright_read_note` 不能读取 vault 外路径。
- 默认不会写入 vault。

### PR D：Python runtime 性能基准

目标：用数据决定是否重写。

新增：

- `docs/architecture/performance_strategy.md`
- `benchmarks/README.md`
- benchmark fixture 设计。
- benchmark 报告输出规范。

验收：

- 能对 S/M/L/XL vault 运行 context pack 和 lint 基准。
- 报告包含运行时间、notes 数、bytes、subprocess 数、CLI calls、内存。
- 输出可进入 `00_system/reports/` 或 repo benchmark artifact。

### PR E：Python runtime 优化，不改变语言栈

目标：先解决低成本性能问题。

任务：

- 确认 active vault 后，批量只读扫描避免 per-note CLI subprocess。
- 统一 frontmatter/wikilink/block/claim parser。
- 减少 context pack 和 lint 的重复扫描。
- 增加 note metadata cache 的设计或最小实现。
- 引入 uv project/lockfile 方案。

验收：

- 不改变外部 CLI contract。
- context pack 和 lint 在 benchmark 中有明确改善。
- 原有 commands/scripts 仍可运行。
- Python 仍是默认 runtime。

### PR F：性能内核替换 PoC 决策

目标：决定是否启动 Rust/Go core。

触发条件：

- benchmark 超过阈值。
- 低成本 Python 优化后仍不满足。
- 大 vault 目标成为产品核心场景。

PoC 要求：

- 只迁移扫描/解析/索引核心。
- 保持 Python/TypeScript adapter 调用高层 contract 不变。
- 不影响 Obsidian-native 语义。
- 必须提供 fallback。

验收：

- Rust/Go PoC 与 Python 输出一致。
- 速度提升显著且可复现。
- 增加维护复杂度的收益被证明。

---

## 9. 对本地 Codex App 的执行指令

请在仓库中执行下一阶段升级，遵守以下原则：

1. 基于当前 `main` 的实际状态进行评估，不要基于旧命名或旧路径假设。
2. 不直接推翻现有 Python scripts，不全量重写。
3. 先补架构文档和 MCP/CLI contract，再做 MCP adapter。
4. MCP-first for AI conversation：MCP 暴露 tools/resources/prompts，用于 AI 对话中的查询和上下文发现。
5. CLI-first for execution：本地确定性任务继续通过 Vaultwright scripts/runtime 和 Obsidian CLI 执行。
6. Python runtime 替代必须基于 benchmark 结论；优先引入 uv 和低成本 I/O 优化。
7. 不允许创建 vault 外部 raw/wiki 知识层。
8. 不允许 MCP 直接暴露任意 shell command 或 unrestricted file write。
9. 所有写操作必须默认 read-only first，并需要 `apply` 或明确确认。
10. 每个 PR 必须更新 README / docs / plugin checks / synced plugin package，保持 root 与 plugin bundled copy 一致。

---

## 10. Definition of Done

本阶段完成时应满足：

- `main` 与 feature branch 状态清晰。
- Vaultwright 品牌和仓库 URL 在 README / plugin manifest / docs 中一致。
- MCP/CLI 分层架构文档完成。
- MCP adapter design 已明确 tools/resources/prompts、权限模型和 CLI 调用关系。
- 只读 stdio MCP Adapter MVP 已实现；写入型完整 MCP server 和 MCP Inspector 验证留到后续获批实现阶段。
- MCP 查询工具的目标 contract 能返回 context pack summary。
- CLI scripts 仍然可独立运行。
- benchmark 文档和初始基线完成。
- Python runtime 替代结论明确：短期继续 Python + uv，长期按 benchmark 决定 Rust/Go core。
- 所有新写入仍发生在 active Obsidian vault 内部。
- 没有外部 raw/wiki 第二知识库。

---

## 11. 参考依据

- 当前仓库分支：`sparkwild/Vaultwright`, `main`
- 当前关键文件：
  - `README.md`
  - `plugins/vaultwright/.codex-plugin/plugin.json`
  - `skills/vaultwright-query/SKILL.md`
  - `skills/vaultwright-lint/SKILL.md`
  - `lib/obsidian_knowledge_shared/context_pack.py`
  - `lib/obsidian_knowledge_shared/knowledge_lint.py`
  - `lib/obsidian_knowledge_shared/obsidian_runtime.py`
- MCP 官方文档：
  - https://modelcontextprotocol.io/docs/getting-started/intro
  - https://modelcontextprotocol.io/docs/learn/architecture
  - https://modelcontextprotocol.io/specification/2025-06-18/server/tools
  - https://modelcontextprotocol.io/docs/concepts/resources
  - https://modelcontextprotocol.io/docs/concepts/prompts
- Obsidian CLI 官方文档：
  - https://obsidian.md/help/cli
- uv 官方文档：
  - https://docs.astral.sh/uv/
- PyO3 参考：
  - https://github.com/PyO3/pyo3
