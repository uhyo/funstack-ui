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
 * dev-warning hooks, and of the dev-only arguments of other calls (`DEV_ARGUMENTS`). A name in
 * those arguments that the module declares (`fileDeclarations`: a top-level helper such as
 * Select.Trigger's `firstChildOfSelect`, #161, or a closure inside a component) is followed into
 * its declaration: the texts there are dev texts too, and must fold away with the call. Helpers
 * imported from another module are not followed.
 */
const src = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const DEV_CALLEES = new Set([
  "console.error",
  "console.warn",
  "useDevWarning",
  "useMountFixed",
  "useElementCheck",
  "useNameWarning",
  "useShownNameWarning",
  "useShownDescriptionWarning",
]);

/**
 * Calls whose listed arguments (by index) are development-only, the others being runtime
 * values: `useSelectPartRef(component, tag, position)` takes its position check's message, while
 * the part name (`"Select.GroupLabel"`) is also a production string.
 */
const DEV_ARGUMENTS = new Map<string, readonly number[]>([["useSelectPartRef", [2]]]);

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

const FUNCTION_TYPES = new Set(["ArrowFunctionExpression", "FunctionExpression"]);

/**
 * The declarations a name in a dev argument is followed into: the module's top-level functions
 * and constants (exported or not), and functions declared at any depth (a message-building
 * closure inside a component). Not nested non-function variables: those are mostly runtime
 * values (a selector, a part name) that a dev call merely reads. Names are not scoped, so two
 * declarations of one name are both followed.
 */
function fileDeclarations(program: AstNode): Map<string, AstNode[]> {
  const declarations = new Map<string, AstNode[]>();
  const added = new Set<AstNode>();
  const add = (name: string, node: AstNode) => {
    if (added.has(node)) return;
    added.add(node);
    const list = declarations.get(name);
    if (list === undefined) declarations.set(name, [node]);
    else list.push(node);
  };
  const declare = (node: AstNode, anyInit: boolean): void => {
    if (node.type === "FunctionDeclaration" && isNode(node.id)) add(node.id.name as string, node);
    if (node.type === "VariableDeclaration") {
      for (const declarator of node.declarations as AstNode[]) {
        if (
          isNode(declarator.id) &&
          declarator.id.type === "Identifier" &&
          isNode(declarator.init) &&
          (anyInit || FUNCTION_TYPES.has(declarator.init.type))
        ) {
          add(declarator.id.name as string, declarator.init);
        }
      }
    }
  };
  for (const statement of program.body as AstNode[]) {
    declare(
      statement.type === "ExportNamedDeclaration" && isNode(statement.declaration)
        ? statement.declaration
        : statement,
      true,
    );
  }
  const visit = (node: AstNode): void => {
    declare(node, false);
    for (const child of children(node)) visit(child);
  };
  visit(program);
  return declarations;
}

/**
 * The static text pieces (string literals, template chunks) under `node`, following names of
 * the module's declarations (`fileDeclarations`, each name once).
 */
function texts(
  node: AstNode,
  out: Set<string>,
  declarations: ReadonlyMap<string, readonly AstNode[]>,
  followed: Set<string>,
): void {
  if (node.type === "Literal" && typeof node.value === "string") out.add(node.value);
  if (node.type === "TemplateElement") {
    const cooked = (node.value as { cooked: string | null }).cooked;
    if (cooked !== null) out.add(cooked);
  }
  if (node.type === "Identifier") {
    const name = node.name as string;
    const found = declarations.get(name);
    if (found !== undefined && !followed.has(name)) {
      followed.add(name);
      for (const declaration of found) texts(declaration, out, declarations, followed);
    }
  }
  for (const child of children(node)) texts(child, out, declarations, followed);
}

/** Dev-warning texts of one file: string pieces long enough to be distinctive. */
function devTexts(path: string): Map<string, string> {
  const program = parseAst(readFileSync(path, "utf8"), { lang: path.endsWith("x") ? "tsx" : "ts" });
  const declarations = fileDeclarations(program as unknown as AstNode);
  const found = new Map<string, string>();
  const visit = (node: AstNode): void => {
    if (node.type === "CallExpression" && isNode(node.callee)) {
      const name = calleeName(node.callee);
      const args = node.arguments as AstNode[];
      const devArgs =
        name === null
          ? []
          : DEV_CALLEES.has(name)
            ? args
            : (DEV_ARGUMENTS.get(name) ?? []).flatMap((i) => args[i] ?? []);
      if (devArgs.length > 0) {
        const pieces = new Set<string>();
        for (const argument of devArgs) texts(argument, pieces, declarations, new Set());
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
    // The collector works: the library has well over a hundred dev messages, including texts
    // returned by a module-level function passed to a check (#161).
    expect(dev.size).toBeGreaterThan(100);
    const collected = [...dev.keys()];
    for (const fragment of [
      "must be the first child of Select.Root's <select>",
      "must be the first child of a Select.Group's <optgroup>",
    ]) {
      expect(
        collected.some((text) => text.includes(fragment)),
        fragment,
      ).toBe(true);
    }

    const code = await productionBundle();
    // The bundle is real: production errors (a part outside its Root) stay.
    expect(code).toContain("must be rendered inside a Popover.Root");

    const leaked = [...dev].filter(([text]) => code.includes(text)).map(([t, w]) => `${w}: ${t}`);
    expect(leaked).toEqual([]);
  });
});
