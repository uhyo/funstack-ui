import { defineConfig } from "tsdown";

export default defineConfig({
  entry: ["src/index.ts", "src/toggle/index.ts", "src/accordion/index.ts"],
  format: ["esm"],
  // One output file per source file so that each file's "use client" directive survives
  // (conventions 7.2). Bundling would strip the directive from non-entry files.
  unbundle: true,
  dts: true,
  clean: true,
  // Generates the `exports` map (root entry plus per-component subpaths) from `entry`.
  exports: true,
  // The directive is preserved in unbundle mode (verified by src/__tests__/directives.test.ts);
  // rolldown's generic "may not be preserved" warning is noise here.
  checks: { moduleLevelDirective: false },
  external: ["react", "react-dom", "react/jsx-runtime"],
});
