import baseConfig from "@ctrlplane/eslint-config/base";
import reactConfig from "@ctrlplane/eslint-config/react";

/** @type {import('typescript-eslint').Config} */
export default [
  {
    ignores: ["**/*.js"],
  },
  ...baseConfig,
  ...reactConfig,
];
