// Checks that the package tarball carries what the funstack-ui-knowledge skill needs: the skill,
// its installer bin and the bundled Markdown docs. Runs `pnpm pack --dry-run`, which runs
// prepack (copy-docs.mjs) too, so the docs must be built first.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

// tsdown writes `bin` into package.json on every build (tsdown.config.ts).
const { bin } = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
if (bin?.["funstack-ui-skill-installer"] !== "./dist/bin/skill-installer.mjs") {
  console.error(`check-pack: unexpected bin field ${JSON.stringify(bin)}`);
  process.exit(1);
}

const output = execFileSync("pnpm", ["pack", "--dry-run", "--json"], { encoding: "utf8" });
// prepack's own output comes first.
const { files } = JSON.parse(output.slice(output.indexOf("\n{") + 1));
const paths = new Set(files.map((file) => file.path));
const required = [
  "skills/funstack-ui-knowledge/SKILL.md",
  "dist/bin/skill-installer.mjs",
  "dist/docs/index.md",
  "dist/docs/getting-started.md",
  "dist/docs/components/dialog.md",
  "README.md",
];
const missing = required.filter((path) => !paths.has(path));
if (missing.length > 0) {
  console.error(`check-pack: missing from the tarball: ${missing.join(", ")}`);
  process.exit(1);
}
const docs = [...paths].filter((path) => path.startsWith("dist/docs/") && path.endsWith(".md"));
console.log(`check-pack: OK (${paths.size} files, ${docs.length} Markdown docs)`);
