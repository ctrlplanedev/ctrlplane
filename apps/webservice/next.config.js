import { fileURLToPath } from "url";
import withBundleAnalyzer from "@next/bundle-analyzer";
import createJiti from "jiti";

// Import env files to validate at build time. Use jiti so we can load .ts files in here.
createJiti(fileURLToPath(import.meta.url))("./src/env");

/** @type {import("next").NextConfig} */
const config = {
  output: "standalone",
  reactStrictMode: false,

  /** Enables hot reloading for local packages without a build step */
  transpilePackages: [
    "@ctrlplane/api",
    "@ctrlplane/auth",
    "@ctrlplane/db",
    "@ctrlplane/ui",
    "@ctrlplane/validators",
    "@ctrlplane/job-dispatch",
  ],

  images: {
    remotePatterns: [{ hostname: "lh3.googleusercontent.com" }],
  },

  experimental: {
    instrumentationHook: true,
    optimizePackageImports: ["googleapis"],
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

const bundleAnalyzer = withBundleAnalyzer({
  enabled: process.env.ANALYZE === "true",
});

export default bundleAnalyzer(config);
