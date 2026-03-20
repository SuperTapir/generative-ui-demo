import { defineConfig } from "tsup";

export default defineConfig([
  {
    entry: {
      index: "src/index.ts",
      renderer: "src/renderer.ts",
      "adapters/openai": "src/adapters/openai.ts",
      "adapters/anthropic": "src/adapters/anthropic.ts",
    },
    format: ["esm", "cjs"],
    dts: true,
    splitting: true,
    clean: true,
    outDir: "dist",
    external: ["morphdom", /^node:/],
  },
]);
