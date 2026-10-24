# Issue #108: CheckboxGroup controlled value compared by content

Branch `fix/108-checkbox-group-value` (worktree `.claude/worktrees/cbg-108`).

## Change (packages/ui/src/checkbox-group/checkbox-group-root.tsx)

- `value` / `defaultValue` keyed on `JSON.stringify` (the ToggleGroup / Accordion rule): an inline
  array with the same contents keeps the same set, so no re-base.
- Root `state` memoised on `JSON.stringify(renderedValue)` + pending + disabled
  (`renderedValue` is a fresh array per render). Labels read `state` from the context.
- Context memoised. Callbacks (`onItemMounted`, `reportParent`, `sortByDocument`, `toggle`,
  `apply`) are stable wrappers over a `useLatest` bundle; they run from handlers and member
  layout effects only, after the insertion effect wrote the ref.

## Late-hydration snapshot (the C13 worry)

With the memo, a late Item's registration re-renders the Items only when the context changes
(`disabledItems`, `required`, ...). The existing "two late Items" test no longer exercises the
snapshot (it passes with the snapshot removed). Added a late *disabled* Item variant
("pre-hydration clicks survive the re-render a late disabled Item's registration causes"): its
registration changes `disabledItems`, React re-applies `checked`, and removing the snapshot fails
it. The "stale server attributes" test passes unchanged: it is held by `syncPresences` in the
member mount effect, not by the re-render.

## Mutation results (jsdom, checkbox-group)

- controlled memo on identity: the same-contents test fails.
- context not memoised: same-contents test fails.
- state not memoised: same-contents test fails.
- controlled memo never updating: the different-contents test fails (plus 33 others).
- state memo ignoring the value: different-contents test fails (plus the document-order row).
- late snapshot removed: the new late-disabled row fails (both modes).

## For the architect (design/ is theirs)

- design/components/checkbox-group.md ~line 491 still says the controlled value is memoised "on
  the array identity, as Accordion does". Now: keyed on `JSON.stringify(value)`, as Accordion
  and ToggleGroup; the context is memoised.
