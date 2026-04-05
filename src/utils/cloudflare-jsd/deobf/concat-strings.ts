import traverse from '@babel/traverse';
import * as t from '@babel/types';
import type { ParseResult } from '@babel/parser';

export function concatStrings(ast: ParseResult<t.File>): void {
  traverse(ast, {
    BinaryExpression(path) {
      if (path.node.operator !== '+') return;
      if (!t.isStringLiteral(path.node.left)) return;
      if (!t.isStringLiteral(path.node.right)) return;

      path.replaceWith(
        t.stringLiteral(path.node.left.value + path.node.right.value),
      );
    },
  });
}
