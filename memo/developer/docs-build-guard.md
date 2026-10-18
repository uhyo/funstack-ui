# Docs build guard (#72)

- Root cause: @funstack/static 1.3.2 calls `renderToReadableStream` (RSC, `dist/rsc/entry.mjs`
  `build()`) and `prerender` (SSR, `dist/ssr/entry.mjs`) without `onError`. React's default
  handler is `console.error`, so errors never reach `buildApp`. A Flight error becomes an `E` row
  in the payload; SSR throws at that position, the nearest Suspense boundary is emitted as
  `<!--$!--><template></template><!--/$-->` (client-rendered), and the page is nearly empty. No
  plugin option to change this.
- Guard: `packages/docs/src/buildGuard.ts`, used by `src/build.ts` (the `build` hook module, which
  runs in the same Node process as RSC and SSR rendering). Wraps `console.error` during `build()`
  and scans `outDir` afterwards for `<!--$!-->` in HTML and `^[0-9a-f]+:E\{` rows in
  `funstack__/**.txt`. Any finding throws -> `vite build` exits 1.
- Verified with `<Meter.Value>{() => "x"}</Meter.Value>` in `MeterStorage.tsx`: all three checks
  fired (6 console errors, 1 payload error row, meter.html errored boundary), exit 1. Clean build
  exit 0, no false positives.
- If a dependency ever logs a harmless console.error during the build, the guard will fail; fix
  or filter it in `guardBuild` explicitly rather than removing the check.
- Upstream report text posted on #72 for a human to file.
