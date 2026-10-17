# Reviewer memo: Menu (#41) and useActionTrigger (#47), 2026-10-17

Reviewed ac7064e (useActionTrigger, delayed-pair timers, Close parts), a456681 (Menu), 009a790
(example), eb9cfb1 (docs page) on master. Design: `design/components/menu.md` (accepted).

Verdict: **acceptable with fixes.** H1 blocks: master CI is red on WebKit since the merge. The
Async React core (item transition, close-after-settle, open-generation guard, superseded
rejections, optimistic checkable items) is right, and the Close-part refactor did not regress
Popover or Dialog. M1 is a real keyboard dead end; M2 is a pre-existing Dialog bug the new hook
makes easy to fix.

Checks run: jsdom menu/popover/dialog/tooltip/internal, 538 passed. Temporary browser probes,
since removed, on Chromium and Firefox (WebKit does not launch locally): Space held on an item
closes the menu and the keyup on the Trigger does not re-open it, for both Item and a
closeOnActivate CheckboxItem. Tab from a submenu item closes the whole stack. Clicking a
Separator leaves focus on the popup and the arrow keys do nothing (M1).

## Findings

### H1. CI is red on WebKit: `:focus-visible` after a pointer open
- Where: `menu.browser.test.tsx:231`. Runs 39008188718, 39008190369 and 39019989864 (every
  master push since the merge) fail only `browser (webkit)`: "a pointer open focuses the first
  item without :focus-visible" gets `true`. Chromium and Firefox pass. The caller's "CI green on
  all three" does not hold.
- What it means: in WebKit the item that `autofocus` focuses after a mouse open matches
  `:focus-visible`, so Safari users see a focus ring on the first item after a click. Design 6.1
  says ":focus-visible heuristics hide the ring after a pointer open in every engine", which is
  false for WebKit.
- Fix, pick one:
  - Product fix: record the open's input type on the Trigger (a click with `detail > 0`, or the
    last `pointerdown`). After a pointer open, re-focus the resolved item with
    `{ focusVisible: false }` after `showPopover()`, where the engine supports that option.
  - Test fix: branch the assertion on `browserName === "webkit"` with a comment, and correct
    design 6.1 and the docs.
  Either way, fix it now: a red WebKit job hides every later regression.
- Also: the hover-intent row prints "An update to MenuRoot ... not wrapped in act" on WebKit,
  because the timers fire outside `act`. This is noise, not a failure (L4).

### M1. Clicking non-item space in a menu leaves focus on the popup; the arrow keys stop working
- Where: `menu-popup.tsx:220` (`if (nativeFocusgroup || !onItem) return;`) and `:257`
  (`tabIndex: -1` on the popup).
- Scenario: the popup has `tabindex="-1"`, so it is click-focusable. A click on its padding, a
  `Menu.Separator` or a `Menu.GroupLabel` moves focus from the current item to the popup. After
  that, ArrowDown / ArrowUp / Home / End do nothing; only typeahead, Escape and Tab still work.
  Probed in Chromium and Firefox: after a click on the separator, focus is on the popup before
  and after ArrowDown. A keyboard-plus-mouse user is stuck, against APG Menu.
- Fix:
  - Preferred: an owned `onMouseDown` on the popup that calls `preventDefault()` when the target
    is not inside an item. Focus then stays on the current item, matching the pointer-focus
    model in 6.2.
  - Also: when the target is the popup itself, ArrowDown / Home focus the first item and
    ArrowUp / End the last. This also covers the "popup takes focus as a last resort" case.
  - Add a jsdom row and a browser row.

### M2. Dialog.Close still closes a re-opened dialog (no open-generation guard)
- Where: `dialog-close.tsx:94-103`; `useActionTrigger()` is called with no generation.
- Scenario: a `Dialog.Close` action is pending; the user presses Escape (the content unmounts),
  then opens the dialog again; the action resolves. `useActionTrigger` still runs `then` after
  unmount, as it should, and `then` reads the Root's `dialogRef`: `dialog.open` is true, so it
  calls `close()` on the new open. Popover.Close and Menu are guarded (PO rule, popover.md 3.4).
  Dialog.Form guards the same case with `closedSinceSubmit`. Dialog.Close is the one part left
  without a guard.
- This is not a regression; the old code behaved the same. Now that the hook takes
  `openGeneration`, the fix is cheap: a counter in Dialog.Root bumped on every open, passed to
  `useActionTrigger(openGeneration)`, and a jsdom row like popover.test.tsx:1308.

### M3. The shipped WebKit submenu default (`flip-inline`, WebKit 302008) is never exercised
- Where: `menu.browser.test.tsx:62` (`subSide = null` on WebKit, used by every submenu row) and
  `:418` (`it.runIf(subSide !== null)`: on WebKit this is a skip).
- Design 13.2 and PO decision 6 asked for one dedicated WebKit row that uses the default
  fallbacks, recorded with `test.fails`, not a skip, so the first CI run would show whether the
  contingency applies (dropping the submenu fallback). No such row exists, so we still do not
  know whether Safari users hang on a default submenu.
- Fix: add that row, opening and closing a submenu with the default `side`. Bound it with a
  timeout so a hang fails instead of stalling the job. Decide question 6 from its result.

### L1. The open-generation guard on checkable items is untested
- `menu.test.tsx:858` renders a `closeOnActivate` CheckboxItem but only activates the Item.
  Add a CheckboxItem row and a RadioItem row: dismiss and re-open while the change action is
  pending; the menu must stay open (`closeStackLater`, `menu-context.ts:43-49`).

### L2. Stale design and conventions text about useActionTrigger
- `design/components/dialog.md:1596-1603`, the "Close." bullet: "Own `useTransition` ... a
  superseded rejection here is dropped by React ... recorded as a known gap". Closed by
  ac7064e; rewrite it to describe `useActionTrigger`. Also mention the missing generation guard
  (M2) or its fix.
- `design/conventions.md:684-689`: "lands as a follow-up ... Until it lands ... a recorded gap".
  The signature there is `useActionTrigger(action)`; the real one is
  `useActionTrigger(openGeneration?) => { pending, run(work, then?) }`.
- `design/components/menu.md` 12 ("dropped by React (Dialog.Close's known gap ...)") and the
  13.1 "Superseded rejection" row ("documented gap").
- `design/components/popover.md:1542`: M2 is still marked "(open)".

### L3. Deviations not yet written into the design
- menu.md 13.1, "Sync action" row: `keydown` for Enter becomes `click` (deviation 2).
- menu.md 14: the file list (deviation 4).
- menu.md 3.6: "if present" becomes "always" (deviation 5).
- menu.md 4: re-activating the selected RadioItem closes with `closeOnActivate` (deviation 3).
- menu.md 14: popup handlers are owned props, not hook options (deviation 1).
- Docs `MenuPage.tsx:162` says only "Re-activating the selected radio item dispatches nothing";
  add "and, with `closeOnActivate`, closes the menu".

### L4. act() noise in the browser hover-intent row
- `menu.browser.test.tsx:385-416`: timer-driven Root updates land outside `act` and log
  warnings on every engine. Turn off `IS_REACT_ACT_ENVIRONMENT` for that row (as the VT rows
  do), or poll inside `act`.

### L5. Document React's async-action entanglement on the Menu page
- Dev memo finding: if the menu is dismissed and re-opened while an item's async action runs,
  the re-open does not commit until that action settles. Until then the Trigger shows
  `aria-expanded="true"` / `data-pending` and no menu. This is React's entanglement of
  transitions started inside an async action scope, not a library bug. A slow Server Function
  behind an item will hit it, so the page should say so in one sentence (the same applies to
  Popover.Close).

### L6. MenuRoot context identity
- `menu-root.tsx:117-136`: the context value is a new object on every render, with a
  `root: null as unknown as MenuContextValue` cast patched afterwards.
- `menu-popup.tsx:170-173`: the `useMemo` on `listContext` depends on `menu`, so it never hits.
- Not a correctness bug; the Popover hooks do not memoise either. Either drop the useless
  `useMemo`, or memoise the value and build `root` without the cast.

## Deviation verdicts
1. No `onKeyDown` / `onFocusOut` / `role` hook options: **accept as is.** Owned props on the
   element are simpler, and the Popover review already anticipated this. Update menu.md 14.
2. Keyboard activation through `element.click()`: **accept as is.** Without it, a `render`ed
   link would not navigate and an item composed with `Dialog.Trigger` would not run its command
   (the layering row passes on all engines through this path). Consumers can still tell keyboard
   from pointer by `details.event.detail === 0`. The docs already say "click for pointer and
   keyboard alike" (`MenuPage.tsx:138`). Space-held probe: no re-open on keyup in Chromium or
   Firefox. Update menu.md 13.1.
3. Re-activating the selected RadioItem closes without a dispatch: **accept as is.** Activating
   the current choice of a close-on-select menu should close it; there is no change, so no
   dispatch (conventions 2.3 item 8). Document it (L3).
4. Group, GroupLabel and Separator in `menu-group.tsx`: **accept as is.** Three tiny stateless
   parts sharing one context; nothing is gained by splitting. Update the menu.md 14 file list.
5. `Menu.RadioGroup` always emits `aria-labelledby`: **accept as is.** It matches `Menu.Group`.
   A dangling IDREF is ignored by accname 1.2 step 2B, so a consumer's `aria-label` still names
   the group. (axe may flag it "needs review"; acceptable.) Update menu.md 3.6.
6. Open-generation guard on checkable items: **accept as is.** A `closeOnActivate` close from a
   previous opening must not close a new one; it is the same PO rule, applied the same way. Add
   the missing test (L1).

## The useActionTrigger refactor
- `use-action-trigger.ts` mirrors `useControllableAction`'s superseded-rejection logic: it
  throws before `useTransition`, keeps the first superseded error, reports later ones, and drops
  errors after unmount. The generation is read when `run` is called and checked before `then`.
- Popover.Close: the behaviour is identical (the generation guard moved into the hook), and the
  new superseded row passes.
- Dialog.Close: identical, with the new row; see M2 for the guard it still lacks.
- `usePopoverTrigger`: with no `handlers` / `activate` / `disabledAs`, the result is the same
  as before for Popover.
- Tooltip moved to `createDelayedPair` with the same semantics.
- No regressions found. dialog.md ~1594-1603 is indeed stale (L2).

## Checks that passed
- APG roles: `button[aria-haspopup=menu][aria-expanded]` with an id; `div[role=menu]` with
  `aria-labelledby` pointing at the (Submenu)Trigger; `menuitem` / `menuitemcheckbox` /
  `menuitemradio` with `aria-checked` from optimistic state; `aria-disabled` and never the
  native `disabled`; `group` + GroupLabel; `<hr>`.
- Keyboard:
  - Trigger: Enter / Space / ArrowDown open on the first enabled item, ArrowUp on the last.
  - In the menu: Up / Down wrap (or not, with `loop={false}`); Home / End; typeahead (cycling,
    prefix, 500 ms reset, `label`, Space as a character while typing); Enter / Space through
    the click; modified keys are ignored.
  - Submenus: ArrowRight / ArrowLeft, mirrored under RTL; on an already-open submenu,
    ArrowRight focuses its first item without a dispatch.
  - Escape closes the innermost menu, with the library returning focus for submenus.
  - Tab / Shift+Tab close the stack, also from a submenu (probed).
- Focus return: to the Trigger after activation with `transition` (H1 probe from the Popover
  review, browser row); to the SubmenuTrigger on Escape / ArrowLeft; to the root Trigger on
  activation inside a submenu.
- Async: the item's own transition with `data-pending`; close after settle through the root
  Root (`"activate"`) and nested `"dismiss"`; a rejection keeps the menu open; superseded
  rejections reach the boundary; optimistic checkbox / radio with rollback; suspending items
  hold the open (root and submenu).
- `closeOnActivate` defaults are as designed; a dialog opened from an item keeps the menu open;
  a Tooltip on an item does not close it.
