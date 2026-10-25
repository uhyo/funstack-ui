# #129 source tidy-up (wave 18), branch `refactor/129-source`

Source: `memo/reviewer/wave18-audit-source.md`. Scope S1-S5, S9, S11-S15. Out: S6/S7 (later
issue), S8 (dev-131), S10 (#132).

## Done, one commit each

- S1 `internal/announce.ts`: directive-free, `announce(target: Element | Document, message,
  priority?)` + `canAnnounce(target)`. focus-first-invalid's copy gone; Form imports from
  announce.ts. Combobox keeps "the `announce` prop is not composed without `ariaNotify`" (a jsdom
  row pins it) through `canAnnounce`. Toast passes the document and priority. Only observable
  difference: a Combobox `announce` returning `""` no longer calls `ariaNotify("")` (speaks
  nothing either way). `directives.test.ts`: announce moved to the directive-free list.
- S2+S3 `whileShown?: (popup) => cleanup` on `usePopoverPopup`, replacing `onToggle`;
  `onBeforeToggle` deleted. Kept the old predicates exactly (attach on `newState === "open"` and
  shown, stop on `newState === "closed"`), plus the cleanup in `setElement`'s detach. Two rows in
  `use-popover-hooks.test.tsx` (install/stop on toggles, stop on unmount while shown; the unmount
  row fails without the detach cleanup).
- S13 `internal/focus-visible.ts` (directive-free): `QuietFocusTarget`,
  `supportsFocusVisibleOption`, `resetFocusVisibleOption`. `resolveFocusTarget` returns
  `{ target, quiet } | null`. vitest.setup.ts import moved.
- S14 verified: `opening` is read only in the opening branch of `beforetoggle`; `showPopup` sets
  it for the show half. Dropped the outer set in `reshow()`. Context-menu browser rows green on
  Chromium + Firefox locally; WebKit is not installed here, CI covers it.
- S4 `internal/invoker-press.ts` -> `internal/invokers.ts` (test file renamed too): `eventSource`,
  `closedByPopoverTarget` moved in. Dialog reads its command source through `eventSource`.
- S5 `beforeOpen` on `usePopoverTrigger`; Menu.Trigger uses it; `opensOnly` gone, the
  SubmenuTrigger warning text keys on `activate !== undefined`.
- S12 `RESERVED_INVOKER_KEYS`, `nonInvokerMessage(part, tag, popover, popup)` exported from
  use-popover-trigger.ts. Texts unchanged. Gotcha: `production-bundle.test.ts` collects every
  >= 16-char literal in `useElementCheck` args, so passing `"Combobox.Trigger"` literally there
  is a false positive (the name is a production string via `useComboboxContext`); hoisted
  `const part`. Checked by bundling: the helper's text is tree-shaken from production.
- S11 `DialogContextValue extends Omit<OverlayRootValue<...>, "shown" | "setShown">`.
- S15 only Menu.Popup's placement destructuring; the other `x !== null && isPopoverOpen(x)` all
  narrow `x` for a following call, so they stay.
- S9 ids dropped where the comment says why; kept DefinitelyTyped, react, whatwg and #92 (tracks
  a Chromium bug). Bare labels -> design sections (popover.md 14.2 for the one-Trigger warning,
  "popover.md lost-interest amendment", toggle-group.md 6.3 for Toast arrows, popover.md
  Decisions 4 for `aria-modal`). Public JSDoc re-wrapped. `devRef` -> `pressRef` in Menu.Popup.

## Design docs now stale (architect's, not edited)

- number-field.md 1256: `announce.ts # "use client"` (now directive-free); 998-1010, 1161, 1344:
  Combobox / focus-first-invalid "keep their own announcements" (now shared).
- conventions.md 9.1 layout list: no `focus-visible.ts`, `invokers.ts`.
- menu.md 1204, 1530; combobox.md 1408, 2214: `internal/invoker-press.ts` -> `internal/invokers.ts`.
- popover.md 1832: `opensOnly` (gone, now `activate !== undefined`); 14.3 heading lists the
  options (add `beforeOpen`, `whileShown` for 14.2).

## Gates (local)

typecheck, lint (one pre-existing warning, menu-submenu-trigger.tsx:136), format:check, build,
test:jsdom 3364/3364, test:browser Chromium + Firefox 1006 passed / 36 skipped.

## #132 additions (same branch)

- S10 `refactor(ui)!`: `onFocus` in ComboboxInputProps' Omit and owned list; `@ts-expect-error`
  row plus an `onFocusCapture` passes-through line; ComboboxPage owned list updated.
- D3 `test(ui)`: Combobox "a CSS exit (recipe=%s)" browser rows (accepted option, type map),
  mirroring the shared overlay suite; `addExitStyle` imported from overlay-browser-suite.tsx,
  pseudo-name helpers and the option mount count local (the suite's `countMounts` is not
  exported). Docs / playground CSS for the recipe (combobox.md amendment) is not done here.
- Q3 `fix(ui)`: Combobox.Trigger's ref writes `popovertarget` only while `invoker`
  (`disabledButton`), `invoker` in the deps; `aria-expanded` for non-invokers. jsdom rows and an
  all-engine browser row; both fail against the old trigger. ComboboxPage Trigger notes updated.

## Review fixes (memo/reviewer/issue-129-review.md)

- F1: S3 regression. A callback-ref re-run (inline consumer `ref`) detached the whileShown
  listeners and nothing reinstalled them. The attach now installs through
  `useLatest(options.whileShown)` when the popup is shown. Side effect: a popup already shown at
  its first attach (pre-hydration open) now gets the listeners too (before: only at the next
  open). Rows: use-popover-hooks (balance of installs/stops, since the open's own re-renders
  re-run an inline ref too) and menu.test.tsx (inline ref, rerender, invoker guard + right-click
  outside); both fail without the fix. popover.md 14.2 sentence updated.
- F2: no observable row (the open cause is read in the apply layout effect, after the click
  handler); a comment at the call states the contract instead.
- F4: re-wrapped Combobox namespace / Label / Trigger and Popover.Close `action` JSDoc.
