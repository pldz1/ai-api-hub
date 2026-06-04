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
    proxy: {
      "/io/llm/ai-api-hub-dashscope-proxy": {
        target: "https://dashscope.aliyuncs.com",
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/io\/llm\/ai-api-hub-dashscope-proxy/, ""),
        configure: (proxy) => {
          proxy.on("error", (err, req) => {
            console.error("[proxy error]", req.method, req.url, err.message);
          });
          proxy.on("proxyRes", (proxyRes, req) => {
            if (proxyRes.statusCode >= 400) {
              console.warn("[proxy upstream]", proxyRes.statusCode, req.method, req.url);
            }
          });
        },
      },
    },
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
