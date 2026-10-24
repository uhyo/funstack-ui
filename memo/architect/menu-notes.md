# Architect notes: Menu (#39), 2026-10-17

Working notes behind `design/components/menu.md`. Not a spec; the design doc is.

## Facts relied on (research probes, Chromium 156 / Firefox 157; WebKit not probed)

1. `focusgroup="menu"` in Chromium: wraps by default (ArrowDown from the last item went to the
   first with no `wrap` token in the probe), Left/Right ignored, Home/End work, natively
   `disabled` buttons skipped, no typeahead, Tab leaves the group as one stop, AX infers
   `menu` / `menuitem`. Works inside a popover. Items in the probe had **no** `tabindex`; #43
   found `tabindex="-1"` elements are left out of the group, hence "no tabindex on the native
   path", as Tabs now does.
2. A nested auto popover closing (Escape, `hidePopover()`) leaves focus on `<body>` in both
   engines (spec: first popover in a stack only). Popover 6.2's rule is what restores it.
3. Tab out of an open auto popover leaves it open; the library must close the stack itself.
4. `interestfor` on a submenu trigger opens on keyboard focus and one Escape collapses the stack;
   not usable (Chromium-only anyway).
5. `showPopover({ source })` anchors a submenu at the item's right edge with
   `position-area: span-block-end inline-end`; the design uses the physical `right span-bottom`
   from the shared matrix, same cell.
6. WebKit 302008 (`position-try` on nested popovers hangs / spins) and 317926 (iOS,
   `@starting-style`) are NEW.

## Decisions I went back and forth on

- **Close timing (research Q1).** "Close at once" is what every prior-art library does, and it
  is what a sync action still gets here. The deciding argument was the vision's "pending state
  exposed": an item that unmounts with the menu cannot show its own pending, and putting it on
  the Trigger misattributes it. The view-transition exit (the research's reason for making
  activation library-owned) only exists if the close is in the commit after the action.
- **Checkable items stay open.** Against Radix / Base UI / macOS. APG's Space rule and the
  "toggle three view options" case won; `closeOnActivate` is cheap. Escalated.
- **JS-free mode.** Considered keeping Dialog/Popover's three-prop mode switch for symmetry; a
  mode that "works" only as a list of Tab-navigable buttons is a trap for consumers who read
  "JS-free" as "supported". Always library mode, declarative command kept for the anchor and the
  pre-hydration open.
- **Content mounting default.** Always-mounted items would put them in the server HTML and make
  the pre-hydration menu non-empty, but inverts conventions 3.7 and mounts every row menu's
  items at load. Kept 3.7; escalated as question 3.
- **Submenu anatomy.** `Menu.Root` nested = submenu, with context detection, versus
  `Submenu*` parts. Fewer names; the Popover hooks already make a nested Root a nested popover.
  `SubmenuTrigger` is unavoidable because it is both an item and a trigger.
- **Tab closes the stack: immediate `hidePopover()`.** `requestClose` would await the consumer's
  action with focus already elsewhere and the menu still painted over the page. This is the one
  place Menu closes browser-style on purpose.
- **Pointer focuses items.** Conventions 4.2 avoids pointer tracking for *attributes*; here it is
  for the current-item model (keyboard and pointer must agree), which native menus have. Used
  `pointermove`, not `pointerenter`, so a menu opening under a resting pointer does not steal
  focus from the item the keyboard put it on.
- **Hover-open focus.** Keeping focus on the SubmenuTrigger for hover opens (Radix) versus
  focusing the first submenu item (some native menus). Keeping it avoids the parent menu's
  keyboard state jumping while the user is mousing; ArrowRight then focuses the first item
  without a dispatch.
- **Hover timers.** Shared helper with Tooltip, not Tooltip's hook. Defaults 100 / 150: Radix /
  Base UI use 100 for open; 150 for close matches Tooltip's `closeDelay` and is the budget for a
  diagonal move into the submenu without a safe polygon.
- **Activation closes the root.** Per-level `"activate"` dispatches were considered (each Root
  gets a "real" reason); one root close with `"dismiss"` on submenus is one platform call and
  matches what actually happened to each submenu.
- **`useActionTrigger`.** Dialog.Close recorded the superseded-rejection gap as "fix if a case
  appears"; Menu.Item makes repeated clicks common (double-click on "Archive"), so the shared
  hook is proposed now.

## Prior art borrowed / rejected

- Base UI Menu: `CheckboxItem` / `RadioGroup` / `RadioItem` / `GroupLabel` / `SubmenuRoot` +
  `SubmenuTrigger`, `closeOnClick` (renamed `closeOnActivate`: keyboard activates too), `loop`,
  typeahead, hover delays. Rejected `Positioner`, `Portal`, `Backdrop`, `Arrow`, `modal`.
- Radix DropdownMenu: `Sub` / `SubTrigger` / `SubContent` (collapsed into a nested Root);
  pointer-move focus; 100 ms open delay. Rejected `Portal`, `onSelect` handlers (action props),
  `modal` focus trap.
- React Aria Menu: `onAction` with item keys (rejected: per-item action props read better and
  take Server Functions directly), `selectionMode` (rejected: separate parts).
- Open UI menu elements: separate checkbox / radio parts, activation closes by default, disabled
  items focusable, `<hr>` separators, `<fieldset>`-like groups (ours is `div[role=group]`).

## Things to raise later

- Menubar (`role="menubar"`, Left/Right between menus, hover-switching between open menus).
- Context menus (#45): pointer anchor, `contextmenu` event, long-press.
- A safe-polygon hover intent if diagonal moves prove unreliable.
- `experimental_` rendering of the Open UI `<menulist>` / `<menuitem>` elements if they ship.
- Item `transition` (none in v0; conventions feedback 4).

## After the review (2026-10-17)

Folded `memo/reviewer/menu.md` and the developer's six deviations into `design/components/menu.md`
(sections 2.3, 3.3, 3.6, 4, 5.3, 6.1, 6.2, 7, 10, 12, 13, 14, plus "Review corrections" and
"Accepted deviations" at the end), `design/conventions.md` 3.4, `design/components/dialog.md`
3.4 / 13.2 / 14 and `design/components/popover.md` 3.4 and the M2 row.

Things I settled while writing, worth remembering:

- `useActionTrigger(openGeneration?) => { pending, run(work, then?) }` is the real shape. The
  design's earlier `useActionTrigger(action)` sketch was wrong in two ways: the hook takes the
  generation reader, not the action, and `then` is what carries the close. `then` deliberately
  runs after unmount (the overlay's close is why the item unmounted); only the generation guard
  cancels it. Dialog.Root now needs the counter too (M2); I specified Popover's sources (own
  open dispatch + the Popup's native `toggle` to open) so JS-free and foreign opens count.
- M1: owned `onMouseDown` on `Menu.Popup` (added to the Omit list), plus `onPointerEnter` /
  `onPointerLeave`, which the code already spreads as library props on submenus but the type did
  not omit. The type now says owned for all three; the developer should align `MenuPopupProps`.
- H1: native-first. The library re-focuses with `focus({ focusVisible: false })` after a
  pointer open (Chromium, Firefox honour it); WebKit has no `focusVisible` option, so Safari may
  show a ring after a mouse open. The section 9 CSS makes it invisible anyway (`:focus` styled
  as hover, no outline). The browser row branches on webkit and asserts, never skips.
- 5.3: keyboard activation through `element.click()` is the better design, not just an accepted
  deviation: one activation path, `detail === 0` for keyboard, and composed triggers / links
  keep their native behaviour. Worth carrying into any future item-like part (Listbox, Combobox).
- L5: React entangles a re-open dispatched while an item's async action is pending; the re-open
  commits when the action settles. Recorded as React behaviour in Menu 12 / walkthrough 11 and
  Popover 3.4 and conventions 3.4. If it bites a consumer with a slow Server Function, the only
  library-side fix is to run item actions outside `startTransition`, which loses `data-pending`;
  not worth it.
- Question 6 (WebKit 302008, submenu `flip-inline` default) is still open: the dedicated WebKit
  row (M3) decides it from CI; the design keeps the fallback until that result is in.

## Fix follow-up (02f2f42, d4deae8)

- H1 resolved better than "native-first, WebKit may show a ring": the hook now takes a
  `QuietFocusTarget` from `resolveInitialFocus` and calls `focus({ focusVisible: false })` after
  `showPopover()` for a pointer open. The one `.focus()` on open in the library; Popover 6.1
  records the exception. Safari 18.4+ implements the option, so WebKit CI is clean.
- Question 6 settled: the WebKit default-placement row passed (CI 39021387650). Keep
  `flip-inline`. The other WebKit submenu rows still use `side={null}`; relax when convenient.
- M2 nuance: in library mode the entangled re-open means `dialog.open` is false when `then`
  runs, so the guard is only load-bearing for JS-free / native re-opens. Still right to have.

## #110: Trigger click while open with an async close (2026-10-24)

Finding (wave 16 review L1): Chromium/Firefox focus a button on `mousedown`, so a click on the
Trigger of an open menu moved focus out of the popup and the root Popup's `focusout` hid the menu
at once; WebKit never focuses a button on click, so the click's `requestClose` ran and the menu
stayed shown until `openChangeAction(false)` settled.

Decision: WebKit's path is the intended one. It is Popover 2.3 (Popup visibility follows
committed state in every overlay; optimistic feedback lives on the Trigger), it keeps the
view-transition exit and the controlled veto, and it is the item-activation timing (2.3) applied
to the Trigger. Fix: `Menu.Trigger` owns `onMouseDown` and prevents the default for the primary
button while `intended()` is `true`. Not while closed: an opening click must focus the Trigger,
which the popover records as the element to return focus to.

Options weighed:
- (a) Prevent `mousedown` while open (chosen). One line, no cross-part flag, every engine ends in
  WebKit's state during the pending window (focus on the item, menu shown). Same rule the Popup
  applies to non-item space (6.2) and Combobox's buttons apply always.
- (b) Trigger sets a "pressing" flag the Popup's `focusout` consults. Keeps native focus on the
  Trigger, but Chromium then holds focus outside the open menu during the pending close and after
  a press that never clicks (dragged off), with no `focusout` left to catch a Tab: a new
  engine-specific state instead of the old one.
- (c) Hide at once on every engine. Makes the Trigger's close browser-shaped: CSS exit only, no
  veto, contradicts Popover 2.3 and the "pending state exposed" argument that chose the
  item-activation timing.
- (d) Never close on `focusout` to the Trigger. Breaks Shift+Tab-closes (APG, browser row) and
  leaks: Tab from the Trigger then leaves the menu open with focus elsewhere.

Likely worse than the issue says: in a real browser the `toggle` task of the focusout hide runs
before the `click` (the user holds the button longer than a task), so Chromium/Firefox reported
`(false, "dismiss")` with the ToggleEvent and the click's `requestClose` was a no-op. jsdom
dispatches mousedown/mouseup/click in one task, so the suite row saw `"activate"` and passed.
No browser row covered the Trigger close; the new one asserts the reason and will confirm.

Not touched: ContextTrigger region presses while a menu is open (a move, #45); Combobox's own
`openAtPress` snapshot (its buttons are not the popover's `source`, so a press there is a light
dismiss; Menu's Trigger is the `source`, so it is not).
