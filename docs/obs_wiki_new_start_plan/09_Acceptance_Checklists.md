# obs-wiki 验收清单

## 全局验收

- [ ] 插件名统一为 `obs-wiki`。
- [ ] 不再使用 VaultThread 作为名称。
- [ ] 新方向不是 Codex plugin-first。
- [ ] Obsidian vault 是唯一知识和记忆载体。
- [ ] MCP 是 Agent 主接口。
- [ ] Obsidian 插件是 review / audit / permission UI。
- [ ] Agent 是 URL / 文件 / source analysis / context pack / lint / distill 的唯一操作入口。
- [ ] Obsidian 插件不提供资料提交或维护动作入口。
- [ ] Agent 不能默认静默提交高风险长期记忆。
- [ ] 所有写入有审计记录。
- [ ] 不允许 vault 外路径访问。

## Obsidian Plugin Scaffold

- [ ] `apps/obsidian-plugin/manifest.json` 存在。
- [ ] 插件 id 是 `obs-wiki`。
- [ ] 插件可构建。
- [ ] 插件可加载。
- [ ] SettingsTab 可保存配置。
- [ ] Ribbon icon 存在。
- [ ] Command Palette 命令存在。
- [ ] Command Palette 不包含 Analyze URL / Local File / Current Note / Selection。
- [ ] Command Palette 不包含 Capture Source / Build Context Pack / Run Lint / Run Distill / Create Agent Request。

## Vault Structure

- [ ] 初始化创建 `00_control/`。
- [ ] 初始化创建 `01_inbox/`。
- [ ] 初始化创建 `02_timeline/`。
- [ ] 初始化创建 `03_sources/`。
- [ ] 初始化创建 `04_memory/`。
- [ ] 初始化创建 `05_projects/`。
- [ ] 初始化创建 `06_outputs/`。
- [ ] 初始化创建 `07_archive/`。
- [ ] 重复执行不覆盖已有文件。

## Agent Activity

- [ ] 可显示 agent-task notes。
- [ ] 可显示 recent context packs。
- [ ] 可显示 recent source captures。
- [ ] 可显示 recent proposals。
- [ ] 可显示 audit events。
- [ ] 空状态有引导。

## Review Queue

- [ ] 可读取 pending proposals。
- [ ] 可 approve。
- [ ] 可 reject。
- [ ] 可 defer。
- [ ] 操作写 audit event。
- [ ] 不自动改长期记忆。

## Agent Source Status

- [ ] Agent / MCP 创建的 request 可在 UI 中看到。
- [ ] Source status 显示 source、source_kind、purpose、analysis_mode、status。
- [ ] Obsidian 插件不创建 agent-request。
- [ ] Obsidian 插件不抓取 URL。
- [ ] Obsidian 插件不读取 vault 外本地文件。

## MCP Read-only MVP

- [ ] MCP server 可启动。
- [ ] tools/list 正常。
- [ ] resources/list 正常。
- [ ] prompts/list 正常。
- [ ] `obs_wiki.status` 正常。
- [ ] `obs_wiki.recall` 正常。
- [ ] `obs_wiki.read_note` 正常。
- [ ] 禁止 path traversal。
- [ ] 禁止 `.obsidian/` 读取。
- [ ] 不写 vault。

## Controlled Write MCP

- [ ] `write_context_pack` 只写 `06_outputs/context_packs/`。
- [ ] `write_session_note` 只写 `02_timeline/sessions/`。
- [ ] `capture_source` 只写 `03_sources/`。
- [ ] `propose_memory` 只写 `01_inbox/review_queue/`。
- [ ] 所有写入写 audit。
- [ ] 禁止删除。
- [ ] 禁止 protected memory auto-commit。

## Security

- [ ] 默认 read-only。
- [ ] 写入白名单。
- [ ] 禁止任意 shell。
- [ ] 禁止 secrets 写入。
- [ ] 禁止 vault 外路径。
- [ ] 用户偏好必须显式确认。

## 不做事项确认

- [ ] 不实现完整 AI 聊天作为 MVP。
- [ ] 不自动提交长期偏好。
- [ ] 不批量重构用户 vault。
- [ ] 不强依赖旧 Codex 插件。
- [ ] 不把旧 scripts 当作主要用户入口。
