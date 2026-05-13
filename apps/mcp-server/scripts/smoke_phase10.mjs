#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';

function writeNote(vaultRoot, relativePath, content) {
	const target = path.join(vaultRoot, relativePath);
	fs.mkdirSync(path.dirname(target), { recursive: true });
	fs.writeFileSync(target, content, 'utf8');
	return target;
}

function decodeResponse(line) {
	try {
		return JSON.parse(line);
	} catch {
		return null;
	}
}

class McpTestClient {
	constructor(vaultRoot) {
		this.vaultRoot = vaultRoot;
		this.serverPath = path.join(process.cwd(), 'dist', 'server.js');
		this.nextId = 1;
		this.pending = new Map();
	}

	start() {
		this.proc = spawn(process.execPath, [this.serverPath, '--vault-root', this.vaultRoot], {
			stdio: ['pipe', 'pipe', 'pipe'],
		});

		this.proc.stdout.on('data', (chunk) => {
			const text = chunk.toString();
			const lines = text.split('\n');
			for (const line of lines) {
				const trimmed = line.trim();
				if (!trimmed) {
					continue;
				}
				const message = decodeResponse(trimmed);
				if (!message || typeof message !== 'object' || !('id' in message)) {
					continue;
				}
				const resolver = this.pending.get(message.id);
				if (resolver) {
					this.pending.delete(message.id);
					resolver(message);
				}
			}
		});

		return new Promise((resolve, reject) => {
			this.proc.once('error', reject);
			this.proc.once('spawn', resolve);
		});
	}

	async call(method, params = {}) {
		const id = this.nextId;
		this.nextId += 1;
		const payload = {
			jsonrpc: '2.0',
			id,
			method,
			params,
		};

		const result = new Promise((resolve, reject) => {
			const timer = setTimeout(() => {
				this.pending.delete(id);
				reject(new Error(`Timeout waiting for response #${id} ${method}`));
			}, 20000);

				this.pending.set(id, (response) => {
					const structured = buildStructured(response.result);
					clearTimeout(timer);
					if (response.error) {
						reject(new Error(response.error.message || `JSON-RPC error for ${method}`));
						return;
					}
					if (response.result && response.result.isError) {
						reject(new Error(response.result.structuredContent?.error || `Tool error for ${method}`));
						return;
					}
					if (structured && structured.isError) {
						reject(new Error(structured.error || `Tool error for ${method}`));
						return;
					}
				if (!response.result) {
					reject(new Error(`Missing result for ${method} #${id}`));
					return;
				}
				resolve(response.result);
			});
			this.proc.stdin.write(`${JSON.stringify(payload)}\n`);
		});
		return result;
	}

	close() {
		if (!this.proc || this.proc.killed) {
			return Promise.resolve();
		}
		this.proc.kill();
		return new Promise((resolve) => {
			this.proc.once('exit', () => resolve());
		});
	}
}

function buildStructured(result) {
	if (result && typeof result === 'object' && result.structuredContent && typeof result.structuredContent === 'object') {
		return result.structuredContent;
	}
	return result;
}

function ensureToolNames(result, names) {
	const toolList = (buildStructured(result).tools || []).map((tool) => tool.name);
	for (const expected of names) {
		assert.ok(toolList.includes(expected), `Missing MCP tool: ${expected}`);
	}
}

async function main() {
	const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'obs-wiki-mcp-phase10-'));
	const vaultRoot = path.join(tempRoot, 'vault');
	const fixturePath = path.join(vaultRoot, '01_inbox', 'agent_requests', 'local-source-request.md');
	const client = new McpTestClient(vaultRoot);

	try {
		if (!fs.existsSync(path.join(process.cwd(), 'dist', 'server.js'))) {
			throw new Error('dist/server.js not found. Run npm run build first.');
		}

		fs.mkdirSync(vaultRoot, { recursive: true });
		writeNote(vaultRoot, '00_control/system.md', '# System\n');
		writeNote(vaultRoot, '00_control/audit_log.md', '# Audit Log\n');
		writeNote(vaultRoot, '04_projects/demo/project_overview.md', '# Demo Project\n\nInitial project memory.');
		writeNote(vaultRoot, '01_inbox/agent_requests/local-source-request.md', [
			'---',
			'type: agent-request',
			'source: 03_sources/local-source.md',
			'sourceKind: local_file',
			'status: pending',
			'purpose: phase 10 smoke',
			'analysis_mode: default',
			'---',
			'',
			'## Selected Text',
			'Source request body used for deterministic smoke flow.',
			'',
		].join('\n'));
		writeNote(vaultRoot, '01_inbox/review_queue/approved-writeback.md', [
			'---',
			'type: memory-proposal',
			'proposal_id: prop_smoke_apply',
			'proposal_kind: project_update',
			'approval_status: approved',
			'target_note: 04_projects/demo/project_overview.md',
			'risk_level: medium',
			'---',
			'',
			'# Approved Writeback Proposal',
			'',
			'## Writeback',
			'',
			'- Runtime-approved memory from smoke test.',
			'',
		].join('\n'));
		writeNote(vaultRoot, '03_sources/local-source.md', '# Source\n\nThis is source content for mcp smoke source-analysis test.');

		await client.start();

		const initialize = await client.call('initialize', {
			protocolVersion: '2025-06-18',
			capabilities: {},
			clientInfo: {
				name: 'obs-wiki-phase10-smoke',
				version: '0.1.0',
			},
		});
		assert.equal(initialize.capabilities.tools.listChanged, false);

		const tools = await client.call('tools/list');
		ensureToolNames(tools, [
			'obs_wiki.status',
			'obs_wiki.start_task',
			'obs_wiki.recall',
			'obs_wiki.read_note',
			'obs_wiki.list_review_queue',
			'obs_wiki.list_approved_writebacks',
			'obs_wiki.audit_recent',
			'obs_wiki.write_context_pack',
			'obs_wiki.write_session_note',
			'obs_wiki.capture_source',
			'obs_wiki.propose_memory',
			'obs_wiki.analyze_source_request',
			'obs_wiki.apply_approved_writeback',
		]);

		const resources = await client.call('resources/list');
		assert.ok((buildStructured(resources).resources || []).length > 0, 'resources/list should return resources');

		const prompts = await client.call('prompts/list');
		assert.ok((buildStructured(prompts).prompts || []).length > 0, 'prompts/list should return prompts');

		const status = buildStructured(await client.call('tools/call', {
			name: 'obs_wiki.status',
			arguments: {},
		}));
		assert.equal(status.ok, true);
		assert.equal(typeof status.counts.notes === 'number', true);

		const readNote = buildStructured(await client.call('tools/call', {
			name: 'obs_wiki.read_note',
			arguments: { path: '00_control/system.md' },
		}));
		assert.equal(readNote.ok, true);
		assert.equal(readNote.path, '00_control/system.md');

		const writeContext = buildStructured(await client.call('tools/call', {
			name: 'obs_wiki.write_context_pack',
			arguments: {
				filename: 'phase10-context-pack',
				content: '# Context Pack\n\nSmoke content',
				title: 'Phase 10 context pack',
			},
		}));
		assert.equal(writeContext.ok, true);
		assert.ok(fs.existsSync(path.join(vaultRoot, writeContext.path)));

		const writeSession = buildStructured(await client.call('tools/call', {
			name: 'obs_wiki.write_session_note',
			arguments: {
				filename: 'phase10-session',
				content: '# Session\n\nSmoke session note',
			},
		}));
		assert.equal(writeSession.ok, true);
		assert.ok(fs.existsSync(path.join(vaultRoot, writeSession.path)));

		await client.call('tools/call', {
			name: 'obs_wiki.capture_source',
			arguments: {
				source: '03_sources/local-source.md',
				mode: 'local_copy',
				content: '# Source\n\ncopied content.',
			},
		});

		await assert.rejects(
			() =>
				client.call('tools/call', {
					name: 'obs_wiki.write_context_pack',
					arguments: {
						filename: '../outside',
						content: '# Reject',
					},
				}),
			/Path traversal is not allowed/,
			'should reject writes outside vault'
		);

		const analyze = buildStructured(await client.call('tools/call', {
			name: 'obs_wiki.analyze_source_request',
			arguments: { request_path: '01_inbox/agent_requests/local-source-request.md' },
		}));
		assert.equal(analyze.ok, true);
		assert.equal(analyze.status, 'completed');
		assert.ok(analyze.source_note && analyze.source_note.path);
		assert.ok(analyze.report && analyze.report.path);
		assert.ok(fs.existsSync(path.join(vaultRoot, analyze.source_note.path)));
		assert.ok(fs.existsSync(path.join(vaultRoot, analyze.report.path)));
		assert.ok(fs.readFileSync(fixturePath, 'utf8').includes('status: completed'));

		const approvedWritebacks = buildStructured(await client.call('tools/call', {
			name: 'obs_wiki.list_approved_writebacks',
			arguments: {},
		}));
		assert.equal(approvedWritebacks.ok, true);
		assert.equal(approvedWritebacks.count, 1);
		assert.equal(approvedWritebacks.entries[0].ready_to_apply, true);

		const dryRunApply = buildStructured(await client.call('tools/call', {
			name: 'obs_wiki.apply_approved_writeback',
			arguments: {
				proposal_id: 'prop_smoke_apply',
				dry_run: true,
			},
		}));
		assert.equal(dryRunApply.ok, true);
		assert.equal(dryRunApply.read_only, true);
		assert.equal(dryRunApply.target_note, '04_projects/demo/project_overview.md');

		const applied = buildStructured(await client.call('tools/call', {
			name: 'obs_wiki.apply_approved_writeback',
			arguments: {
				proposal_id: 'prop_smoke_apply',
			},
		}));
		assert.equal(applied.ok, true);
		assert.equal(applied.status, 'applied');
		const targetText = fs.readFileSync(path.join(vaultRoot, '04_projects/demo/project_overview.md'), 'utf8');
		assert.ok(targetText.includes('## Approved Writeback: prop_smoke_apply'));
		assert.ok(targetText.includes('Runtime-approved memory from smoke test.'));
		const proposalText = fs.readFileSync(path.join(vaultRoot, '01_inbox/review_queue/approved-writeback.md'), 'utf8');
		assert.ok(proposalText.includes('approval_status: applied'));
		assert.ok(proposalText.includes('status: applied'));

		console.log(JSON.stringify({ result: 'pass', vaultRoot }, null, 2));
	} finally {
		await client.close().catch(() => {});
		fs.rmSync(tempRoot, { recursive: true, force: true });
	}
}

main().catch((error) => {
	console.error(error);
	process.exitCode = 1;
});
