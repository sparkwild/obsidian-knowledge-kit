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

function readAuditLog(vaultRoot) {
	return fs.readFileSync(path.join(vaultRoot, '00_control/audit_log.md'), 'utf8');
}

function hasSectionWithValues(log, linesToMatch) {
	return linesToMatch.every((needle) => log.includes(needle));
}

function assertToolCallEvent(log, toolName, status) {
	const found = hasToolCallSection(log, toolName, status);
	assert.ok(found, `tool-call event expected for ${toolName} with status ${status}`);
}

function hasToolCallSection(log, toolName, status, extraNeedles = []) {
	const quotedToolName = JSON.stringify(toolName);
	const quotedStatus = JSON.stringify(status);
	const sections = log.split('\n## ').map((entry) => entry.trim());
	for (const section of sections) {
		if (!section) {
			continue;
		}
		const hasType = section.includes('- type: tool-call');
		const hasTool =
			section.includes(`- tool_name: ${toolName}`) || section.includes(`- tool_name: ${quotedToolName}`);
		const hasStatus =
			section.includes(`- result_status: ${status}`) || section.includes(`- result_status: ${quotedStatus}`);
		const extraMatch = extraNeedles.every((needle) => section.includes(needle));
		if (hasType && hasTool && hasStatus && extraMatch) {
			return true;
		}
	}
	return false;
}

function assertContainsNoSensitiveText(log, values) {
	for (const value of values) {
		assert.ok(!log.includes(value), `sensitive value should not appear in audit: ${value}`);
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
	const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'obswiki-mcp-smoke-'));
	const vaultRoot = path.join(tempRoot, 'vault');
	const fixturePath = path.join(vaultRoot, '01_inbox', 'agent_requests', 'local-source-request.md');
	const lintFixturePath = path.join(vaultRoot, '04_projects', 'demo', 'smoke-lint-fixture.md');
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
			'purpose: smoke test',
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
		writeNote(vaultRoot, '04_projects/demo/smoke-lint-fixture.md', [
			'# Smoke Lint Fixture',
			'This note references [[smoke_missing_page]] and includes a claim with no source.',
			'',
			'> [!claim]',
			'> This is a claim that should require source refs.',
			'',
		].join('\n'));
		assert.ok(fs.existsSync(lintFixturePath), 'lint fixture created');

		await client.start();

		const initialize = await client.call('initialize', {
			protocolVersion: '2025-06-18',
			capabilities: {},
			clientInfo: {
				name: 'obswiki-smoke',
				version: '0.1.0',
			},
		});
		assert.equal(initialize.capabilities.tools.listChanged, false);
		const initAudit = readAuditLog(vaultRoot);
		assert.ok(hasSectionWithValues(initAudit, ['- type: connection', '- event: connection', '- agent_id:']));
		assert.ok(hasSectionWithValues(initAudit, ['- timestamp:']));
		assert.ok(hasSectionWithValues(initAudit, ['- transport:']));

		const tools = await client.call('tools/list');
		ensureToolNames(tools, [
			'obswiki.status',
			'obswiki.start_task',
			'obswiki.recall',
			'obswiki.read_note',
			'obswiki.list_review_queue',
			'obswiki.list_approved_writebacks',
			'obswiki.audit_recent',
			'obswiki.write_context_pack',
			'obswiki.build_context_pack',
			'obswiki.lint',
			'obswiki.finish_task',
			'obswiki.distill_session',
			'obswiki.write_session_note',
			'obswiki.capture_source',
			'obswiki.propose_memory',
			'obswiki.analyze_source_request',
			'obswiki.apply_approved_writeback',
		]);

		const resources = await client.call('resources/list');
		assert.ok((buildStructured(resources).resources || []).length > 0, 'resources/list should return resources');

		const prompts = await client.call('prompts/list');
		assert.ok((buildStructured(prompts).prompts || []).length > 0, 'prompts/list should return prompts');

		const status = buildStructured(await client.call('tools/call', {
			name: 'obswiki.status',
			arguments: {},
		}));
		assert.equal(status.ok, true);
		assert.equal(typeof status.counts.notes === 'number', true);

		const readNote = buildStructured(await client.call('tools/call', {
			name: 'obswiki.read_note',
			arguments: { path: '00_control/system.md' },
		}));
		assert.equal(readNote.ok, true);
		assert.equal(readNote.path, '00_control/system.md');
		const afterReadAudit = readAuditLog(vaultRoot);
		assertToolCallEvent(afterReadAudit, 'obswiki.read_note', 'success');

		const sensitiveText = 'SENSITIVE_TOKEN_123ABC456DEF';
		await client.call('tools/call', {
			name: 'obswiki.start_task',
			arguments: {
				goal: 'Smoke sensitive summary',
				client: 'agent-smoke',
				api_key: sensitiveText,
				authorization: `Bearer ${sensitiveText}`,
				secret: `secret_${sensitiveText}`,
				password: `pwd_${sensitiveText}`,
				cookie: `cookie=${sensitiveText}`,
				token: `token_${sensitiveText}`,
			},
		});

		const afterSensitiveAudit = readAuditLog(vaultRoot);
		assertToolCallEvent(afterSensitiveAudit, 'obswiki.start_task', 'success');
		assertContainsNoSensitiveText(afterSensitiveAudit, [
			sensitiveText,
			`secret_${sensitiveText}`,
			`pwd_${sensitiveText}`,
			`cookie=${sensitiveText}`,
			`token_${sensitiveText}`,
		]);
		assert.ok(
			hasToolCallSection(afterSensitiveAudit, 'obswiki.start_task', 'success', ['- args_summary:']),
			'tool-call should include args summary field'
		);

		const writeContext = buildStructured(await client.call('tools/call', {
			name: 'obswiki.write_context_pack',
			arguments: {
				filename: 'smoke-context-pack',
				content: '# Context Pack\n\nSmoke content',
				title: 'Smoke context pack',
			},
		}));
		assert.equal(writeContext.ok, true);
		assert.ok(fs.existsSync(path.join(vaultRoot, writeContext.path)));

		const buildContextRead = buildStructured(await client.call('tools/call', {
			name: 'obswiki.build_context_pack',
			arguments: {
				query: 'smoke',
				candidate_limit: 5,
				stale_after_days: 30,
				write: false,
			},
		}));
		assert.equal(buildContextRead.ok, true);
		assert.equal(buildContextRead.read_only, true);
		assert.equal(buildContextRead.query, 'smoke');
		assert.equal(Array.isArray(buildContextRead.context_pack.relevantNotes), true);

		const buildContextWrite = buildStructured(await client.call('tools/call', {
			name: 'obswiki.build_context_pack',
			arguments: {
				query: 'smoke',
				write: true,
				filename: 'smoke-context-pack-auto',
				title: 'Smoke build context pack',
			},
		}));
		assert.equal(buildContextWrite.ok, true);
		assert.equal(buildContextWrite.read_only, false);
		assert.ok(fs.existsSync(path.join(vaultRoot, buildContextWrite.artifact.path)));
		assert.ok(buildContextWrite.artifact.path.startsWith('06_outputs/context_packs/'));
		assert.ok(buildContextWrite.artifact.path.endsWith('.md'));

		const lintResult = buildStructured(await client.call('tools/call', {
			name: 'obswiki.lint',
			arguments: {
				max_items: 20,
			},
		}));
		assert.equal(lintResult.ok, true);
		assert.equal(typeof lintResult.issue_count, 'number');
		assert.ok(Array.isArray(lintResult.issues));
		assert.ok(lintResult.issues.length > 0);
		assert.ok(Array.isArray(lintResult.fix_plan_summary));

		const finishTask = buildStructured(await client.call('tools/call', {
			name: 'obswiki.finish_task',
			arguments: {
				task_id: 'task-smoke-finish',
				summary: 'Smoke task finish session.',
				outcomes: ['Complete smoke validation'],
				next_actions: ['Run lint and distill'],
			},
		}));
		assert.equal(finishTask.ok, true);
		assert.equal(finishTask.read_only, false);
		assert.ok(fs.existsSync(path.join(vaultRoot, finishTask.path)));

		const distillSession = buildStructured(await client.call('tools/call', {
			name: 'obswiki.distill_session',
			arguments: {
				task_id: 'task-smoke-distill',
				summary: 'Smoke distill session.',
				decisions: ['Prefer deterministic artifacts'],
				possible_preferences: ['Prefer markdown session notes'],
				outcomes: ['Generated distill proposals'],
				next_actions: ['Review proposals'],
			},
		}));
		assert.equal(distillSession.ok, true);
		assert.equal(distillSession.read_only, false);
		assert.equal(distillSession.proposal_count, 2);
		assert.ok(Array.isArray(distillSession.proposals));
		assert.equal(distillSession.proposals.length, 2);
		for (const proposal of distillSession.proposals) {
			assert.ok(fs.existsSync(path.join(vaultRoot, proposal.path)));
		}

		const writeSession = buildStructured(await client.call('tools/call', {
			name: 'obswiki.write_session_note',
			arguments: {
				filename: 'smoke-session',
				content: '# Session\n\nSmoke session note',
			},
		}));
		assert.equal(writeSession.ok, true);
		assert.ok(fs.existsSync(path.join(vaultRoot, writeSession.path)));

		await client.call('tools/call', {
			name: 'obswiki.capture_source',
			arguments: {
				source: '03_sources/local-source.md',
				mode: 'local_copy',
				content: '# Source\n\ncopied content.',
			},
		});

		await assert.rejects(
			() =>
				client.call('tools/call', {
					name: 'obswiki.write_context_pack',
					arguments: {
						filename: '../outside',
						content: '# Reject',
					},
				}),
			/Path traversal is not allowed/,
			'should reject writes outside vault'
		);
		const afterFailureAudit = readAuditLog(vaultRoot);
		assertToolCallEvent(afterFailureAudit, 'obswiki.write_context_pack', 'failed');

		const analyze = buildStructured(await client.call('tools/call', {
			name: 'obswiki.analyze_source_request',
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
			name: 'obswiki.list_approved_writebacks',
			arguments: {},
		}));
		assert.equal(approvedWritebacks.ok, true);
		assert.equal(approvedWritebacks.count, 1);
		assert.equal(approvedWritebacks.entries[0].ready_to_apply, true);

		const dryRunApply = buildStructured(await client.call('tools/call', {
			name: 'obswiki.apply_approved_writeback',
			arguments: {
				proposal_id: 'prop_smoke_apply',
				dry_run: true,
			},
		}));
		assert.equal(dryRunApply.ok, true);
		assert.equal(dryRunApply.read_only, true);
		assert.equal(dryRunApply.target_note, '04_projects/demo/project_overview.md');

		const applied = buildStructured(await client.call('tools/call', {
			name: 'obswiki.apply_approved_writeback',
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

		writeNote(vaultRoot, '01_inbox/review_queue/approved-secret-writeback.md', [
			'---',
			'type: memory-proposal',
			'proposal_id: prop_secret_apply',
			'proposal_kind: project_update',
			'approval_status: approved',
			'target_note: 04_projects/demo/project_overview.md',
			'risk_level: medium',
			'---',
			'',
			'# Approved Secret Writeback Proposal',
			'',
			'## Writeback',
			'',
			'api_key: sk-secretvalue123456789012345',
			'',
		].join('\n'));
		await assert.rejects(
			() =>
				client.call('tools/call', {
					name: 'obswiki.apply_approved_writeback',
					arguments: {
						proposal_id: 'prop_secret_apply',
					},
				}),
			/Refusing to write potential secret/,
			'should reject approved writeback content that looks like a secret'
		);

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
