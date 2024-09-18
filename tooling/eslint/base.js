/// <reference types="./types.d.ts" />

import eslint from "@eslint/js";
import importPlugin from "eslint-plugin-import";
import vitest from "eslint-plugin-vitest";
import tseslint from "typescript-eslint";

/**
 * All packages should use this rule if the package is not used with a bundling
 * tooling
 */
export const requireJsSuffix = tseslint.config({
  files: ["**/*.ts"],
  plugins: { import: importPlugin },
  rules: {
    "import/extensions": ["error", "always", { ignorePackages: true }],
  },
});

/**
 * All packages that leverage t3-env should use this rule
 */
export const restrictEnvAccess = tseslint.config({
  files: ["**/*.js", "**/*.ts", "**/*.tsx"],
  rules: {
    "no-restricted-properties": [
      "error",
      {
        object: "process",
        property: "env",
        message:
          "Use `import { env } from '~/env'` instead to ensure validated types.",
      },
    ],
    "no-restricted-imports": [
      "error",
      {
        name: "process",
        importNames: ["env"],
        message:
          "Use `import { env } from '~/env'` instead to ensure validated types.",
      },
    ],
  },
});

/**
 * All packages that leverage vitest should use this rule
 */
/** @type {Awaited<import('typescript-eslint').Config>} */
export const vitestEslintConfig = tseslint.config({
  files: ["__tests__/**", "tests/**"],
  plugins: { vitest },
  rules: {
    ...vitest.configs.recommended.rules,
    "vitest/max-nested-describe": ["error", { max: 3 }],
  },
  ignores: ["dist/**", "__tests__/**", "coverage/**"],
});

export default tseslint.config(
  {
    // Globally ignored files
    ignores: ["**/*.config.*"],
  },
  {
    files: ["**/*.js", "**/*.ts", "**/*.tsx"],
    plugins: {
      import: importPlugin,
    },
    extends: [
      eslint.configs.recommended,
      ...tseslint.configs.recommended,
      ...tseslint.configs.recommendedTypeChecked,
      ...tseslint.configs.stylisticTypeChecked,
    ],
    rules: {
      "@typescript-eslint/no-unsafe-return": "off",
      "@typescript-eslint/no-unsafe-call": "error",
      "@typescript-eslint/no-unsafe-assignment": "off",
      "@typescript-eslint/no-unsafe-member-access": "off",
      "@typescript-eslint/consistent-type-definitions": "off",
      "@typescript-eslint/no-unsafe-argument": "off",
      "@typescript-eslint/no-empty-function": "off",
      "@typescript-eslint/array-type": "off",
      "@typescript-eslint/no-non-null-assertion": "off",
      "@typescript-eslint/no-floating-promises": "off",
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/consistent-type-imports": [
        "warn",
        { prefer: "type-imports", fixStyle: "separate-type-imports" },
      ],
      "@typescript-eslint/no-misused-promises": [
        2,
        { checksVoidReturn: { attributes: false } },
      ],
      "@typescript-eslint/no-unnecessary-condition": [
        "error",
        { allowConstantLoopConditions: true },
      ],
      "import/consistent-type-specifier-style": ["error", "prefer-top-level"],
    },
  },
  {
    linterOptions: { reportUnusedDisableDirectives: true },
    languageOptions: { parserOptions: { project: true } },
  },
);
