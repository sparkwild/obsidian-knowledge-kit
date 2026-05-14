import { StreamableHttpMcpRuntime } from './http-runtime';

interface ServerArgs {
	defaultVaultRoot?: string;
	vaultConfigDir?: string;
	host?: string;
	port?: number;
	token?: string;
	allowMissingTokenForDev?: boolean;
}

function parseArgs(argv: string[]): ServerArgs {
	const result: ServerArgs = {};
	for (let index = 0; index < argv.length; index += 1) {
		const value = argv[index];
		const next = argv[index + 1];
		if ((value === '--vault-root' || value === '--vault') && next) {
			result.defaultVaultRoot = next;
			index += 1;
			continue;
		}
		if (value === '--vault-config-dir' && next) {
			result.vaultConfigDir = next;
			index += 1;
			continue;
		}
		if (value === '--host' && next) {
			result.host = next;
			index += 1;
			continue;
		}
		if (value === '--port' && next) {
			const parsed = Number.parseInt(next, 10);
			if (Number.isFinite(parsed)) {
				result.port = parsed;
			}
			index += 1;
			continue;
		}
		if (value === '--token' && next) {
			result.token = next;
			index += 1;
			continue;
		}
		if (value === '--allow-missing-token-for-dev') {
			result.allowMissingTokenForDev = true;
		}
	}
	return result;
}

async function main(): Promise<void> {
	const args = parseArgs(process.argv.slice(2));
	const runtime = new StreamableHttpMcpRuntime(args);
	const status = await runtime.start();
	process.stdout.write(`${JSON.stringify({ ok: true, endpoint: status.endpoint })}\n`);

	const stop = async () => {
		await runtime.stop();
		process.exit(0);
	};
	process.once('SIGINT', () => {
		void stop();
	});
	process.once('SIGTERM', () => {
		void stop();
	});
}

void main().catch((error) => {
	const message = error instanceof Error ? error.message : 'Unknown MCP Runtime error.';
	process.stderr.write(`${message}\n`);
	process.exit(1);
});
