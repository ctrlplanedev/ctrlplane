import baseConfig, {
  requireJsSuffix,
  restrictEnvAccess,
} from "@ctrlplane/eslint-config/base";

/** @type {import('typescript-eslint').Config} */
export default [
  {
    ignores: ["dist/**", "node_modules/**"],
  },
  ...baseConfig,
  ...requireJsSuffix,
  ...restrictEnvAccess,
];
