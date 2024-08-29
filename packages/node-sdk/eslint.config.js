import baseConfig, { requireJsSuffix } from "@ctrlplane/eslint-config/base";

/** @type {import('typescript-eslint').Config} */
export default [
  {
    ignores: ["dist/**", "node_modules/**", "*.d.ts"],
  },
  ...requireJsSuffix,
  ...baseConfig,
  {
    files: ["*.ts", "src/**/*.ts"],
    rules: {
      "@typescript-eslint/ban-tslint-comment": "off",
    },
  },
];
