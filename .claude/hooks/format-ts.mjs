// PostToolUse hook: run Prettier on the .ts/.tsx file Claude just edited or wrote.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const input = JSON.parse(readFileSync(0, 'utf8'));
const filePath = input.tool_input?.file_path;

if (typeof filePath === 'string' && /\.tsx?$/.test(filePath)) {
  try {
    execFileSync('pnpm', ['exec', 'prettier', '--write', '--log-level', 'warn', filePath], {
      cwd: process.env.CLAUDE_PROJECT_DIR,
      stdio: 'ignore',
      timeout: 30000,
    });
  } catch {
    // Formatting is best-effort; `pnpm format:check` in CI is the real gate.
  }
}
