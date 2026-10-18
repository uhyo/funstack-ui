/// <reference types="node" />
// Build guard (#72): make render errors during prerendering fail the docs build.
//
// @funstack/static 1.3 renders the Server Components with React's `renderToReadableStream` and
// prerenders the HTML with `prerender` from react-dom/static, without an `onError` option on
// either. React's default handlers only log errors with console.error, so a Server Component
// error (for example "Functions cannot be passed directly to Client Components") or an error
// inside a Suspense boundary during prerendering leaves the build at exit code 0 with a broken
// page. The plugin has no option to make them fatal, so this module adds two checks around the
// build:
//
// 1. Every console.error during the build is recorded (and still printed). React reports both
//    Server Components errors and prerender errors this way, and a healthy build logs none.
// 2. After the build, the output is scanned for the traces an error leaves: a Suspense boundary
//    the prerender gave up on (`<!--$!-->`, client-rendered on load) in the HTML, and an error row
//    (`<id>:E{...}`) in the RSC payloads used for client navigation.
//
// Either finding throws, which fails `vite build` and therefore CI.
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { format } from "node:util";

/** HTML comment React writes for a Suspense boundary that errored during prerendering. */
const erroredBoundaryMarker = "<!--$!-->";
/** An error row in a React Server Components payload, for example `1a:E{"digest":"..."}`. */
const rscErrorRow = /^[0-9a-f]+:E\{/m;

/** Runs `build`, then throws if it logged errors or wrote pages with render-error traces. */
export async function guardBuild(build: () => Promise<void>, outDir: string): Promise<void> {
  const logged: string[] = [];
  const originalError = console.error;
  console.error = (...args: unknown[]) => {
    logged.push(format(...args));
    originalError(...args);
  };
  try {
    await build();
  } finally {
    console.error = originalError;
  }

  const problems = logged.map(
    (message) => `console.error during the build: ${message.split("\n", 1)[0]}`,
  );
  problems.push(...(await scanOutput(outDir)));
  if (problems.length > 0) {
    throw new Error(
      `The docs build rendered with errors (#72); fix them instead of shipping broken pages:\n` +
        problems.map((p) => `  - ${p}`).join("\n"),
    );
  }
}

async function scanOutput(outDir: string): Promise<string[]> {
  const problems: string[] = [];
  const files = await readdir(outDir, { recursive: true, withFileTypes: true });
  for (const file of files) {
    if (!file.isFile()) continue;
    const filePath = path.join(file.parentPath, file.name);
    const relative = path.relative(outDir, filePath);
    if (file.name.endsWith(".html")) {
      const html = await readFile(filePath, "utf8");
      if (html.includes(erroredBoundaryMarker)) {
        problems.push(`${relative}: a Suspense boundary errored during prerendering`);
      }
    } else if (file.name.endsWith(".txt") && relative.startsWith(`funstack__${path.sep}`)) {
      const payload = await readFile(filePath, "utf8");
      if (rscErrorRow.test(payload)) {
        problems.push(`${relative}: the RSC payload contains an error row`);
      }
    }
  }
  return problems;
}
