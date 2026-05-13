# obs-wiki UI 与 Agent 连接控制台升级方案包

版本：2026-05-13  
目标执行者：本地 Codex App  
适用仓库：`sparkwild/obs-wiki`  
任务性质：方案文档 + 分批开发计划，不包含实现代码。

## 本方案解决什么

当前 obs-wiki 已经完成从旧 Codex plugin-first 到 **Obsidian-native + Agent-first** 方向的重置，但 Obsidian 插件界面仍偏 scaffold：

- Agent Activity 页面信息层级弱；
- Review Queue 还没有形成真正的治理台体验；
- 缺少 Agent Connection Center，用户安装插件后仍需要回到 Agent 对话中询问如何连接；
- MCP server 已经存在 read/write 工具雏形，但连接状态、tool call 追踪、权限矩阵在 Obsidian 中不可见；
- `main.ts` 已经承载较多逻辑，需要在 UI 升级时逐步拆分。

## 方案包内容

- `01_UI_AND_AGENT_CONNECTIONS_PLAN.md`：完整产品与技术方案。
- `02_CODEX_EXECUTION_PROMPTS.md`：可直接复制给 Codex 的分批执行提示词。
- `03_ACCEPTANCE_CHECKLIST.md`：验收清单。
- `04_CLIENT_AUTO_CONFIGURATION_PLAN.md`：MCP 客户端自动配置计划。
- `IMPLEMENTATION_MANIFEST.json`：任务清单元数据。

## 核心边界

1. 插件 id 保持 `obs-wiki`，用户可见显示名使用 `知识库` / `Obswiki`。
2. Agent 是唯一操作入口：URL / 文件提交、source analysis、context pack、lint、distill、proposal generation 都由 Agent 通过 MCP 发起。
3. Obsidian 插件是人类治理入口：Activity、Review Queue、Audit、Runtime Status、Permission Policy、Agent Connections。
4. Obsidian 插件不提供 Analyze URL / Analyze File / Capture Source / Build Context Pack / Run Lint / Run Distill 入口。
5. Obsidian 插件可以提供 Review Queue 审核动作：Approve、Reject、Defer、Request Revision、Apply Approved Writeback。
6. 新增 Agent Connection Center，用于生成连接配置、追踪已连接 Agent、展示 recent tool calls、权限状态和故障诊断。
7. 后续自动配置能力必须由用户在 Obsidian 中主动确认，不允许 Agent 触发或静默写入客户端配置。
