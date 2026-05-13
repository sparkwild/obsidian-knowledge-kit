"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const node_readline_1 = require("node:readline");
const protocol_1 = require("./protocol");
const tools_1 = require("./tools");
const PROTOCOL_VERSION = '2025-06-18';
const SERVER_VERSION = '0.1.0';
const DEFAULT_TRANSPORT = 'stdio';
const RESOURCES = [
    {
        uri: 'obswiki://system',
        name: 'system',
        title: 'System note',
        description: 'Core system note path if present.',
        mimeType: 'text/markdown',
    },
    {
        uri: 'obswiki://active-context',
        name: 'active-context',
        title: 'Active context',
        description: 'Active-context note for current memory state.',
        mimeType: 'text/markdown',
    },
    {
        uri: 'obswiki://review-queue',
        name: 'review-queue',
        title: 'Review queue',
        description: 'Pending proposal queue snapshots.',
        mimeType: 'text/markdown',
    },
    {
        uri: 'obswiki://agent-activity',
        name: 'agent-activity',
        title: 'Agent activity',
        description: 'Recent agent-task and review traces.',
        mimeType: 'text/markdown',
    },
    {
        uri: 'obswiki://audit/recent',
        name: 'audit-recent',
        title: 'Recent audit',
        description: 'Recent audit log entries.',
        mimeType: 'text/markdown',
    },
];
class StdioMcpServer {
    constructor(config) {
        this.connectionAgentId = 'unknown session id';
        this.connectionClientName = null;
        this.defaultVaultRoot = config.defaultVaultRoot;
        this.runtimeVersion = SERVER_VERSION;
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
                this.captureConnection(params);
                return {
                    protocolVersion: PROTOCOL_VERSION,
                    capabilities: {
                        tools: { listChanged: false },
                        resources: { listChanged: false },
                        prompts: { listChanged: false },
                    },
                    serverInfo: {
                        name: 'obswiki-mcp-server',
                        title: 'Obswiki MCP Server (read-only default + controlled write + review-gated apply)',
                        version: this.runtimeVersion,
                    },
                    instructions: 'This MCP server is read-only-by-default; controlled write tools are allowed for bounded working records, and review-gated apply requires approved proposals before protected writeback. All reads and writes are vault-local only, reject vault-outside or .obsidian access, and sensitive payloads are never persisted in audit events.',
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
        const toolInvocationContext = {
            defaultVaultRoot: this.defaultVaultRoot,
            agentId: this.connectionAgentId,
            clientName: this.connectionClientName,
            transport: DEFAULT_TRANSPORT,
            runtimeVersion: this.runtimeVersion,
        };
        return (0, tools_1.callTool)(name, argumentsValue, toolInvocationContext);
    }
    captureConnection(params) {
        if (!this.defaultVaultRoot) {
            return;
        }
        this.connectionAgentId = this.extractAgentIdFromInitialize(params);
        this.connectionClientName = this.extractClientNameFromInitialize(params);
        try {
            (0, tools_1.appendConnectionAuditEvent)(this.defaultVaultRoot, {
                agentId: this.connectionAgentId,
                clientName: this.connectionClientName,
                transport: DEFAULT_TRANSPORT,
                runtimeVersion: this.runtimeVersion,
            });
        }
        catch {
            // Best-effort audit writes should never fail initialize.
        }
    }
    extractAgentIdFromInitialize(params) {
        const clientInfo = (0, protocol_1.isRecord)(params.clientInfo) ? params.clientInfo : {};
        const meta = (0, protocol_1.isRecord)(params.meta) ? params.meta : {};
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
        return 'unknown session id';
    }
    extractClientNameFromInitialize(params) {
        const clientInfo = (0, protocol_1.isRecord)(params.clientInfo) ? params.clientInfo : {};
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
