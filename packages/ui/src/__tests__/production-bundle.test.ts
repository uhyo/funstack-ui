// @vitest-environment node
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { rolldown } from "rolldown";
import { parseAst } from "rolldown/parseAst";
import { describe, expect, it } from "vitest";

/**
 * Guards that development-only warning texts never reach a consumer's production bundle: every
 * dev message must sit behind the module's own `const isDev = process.env.NODE_ENV !==
 * "production"` (`isDev && "..."`, `if (isDev) console.error(...)`), so a bundler that replaces
 * `NODE_ENV` and minifies drops the text.
 *
 * The bundle is `src/index.ts` (every public part) built the way a consumer's bundler would:
 * `NODE_ENV` defined as `"production"`, minified, React external. The dev texts are collected
 * from the source: every string in the arguments of `console.error` / `console.warn` and of the
 * dev-warning hooks.
 */
const src = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const DEV_CALLEES = new Set([
  "console.error",
  "console.warn",
  "useDevWarning",
  "useElementCheck",
  "useNameWarning",
  "useShownNameWarning",
]);

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === "__tests__" ? [] : sourceFiles(path);
    return /\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name) ? [path] : [];
  });
}

type AstNode = { type: string; [key: string]: unknown };

function isNode(value: unknown): value is AstNode {
  return typeof value === "object" && value !== null && typeof (value as AstNode).type === "string";
}

function children(node: AstNode): AstNode[] {
  return Object.values(node).flatMap((value) =>
    Array.isArray(value) ? value.filter(isNode) : isNode(value) ? [value] : [],
  );
}

function calleeName(node: AstNode): string | null {
  if (node.type === "Identifier") return node.name as string;
  if (node.type === "MemberExpression" && isNode(node.object) && isNode(node.property)) {
    const object = calleeName(node.object);
    return object === null ? null : `${object}.${node.property.name as string}`;
  }
  return null;
}

/** The static text pieces (string literals, template chunks) under `node`. */
function texts(node: AstNode, out: Set<string>): void {
  if (node.type === "Literal" && typeof node.value === "string") out.add(node.value);
  if (node.type === "TemplateElement") {
    const cooked = (node.value as { cooked: string | null }).cooked;
    if (cooked !== null) out.add(cooked);
  }
  for (const child of children(node)) texts(child, out);
}

/** Dev-warning texts of one file: string pieces long enough to be distinctive. */
function devTexts(path: string): Map<string, string> {
  const program = parseAst(readFileSync(path, "utf8"), { lang: path.endsWith("x") ? "tsx" : "ts" });
  const found = new Map<string, string>();
  const visit = (node: AstNode): void => {
    if (node.type === "CallExpression" && isNode(node.callee)) {
      const name = calleeName(node.callee);
      if (name !== null && DEV_CALLEES.has(name)) {
        const pieces = new Set<string>();
        for (const argument of node.arguments as AstNode[]) texts(argument, pieces);
        for (const piece of pieces) {
          if (piece.trim().length >= 16) found.set(piece, `${relative(src, path)} (${name})`);
        }
      }
    }
    for (const child of children(node)) visit(child);
  };
  visit(program as unknown as AstNode);
  return found;
}

async function productionBundle(): Promise<string> {
  const bundle = await rolldown({
    input: join(src, "index.ts"),
    external: (id) => id === "react" || id.startsWith("react/") || id.startsWith("react-dom"),
    transform: { define: { "process.env.NODE_ENV": '"production"' } },
    logLevel: "silent",
  });
  const { output } = await bundle.generate({ format: "esm", minify: true });
  await bundle.close();
  return output.map((chunk) => (chunk.type === "chunk" ? chunk.code : "")).join("\n");
}

describe("production bundle", () => {
  it("contains no development warning text", { timeout: 60_000 }, async () => {
    const dev = new Map<string, string>();
    for (const file of sourceFiles(src)) {
      for (const [text, where] of devTexts(file)) dev.set(text, where);
    }
    // The collector works: the library has well over a hundred dev messages.
    expect(dev.size).toBeGreaterThan(100);

    const code = await productionBundle();
    // The bundle is real: production errors (a part outside its Root) stay.
    expect(code).toContain("must be rendered inside a Popover.Root");

    const leaked = [...dev].filter(([text]) => code.includes(text)).map(([t, w]) => `${w}: ${t}`);
    expect(leaked).toEqual([]);
  });
});
