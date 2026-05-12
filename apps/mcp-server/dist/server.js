"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const node_readline_1 = require("node:readline");
const protocol_1 = require("./protocol");
const tools_1 = require("./tools");
const PROTOCOL_VERSION = '2025-06-18';
const RESOURCES = [
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
class StdioMcpServer {
    constructor(config) {
        this.defaultVaultRoot = config.defaultVaultRoot;
    }
    run() {
        const reader = (0, node_readline_1.createInterface)({
            input: process.stdin,
            terminal: false,
            crlfDelay: Number.POSITIVE_INFINITY,
        });
        reader.on('line', (line) => {
            if (line.trim() === '') {
                return;
            }
            this.handleLine(line);
        });
    }
    handleLine(line) {
        let parsed;
        try {
            parsed = JSON.parse(line);
        }
        catch (error) {
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
    handleMessage(rawMessage) {
        if (!(0, protocol_1.isRecord)(rawMessage)) {
            return this.errorResponse(null, -32600, 'Invalid request.');
        }
        const request = rawMessage;
        const requestId = request.id ?? null;
        const isNotification = request.id === undefined;
        const method = request.method;
        if (typeof method !== 'string' || method.trim() === '') {
            return isNotification ? null : this.errorResponse(requestId, -32600, 'Invalid request: missing method.');
        }
        const params = request.params ?? {};
        if (!(0, protocol_1.isRecord)(params)) {
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
        }
        catch (error) {
            if (isNotification || method.startsWith('notifications/')) {
                return null;
            }
            if (error instanceof protocol_1.RpcError) {
                return this.errorResponse(requestId, error.code, error.message, error.data);
            }
            if (error instanceof Error) {
                return this.errorResponse(requestId, -32603, error.message);
            }
            return this.errorResponse(requestId, -32603, 'Internal error.');
        }
    }
    dispatch(method, params) {
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
                        title: 'obs-wiki MCP Server (Phase 8 Controlled Write)',
                        version: '0.1.0',
                    },
                    instructions: 'This MCP server supports controlled write tools for low-risk outputs while keeping all reads scoped to vault-local paths and rejecting vault-outside or .obsidian access.',
                };
            case 'tools/list':
                return { tools: (0, tools_1.toolDefinitions)() };
            case 'tools/call':
                return this.handleToolsCall(params);
            case 'resources/list':
                return { resources: RESOURCES };
            case 'prompts/list':
                return { prompts: (0, tools_1.toolPrompts)() };
            case 'notifications/initialized':
                return {};
            case 'ping':
                return {};
            default:
                throw new protocol_1.RpcError({ code: -32601, message: `Method not found: ${method}` });
        }
    }
    handleToolsCall(params) {
        const name = params.name;
        const argumentsValue = params.arguments ?? {};
        if (typeof name !== 'string' || name.trim() === '') {
            throw new protocol_1.RpcError({ code: -32602, message: '`name` is required for tools/call.' });
        }
        if (!(0, protocol_1.isRecord)(argumentsValue)) {
            throw new protocol_1.RpcError({ code: -32602, message: '`arguments` must be an object.' });
        }
        return (0, tools_1.callTool)(name, argumentsValue, { defaultVaultRoot: this.defaultVaultRoot });
    }
    errorResponse(id, code, message, data) {
        const error = { code, message };
        if (data !== undefined) {
            error.data = data;
        }
        return { jsonrpc: '2.0', id, error };
    }
    writeResponse(response) {
        process.stdout.write(`${JSON.stringify(response)}\n`);
    }
}
function parseArgs(argv) {
    const match = argv
        .map((value, index, items) => {
        if (value === '--vault-root' || value === '--vault') {
            return items[index + 1] ?? null;
        }
        return null;
    })
        .find((value) => value !== null);
    if (!match) {
        return {};
    }
    return { defaultVaultRoot: match };
}
const args = parseArgs(process.argv.slice(2));
const server = new StdioMcpServer(args);
server.run();
