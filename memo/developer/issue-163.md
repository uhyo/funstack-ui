# #163 Collapsible (developer notes)

Branch `feat/163-collapsible`, from `origin/design/163-collapsible` (a7ebb08c) rebased onto
master 41a15d53.

## What was built

- `packages/ui/src/collapsible/`: context, Root (`<details>`, state owner), Trigger
  (`<summary>`), Panel (`div`), index. All `"use client"`. Subpath `@funstack/ui/collapsible`
  (tsdown entry, package.json exports), root re-export.
- Shared with Accordion: `internal/details-summary.ts` (flat; `"use client"` because the element
  checks are hooks). `interceptSummaryClick(event)` is the click rule (nested interactive
  selectors, `preventDefault`); `useDetailsCheck(part)` / `useSummaryCheck(part)` the dev
  element checks. Accordion.Item / Accordion.Trigger now use it.
  - Why hooks taking the part name rather than message helpers called inside each part's
    `useElementCheck`: `production-bundle.test.ts` collects every string literal (>= 16 chars)
    under a dev callee's arguments. `"Collapsible.Trigger"` passed there would be collected as a
    dev text, and it is also a production string (the `useTransitionBoundary` part name), so the
    guard would report a leak. Behind a non-dev-callee hook the name is a runtime argument.
- Root: `useMountFixed` for the mode; `useControllableAction<boolean>` without reducer;
  `onToggle` (library mode), mount-reconciliation layout effect (`useEffectEvent`), re-apply
  layout effect once nothing is in flight. `dispatchFromDom` skips `next === intendedValue`.
  JS-free mode owns `open` as `false` (React never rewrites it).
- Tests: `collapsible.test.tsx` (value-action suite via `__tests__/drivers/collapsible.tsx`, plus
  ~50 rows), `collapsible-transition-types.test.tsx` (isolated by the glob),
  `collapsible.browser.test.tsx` (6 rows). Directives and action-naming registries updated.
- Docs: `CollapsiblePage.tsx`, examples `CollapsibleSpoiler` (Server Component, JS-free),
  `CollapsibleFilters` (async action, fail toggle), `CollapsibleReplies` (lazy suspending
  content, `defaultOpen={false}` alone), `collapsible.css`; route, nav (Disclosure group),
  Accordion page note, Experimental page row. Skill index line.
- Playground: `collapsible-demo.tsx` / `.css`.
- Design: collapsible.md status decided; conventions registry rows (1.1, 2.5, 3.5, 3.7, 4.1,
  5.3, 7.3, 8); internal-hooks.md (3.4 list, file index); accordion.md section 1 (standalone
  Item + shared module); CHANGELOG entry appended.

## Engine findings (browser row for `::details-content`)

Probe (Chromium + Firefox, a `<details>` with a 100px child):

- Chromium: `::details-content` transitions run (opacity and grid-rows both interpolate), but
  `document.getAnimations()` / `element.getAnimations({ subtree: true })` list none of them.
- Firefox: the `grid-template-rows` transition runs (box height interpolates) while the
  computed `grid-template-rows` on the pseudo reports the end value `1fr` at once; an `opacity`
  transition on `::details-content` does not run at all.
- So the browser row measures the `<details>` height mid-transition (4 s linear), not
  `getAnimations()`. WebKit not launchable locally; CI covers it.

## Behaviour note for the reviewer

- The echo rule (`details.open === committed` -> return) means: while a close is pending, a
  browser close-then-reopen is not dispatched (the reopen equals committed). Design-conformant,
  same as Accordion; an edge case I first wrote a test against, then replaced.

## Commands

- `pnpm typecheck`, `pnpm lint`, `pnpm format:check`, `pnpm build`: pass.
- `pnpm test:jsdom`: 83 files / 4025 tests pass. `pnpm test:browser` (Chromium + Firefox
  locally): 56 files / 1061 pass, 39 skipped.
- Branch CI run 45747867624 (workflow_dispatch on feat/163-collapsible, head 1ec97c8f): success
  (ci, browser chromium / firefox / webkit).
