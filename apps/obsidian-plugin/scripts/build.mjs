import { build } from 'esbuild';
import path from 'node:path';

const repoRoot = path.resolve(process.cwd(), '../..');
const mcpServerPath = path.join(repoRoot, 'apps/mcp-server/dist/server.js');

await build({
  entryPoints: ['src/main.ts'],
  bundle: true,
  format: 'cjs',
  target: ['es2018'],
  sourcemap: true,
  external: ['obsidian'],
  define: {
    __OBS_WIKI_MCP_SERVER_PATH__: JSON.stringify(mcpServerPath),
  },
  outfile: 'main.js',
});
