# 验收清单

## UI 验收

- [ ] Agent Activity 有 header、status bar、metric cards、timeline。
- [ ] 空状态不再只是“还没有 xxx”，而是说明原因和 Agent 应调用的工具。
- [ ] Review Queue 有 filter tabs。
- [ ] Review Queue proposal card 显示 kind / risk / status / target / evidence count / task id / created time。
- [ ] Review Queue 只保留治理动作，不出现 source submission 或 maintenance actions。
- [ ] Agent Connections view 存在。
- [ ] Agent Connections 可生成 Codex / Claude / Cursor / Custom MCP 配置。
- [ ] Agent Connections 可显示 current vault root 和 MCP command。
- [ ] Agent Connections 有 troubleshooting empty state。
- [ ] Agent Connections 可显示每个支持客户端的配置状态。
- [ ] Agent Connections 可打开客户端配置文件，或在不支持时显示手动说明。
- [ ] 样式使用 Obsidian CSS variables。

## 客户端自动配置验收

- [ ] 自动配置入口只在桌面端和支持的客户端上显示。
- [ ] 自动配置前展示目标配置文件和 obs-wiki 配置预览。
- [ ] 用户确认后才写入配置。
- [ ] 写入前创建同目录备份。
- [ ] 写入时只合并或替换 `obs-wiki` 配置块。
- [ ] 移除连接时只删除 `obs-wiki` 配置块。
- [ ] 已有其他 MCP server 不被修改或删除。
- [ ] 配置文件损坏、只读或路径缺失时不会覆盖原文件。
- [ ] 移动端显示复制配置和使用说明，不显示自动写入按钮。
- [ ] 自动配置、移除和失败事件写入本地审计记录，且不记录敏感配置内容。

## 边界验收

- [ ] 插件不提供 Analyze URL。
- [ ] 插件不提供 Analyze Local File。
- [ ] 插件不提供 Capture Source。
- [ ] 插件不提供 Build Context Pack。
- [ ] 插件不提供 Run Lint。
- [ ] 插件不提供 Run Distill。
- [ ] 用户仍通过 Agent 客户端提交资料和任务。
- [ ] Obsidian 插件只做治理、审核、状态、连接、审计。

## MCP 验收

- [ ] initialize 事件可被记录。
- [ ] tools/call 事件可被记录。
- [ ] tool-call audit 不泄漏敏感参数。
- [ ] Agent Connections 能显示 recently seen agents。
- [ ] Agent Connections 能显示 recent tool calls。
- [ ] MCP 工具权限矩阵文档存在。
- [ ] MCP server 文案不再自称纯 read-only，如果已有 controlled write tools。

## 工程验收

- [ ] apps/obsidian-plugin typecheck 通过。
- [ ] apps/obsidian-plugin build 通过。
- [ ] apps/obsidian-plugin package 通过。
- [ ] apps/mcp-server typecheck 通过。
- [ ] apps/mcp-server build 通过。
- [ ] apps/mcp-server smoke 通过。
- [ ] 如拆分 main.ts，行为保持不变。
- [ ] 新增文件路径和 README / docs 说明一致。
- [ ] 配置生成和配置合并逻辑有 fixture 覆盖。
- [ ] fixture 覆盖空配置、已有其他 server、旧 obs-wiki 配置、损坏 JSON/TOML、只读文件。

## 非目标确认

- [ ] 没有实现完整 background daemon。
- [ ] 没有重写 core runtime。
- [ ] 没有引入重型 UI 框架。
- [ ] 没有删除 legacy code。
- [ ] 没有新增 Obsidian 中的资料提交入口。
