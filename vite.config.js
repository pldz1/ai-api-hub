import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import path from "path";

export default defineConfig({
  base: "./",
  plugins: [vue()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    host: "127.0.0.1",
    port: 20090,
  },
  build: {
    emptyOutDir: true,
    sourcemap: false,
    rollupOptions: {
      output: {
        entryFileNames: "assets/entry-[name]-[hash].js",
        chunkFileNames: "assets/chunk-[name]-[hash].js",
        assetFileNames: "assets/[name]-[hash][extname]",
        manualChunks(id) {
          if (!id.includes("node_modules")) return;

          if (id.includes("/vue/") || id.includes("/vue-router/") || id.includes("/vuex/")) {
            return "framework";
          }

          if (id.includes("/highlight.js")) {
            return "highlight";
          }

          return "vendor";
        },
      },
    },
  },
});
