# Issue #111: Combobox label press discarded the typed text

## Cause
`focusOut`'s `relatedTarget === null` branch ran its leave check `setTimeout(0)` after the blur,
i.e. one task after `mousedown`. A press on a `<label for=input>` blurs to `<body>` at mousedown
and refocuses the input only at the click (the pointerup task). Firefox: even a quick click
reverted/committed. Chromium: an ~80 ms hold did.

## Fix (combobox-root.tsx)
Root tracks presses with document capture listeners (`pointerdown` sets `pressing`;
`pointerup` / `pointercancel` clear it). In the null branch, if a pointer is down, the check is
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

## Design follow-up
design/components/combobox.md 5.4 (line ~706) says the null-relatedTarget check runs "a task
later"; it now runs a task after the press is released when a pointer is down. Architect to
amend the wording.
