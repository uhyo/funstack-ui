# Developer memo: vitest browser mode (2026-10-15, issue #18)

- vitest 5 splits the Playwright provider into `@vitest/browser-playwright` (exports `playwright()`),
  which depends on `@vitest/browser` and peers on `playwright` (`*`) and an exact `vitest` version.
  Keep `vitest` and `@vitest/browser-playwright` on the same patch version.
- Two projects in `packages/ui/vitest.config.ts`: `jsdom` (`*.test.tsx`, excludes
  `*.browser.test.tsx`) and `browser` (`*.browser.test.tsx`, headless Chromium). `vitest run`
  covers both; `--project jsdom` / `--project browser` select one.
- `@testing-library/react` and `@testing-library/jest-dom/vitest` work unchanged in browser mode,
  so the setup file is shared and `vitest-browser-react` is not needed.
- `toggle` on a popover is dispatched from a queued task; `beforetoggle` is synchronous.
- Playwright pinned to `^1.63.0` with the lockfile on 1.63.0 because the sandbox could not reach
  `storage.googleapis.com` to download Chromium 1248 (1.64.1); Chromium 1243 (1.63.0) was already in
  `~/.cache/ms-playwright`. Bump freely once a download works.
- Firefox (1543) and WebKit (2359) builds for 1.63.0 are not cached locally and were not verified;
  they are opt-in via `BROWSERS=chromium,firefox,webkit`.
- vitest writes `__screenshots__/` next to failing browser tests; it is gitignored.
