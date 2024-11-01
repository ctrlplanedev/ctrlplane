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
    optimizePackageImports: ["bullmq", "googleapis"],
    /** @see https://github.com/open-telemetry/opentelemetry-js/issues/4297 */
    serverComponentsExternalPackages: [
      "@opentelemetry/sdk-node",
      "@opentelemetry/auto-instrumentations-node",
      "@appsignal/opentelemetry-instrumentation-bullmq",
      "@opentelemetry/exporter-trace-otlp-http",
      "@opentelemetry/resources",
      "@opentelemetry/semantic-conventions",
    ],
  },
  // This is for tracing:
  webpack: (config, { isServer }) => {
    if (isServer == null)
      config.resolve.fallback = {
        // Disable the 'tls' module on the client side
        tls: false,
      };
    return config;
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
