import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"], // ESM only for Node.js server
  dts: false, // Not needed for server apps
  splitting: false,
  sourcemap: true,
  clean: true,
  target: "node24",
  tsconfig: "./tsconfig.json", // Use tsconfig for path resolution
  esbuildOptions(options) {
    // Ensure .js extensions are preserved for ESM
    options.outExtension = { ".js": ".js" };
  },
});
