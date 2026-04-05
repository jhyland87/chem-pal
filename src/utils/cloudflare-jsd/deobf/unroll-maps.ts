import traverse from '@babel/traverse';
import * as t from '@babel/types';
import type { ParseResult } from '@babel/parser';

export function unrollMaps(ast: ParseResult<t.File>): void {
  const numberMap = new Map<string, Map<string, number>>();

  traverse(ast, {
    ExpressionStatement(path) {
      const expr = path.node.expression;
      if (!t.isAssignmentExpression(expr) || expr.operator !== '=') return;
      if (!t.isObjectExpression(expr.right)) return;
      if (!t.isIdentifier(expr.left)) return;

      const objName = expr.left.name;

      for (const prop of expr.right.properties) {
        if (!t.isObjectProperty(prop)) continue;
        if (!t.isNumericLiteral(prop.value)) continue;

        let keyStr: string | undefined;
        if (t.isStringLiteral(prop.key)) {
          keyStr = prop.key.value;
        } else if (t.isIdentifier(prop.key)) {
          keyStr = prop.key.name;
        }
        if (!keyStr) continue;

        if (!numberMap.has(objName)) {
          numberMap.set(objName, new Map());
        }
        numberMap.get(objName)!.set(keyStr, prop.value.value);
        path.replaceWith(
          t.expressionStatement(t.booleanLiteral(true)),
        );
      }
    },
    MemberExpression(path) {
      if (!t.isIdentifier(path.node.object)) return;
      const objName = path.node.object.name;

      let propName: string | undefined;
      if (t.isIdentifier(path.node.property)) {
        propName = path.node.property.name;
      }
      if (!propName) return;

      const propMap = numberMap.get(objName);
      if (!propMap) return;

      const val = propMap.get(propName);
      if (val === undefined) return;

      path.replaceWith(t.numericLiteral(val));
    },
  });
}
