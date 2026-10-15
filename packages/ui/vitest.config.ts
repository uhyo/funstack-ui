import { playwright } from "@vitest/browser-playwright";
import { configDefaults, defineConfig } from "vitest/config";

const allBrowsers = ["chromium", "firefox", "webkit"] as const;

// Chromium is always required. Set BROWSERS=chromium,firefox,webkit to run the browser project
// against Firefox and WebKit as well (run `pnpm exec playwright install firefox webkit` first).
const requestedBrowsers = new Set((process.env["BROWSERS"] ?? "chromium").split(","));
const browserInstances = allBrowsers
  .filter((browser) => requestedBrowsers.has(browser))
  .map((browser) => ({ browser }));

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: "jsdom",
          environment: "jsdom",
          include: ["src/**/*.test.{ts,tsx}"],
          exclude: [...configDefaults.exclude, "src/**/*.browser.test.{ts,tsx}"],
          setupFiles: ["./src/__tests__/vitest.setup.ts"],
          globals: true,
          typecheck: {
            enabled: true,
          },
        },
      },
      {
        test: {
          name: "browser",
          include: ["src/**/*.browser.test.{ts,tsx}"],
          setupFiles: ["./src/__tests__/vitest.setup.ts"],
          globals: true,
          browser: {
            enabled: true,
            headless: true,
            provider: playwright(),
            instances: browserInstances,
          },
        },
      },
    ],
  },
});
