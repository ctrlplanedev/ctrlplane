import baseConfig, {
  requireJsSuffix,
  vitestEslintConfig,
} from "@ctrlplane/eslint-config/base";

/** @type {import('typescript-eslint').Config} */
export default [
  { ignores: ["coverage/**", "dist/**"] },
  ...vitestEslintConfig,
  ...requireJsSuffix,
  ...baseConfig,
];
