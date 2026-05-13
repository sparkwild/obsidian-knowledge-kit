"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.StreamableHttpMcpRuntime = void 0;
const node_http_1 = __importDefault(require("node:http"));
const node_crypto_1 = __importDefault(require("node:crypto"));
const node_url_1 = require("node:url");
const handler_1 = require("./handler");
const LOOPBACK_HOSTS = new Set(['127.0.0.1', 'localhost', '::1', '[::1]']);
const DEFAULT_HOST = '127.0.0.1';
const DEFAULT_PATH = '/mcp';
class StreamableHttpMcpRuntime {
    constructor(options = {}) {
        this.server = null;
        this.sessions = new Map();
        this.state = 'stopped';
        this.startedAt = '';
        this.lastError = '';
        this.host = options.host || DEFAULT_HOST;
        this.port = options.port ?? 58437;
        this.path = options.path || DEFAULT_PATH;
        this.token = options.token || '';
        this.runtimeVersion = options.runtimeVersion || handler_1.MCP_SERVER_VERSION;
        this.handler = new handler_1.McpJsonRpcHandler({
            defaultVaultRoot: options.defaultVaultRoot,
            runtimeVersion: this.runtimeVersion,
            transport: handler_1.STREAMABLE_HTTP_TRANSPORT,
        });
    }
    async start() {
        if (this.server && this.state === 'running') {
            return this.getStatus();
        }
        this.state = 'starting';
        this.lastError = '';
        this.server = node_http_1.default.createServer((request, response) => {
            void this.handleRequest(request, response);
        });
        return new Promise((resolve, reject) => {
            const server = this.server;
            if (!server) {
                const error = new Error('Runtime server was not created.');
                this.state = 'failed';
                this.lastError = error.message;
                reject(error);
                return;
            }
            server.once('error', (error) => {
                this.state = error.code === 'EADDRINUSE' ? 'port_conflict' : 'failed';
                this.lastError = error.message;
                this.server = null;
                reject(error);
            });
            server.listen(this.port, this.host, () => {
                const address = server.address();
                if (address && typeof address === 'object') {
                    this.port = address.port;
                }
                this.state = 'running';
                this.startedAt = new Date().toISOString();
                resolve(this.getStatus());
            });
        });
    }
    async stop() {
        for (const session of this.sessions.values()) {
            this.closeSession(session);
        }
        this.sessions.clear();
        const server = this.server;
        this.server = null;
        if (!server) {
            this.state = 'stopped';
            this.startedAt = '';
            return;
        }
        await new Promise((resolve) => {
            server.close(() => resolve());
        });
        this.state = 'stopped';
        this.startedAt = '';
    }
    getStatus() {
        return {
            state: this.state,
            host: this.host,
            port: this.port,
            path: this.path,
            endpoint: `http://${this.host}:${this.port}${this.path}`,
            startedAt: this.startedAt,
            activeSessions: this.sessions.size,
            lastError: this.lastError,
        };
    }
    async handleRequest(request, response) {
        const url = this.parseRequestUrl(request);
        if (!url || url.pathname !== this.path) {
            this.writePlain(response, 404, 'Not found.');
            return;
        }
        if (!this.isAllowedOrigin(request)) {
            this.writeJson(response, 403, this.errorResponse(null, -32003, 'Forbidden origin.'));
            return;
        }
        if (!this.hasValidToken(request, url)) {
            this.writeJson(response, 401, this.errorResponse(null, -32001, 'Invalid MCP runtime token.'));
            return;
        }
        if (request.method === 'OPTIONS') {
            this.writeCors(response, 204);
            response.end();
            return;
        }
        if (request.method === 'POST') {
            await this.handlePost(request, response);
            return;
        }
        if (request.method === 'GET') {
            this.handleGet(request, response);
            return;
        }
        if (request.method === 'DELETE') {
            this.handleDelete(request, response);
            return;
        }
        this.writeJson(response, 405, this.errorResponse(null, -32005, 'Method not allowed.'));
    }
    async handlePost(request, response) {
        const body = await this.readBody(request);
        let message;
        try {
            message = JSON.parse(body || '{}');
        }
        catch (error) {
            const messageText = error instanceof Error ? error.message : 'Invalid JSON.';
            this.writeJson(response, 400, this.errorResponse(null, -32700, messageText));
            return;
        }
        if (Array.isArray(message)) {
            this.writeJson(response, 400, this.errorResponse(null, -32600, 'Batch requests are not supported by this Runtime.'));
            return;
        }
        const method = this.readMethod(message);
        const isInitialize = method === 'initialize';
        const session = isInitialize
            ? this.createSession()
            : this.requireSession(request, response);
        if (!session) {
            return;
        }
        session.lastSeenAt = Date.now();
        const result = this.handler.handleMessage(message, session);
        if (isInitialize) {
            response.setHeader('Mcp-Session-Id', session.sessionId);
        }
        if (!result) {
            this.writeCors(response, 202);
            response.end();
            return;
        }
        this.writeJson(response, 200, result);
    }
    handleGet(request, response) {
        const session = this.requireSession(request, response);
        if (!session) {
            return;
        }
        session.lastSeenAt = Date.now();
        this.writeCors(response, 200);
        response.setHeader('Content-Type', 'text/event-stream');
        response.setHeader('Cache-Control', 'no-cache, no-transform');
        response.setHeader('Connection', 'keep-alive');
        response.write(': connected\n\n');
        session.streams.add(response);
        request.on('close', () => {
            session.streams.delete(response);
        });
    }
    handleDelete(request, response) {
        const session = this.requireSession(request, response);
        if (!session) {
            return;
        }
        this.closeSession(session);
        this.sessions.delete(session.sessionId);
        this.writeCors(response, 204);
        response.end();
    }
    createSession() {
        const sessionId = node_crypto_1.default.randomUUID();
        const session = {
            sessionId,
            agentId: sessionId,
            clientName: null,
            initialized: false,
            createdAt: Date.now(),
            lastSeenAt: Date.now(),
            streams: new Set(),
        };
        this.sessions.set(sessionId, session);
        return session;
    }
    requireSession(request, response) {
        const sessionId = this.firstHeaderValue(request.headers['mcp-session-id']);
        if (!sessionId) {
            this.writeJson(response, 400, this.errorResponse(null, -32000, 'Missing Mcp-Session-Id header.'));
            return null;
        }
        const session = this.sessions.get(sessionId);
        if (!session) {
            this.writeJson(response, 404, this.errorResponse(null, -32004, 'Unknown MCP session.'));
            return null;
        }
        return session;
    }
    closeSession(session) {
        for (const stream of session.streams) {
            stream.end();
        }
        session.streams.clear();
    }
    parseRequestUrl(request) {
        if (!request.url) {
            return null;
        }
        try {
            return new node_url_1.URL(request.url, `http://${this.host}:${this.port}`);
        }
        catch {
            return null;
        }
    }
    readMethod(message) {
        if (!message || typeof message !== 'object' || Array.isArray(message)) {
            return '';
        }
        const method = message.method;
        return typeof method === 'string' ? method : '';
    }
    async readBody(request) {
        const chunks = [];
        for await (const chunk of request) {
            chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        }
        return Buffer.concat(chunks).toString('utf8');
    }
    isAllowedOrigin(request) {
        const origin = this.firstHeaderValue(request.headers.origin);
        if (!origin) {
            return true;
        }
        if (origin === 'app://obsidian.md') {
            return true;
        }
        try {
            const parsed = new node_url_1.URL(origin);
            return LOOPBACK_HOSTS.has(parsed.hostname);
        }
        catch {
            return false;
        }
    }
    hasValidToken(request, url) {
        if (!this.token) {
            return true;
        }
        const queryToken = url.searchParams.get('token');
        if (queryToken === this.token) {
            return true;
        }
        const authorization = this.firstHeaderValue(request.headers.authorization);
        return authorization === `Bearer ${this.token}`;
    }
    firstHeaderValue(value) {
        if (Array.isArray(value)) {
            return value[0] || '';
        }
        return value || '';
    }
    writeJson(response, status, payload) {
        this.writeCors(response, status);
        response.setHeader('Content-Type', 'application/json');
        response.end(JSON.stringify(payload));
    }
    writePlain(response, status, text) {
        this.writeCors(response, status);
        response.setHeader('Content-Type', 'text/plain; charset=utf-8');
        response.end(text);
    }
    writeCors(response, status) {
        response.statusCode = status;
        response.setHeader('Access-Control-Allow-Origin', '*');
        response.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept, Authorization, Mcp-Session-Id');
        response.setHeader('Access-Control-Expose-Headers', 'Mcp-Session-Id');
        response.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
    }
    errorResponse(id, code, message, data) {
        const error = { code, message };
        if (data !== undefined) {
            error.data = data;
        }
        return { jsonrpc: '2.0', id, error };
    }
}
exports.StreamableHttpMcpRuntime = StreamableHttpMcpRuntime;
