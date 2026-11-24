// Two checks that keep the design documents and the code pointing at each other.
//
// 1. A design document must not name a source file that does not exist.
//
// Scans `design/**/*.md` (not `design/CHANGELOG.md`, which is history and may
// name files that are gone) for code spans that look like a file path
// (`internal/use-latest.ts`, `src/toggle/toggle.tsx`, `toggle.test.tsx`) and
// checks each against the repository. A path resolves when it exists relative
// to the document or to one of the roots below; a bare file name resolves when
// any file under the packages, `docs/`, `design/` or `memo/` has that name.
// Build output (`dist/...`), package specifiers and name suffixes are skipped.
//
// 2. A section citation in the source must resolve to a heading of the document
//    it names.
//
// Scans every source file under `packages/*/src` for `<doc>.md 3.4`,
// `<doc>.md section 3`, `<doc>.md, section 3` and `conventions 3.4` (lists too:
// `button.md 16 / 18`, `popover.md 2.3, 10.2`), also where a comment wraps
// between the name and the number. `<doc>.md` is `design/conventions.md`,
// `design/components/<doc>.md`, else `docs/research/<doc>.md`; a citation with
// a path (`docs/research/button.md 1.2`) names that file. A citation with a
// `memo/` path or into `design/CHANGELOG.md` is not checked; any other document
// name that resolves nowhere fails (a typo, a renamed document, a memo cited
// without its path). "design 14" in a component's folder is checked against
// that component's own document (`ownDocumentNames` below for the folders whose
// document has another name); in `internal/` and `__tests__/` it is not
// checked, because no document is named.
//
// A citation resolves when the document has a heading with that number
// ("## 14. Title", "### 14.2 Title"), or through a stub: a numbered heading
// whose text starts "Moved to `design/<file>.md`". A stub that names
// `design/CHANGELOG.md` resolves itself and everything under it (the section
// is history). A stub that names another design document resolves when that
// document has a heading with the cited number: a section keeps its number
// when it moves, so "conventions 13.2" is `design/placement.md` 13.2. A
// document with no numbered heading at all resolves any number (a pointer
// document such as `overlay-open-change.md`). A number with a letter glued to
// it (`3.4a`) does not resolve.
//
// Not checked (known gaps): a component name without `.md` ("Popover 3.4"), a
// second number after prose ("design 11, walkthrough 10, and 12.5": only 11),
// ranges ("3.4-3.9": only the first), `popover.md (3.4)`, "section 9 of
// conventions", a backtick after the name, and citations between the design
// documents themselves.
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

// --- 1. File names in the design documents ---

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

// --- 2. Section citations in the source ---

const sourceRoots = ["packages/ui/src", "packages/docs/src", "packages/example/src"];
const sourcePattern = /\.(?:tsx?|mts|mjs|css)$/;
// A number, with any letters glued to it ("3.99a") so that such a citation fails instead of
// being read as its prefix.
const sectionNumber = String.raw`\d+(?:\.\d+)*(?![\d%]|\.\d)[A-Za-z]*`;
// 1: the path before the name, 2: the document's name, 3: "conventions" with no ".md",
// 4: the number, or a list of numbers.
const citationPattern = new RegExp(
  String.raw`(?:((?:[\w.-]+/)*)([a-z][\w-]*)\.md|\b([Cc]onventions))` +
    String.raw`,?\s+(?:sections?\s+|§\s*)?` +
    String.raw`(${sectionNumber}(?:(?:\s*[,/]\s*|\s+and\s+)${sectionNumber})*)`,
  "g",
);

// "design 14" in a component's folder: that component's own document(s).
const ownCitationPattern = new RegExp(
  String.raw`\b[Dd]esign\s+(?:sections?\s+)?` +
    String.raw`(${sectionNumber}(?:(?:\s*[,/]\s*|\s+and\s+)${sectionNumber})*)`,
  "g",
);
const ownDocumentNames = {
  field: ["field-form"],
  form: ["field-form"],
  menu: ["menu", "context-menu"],
  meter: ["progress"],
  toolbar: ["toggle-group"],
};

/** The design documents of the component folder a source file is in; none outside one. */
function ownDocuments(file) {
  const [, , , folder, rest] = relative(repo, file).split("/");
  if (rest === undefined || !relative(repo, file).startsWith("packages/ui/src/")) return [];
  return (ownDocumentNames[folder] ?? [folder])
    .map((name) => join(designDir, "components", `${name}.md`))
    .filter((doc) => existsSync(doc));
}

/**
 * The numbered headings of a document, and which of them are stubs: `stubs` maps a number to
 * the design document its section moved to, or to `null` for the changelog.
 */
function readSections(file) {
  const numbers = new Set();
  const stubs = new Map();
  let fenced = false;
  let awaitingBody = null;
  for (const line of readFileSync(file, "utf8").split("\n")) {
    if (line.trimStart().startsWith("```")) {
      fenced = !fenced;
      continue;
    }
    if (fenced) continue;
    const heading = /^#{1,6}\s+(\d+(?:\.\d+)*)\.?(?:\s|$)/.exec(line);
    if (heading) {
      numbers.add(heading[1]);
      awaitingBody = heading[1];
    } else if (awaitingBody !== null && line.trim() !== "") {
      const moved = /^Moved to `(design\/[\w./-]+\.md)`/.exec(line);
      if (moved) stubs.set(awaitingBody, moved[1] === "design/CHANGELOG.md" ? null : moved[1]);
      awaitingBody = null;
    }
  }
  return { numbers, stubs };
}

const sectionCache = new Map();
function sectionsOf(file) {
  if (!sectionCache.has(file)) sectionCache.set(file, readSections(file));
  return sectionCache.get(file);
}

/**
 * The document a citation names; `null` when the check does not cover it (a memo), `undefined`
 * when the name resolves nowhere.
 */
function citedDocument(prefix, name) {
  if (name === undefined) return join(designDir, "conventions.md");
  const file = `${name}.md`;
  if (prefix) {
    if (prefix.includes("memo/")) return null;
    for (const base of ["", "design", "design/components", "docs"]) {
      const full = join(repo, base, prefix, file);
      if (existsSync(full)) return full;
    }
    return undefined;
  }
  for (const dir of ["design", "design/components", "docs/research"]) {
    const full = join(repo, dir, file);
    if (existsSync(full)) return full;
  }
  return undefined;
}

function sectionResolves(file, section) {
  const { numbers, stubs } = sectionsOf(file);
  if (numbers.size === 0) return true;
  // The section itself, else its nearest numbered ancestor that exists.
  const parts = section.split(".");
  let found = section;
  while (!numbers.has(found)) {
    parts.pop();
    if (parts.length === 0) return false;
    found = parts.join(".");
  }
  if (!stubs.has(found)) return found === section;
  const target = stubs.get(found);
  if (target === null) return true; // moved to the changelog: history
  const moved = join(repo, target);
  return existsSync(moved) && moved !== file && sectionResolves(moved, section);
}

const unresolved = [];
let citations = 0;
for (const root of sourceRoots) {
  for (const file of walk(join(repo, root))) {
    if (!sourcePattern.test(file)) continue;
    // Join the lines without a comment's leader, so a citation that wraps is one match.
    let text = "";
    const lineStarts = [];
    for (const line of readFileSync(file, "utf8").split("\n")) {
      lineStarts.push(text.length);
      text += `${line.replace(/^\s*(?:\*|\/\/+)\s?/, "")} `;
    }
    const own = ownDocuments(file);
    for (const match of own.length > 0 ? text.matchAll(ownCitationPattern) : []) {
      const line = lineStarts.findLastIndex((start) => start <= match.index) + 1;
      for (const section of match[1].match(new RegExp(sectionNumber, "g"))) {
        citations++;
        if (!own.some((doc) => sectionResolves(doc, section))) {
          unresolved.push(
            `${relative(repo, file)}:${line}: ${own.map((doc) => relative(repo, doc)).join(" / ")} ${section} (in "${match[0].trim()}")`,
          );
        }
      }
    }
    for (const match of text.matchAll(citationPattern)) {
      const doc = citedDocument(match[1], match[2]);
      if (doc === null) continue;
      const line = lineStarts.findLastIndex((start) => start <= match.index) + 1;
      if (doc === undefined) {
        citations++;
        unresolved.push(
          `${relative(repo, file)}:${line}: no document "${match[1] ?? ""}${match[2]}.md" in design/, design/components/ or docs/research/ (in "${match[0].trim()}"); cite a memo with its memo/ path`,
        );
        continue;
      }
      if (skippedDocs.has(relative(designDir, doc))) continue;
      for (const section of match[4].match(new RegExp(sectionNumber, "g"))) {
        citations++;
        if (!sectionResolves(doc, section)) {
          unresolved.push(
            `${relative(repo, file)}:${line}: ${relative(repo, doc)} ${section} (in "${match[0].trim()}")`,
          );
        }
      }
    }
  }
}

// --- Report ---

if (missing.length > 0) {
  console.error(`design/ names ${missing.length} file(s) that do not exist:\n`);
  for (const line of missing) console.error(`  ${line}`);
  console.error(
    "\nFix the path, or drop the reference if the file is gone. History belongs in\ndesign/CHANGELOG.md, which is not checked.\n",
  );
}
if (unresolved.length > 0) {
  console.error(`The source cites ${unresolved.length} section(s) that do not exist:\n`);
  for (const line of unresolved) console.error(`  ${line}`);
  console.error(
    '\nFix the number in the comment. A section that leaves a document keeps its heading and a\none-line stub ("Moved to `design/<file>.md` ..."), so citations of it keep resolving.\n',
  );
}
if (missing.length > 0 || unresolved.length > 0) process.exit(1);
console.log("design/: every file reference resolves.");
console.log(`source: all ${citations} section citations resolve.`);
