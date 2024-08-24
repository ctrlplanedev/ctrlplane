import baseConfig, {
  requireJsSuffix,
  restrictEnvAccess,
} from "@ctrlplane/eslint-config/base";

/** @type {import('typescript-eslint').Config} */
export default [
  {
    ignores: ["dist/**"],
  },
  ...baseConfig,
  ...requireJsSuffix,
  ...restrictEnvAccess,
];
