import baseConfig, { requireJsSuffix } from "@ctrlplane/eslint-config/base";

/** @type {import('typescript-eslint').Config} */
export default [
  {
    ignores: [".nitro/**", ".output/**", "dist/**", "node_modules/**"],
  },
  ...requireJsSuffix,
  ...baseConfig,
];
