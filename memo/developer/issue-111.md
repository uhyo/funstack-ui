# Issue #111: Combobox label press discarded the typed text

## Cause
`focusOut`'s `relatedTarget === null` branch ran its leave check `setTimeout(0)` after the blur,
i.e. one task after `mousedown`. A press on a `<label for=input>` blurs to `<body>` at mousedown
and refocuses the input only at the click (the pointerup task). Firefox: even a quick click
reverted/committed. Chromium: an ~80 ms hold did.

## Fix (combobox-root.tsx)
Root tracks presses with document capture listeners (a Set of pointerIds: `pointerdown` adds,
`pointerup` / `pointercancel` delete). After review (F1-F3) they are attached on the Input's
`onFocus` (chained, consumer `onFocus` still runs) or at mount if the input is already focused
(before hydration), on the input's own document, and removed when the leave is decided (at once,
or at the release) or the Root unmounts. Window `blur` and focus arriving in the input clear the
Set, so a swallowed release cannot hold the check back. In the null branch, if a pointer is down, the check is
stored and scheduled `setTimeout(0)` after the release (the click runs in the pointerup task, so
the check sees the label's refocus). Without a press (script blur): one task later as before.
Window blur: `doc.hasFocus()` false, still a no-op.

The listbox still closes on a label press: light dismiss (the label is outside the popup). Rows
assert that; only the text / dispatch were the bug.

## Tests
- Browser (combobox.browser.test.tsx, "a press on a label is not focus loss (#111)"): quick
  click and 80 ms hold on Combobox.Label and Field.Label, both allowCustomValue modes (8 rows),
  plus a held press on the page (reverts only after release) and a quick page click with
  allowCustomValue (commits). Before the fix: Chromium 5 failed (holds + held page press),
  Firefox 9 failed (all label rows + held page press).
- jsdom: 4 rows under "focus to nowhere during a press (#111)".
- Mutations (all caught): no defer; release never decides; no pointercancel; decide
  synchronously at pointerup (jsdom 1 row, browser 16 rows); pointerdown not tracked.

Review round: F4 browser rows (drag off the label reverts; openOnClick label click keeps the
text and does not reopen) and jsdom rows (several pointers, window blur, focus forgets a stuck
press, listener lifetime via document add/removeEventListener spies, focused before hydration).
Mutations all caught: no focusIn, focus keeps presses, no window blur, boolean instead of Set,
no unwatch on immediate leave / on relatedTarget leave / on release / on unmount, no mount watch.

## Design
5.4 row and the test-plan Focus loss row updated with the reviewer's wording (PO-approved).
The walkthrough's Input bullet (`setTimeout(0)` for relatedTarget null) still describes only the
no-press path.
