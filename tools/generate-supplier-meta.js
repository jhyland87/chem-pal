/**
 * Generates `src/constants/supplierMeta.generated.ts` from the supplier classes.
 *
 * The UI needs each supplier's display name, home country and shipping scope before
 * any search has run — the results table's filter, the column drawer's ships-to
 * greying, and the search hook's supplier pre-filter all read them at mount. Reading
 * them off the classes means *evaluating* every supplier module, which drags
 * SupplierBase and its zod/fuzzball/liqe/graphql stack into the popup's startup
 * bundle. Extracting them here keeps the classes the single source of truth while the
 * popup pays nothing.
 *
 * The extraction is a TypeScript AST read of the class declarations — the supplier
 * modules are never imported or executed, so this works without a browser, without
 * `chrome.*`, and without bundling. Only literal initializers are accepted; anything
 * computed at runtime (`SupplierBaseAmazon`'s locale-dependent `baseURL`, and the
 * `requiredHosts` derived from it) deliberately stays on the classes.
 *
 * @module generateSupplierMeta
 */
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import fs from "fs/promises";
import path from "path";
import ts from "typescript";
import { _c, _r, _readFile, _realpath, _y } from "./helpers.js";
import { getSupplierClassNames } from "./supplierList.js";

/** Where the generated registry is written, relative to the repo root. */
const OUTPUT_PATH = "src/constants/supplierMeta.generated.ts";

/** Directory holding the supplier classes, relative to the repo root. */
const SUPPLIERS_DIR = "src/suppliers";

/** Static fields that must be present on every supplier class. */
const REQUIRED_FIELDS = ["supplierName", "country", "shipping"];

/** Static fields extracted into the registry; the rest of a class is ignored. */
const EXTRACTED_FIELDS = [...REQUIRED_FIELDS, "shipsTo"];

/**
 * Reads a property initializer as a plain JS value, unwrapping `as const` /
 * parenthesized expressions first. Only string literals and arrays of string
 * literals are supported — everything else is reported as unextractable so a
 * supplier that computes a field fails the build loudly instead of silently
 * landing `undefined` in the registry.
 *
 * @param {import("typescript").Expression} node - The initializer expression.
 * @returns {string | string[] | undefined} The literal value, or undefined when it isn't one.
 */
function literalValue(node) {
  let expr = node;
  while (ts.isAsExpression(expr) || ts.isParenthesizedExpression(expr)) {
    expr = expr.expression;
  }
  if (ts.isStringLiteral(expr)) {
    return expr.text;
  }
  if (ts.isArrayLiteralExpression(expr) && expr.elements.every(ts.isStringLiteral)) {
    return expr.elements.map((element) => element.text);
  }
  return undefined;
}

/**
 * Extracts the static metadata fields from one supplier source file.
 *
 * @param {string} className - The supplier's class name, which is also its filename.
 * @param {string} source - The file's contents.
 * @returns {{supplierName: string, country: string, shipping: string, shipsTo?: string[]}} The extracted fields.
 * @throws When a required field is missing or isn't a literal.
 */
function extractSupplierMeta(className, source) {
  const sourceFile = ts.createSourceFile(
    `${className}.ts`,
    source,
    ts.ScriptTarget.Latest,
    /* setParentNodes */ true,
  );
  const meta = {};
  ts.forEachChild(sourceFile, (node) => {
    if (!ts.isClassDeclaration(node) || node.name?.text !== className) return;
    for (const member of node.members) {
      if (!ts.isPropertyDeclaration(member) || !member.initializer) continue;
      if (!member.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.StaticKeyword)) {
        continue;
      }
      const field = member.name.getText(sourceFile);
      if (!EXTRACTED_FIELDS.includes(field)) continue;
      const value = literalValue(member.initializer);
      if (value === undefined) {
        throw new Error(
          `${className}.${field} is not a literal — the registry can only mirror literal statics. ` +
            `Either make it a literal or drop it from EXTRACTED_FIELDS and keep it on the class.`,
        );
      }
      meta[field] = value;
    }
  });
  const missing = REQUIRED_FIELDS.filter((field) => meta[field] === undefined);
  if (missing.length > 0) {
    throw new Error(
      `${className} declares no literal ${missing.join(", ")} — every live supplier must ` +
        `declare these as static literals on its own class (inherited values are not read).`,
    );
  }
  return meta;
}

/**
 * Renders the generated TypeScript module.
 *
 * @param {Array<[string, object]>} entries - `[className, meta]` pairs in barrel order.
 * @returns {string} The file contents.
 */
function renderModule(entries) {
  const body = entries
    .map(([className, meta]) => {
      const lines = [
        `    displayName: '${meta.supplierName.replace(/'/g, "\\'")}',`,
        `    country: '${meta.country}',`,
        `    shipping: '${meta.shipping}',`,
      ];
      if (meta.shipsTo) {
        // One entry per line: matches how the classes declare it, and matches what
        // prettier would reformat this to anyway.
        const codes = meta.shipsTo.map((code) => `      '${code}',`).join("\n");
        lines.push(`    shipsTo: [\n${codes}\n    ],`);
      }
      return `  ${className}: {\n${lines.join("\n")}\n  },`;
    })
    .join("\n");

  return `/**
 * GENERATED FILE — DO NOT EDIT.
 *
 * Written by \`tools/generate-supplier-meta.js\` (\`pnpm run generate\`) from the \`static\`
 * fields of the supplier classes, which remain the single source of truth. Change a
 * supplier's name, country, shipping scope or \`shipsTo\` on its class and regenerate;
 * \`src/suppliers/__tests__/supplierMeta.test.ts\` fails if this file drifts.
 *
 * Its reason to exist is bundle size: the UI needs supplier metadata at mount, and
 * reading it off the classes would pull the whole supplier layer into the popup's
 * startup bundle. See \`src/constants/supplierMeta.ts\` for the accessors.
 *
 * @module supplierMetaGenerated
 * @category Constants
 * @group Suppliers
 * @source
 */
import type { SupplierMetaEntry } from './supplierMeta';

/**
 * Display and shipping metadata for every live supplier, keyed by class name, in the
 * order \`src/suppliers/index.ts\` exports them.
 * @category Constants
 * @group Suppliers
 * @source
 */
export const SUPPLIER_META: Readonly<Record<SupplierClassName, SupplierMetaEntry>> = {
${body}
};
`;
}

const classNames = await getSupplierClassNames();

console.log("");
console.log(`Generating ${_c(OUTPUT_PATH)}...`);
console.log(`  Suppliers (${_y(classNames.length)}): ${_c(classNames.join(", "))}`);

const sources = await Promise.all(
  classNames.map(async (className) => [
    className,
    await _readFile(_realpath(path.join(SUPPLIERS_DIR, `${className}.ts`))),
  ]),
);

// Idempotency guard, mirroring the logo generator: this runs on every build and once
// per E2E test file, and the output is a pure function of the supplier sources and
// this script. `--force` / FORCE_SUPPLIER_META=1 bypasses the cache.
const forceRegen = process.argv.includes("--force") || process.env.FORCE_SUPPLIER_META === "1";
const stampFile = _realpath("node_modules/.cache/chempal/supplier-meta-fingerprint");
const fingerprint = createHash("sha256")
  .update(JSON.stringify(sources))
  .update(await _readFile(fileURLToPath(import.meta.url)))
  .digest("hex");

const outputExists = await fs
  .stat(_realpath(OUTPUT_PATH))
  .then(() => true)
  .catch(() => false);

if (!forceRegen) {
  const cachedFingerprint = await _readFile(stampFile).catch(() => undefined);
  if (cachedFingerprint === fingerprint && outputExists) {
    console.log(`  ${_c("Supplier metadata is up to date — skipping generation")} (--force to override)`);
    process.exit(0);
  }
}

let entries;
try {
  entries = sources.map(([className, source]) => [
    className,
    extractSupplierMeta(className, source),
  ]);
} catch (error) {
  console.error(`  ${_r("Failed to extract supplier metadata")}: ${error.message}`);
  process.exit(1);
}

await fs.writeFile(_realpath(OUTPUT_PATH), renderModule(entries));
console.log(`  ${_c(`Wrote ${entries.length} supplier entries`)}`);

await fs.mkdir(_realpath("node_modules/.cache/chempal"), { recursive: true });
await fs.writeFile(stampFile, fingerprint);
