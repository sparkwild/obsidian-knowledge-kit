# 可复制给 Codex 的任务提示词

## Prompt 0：方向重置

```text
请在当前 obs-wiki 仓库中执行方向重置。当前项目将从旧的 Codex plugin-first 路线转为 Agent-first + Obsidian governance plugin 路线。

要求：
1. 产品名统一为 obs-wiki。
2. 不再使用 VaultThread / Vaultwright 作为新主线名称。
3. 不需要兼容旧 Codex 插件形态。
4. 新定位：obs-wiki 让 Agent 使用 Obsidian vault 作为外置长期记忆库和知识库。
5. Agent 是唯一操作入口：URL / 文件 / source analysis / context pack / lint / distill / proposal 生成都由 Agent 通过 MCP 发起。
6. Obsidian 插件负责 Agent Activity、Review Queue、Audit Log、Memory Inspector、Runtime Status、Permission Policy 和审核批准。
7. MCP Server 是外部 Agent 的主接入方式。
8. Obsidian vault 是唯一知识和记忆载体。
9. Obsidian 插件不提供 Analyze URL、Analyze Local File、Capture Source、Build Context Pack、Run Lint、Run Distill、Create Agent Request 等入口。
10. 先新增/更新文档，不写大规模实现。

请输出：
- 修改摘要
- 新增文档
- 旧结构的处理建议
- 下一阶段建议
```

## Prompt 1：Obsidian 插件 Scaffold

```text
请为 obs-wiki 新增 Obsidian 原生插件 scaffold。

目标：
1. 新增 apps/obsidian-plugin。
2. 插件 id 使用 obs-wiki。
3. 插件 id 使用 obs-wiki，显示名使用 知识库 / Obswiki。
4. TypeScript 实现。
5. 包含 manifest.json、package.json、main.ts、styles.css。
6. 增加设置页。
7. 增加 ribbon icon。
8. 增加命令：Open Agent Activity、Open Review Queue、Open Memory Inspector、Open Audit Log、Open Runtime Status、Open Permission Policy、Refresh Views。
9. 不实现 AI，不实现 MCP，不调用旧 Python runtime。
10. 不实现 Analyze URL / File / Capture Source / Build Context Pack / Run Lint / Distill / Create Agent Request 命令。
11. 所有代码应可构建，结构清晰。

验收：
- npm install / build 指令清楚。
- 插件可复制到 .obsidian/plugins/obs-wiki。
- Settings 能保存配置。
```

## Prompt 2：Vault Memory Structure 初始化

```text
请为 obs-wiki Obsidian 插件实现初始化 vault memory structure 的功能。

需要创建的结构：
00_control, 01_inbox, 02_timeline, 03_sources, 04_memory, 05_projects, 06_outputs, 07_archive。

要求：
1. 不覆盖已有文件。
2. 写入前给 preview 或确认。
3. 写入 memory_policy.md、permissions.md、audit_log.md。
4. 使用 Obsidian Vault API。
5. 写入 audit event。

验收：
- 命令 obs-wiki: Initialize Memory Structure 可用。
- 重复执行不会破坏已有文件。
```

## Prompt 3：Agent Activity + Audit UI

```text
请实现 obs-wiki Obsidian 插件的 Agent Activity View 和 Audit Log 展示。

要求：
1. 新增 AgentActivityView。
2. 读取 02_timeline/agent_tasks/ 下的 agent-task notes。
3. 读取 00_control/audit_log.md 或 00_control/audit/ 下的 audit events。
4. 展示最近任务、最近读写、最近 proposals。
5. 没有数据时显示引导。
6. 不调用 AI。
7. 不自动修改长期记忆。

验收：
- 侧边栏可打开。
- 命令面板可打开。
- UI 能显示 mock 或真实 audit 数据。
```

## Prompt 4：Review Queue

```text
请实现 obs-wiki Review Queue View。

要求：
1. 读取 01_inbox/review_queue/ 下的 memory-proposal notes。
2. 按 approval_status 分组。
3. 支持 approve / reject / defer。
4. 状态更新写回 note frontmatter。
5. 每次操作写入 audit event。
6. 不自动改 04_memory 或 05_projects。

验收：
- 用户能处理 pending proposal。
- 操作可审计。
```

## Prompt 5：Agent Source Status

```text
请实现 Agent source status 只读展示。

要求：
1. 读取 01_inbox/agent_requests/ 下由 Agent / MCP 创建的 request。
2. 显示 source、source_kind、purpose、related_project、analysis_mode、status。
3. 不提供 Analyze URL / Local File / Current Note / Selection 命令。
4. 不创建 agent-request note。
5. 不抓网页登录内容，不调用外部模型。

验收：
- Agent 创建 request 后，Obsidian 中可看到 status。
- Obsidian 插件没有资料提交入口。
```

## Prompt 6：MCP Server Read-only MVP

```text
请实现 obs-wiki MCP Server 的 read-only MVP。

要求：
1. 新增 apps/mcp-server。
2. 暴露 tools/list、resources/list、prompts/list。
3. 实现 tools：
   - obs_wiki.status
   - obs_wiki.start_task
   - obs_wiki.recall
   - obs_wiki.read_note
   - obs_wiki.list_review_queue
   - obs_wiki.audit_recent
4. 默认只读。
5. 禁止读取 vault 外路径。
6. 禁止读取 .obsidian。
7. 不写入 vault。
8. 调用 packages/core，而不是复制业务逻辑。

验收：
- MCP Inspector 可连接。
- tools/resources/prompts 可列出。
- read_note 不能 path traversal。
```

## Prompt 7：受控写入 MCP

```text
请为 obs-wiki MCP Server 增加低风险写入 tools。

Tools：
- obs_wiki.write_context_pack
- obs_wiki.write_session_note
- obs_wiki.capture_source
- obs_wiki.propose_memory

要求：
1. 只允许写入白名单路径。
2. 所有写入写 audit event。
3. 不允许删除。
4. 不允许写入 .obsidian。
5. 不允许自动提交 user preference 或 protected memory。
6. 所有长期记忆只能创建 proposal。

验收：
- 写 context pack 成功。
- 写 proposal 成功。
- 禁止路径被拒绝。
```
