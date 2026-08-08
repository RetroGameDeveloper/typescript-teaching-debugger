import { defineConfig } from "vite";

export default defineConfig(({ mode }) => ({
  base: mode === "demo" ? "/typescript-teaching-debugger/" : "/",
  build:
    mode === "demo"
      ? {
          outDir: "demo-dist",
        }
      : {
          lib: {
            entry: "src/ts-teaching-debugger.ts",
            name: "TsTeachingDebugger",
            formats: ["es", "umd"],
            fileName: (format) =>
              format === "es"
                ? "ts-teaching-debugger.js"
                : "ts-teaching-debugger.umd.cjs",
          },
          sourcemap: true,
          emptyOutDir: true,
        },
  test: {
    environment: "happy-dom",
    coverage: {
      reporter: ["text", "html"],
    },
  },
}));
