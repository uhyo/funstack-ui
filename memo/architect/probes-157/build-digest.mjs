// Digest of what `@funstack/ui` ships, in a form that does not depend on where a file of
// `internal/` lives (#157, memo/architect/157-internal-reorg.md). Run it before and after the
// move and diff the two outputs: they must be identical.
//
//   pnpm --filter @funstack/ui build
//   node memo/architect/probes-157/build-digest.mjs [--repo <dir>] > before.txt
//
// Part 1, "bundle": each entry of tsdown.config.ts bundled the way a consumer would (rolldown,
// NODE_ENV=production, minified, React external): bytes, gzip bytes, sha256. A moved module
// changes no byte here unless the move changed code or the order modules run in.
//
// Part 2, "dist": every file of packages/ui/dist except the declaration maps, keyed by its path
// with the internal subfolder removed, hashed after its relative specifiers are reduced to
// their base name and its `//#region` path comments dropped. Catches a lost "use client", a
// file that stopped being emitted, or a declaration that changed.
import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { gzipSync } from "node:zlib";

const args = process.argv.slice(2);
const repo = resolve(
  args.includes("--repo")
    ? args[args.indexOf("--repo") + 1]
    : join(dirname(fileURLToPath(import.meta.url)), "../../.."),
);
const ui = join(repo, "packages/ui");
const require = createRequire(join(ui, "package.json"));
const { rolldown } = await import(pathToFileURL(require.resolve("rolldown")).href);

const sha = (text) => createHash("sha256").update(text).digest("hex").slice(0, 16);

// --- 1. bundle ---

const entries = readdirSync(join(ui, "src"), { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && !["__tests__", "internal", "bin"].includes(entry.name))
  .map((entry) => `${entry.name}/index.ts`)
  .sort();
entries.unshift("index.ts");

console.log("# bundle (entry, bytes, gzip, sha256)");
for (const entry of entries) {
  const bundle = await rolldown({
    input: join(ui, "src", entry),
    external: (id) => id === "react" || id.startsWith("react/") || id.startsWith("react-dom"),
    transform: { define: { "process.env.NODE_ENV": '"production"' } },
    logLevel: "silent",
  });
  const { output } = await bundle.generate({ format: "esm", minify: true });
  await bundle.close();
  const code = output.map((chunk) => (chunk.type === "chunk" ? chunk.code : "")).join("\n");
  console.log(`${entry}\t${code.length}\t${gzipSync(code).length}\t${sha(code)}`);
}

// --- 2. dist ---

function walk(dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

const dist = join(ui, "dist");
const lines = [];
let total = 0;
for (const file of walk(dist)) {
  if (file.endsWith(".map") || relative(dist, file).startsWith("docs/")) continue;
  const key = relative(dist, file).replace(/^internal\/[a-z-]+\/(?=[^/]+$)/, "internal/");
  const text = readFileSync(file, "utf8");
  total += text.length;
  const normalised = text
    .replace(/(["'])(?:\.{1,2}\/)(?:[\w.-]+\/)*([\w.-]+)\1/g, "$1$2$1")
    .replace(/^\/\/#region .*$/gm, "//#region")
    .replace(/^\/\/# sourceMappingURL=.*$/gm, "");
  const directive = /^"use client";/.test(text.trimStart()) ? "client" : "-";
  lines.push(`${key}\t${directive}\t${sha(normalised)}`);
}
console.log(`\n# dist (${lines.length} files; key, directive, sha256 of the normalised text)`);
// Raw size goes to stderr: it legitimately differs by the length of the moved specifiers.
console.error(`dist raw bytes: ${total}`);
for (const line of lines.sort()) console.log(line);
