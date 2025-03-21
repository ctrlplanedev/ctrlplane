import baseConfig, { restrictEnvAccess } from "@ctrlplane/eslint-config/base";
import nextjsConfig from "@ctrlplane/eslint-config/nextjs";
import reactConfig from "@ctrlplane/eslint-config/react";
import reactCompilerConfig from "@ctrlplane/eslint-config/react-compiler";

/** @type {import('typescript-eslint').Config} */
export default [
  {
    ignores: [".next/**"],
  },
  ...baseConfig,
  ...reactConfig,
  ...nextjsConfig,
  ...restrictEnvAccess,
  ...reactCompilerConfig,
];
