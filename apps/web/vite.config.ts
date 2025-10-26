import { reactRouter } from "@react-router/dev/vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tailwindcss(), reactRouter(), tsconfigPaths()],
  server: {
    proxy: {
      // Proxy requests starting with '/api'
      "/api": {
        target: "http://localhost:8080", // The address of your backend server
        changeOrigin: true, // Changes the origin of the host header to the target URL
      },
    },
  },
});
