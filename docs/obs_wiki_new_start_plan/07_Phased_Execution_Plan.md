# obs-wiki 分阶段执行计划

## 总体原则

这是全新方向，不要求保留旧 Codex 插件方案。Codex 应该优先建立 Obsidian 原生插件 + Agent Memory API 的新主线。

建议先新建分支：

```text
feat/obs-wiki-obsidian-plugin-reset
```

## Phase 0：方向重置与文档落地

目标：明确放弃 Codex plugin-first，转为 Obsidian plugin-first + Agent memory-first。

任务：

1. 更新 README，明确新定位。
2. 新增 docs：Product Vision、Architecture、Memory Model、Agent Memory API。
3. 标记旧 Codex plugin 目录为 legacy 或 archive 候选。
4. 不立即删除旧代码，除非用户明确确认；但不要再以旧结构作为产品主线。

验收：

- README 中不再把 Codex plugin 作为主产品。
- 新主线是 obs-wiki Obsidian plugin。
- 明确 MCP 是 Agent 接口，Obsidian plugin 是审计/复核/权限 UI。

## Phase 1：Obsidian 插件 Scaffold

目标：建立可加载的 Obsidian 原生插件。

任务：

1. 新增 `apps/obsidian-plugin/`。
2. 新增 `manifest.json`，id 使用 `obs-wiki`。
3. 新增 TypeScript 项目配置。
4. 实现 `main.ts`。
5. 添加 ribbon icon。
6. 添加 command palette 命令。
7. 添加 settings tab。
8. 添加基础 ItemView。

验收：

- 插件可构建。
- 插件可放入 `.obsidian/plugins/obs-wiki/` 加载。
- Settings 可保存。
- Ribbon / commands 可见。

## Phase 2：Vault Memory Structure 初始化

目标：插件能初始化 Obsidian vault 的记忆结构。

任务：

1. 实现 `Initialize Memory Structure` 命令。
2. 创建 `00_control`、`01_inbox`、`02_timeline`、`03_sources`、`04_memory`、`05_projects`、`06_outputs`、`07_archive`。
3. 写入 `memory_policy.md`、`permissions.md`、`audit_log.md`。
4. 所有写入必须 preview-first 或确认。

验收：

- 插件能创建最小结构。
- 已存在文件不被静默覆盖。
- 初始化写入 audit event。

## Phase 3：Agent Activity + Audit UI

目标：用户能看到 Agent 读写行为。

任务：

1. 新增 Agent Activity View。
2. 新增 Audit Log View 或集成在 Activity View。
3. 定义 agent-task note schema。
4. 定义 audit-event note schema。
5. 插件能读取并展示最近 agent task / audit event。

验收：

- Obsidian 中能打开 Agent Activity。
- 能展示最近任务和写入记录。
- 没有 Agent 数据时显示引导状态。

## Phase 4：Review Queue

目标：用户能审核 Agent 的 memory proposals。

任务：

1. 新增 Review Queue View。
2. 定义 memory-proposal note schema。
3. 展示 pending / approved / rejected / deferred。
4. 实现 approve / reject / defer 状态更新。
5. 状态更新写 audit event。

验收：

- 用户能处理 pending proposal。
- 操作不直接改长期知识，除非明确 approve commit。
- 所有操作可审计。

## Phase 5：Source Analysis Request

目标：用户可手动指定 URL / 本地文件 / 当前笔记，让 Agent 后续分析。

任务：

1. 新增 Analyze URL command。
2. 新增 Analyze Local File command。
3. 新增 Analyze Current Note command。
4. 创建 agent-request note。
5. request 中包含 source、purpose、project、analysis mode、status。
6. 显示 Source Analysis Queue。

验收：

- 用户输入 URL 后生成 request。
- 用户选择文件后生成 request。
- Agent / MCP 后续能读取 pending requests。

## Phase 6：Memory Runtime v0

目标：实现基础 runtime，不依赖旧 Python scripts。

任务：

1. 新增 `packages/core`。
2. 实现 Markdown / frontmatter parser。
3. 实现 note scan。
4. 实现 block id / wikilink / claim parser。
5. 实现简单 recall。
6. 实现简单 context pack。
7. 实现简单 lint preview。

验收：

- Runtime 能扫描 vault。
- Runtime 能返回相关 notes。
- Runtime 能输出 context pack data。
- Runtime 能识别 broken links / claim without source 的基础问题。

## Phase 7：MCP Server MVP

目标：让外部 Agent 使用 obs-wiki 记忆。

任务：

1. 新增 `apps/mcp-server`。
2. 实现 tools/list。
3. 实现 resources/list。
4. 实现 prompts/list。
5. 实现 tools：
   - `obs_wiki.status`
   - `obs_wiki.start_task`
   - `obs_wiki.recall`
   - `obs_wiki.read_note`
   - `obs_wiki.list_review_queue`
   - `obs_wiki.audit_recent`
6. 默认 read-only。

验收：

- MCP Inspector 可连接。
- tools/resources/prompts 可列出。
- 不写 vault。
- 不能读取 vault 外路径。

## Phase 8：受控写入 MCP

目标：Agent 可写低风险工作记录。

任务：

1. 实现 `obs_wiki.write_context_pack`。
2. 实现 `obs_wiki.write_session_note`。
3. 实现 `obs_wiki.capture_source`。
4. 实现 `obs_wiki.propose_memory`。
5. 所有写入走 permission policy。
6. 所有写入写 audit event。

验收：

- 只允许白名单路径。
- 不提交 protected memory。
- 不允许删除。

## Phase 9：Source Analysis MVP

目标：Agent 能处理用户手动投喂资料。

任务：

1. 读取 pending source analysis requests。
2. 对 URL 创建 source note。
3. 对本地 Markdown/TXT 创建 source note。
4. 提取 summary / evidence scaffold / claim scaffold。
5. 创建 source-analysis report。
6. 创建 memory proposals。

验收：

- 用户投喂 URL / file 后，Agent 能生成 source note + proposals。
- 结果进入 Review Queue。

## Phase 10：Packaging / Tests / Migration Decision

目标：形成可持续开发基础。

任务：

1. 增加测试。
2. 增加 plugin build。
3. 增加 MCP smoke test。
4. 增加 path safety tests。
5. 决策旧 Codex plugin 是 archive 还是删除。

验收：

- CI 或本地测试通过。
- 插件可打包。
- MCP smoke test 通过。
