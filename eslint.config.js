import js from "@eslint/js";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tsdoc from "eslint-plugin-tsdoc";
import globals from "globals";
import { dirname } from "path";
import tseslint from "typescript-eslint";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default tseslint.config(
  { ignores: ["dist", "dev", "docs"] },
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
        project: ["./tsconfig.json", "./tsconfig.app.json"],
        tsconfigRootDir: __dirname,
        ecmaVersion: 2018,
        sourceType: "module",
      },
    },
    rules: {
      "tsdoc/syntax": "warn",
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
      //"@typescript-eslint": tseslint,
      "eslint-plugin-tsdoc": tsdoc,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
    },
  },
);
