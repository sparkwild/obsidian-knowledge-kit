# Wiki Weaver

[English README](./README.md)

在 Obsidian 中构建 AI 辅助的 wiki。Wiki Weaver 通过本地 MCP server 把 AI 助手连接到你的 vault，并在写入前由你审核候选知识更新。

## 核心能力

- AI 客户端通过 `wiki_weaver.*` MCP tools 读取 Obsidian 笔记。
- wiki 与长期记忆候选内容先进入 Review Queue，由用户审核后再写回。
- 在 Obsidian 内查看 agent activity、待审核内容、审计日志、runtime 状态和客户端连接。
- 写入范围限制在 vault 内，长期记忆变更必须经过批准。

## 开始使用

Wiki Weaver 正在准备提交到 Obsidian 官方社区插件目录。审核通过前，需要先使用打包产物手动安装。

- [Obsidian 插件设置](./docs/PLUGIN.md)
- [MCP 与权限](./docs/MCP.md)
- [客户端自动配置](./docs/CLIENT_AUTO_CONFIGURATION.md)

## 文档

- [文档索引](./docs/README.md)
- [架构说明](./docs/ARCHITECTURE.md)
- [Obsidian 插件](./docs/PLUGIN.md)
- [MCP 与权限](./docs/MCP.md)
- [客户端自动配置](./docs/CLIENT_AUTO_CONFIGURATION.md)
- [开发与发布说明](./docs/DEVELOPMENT.md)
- [路线图](./docs/ROADMAP.md)

## 致谢

Wiki Weaver 在规划、实现和审阅过程中使用 ChatGPT 与 Codex 作为开发助手。项目也受到 Andrej Karpathy 关于 AI 辅助软件开发的公开文章和演示启发。

这些内容属于致谢，不是 GitHub 贡献者署名、赞助声明或认可背书。

## 许可证

本项目采用 [MIT License](./LICENSE)。
