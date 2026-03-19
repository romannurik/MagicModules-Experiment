import react from "@vitejs/plugin-react";
import path from "path";
import { defineConfig, Plugin } from "vite";
import monacoEditorPlugin from "vite-plugin-monaco-editor-esm";
import { nodePolyfills } from "vite-plugin-node-polyfills";
import tsconfigPaths from "vite-tsconfig-paths";
import { viteStaticCopy } from "vite-plugin-static-copy";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const PYODIDE_EXCLUDE = [
  "!**/*.{md,html}",
  "!**/*.d.ts",
  "!**/*.whl",
  "!**/node_modules",
];

const copyPyodide = () =>
  viteStaticCopy({
    targets: [
      {
        src: [
          join(dirname(fileURLToPath(import.meta.resolve("pyodide"))), "*"),
        ].concat(PYODIDE_EXCLUDE),
        dest: "pyodide",
      },
    ],
  });

const setCoepHeaders = (): Plugin => ({
  name: "configure-server",
  configureServer(server) {
    server.middlewares.use((req, res, next) => {
      if (!req.originalUrl.startsWith("/__auth")) {
        // COEP required for sharedarraybuffer, but breaks Firebase Auth
        // iframe... so set the headers everywhere except where we would
        // call signInWithPopup
        res.setHeader("Cross-Origin-Embedder-Policy", "require-corp");
        res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
      }
      next();
    });
  },
});

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tsconfigPaths(),
    setCoepHeaders(),
    monacoEditorPlugin({}),
    copyPyodide(),
    nodePolyfills({
      include: ["path"],
    }),
  ],
  optimizeDeps: { exclude: ["pyodide"] },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  worker: {
    format: "es",
  },
});
