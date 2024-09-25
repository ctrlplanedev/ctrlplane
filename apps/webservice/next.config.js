import { fileURLToPath } from "url";
import createJiti from "jiti";

// Import env files to validate at build time. Use jiti so we can load .ts files in here.
createJiti(fileURLToPath(import.meta.url))("./src/env");

/** @type {import("next").NextConfig} */
const config = {
  output: "standalone",
  reactStrictMode: false,
  poweredByHeader: false,

  /** Enables hot reloading for local packages without a build step */
  transpilePackages: [
    "@ctrlplane/api",
    "@ctrlplane/auth",
    "@ctrlplane/db",
    "@ctrlplane/job-dispatch",
    "@ctrlplane/ui",
    "@ctrlplane/logger",
    "@ctrlplane/validators",
  ],

  images: { remotePatterns: [{ hostname: "lh3.googleusercontent.com" }] },

  experimental: {
    instrumentationHook: true,
    optimizePackageImports: [
      "@ctrlplane/ui",
      "@ctrlplane/api",
      "@ctrlplane/job-dispatch",
      "bullmq",
      "@monaco-editor/react",
      "recharts",
      "reactflow",
      "dagre",
      "react-icons",
      "react-grid-layout",
      "react-use",
      "google-auth-library",
      "googleapis",
      "drizzle-orm",
      "pg",
    ],
  },

  async rewrites() {
    return [
      {
        source: "/webshell/ws",
        destination: "http://localhost:4000/webshell/ws",
      },
    ];
  },

  /** We already do linting and typechecking as separate tasks in CI */
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: true },
};

export default config;
