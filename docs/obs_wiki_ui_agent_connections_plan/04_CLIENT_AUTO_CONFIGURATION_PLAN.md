# obs-wiki MCP 客户端自动配置计划

版本：2026-05-13  
适用范围：obs-wiki Obsidian 插件的 AI 助手连接中心  
当前批次：文档与验收清单收敛，不实现代码。

## 目标

obs-wiki 连接中心需要从“复制连接配置”升级为“本机连接管理台”。用户打开 Obsidian 插件后，应能直接完成以下动作：

- 查看本机连接服务是否可用。
- 选择 Codex、Claude Code、Claude Desktop、Cursor 或其他工具。
- 预览将写入的连接配置。
- 用户确认后写入或更新对应客户端配置。
- 打开客户端配置文件检查结果。
- 检测连接是否可用。
- 移除 obs-wiki 连接配置。

这个能力借鉴两类成熟模式：

- Docker MCP Toolkit：使用 profile 和 gateway 管理一组本机 MCP server，并通过 `docker mcp client connect <client>` 写入客户端配置。
- JetBrains MCP Server：在 IDE 设置页里提供 Enable Server、Clients Auto-Configuration、Open Client Settings File、Copy Config 和 Restart flow。

## 产品边界

1. 插件名称和 MCP server 名保持 `obs-wiki`。
2. Agent 仍是唯一操作入口。URL、文件、资料分析、上下文整理、结构检查、会话沉淀和记忆提案都由 Agent 发起。
3. Obsidian 插件只负责连接、状态、审核、权限、记录和批准动作。
4. Obsidian 插件不新增 Analyze URL、Analyze File、Capture Source、Build Context Pack、Run Lint、Run Distill 等维护入口。
5. 自动配置只能由用户在 Obsidian 中主动触发，不暴露为 MCP 工具，也不允许 Agent 远程调用。

## 连接原则

- 不生成指向项目源码目录的配置，例如不指向 `apps/mcp-server/dist/server.js`。
- 首选本机 Streamable HTTP 地址：`http://127.0.0.1:37241/mcp`。
- SSE 地址 `http://127.0.0.1:37241/sse` 仅用于兼容旧客户端。
- stdio 命令 `obs-wiki-mcp --vault-root <current knowledge base>` 仅作为客户端不支持本机地址时的兜底。
- 本机服务必须绑定 `127.0.0.1`，不能默认监听 `0.0.0.0`。
- 后续实现 HTTP 传输时必须校验 `Origin`，降低 DNS rebinding 风险。

## 用户流程

1. 用户打开 `AI 助手连接`。
2. 插件检测当前知识库路径和本机连接服务状态。
3. 插件列出支持的 AI 工具卡片。
4. 每个卡片显示当前状态：未检测到、未配置、已配置、需要更新、需要重启、不支持自动配置。
5. 用户点击“自动配置”。
6. 插件展示写入位置、配置差异和影响说明。
7. 用户确认后，插件备份原配置并只合并 `obs-wiki` 配置块。
8. 插件提示用户重启对应 AI 工具。
9. 用户可点击“打开配置文件”“检测连接”或“移除连接”。

移动端或不支持本机文件写入的平台只显示复制配置和使用说明，不显示自动写入按钮。

## 客户端注册表

| 客户端 | 默认连接方式 | 检测方式 | 写入策略 | 移除策略 | 验证提示 |
| --- | --- | --- | --- | --- | --- |
| Codex | Streamable HTTP | 检测 `~/.codex/config.toml` | 合并 `[mcp_servers.obs-wiki]` | 只删除 `obs-wiki` server block | 重启 Codex 后检查 MCP server 列表 |
| Claude Code | Streamable HTTP | 检测 `claude` 命令是否可用 | 首版只提供命令复制；后续接入官方配置文件路径后再自动写入 | 首版只提供移除说明 | 执行客户端自带 MCP list 命令 |
| Claude Desktop | Streamable HTTP，stdio 兜底 | 检测 macOS 配置文件路径 | 合并 `mcpServers.obs-wiki` | 只删除 `mcpServers.obs-wiki` | 重启 Claude Desktop |
| Cursor | Streamable HTTP | 检测用户级或工作区级 MCP 配置 | 合并 `mcpServers.obs-wiki` | 只删除 `mcpServers.obs-wiki` | 重启 Cursor 并查看 MCP 设置页 |
| Custom | Streamable HTTP 或 stdio | 不检测 | 只复制配置 | 不自动移除 | 用户按目标工具文档验证 |

首版自动写入只覆盖路径明确、格式可安全解析的客户端。路径不明确或需要调用客户端命令的场景，先提供复制配置和清晰提示。

## 配置状态

内部状态建议使用以下枚举：

| 状态 | 含义 | 用户文案方向 |
| --- | --- | --- |
| `not_detected` | 未发现客户端或配置文件 | 未检测到这个工具 |
| `not_configured` | 未发现 obs-wiki 配置 | 尚未连接 obs-wiki |
| `configured` | 已配置且内容匹配 | 已连接 |
| `needs_update` | 已配置但地址或命令不是当前推荐值 | 需要更新连接信息 |
| `needs_restart` | 刚写入配置，等待客户端重启 | 已写入，请重启工具 |
| `unsupported` | 当前平台或客户端不支持自动写入 | 请复制配置手动添加 |

## 配置生成

连接中心应集中生成配置，UI 不直接拼接配置文本。

建议内部类型：

```ts
type ConnectionTransport = 'streamable-http' | 'sse' | 'stdio';

interface GeneratedClientConfig {
  clientId: string;
  transport: ConnectionTransport;
  displayName: string;
  configText: string;
  targetPath?: string;
  restartRequired: boolean;
}

interface ClientProfile {
  id: string;
  displayName: string;
  supportsAutoConfigure: boolean;
  preferredTransport: ConnectionTransport;
}
```

Codex 推荐配置：

```toml
[mcp_servers.obs-wiki]
url = "http://127.0.0.1:37241/mcp"
```

Claude Desktop / Cursor / Custom 推荐配置：

```json
{
  "mcpServers": {
    "obs-wiki": {
      "url": "http://127.0.0.1:37241/mcp"
    }
  }
}
```

stdio 兜底配置：

```json
{
  "mcpServers": {
    "obs-wiki": {
      "command": "obs-wiki-mcp",
      "args": ["--vault-root", "<current knowledge base>"]
    }
  }
}
```

## 安全写入流程

自动配置必须遵循以下步骤：

1. 检查当前平台是否支持本机文件访问。
2. 定位目标客户端配置文件。
3. 读取配置文件；不存在时创建空配置模型。
4. 使用结构化解析；解析失败时不写入，提示用户修复或手动复制配置。
5. 生成变更预览，只展示 `obs-wiki` 相关差异。
6. 用户确认后，创建同目录备份文件。
7. 只合并或替换 `obs-wiki` 配置块，不改动其他 server。
8. 写入临时文件后原子替换目标文件。
9. 写入插件审计事件。
10. 提示用户重启对应客户端。

移除配置必须同样只删除 `obs-wiki` 配置块，不删除其他 MCP server，也不删除整个配置文件。

## 审计事件

建议新增本地审计事件，不通过 MCP 暴露：

| 事件 | 触发时机 | 记录内容 |
| --- | --- | --- |
| `client_config_previewed` | 用户打开配置预览 | client、target_path、transport |
| `client_config_applied` | 用户确认写入成功 | client、target_path、transport、backup_path |
| `client_config_removed` | 用户确认移除成功 | client、target_path |
| `client_config_failed` | 检测、解析、写入或移除失败 | client、safe_error_code |

审计事件不得记录完整配置内容、用户 token、cookie、authorization、api_key、password 或其他敏感值。

## 实施批次

### Batch 0：文档收敛

- 新增本文件。
- 更新计划包 README、验收清单和 manifest。
- 不修改插件代码。

### Batch A：连接服务状态检测

- 检测 `http://127.0.0.1:37241/mcp` 是否可访问。
- 区分服务未运行、可连接、配置存在但需重启、配置过期。
- 移动端显示“不支持本机自动配置”。

### Batch B：客户端配置注册表

- 抽象 Codex、Claude Code、Claude Desktop、Cursor、Custom 的配置生成。
- UI 从注册表读取客户端名称、连接方式、配置文本和支持能力。
- 保留复制配置能力。

### Batch C：安全写入与移除

- 桌面端实现配置预览、用户确认、备份、结构化合并、移除。
- 解析失败、只读文件、路径缺失时给出可理解错误提示。
- 只处理 `obs-wiki` 配置块。

### Batch D：连接中心 UI 完善

- 客户端卡片显示状态、主要动作和说明。
- 增加“打开配置文件”“检测连接”“移除连接”。
- 最近连接和最近使用记录继续从审计文件读取。
- 权限说明保持用户可理解，不展示内部工具名。

### Batch E：验证覆盖

- 为配置生成和合并逻辑增加 fixture 测试。
- 覆盖空配置、已有其他 server、旧 obs-wiki 配置、损坏 JSON/TOML、只读文件。
- 完成插件 typecheck、build、package 和 MCP server smoke 验证。

## 验收标准

- 用户能在连接中心看到每个支持客户端的连接状态。
- 用户能预览自动配置要写入的内容。
- 自动写入前必须明确确认。
- 自动写入会创建备份。
- 自动移除只删除 `obs-wiki` 配置。
- 配置解析失败时不会覆盖用户文件。
- 移动端不会出现无法使用的自动配置按钮。
- Obsidian 插件仍不提供资料提交和维护动作入口。

## 非目标

- 不实现完整 background daemon。
- 不实现 Docker profile 管理。
- 不让 Agent 触发客户端配置写入。
- 不通过插件执行任意 shell 命令。
- 不访问当前知识库以外的用户文件，除非用户主动选择自动配置并确认目标配置文件。
