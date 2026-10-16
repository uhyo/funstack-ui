# Developer memo: Tabs (#11), 2026-10-16

Implementation of `design/components/tabs.md` on branch `worktree-agent-a7c499e7dab484afb`
(merged master c66167e first: Accordion + `useControllableAction` `{ next, details }` patches).

## What landed

- `packages/ui/src/tabs/`: `tabs-ids.ts` (no directive), `tabs-context.ts`, `tabs-root.tsx`,
  `tabs-list.tsx`, `tabs-tab.tsx`, `tabs-panel.tsx`, `tabs-indicator.tsx` (all "use client"),
  `index.ts` (no directive). Exported from the root entry and `@funstack/ui/tabs`.
- `internal/use-until-found.ts` ("use client"): returns a `RefObject`; layout effect without deps
  upgrades `hidden` to `"until-found"` while `active`; effect without deps (re)attaches the
  `beforematch` listener calling a `useEffectEvent`.
- `internal/platform-attributes.d.ts`: `focusgroup` on `React.HTMLAttributes`. Typecheck-only for
  now: tsdown does not emit a source `.d.ts`, so it is **not** shipped in `dist` (conventions 7.4
  says it should be). No public prop exposes `focusgroup`, so consumers lose nothing yet.
- Tests: `tabs.test.tsx` (jsdom, 80 tests), `tabs-transition-types.test.tsx` (wraps
  `addTransitionType` via `vi.mock("react")`), `tabs.browser.test.tsx` (Indicator anchored under
  the optimistic tab, Chromium). `directives.test.ts` extended.
- Example: `packages/example/src/tabs-demo.tsx` / `.css`.

## Decisions / gotchas

- `slug` escapes `_` too (`_5f_`), otherwise `"a b"` and `"a_20_b"` collide. Design said "outside
  `[A-Za-z0-9_-]`". Root id from `useId` is used raw in ids and escaped (keeping `_`) in the anchor
  name; with React 19.3 ids (`_r_1_`) anchor name is exactly `--fsui-tab-<tab id>`.
- Direction types: computed in Root's `transitionTypes(next, prev)` by looking both tabs up by id
  in `rootRef.current.getRootNode()` (works in shadow DOM). No need to thread the dispatching
  element through `select`; also works for `reason: "find"` (dispatched from the panel).
- React's `onFocus` is `focusin`, so automatic-mode `details.event.type` is `"focusin"` (a
  `FocusEvent`), not `"focus"` as the test plan said.
- List focus redirect (value null) only when focus comes from outside the list; otherwise
  Shift+Tab from a tab would bounce back in (a trap in manual mode).
- Panel is split into `TabsPanel` (decides mount strategy) and an inner `PanelElement` holding the
  hooks, so an unmounted panel never resolves its function props.
- jsdom's CSSOM keeps `anchor-name` / `position-anchor`, so the wiring is asserted in jsdom; only
  actual placement is in the browser test.
- `queryByRole("tabpanel", { name, hidden: true })` does not find `hidden`/Activity-hidden panels
  by name; tests look panels up through the tab's `aria-controls`.
- Entanglement bites tests: a test that fails while an action is still pending leaves a global
  pending transition and cascades failures into later tests. Also: while an older dispatch is
  pending, a harness's post-await `startTransition(setCommitted)` is held, so do not assert the
  committed mirror until every dispatch settled.
- Modifier keys (Alt/Ctrl/Meta) are ignored by both arrow navigation and Enter/Space.

## Not done / open

- Dev warning when neither `value` nor `defaultValue` is passed (design open question 2) not added.
- `platform-attributes.d.ts` not shipped in `dist` (see above).
- Example demo verified by `vite build` only, not clicked through in a browser.
