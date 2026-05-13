import { createInterface } from 'node:readline';
import {
	JsonRpcErrorObject,
	JsonRpcRequest,
	JsonRpcResponse,
	RpcError,
	isRecord,
} from './protocol';
import { callTool, toolDefinitions, toolPrompts } from './tools';

const PROTOCOL_VERSION = '2025-06-18';

interface ResourcesResource {
	uri: string;
	name: string;
	title: string;
	description: string;
	mimeType?: string;
}

const RESOURCES: ResourcesResource[] = [
	{
		uri: 'obs-wiki://system',
		name: 'system',
		title: 'System note',
		description: 'Core system note path if present.',
		mimeType: 'text/markdown',
	},
	{
		uri: 'obs-wiki://active-context',
		name: 'active-context',
		title: 'Active context',
		description: 'Active-context note for current memory state.',
		mimeType: 'text/markdown',
	},
	{
		uri: 'obs-wiki://review-queue',
		name: 'review-queue',
		title: 'Review queue',
		description: 'Pending proposal queue snapshots.',
		mimeType: 'text/markdown',
	},
	{
		uri: 'obs-wiki://agent-activity',
		name: 'agent-activity',
		title: 'Agent activity',
		description: 'Recent agent-task and review traces.',
		mimeType: 'text/markdown',
	},
	{
		uri: 'obs-wiki://audit/recent',
		name: 'audit-recent',
		title: 'Recent audit',
		description: 'Recent audit log entries.',
		mimeType: 'text/markdown',
	},
];

interface ServerConfig {
	defaultVaultRoot?: string;
}

class StdioMcpServer {
	private defaultVaultRoot?: string;

	constructor(config: ServerConfig) {
		this.defaultVaultRoot = config.defaultVaultRoot;
	}

	public run(): void {
		const reader = createInterface({
			input: process.stdin,
			terminal: false,
			crlfDelay: Number.POSITIVE_INFINITY,
		});

		reader.on('line', (line: string) => {
			if (line.trim() === '') {
				return;
			}
			this.handleLine(line);
		});
	}

	private handleLine(line: string): void {
		let parsed: unknown;
		try {
			parsed = JSON.parse(line);
		} catch (error) {
			if (error instanceof Error) {
				this.writeResponse(this.errorResponse(null, -32700, error.message));
				return;
			}
			this.writeResponse(this.errorResponse(null, -32700, 'Invalid JSON.'));
			return;
		}

		if (Array.isArray(parsed)) {
			for (const message of parsed) {
				const response = this.handleMessage(message);
				if (response) {
					this.writeResponse(response);
				}
			}
			return;
		}

		const response = this.handleMessage(parsed);
		if (response) {
			this.writeResponse(response);
		}
	}

	private handleMessage(rawMessage: unknown): JsonRpcResponse | null {
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
			const result = this.dispatch(method, params);
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

	private dispatch(method: string, params: Record<string, unknown>): unknown {
		switch (method) {
			case 'initialize':
				return {
					protocolVersion: PROTOCOL_VERSION,
					capabilities: {
						tools: { listChanged: false },
						resources: { listChanged: false },
						prompts: { listChanged: false },
					},
					serverInfo: {
						name: 'obs-wiki-mcp-server',
						title: 'obs-wiki MCP Server (read-only default + controlled write)',
						version: '0.1.0',
					},
					instructions:
						'This MCP server is read-only by default and supports controlled write tools for low-risk working records. All reads and writes are scoped to vault-local paths, reject vault-outside or .obsidian access, and protected memory writeback remains review-gated.',
				};
			case 'tools/list':
				return { tools: toolDefinitions() };
			case 'tools/call':
				return this.handleToolsCall(params);
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

	private handleToolsCall(params: Record<string, unknown>): unknown {
		const name = params.name;
		const argumentsValue = params.arguments ?? {};
		if (typeof name !== 'string' || name.trim() === '') {
			throw new RpcError({ code: -32602, message: '`name` is required for tools/call.' });
		}
		if (!isRecord(argumentsValue)) {
			throw new RpcError({ code: -32602, message: '`arguments` must be an object.' });
		}
		return callTool(name, argumentsValue, { defaultVaultRoot: this.defaultVaultRoot });
	}

	private errorResponse(id: number | string | null, code: number, message: string, data?: unknown): JsonRpcResponse {
		const error: JsonRpcErrorObject = { code, message };
		if (data !== undefined) {
			error.data = data;
		}
		return { jsonrpc: '2.0', id, error };
	}

	private writeResponse(response: JsonRpcResponse): void {
		process.stdout.write(`${JSON.stringify(response)}\n`);
	}
}

function parseArgs(argv: string[]): { defaultVaultRoot?: string } {
	const match = argv
		.map((value, index, items) => {
			if (value === '--vault-root' || value === '--vault') {
				return items[index + 1] ?? null;
			}
			return null;
		})
		.find((value): value is string => value !== null);

	if (!match) {
		return {};
	}

	return { defaultVaultRoot: match };
}

const args = parseArgs(process.argv.slice(2));
const server = new StdioMcpServer(args);
server.run();
