# obsidian-wiki-weaver

[English README](./README.md)

Wiki Weaver 用来连接 AI 助手与 Obsidian 知识库。AI 助手通过 MCP 读取、整理和准备记忆工作；Obsidian 插件负责给用户提供本地审核界面，包括活动记录、审核队列、权限说明、连接设置和已批准写回。

Obsidian vault 是唯一的长期知识载体。插件本身不直接提交 URL、不分析文件、不运行 lint、不沉淀会话、不抓取来源；这些动作都应从 AI 助手通过 MCP 发起。

## 命名

- 产品名：`Wiki Weaver`
- 仓库名：`obsidian-wiki-weaver`
- Obsidian 插件 id：`wiki-weaver`
- Obsidian 插件显示名：`Wiki Weaver`
- 插件中文界面显示：`知识库`
- MCP server id / 配置键：`wiki-weaver`
- MCP tool 前缀：`wiki_weaver.*`
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

当前项目正在准备提交到 Obsidian 官方社区插件目录。在审核通过前，先使用打包产物手动安装。

### 手动安装

1. 构建插件：

```bash
cd <repo>
npm run package
```

2. 将生成文件复制到 vault 插件目录：

```text
<vault>/.obsidian/plugins/wiki-weaver/
```

需要复制的文件：

```text
apps/obsidian-plugin/plugin/manifest.json
apps/obsidian-plugin/plugin/main.js
apps/obsidian-plugin/plugin/styles.css
```

3. 重启 Obsidian，或重新加载第三方插件。
4. 在 `设置 -> 第三方插件` 中启用 `Wiki Weaver`。
5. 验证安装状态：

```bash
obsidian plugin id=wiki-weaver
obsidian plugin:reload id=wiki-weaver
obsidian dev:errors
```

安装后的插件应显示 id `wiki-weaver`、名称 `Wiki Weaver`、版本 `0.1.0`，并且重载后没有开发者控制台错误。

## 连接模型

Wiki Weaver 不会硬编码 vault 路径、仓库 checkout 路径或开发者电脑路径。它会内置本机 Runtime 的 loopback 默认连接地址。

- Vault 路径：运行时读取当前 Obsidian vault。
- MCP URL：默认 `http://127.0.0.1:58437/mcp`，可在插件设置中修改。
- SSE URL：默认 `http://127.0.0.1:58437/sse`，用于旧客户端，可在插件设置中修改。
- stdio 命令：可配置，默认命令名为 `wiki-weaver-mcp`。
- 客户端配置写入：必须由用户确认，写入前备份，并且只处理 `wiki-weaver` 这个 MCP server 配置块。

除非你的本机 Runtime 使用了其它地址或端口，否则保持默认 loopback 地址即可。设置页会为自定义文本和连接参数提供恢复默认功能。

## 产品边界

- URL / 文件提交、source analysis、context pack、lint、distill、memory proposal 都从 AI 助手发起。
- Obsidian 插件是用户治理界面：Agent Activity、Review Queue、Audit Log、Memory Inspector、Runtime Status、Permission Policy、Agent Connections。
- 长期记忆、用户偏好、重要项目决策和高置信 claim 默认先进入 Review Queue。
- 已批准写回由 Runtime 执行，并写入审计记录。
- 插件不读取或写入当前 vault 之外的文件；只有用户在连接中心明确确认时，才会修改对应 AI 工具的客户端配置文件。

## 仓库结构

```text
obsidian-wiki-weaver/
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

## 社区发布

提交社区插件目录前：

- 运行 `npm run verify`。
- 创建与 `manifest.json` 版本号完全一致的 GitHub release tag。
- 将 `main.js`、`manifest.json`、`styles.css` 作为独立 release assets 上传。
- 使用下面的社区条目：

```json
{
	"id": "wiki-weaver",
	"name": "Wiki Weaver",
	"author": "sparkwild",
	"description": "Compile raw notes, sources, and AI conversations into a linked Markdown wiki with reviewable updates.",
	"repo": "sparkwild/obsidian-wiki-weaver"
}
```

## 许可证

本项目采用 [MIT License](./LICENSE)。
