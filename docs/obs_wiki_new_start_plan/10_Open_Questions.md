# 需要继续沟通的问题

这些问题不阻塞 Phase 0 / Phase 1，但会影响后续设计。

## 1. 技术栈确认

推荐：TypeScript monorepo。

需要确认：

- 是否长期使用 npm workspace？
- 是否接受 SQLite 作为本地索引？
- 是否先不引入 Rust/Go？

## 2. Obsidian 插件发布策略

选项：

1. 先 GitHub release 手动安装。
2. 用 BRAT 测试。
3. 后期提交 Obsidian Community Plugins。

建议：MVP 用 GitHub release / BRAT，稳定后再社区发布。

## 3. MCP 生命周期

默认建议：Agent-session stdio。

需要确认是否也要第一版支持 background daemon。

建议：第一版不做 background daemon。

## 4. Source Analysis 能力范围

MVP 支持：

- URL 登记。
- Markdown / TXT 文件。
- 当前 note。
- 当前选区。

需要确认 PDF 是否第一版支持。

建议：PDF 放 Phase 9 或以后。

## 5. 是否内置 LLM Provider

选择：

1. MVP 不内置 LLM，只做 Agent/MCP 接口。
2. 插件内置 provider settings。
3. Runtime 支持 OpenAI-compatible API。

建议：MVP 不内置模型，只做 Agent-first MCP。

## 6. 用户偏好记忆策略

需要确认：是否任何 preference memory 都必须手动批准？

建议：必须手动批准，且可过期、可撤销。

## 7. 插件显示名称

已确定：

- Display Name: `Wiki Console`
- Chinese UI Name: `知识库控制台`
- Plugin ID: `obs-wiki`
- MCP Prefix: `obs_wiki`
- CLI: `obs-wiki`

说明：`obs-wiki` 保留为稳定 id、目录名、MCP/CLI 命名和仓库名；Obsidian 展示层使用 `Wiki Console` / `知识库控制台`。

## 8. 第一版目标用户

选择：

1. 只服务用户自己的 Codex/Claude/Cursor Agent。
2. 面向通用 Obsidian 用户。
3. 先内部实验，再产品化。

建议：先内部实验，服务 Agent-first 记忆需求。
