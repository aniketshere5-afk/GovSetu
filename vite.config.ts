import { jsxLocPlugin } from "@builder.io/vite-plugin-jsx-loc";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

// This file is bundled into the production server (server/_core/vite.ts imports
// it), so it must not rely on `import.meta.dirname` — that is undefined before
// Node 20.11 and would crash the server at startup on older runtimes.
const ROOT_DIR = path.dirname(fileURLToPath(import.meta.url));

// `vite-plugin-manus-runtime` / the Manus debug collector are for the Manus
// hosting preview only. The runtime plugin inlines its own React copy, which
// blanks the page on any other host — so they are deliberately not used here.
const plugins = [react(), tailwindcss(), jsxLocPlugin()];

export default defineConfig({
  plugins,
  resolve: {
    alias: {
      "@": path.resolve(ROOT_DIR, "client", "src"),
      "@shared": path.resolve(ROOT_DIR, "shared"),
      "@assets": path.resolve(ROOT_DIR, "attached_assets"),
    },
  },
  envDir: path.resolve(ROOT_DIR),
  root: path.resolve(ROOT_DIR, "client"),
  publicDir: path.resolve(ROOT_DIR, "client", "public"),
  build: {
    outDir: path.resolve(ROOT_DIR, "dist/public"),
    emptyOutDir: true,
  },
  server: {
    host: true,
    allowedHosts: [
      ".manuspre.computer",
      ".manus.computer",
      ".manus-asia.computer",
      ".manuscomputer.ai",
      ".manusvm.computer",
      "localhost",
      "127.0.0.1",
    ],
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
  },
});
