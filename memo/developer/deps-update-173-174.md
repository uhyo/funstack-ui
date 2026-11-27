# Dependabot #173 + #174 (branch chore/deps-update)

## Why #174 failed (run 45923835911)

1. `ci` job: `format:check`. oxfmt 0.80 reformats two files: `packages/example/index.html`
   (a multi-line `font-family` is joined onto one line) and `packages/ui/src/menubar/menubar.test.tsx`
   (two `vi.fn<...>((next) => ...)` calls). Fixed with `pnpm format`, in its own commit.
2. `browser (chromium)`: `VITEST_BROWSER_CONNECTION_CLOSED` in `src/menu/menu.browser.test.tsx`.
   The renderer crashes. Cause: Playwright 1.65.1 moves Chromium from 156.0.8078.4 (build 1248) to
   159.0.8154.6 (build 1255). The row is the shared suite's "a dismissal's CSS fade keeps running
   through an unrelated view transition" (`src/__tests__/overlay-browser-suite.tsx`). It crashes at
   `await unrelated.ready`. The same row passes when vitest is pointed at the 1248 executable.
   Headless shell and full Chromium 159 both crash.

#173 (@funstack/static 1.3.5) was green on its own.

## Minimal repro (scratch, not committed)

The page is inside an iframe (the vitest tester is one). A popover is closing with a
`display`/`overlay` `allow-discrete` exit transition. `document.startViewTransition()` is called
during the exit, and the renderer crashes before `ready`.

- in an iframe: crash on 159, ok on 156
- top-level document: ok
- in an iframe without the exit transition: ok
- in an iframe without the view transition: ok
- focus moves and anchor positioning make no difference

```html
<style>
  .fade { opacity: 0; transition: opacity 400ms, display 400ms allow-discrete, overlay 400ms allow-discrete; }
  .fade:popover-open { opacity: 1; transition-duration: 0s; }
</style>
<button id="t" popovertarget="p">t</button>
<div id="p" popover="auto" class="fade"><button>item</button></div>
<!-- open, wait two frames, then: p.hidePopover(); document.startViewTransition(() => {}); -->
```

Popover's suite run of the same row does not crash (its dismissal timing differs); Menu's does.

## Decision

- `playwright` is held at `~1.64.1` in `packages/ui/package.json`. `@vitest/browser-playwright` 5.1.1
  takes `playwright: "*"` as its peer, so it stays bumped. The stale optional `playwright@1.65.1`
  entries were removed from the lockfile by hand. `pnpm install` leaves the lockfile unchanged
  afterwards.
- The lockfile is Dependabot's #174 lockfile with #173's `@funstack/static` 1.3.5 resolved on top.
  It is not a fresh re-resolve, because that would pull vitest 5.1.2, vite 8.4 and so on.
- A GitHub issue was NOT filed: creating it was denied by the permission system. Someone should
  file one in this repo (labels bug, infra) with the repro above, plus a to-do for a human to
  report it to Chromium and to un-pin playwright once a fixed Chromium ships.

## Other observations

- oxlint prints 12 React Compiler-style `react(...)` warnings (globals, immutability, refs,
  use-memo). They already appear under oxlint 1.88 on master (checked with `pnpm dlx
  oxlint@1.88.0`), so they are not caused by the bump. `pnpm lint` exits 0.
- Local WebKit lacks host libraries on this machine; WebKit is covered by CI.
