# Developer memo: Menu (#41) and useActionTrigger (#47), 2026-10-17

Implemented `design/components/menu.md` (accepted). Branch `worktree-agent-a467b19dc23b6d412`,
merged with master after the Popover review fixes (35e57e1..1cb5854).

## Shape

- `src/menu/`: `menu-root.tsx` (submenu = a Root under a Popup's `MenuListContext`; open cause
  recorded by the part (`setOpenCause`) and moved to `openCause` in `onDispatch`, read and
  cleared by the Popup's `resolveInitialFocus`; default "first"), `menu-trigger.tsx`
  (`openMenuWithFocus`, shared with SubmenuTrigger), `menu-popup.tsx` (keys, typeahead, focusout,
  focusgroup detection, submenu pointer enter/leave), `use-menu-item.ts` (role, roving tabindex,
  aria-disabled, Enter/Space -> `click()`, pointermove focus), `menu-item.tsx`,
  `menu-checkbox-item.tsx`, `menu-radio-group.tsx` / `menu-radio-item.tsx`, `menu-group.tsx`
  (Group, GroupLabel and Separator in one file), `menu-submenu-trigger.tsx`, `menu-hover.ts`
  (`scheduleHoverClose`), `menu-dom.ts` (items from the DOM), `menu-context.ts`
  (`closeStackLater`).
- `src/internal/use-action-trigger.ts`: own transition + superseded-rejection surfacing +
  optional `openGeneration` reader (a run's `then` is dropped when a newer open started).
  Popover.Close, Dialog.Close (no generation: Dialog has none) and Menu.Item use it.
- `src/internal/use-delayed-pair.ts`: `createDelayedPair()` (one slot: open / close exclude each
  other; `cancelClose`) and `useDelayedPair()`. Tooltip's JS path uses the factory inside its
  effect; Menu's submenu Root uses the hook.
- `usePopoverTrigger` options: `handlers` (merged in front of the Trigger's own), `activate`
  (click override: SubmenuTrigger opens or focuses into, never closes), `disabledAs: "aria"`.
- Popover shim: hiding an `auto` popover hides nested `auto` popovers first (DOM descendants or
  `source` inside), innermost first, with their own events.

## Deviations from the design (reported)

1. `usePopoverPopup` got no `onKeyDown` / `onFocusOut` / `role` options: Menu.Popup attaches
   `onKeyDown`, `onBlur` (React's focusout) and pointer handlers as owned props on its element
   (the Popover memo anticipated this). Pass-through options would be indirection only.
2. Keyboard activation of items always goes through `element.click()` (Enter / Space keydown is
   prevented, then `click()`), so `details.event` is a `click` for keyboard activation too (design
   13.1 said `keydown` for Enter). Reason: an item composed with another trigger
   (`Dialog.Trigger render={<Menu.Item />}`, the design's own layering row) must run its native
   command, and a `render`ed link must navigate; activating directly on keydown skipped both.
3. RadioItem re-activation of the selected item with `closeOnActivate` still closes the menu (no
   dispatch). The design only says "no dispatch".
4. Group, GroupLabel and Separator live in one file (`menu-group.tsx`), not three.
5. `Menu.RadioGroup` always emits `aria-labelledby` (to its GroupLabel's id, dangling without
   one), like `Menu.Group`; the design said "if present" for the radio group.
6. Checkable items and Item drop their stack close when the menu was dismissed and re-opened
   while the action ran (the PO's open-generation rule, applied through `closeStackLater` /
   `useActionTrigger`).

## Findings

- jsdom: React entangles transitions; a re-open dispatched while an item's async action is still
  pending commits only when that action settles (test "dismissed and re-opened").
- Pointer events are dropped while a view transition runs: after a dismissal with `transition`
  (M1 now starts one), a click within ~120 ms is lost (seen in the docs smoke test). Documented
  caveat, not a bug.
- Uncontrolled checkbox / radio state unmounts with the items (walkthrough 4); the radio
  closeOnActivate test uses `keepMounted`.
- Chromium and Firefox both honour `autofocus` on an item for `<div popover>` (focus lands on the
  first item after a library open); no focus fallback needed for div popups.

## Results

- jsdom `menu.test.tsx`: 87 tests. Popover / Dialog Close: one superseded-rejection row each
  (they fail without the hook).
- Browser `menu.browser.test.tsx`: 25 rows per engine, Chromium and Firefox green. Full gate
  1599 passed, 3 skipped (pre-existing).
- WebKit: not runnable here (libgtk-4 missing). Watch on CI: submenu rows use `side={null}` on
  WebKit (302008); the flip row runs only on Chromium / Firefox; the H1 focus-return row and the
  `autofocus`-on-div-popover focus rows are unprobed in WebKit.
- Docs live examples smoke-tested with Playwright (static build served with `/x -> /x.html`):
  open focuses Rename, Archive shows "Archiving…" then closes with one view transition each way
  and focus back on the Trigger, submenu by keyboard and Escape focus return, checkbox toggles,
  no console errors, both engines.

## Review fixes (memo/reviewer/menu.md), 2026-10-17

Commits 02f2f42 (fix(ui)), fa4908c (docs), d4deae8 (test). CI run 39021387650 green on
Chromium, Firefox and WebKit.

- H1: `usePopoverPopup`'s `resolveInitialFocus` may return a `QuietFocusTarget`
  (`{ element, focusVisible: false }`). Where the engine reads `focus({ focusVisible })`
  (getter probe on a detached element; Chromium 145, Firefox 104, Safari 18.4), the library
  skips the `autofocus` write and calls `focus({ focusVisible: false })` after `showPopover()`.
  Menu records `pointer` with the open cause (`click` with `detail > 0`, Trigger and
  SubmenuTrigger). WebKit CI: `:focus-visible` is now false after a pointer open, so the row
  asserts false everywhere. This is the one `.focus()` on open (popover design 6.1 said never).
- M1: owned `onMouseDown` on Menu.Popup prevents the focus move when the press is on non-item
  space (closest focusable is the popup / a `role=menu`); consumer controls (inputs) still take
  focus. Arrow / Home / End with focus on the popup go to the first / last item (also on the
  native focusgroup path). jsdom + browser rows (browser row fails without the fix).
- M2: Dialog.Root generation, bumped on the open dispatch and on the Popup's native `toggle` to
  open (PO note); Dialog.Close passes it to `useActionTrigger`. The library-mode jsdom rows pass
  without the guard too (the re-open is entangled and `dialog.open` is still false when `then`
  runs); the JS-free row fails without it.
- M3: WebKit-only row with the default submenu placement (`position-try-fallbacks: flip-inline`
  computed), opened twice, 15 s test timeout; the CI browser step has `timeout-minutes: 10`.
  Passed on the first WebKit run: no hang. Question 6 can keep the fallback default; the
  `side={null}` on WebKit in the other submenu rows could be dropped later.
  Gotcha: `side={undefined}` through a helper with a default parameter becomes the default.
- L1: CheckboxItem / RadioItem dismiss-and-reopen rows (fail without `closeStackLater`'s guard).
- L4: hover row runs with `IS_REACT_ACT_ENVIRONMENT = false` and the raw `userEvent`; no Menu act
  warning on WebKit now. A CheckboxGroup VT row still prints one on WebKit (not touched).
- L6: MenuRoot value in `useMemo` with a `root` getter (no cast). It still recomputes on every
  render because `usePopoverRoot` returns a fresh object (its `dispatch` is per render); a real
  hit needs that shared hook (and `useControllableAction.dispatch`) to become stable.
- PO note: MenuPopupProps omits `onMouseDown`, `onPointerEnter`, `onPointerLeave` (owned).
