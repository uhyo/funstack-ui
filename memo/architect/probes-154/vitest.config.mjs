// Probe config for #154: runs the probes in this directory with the ui package's dependencies.
// From the repository root:
//   pnpm --filter @funstack/ui exec vitest run --config ../../memo/architect/probes-154/vitest.config.mjs
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "../../..");
const ui = join(root, "packages/ui");

export default {
  root: here,
  resolve: {
    alias: [
      { find: /^@funstack\/ui\/button$/, replacement: join(ui, "src/button/index.ts") },
      {
        find: /^(react|react-dom|@testing-library\/react)(\/.*)?$/,
        replacement: `${ui}/node_modules/$1$2`,
      },
    ],
    dedupe: ["react", "react-dom"],
  },
  server: { fs: { allow: [root] } },
  test: {
    environment: "jsdom",
    include: ["*.probe.test.tsx"],
    globals: true,
  },
};
