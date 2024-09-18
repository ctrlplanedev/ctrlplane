import baseConfig, { requireJsSuffix } from "@ctrlplane/eslint-config/base";
import { vitestEslintConfig } from "@ctrlplane/eslint-config/vitest";

/** @type {import('typescript-eslint').Config} */
export default [
  { ignores: ["coverage/**/*"] },
  ...vitestEslintConfig,
  ...requireJsSuffix,
  ...baseConfig,
];
