import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * Guards conventions 7.2: the unbundled build keeps each client file's "use client" directive,
 * and directive-free files (index files, JS-free primitives) do not gain one.
 *
 * Runs over `dist`, so `pnpm build` must precede `pnpm test:run` (turbo wires this up).
 */
const dist = resolve(dirname(fileURLToPath(import.meta.url)), "../../dist");

const clientFiles = [
  "toggle/toggle.mjs",
  "internal/use-controllable-action.mjs",
  "internal/use-render.mjs",
];

const directiveFreeFiles = ["index.mjs", "toggle/index.mjs", "internal/action-details.mjs"];

function startsWithUseClient(file: string): boolean {
  const path = resolve(dist, file);
  if (!existsSync(path)) {
    throw new Error(`${path} does not exist; run \`pnpm build\` before \`pnpm test:run\`.`);
  }
  return /^"use client";/.test(readFileSync(path, "utf8").trimStart());
}

describe("built files", () => {
  it.each(clientFiles)('%s starts with "use client"', (file) => {
    expect(startsWithUseClient(file)).toBe(true);
  });

  it.each(directiveFreeFiles)('%s does not start with "use client"', (file) => {
    expect(startsWithUseClient(file)).toBe(false);
  });
});
