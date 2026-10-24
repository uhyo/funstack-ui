import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, matchesGlob, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";
import { isolatedTestFiles } from "./isolated-files.js";

/**
 * Guards the split of vitest.config.ts (#107): the `jsdom` project runs its files without
 * isolation, so a file that mocks a module (`vi.mock` is hoisted per file) or streams a server
 * render (Fizz marks the contexts it provided) must be listed in isolated-files.ts.
 */
const root = join(dirname(fileURLToPath(import.meta.url)), "../..");

function jsdomFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return jsdomFiles(path);
    return /\.test\.tsx?$/.test(entry.name) && !/\.browser\.test\.tsx?$/.test(entry.name)
      ? [relative(root, path)]
      : [];
  });
}

const isolated = (path: string) => isolatedTestFiles.some((glob) => matchesGlob(path, glob));

it("every jsdom file that mocks a module or streams a server render runs isolated", () => {
  const files = jsdomFiles(join(root, "src"));
  const leaking = files.filter((path) =>
    /\bvi\.(?:do)?[m]ock\(|\brenderTo(?:ReadableStream|PipeableStream)\b|react-dom\/static/.test(
      readFileSync(join(root, path), "utf8"),
    ),
  );
  // The scan finds the known ones.
  expect(leaking).toContain("src/tabs/tabs-transition-types.test.tsx");
  expect(leaking).toContain("src/csp/csp.test.tsx");
  expect(leaking.filter((path) => !isolated(path))).toEqual([]);
  // Every pattern still names a file.
  for (const glob of isolatedTestFiles) {
    expect(files.some((path) => matchesGlob(path, glob))).toBe(true);
  }
});
