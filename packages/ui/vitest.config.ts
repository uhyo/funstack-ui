import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { playwright } from "@vitest/browser-playwright";
import { chromium, firefox, webkit } from "playwright";
import { configDefaults, defineConfig } from "vitest/config";
import type { BrowserCommand } from "vitest/node";
import { isolatedTestFiles } from "./src/__tests__/isolated-files.ts";

const browserTypes = { chromium, firefox, webkit } as const;
type BrowserName = keyof typeof browserTypes;
const allBrowsers = Object.keys(browserTypes) as BrowserName[];

/**
 * Whether Playwright's build of `name` is downloaded and its host dependencies passed
 * Playwright's validation. `playwright install` writes `INSTALLATION_COMPLETE` into the build
 * directory after a download and `DEPENDENCIES_VALIDATED` once the host libraries check out, so a
 * build whose system libraries are missing (WebKit on a machine without `--with-deps`) is not
 * picked up by default.
 */
function isInstalled(name: BrowserName): boolean {
  let executable: string;
  try {
    executable = browserTypes[name].executablePath();
  } catch {
    return false;
  }
  if (!existsSync(executable)) return false;
  if (process.platform !== "linux") return true;
  for (let dir = dirname(executable); dir !== dirname(dir); dir = dirname(dir)) {
    if (existsSync(join(dir, "INSTALLATION_COMPLETE"))) {
      return existsSync(join(dir, "DEPENDENCIES_VALIDATED"));
    }
  }
  return true;
}

/**
 * Emulates `prefers-reduced-motion` for the test page (and its frames). Declared for the tests in
 * src/__tests__/browser-commands.ts; a test that turns it on turns it off in `finally`.
 */
const emulateReducedMotion: BrowserCommand<[reduce: boolean]> = async (context, reduce) => {
  await context.page.emulateMedia({ reducedMotion: reduce ? "reduce" : "no-preference" });
};

type MouseButton = "left" | "right" | "middle";

/**
 * Real mouse input at page coordinates (Playwright `page.mouse`), for rows that need a press and
 * a release apart or a click at a point (the context menu, design/components/context-menu.md
 * 13.2). Coordinates are in the top-level page's viewport; the test maps its iframe's client
 * coordinates first (src/__tests__/browser-commands.ts).
 */
const mouse: BrowserCommand<
  [action: "move" | "down" | "up" | "click", x: number, y: number, button?: MouseButton]
> = async (context, action, x, y, button = "left") => {
  const { mouse } = context.page;
  if (action === "click") {
    await mouse.click(x, y, { button });
    return;
  }
  if (action === "move") {
    await mouse.move(x, y);
    return;
  }
  await mouse.move(x, y);
  if (action === "down") await mouse.down({ button });
  else await mouse.up({ button });
};

/**
 * A real wheel turn at a page point (Playwright `page.mouse.wheel` after a move), for the context
 * menu's scroll rows (design/components/context-menu.md 13.2, wave 11). Does not wait for the
 * scroll it may cause.
 */
const wheel: BrowserCommand<[x: number, y: number, deltaX: number, deltaY: number]> = async (
  context,
  x,
  y,
  deltaX,
  deltaY,
) => {
  await context.page.mouse.move(x, y);
  await context.page.mouse.wheel(deltaX, deltaY);
};

/**
 * Engines for the browser project.
 * - `FUNSTACK_BROWSERS=chromium,firefox,webkit` (any subset) selects them explicitly; a missing
 *   build then fails loudly.
 * - In CI (`CI` set) all three run.
 * - Locally, every engine whose Playwright build is installed runs; Chromium always does.
 */
function selectBrowsers(): BrowserName[] {
  const requested = process.env["FUNSTACK_BROWSERS"];
  if (requested) {
    const names = requested
      .split(",")
      .map((name) => name.trim())
      .filter(Boolean);
    for (const name of names) {
      if (!allBrowsers.includes(name as BrowserName)) {
        throw new Error(
          `FUNSTACK_BROWSERS: unknown browser "${name}" (expected ${allBrowsers.join(", ")})`,
        );
      }
    }
    return allBrowsers.filter((name) => names.includes(name));
  }
  if (process.env["CI"]) return allBrowsers;
  return allBrowsers.filter((name) => name === "chromium" || isInstalled(name));
}

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: "jsdom",
          environment: "jsdom",
          include: ["src/**/*.test.{ts,tsx}"],
          exclude: [
            ...configDefaults.exclude,
            "src/**/*.browser.test.{ts,tsx}",
            ...isolatedTestFiles,
          ],
          setupFiles: ["./src/__tests__/vitest.setup.ts"],
          globals: true,
          // Files share a worker's module graph and jsdom window (#107): vitest.setup.ts resets
          // what one file could leave behind for the next, and the files whose leftovers it
          // cannot reset run in `jsdom-isolated` (src/__tests__/isolated-files.ts).
          isolate: false,
          // No `typecheck` here: the type-level rows (`*.types.test.tsx`, `expectTypeOf`) fail
          // through `pnpm typecheck` (tsc over src, test files included). vitest's typecheck
          // matched no file (#101, audit T17).
        },
      },
      {
        test: {
          name: "jsdom-isolated",
          environment: "jsdom",
          include: isolatedTestFiles,
          setupFiles: ["./src/__tests__/vitest.setup.ts"],
          globals: true,
        },
      },
      {
        // Pre-bundle everything the browser tests import up front. A dependency Vite discovers
        // only at runtime (React's entry points are reached through Testing Library and
        // `react-dom/server` through a few suites) triggers a re-optimisation mid-run on a cold
        // cache; files already loaded keep the old `?v=` hash and fail to import.
        optimizeDeps: {
          include: [
            "react",
            "react/jsx-dev-runtime",
            "react/jsx-runtime",
            "react-dom",
            "react-dom/client",
            "react-dom/server",
            "@testing-library/react",
            "@testing-library/user-event",
            "@testing-library/jest-dom/vitest",
          ],
        },
        test: {
          name: "browser",
          include: ["src/**/*.browser.test.{ts,tsx}"],
          setupFiles: ["./src/__tests__/vitest.setup.ts"],
          globals: true,
          browser: {
            enabled: true,
            headless: true,
            provider: playwright(),
            commands: { emulateReducedMotion, mouse, wheel },
            // Firefox runs its files one at a time: headless Firefox shares one mouse and one
            // pointer-capture state between the pages of the browser, so another file's
            // Playwright pointer input lands in a running drag or click (#62).
            instances: selectBrowsers().map((browser) =>
              browser === "firefox" ? { browser, fileParallelism: false } : { browser },
            ),
          },
        },
      },
    ],
  },
});
