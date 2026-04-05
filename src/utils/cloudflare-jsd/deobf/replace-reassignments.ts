import traverse from '@babel/traverse';
import * as t from '@babel/types';
import type { ParseResult } from '@babel/parser';

export function replaceReassignments(ast: ParseResult<t.File>): string | null {
  // Step 1: Gather assignment aliases (a = b where both are identifiers)
  const decls = new Map<string, string>();

  traverse(ast, {
    AssignmentExpression(path) {
      const { left, right } = path.node;
      if (!t.isIdentifier(left) || !t.isIdentifier(right)) return;
      if (left.name === right.name) return;
      decls.set(left.name, right.name);
    },
  });

  // Step 2: Collapse chains (a→b→c becomes a→c, b→c)
  function resolveRoot(name: string): string {
    const seen = new Set<string>();
    let cur = name;
    while (true) {
      if (seen.has(cur)) return name; // cycle
      seen.add(cur);
      const next = decls.get(cur);
      if (!next) return cur;
      cur = next;
    }
  }

  for (const key of decls.keys()) {
    decls.set(key, resolveRoot(key));
  }

  // Step 3: Count calls to find the most-called root (the string decoder function)
  const callCounts = new Map<string, number>();

  traverse(ast, {
    CallExpression(path) {
      if (!t.isIdentifier(path.node.callee)) return;
      const root = resolveRoot(path.node.callee.name);
      callCounts.set(root, (callCounts.get(root) ?? 0) + 1);
    },
  });

  // Step 4: Replace all aliased identifiers with their roots
  traverse(ast, {
    Identifier(path) {
      const resolved = decls.get(path.node.name);
      if (resolved && resolved !== path.node.name) {
        path.node.name = resolved;
      }
    },
  });

  // Find the most-called function name
  let bestName: string | null = null;
  let bestCount = 0;
  for (const [name, count] of callCounts) {
    if (count > bestCount) {
      bestCount = count;
      bestName = name;
    }
  }

  return bestName;
}
