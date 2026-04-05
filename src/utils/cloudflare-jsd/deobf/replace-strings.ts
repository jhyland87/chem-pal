import traverse from '@babel/traverse';
import generate from '@babel/generator';
import * as t from '@babel/types';
import type { ParseResult } from '@babel/parser';

const NORMAL_RE = /^[0-9][a-zA-Z0-9+\-*/%()=<>!&|^.,\s]*$/;
const SHUFFLE_CHECKER_RE = /parseInt\(.\((\d*?)\)\)/g;

export function replaceStrings(
  ast: ParseResult<t.File>,
  funcName: string,
): void {
  let stringArray: string[] = [];
  let offset = 0;
  let shuffleNode: t.Node | null = null;

  // Step 1: Gather string array, offset, and shuffle expression
  traverse(ast, {
    CallExpression(path) {
      // Find the large string.split(",") call
      if (!t.isMemberExpression(path.node.callee)) return;
      if (!t.isStringLiteral(path.node.callee.object)) return;
      if (path.node.callee.object.value.length < 900) return;

      stringArray = path.node.callee.object.value.split(',');
    },
    FunctionDeclaration(path) {
      if (!t.isIdentifier(path.node.id) || path.node.id.name !== funcName)
        return;

      const body = path.node.body.body;
      if (body.length === 0) return;

      const firstStmt = body[0];
      if (!t.isExpressionStatement(firstStmt)) return;
      if (!t.isAssignmentExpression(firstStmt.expression)) return;

      const right = firstStmt.expression.right;
      if (!t.isBinaryExpression(right)) return;
      if (!t.isNumericLiteral(right.right)) return;

      let val = right.right.value;
      if (right.operator === '-') {
        val *= -1;
      }
      offset = val;
    },
    ForStatement(path) {
      const bodyStmt = path.node.body;
      if (!t.isBlockStatement(bodyStmt) && !t.isTryStatement(bodyStmt)) {
        // Check if the body itself is a try or contains one
        if (t.isBlockStatement(bodyStmt)) {
          const hasTry = bodyStmt.body.some((s) => t.isTryStatement(s));
          if (!hasTry) return;
        } else {
          return;
        }
      }

      const code = generate(path.node).code;
      if (!code.includes('parseInt')) return;

      shuffleNode = path.node.body;
    },
  });

  // Step 2: Apply shuffle
  if (shuffleNode) {
    const shuffleCode = generate(shuffleNode).code;
    const matches = [...shuffleCode.matchAll(SHUFFLE_CHECKER_RE)];
    const checkIndices: number[] = [];

    for (const m of matches) {
      const val = parseInt(m[1], 10);
      if (!isNaN(val)) {
        checkIndices.push(val);
      }
    }

    outer: while (true) {
      for (const entry of checkIndices) {
        const text = stringArray[entry + offset];
        if (!NORMAL_RE.test(text)) {
          // Rotate array: move first element to end
          stringArray.push(stringArray.shift()!);
          continue outer;
        }
      }
      break;
    }
  }

  // Step 3: Replace all calls to the decoder function with resolved strings
  traverse(ast, {
    CallExpression(path) {
      if (!t.isIdentifier(path.node.callee)) return;
      if (path.node.callee.name !== funcName) return;
      if (path.node.arguments.length !== 1) return;

      const arg = path.node.arguments[0];
      if (!t.isNumericLiteral(arg)) return;

      const index = arg.value + offset;
      if (index >= 0 && index < stringArray.length) {
        path.replaceWith(t.stringLiteral(stringArray[index]));
      }
    },
  });
}
