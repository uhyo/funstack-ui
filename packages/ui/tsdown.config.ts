import { defineConfig } from "tsdown";

export default defineConfig({
  entry: [
    "src/index.ts",
    "src/button/index.ts",
    "src/toggle/index.ts",
    "src/accordion/index.ts",
    "src/tabs/index.ts",
    "src/tooltip/index.ts",
    "src/switch/index.ts",
    "src/checkbox/index.ts",
    "src/dialog/index.ts",
    "src/radio-group/index.ts",
    "src/checkbox-group/index.ts",
    "src/popover/index.ts",
    "src/menu/index.ts",
    "src/select/index.ts",
    "src/combobox/index.ts",
    "src/toast/index.ts",
    "src/slider/index.ts",
    "src/number-field/index.ts",
    "src/field/index.ts",
    "src/form/index.ts",
    "src/progress/index.ts",
    "src/meter/index.ts",
    "src/toggle-group/index.ts",
    "src/toolbar/index.ts",
  ],
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
