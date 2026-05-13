import {
	JsonRpcErrorObject,
	JsonRpcRequest,
	JsonRpcResponse,
	RpcError,
	isRecord,
} from './protocol';
import {
	callTool,
	toolDefinitions,
	toolPrompts,
	appendConnectionAuditEvent,
	type ToolInvocationContext,
} from './tools';

export const MCP_PROTOCOL_VERSION = '2025-06-18';
export const MCP_SERVER_VERSION = '0.1.0';
export const STREAMABLE_HTTP_TRANSPORT = 'streamable-http';

interface ResourcesResource {
	uri: string;
	name: string;
	title: string;
	description: string;
	mimeType?: string;
}

const RESOURCES: ResourcesResource[] = [
	{
		uri: 'wiki-weaver://system',
		name: 'system',
		title: 'System note',
		description: 'Core system note path if present.',
		mimeType: 'text/markdown',
	},
	{
		uri: 'wiki-weaver://active-context',
		name: 'active-context',
		title: 'Active context',
		description: 'Active-context note for current memory state.',
		mimeType: 'text/markdown',
	},
	{
		uri: 'wiki-weaver://review-queue',
		name: 'review-queue',
		title: 'Review queue',
		description: 'Pending proposal queue snapshots.',
		mimeType: 'text/markdown',
	},
	{
		uri: 'wiki-weaver://agent-activity',
		name: 'agent-activity',
		title: 'Agent activity',
		description: 'Recent agent-task and review traces.',
		mimeType: 'text/markdown',
	},
	{
		uri: 'wiki-weaver://audit/recent',
		name: 'audit-recent',
		title: 'Recent audit',
		description: 'Recent audit log entries.',
		mimeType: 'text/markdown',
	},
];

export interface McpConnectionState {
	sessionId: string;
	agentId: string;
	clientName: string | null;
	initialized: boolean;
}

export interface McpJsonRpcHandlerOptions {
	defaultVaultRoot?: string;
	runtimeVersion?: string;
	transport?: string;
}

export class McpJsonRpcHandler {
	private defaultVaultRoot?: string;
	private runtimeVersion: string;
	private transport: string;

	constructor(options: McpJsonRpcHandlerOptions = {}) {
		this.defaultVaultRoot = options.defaultVaultRoot;
		this.runtimeVersion = options.runtimeVersion || MCP_SERVER_VERSION;
		this.transport = options.transport || STREAMABLE_HTTP_TRANSPORT;
	}

	handleMessage(rawMessage: unknown, state: McpConnectionState): JsonRpcResponse | null {
		if (!isRecord(rawMessage)) {
			return this.errorResponse(null, -32600, 'Invalid request.');
		}

		const request = rawMessage as unknown as JsonRpcRequest;
		const requestId = request.id ?? null;
		const isNotification = request.id === undefined;
		const method = request.method;

		if (typeof method !== 'string' || method.trim() === '') {
			return isNotification ? null : this.errorResponse(requestId, -32600, 'Invalid request: missing method.');
		}

		const params = request.params ?? {};
		if (!isRecord(params)) {
			if (!isNotification) {
				return this.errorResponse(requestId, -32602, 'Invalid params.');
			}
			return null;
		}

		try {
			const result = this.dispatch(method, params, state);
			if (isNotification || method.startsWith('notifications/')) {
				return null;
			}
			return { jsonrpc: '2.0', id: requestId, result };
		} catch (error) {
			if (isNotification || method.startsWith('notifications/')) {
				return null;
			}
			if (error instanceof RpcError) {
				return this.errorResponse(requestId, error.code, error.message, error.data);
			}
			if (error instanceof Error) {
				return this.errorResponse(requestId, -32603, error.message);
			}
			return this.errorResponse(requestId, -32603, 'Internal error.');
		}
	}

	private dispatch(method: string, params: Record<string, unknown>, state: McpConnectionState): unknown {
		switch (method) {
			case 'initialize':
				this.captureConnection(params, state);
				return {
					protocolVersion: MCP_PROTOCOL_VERSION,
					capabilities: {
						tools: { listChanged: false },
						resources: { listChanged: false },
						prompts: { listChanged: false },
					},
					serverInfo: {
						name: 'wiki-weaver-mcp-server',
						title: 'Wiki Weaver MCP Server (read-only default + controlled write + review-gated apply)',
						version: this.runtimeVersion,
					},
					instructions:
						'This MCP server is read-only-by-default; controlled write tools are allowed for bounded working records, and review-gated apply requires approved proposals before protected writeback. All reads and writes are vault-local only, reject vault-outside or .obsidian access, and sensitive payloads are never persisted in audit events.',
				};
			case 'tools/list':
				return { tools: toolDefinitions() };
			case 'tools/call':
				return this.handleToolsCall(params, state);
			case 'resources/list':
				return { resources: RESOURCES };
			case 'prompts/list':
				return { prompts: toolPrompts() };
			case 'notifications/initialized':
				return {};
			case 'ping':
				return {};
			default:
				throw new RpcError({ code: -32601, message: `Method not found: ${method}` });
		}
	}

	private handleToolsCall(params: Record<string, unknown>, state: McpConnectionState): unknown {
		const name = params.name;
		const argumentsValue = params.arguments ?? {};
		if (typeof name !== 'string' || name.trim() === '') {
			throw new RpcError({ code: -32602, message: '`name` is required for tools/call.' });
		}
		if (!isRecord(argumentsValue)) {
			throw new RpcError({ code: -32602, message: '`arguments` must be an object.' });
		}
		const toolInvocationContext: ToolInvocationContext = {
			defaultVaultRoot: this.defaultVaultRoot,
			agentId: state.agentId,
			sessionId: state.sessionId,
			clientName: state.clientName,
			transport: this.transport,
			runtimeVersion: this.runtimeVersion,
		};
		return callTool(name, argumentsValue, toolInvocationContext);
	}

	private captureConnection(params: Record<string, unknown>, state: McpConnectionState): void {
		state.agentId = this.extractAgentIdFromInitialize(params, state.sessionId);
		state.clientName = this.extractClientNameFromInitialize(params);
		state.initialized = true;

		if (!this.defaultVaultRoot) {
			return;
		}

		try {
			appendConnectionAuditEvent(this.defaultVaultRoot, {
				agentId: state.agentId,
				sessionId: state.sessionId,
				clientName: state.clientName,
				transport: this.transport,
				runtimeVersion: this.runtimeVersion,
			});
		} catch {
			// Best-effort audit writes should never fail initialize.
		}
	}

	private extractAgentIdFromInitialize(params: Record<string, unknown>, fallbackSessionId: string): string {
		const clientInfo = isRecord(params.clientInfo) ? (params.clientInfo as Record<string, unknown>) : {};
		const meta = isRecord(params.meta) ? (params.meta as Record<string, unknown>) : {};
		const candidates = [
			params.agent_id,
			params.agentId,
			params.session_id,
			params.sessionId,
			params.client_name,
			params.clientName,
			clientInfo.agent_id,
			clientInfo.agentId,
			clientInfo.session_id,
			clientInfo.sessionId,
			clientInfo.client_name,
			clientInfo.clientName,
			meta.agent_id,
			meta.agentId,
			meta.session_id,
			meta.sessionId,
		];

		for (const candidate of candidates) {
			if (typeof candidate === 'string' && candidate.trim() !== '') {
				return candidate.trim();
			}
		}

		return fallbackSessionId || 'unknown session id';
	}

	private extractClientNameFromInitialize(params: Record<string, unknown>): string | null {
		const clientInfo = isRecord(params.clientInfo) ? (params.clientInfo as Record<string, unknown>) : {};
		const names = [
			params.name,
			params.client_name,
			params.clientName,
			clientInfo.name,
			clientInfo.client_name,
			clientInfo.clientName,
		];

		for (const name of names) {
			if (typeof name === 'string' && name.trim() !== '') {
				return name.trim();
			}
		}

		return null;
	}

	private errorResponse(id: number | string | null, code: number, message: string, data?: unknown): JsonRpcResponse {
		const error: JsonRpcErrorObject = { code, message };
		if (data !== undefined) {
			error.data = data;
		}
		return { jsonrpc: '2.0', id, error };
	}
}
