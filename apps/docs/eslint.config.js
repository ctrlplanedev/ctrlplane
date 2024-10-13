import baseConfig, { restrictEnvAccess } from "@ctrlplane/eslint-config/base";
import nextjsConfig from "@ctrlplane/eslint-config/nextjs";
import reactConfig from "@ctrlplane/eslint-config/react";

/** @type {import('typescript-eslint').Config} */
export default [
  {
    ignores: [".next/**", "out/**", ".remarkrc.js"],
  },
  ...baseConfig,
  ...reactConfig,
  ...nextjsConfig,
  ...restrictEnvAccess,
];
