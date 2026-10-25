import { defineConfig } from "vitest/config";

// Unit tests of the build scripts (src/markdown). Separate from vite.config.ts, whose FUNSTACK
// Static plugin builds the site.
export default defineConfig({
  plugins: [
    {
      // The RSC plugin resolves "server-only" in the site build; on the server it is empty.
      name: "server-only",
      resolveId: (id) => (id === "server-only" ? "\0server-only" : undefined),
      load: (id) => (id === "\0server-only" ? "export {};" : undefined),
    },
  ],
  test: {
    include: ["src/**/*.test.{ts,tsx}"],
    // Process CSS, so the `?raw` imports of the example stylesheets return their text.
    css: true,
  },
});
