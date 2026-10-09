import js from "@eslint/js";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tsdoc from "eslint-plugin-tsdoc";
import unicorn from "eslint-plugin-unicorn";
import globals from "globals";
import { dirname } from "path";
import tseslint from "typescript-eslint";
import { fileURLToPath } from "url";
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default tseslint.config(
  {
    ignores: [
      "dist",
      "dev",
      "docs",
      "build",
      "coverage",
      "node_modules",
      "**/__tests__/**",
      "**/__mocks__/**",
      "**/__features__/**",
      "**/*.test.ts",
      "**/*.test.tsx",
      "**/*.spec.ts",
      "**/*.spec.tsx",
    ],
  },
  {
    extends: [
      js.configs.recommended,
      ...tseslint.configs.recommended,
      //  , tsdoc.configs.recommended
    ],
    files: ["src/**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      parser: tseslint.parser,
      parserOptions: {
        project: ["./tsconfig.json", "./configs/tsconfig.app.json", "./configs/tsconfig.test.json"],
        tsconfigRootDir: __dirname,
        ecmaVersion: 2018,
        sourceType: "module",
      },
    },
    rules: {
      "tsdoc/syntax": "error",
      "@typescript-eslint/naming-convention": [
        "error",
        {
          selector: "parameter",
          format: ["camelCase"],
          leadingUnderscore: "allow",
          trailingUnderscore: "allow",
        },
        // {
        //   selector: "property",
        //   format: ["camelCase"],
        //   leadingUnderscore: "allow",
        //   trailingUnderscore: "allow",
        // },
        // {
        //   selector: "memberLike",
        //   format: ["camelCase"],
        //   modifiers: ["public"],
        //   leadingUnderscore: "forbid",
        //   trailingUnderscore: "forbid",
        // },
        {
          selector: "memberLike",
          format: ["camelCase"],
          modifiers: ["private", "protected", "#private"],
          leadingUnderscore: "require",
          //trailingUnderscore: "allow",
        },
        {
          selector: "class",
          format: ["PascalCase"],
          leadingUnderscore: "forbid",
          trailingUnderscore: "forbid",
        },
        // {
        //   selector: "default",
        //   format: ["camelCase"],
        //   leadingUnderscore: "allow",
        //   trailingUnderscore: "allow",
        // },
        {
          // Double-underscore globals (e.g. __RESPONSE_AGGREGATE__) must be
          // UPPER_CASE. `filter` scopes this entry to those names only;
          // `allowDouble` strips the surrounding `__` before the format check.
          // The general `variable` rule below covers everything else.
          selector: "variable",
          format: ["UPPER_CASE"],
          leadingUnderscore: "allowDouble",
          trailingUnderscore: "allowDouble",
          filter: {
            regex: "^__|__$",
            match: true,
          },
        },
        {
          selector: "variable",
          format: ["camelCase", "PascalCase", "UPPER_CASE"],
          leadingUnderscore: "allow",
          trailingUnderscore: "allow",
        },
        {
          selector: "import",
          format: ["camelCase", "PascalCase"],
        },
        {
          selector: "function",
          format: ["camelCase", "PascalCase"],
        },
        {
          selector: "typeLike",
          format: ["PascalCase"],
        },
        {
          selector: "enumMember",
          format: ["PascalCase", "UPPER_CASE"],
        },
        {
          selector: "enum",
          format: ["UPPER_CASE", "camelCase", "PascalCase"],
        },
      ],
      /*
      "unicorn/filename-case": [
        "error",
        {
          case: "kebabCase",
          ignore: [
            "^[A-Z][a-z]+(?:[A-Z][a-z]+)*$", // PascalCase
            "^[A-Z_]+$", // UPPER_CASE
          ],
        },
      ],*/
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
      "@typescript-eslint/no-unused-expressions": "error",
      // Log through `Logger` (src/utils/Logger.ts) so output can also reach PostHog Logs.
      "no-console": "error",
      // Logger calls take a message and at most one details object, so every log has the
      // same shape. Put a caught error under the `error` key and its text in the message:
      //   logger.warn(`Failed to load: ${getErrorMessage(error)}`, { error });
      "no-restricted-syntax": [
        "error",
        {
          selector:
            "CallExpression[callee.property.name=/^(trace|debug|info|log|warn|error|fatal)$/]:matches([callee.object.name=/^_?logger$/], [callee.object.property.name=/^_?logger$/])[arguments.length>2]",
          message:
            "Logger calls take a message and at most one details object: logger.warn('msg', { a, b }).",
        },
        {
          selector:
            "CallExpression[callee.property.name=/^(trace|debug|info|log|warn|error|fatal)$/]:matches([callee.object.name=/^_?logger$/], [callee.object.property.name=/^_?logger$/])[arguments.1][arguments.1.type!='ObjectExpression']",
          message:
            "Pass logger details as an object: logger.warn('msg', { value }), and a caught error as { error }.",
        },
        // A lone word ("results", "fuzzResults") says nothing in a log list; describe the event.
        {
          selector:
            "CallExpression[callee.property.name=/^(trace|debug|info|log|warn|error|fatal)$/]:matches([callee.object.name=/^_?logger$/], [callee.object.property.name=/^_?logger$/]) > Literal.arguments[value=/^\\S+$/]",
          message:
            "Write a short phrase describing what happened ('Received search response'), not a single word or variable name.",
        },
        // Details live in the object, so a message ending in ':' just reads as cut off.
        {
          selector:
            "CallExpression[callee.property.name=/^(trace|debug|info|log|warn|error|fatal)$/]:matches([callee.object.name=/^_?logger$/], [callee.object.property.name=/^_?logger$/]) > Literal.arguments[value=/:\\s*$/]",
          message: "End a logger message without a colon: the details go in the object argument.",
        },
        {
          selector:
            "CallExpression[callee.property.name=/^(trace|debug|info|log|warn|error|fatal)$/]:matches([callee.object.name=/^_?logger$/], [callee.object.property.name=/^_?logger$/]) > TemplateLiteral.arguments > TemplateElement[tail=true][value.raw=/:\\s*$/]",
          message: "End a logger message without a colon: the details go in the object argument.",
        },
      ],
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
      //"@typescript-eslint": tseslint,
      tsdoc: tsdoc,
      unicorn: unicorn,
    },
  },
  {
    files: ["**/*.test.ts", "**/*.test.tsx", "**/*.spec.ts", "**/*.spec.tsx", "**/__tests__/**"],
    rules: {
      "@typescript-eslint/naming-convention": "off",
    },
  },
  {
    // The Logger itself, the user-facing dev-console helpers, and the test support
    // files legitimately write to the console.
    files: [
      "src/utils/Logger.ts",
      "src/utils/debugConsole.ts",
      "src/utils/fuzzScorerLab.ts",
      "src/helpers/responseAggregate.ts",
      "**/__fixtures__/**",
      "**/*[Mm]ock*",
      "**/*.test.ts",
      "**/*.test.tsx",
      "**/*.spec.ts",
      "**/*.spec.tsx",
      "**/__tests__/**",
    ],
    rules: {
      "no-console": "off",
    },
  },
);
