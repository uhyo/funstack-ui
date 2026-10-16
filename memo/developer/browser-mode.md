# Developer memo: vitest browser mode (2026-10-15, issue #18)

- vitest 5 splits the Playwright provider into `@vitest/browser-playwright` (exports `playwright()`),
  which depends on `@vitest/browser` and peers on `playwright` (`*`) and an exact `vitest` version.
  Keep `vitest` and `@vitest/browser-playwright` on the same patch version.
- Two projects in `packages/ui/vitest.config.ts`: `jsdom` (`*.test.tsx`, excludes
  `*.browser.test.tsx`) and `browser` (`*.browser.test.tsx`, headless Chromium, Firefox, WebKit). `vitest run`
  covers both; `--project jsdom` / `--project browser` select one.
- `@testing-library/react` and `@testing-library/jest-dom/vitest` work unchanged in browser mode,
  so the setup file is shared and `vitest-browser-react` is not needed.
- `toggle` on a popover is dispatched from a queued task; `beforetoggle` is synchronous.
- 2026-10-16 (issue #23): Playwright bumped to 1.64.1 (Chromium 156.0.8078.4, Firefox 157.0,
  WebKit 27.2); `cdn.playwright.dev` downloads work now. The old `storage.googleapis.com` problem
  is gone.
- Engine selection lives in `vitest.config.ts` (`selectBrowsers`): `FUNSTACK_BROWSERS` explicit
  list > `CI` (all three) > local detection. Detection: `browserType.executablePath()` exists and,
  on Linux, the build directory (the one holding `INSTALLATION_COMPLETE`) also has
  `DEPENDENCIES_VALIDATED`, which `playwright install` writes only when the host libraries check
  out. So an installed WebKit without its system libs is skipped locally instead of failing.
- `turbo.json` lists `FUNSTACK_BROWSERS` and `CI` as `env` of `test:run` / `test:browser`: turbo's
  strict env mode would otherwise hide them, and the cache key must change with the engine list.
- With several instances, `--project browser` still selects all of them (instance projects are
  named `browser (chromium)` etc.).
- This WSL box (Ubuntu 22.04, no sudo) cannot pass WebKit's host check: the ldd-linked libraries
  can be fetched with `apt-get download` + `dpkg-deb -x` and `LD_LIBRARY_PATH`, but
  `libGLESv2.so.2` and `libx264.so` are checked through `/sbin/ldconfig -p`, which ignores
  `LD_LIBRARY_PATH`. Skipping the host check was not permitted, so WebKit was not run locally;
  CI's `--with-deps` job is its first real run.
- Engine-aware tests: `src/__tests__/engine.ts` (`browserName` from `server.browser`,
  `supportsPopoverHint`, `supportsInterestFor`). See `cross-engine.md`.
- vitest writes `__screenshots__/` next to failing browser tests; it is gitignored.
