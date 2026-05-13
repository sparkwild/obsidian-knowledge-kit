# obsidian-obswiki

[English README](./README.md)

Obswiki 用来连接 AI 助手与 Obsidian 知识库。AI 助手通过 MCP 读取、整理和准备记忆工作；Obsidian 插件负责给用户提供本地审核界面，包括活动记录、审核队列、权限说明、连接设置和已批准写回。

Obsidian vault 是唯一的长期知识载体。插件本身不直接提交 URL、不分析文件、不运行 lint、不沉淀会话、不抓取来源；这些动作都应从 AI 助手通过 MCP 发起。

## 命名

- 产品名：`Obswiki`
- 仓库名：`obsidian-obswiki`
- Obsidian 插件 id：`obswiki`
- Obsidian 插件显示名：`Obswiki`
- 插件中文界面显示：`知识库`
- MCP server id / 配置键：`obswiki`
- MCP tool 前缀：`obswiki.*`
- 初始版本号：`0.1.0`

## 验证

```bash
cd <repo>
npm run verify
```

也可以运行更窄的检查：

```bash
npm run typecheck
npm run build
npm run test
npm run package
```

## 安装 Obsidian 插件

当前项目暂不准备上架 Obsidian 官方社区插件目录，先按私有本地插件持续使用。

### 手动安装

1. 构建插件：

```bash
cd <repo>
npm run package
```

2. 将生成文件复制到 vault 插件目录：

```text
<vault>/.obsidian/plugins/obswiki/
```

需要复制的文件：

```text
apps/obsidian-plugin/plugin/manifest.json
apps/obsidian-plugin/plugin/main.js
apps/obsidian-plugin/plugin/styles.css
```

3. 重启 Obsidian，或重新加载第三方插件。
4. 在 `设置 -> 第三方插件` 中启用 `Obswiki`。
5. 验证安装状态：

```bash
obsidian plugin id=obswiki
obsidian plugin:reload id=obswiki
obsidian dev:errors
```

安装后的插件应显示 id `obswiki`、名称 `Obswiki`、版本 `0.1.0`，并且重载后没有开发者控制台错误。

## 连接模型

Obswiki 不会硬编码 vault 路径、仓库 checkout 路径、本机端口或开发者电脑路径。

- Vault 路径：运行时读取当前 Obsidian vault。
- MCP URL：由用户在插件设置中填写。
- SSE URL：只在旧客户端需要时由用户填写。
- stdio 命令：可配置，默认命令名为 `obswiki-mcp`。
- 客户端配置写入：必须由用户确认，写入前备份，并且只处理 `obswiki` 这个 MCP server 配置块。

如果你的本机 runtime 提供了 loopback 地址，可以填写类似 `http://127.0.0.1:<port>/mcp` 的地址。插件会把它视为用户配置，而不是内置默认值。

## 产品边界

- URL / 文件提交、source analysis、context pack、lint、distill、memory proposal 都从 AI 助手发起。
- Obsidian 插件是用户治理界面：Agent Activity、Review Queue、Audit Log、Memory Inspector、Runtime Status、Permission Policy、Agent Connections。
- 长期记忆、用户偏好、重要项目决策和高置信 claim 默认先进入 Review Queue。
- 已批准写回由 Runtime 执行，并写入审计记录。
- 插件不读取或写入当前 vault 之外的文件；只有用户在连接中心明确确认时，才会修改对应 AI 工具的客户端配置文件。

## 仓库结构

```text
obsidian-obswiki/
├─ apps/
│  ├─ obsidian-plugin/
│  └─ mcp-server/
├─ packages/
│  └─ core/
├─ docs/
├─ scripts/
└─ package.json
```

## 文档

- [文档索引](./docs/README.md)
- [架构说明](./docs/ARCHITECTURE.md)
- [Obsidian 插件](./docs/PLUGIN.md)
- [MCP 与权限](./docs/MCP.md)
- [客户端自动配置](./docs/CLIENT_AUTO_CONFIGURATION.md)
- [路线图](./docs/ROADMAP.md)

## 许可证

本项目采用 [MIT License](./LICENSE)。
