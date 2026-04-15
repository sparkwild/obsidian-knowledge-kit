# obsidian-knowledge-kit

[English README](./README.md)

- 版本发布：[v0.1.0 预发布版](https://github.com/sparkwild/obsidian-knowledge-kit/releases/tag/v0.1.0)
- 安装（用户本地插件）：`python3 scripts/install_home_local_plugin.py --json`
- 快速开始：
  1. `python3 scripts/install_home_local_plugin.py --json`
  2. `python3 scripts/install_global_knowledge_hint.py --apply --json`
  3. 打开 Codex，使用 `setup`、`doctor`、`start`、`ingest`、`distill`

一个面向 Codex 风格 agent 的 Obsidian 知识工作流工具包。它用于初始化知识库、导入外部资料、优化已有知识结构，并让知识库保持可追溯、可审计、可维护。

## 仓库结构

```text
obsidian-knowledge-kit/
├─ skills/
│  ├─ obsidian-knowledge-init/
│  ├─ obsidian-knowledge-ingest/
│  └─ obsidian-knowledge-refine/
├─ plugins/
│  └─ obsidian-knowledge-kit/
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

- `obsidian-knowledge-init`：初始化 codex-native 知识库骨架。
- `obsidian-knowledge-ingest`：将外部资料导入 `03_raw/`，并沉淀为稳定知识。
- `obsidian-knowledge-refine`：优化知识结构、链接边界和状态信息。
- `plugins/obsidian-knowledge-kit`：符合 Codex 本地插件标准的自包含插件包。
- `lib/obsidian_knowledge_shared`：共享的 preflight、官方 skill 检查与基础渲染逻辑。

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

更新已有的 home-local 安装副本：

```bash
python3 scripts/sync_plugin_package.py
python3 scripts/install_home_local_plugin.py --json --force
```

## 知识库工作流

读取当前活动知识库上下文：

```bash
python3 scripts/load_knowledge_context.py --json
```

生成一条 session note 骨架：

```bash
python3 scripts/render_session_skeleton.py --apply --json
```

在 ingest 前生成来源登记草稿：

```bash
python3 scripts/prepare_ingest_source.py "<source>" --json
```

应用 distill 的回写更新：

```bash
python3 scripts/apply_distill_updates.py "02_timeline/sessions/<session>.md" --summary "<summary>" --apply --json
```

## 插件命令

- `setup`：检查插件安装态，并按需安装最小全局知识库提示。
- `start`：读取知识库总览、说明书和最近 session，作为会话启动上下文。
- `doctor`：检查当前 vault、官方 skill、plugin 包和知识库环境是否健康。
- `init`：初始化活动中的 Obsidian 知识库骨架。
- `ingest`：从本地文件、目录或 URL 进入 raw-to-knowledge 流程。
- `refine`：在不静默改结构的前提下优化知识库。
- `distill`：将本次工作结果回写为 session、日志和项目更新。

## 状态

- 插件已验证可在 Codex UI 中被发现和安装。
- 已提供 home-local 安装路径：`~/plugins/obsidian-knowledge-kit`
- 已提供 home-local marketplace：`~/.agents/plugins/marketplace.json`

## 项目文档

- [English README](./README.md)
- [贡献指南](./CONTRIBUTING.md)
- [安全策略](./SECURITY.md)
- [行为准则](./CODE_OF_CONDUCT.md)

## 许可证

本项目采用 [MIT License](./LICENSE)。
