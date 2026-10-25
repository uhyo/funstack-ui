// prepack: copies the docs site's Markdown edition (packages/docs/dist/markdown, written by the
// docs build) into dist/docs, so the published package carries it for the funstack-ui-knowledge
// skill. The docs depend on this package, so the docs build cannot run from here: build it first
// (`pnpm turbo run build --filter=docs`, which also builds this package).
import { cp, rm, stat } from "node:fs/promises";

const source = new URL("../../docs/dist/markdown/", import.meta.url);
const target = new URL("../dist/docs/", import.meta.url);

try {
  await stat(new URL("index.md", source));
} catch {
  console.error(
    "copy-docs: ../docs/dist/markdown/index.md is missing. Build the docs first: pnpm turbo run build --filter=docs",
  );
  process.exit(1);
}
await rm(target, { recursive: true, force: true });
await cp(source, target, { recursive: true });
console.log("copy-docs: copied the Markdown edition into dist/docs");
