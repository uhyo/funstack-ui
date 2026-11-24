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
// a path (`docs/research/button.md 1.2`) names that file. A citation into
// `memo/`, into `design/CHANGELOG.md` or into a document outside those places
// is not checked. "design 14" (a component's own document, with no file name)
// is not checked either: the document is not named.
//
// A citation resolves when the document has a heading with that number
// ("## 14. Title", "### 14.2 Title"), or when the nearest numbered ancestor
// that exists is a stub (its text starts "Moved to `design/CHANGELOG.md`": the
// subsection moved with its parent), or when the document has no numbered
// heading at all (a pointer document such as `overlay-open-change.md`).
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
const sectionNumber = String.raw`\d+(?:\.\d+)*`;
// 1: the path before the name, 2: the document's name, 3: "conventions" with no ".md",
// 4: the number, or a list of numbers.
const citationPattern = new RegExp(
  String.raw`(?:((?:[\w.-]+/)*)([a-z][\w-]*)\.md|\b([Cc]onventions))` +
    String.raw`,?\s+(?:sections?\s+|§\s*)?` +
    String.raw`(${sectionNumber}(?:(?:\s*[,/]\s*|\s+and\s+)${sectionNumber})*)(?![\w%])`,
  "g",
);

// "design 14" in a component's folder: that component's own document(s).
const ownCitationPattern = new RegExp(
  String.raw`\b[Dd]esign\s+(?:sections?\s+)?` +
    String.raw`(${sectionNumber}(?:(?:\s*[,/]\s*|\s+and\s+)${sectionNumber})*)(?![\w%])`,
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

/** The numbered headings of a document, and which of them are stubs. */
function readSections(file) {
  const numbers = new Set();
  const stubs = new Set();
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
      if (line.startsWith("Moved to `design/CHANGELOG.md`")) stubs.add(awaitingBody);
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

/** The document a citation names, or null when it is not one this check covers. */
function citedDocument(prefix, name) {
  if (name === undefined) return join(designDir, "conventions.md");
  const file = `${name}.md`;
  if (prefix) {
    if (prefix.includes("memo/")) return null;
    for (const base of ["", "design", "design/components", "docs"]) {
      const full = join(repo, base, prefix, file);
      if (existsSync(full)) return full;
    }
    return null;
  }
  for (const dir of ["design", "design/components", "docs/research"]) {
    const full = join(repo, dir, file);
    if (existsSync(full)) return full;
  }
  return null;
}

function sectionResolves({ numbers, stubs }, section) {
  if (numbers.size === 0 || numbers.has(section)) return true;
  const parts = section.split(".");
  while (parts.length > 1) {
    parts.pop();
    const parent = parts.join(".");
    if (numbers.has(parent)) return stubs.has(parent);
  }
  return false;
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
        if (!own.some((doc) => sectionResolves(sectionsOf(doc), section))) {
          unresolved.push(
            `${relative(repo, file)}:${line}: ${own.map((doc) => relative(repo, doc)).join(" / ")} ${section} (in "${match[0].trim()}")`,
          );
        }
      }
    }
    for (const match of text.matchAll(citationPattern)) {
      const doc = citedDocument(match[1], match[2]);
      if (doc === null || skippedDocs.has(relative(designDir, doc))) continue;
      const sections = sectionsOf(doc);
      const line = lineStarts.findLastIndex((start) => start <= match.index) + 1;
      for (const section of match[4].match(new RegExp(sectionNumber, "g"))) {
        citations++;
        if (!sectionResolves(sections, section)) {
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
    '\nFix the number in the comment. A section that leaves a document keeps its heading and a\none-line stub ("Moved to `design/CHANGELOG.md` ..."), so citations of it keep resolving.\n',
  );
}
if (missing.length > 0 || unresolved.length > 0) process.exit(1);
console.log("design/: every file reference resolves.");
console.log(`source: all ${citations} section citations resolve.`);
