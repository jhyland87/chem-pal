import js from "@eslint/js";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tsdoc from "eslint-plugin-tsdoc";
import globals from "globals";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist", "dev", "docs"] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended, tsdoc.configs.recommended],
    files: ["src/**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    parser: "@typescript-eslint/parser",
    parserOptions: {
      project: "./tsconfig.json",
      tsconfigRootDir: __dirname,
      ecmaVersion: 2018,
      sourceType: "module",
    },
    rules: {
      "tsdoc/syntax": "warn",
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
      "@typescript-eslint": tseslint,
      "eslint-plugin-tsdoc": tsdoc,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
    },
  },
);
