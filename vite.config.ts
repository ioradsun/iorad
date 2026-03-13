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
        manualChunks(id: string) {
          // Vendor chunks — split heavy libraries into stable cached chunks
          // Note: @tanstack and @radix-ui depend on React internals and must NOT
          // be separated into their own chunks to avoid duplicate-React / MIME errors.
          if (id.includes("node_modules/@supabase")) return "supabase";
          if (id.includes("node_modules/lucide-react")) return "lucide";
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
