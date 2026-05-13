# obs-wiki 验收清单

## 全局验收

- [x] 插件 id 保持 `obs-wiki`；用户可见显示名与 id 分离。
- [x] 不再使用 VaultThread 作为名称。
- [x] 新方向不是 Codex plugin-first。
- [x] Obsidian vault 是唯一知识和记忆载体。
- [x] MCP 是 Agent 主接口。
- [x] Obsidian 插件是 review / audit / permission UI。
- [x] Agent 是 URL / 文件 / source analysis / context pack / lint / distill 的唯一操作入口。
- [x] Obsidian 插件不提供资料提交或维护动作入口。
- [x] Agent 不能默认静默提交高风险长期记忆。
- [x] 所有写入有审计记录。
- [x] 不允许 vault 外路径访问。

## Obsidian Plugin Scaffold

- [x] `apps/obsidian-plugin/manifest.json` 存在。
- [x] 插件 id 是 `obs-wiki`。
- [x] 插件列表展示名是 `Obswiki`；插件内部中文显示名是 `知识库`，英文显示名是 `Obswiki`。
- [x] 插件可构建。
- [x] 插件可加载。
- [x] SettingsTab 可保存配置。
- [x] Ribbon icon 存在。
- [x] Command Palette 命令存在。
- [x] Command Palette 不包含 Analyze URL / Local File / Current Note / Selection。
- [x] Command Palette 不包含 Capture Source / Build Context Pack / Run Lint / Run Distill / Create Agent Request。

## Vault Structure

- [x] 初始化创建 `00_control/`。
- [x] 初始化创建 `01_inbox/`。
- [x] 初始化创建 `02_timeline/`。
- [x] 初始化创建 `03_sources/`。
- [x] 初始化创建 `04_memory/`。
- [x] 初始化创建 `05_projects/`。
- [x] 初始化创建 `06_outputs/`。
- [x] 初始化创建 `07_archive/`。
- [x] 重复执行不覆盖已有文件。

## Agent Activity

- [x] 可显示 agent-task notes。
- [x] 可显示 recent context packs。
- [x] 可显示 recent source captures。
- [x] 可显示 recent proposals。
- [x] 可显示 audit events。
- [x] 空状态有引导。

## Review Queue

- [x] 可读取 pending proposals。
- [x] 可 approve。
- [x] 可 reject。
- [x] 可 defer。
- [x] 操作写 audit event。
- [x] 不自动改长期记忆。

## Agent Source Status

- [x] Agent / MCP 创建的 request 可在 UI 中看到。
- [x] Source status 显示 source、source_kind、purpose、analysis_mode、status。
- [x] Obsidian 插件不创建 agent-request。
- [x] Obsidian 插件不抓取 URL。
- [x] Obsidian 插件不读取 vault 外本地文件。

## MCP Read-only MVP

- [x] MCP server 可启动。
- [x] tools/list 正常。
- [x] resources/list 正常。
- [x] prompts/list 正常。
- [x] `obs_wiki.status` 正常。
- [x] `obs_wiki.recall` 正常。
- [x] `obs_wiki.read_note` 正常。
- [x] 禁止 path traversal。
- [x] 禁止 `.obsidian/` 读取。
- [x] 不写 vault。

## Controlled Write MCP

- [x] `write_context_pack` 只写 `06_outputs/context_packs/`。
- [x] `write_session_note` 只写 `02_timeline/sessions/`。
- [x] `capture_source` 只写 `03_sources/`。
- [x] `propose_memory` 只写 `01_inbox/review_queue/`。
- [x] 所有写入写 audit。
- [x] 禁止删除。
- [x] 禁止 protected memory auto-commit。

## Security

- [x] 默认 read-only。
- [x] 写入白名单。
- [x] 禁止任意 shell。
- [x] 禁止 secrets 写入。
- [x] 禁止 vault 外路径。
- [x] 用户偏好必须显式确认。

## 不做事项确认

- [x] 不实现完整 AI 聊天作为 MVP。
- [x] 不自动提交长期偏好。
- [x] 不批量重构用户 vault。
- [x] 不强依赖旧 Codex 插件。
- [x] 不把旧 scripts 当作主要用户入口。
