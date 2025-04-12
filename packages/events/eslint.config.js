import baseConfig, {
  requireJsSuffix,
  vitestEslintConfig,
} from "@ctrlplane/eslint-config/base";

/** @type {import('typescript-eslint').Config} */
export default [
  {
    ignores: ["dist/**"],
    rules: {
      "@typescript-eslint/require-await": "off",
    },
  },
  ...vitestEslintConfig,
  ...requireJsSuffix,
  ...baseConfig,
];
