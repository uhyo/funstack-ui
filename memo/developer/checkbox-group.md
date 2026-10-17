# Developer memo: CheckboxGroup (issue #33, 2026-10-17)

Design: design/components/checkbox-group.md (commit 03b595f), PO accepted every recommendation
(own Item part, Parent with `values`, APG restore cycle with no `cycle` prop, dynamic native
`required`, no aria-required, details `{reason, added, removed}`, `next` in Item document order,
no partial-hydration warning, `transition` on Item and Parent).

## Files

- `packages/ui/src/checkbox-group/`: index (no directive), context, root, label, item, parent (all
  `"use client"`), `sync-presence.ts` (directive-free helper, a copy of RadioGroup.Item's private
  one), tests: `checkbox-group.test.tsx` (jsdom, 117 incl. transition-types file),
  `checkbox-group-transition-types.test.tsx` (vi.mock of react's addTransitionType, Tabs recipe),
  `checkbox-group.browser.test.tsx` (10 per engine).
- `internal/use-native-group-reconciliation.ts`: new `equals` option (default `Object.is`).
- Wiring: `src/index.ts`, `tsdown.config.ts`, `package.json` `./checkbox-group`, directives test.
- Example: `packages/example/src/checkbox-group-demo.{tsx,css}`.
- Docs: `pages/CheckboxGroupPage.tsx`, `examples/CheckboxGroupToppings.tsx`,
  `examples/CheckboxGroupForm.tsx`, `examples/checkbox-group.css` (boxes reuse `.demo-checkbox`
  from checkbox.css), nav/routes, Roadmap (Done), Home, ActionProps, Transitions,
  ServerComponents tables.

## Implementation notes / deviations

- **Platform reads are laid over `base()`**: `readCurrent()` / `readDefault()` start from
  `base()` and overwrite only the values that have an Item (`checked` / `defaultChecked`). The
  design said "the set of Items whose checked is true", which would make a controlled value with
  no Item (design 5.1 says those are preserved) look "removed" at mount and on every reset and
  dispatch spuriously. Tested ("a controlled value with no Item is not removed by the mount read").
- **Root state `value` in document order without reading the DOM in render**: oxlint
  `react(refs)` flags ref reads during render. The Items' order is kept in state and refreshed
  from a deps-less layout effect (through `useEffectEvent`; a direct setState in a deps-less
  effect fails `react-hooks/exhaustive-deps`) only when the rendered value would change. First
  render and the server use the value's own order (`defaultValue` order, then optimistic
  additions); a value given out of document order costs one extra layout-time render at mount.
  Handlers (`next`, `added`, `removed`) read the DOM directly (`sortByDocument`).
- Patch dispatch: activate patches are applied to `optimistic`; platform patches are the diff
  against `base()` and applied to `base()`. No-op rule: Item `optimistic.has(v) === checked`;
  Parent patch filtered against optimistic, nothing left → no dispatch.
- Parent memory: `useLayoutEffect([committed, values])`, set only when the committed intersection
  is partial; restoring uses `memory ∩ values`.
- Parent pre-hydration report: in its `onItemMounted` (before calling the Root's), compare
  `el.checked` with the derived `checked`; the Root folds reports into the next `readCurrent()`
  and clears them. StrictMode works because the Parent re-reports in the re-run effect (the DOM
  has not been rewritten yet: mount commits skip the checked re-apply).
- Items sync `data-checked`, `data-pending`, `data-disabled` and `required` presence on mount
  (hydration keeps server attributes); Parents sync `data-checked`, `data-indeterminate`,
  `data-pending`, `data-disabled`.
- Duplicate Item value dev warning: once per Root, from the same layout effect.

## Engine facts found

- Chromium's CDP AX tree has **no `required` property for checkboxes**; an unchecked required
  checkbox shows `invalid: "true"`. Design row 34 asked for `required: true/false`; the test
  asserts `invalid` instead. CDP needs the test iframe's `frameId` (`Page.getFrameTree`, match
  `location.href`); `cdp().send` is typed after `/// <reference types="@vitest/browser-playwright" />`.
- Firefox 157 has `document.startViewTransition`; the "no boundary → 0 calls" row has a
  `transition="none"` control that expects > 0 calls, passes in Chromium and Firefox.
- WebKit could not be launched locally (host libraries) — browser rows unverified in WebKit.
  Things to watch in CI: Tab onto checkboxes (RadioGroup's Tab row passes there, so probably fine),
  `:user-invalid` after a submit attempt.
- Partial hydration jsdom row: a click on a hydrated Item while a sibling boundary is dehydrated
  throws nothing (react-dom's restore is radio-only). Whether React then hydrates or
  client-renders the dehydrated boundary (the optimistic update is a sync-lane context change) was
  not investigated; the test filters console output to the library's own messages.

## Not done / open

- Controlled mode, a Parent whose `values` changed after mount: its React-set `defaultChecked`
  (mount-time derivation) may disagree with the Items' after a reset that needs no dispatch, and
  nothing re-renders to correct its `checked`. Rare; would need a reset listener on the Parent.
