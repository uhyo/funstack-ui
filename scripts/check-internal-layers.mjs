// Keeps the layering of `packages/ui/src/internal/` (design/conventions.md 9.1):
//
//   flat modules  <-  action/  <-  form/
//                              <-  overlay/
//
// A flat module imports from no subfolder, `action/` imports only flat modules (and itself),
// and `form/` and `overlay/` import `action/` and flat modules (and themselves) but not each
// other. Any other subfolder of `internal/` fails: a new one needs a decision and a line here.
//
// Scans every file under `internal/`, tests included, for relative specifiers (`from "..."`,
// `import "..."`, `import("...")`, `vi.mock("...")`) and checks those that resolve inside
// `internal/`. Specifiers that leave `internal/` (`../__tests__/helpers.js`, a component's
// index in a test) are not checked.
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const repo = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const internal = join(repo, "packages/ui/src/internal");

/** Layer -> the layers it may import from. */
const ALLOWED = {
  flat: ["flat"],
  action: ["flat", "action"],
  form: ["flat", "action", "form"],
  overlay: ["flat", "action", "overlay"],
};

function* walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(path);
    else if (/\.(ts|tsx|mts)$/.test(entry.name)) yield path;
  }
}

/** The layer of a path inside `internal/`, or `null` for an unknown subfolder. */
function layerOf(path) {
  const parts = relative(internal, path).split(sep);
  if (parts.length === 1) return "flat";
  if (parts.length === 2 && parts[0] in ALLOWED && parts[0] !== "flat") return parts[0];
  return null;
}

const specifier = /(?:\bfrom\s*|\bimport\s*\(?\s*|\bvi\.mock\(\s*)["'](\.{1,2}\/[^"']+)["']/g;

const errors = [];
let files = 0;
let checked = 0;
for (const file of walk(internal)) {
  files++;
  const name = relative(repo, file);
  const layer = layerOf(file);
  if (layer === null) {
    errors.push(
      `${name}: not in a known layer (flat, ${Object.keys(ALLOWED).slice(1).join(", ")})`,
    );
    continue;
  }
  const text = readFileSync(file, "utf8");
  for (const match of text.matchAll(specifier)) {
    const target = resolve(dirname(file), match[1]);
    if (relative(internal, target).startsWith("..")) continue;
    checked++;
    const targetLayer = layerOf(target);
    if (targetLayer === null || !ALLOWED[layer].includes(targetLayer)) {
      const line = text.slice(0, match.index).split("\n").length;
      errors.push(
        `${name}:${line}: ${layer === "flat" ? "a flat module" : `${layer}/`} imports ` +
          `"${match[1]}" (${targetLayer === null ? "unknown layer" : targetLayer === "flat" ? "flat" : `${targetLayer}/`})`,
      );
    }
  }
}

if (errors.length > 0) {
  console.error("internal/ layering (design/conventions.md 9.1):");
  for (const error of errors) console.error(`  ${error}`);
  process.exit(1);
}
console.log(`internal/: ${checked} imports in ${files} files follow the layering.`);
