# Vaultwright — Codex 执行任务方案文档

版本：v0.1
日期：2026-05-10
适用仓库：`sparkwild/Vaultwright`
目标执行者：本地 Codex App
文档定位：产品与技术负责人给 Codex 的需求、边界、任务拆分与验收标准；不在本文中提供实现代码。

---

## 0. 给 Codex 的启动指令

请先完整阅读本文档，然后在当前仓库中执行“Phase 1：Vaultwright 品牌与边界升级”和“Phase 2：Query / Context Pack 工作流”。

执行时请遵守：

- 先审阅仓库当前结构，不要假设路径。
- 不要把项目改造成 Obsidian 社区插件。
- 不要在 Obsidian vault 外建立独立 `raw/wiki` 知识库系统。
- 不要静默修改用户实际 Obsidian vault；本次任务只修改本仓库的插件包、skills、commands、scripts、文档与模板。
- 将产品展示名、内部包名、插件名、skill 名和安装路径统一收敛到 `Vaultwright` / `vaultwright`。
- 所有新增能力必须能够被 `scripts/check_codex_plugin.py --json` 检查到。
- 完成后输出修改摘要、风险点、验证结果和下一阶段建议。

---

## 1. 产品新名称与定位

### 1.1 产品名

**Vaultwright**

### 1.2 名称含义

- `Vault`：Obsidian vault 是知识的真实载体。
- `Wright`：工匠、建造者、修复者，强调持续锻造和维护。
- 隐含含义：让 vault 变得正确、有序、可追溯、可生长。

### 1.3 英文定位

**Vaultwright — A Codex-native steward for Obsidian vaults.**

### 1.4 中文定位

**Vaultwright：面向 Obsidian vault 的 Codex 原生知识管家。**

### 1.5 产品口号

**Turn your Obsidian vault into a living knowledge system.**

中文表达：

**把你的 Obsidian vault 锻造成会生长的知识系统。**

---

## 2. 当前仓库判断

当前仓库不是 Obsidian 社区插件，而是一个 Codex 本地插件包与 Obsidian vault 工作流 runtime。

当前应保留的核心形态：

- `skills/`：Codex skills 源。
- `plugins/vaultwright/`：repo-local Codex plugin package。
- `plugins/vaultwright/.codex-plugin/plugin.json`：Codex 插件 manifest。
- `plugins/vaultwright/commands/`：Codex 命令入口。
- `lib/obsidian_knowledge_shared/`：共享 runtime。
- `scripts/`：安装、检查、上下文加载、session、distill 等辅助脚本。

当前已有核心流程：

- `init`：初始化 Obsidian vault 中的最小知识系统。
- `ingest`：将外部资料导入 active vault。
- `refine`：优化已有知识结构。
- `distill`：把一次工作沉淀为 session、日志和项目状态。
- `doctor`：检查 active vault、skills、plugin 安装状态。
- `setup`：安装/检查 global AGENTS knowledge hint。
- `start`：加载启动上下文。

当前最大缺口：

- 缺独立 `query` 工作流，导致 Codex 回答问题时没有稳定的查库、聚焦上下文、回填流程。
- 缺知识内容层 `lint` 工作流，当前 doctor 偏环境检查，不检查知识准确性和结构健康。
- 缺 claim-level evidence 模型，来源登记有了，但稳定结论还不能稳定回到 source block。
- 缺 Obsidian-native dashboard，例如 Bases 视图，用于暴露 inbox、unverified claims、stale concepts、knowledge gaps、Codex queue。

---

## 3. 总体演进原则

### 3.1 不推翻现有项目

本次是基于现有插件体系的演进，不是重建。

保留：

- 当前 Codex plugin package 方向。
- 当前 skills / commands / scripts / shared lib 的组织方式。
- 当前 active Obsidian vault 作为操作对象的原则。
- 当前 `00_system`、`01_ai_core`、`02_timeline`、`03_raw`、`04_projects`、`05_knowledge`、`06_experience`、`07_archive` 结构。

### 3.2 Obsidian vault 是唯一知识载体

必须明确：

- 知识载体是当前 active Obsidian vault。
- 文件夹只是 Obsidian 内部导航和归档辅助。
- 不在 vault 外建立单独的 LLM Wiki 目录系统。
- 稳定知识通过 Obsidian notes、Properties、wikilinks、block references、index/log、Bases/Dataview dashboard 承载。

### 3.3 Codex 是知识维护者，不是文件系统管理员

Codex 应该：

- 先读取 active vault 的系统规则和上下文。
- 根据任务生成聚焦上下文，而不是全库暴力读取。
- 优先更新现有笔记，必要时再创建新笔记。
- 对缺证据的结论创建 knowledge gap，而不是编造确定性结论。
- 每次有稳定知识产出时，写入 session/log 或相关知识笔记。

---

## 4. 阶段路线图

## Phase 1：Vaultwright 品牌与 Obsidian-native 边界升级

### 目标

把产品展示名、内部包名、插件名和安装路径统一升级为 Vaultwright / vaultwright。强化全仓库约束：不要脱离 Obsidian vault，不要另起外部 raw/wiki 系统。

### 范围

建议修改这些文件：

- `README.md`
- `README.zh-CN.md`
- `plugins/vaultwright/.codex-plugin/plugin.json`
- `plugins/vaultwright/agents/openai.yaml`
- `scripts/install_global_knowledge_hint.py`
- `lib/obsidian_knowledge_shared/render_core_notes.py`
- `skills/vaultwright-init/SKILL.md`
- `skills/vaultwright-ingest/SKILL.md`
- `skills/vaultwright-refine/SKILL.md`
- `plugins/vaultwright/commands/setup.md`
- `plugins/vaultwright/commands/start.md`
- `plugins/vaultwright/commands/init.md`
- `plugins/vaultwright/commands/ingest.md`
- `plugins/vaultwright/commands/refine.md`
- `plugins/vaultwright/commands/distill.md`
- `plugins/vaultwright/commands/doctor.md`

### 产品文案要求

- 展示名使用 `Vaultwright`。
- 插件、skill、安装路径和文档统一使用 `vaultwright`。
- README 要解释：Vaultwright 是 Codex-native steward for Obsidian vaults。
- README 要明确：当前项目是 Codex 本地插件包，不是 Obsidian community plugin。
- README 要明确：不在 Obsidian vault 外创建独立知识库。

### Manifest 要求

`plugin.json` 需要更新展示层字段：

- `interface.displayName` 使用 `Vaultwright`。
- `interface.shortDescription` 强调 Obsidian vault knowledge stewardship。
- `interface.longDescription` 强调 init / ingest / query / lint / refine / distill 的长期知识闭环。
- `interface.defaultPrompt` 更新为最多三条，包含 active vault、ingest、query/lint/refine 的使用场景。
- 插件内部 `name` 使用 `vaultwright`，并与安装路径和 marketplace 统一。

### Global AGENTS hint 要求

在 global hint 中增加：

- 用户使用 Obsidian knowledge base。
- active Obsidian vault 是知识载体。
- 对知识库相关任务，先用 Obsidian CLI 检测 active vault。
- 不要创建外部 raw/wiki 目录系统。
- 使用 Obsidian notes、Properties、wikilinks、block references、index/log 作为知识模型。

### System note 模板要求

在 `00_system/system.md` 模板中增加 `obsidian_native_contract` 区块：

- 本知识库运行在当前打开的 Obsidian vault 中。
- 文件夹只是 Obsidian 导航辅助，不是外部知识库模型。
- 稳定知识必须保持可审计、可链接、可回溯。
- Codex 不应在 vault 外另建知识层。
- 结构、元数据策略、自动化边界的重大变化需要用户确认。

### 验收标准

- README 中主品牌为 Vaultwright。
- Codex plugin UI 展示名为 Vaultwright。
- 插件包名、skill 名、安装路径与文档引用一致。
- 不存在鼓励“外部 raw/wiki 目录系统”的新文案。
- `scripts/check_codex_plugin.py --json` 通过。
- 执行同步脚本后，plugin package 内的 skills/lib/scripts 与根目录一致。

---

## Phase 2：Query / Context Pack 工作流

### 目标

让 Codex 面对知识库相关问题时，不再只读固定启动上下文，而是生成 Obsidian-native context pack，主动查找相关笔记、source、gap、writeback target，提高知识获取积极性和效率。

### 新增能力

新增 skill：

- `skills/vaultwright-query/SKILL.md`

新增 command：

- `plugins/vaultwright/commands/query.md`

新增脚本：

- `scripts/build_context_pack.py`

新增共享逻辑可放入：

- `lib/obsidian_knowledge_shared/context_pack.py`

### Query 工作流要求

Codex 在 query 模式下应执行：

1. 检测 active Obsidian vault。
2. 读取核心上下文：system、index、active_context、longterm_context、manuals。
3. 根据用户问题生成 context pack。
4. 识别候选 notes、source candidates、knowledge gaps、writeback targets。
5. 只读取高相关候选，而不是全库读取。
6. 回答时优先使用 Obsidian wikilinks 和 source/evidence block links。
7. 如果答案产生稳定知识，建议写入 session、项目页或 `05_knowledge/`。
8. 如果证据不足，创建或建议创建 knowledge-gap task。

### Context Pack Note 要求

context pack 应该是普通 Obsidian note，而不是只存在于终端 JSON。

建议路径：

- `01_ai_core/context_packs/context_<timestamp>.md`

建议属性：

- `type: codex-context-pack`
- `created`
- `updated`
- `query`
- `status: active`
- `source: vaultwright`

建议正文区块：

- User question
- Required operating rules
- Candidate notes
- Source candidates
- Knowledge gaps
- Suggested writeback target
- Notes read by Codex
- Follow-up actions

### Ranking 要求

第一版不需要 embedding。优先使用轻量规则：

- 文件名命中。
- 标题命中。
- frontmatter / Properties 命中。
- tags 命中。
- 最近 session 命中。
- index 中出现。
- active_context 中出现。
- project_overview 中出现。
- 相关 raw/source/register note 命中。

### 验收标准

- `query.md` 命令存在并被插件检查脚本识别。
- `vaultwright-query` skill 存在并被插件检查脚本识别。
- 能在不修改稳定知识页的情况下生成 context pack note。
- context pack 位于 Obsidian vault 内。
- context pack 不要求全库读取。
- context pack 能列出候选 notes、source candidates、knowledge gaps、writeback target。
- README / command docs 中说明 query 的用途。

---

## Phase 3：Knowledge Lint 工作流

### 目标

补齐知识内容层健康检查。`doctor` 负责环境健康，`lint` 负责知识准确性、结构健康、证据完整性。

### 新增能力

新增 skill：

- `skills/vaultwright-lint/SKILL.md`

新增 command：

- `plugins/vaultwright/commands/lint.md`

新增脚本：

- `scripts/lint_knowledge_vault.py`

新增共享逻辑可放入：

- `lib/obsidian_knowledge_shared/knowledge_lint.py`

### Lint 检查项

第一版只做只读检查和报告，不自动修复。

最低检查项：

- pending raw/register sources。
- source/raw note 已 processed 但缺 synthesis_targets。
- `05_knowledge/` 稳定知识页没有 source/evidence。
- claim block 没有 source。
- source 指向的 note 或 block 不存在。
- 断裂 wikilinks。
- stale concepts。
- orphan concepts。
- 重要知识页未出现在 `00_system/index.md`。
- 最近 ingest/refine/distill 没有对应 log trail。

### Report Note 要求

lint 结果应写入 Obsidian note，路径建议：

- `00_system/reports/knowledge_lint_<date_or_timestamp>.md`

报告应包含：

- Summary
- Errors
- Warnings
- Suggestions
- Touched areas
- Suggested next command

### 严重级别

- `error`：会破坏准确性或可追溯性，例如断链、无 source 的 high confidence claim。
- `warning`：需要复核，例如 stale concept、orphan note。
- `info`：优化建议，例如 index 可补充。

### 验收标准

- `lint.md` 命令存在并被插件检查脚本识别。
- `vaultwright-lint` skill 存在并被插件检查脚本识别。
- lint 默认只读。
- lint 可选写入 Obsidian report note。
- lint 不自动改稳定知识页。
- doctor 和 lint 的职责在 README 或 command docs 中有清晰区分。

---

## Phase 4：Evidence / Claim 模型增强

### 目标

把准确性从“source note 级别”提升到 “claim / evidence block 级别”。

### 对 raw register 的增强

当前 `prepare_ingest_source` 和 `ingest_register` 已能创建 raw source register。下一步增强字段：

- `source_id`
- `source_hash`
- `captured_at`
- `extracted_at`
- `snapshot_path`
- `capture_status`
- `distill_status`
- `verification_status`
- `claim_count`
- `synthesis_targets`

### Evidence block 要求

每个 raw/source note 应包含可被 Obsidian block reference 定位的 evidence blocks。

稳定知识页中的关键断言应能链接回：

- raw/source note。
- heading。
- block id。
- claim block。

### Claim 表达建议

优先在普通 Obsidian note 中使用 claim callout 或 inline fields，不要一开始把每个 claim 都拆成独立文件。

Claim 至少包含：

- claim text。
- source。
- status。
- confidence。
- reviewed_at。
- block id。

### 验收标准

- 新建 raw/source register 有 evidence scaffold。
- stable knowledge note 的关键结论可以链接到 source block。
- lint 能识别缺 source 的 claim。
- query 回答能引用 Obsidian note/block 链接。

---

## Phase 5：Obsidian Bases Dashboard

### 目标

让 Codex 的“积极性”通过 Obsidian app 内可见 dashboard 表达出来，不靠 prompt 记忆。

### 新增能力

新增脚本：

- `scripts/render_bases_dashboards.py`

新增 dashboard 文件：

- `00_system/dashboards/knowledge_inbox.base`
- `00_system/dashboards/unverified_claims.base`
- `00_system/dashboards/stale_concepts.base`
- `00_system/dashboards/low_evidence_concepts.base`
- `00_system/dashboards/knowledge_gaps.base`
- `00_system/dashboards/codex_queue.base`

### Dashboard 视图

Knowledge Inbox：

- 展示 `type: raw` 或 source/register notes。
- 过滤 ingest/capture/distill 未完成状态。

Unverified Claims：

- 展示 status 为 unverified 或 pending 的 claim。

Stale Concepts：

- 展示 last_reviewed 过期的 concept notes。

Low Evidence Concepts：

- 展示 source_count 过低的 stable knowledge notes。

Knowledge Gaps：

- 展示 tag 或 type 标记为 gap 的事项。

Codex Queue：

- 展示 status 为 ready-for-codex 的 tasks/notes。

### 验收标准

- dashboard 文件位于 Obsidian vault 内。
- dashboard 读取 note Properties，而不是外部数据库。
- dashboard 不要求用户安装非必要外部服务。
- README 或 manual 中解释如何打开这些 dashboard。

---

## 5. 更新 `check_codex_plugin.py` 的要求

当新增 query/lint 后，结构检查脚本必须同步更新。

需要纳入 expected commands：

- `query.md`
- `lint.md`

需要纳入 expected skills：

- `vaultwright-query`
- `vaultwright-lint`

需要纳入 expected scripts：

- `build_context_pack.py`
- `lint_knowledge_vault.py`

如果新增共享库文件，检查脚本至少要保证 bundled plugin library 存在，具体库文件是否逐个检查可视实现复杂度决定。

验收标准：

- 根目录检查通过。
- plugin package 检查通过。
- 同步后 plugin package 内存在新增 skills、commands、scripts。

---

## 6. 推荐执行顺序

### 第一批任务

执行 Phase 1 和 Phase 2。

原因：

- 先统一品牌和边界，避免后续实现跑偏。
- query/context pack 是提升 Codex 知识获取积极性和效率的关键入口。
- 这两项风险较低，不需要深度改写知识模型。

### 第二批任务

执行 Phase 3。

原因：

- lint 是稳定性和准确性的基础。
- 有了 lint，后续 evidence/claim 模型才有验收工具。

### 第三批任务

执行 Phase 4。

原因：

- evidence/claim 模型会影响 ingest、query、lint、manuals，需要在基础工具稳定后推进。

### 第四批任务

执行 Phase 5。

原因：

- Bases dashboard 是 Obsidian app 内体验增强，应该在数据字段和 lint 规则稳定后落地。

---

## 7. 非目标与禁止事项

本阶段不要做：

- 不要把仓库改成 Obsidian community plugin。
- 不要新增 TypeScript 插件工程结构。
- 不要重命名 `plugins/vaultwright` 路径。
- 不要再引入旧仓库名或旧插件名。
- 不要批量迁移 vault 目录结构。
- 不要删除或重排用户实际 vault 内容。
- 不要让 Codex 默认使用 Computer Use 抓取所有网页。
- 不要让 query 工作流全库暴力读取。
- 不要在没有证据的情况下把结论写入 stable knowledge。
- 不要把临时推理直接沉淀为长期知识。

---

## 8. 验证清单

Codex 完成任务后，需要至少验证：

- 仓库结构检查通过。
- plugin package 同步后检查通过。
- README 英文和中文都能表达 Vaultwright 定位。
- plugin display name 为 Vaultwright。
- global AGENTS hint 不覆盖已有内容，只在缺失时追加。
- init/ingest/refine/distill/doctor/start 文档仍能读通。
- query command 和 skill 存在。
- lint command 和 skill 存在，或在第一批任务未执行 lint 时明确标记为下一阶段。
- 新增脚本不会静默修改用户 vault，除非参数明确要求 apply。
- 所有写入 vault 的内容都在 active vault 内。
- 输出说明列出新增文件、修改文件、未完成项和风险点。

---

## 9. Definition of Done

第一阶段完成时，应该达到：

- `Vaultwright` 成为面向用户的产品名。
- `vaultwright` 成为统一的内部包名、插件名与安装路径名。
- Codex 明确知道 active Obsidian vault 是知识载体。
- Codex 不会被引导去创建外部 raw/wiki 目录系统。
- 本地 Codex 插件包能发现 query 工作流。
- query 能生成 Obsidian-native context pack。
- 检查脚本能覆盖新增命令和 skill。
- 文档中明确下一步是 lint、evidence、dashboard。

完整路线完成时，应该达到：

- Codex 能主动查库：query/context pack。
- Codex 能主动发现问题：lint/dashboard。
- Codex 能保持准确：claim/evidence/source block。
- Codex 能保持稳定：preflight/doctor/lint/safe writeback。
- Codex 能保持高效：不全库读取，只读取相关 notes。
- Obsidian app 仍然是用户浏览、复核、管理知识的主界面。

---

## 10. 给 Codex 的最终任务描述

请在当前仓库内实现 Vaultwright 第一批演进：

1. 将用户展示层品牌、内部包名、插件 package 名和安装路径统一为 `Vaultwright` / `vaultwright`。
2. 强化所有相关文档、global hint、system note 模板中的 Obsidian-native 边界：active vault 是知识载体，不要另建外部 raw/wiki 系统。
3. 新增 `vaultwright-query` skill、`query.md` command 和 context pack 生成能力。
4. context pack 必须写入 active Obsidian vault 内的普通 Markdown note。
5. 更新结构检查脚本，让新增 command/skill/script 被验证。
6. 同步 plugin package。
7. 运行仓库现有检查，输出验证结果。
8. 不要修改用户实际 vault 内容；除非脚本本身是模板或明确的 apply 模式。

完成后请给出：

- 修改摘要。
- 新增文件列表。
- 修改文件列表。
- 已运行的验证。
- 未完成或建议下一阶段处理的事项。
- 任何迁移或清理风险。
