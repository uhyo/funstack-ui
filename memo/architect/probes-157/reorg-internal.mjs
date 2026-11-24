// Codemod for the `internal/` reorganisation (#157, memo/architect/157-internal-reorg.md).
//
//   node memo/architect/probes-157/reorg-internal.mjs [--repo <dir>] [--only action,form,overlay] [--write] [--no-git]
//
// Without --write it only reports. With --write it
//   1. moves each mapped file of packages/ui/src/internal/ into its subfolder (`git mv`, or a
//      plain rename with --no-git),
//   2. recomputes every relative specifier in packages/ui/src (`from "..."`, `import "..."`,
//      `import("...")`, `vi.mock("...")`) from the old and new location of both ends,
//   3. rewrites textual mentions `internal/<file>.<ext>` (comments in the source, the lists of
//      `__tests__/directives.test.ts`, code spans in `design/**/*.md` except CHANGELOG.md).
//
// It is idempotent per folder: `--only overlay`, commit, `--only form`, commit, ... gives the
// same tree as one run. It does not touch the fenced file index of design/internal-hooks.md
// (bare file names): regroup that by hand.
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// Module base name (no extension) -> subfolder of internal/. Anything not listed stays flat.
// A test file follows the module it is named after; the exceptions are in TEST_FOLDERS.
const FOLDERS = {
  action: [
    "action-details",
    "call-urgent-handler",
    "report-dropped",
    "use-action-trigger",
    "use-connected",
    "use-controllable-action",
    "use-pure-trigger",
    "use-step-commit",
  ],
  form: [
    "field-context",
    "focus-first-invalid",
    "form-status-watcher",
    "group-member",
    "sync-presence",
    "use-checkable-input",
    "use-field-control",
    "use-fieldset-group",
    "use-form-owner-event",
    "use-form-reset",
    "use-native-checked",
    "use-native-group-reconciliation",
    "use-native-select-value",
    "validity",
  ],
  overlay: [
    "anchor-position",
    "content-focus-probe",
    "css-transition-cut",
    "focus-visible",
    "invokers",
    "modal-registry",
    "overlay-popup",
    "overlay-show",
    "popover-open",
    "trigger-ref",
    "use-apply-open-state",
    "use-exit-animation",
    "use-interest-dismiss",
    "use-modal-registration",
    "use-overlay-close",
    "use-overlay-root",
    "use-popover-popup",
    "use-popover-trigger",
    "use-resolved-placement",
  ],
};
// Test files whose name is not `<module>.test.*` / `<module>.browser.test.*`.
const TEST_FOLDERS = {
  "use-popover-hooks.test.tsx": "overlay",
  "css-transition-cut-cssom.browser.test.ts": "overlay",
};

const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const option = (name) => (args.includes(name) ? args[args.indexOf(name) + 1] : undefined);
const repo = resolve(
  option("--repo") ?? join(dirname(fileURLToPath(import.meta.url)), "../../.."),
);
const only = option("--only")?.split(",");
const write = flag("--write");
const useGit = !flag("--no-git");

const src = join(repo, "packages/ui/src");
const internal = join(src, "internal");

function walk(dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name === "dist") continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

// --- 1. The moves ---

const folderOf = new Map();
for (const [folder, names] of Object.entries(FOLDERS)) {
  if (only && !only.includes(folder)) continue;
  for (const name of names) folderOf.set(name, folder);
}

/** old absolute path -> new absolute path, for the files still flat in internal/. */
const moves = new Map();
const unknownModules = new Set(folderOf.keys());
for (const entry of readdirSync(internal, { withFileTypes: true })) {
  if (!entry.isFile()) continue;
  const base = entry.name.replace(/(?:\.browser)?(?:\.test)?\.tsx?$/, "");
  unknownModules.delete(base);
  let folder = folderOf.get(base);
  const special = TEST_FOLDERS[entry.name];
  if (special !== undefined && (!only || only.includes(special))) folder = special;
  if (folder !== undefined) {
    moves.set(join(internal, entry.name), join(internal, folder, entry.name));
  }
}
// A name that is neither flat nor already in its folder is a typo or a file that is gone.
for (const name of unknownModules) {
  const folder = folderOf.get(name);
  const moved = ["ts", "tsx"].some((ext) => existsSync(join(internal, folder, `${name}.${ext}`)));
  if (!moved) throw new Error(`mapping names internal/${name}, which does not exist`);
}
const newPath = (file) => moves.get(file) ?? file;

// --- 2. Relative specifiers ---

function resolveModule(from, specifier) {
  const base = resolve(dirname(from), specifier);
  const stem = base.replace(/\.js$/, "");
  for (const candidate of [base, `${stem}.ts`, `${stem}.tsx`]) {
    if (existsSync(candidate) && !candidate.endsWith("/")) return candidate;
  }
  return null;
}

const specifierPattern =
  /(\bfrom\s+|\bimport\s+|\bimport\(\s*|\bmock\(\s*|\bimportActual\(\s*)"(\.{1,2}\/[^"]+)"/g;

let specifierEdits = 0;
let mentionEdits = 0;
const edits = new Map(); // old absolute path -> new content

const sourceFiles = walk(src).filter((file) => /\.tsx?$/.test(file));
for (const file of sourceFiles) {
  const before = readFileSync(file, "utf8");
  const after = before.replace(specifierPattern, (whole, lead, specifier) => {
    const target = resolveModule(file, specifier);
    if (target === null || !target.startsWith(src)) return whole;
    let next = relative(dirname(newPath(file)), newPath(target)).replace(/\.tsx?$/, ".js");
    if (!specifier.endsWith(".js")) return whole; // not a module specifier we own (?raw, .css)
    if (!next.startsWith(".")) next = `./${next}`;
    if (next === specifier) return whole;
    specifierEdits++;
    return `${lead}"${next}"`;
  });
  if (after !== before) edits.set(file, after);
}

// --- 3. Textual mentions: `internal/<file>.<ext>` not inside a relative specifier ---

const movedNames = new Map(); // "use-overlay-root" / "use-popover-hooks.test" -> folder
for (const [from, to] of moves) {
  const name = relative(internal, from).replace(/\.tsx?$/, "");
  movedNames.set(name, relative(internal, dirname(to)));
}
const mentionPattern =
  /(?<![./\w-])((?:packages\/ui\/)?(?:src\/)?internal\/)([a-z0-9-]+(?:\.browser)?(?:\.test)?)(\.(?:tsx?|js|mjs|d\.mts)\b)/g;

function rewriteMentions(text) {
  return text.replace(mentionPattern, (whole, lead, name, ext) => {
    const folder = movedNames.get(name);
    if (folder === undefined) return whole;
    mentionEdits++;
    return `${lead}${folder}/${name}${ext}`;
  });
}

const designFiles = walk(join(repo, "design")).filter(
  (file) => file.endsWith(".md") && !file.endsWith("CHANGELOG.md"),
);
for (const file of [...sourceFiles, ...designFiles]) {
  const before = edits.get(file) ?? readFileSync(file, "utf8");
  const after = rewriteMentions(before);
  if (after !== before) edits.set(file, after);
}

// --- Report / apply ---

console.log(`${moves.size} files to move, ${specifierEdits} specifiers and ${mentionEdits} path mentions to rewrite, in ${edits.size} files.`);
if (!write) {
  const byFolder = {};
  for (const [from, to] of moves) {
    (byFolder[relative(internal, dirname(to))] ??= []).push(relative(internal, from));
  }
  for (const [folder, files] of Object.entries(byFolder)) {
    console.log(`\ninternal/${folder}/ (${files.length})\n  ${files.sort().join("\n  ")}`);
  }
  console.log("\nDry run. Pass --write to apply.");
  process.exit(0);
}

for (const [file, content] of edits) writeFileSync(file, content);
for (const [from, to] of moves) {
  mkdirSync(dirname(to), { recursive: true });
  if (useGit) execFileSync("git", ["-C", repo, "mv", from, to]);
  else renameSync(from, to);
}
console.log("Applied.");
