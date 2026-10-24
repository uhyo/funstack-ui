# Wave 16 phase 4: jsdom without isolation (#107, audit T14)

## Result

- `jsdom` project: `isolate: false`. `jsdom-isolated` project (isolated, default): the files in
  `packages/ui/src/__tests__/isolated-files.ts`. `pnpm test:jsdom` runs both
  (`--project jsdom --project jsdom-isolated`); `pnpm test:run` runs every project.
- Timing (wall, `pnpm test:jsdom` in packages/ui, before/after interleaved, machine load 8-20 from
  other agents): before 30.01 / 29.43 / 30.51 s, after 18.33 / 18.99 / 18.52 s. About -38 %.
  Single worker (`--maxWorkers=1`): 39 s, i.e. that is the CPU the suite really needs.
- Isolated files and why:
  - `*-transition-types.test.tsx` (7 files): `vi.mock("react")`, hoisted per file; in a shared
    graph React is whatever the first file loaded.
  - `csp/csp.test.tsx`: `renderToReadableStream`. Non-legacy Fizz sets `context._currentRenderer`
    to its sigil on push and does not restore it on pop (react-dom-server.node.development.js,
    REACT_CONTEXT_TYPE case), the client's pushProvider then logs "Detected multiple renderers
    concurrently rendering the same context provider" for every context Fizz provided, in every
    later file of the worker. `renderToString` (legacy) uses `_currentRenderer2`: harmless.
    Seen as form.test and popover.test failures ("expected error not to be called") under shuffle.
  - `isolation.test.ts` scans jsdom test files for `vi.mock(` / `vi.doMock(` /
    `renderToReadableStream` / `renderToPipeableStream` / `react-dom/static` and fails unless the
    file matches a pattern of isolated-files.ts.

## Shared state reset (vitest.setup.ts afterEach, after the unmount)

- `resetAnnouncer()` (internal/announce.ts, new test-only export): the fallback live region stays
  in `body` after unmount with pending write timers; a later file's `getByRole("status")` found two
  (progress.test under shuffle). Removed and timers cancelled per test.
- `resetFocusVisibleOption()` (internal/use-popover-popup.ts, new test-only export): the library
  detects `focus({ focusVisible })` once per module graph. menu-context-trigger.test patches
  `focus()` to read the option (quiet-focus path), menu.test expects jsdom's plain path
  (`autofocus`). Now the patch is installed in that file's beforeAll and restored in afterAll, and
  the detection is forgotten after every test. (First tried a global focus shim: broke 3 menu.test
  rows that assert the autofocus path, so per-file it is.)
- Pointer capture: the Slider, NumberField (tracking stubs on HTMLElement, beforeAll, only if
  missing) and Menu context trigger (no-op stubs on Element, module level) suites each installed
  their own; whichever file ran first in a worker won, so Slider could run on Menu's no-op
  `hasPointerCapture` or on NumberField's map that Slider never cleared. Now one tracking shim,
  `__tests__/pointer-capture-shim.ts`, imported by the setup, `capturedPointers.clear()` per test.
- `resetWarnOnce()`, `resetToastServerWarning()`: library once-only warnings (progress/meter and
  toast already reset their own; this makes every file start fresh).
- `vi.useRealTimers()`, `vi.unstubAllGlobals()`, `vi.unstubAllEnvs()`: safety nets; every file
  that fakes or stubs already restores.
- React's own once-only warnings cannot be reset. Only `<selectedcontent>` "is unrecognized" is
  asserted (Select warm-up, `takeSelectedContentWarning`): it now keeps a module flag (the driver
  module lives exactly as long as React's module graph); the first call expects the warning, later
  calls expect no error at all.

## Not reset, deliberately

- React-hoisted `<style>` in `document.head`: React remembers per document which resources it
  inserted; removing them would make React believe they are still there. Rows counting them
  already render into a fresh document (menu-context-trigger, tooltip; T15 fix).
- Caches that depend only on the environment (Intl formatters, `supportsUserInvalid`).

## Residual risk

- A React once-only warning triggered by file A is not logged in file B of the same worker, so a
  new row asserting "no console.error" could pass in CI and fail alone. Only possible for new
  rows (all rows passed isolated before this change). `pnpm test:jsdom --maxWorkers=1` or
  `pnpm --filter @funstack/ui exec vitest run <file>` shows it.

## Shuffle runs (all with `pnpm test:jsdom --sequence.shuffle --sequence.seed=N`)

- Before the announcer / csp fixes: seeds 101 and 707 failed (form "multiple renderers", progress
  two status regions); order-dependent, did not always reproduce.
- Final: seeds 101 202 303 404 505 606 707 808 909 1010 green (3178/3178); plus maxWorkers=1
  (seeds 3046 18560 9841) and maxWorkers=2 (26837 4845 15474) green.
