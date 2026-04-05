import traverse from '@babel/traverse';
import * as t from '@babel/types';
import type { ParseResult } from '@babel/parser';

function unrollSequence(
  path: { node: { expression?: t.Expression; argument?: t.Expression | null; test?: t.Expression; discriminant?: t.Expression }; insertBefore: (nodes: t.Statement[]) => void },
  getExpr: () => t.Expression | null | undefined,
  setExpr: (e: t.Expression) => void,
): void {
  const expr = getExpr();
  if (!t.isSequenceExpression(expr)) return;

  const seq = expr.expressions;
  const last = seq[seq.length - 1];
  const preceding = seq.slice(0, -1);

  setExpr(last);
  path.insertBefore(
    preceding.map((e) => t.expressionStatement(e)),
  );
}

export function sequenceUnroller(ast: ParseResult<t.File>): void {
  traverse(ast, {
    ExpressionStatement(path) {
      const expr = path.node.expression;

      // Basic: (x, y, z); → x; y; z;
      if (t.isSequenceExpression(expr)) {
        const stmts = expr.expressions.map((e) => t.expressionStatement(e));
        path.replaceWithMultiple(stmts);
        return;
      }

      // w = (x, y, z); → x; y; w = z;
      if (
        t.isAssignmentExpression(expr) &&
        t.isSequenceExpression(expr.right)
      ) {
        const seq = expr.right.expressions;
        const last = seq[seq.length - 1];
        const preceding = seq.slice(0, -1);

        expr.right = last;
        path.insertBefore(
          preceding.map((e) => t.expressionStatement(e)),
        );
      }
    },
    ThrowStatement(path) {
      unrollSequence(
        path,
        () => path.node.argument,
        (e) => { path.node.argument = e; },
      );
    },
    ReturnStatement(path) {
      if (!path.node.argument) return;
      unrollSequence(
        path,
        () => path.node.argument,
        (e) => { path.node.argument = e; },
      );
    },
    SwitchStatement(path) {
      unrollSequence(
        path,
        () => path.node.discriminant,
        (e) => { path.node.discriminant = e; },
      );
    },
    IfStatement(path) {
      unrollSequence(
        path,
        () => path.node.test,
        (e) => { path.node.test = e; },
      );
    },
  });
}
