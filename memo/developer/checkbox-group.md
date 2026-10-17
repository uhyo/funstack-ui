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

## Review fixes (memo/reviewer/checkbox-group.md, 2026-10-17)

- **H1**: Parent owns `autoComplete="off"` (also removed from `CheckboxGroupParentProps`). jsdom rows:
  SSR attribute, owned-key override, and the Firefox scenario as it now plays out (Items restored,
  Parent not: only `removed: [c]`). No Firefox reload row: a reload inside the vitest iframe is
  not practical.
- **M1**: `readDefault` starts from `defaultSet ?? EMPTY` when uncontrolled, `base()` when
  controlled.
- **M2 (PO)**: Items register `{value, own disabled}` with the Root from a layout effect
  (`registerItem`, stable, token per effect run). Root keeps a ref registry (current, for the
  residual-path reads) and a state summary `Map<value, hasEnabledItem> | null` (render), set only
  when it changes. `null` until the first registration so the server and hydration renders agree.
  `disabledItems` = values whose every Item is own-disabled; `enabledValues(values, disabled)` in
  the context module: values minus disabled, Item-less values kept, **all values when that leaves
  nothing**. `Root disabled` is not counted. Parent derivation, click cycle, restore memory and
  uncontrolled `defaultChecked` use the enabled values; `pending` still over all `values`.
  - A Parent's **hydration render uses all values** (`useSyncExternalStore` with a server snapshot
    `true`): the server cannot know, and the pre-hydration report compares the DOM with that
    render's derivation. Without it a late Parent hydrating after a disabled Item registered
    reported a phantom "uncheck all" (row added).
  - The pre-hydration report is folded over the enabled values read from the registry ref.
  - Cost: every group re-renders once at mount, at layout time (registration null → map). The
    post-await test now counts mount snapshots instead of assuming one.
- **Late-path snapshot (found while doing M2)**: the registration re-render runs right after the
  layout effects, before the adapter's late microtask, and the Items' re-apply erased pre-hydration
  clicks on late Items. The Root now snapshots the members' `checked` in the first late member's
  `onItemMounted` (layout phase; all DOM of the commit is there) and `readCurrent` uses it; cleared
  by a microtask queued after the adapter's. Generally: in a group, any re-render between a late
  member's mount and the adapter's microtask loses the DOM read — worth a note in conventions 3.8.
- **L1**: `required && no optimistic value has an enabled Item` once registered; before, the old
  `size === 0` (server). Under-blocking before hydration remains when the only checked values are
  disabled / Item-less (documented).
- **L2**: Parent has its own `useFormReset` (merged ref) and writes its derivation back in the
  microtask; the Root's microtask (queued later, Root effects run after) may still dispatch.
- **L3, L4, L7, L8, L9**: comments and docs. L5: `internal/sync-presence.ts`, used by RadioGroup
  too (directives test updated). L6: `equals option` rows in the adapter's own test file.
