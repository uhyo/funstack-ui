# Issue #117: real-mouse browser rows for every "click X while open" case

Branch `test/117-click-while-open` (worktree `.claude/worktrees/dev-117`), 2026-10-24.

## Approach

- Shared suite (`__tests__/overlay-browser-suite.tsx`): new config field `pressesWhileOpen`
  (one entry per table row) and describe "a real press while open (#117)". Each row: deferred
  close action, open through `config.open()` (inside act), then `leaveActEnvironment()` and
  `mouse.down` / `sleep(20)` / `mouse.up` at the target (centre or `at` offset). Asserts at
  the press (shown, no dispatch, focus), then per outcome:
  - `awaited`: still shown after the release, one `(false, "activate", eventType)`, focus where
    the press left it, `aria-expanded="true"`; shown through a quiet period; resolve; hidden;
    focus `focusAfter`.
  - `dismissed`: hidden quickly, one `(false, "dismiss", dismissEvent)`, focus `focusAfter`.
  - `kept`: open, no dispatch, focus unchanged after a quiet period.
  - `hiddenAtPress` (Menu's focusout close) applies only where the press focused the target.
- `engine.ts`: `pressFocusesButtons()`, a lazily measured real-press probe (Chromium, Firefox,
  Playwright Linux WebKit: true; Safari macOS would be false). The focus expectations branch on
  it, not on the engine name.
- Engine facts measured (Chromium, Firefox): pressing non-focusable content inside a `<dialog>`
  (Dialog popup or Popover's `<dialog>` popup), or a modal dialog's `::backdrop`, focuses the
  `<dialog>` itself. The rows assert that.

## Inventory (closing tables -> rows)

Legend: NEW = added in this branch; EXISTS = an earlier real-input row covers it.

### Popover (2.3, 7)
- Trigger click while open (library): NEW suite row (awaited). The older `user.click` row
  "a Trigger click while open closes through the library" stays (no pending window).
- Close part (library): NEW suite row (awaited, focus back to the Trigger).
- Click outside (light dismiss): NEW suite row (dismissed at the release). Older user.click row
  stays.
- Click inside the popup (no close): NEW suite row (kept; focus goes to the `<dialog>`).
- Foreign `hide-popover` / `toggle-popover` invoker: NEW, two rows (browser-owned, `"activate"`,
  `CommandEvent`).
- Nested: inner Trigger while both open: NEW (inner awaited, outer stays). Outer content press:
  NEW (inner dismissed, outer stays). The outside press with both open: EXISTS ("a click
  outside closes both").
- Non-button Trigger (#115): EXISTS.
- JS-free Trigger and Close: EXISTS (JS-free mode row, real `user.click`, no dispatch to assert).

### Dialog (2.3, 7)
- Close part (library): NEW suite row (awaited).
- `method="dialog"` submitter (library, SubmitEvent): NEW suite row (`FormHarness`).
- Close with `action`: EXISTS ("a Close action runs, then closes").
- Dialog.Form with a function action: EXISTS.
- Foreign request-close invoker: EXISTS (user.click).
- Modal backdrop with lightDismiss: NEW suite row (dismissed, `close` event, focus to Trigger).
- Modal backdrop without lightDismiss: NEW suite row (kept).
- Content inside: NEW suite row (kept).
- Non-modal Trigger with lightDismiss (#116): EXISTS.
- Non-modal Trigger without lightDismiss: NEW (nothing closes or dispatches).
- Non-modal click outside: EXISTS (user.click).
- Modal Trigger: under the `::backdrop`, so it is the backdrop row.

### Menu (2.2)
- Trigger click while open (#110): EXISTS (split press and full click).
- Item activation by click (library): NEW suite row (awaited).
- Click outside: NEW suite row. The press focuses the outside button, so `focusout` hides the
  menu at the press (`hiddenAtPress`), and then `"dismiss"` arrives with the toggle.
- Non-item space (padding): NEW suite row (kept). The older user.click row covers Separator and
  GroupLabel.
- SubmenuTrigger while its submenu is open: NEW (stays open, focus moves into it, nothing
  dispatched).
- Sibling item while a submenu is open: NEW (submenu `"dismiss"`, root awaited `"activate"`).
- Outside with a submenu open: EXISTS ("a click outside closes both").
- Right-click and middle-click outside (#45): EXISTS (menu-context-trigger.browser.test.tsx).
- Non-button Trigger (#115): Popover's row. Menu shares `usePopoverTrigger`.

### Combobox (5.4)
- Trigger (#112): EXISTS. Labels (#111): EXISTS.
- Option click (library, after the value action): NEW, with the pending window and the
  openChange `(false, "activate", "click")`.
- Clear while open (browser light dismiss): NEW (`(false, "dismiss", "toggle")`, text emptied,
  null dispatched, focus kept, not re-opened).
- Another field (focus leaving): NEW (hidden at the press, `(false, "dismiss", "focusout")`,
  text reverted). Uses the `before` input, because the listbox covers `after`.
- Page without a focus target: EXISTS (#111 rows).
- The input itself: NEW, **`it.fails`, bug #123**. A real press light-dismisses the listbox.
  `source` gives no exemption; the design and research claim it does.
- Popup padding, disabled option: NEW (kept).

### Select (8)
- Option click: EXISTS ("a pick through the picker").
- The select itself while open, and outside while open: NEW. The picker closes, nothing is
  dispatched, the value is unchanged. `describe.runIf(supportsBaseSelect)`; Firefox has no
  in-page picker (as in the file's other rows).

### Tooltip (2.1, 2.2, 5.2)
- Trigger press (JS path): NEW split press (hidden at the press, no re-open while hovered).
- Popup press (JS path): NEW split press.
- Outside press: EXISTS ("a pointerdown outside closes it immediately").
- Native interestfor path, trigger press keeps it open: NEW, `runIf(supportsInterestFor)`.

## Spot checks (Chromium)

- `usePopoverTrigger` without `commandfor`: the Popover Trigger suite row, the nested inner
  Trigger row and the SubmenuTrigger row fail.
- #110 reverted (`Menu.Trigger` mousedown not prevented): both #110 rows fail.
- Combobox Popup pointerdown/mousedown not prevented: the padding row fails. The option rows do
  not, because Option prevents the press itself.

## Not covered

- ContextMenu (context-menu.md) is outside the six overlays in the task. Its outside presses are
  in menu-context-trigger.browser.test.tsx.
- WebKit is not runnable locally. CI decides there. The `<dialog>` focus-at-press facts are
  measured in Chromium and Firefox only.
