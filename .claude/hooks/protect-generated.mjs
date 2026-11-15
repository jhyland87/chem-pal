// PreToolUse hook: block edits to generated files, with a pointer to the right command.
import { readFileSync } from 'node:fs';
import path from 'node:path';

const GENERATED = [
  [/^docs\//, 'TypeDoc output; regenerate with `pnpm run docs`'],
  [/^src\/constants\/supplierMeta\.generated\.ts$/, 'regenerate with `pnpm run generate-supplier-meta`'],
  [/^public\/static\/images\/logo\//, 'regenerate with `pnpm run generate-logo-files`'],
];

const input = JSON.parse(readFileSync(0, 'utf8'));
const filePath = input.tool_input?.file_path;

if (typeof filePath === 'string') {
  const relative = path.relative(process.env.CLAUDE_PROJECT_DIR ?? process.cwd(), filePath);
  const match = GENERATED.find(([pattern]) => pattern.test(relative));
  if (match) {
    console.error(`${relative} is generated — do not hand-edit it: ${match[1]}.`);
    process.exit(2);
  }
}
