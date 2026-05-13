# Codex 执行提示词

## Prompt A：UI Design System + Agent Activity Dashboard

```text
请基于当前 obs-wiki main 分支优化 Obsidian 插件界面，执行 Batch A。

请先读取：
- README.md
- docs/obs_wiki_new_start_plan/12_First_Batch_Adjustment.md
- apps/obsidian-plugin/src/main.ts
- apps/obsidian-plugin/styles.css
- apps/obsidian-plugin/package.json

核心边界：
1. 插件 id 保持 obs-wiki，用户可见显示名使用 知识库 / Obswiki。
2. Agent 是唯一操作入口。
3. 不要新增 Analyze URL / Analyze File / Capture Source / Build Context Pack / Run Lint / Run Distill 等 Obsidian 插件入口。
4. Obsidian 插件可以作为治理界面展示 Agent Activity、Review Queue、Audit、Runtime、Permission、Agent Connections。

本批任务：
1. 扩展 styles.css，增加 obs-wiki design system：
   - shell/header/status-bar/badge/card/metric/timeline/empty-state/filter-tabs/action-row/detail-panel
2. 优化 Agent Activity View：
   - 顶部 header
   - status bar
   - metric cards
   - activity timeline
   - better empty states
3. 不改变 Agent Activity 的数据来源。
4. 如 main.ts 过大，可先只做轻量拆分 constants.ts。
5. 保证 typecheck/build/package 通过。

验证：
npm run --prefix apps/obsidian-plugin typecheck
npm run --prefix apps/obsidian-plugin build
npm run --prefix apps/obsidian-plugin package

输出：
- 修改摘要
- UI 变化说明
- 新增/修改文件
- 验证结果
- 未完成项
```

## Prompt B：Review Queue UI

```text
请执行 Batch B：优化 obs-wiki Review Queue UI。

目标：
把 Review Queue 从简单列表升级为 human governance 工作台。

任务：
1. 增加 filter tabs：Pending / Approved / Rejected / Revision Requested / Applied / All。
2. 将 proposals 渲染为 proposal cards。
3. 显示 proposal kind、risk level、approval status、target note、evidence count、task id、created time、snippet。
4. 保留治理动作：
   - Approve
   - Reject
   - Defer
   - Request Revision
   - Apply Approved Writeback
5. 不新增 source submission / analysis / context / lint / distill 入口。
6. 使用 Obsidian CSS variables。
7. 保证 typecheck/build/package 通过。

输出：
- 修改摘要
- UI 变化说明
- 验证结果
```

## Prompt C：Agent Connection Center MVP

```text
请执行 Batch C：新增 obs-wiki Agent Connection Center MVP。

背景：
用户安装 Obsidian 插件后，不应再回到 Agent 对话中询问如何连接。obs-wiki 插件需要提供 Agent 连接控制台，生成 MCP 配置、追踪 recently seen agents、显示 recent tool calls、展示权限状态和 troubleshooting。

请先读取：
- README.md
- apps/obsidian-plugin/src/main.ts
- apps/obsidian-plugin/styles.css
- apps/mcp-server/src/server.ts
- apps/mcp-server/src/tools.ts
- docs/obs_wiki_new_start_plan/12_First_Batch_Adjustment.md

任务：
1. 新增 Agent Connections view。
2. 新增命令：Open Agent Connections。
3. 视图显示：
   - runtime mode
   - current vault root
   - MCP server command/config
   - Copy Codex config
   - Copy Claude config
   - Copy Cursor config
   - Custom config
   - recently seen agents
   - recent tool calls
   - troubleshooting empty state
4. 不新增 Analyze URL / File / Capture Source 等入口。
5. 如 main.ts 过大，至少将 AgentConnectionsView 抽到独立文件。
6. 扩展 styles.css。
7. 保证插件 typecheck/build/package 通过。

验证：
npm run --prefix apps/obsidian-plugin typecheck
npm run --prefix apps/obsidian-plugin build
npm run --prefix apps/obsidian-plugin package

输出：
- 修改摘要
- 新增视图说明
- 新增/修改文件
- 验证结果
```

## Prompt D：MCP Connection / Tool-call Audit

```text
请执行 Batch D：为 obs-wiki MCP server 增加 connection / tool-call audit。

目标：
让 Obsidian 插件的 Agent Connections 能显示哪些 Agent 连接过、最近调用了哪些工具。

任务：
1. MCP initialize 时写 connection event 到 audit。
2. tools/call 前后写 tool-call event。
3. 记录字段：
   - agent_id 或 unknown session id
   - client name if available
   - tool_name
   - result_status
   - target_paths
   - timestamp
   - duration_ms
   - risk_level
4. 不要记录完整敏感参数。
5. 对 token、secret、api_key、password、cookie、authorization 等做脱敏。
6. 插件能够读取这些事件并在 Agent Connections / Audit 中展示。
7. 保证 mcp-server typecheck/build/smoke 通过。

验证：
npm run --prefix apps/mcp-server typecheck
npm run --prefix apps/mcp-server build
npm run --prefix apps/mcp-server smoke
npm run --prefix apps/obsidian-plugin typecheck
npm run --prefix apps/obsidian-plugin build

输出：
- 修改摘要
- audit event schema
- 验证结果
```

## Prompt E：MCP Tool Permission Matrix

```text
请执行 Batch E：收敛 MCP 工具权限矩阵。

任务：
1. 新增 docs/MCP_Tool_Permission_Matrix.md。
2. 将工具分为：
   - read-only
   - low-risk write
   - review-gated apply
   - forbidden
3. 更新 apps/mcp-server/package.json description，不要再描述为纯 read-only server。
4. 更新 server initialize instructions，说明 read-only default + controlled write + review-gated apply。
5. 在 Agent Connections 或 Permission Policy 中展示权限矩阵摘要。
6. 所有写入工具必须返回 audit_path。
7. 不改变 Obsidian 插件操作边界。

验证：
npm run --prefix apps/mcp-server typecheck
npm run --prefix apps/mcp-server build
npm run --prefix apps/mcp-server smoke
npm run --prefix apps/obsidian-plugin typecheck
npm run --prefix apps/obsidian-plugin build

输出：
- 修改摘要
- 权限矩阵说明
- 验证结果
```
