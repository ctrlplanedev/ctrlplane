import vitest from "eslint-plugin-vitest";

import baseConfig, { requireJsSuffix } from "@ctrlplane/eslint-config/base";

/** @type {import('typescript-eslint').Config} */
export default [
  {
    ignores: ["dist/**", "__tests__/**", "coverage/**"],
  },
  {
    files: ["__tests__/**", "tests/**"],
    plugins: {
      vitest,
    },
    rules: {
      ...vitest.configs.recommended.rules,
      "vitest/max-nested-describe": ["error", { max: 3 }],
    },
  },
  ...requireJsSuffix,
  ...baseConfig,
];
