// Fails when a design document names a source file that does not exist.
//
// Scans `design/**/*.md` (not `design/CHANGELOG.md`, which is history and may
// name files that are gone) for code spans that look like a file path
// (`internal/use-latest.ts`, `src/toggle/toggle.tsx`, `toggle.test.tsx`) and
// checks each against the repository. A path resolves when it exists relative
// to the document or to one of the roots below; a bare file name resolves when
// any file under the packages, `docs/`, `design/` or `memo/` has that name.
// Build output (`dist/...`), package specifiers and name suffixes are skipped.
//
// Run: `node scripts/check-design-refs.mjs` (part of `pnpm lint`).
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { basename, dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const repo = join(dirname(fileURLToPath(import.meta.url)), "..");
const designDir = join(repo, "design");
const skippedDocs = new Set(["CHANGELOG.md"]);
const roots = [
  "",
  "packages/ui",
  "packages/ui/src",
  "packages/docs",
  "packages/docs/src",
  "packages/example",
  "packages/example/src",
];
// A bare file name (`use-latest.ts`, `platform-features.md`) may live anywhere here.
const nameDirs = ["packages/ui", "packages/docs", "packages/example", "docs", "design", "memo"];
const ignoredDirs = new Set(["node_modules", "dist", ".turbo", ".git"]);
const pathPattern = /^[\w@./-]+\.(?:tsx?|mts|mjs|css|json|md)$/;
// Not files in the repository: placeholders and globs, name suffixes
// (`.browser.test.tsx`, `-root.tsx`), build output and package specifiers.
const ignoredPattern = /[<>*{}]|^[.@-]|^dist\/|(?:^|\/)(?:foo|bar|x|name|component)\./;

function walk(dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (ignoredDirs.has(entry.name)) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

const knownNames = new Set();
for (const dir of nameDirs) {
  for (const file of walk(join(repo, dir))) knownNames.add(basename(file));
}

function resolves(ref, docDir) {
  if (existsSync(join(docDir, ref))) return true;
  if (!ref.includes("/")) return knownNames.has(ref) || existsSync(join(repo, ref));
  return roots.some((root) => existsSync(join(repo, root, ref)));
}

const missing = [];
for (const doc of walk(designDir)) {
  if (!doc.endsWith(".md") || skippedDocs.has(relative(designDir, doc))) continue;
  let fenced = false;
  readFileSync(doc, "utf8")
    .split("\n")
    .forEach((line, index) => {
      if (line.trimStart().startsWith("```")) {
        fenced = !fenced;
        return;
      }
      if (fenced) return;
      for (const match of line.matchAll(/`([^`\s]+)`/g)) {
        const ref = match[1];
        if (!pathPattern.test(ref) || ignoredPattern.test(ref)) continue;
        if (!resolves(ref, dirname(doc))) {
          missing.push(`${relative(repo, doc)}:${index + 1}: ${ref}`);
        }
      }
    });
}

if (missing.length > 0) {
  console.error(`design/ names ${missing.length} file(s) that do not exist:\n`);
  for (const line of missing) console.error(`  ${line}`);
  console.error(
    "\nFix the path, or drop the reference if the file is gone. History belongs in\ndesign/CHANGELOG.md, which is not checked.",
  );
  process.exit(1);
}
console.log("design/: every file reference resolves.");
