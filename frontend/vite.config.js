import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import process from "node:process";

export default defineConfig({
  plugins: [react()],
  envDir: "../",
  // Only these public settings may enter browser code (never Gemini credentials).
  envPrefix: ["VITE_FIREBASE_", "VITE_GEMINI_TIMEOUT_MS"],
  server: {
    port: Number(process.env.PORT) || 5173,
    strictPort: true,
    // Vercel owns /api when it launches Vite; avoid proxying back to itself.
    proxy: process.env.VERCEL_CLI_VERSION ? undefined : {
      "/api": {
        target: "http://localhost:3000",
        changeOrigin: true,
      },
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return undefined;
          if (id.includes("react") || id.includes("react-router-dom")) return "react";
          if (id.includes("firebase")) return "firebase";
          if (id.includes("@tanstack")) return "query";
          return undefined;
        },
      },
    },
  },
});
