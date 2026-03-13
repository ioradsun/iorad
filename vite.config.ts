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
        manualChunks: {
          story: ["src/pages/CustomerStory", "src/pages/story/*"],
          admin: [
            "src/pages/Dashboard",
            "src/pages/Upload",
            "src/pages/CompanyDetail",
            "src/pages/AdminSettings",
            "src/pages/JobHistory",
            "src/pages/InternalSignals",
          ],
        },
      },
    },
  },
}));
