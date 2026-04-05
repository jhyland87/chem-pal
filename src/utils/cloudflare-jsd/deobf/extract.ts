import traverse from '@babel/traverse';
import * as t from '@babel/types';
import type { ParseResult } from '@babel/parser';
import type { Ctx } from '../types';

const LZ_STRING_URI_SAFE_ALPHABET =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+-$';

function isExactAlphabetPermutation(s: string): boolean {
  if (s.length !== LZ_STRING_URI_SAFE_ALPHABET.length) return false;

  const allowed = new Set(LZ_STRING_URI_SAFE_ALPHABET);
  const seen = new Set<string>();

  for (const ch of s) {
    if (!allowed.has(ch) || seen.has(ch)) return false;
    seen.add(ch);
  }
  return true;
}

export function parseScript(ast: ParseResult<t.File>): Ctx {
  const ctx: Ctx = { ve: '', path: '', alphabet: '' };

  traverse(ast, {
    StringLiteral(path) {
      const val = path.node.value;
      if (val.startsWith('/jsd/oneshot/')) {
        ctx.path = val;
      } else if (isExactAlphabetPermutation(val)) {
        ctx.alphabet = val;
      }
    },
    ObjectExpression(path) {
      if (path.node.properties.length !== 1) return;

      const prop = path.node.properties[0];
      if (!t.isObjectProperty(prop)) return;
      if (!t.isStringLiteral(prop.value)) return;

      if (prop.value.value === 'b') {
        ctx.ve = 'b';
      } else if (prop.value.value === 'g') {
        ctx.ve = 'g';
      }
    },
  });

  return ctx;
}
