# Review: wave 9, #81 (pure-trigger re-entry) and #83 (disabled on link / component renders)

Commits 27e64f4 (#81) and f827869 (#83) against design/components/button.md 16 and 17 (2240658).
Tracker #85. Reviewed 2026-10-22.

Checks run: `pnpm typecheck`, `pnpm lint`, `pnpm format:check` clean; jsdom 2571/2571 after a
rebuild (the 2 `directives.test.ts` failures on a stale `dist/` with `toolbar-button.mjs` are a
local build artefact, gone after `pnpm --filter @funstack/ui build`); browser project on Chromium
green. Firefox / WebKit not run locally (no browser-test files changed).

## Verdict

**Acceptable with fixes.** The #81 mechanics are right and well tested; every `useActionTrigger`
caller is accounted for. Two must-fix items: a disabled component-render invoker is still a live
`command` invoker before hydration (#83 regression), and the Menu docs / jsdoc now state a
keyboard behaviour that does not exist.

## Must fix

### M1. #83: the `aria-disabled` branch keeps `commandfor` + `command`, so a disabled component render is a live invoker before hydration

- `packages/ui/src/internal/use-popover-trigger.ts:141-144` (Popover.Trigger, Menu.Trigger,
  Menu.SubmenuTrigger), `packages/ui/src/dialog/dialog-trigger.tsx:131-134` (library-mode modal),
  `packages/ui/src/dialog/dialog-close.tsx:142-145`, `packages/ui/src/popover/popover-close.tsx:136-138`.
- In the focusable branch `disabled` is now owned as `undefined` but `commandfor` / `command`
  are still rendered. For `render={<MyButton />}` (a component that spreads onto a real
  `<button>`, the case 17.3 tests) the server HTML is an enabled `<button commandfor command=...
  aria-disabled="true">`. `aria-disabled` has no behavioural effect, so a click before hydration
  runs the command: a disabled Menu.Trigger / Popover.Trigger opens its popup (menu.md row 2 and
  Popover 2.4: the pre-hydration click path is designed, and mount reconciliation then adopts the
  open), a disabled library-mode modal Dialog.Trigger runs `show-modal`, a disabled Close part
  closes. Before #83 native `disabled` made the button "not a valid invoker" (the parts' own
  jsdoc), so this is a regression in exactly the window FUNSTACK keeps working. After hydration
  the handlers' `preventDefault()` cancels the command, so jsdom cannot see it.
- Fix: in the focusable branch with `disabled`, own `commandfor` and `command` as `undefined`
  (nothing to invoke while disabled; the implicit anchor / `aria-expanded` mapping are moot for
  a disabled control). A jsdom row per part: disabled component render has no `command`
  attribute; `renderToString` row for Menu.Trigger. Link renders are unaffected (an `<a>` is
  never an invoker) but the same owned removal is harmless there.

### M2. Docs and jsdoc claim the menu's arrows, Home / End and typeahead skip disabled items; they do not

- `packages/docs/src/pages/MenuPage.tsx:121-123`: "it is still an enabled item for the arrow
  keys, Home / End and typeahead, which skip only items with the `disabled` prop".
- `packages/ui/src/menu/menu-item.tsx:34-35` (`disabled` jsdoc, new in 27e64f4): "the arrows,
  Home / End and typeahead skip it."
- The code (`menu-popup.tsx:230-251` arrows / Home / End over all `menuItems`, `runTypeahead`
  at `:189-211` over all items) skips nothing, which is the documented design (menu.md:44 and
  :392 "focusable, skipped by nothing", :566 "Disabled items are included", APG). Only
  `edgeItem` (open focus, and the Trigger's ArrowDown / ArrowUp while open) skips disabled. The
  developer found exactly this (deviation 1) and then wrote the opposite into public text.
- Fix: "a pending item is an ordinary item for navigation; only the open focus skips items
  with the `disabled` prop" (MenuPage), and drop the skip clause from the `disabled` jsdoc.

## Should fix (low)

### L1. `menu-dom.ts:19-22` jsdoc is inaccurate the same way
"a pending item is still an enabled item for Home / End, the open focus and typeahead": Home /
End and typeahead never call `isDisabledItem`. Say "for the open focus (`edgeItem`)". Same
wording in design/components/menu.md:257 and button.md 16.3 (architect's docs; recorded for them,
not for the developer).

### L2. NumberField: the pointer-click path of the disabled-link fix is untested
`packages/ui/src/number-field/use-step-button.ts:116-117` moved `preventDefault()` before the
pointer early return precisely for a pointer click (`detail > 0`) on a disabled render, but the
row (`number-field.test.tsx`, "disabled by %s with a component render") clicks with
`detail: 0`, which also passes if the `preventDefault()` sits only in the final `if (disabled)
return`. Add a `fireEvent.click(inc(), { detail: 1 })` assertion (`false`).

### L3. NumberField: a press on a disabled `aria-disabled` step render moves focus off the input
`use-step-button.ts:51-52` returns before `event.preventDefault()` when disabled. With native
`disabled` a press focused nothing; with a focusable render (`tabIndex -1` is still
click-focusable) the press now takes focus from the input. Same for Combobox.Trigger / Clear?
No: their `onPointerDown` / `onMouseDown` cancel unconditionally. Suggest cancelling the
pointerdown when disabled too (keep the early return after it).

### L4. Changelog wording for #81
RoadmapPage says "Behaviour change: before, a second click ran the action again." Design 16.5
chose "behaviour change, not breaking". It does remove previously documented behaviour (Toast
"a second click is a second dispatch"; Dialog / Popover / Menu "repeated clicks re-run the
action"), and a consumer counting clicks through `Menu.Item` / `Toast.Action` changes result
silently. In 0.x alpha that does not need a major, but the alpha.7 release notes should flag it
as breaking for that pattern and point at the non-awaiting spelling
(PendingOptimisticPage already shows it). #83 is correctly scoped as "link and component renders
only".

## Deviations

1. **M3 split** (Home / End never skipped disabled; re-open half as an `edgeItem` unit row):
   accepted. The reading of the code is correct and the entanglement argument for the re-open
   (the open commits after the pending item's transition settles) holds. The integration row
   covers arrows, Home, End and typeahead on a pending item. The regression half for "a disabled
   first item is still skipped by open" is in `menu-dom.test.ts` (edgeItem) plus the existing
   open-focus rows. See M2 for the docs that contradict it.
2. **D3 assertion shape**: accepted (two `openChangeAction` calls including the open, one
   `close()`, no `aria-disabled`).
3. **D4 / P3 / M4 extended with a reset and re-run**: accepted; stronger than the design row.
4. **T2 split into two rows**: accepted; the `closeOnSettle={false}` variant is the one where the
   guard is visible.
5. **`aria-disabled` owned only in the focusable branch; host buttons pass the consumer's own
   through**: accepted. 17.2 only specifies that branch; Close parts own it always because of
   #81. Consistent with Toggle's prior pass-through.
6. **JS-free non-modal Dialog.Trigger has no `data-disabled`**: accepted; dialog.md:96 says
   `data-disabled` is library-mode only and 17.2 keeps `data-disabled` unchanged. Note the
   resulting inconsistency (an `aria-disabled` element without the styling hook; Popover.Trigger
   has the same gap in JS-free mode) as a candidate for a later conventions pass, not wave 9.

## Focus questions

- **Menu.Item pending `aria-disabled`**: correct. `isDisabledItem` keys on `data-disabled`
  (`menu-dom.ts:23-25`), `use-menu-item.ts` still blocks activation by the `disabled` prop only,
  and the ignored activation cancels the click, which the Enter / Space path reaches through
  `element.click()` (M1 row asserts `[false, true, true, true]`). Focus stays on the item. Menu
  navigation is unchanged (it never read `aria-disabled` outside `edgeItem`).
- **Disabled link renders**: every focusable-branch handler cancels the click
  (`toggle.tsx`, `toggle-group-item.tsx`, combobox trigger / clear, dialog trigger JS-free
  non-modal branch, `use-popover-trigger.ts:117` cancels first, Close parts always cancel,
  `use-step-button.ts:117`). `<a href>` stays focusable (no native `disabled`, no `tabIndex`
  change except the step / combobox buttons' existing `-1`), and `aria-disabled` is allowed on
  `link`, so it is announced as an unavailable link. Rows assert `fireEvent.click(...) === false`
  for every part. Gap: M1 (pre-hydration) and L2.
- **No non-pure trigger guarded by the flip**: confirmed. Callers: `button.tsx:112`,
  `dialog-close.tsx:79`, `popover-close.tsx:76`, `menu-item.tsx:70`, `toast-action.tsx:58`
  (all pure triggers, guarded), `slider-root.tsx:316` and `number-field-root.tsx:285`
  (`ignoreWhilePending: false`, commented). CheckboxItem / RadioItem / Toggle / Tabs use
  `useControllableAction`, untouched. H2 rows in both continuous controls assert the second step
  is called; the developer's mutation run (24 rows fail with the default flipped back) supports
  that the guard is pinned.
- **JS-free command modes keep native `disabled`**: confirmed for Dialog.Close / Popover.Close
  without `action`, JS-free modal Dialog.Trigger and JS-free Popover.Trigger, each with a row.
  Form.Submit keeps native `disabled` with a regression row and docs sentence.
- **Tests vs 16.4 / 17.3**: every row present (D1-D6, P1-P4, M1-M6, T1-T4, H1, H2; 17.3 per
  part). No timing flakiness spotted (deferreds, fake timers only in toast / number-field).
