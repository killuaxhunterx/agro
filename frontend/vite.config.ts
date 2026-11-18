import { fileURLToPath } from "node:url";

import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

// Em dev o Vite repassa /api para o Go: mesma origem, cookie de sessão sem CORS.
const apiTarget = `http://localhost:${process.env.DEV_API_PORT ?? "8981"}`;

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "#app": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  server: {
    port: Number(process.env.DEV_WEB_PORT ?? 5974),
    proxy: { "/api": apiTarget },
  },
  test: {
    environment: "jsdom",
    css: false,
    env: { TZ: "UTC" },
  },
});
