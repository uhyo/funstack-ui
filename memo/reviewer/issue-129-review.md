# Review: #129 source tidy-up + #132 (branch refactor/129-source @ fbac751), 2026-10-25

Verdict: **merge after fixes** (one medium finding, F1; the rest optional).

Worktree: scratchpad `rev-129/wt` (branch head), `rev-129/master-wt` (merge base, for A/B),
`rev-129/fix-wt` (F1 fix tried). Main checkout untouched.

## Findings

### F1 (medium, fix before merge) whileShown listeners are lost on a ref re-run while shown

`packages/ui/src/internal/use-popover-popup.ts:445` (detach runs `stopListeningWhileShown()`),
`:412-437` (attach never installs). `setElement` is a callback ref; React runs its cleanup and the
new ref whenever the merged ref changes identity, e.g. a consumer's inline callback `ref` on
`Menu.Popup` / `Combobox.Popup` or an inline `ref` on a `render` element (useRender merges them:
`internal/use-render.ts:36-40`). With a re-render while shown, the detach stops the whileShown
listeners and the re-attach does not reinstall them (only a `toggle` does, and none comes). Before,
the listeners lived in the component (passive-effect cleanup only on unmount) and survived.
Effect: after any parent re-render while open, a Menu no longer closes on an outside right / middle
click and Menu / Combobox lose the foreign-invoker press guard (#126) until the next open.

Probe (jsdom; inline `ref={(el) => {...}}` on Menu.Popup, open, `rerender`, right-click outside):
fails on the branch (popup stays open), passes on the merge base.

Fix (tried in fix-wt: probe green, jsdom menu/combobox/internal/popover 1062/1062, browser Menu +
Combobox Chromium + Firefox 305 passed): in the attach, after `setShown(...)`,
`if (isPopoverOpen(element)) stopWhileShown.current ??= latestWhileShown.current?.(element) ?? null;`
with `const latestWhileShown = useLatest(options.whileShown)` (in the deps). Add a
use-popover-hooks row: Mini with a changing inline ref, open, rerender: `stop` called once and
`whileShown` called again (or a Menu outside-right-click row after a rerender). Design popover.md
14.2 (master line ~1505) should then say "and again at a ref attach that finds it shown".

### F2 (low, optional) S5 order of beforeOpen vs requestOpen is not pinned

Mutation M4 (call `beforeOpen` after `requestOpen`, `use-popover-trigger.ts:173-174`) passes all
Menu jsdom tests. It is behaviour-equivalent today: the open cause is read by
`resolveInitialFocus` in the apply layout effect, after the click handler returns. So S5 is
behaviour-preserving; the order only matters if `requestOpen` ever shows synchronously. No action
needed; a one-line comment would make the "right before" contract explicit.

### F3 (info) S1 "" difference is acceptable

Combobox `announce` returning `""` no longer calls `ariaNotify("")`; nothing is spoken either
way. The `canAnnounce` gate keeps `compose` from running without `ariaNotify` (mutation M1, gate
removed, fails 1 combobox jsdom row). Toast: texts are never empty (`queueAnnouncement` drops
blank ones), so the shared empty check changes nothing there.

### F4 (nit) line lengths

- `internal/use-popover-hooks.test.tsx:4` is 125 columns (header comment).
- `combobox/combobox-trigger.tsx:74` 102 columns (101 in the built .d.ts).
- Untouched overlay public JSDoc still over 100 in dist: `combobox/index.d.mts:17` (Root doc),
  `combobox/combobox-label.d.mts:15`, `popover/popover-close.d.mts:15`. Optional.

### F5 (follow-up, not this branch) D3 docs / playground CSS

combobox.md #132 amendment says the docs (`packages/docs/src/examples/combobox.css`) and the
playground (`packages/example/src/combobox-demo.css`) must add
`html:active-view-transition .<popup> { transition: none; }`; neither has it (developer memo says
"not done here"). Make sure the technical writer has it.

## Checked and fine

- S1: one `announce`/`canAnnounce`, directive-free; directives.test lists updated.
- S2/S3: old predicates kept exactly (attach on `newState === "open"` && shown, stop on
  `"closed"`), same position at the end of `onToggle`; `submenu` static; `options` read through
  `useLatest(handlers)`, so latest closure. Mutations: M2 (no detach cleanup) fails 2, M3 (no stop
  at close) fails 6, M6 (no install) fails 22. Only F1 above.
- S4: `eventSource` coalesces `undefined` to `null`; `!= null` -> `!== null` and Dialog's
  `valueOf(unknown)` are equivalent.
- S5: warning texts unchanged (Menu.Trigger never had `opensOnly`; SubmenuTrigger keys on
  `activate`); M5 (SubmenuTrigger text disabled) fails 1.
- S12: `nonInvokerMessage(part, tag, "listbox", "listbox")` reproduces the old Combobox text
  word for word; Popover / Menu text likewise.
- S13: `quiet` computed under the same conditions as before.
- S14: `opening` read only at `use-popover-popup.ts:271` (opening `beforetoggle`); the hide half
  of `reshow()` cannot reach that branch. Context-menu move rows green (Chromium + Firefox).
- S9: no issue-id-only comments left in source (only DefinitelyTyped #74664, whatwg/html#10905,
  react#23301, upstream #92). Removed ids all sat next to a full reason; no reason lost. New
  section references resolve (popover.md 14.2 one-Trigger warning, lost-interest amendment,
  Decisions-at-a-glance row 4, toggle-group.md 6.3). Re-wrapped Menu.Trigger / SubmenuTrigger /
  Popover.Trigger JSDoc reads well in dist.
- #132 S10: `onFocus` omitted + listed; `@ts-expect-error` row; docs owned list updated.
- #132 Q3 (ec68d43) matches the amendment (guard `tagName !== "BUTTON" || !invoker`, `invoker`
  in deps, `aria-expanded: invoker && rendersButton ? undefined : shown`). Without the fix: jsdom
  row fails; browser row fails on Chromium and Firefox. Dropping `invoker` from the deps alone
  fails the flip row.
- f975738 recipe rows: `addExitStyle` import has no side effects (the suite module only exports).

## Runs

- Browser (Chromium + Firefox): combobox, dialog, menu, menu-context-trigger, popover,
  transition-boundary, environment: 590 passed / 14 skipped; field, form, number-field, toast:
  88 passed / 4 skipped.
- `pnpm --filter @funstack/ui build`: ok; dist JSDoc inspected.
