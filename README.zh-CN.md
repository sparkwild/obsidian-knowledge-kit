# obs-wiki

[English README](./README.md)

obs-wiki 是一个 Agent-first 记忆系统：使用 Obsidian vault 作为持久知识层，并使用 Obsidian 插件作为用户审核治理界面。

当前产品线是 Obsidian-native + Agent-first。用户提交 URL / 文件 / 资料分析 / context pack / lint / distill / proposal 都必须从 Agent 发起；Obsidian 插件负责 Review Queue、审核批准、审计、权限、状态和可视化监督；MCP 是 Agent 的主调用接口；Obsidian vault 是唯一长期记忆与知识载体。

## 当前方向

- 产品名：`obs-wiki`
- 插件 id：`obs-wiki`
- Obsidian 插件显示名：`obs-wiki`
- 主产品形态：Agent 操作入口 + Obsidian 治理插件
- Agent 接口：MCP tools、resources、prompts
- 记忆载体：Obsidian vault 中的 notes、Properties、wikilinks、block references、review queue、audit log
- Runtime 职责：索引、召回、context pack、lint preview、source analysis、proposal 生成、approved writeback、权限检查和 audit event 生成
- Obsidian 插件职责：Agent Activity、Review Queue、Audit Log、Memory Inspector、Runtime Status、Permission Policy
- 已从 Obsidian 插件入口移除：Analyze URL、Analyze Local File、Capture Source、Build Context Pack、Run Lint、Run Distill 等资料提交或维护动作。

上一代 Codex 本地插件包、Python runtime、根 skills、benchmark scaffold 和过渡 brief 文档已经从仓库中清理。新的实现工作应放在 `apps/`、`packages/` 和当前 `docs/` 下。

## 验证

```bash
cd /Users/zhangjie/AgentProjects/sparkwild/obs-wiki
npm run verify
```

也可以运行更窄的根 workspace 命令：

```bash
npm run typecheck
npm run build
npm run test
npm run package
```

## 安装 Obsidian 插件

当前插件版本：[`0.1.3`](https://github.com/sparkwild/obs-wiki/releases/tag/0.1.3)。

### 使用 BRAT 进行 Beta 安装

在插件进入 Obsidian 官方社区插件目录之前，有仓库访问权限的测试用户可以通过 BRAT 社区插件安装：

1. 在 Obsidian 中安装并启用 `BRAT`。
2. 执行 `BRAT: Add a beta plugin for testing`。
3. 输入 `sparkwild/obs-wiki`。
4. 在 `设置 -> 第三方插件` 中启用 `obs-wiki`。

如果当前 GitHub 仓库或 Release 对你的账号不可见，请使用下面的 Release 资产手动安装方式。

### 从 Release 资产手动安装

1. 从最新 GitHub Release 下载 `manifest.json`、`main.js`、`styles.css`。
2. 在你的 Obsidian vault 中创建插件目录；如果已存在则跳过：

```text
.obsidian/plugins/obs-wiki/
```

3. 将下载的三个文件放入 `.obsidian/plugins/obs-wiki/`。
4. 重启 Obsidian，或重新加载社区插件。
5. 在 `设置 -> 第三方插件` 中启用 `obs-wiki`。
6. 打开命令面板，根据当前 Obsidian 语言执行 `obs-wiki: 打开 Agent 活动` 或 `obs-wiki: Open agent activity`。

### 本地开发安装

在当前仓库构建并打包插件：

```bash
cd /Users/zhangjie/AgentProjects/sparkwild/obs-wiki
npm run package
```

然后将以下生成文件放入 vault 插件目录：

```text
apps/obsidian-plugin/plugin/manifest.json
apps/obsidian-plugin/plugin/main.js
apps/obsidian-plugin/plugin/styles.css
```

目标目录为：

```text
<your-vault>/.obsidian/plugins/obs-wiki/
```

如果本机安装了 Obsidian CLI，可以用下面的命令验证安装状态：

```bash
obsidian plugin id=obs-wiki
obsidian plugin:reload id=obs-wiki
obsidian dev:errors
```

安装后的插件应显示 id `obs-wiki`、名称 `obs-wiki`、版本 `0.1.3`，并且重载后没有开发者控制台错误。

## 桌面端与移动端声明

Obsidian 插件 manifest 保持 `isDesktopOnly: false`。插件运行时代码只使用 Obsidian 插件 API，不调用 Node.js、Electron、shell 命令、网络 API 或任意本地文件系统 API。

这个声明只适用于 Obsidian 治理插件本身：Agent Activity、Review Queue、Audit Log、Memory Inspector、Runtime Status 和 Permission Policy。MCP server 与 Agent/runtime 流程是独立的本地 Agent 进程，不会打包进移动端插件。

## 产品原则

- Single Agent Operation Entry：URL、文件、资料分析、context pack、lint、distill、proposal 工作都从 Agent 发起。
- Obsidian-native：知识本体始终保存在 vault 中，索引和缓存只是加速层。
- Review-first：Agent 可以提出长期记忆建议，但不能默认静默提交高风险长期记忆。
- Evidence-first：重要结论必须能追溯到 source、evidence block 和 review state。
- Audit-first：Agent 的关键读写必须在 Obsidian 中可见、可解释、可复核。
- MCP-first for agent access：对 Agent 暴露记忆语义工具，而不是任意文件系统操作；MCP server 默认只读，并只提供受控写入工具。
- Human Governance in Obsidian：Obsidian 是审核、批准、拒绝、修订请求、审计、权限和状态界面。

## 行为披露

- 网络：Obsidian 插件不发起网络请求。
- 遥测：Obsidian 插件不收集 analytics、usage metrics 或客户端 telemetry。
- Vault 写入：Obsidian 插件可在用户操作后初始化 obs-wiki 控制文件夹/文件、更新审核队列状态，并在当前 vault 内追加审计事件。
- 外部文件：Obsidian 插件不读取或写入当前 vault 外部的文件。
- Agent/runtime 边界：URL/文件提交、source analysis、context pack、lint、distill 和受保护记忆写回属于 Agent/runtime 流程，不是 Obsidian 插件直接动作。

## 目标架构

```text
Agent / AI Client
Codex / Claude / Cursor / ChatGPT / Local Agent
        ↓ MCP
obs-wiki MCP Server
        ↓
obs-wiki Memory Runtime
        ↓
obs-wiki Obsidian Plugin Bridge
        ↓
Obsidian Vault
        ↓
Human Review / Audit / Correction in Obsidian App
```

## 本机 MCP Runtime 模型

Agent Connection Center 不能生成指向当前仓库 checkout 或 `apps/mcp-server/dist/server.js` 的配置。这个源码路径只属于开发调试细节。

面向用户的连接应使用本机 obs-wiki Runtime/Gateway：

- 首选传输：loopback Streamable HTTP，默认 `http://127.0.0.1:37241/mcp`。
- 兼容 fallback：loopback SSE，默认 `http://127.0.0.1:37241/sse`。
- 已安装 runtime fallback：stdio 命令 `obs-wiki-mcp --vault-root <active vault>`。
- 连接中心应可复制 Codex、Claude Code、Cursor 和通用 MCP 客户端配置。
- 本机 Runtime 负责 vault 访问、权限检查、审计写入和工具暴露；Agent 客户端不应拿到开发仓库路径。

当前 MCP server 仍是 stdio-first。后续连接层里程碑是实现本机 HTTP/SSE Runtime daemon。

## 规划中的仓库结构

```text
obs-wiki/
├─ apps/
│  ├─ obsidian-plugin/
│  ├─ mcp-server/
│  └─ cli/
├─ packages/
│  ├─ core/
│  ├─ schemas/
│  └─ shared/
├─ docs/
├─ tests/
└─ package.json
```

## 第一条实施主线

第一条实施主线来自 [docs/obs_wiki_new_start_plan](./docs/obs_wiki_new_start_plan/00_README.md)：

1. 方向重置与文档落地。
2. 在 `apps/obsidian-plugin/` 新增 Obsidian 插件 scaffold。
3. 实现 vault memory structure 初始化。
4. 实现 Agent Activity 和 Audit UI。
5. 实现 Review Queue。
6. 实现 Source Analysis Request。
7. 实现 Memory Runtime v0。
8. 实现默认只读、带受控写入和 review-gated apply 的 MCP Server MVP。

第一阶段编码目标是一个可构建的 Obsidian 插件 scaffold，至少包含：

- id 为 `obs-wiki` 的 `manifest.json`
- TypeScript 项目配置
- `main.ts`
- ribbon icon
- 仅治理视图和确认式 vault 初始化相关的 command palette 命令
- 可持久化配置的 settings tab
- 基础 ItemView

## 新方向文档

- [方案包 README](./docs/obs_wiki_new_start_plan/00_README.md)
- [产品愿景](./docs/obs_wiki_new_start_plan/01_Product_Vision.md)
- [系统架构](./docs/obs_wiki_new_start_plan/02_System_Architecture.md)
- [知识库与长期记忆模型](./docs/obs_wiki_new_start_plan/03_Knowledge_And_Memory_Model.md)
- [Obsidian 插件设计](./docs/obs_wiki_new_start_plan/04_Obsidian_Plugin_Design.md)
- [Agent Memory API](./docs/obs_wiki_new_start_plan/05_Agent_Memory_API.md)
- [Runtime 与 MCP 设计](./docs/obs_wiki_new_start_plan/06_Runtime_And_MCP_Design.md)
- [分阶段执行计划](./docs/obs_wiki_new_start_plan/07_Phased_Execution_Plan.md)
- [Codex 任务提示词](./docs/obs_wiki_new_start_plan/08_Codex_Task_Prompts.md)
- [验收清单](./docs/obs_wiki_new_start_plan/09_Acceptance_Checklists.md)
- [开放问题](./docs/obs_wiki_new_start_plan/10_Open_Questions.md)
- [第一批调整](./docs/obs_wiki_new_start_plan/12_First_Batch_Adjustment.md)
- [MCP 工具权限矩阵](./docs/MCP_Tool_Permission_Matrix.md)
- [机器可读实施清单](./docs/obs_wiki_new_start_plan/IMPLEMENTATION_MANIFEST.json)

## 仓库边界

- `apps/obsidian-plugin/`：Obsidian 治理插件。
- `apps/mcp-server/`：面向 Agent 的 MCP server。
- `packages/core/`：共享 TypeScript memory/runtime primitives。
- `docs/obs_wiki_new_start_plan/`：当前规划与验收文档。
- `scripts/`：仓库验证脚本。

## 许可证

本项目采用 [MIT License](./LICENSE)。
