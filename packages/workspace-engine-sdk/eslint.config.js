import baseConfig from "@ctrlplane/eslint-config/base";

/** @type {import('typescript-eslint').Config} */
export default [
  {
    ignores: ["dist/**", "node_modules/**", "src/schema.ts"],
  },
  ...baseConfig,
];
