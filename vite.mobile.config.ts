import react from "@vitejs/plugin-react";
import { resolve } from "node:path";
import { defineConfig } from "vite";

export default defineConfig({
  root: "mobile",
  base: "./",
  publicDir: resolve(__dirname, "public"),
  plugins: [react()],
  build: {
    outDir: resolve(__dirname, "mobile-dist"),
    emptyOutDir: true,
    rollupOptions: {
      input: {
        app: resolve(__dirname, "mobile/index.html"),
        privacy: resolve(__dirname, "mobile/privacy.html"),
        support: resolve(__dirname, "mobile/support.html"),
      },
    },
  },
});
