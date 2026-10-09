/**
 * Build-time instrumentation that records where each `logger.warn(...)` / `logger.error(...)`
 * call lives in the source, so PostHog Logs can show the file, line and function that logged.
 *
 * A runtime stack trace can't do this in production: the shipped bundle is minified, so a
 * frame reads `assets/SupplierBase-ZwvXu1dh.js:1:43210`, and PostHog Logs does not apply
 * source maps. The original positions only exist at build time, so this rewrites the call
 * itself:
 *
 *     this.logger.warn("Bad response", { url })
 *       -> this.logger.warnAt("suppliers/SupplierBase.ts:1431#SupplierBase.fetch", "Bad response", { url })
 *
 * `Logger` implements the `*At` methods (extra first argument, otherwise identical).
 * Passing the location as an argument, rather than via a flag set before the call, costs no
 * allocation and stays correct when an argument expression itself logs.
 *
 * Detection is AST-based (the `typescript` package), so comments and strings that merely
 * contain `logger.warn(` are never touched. Only the receivers `logger`, `_logger` and
 * `this.logger` are matched; any other spelling is left alone and simply carries no
 * location, which the sender treats as normal.
 */

import MagicString from "magic-string";
import path from "node:path";
import ts from "typescript";

/** Receivers recognised as a `Logger` instance: `logger`, `_logger`, `this.logger`. */
const RECEIVER = /^(?:this\.)?_?logger$/;

/** Source files that are never instrumented: tests, mocks, fixtures and declarations. */
const SKIPPED_FILE = /__tests__|__mocks__|__fixtures__|\.test\.|\.spec\.|[Mm]ock|\.d\.ts$/;

/**
 * Finds the name of the function or method a node sits in, for the `code.function` attribute.
 * Anonymous callbacks are skipped so the nearest named enclosing function is reported.
 *
 * @param {import("typescript").Node} node - The call expression being instrumented.
 * @returns {string | undefined} E.g. `"SupplierBase.fetch"`, `"parseTitle"`, or `undefined`
 * at module level.
 * @example
 * // inside `class Foo { bar() { this.logger.warn("x") } }`
 * enclosingName(callNode); // => "Foo.bar"
 */
function enclosingName(node) {
  for (let current = node.parent; current; current = current.parent) {
    if (
      ts.isMethodDeclaration(current) ||
      ts.isConstructorDeclaration(current) ||
      ts.isGetAccessorDeclaration(current) ||
      ts.isSetAccessorDeclaration(current)
    ) {
      const name = ts.isConstructorDeclaration(current) ? "constructor" : current.name.getText();
      let owner = current.parent;
      while (owner && !ts.isClassLike(owner)) owner = owner.parent;
      return owner?.name ? `${owner.name.text}.${name}` : name;
    }
    if (ts.isFunctionDeclaration(current) && current.name) {
      return current.name.text;
    }
    if (ts.isArrowFunction(current) || ts.isFunctionExpression(current)) {
      const holder = current.parent;
      if (ts.isVariableDeclaration(holder) && ts.isIdentifier(holder.name)) {
        return holder.name.text;
      }
      if (ts.isPropertyAssignment(holder) || ts.isPropertyDeclaration(holder)) {
        return holder.name.getText();
      }
      // An anonymous callback: keep climbing to the function that contains it.
    }
  }
  return undefined;
}

/**
 * Whether a file under `src/` should be scanned for logger calls.
 *
 * @param {string} file - Absolute path of the module (query string already removed).
 * @param {string} srcRoot - Absolute path of the `src` directory.
 * @returns {boolean} `true` for app TypeScript, `false` for tests, mocks, declarations, the
 * `Logger` class itself, and anything outside `src/`.
 * @example
 * isInstrumentable("/repo/src/suppliers/SupplierBase.ts", "/repo/src"); // => true
 * isInstrumentable("/repo/src/utils/__tests__/Logger.test.ts", "/repo/src"); // => false
 */
export function isInstrumentable(file, srcRoot) {
  if (!file.startsWith(srcRoot + path.sep)) return false;
  if (!/\.tsx?$/.test(file) || SKIPPED_FILE.test(file)) return false;
  return path.relative(srcRoot, file).split(path.sep).join("/") !== "utils/Logger.ts";
}

/**
 * Rewrites the instrumented logger calls in one module.
 *
 * @param {string} code - The module's TypeScript source.
 * @param {string} file - Absolute path of the module.
 * @param {{ levels?: readonly string[], srcRoot: string }} options - `levels` are the logger
 * methods to instrument (default `warn`, `error`); `srcRoot` is the absolute `src` directory
 * the reported paths are relative to.
 * @returns {{ code: string, map: object } | undefined} The rewritten source and its source map,
 * or `undefined` when nothing in the module matched.
 * @example
 * injectCallSites('this.logger.warn("x");', "/repo/src/a.ts", { srcRoot: "/repo/src" });
 * // => { code: 'this.logger.warnAt("a.ts:1", "x");', map: {...} }
 */
export function injectCallSites(code, file, { levels = ["warn", "error"], srcRoot }) {
  const wanted = new Set(levels);
  const source = ts.createSourceFile(
    file,
    code,
    ts.ScriptTarget.Latest,
    true,
    file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  const relativePath = path.relative(srcRoot, file).split(path.sep).join("/");
  const rewritten = new MagicString(code);
  let count = 0;

  /**
   * Visits every node, instrumenting matching logger calls.
   * @param {import("typescript").Node} node - The node to inspect.
   */
  const visit = (node) => {
    if (
      ts.isCallExpression(node) &&
      !node.typeArguments &&
      ts.isPropertyAccessExpression(node.expression) &&
      wanted.has(node.expression.name.text) &&
      RECEIVER.test(node.expression.expression.getText(source))
    ) {
      const name = node.expression.name;
      const nameStart = name.getStart(source);
      const open = code.indexOf("(", name.getEnd());
      if (open !== -1) {
        const line = source.getLineAndCharacterOfPosition(nameStart).line + 1;
        const fn = enclosingName(node);
        const location = JSON.stringify(`${relativePath}:${line}${fn ? `#${fn}` : ""}`);
        rewritten.appendLeft(name.getEnd(), "At");
        rewritten.appendLeft(open + 1, node.arguments.length > 0 ? `${location}, ` : location);
        count += 1;
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(source);

  if (count === 0) return undefined;
  return {
    code: rewritten.toString(),
    map: rewritten.generateMap({ hires: "boundary", source: file }),
  };
}

/**
 * Vite plugin that instruments logger calls in the app's own source (see the module doc).
 *
 * @param {{ levels?: readonly string[], root?: string }} [options] - `levels` are the logger
 * methods to instrument; `root` is the project root containing `src/`.
 * @returns {import("vite").Plugin} A `pre`-enforced plugin, so it sees the original TypeScript
 * and the line numbers it records match the source files.
 * @example
 * plugins: [logCallSitesPlugin({ levels: ["warn", "error"], root: __dirname })]
 */
export function logCallSitesPlugin({ levels = ["warn", "error"], root = process.cwd() } = {}) {
  const srcRoot = path.resolve(root, "src");
  const hint = new RegExp(`\\.(?:${levels.join("|")})\\s*\\(`);
  return {
    name: "chem-pal-log-call-sites",
    enforce: "pre",
    transform(code, id) {
      const file = id.split("?")[0];
      if (!isInstrumentable(file, srcRoot)) return undefined;
      // Cheap checks first: most modules never mention a logger.
      if (!code.includes("ogger") || !hint.test(code)) return undefined;
      return injectCallSites(code, file, { levels, srcRoot });
    },
  };
}
