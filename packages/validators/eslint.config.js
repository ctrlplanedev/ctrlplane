import baseConfig, { requireJsSuffix } from "@ctrlplane/eslint-config/base";

/** @type {import('typescript-eslint').Config} */
export default [
  {
    ignores: ["dist/**"],
  },
  ...requireJsSuffix,
  ...baseConfig,
];
