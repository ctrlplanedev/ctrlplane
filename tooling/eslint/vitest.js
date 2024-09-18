import vitest from "eslint-plugin-vitest";
import tseslint from "typescript-eslint";

/** @type {Awaited<import('typescript-eslint').Config>} */
export const vitestEslintConfig = tseslint.config({
  files: ["__tests__/**", "tests/**"],
  ignores: ["dist/**", "__tests__/**", "coverage/**"],
  plugins: { vitest },
  rules: {
    ...vitest.configs.recommended.rules,
    "vitest/max-nested-describe": ["error", { max: 3 }],
  },
});
