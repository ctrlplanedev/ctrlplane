import baseConfig, {
  requireJsSuffix,
  vitestEslintConfig,
} from "@ctrlplane/eslint-config/base";

/** @type {import('typescript-eslint').Config} */
export default [
  { ignores: ["coverage/**/*"] },
  ...vitestEslintConfig,
  ...requireJsSuffix,
  ...baseConfig,
];
