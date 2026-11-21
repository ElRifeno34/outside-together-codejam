import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    // Vite loads .env.local in test mode too. Blank the Supabase variables so tests always
    // run on the in-memory fixtures and can never reach the hosted project.
    env: { VITE_SUPABASE_URL: "", VITE_SUPABASE_ANON_KEY: "" },
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
});
