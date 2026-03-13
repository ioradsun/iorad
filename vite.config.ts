import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ["react", "react-dom", "react/jsx-runtime"],
  },
  build: {
    rollupOptions: {
      output: {
        // Force JS chunk extensions so production always serves module chunks
        // with a JavaScript MIME type (prevents .tsx module MIME failures).
        entryFileNames: "assets/[name]-[hash].js",
        chunkFileNames: "assets/[name]-[hash].js",
        assetFileNames: "assets/[name]-[hash][extname]",

        manualChunks(id: string) {
          // Keep only safe vendor splits
          if (id.includes("node_modules/@supabase")) return "supabase";
          if (id.includes("node_modules/framer-motion")) return "framer";

          // App chunks
          if (id.includes("/src/pages/story/") || id.includes("/src/pages/CustomerStory")) return "story";
          if (
            id.includes("/src/pages/Dashboard") ||
            id.includes("/src/pages/Upload") ||
            id.includes("/src/pages/CompanyDetail") ||
            id.includes("/src/pages/AdminSettings") ||
            id.includes("/src/pages/JobHistory") ||
            id.includes("/src/pages/InternalSignals")
          ) return "admin";
        },
      },
    },
  },
}));
