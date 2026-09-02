import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// @ts-expect-error process is a nodejs global
const host = process.env.TAURI_DEV_HOST;

export default defineConfig({
  root: ".",
  plugins: [react(), tailwindcss()],
  // Escape non-ASCII (e.g. Chinese UI strings) as \u sequences in the output JS so
  // rendering never depends on how the webview guesses the script's charset
  // (Windows WebView2 may fall back to the ANSI codepage for charset-less assets).
  esbuild: {
    charset: "ascii",
  },
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      ignored: ["**/src-tauri/**"],
    },
  },
});
