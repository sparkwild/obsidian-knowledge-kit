# Vaultwright

[English README](./README.md)

Vaultwright 是一个面向 Obsidian vault 的 Codex 原生知识管家。它用于初始化知识库、导入外部资料、构建聚焦上下文包、优化已有知识结构，并让知识库保持可追溯、可审计、可维护。

对于 active vault 内的高频读写，Vaultwright 现在优先走共享的 Obsidian CLI runtime，只有在目标 vault 不是当前活动仓库，或者 CLI 明显做不到时才退回直接文件 I/O。

项目说明：

- 面向用户的产品名是 `Vaultwright`
- 内部包名、插件名和安装路径现在也统一使用 `vaultwright`
- 当前仓库是 Codex 本地插件包与 runtime，不是 Obsidian community plugin
- active Obsidian vault 是唯一知识载体，不在 vault 外另建 raw/wiki 系统

## 仓库结构

```text
vaultwright/
├─ skills/
│  ├─ vaultwright-init/
│  ├─ vaultwright-ingest/
│  ├─ vaultwright-query/
│  └─ vaultwright-refine/
├─ plugins/
│  └─ vaultwright/
│     ├─ .codex-plugin/plugin.json
│     ├─ agents/
│     ├─ assets/
│     ├─ commands/
│     ├─ lib/
│     └─ skills/
└─ lib/
   └─ obsidian_knowledge_shared/
```

## 核心组成

- `vaultwright-init`：初始化 codex-native 知识库骨架。
- `vaultwright-ingest`：将外部资料导入 `03_raw/`，并沉淀为稳定知识。
- `vaultwright-query`：在回答知识问题前生成 Obsidian-native context pack。
- `vaultwright-lint`：检查来源、断链、陈旧知识和日志追溯，不默认自动修复。
- `vaultwright-refine`：优化知识结构、链接边界和状态信息。
- `plugins/vaultwright`：符合 Codex 本地插件标准的自包含插件包。
- `lib/obsidian_knowledge_shared`：共享的 preflight、官方 skill 检查与基础渲染逻辑。

网页导入策略：

- 先走轻量的 URL 正文提取链路。
- 如果网站有反爬、登录墙或强动态渲染，再使用 `Computer Use` 作为人工浏览器 fallback。
- 如果用户机器上 `Computer Use` 未启用、未安装或没有权限，不自动安装，也不静默尝试，只明确提示用户自行开启。

## 开发工作流

同步 plugin 包中的 `skills/` 和 `lib/`：

```bash
python3 scripts/sync_plugin_package.py
```

校验 plugin 包结构：

```bash
python3 scripts/check_codex_plugin.py --json
```

将插件安装到用户本地 Codex 插件目录：

```bash
python3 scripts/install_home_local_plugin.py --json
```

安装完成后，插件会进入官方个人本地路径：

- `~/.codex/plugins/vaultwright`
- `~/.agents/plugins/marketplace.json`

## 知识库工作流

读取当前活动知识库上下文：

```bash
python3 scripts/load_knowledge_context.py --json
```

生成一条 session note 骨架：

```bash
python3 scripts/render_session_skeleton.py --apply --json
```

构建面向问题的 context pack：

```bash
python3 scripts/build_context_pack.py "回答知识库问题前我应该读哪些笔记？" --json
```

运行一轮知识 lint：

```bash
python3 scripts/lint_knowledge_vault.py --json
```

渲染 Obsidian Bases dashboard：

```bash
python3 scripts/render_bases_dashboards.py --json
python3 scripts/render_bases_dashboards.py --apply --json
```

现在的 raw/source register 已补入 `source_id`、`source_hash`、`snapshot_path`、`verification_status`、`claim_count`、`synthesis_targets` 等证据字段，并自动生成 evidence / claim scaffold，供后续 query 与 lint 使用。lint 也会检查 `claim_count` 漂移，以及稳定知识是否仍停留在 note 级来源而不是 block 级证据。

当下游知识页开始引用某条 raw/source register 后，可以用下面的脚本回填它的真实状态：

```bash
python3 scripts/reconcile_source_register.py "03_raw/registers/<register>.md" --json
```

Dashboard 文件会写入 active vault 的 `00_system/dashboards/` 目录，可直接在 Obsidian Bases 中打开。

## 插件命令

- `start`：读取知识库总览、说明书和最近 session，作为会话启动上下文。
- `query`：针对用户问题生成 context pack，只读取高相关候选笔记。
- `doctor`：检查当前 vault、官方 skill、plugin 包和安装环境是否健康。
- `lint`：检查知识内容质量、证据覆盖、断链与陈旧知识。
- `distill`：将本次工作结果回写为 session、日志和项目更新。

## 状态

- 插件已验证可在 Codex UI 中被发现和安装。
- 已提供 home-local 安装路径：`~/.codex/plugins/vaultwright`
- 已提供 home-local marketplace：`~/.agents/plugins/marketplace.json`

## 项目文档

- [English README](./README.md)
- [贡献指南](./CONTRIBUTING.md)
- [安全策略](./SECURITY.md)
- [行为准则](./CODE_OF_CONDUCT.md)

## 许可证

本项目采用 [MIT License](./LICENSE)。
