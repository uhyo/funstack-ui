# Review: #123 Combobox.Input press keeps the listbox (branch fix/123-combobox-input-press, 699ce07)

Reviewed: diff origin/master...origin/fix/123-combobox-input-press (5108a51, 559ea5c, 699ce07 memo),
issue #123 (plan), #124, combobox.md amendment "#123", conventions 3.5, memo/developer/issue-123.md.
Probes: private worktree, Chromium + Firefox, vitest browser mode (real Playwright input), removed.

## Verdict

**Acceptable with minor fixes** (documentation only; no code change required). Implementation is
exactly the planned one, minimal, and correctly placed (`combobox-root.tsx:829`). Menu is unchanged
(pure move of `capturePointer`). Tests are good; the mutation I tried is caught.

## Findings

### R1 (medium, docs/design) The #124 touch-in-iframe limitation is not in the design or docs
- `packages/docs/src/pages/ComboboxPage.tsx:73-76` states unconditionally that a press on the input
  keeps the listbox open. Design 12.2 "Input press (#123)" row (combobox.md:1292: "Touch ... stays
  open") and the amendment's Verified table (combobox.md:2025) also have no frame caveat, while the
  browser row asserts the close in a frame (`combobox.browser.test.tsx:1306`).
- Confirmed by probe: in the vitest frame a Chromium CDP tap (and a tap with one small move) on the
  open field dismisses (`pointerup:popup, click:input, toggle`, `(false, "dismiss", "toggle")`).
- Matters: same-origin iframes are common hosts (Storybook canvas, docs playgrounds, embedded
  apps); a touch user there sees the listbox vanish on every tap into the field.
- Fix: amendment + 12.2 row name #124 (Chromium, touch, same-origin iframe: browser-shaped close);
  docs add a short clause. Owner: architect (design), technical writer (docs).

### R2 (low-medium, docs) Pass-through handlers that stop firing / start firing under the capture
Probe (mouse, both engines, open listbox, press on the input):
`pointerdown:input, mousedown:input, pointerout/leave:input, pointerover/enter:popup,
gotpointercapture:popup, mouseout:input, mouseover:popup, pointerup:popup, mouseup:popup,
click:popup, lostpointercapture:popup, pointerout/leave:popup, pointerover/enter:input, ...`
- A consumer `onPointerUp`, `onMouseUp`, `onDoubleClick` on `Combobox.Input` (pass-through props)
  is **not called** for a primary press while the listbox is open; `onMouseDown` still is.
- A consumer `onPointerLeave` / `onMouseLeave` on the Input and `onPointerEnter` /
  `onMouseEnter` / `onClick` on the Popup fire on every such press. (`:hover` is unaffected: the
  input keeps `:hover`, the popup does not get it.)
- The amendment's consequences mention only the Input's own `onClick` and the Popup's `onClick`;
  the docs PartFacts note ("other input props pass through", ComboboxPage.tsx ~line 343) says
  nothing. Add one sentence to the docs note (and the amendment's consequence list): while the
  listbox is open, a primary mouse/pen press's `pointerup`, `mouseup`, `click` and `dblclick` go
  to the Popup, and the pointer's boundary events cross to the Popup and back.

### R3 (low, design precision) "The click lands on the Popup" holds for mouse and pen, not touch
- Probe (Chromium CDP touch): `pointerup:popup` but `click:input` (the touch compat
  `mousedown`/`mouseup`/`click` come after `pointerup` and are hit-tested). So with `openOnClick`,
  `inputClick` runs for a touch tap on the open field (harmless where it stays open:
  `requestOpen` while open). conventions 3.5 ("`pointerup`, `mouseup` and the `click` land on the
  popup, so the part's own `onClick` does not fire") and the amendment's first consequence should
  say "for a mouse or pen press". The developer memo already reports `click:input` for touch.

### R4 (low, tests) No real-pointer row for "closed: the click reaches the input"
- Mutation: `if (popup !== null) capturePointer(...)` (drop the `:popover-open` check). jsdom:
  2 rows fail ("while closed", "openOnClick still opens", combobox.test.tsx:2352) - caught.
  Browser suite (combobox, Chromium + Firefox): all pass. The jsdom shim models the retarget, so
  this is covered; optional: one browser row "openOnClick, closed, real `mouse.click` on the input
  opens" would pin it against the real engines.

### R5 (info, unverified) macOS Ctrl+click
- Ctrl+click on macOS is a `button === 0` press that opens the context menu; it is captured. The
  amendment says `contextmenu` follows capture in Chromium, so its target may be the Popup (a
  consumer `onContextMenu` on the Input misses it; the native field menu is likely built from the
  hit test). Not testable on Linux; worth a check on a Mac, no change requested now.

## Questions answered (no finding)

- `window === window.top` branch (browser test :1306): acceptable. A feature probe would have to
  reproduce the bug itself (circular); the condition is the actual trigger of #124, the comment
  says the frame branch is the one that runs, and the row fails when Chromium changes. Keep.
- `mouse.dblclick` harness (browser-commands.ts:103, vitest.config.ts): sound. Waits for `dblclick`
  in the capture phase on `window`, so it resolves even though the `dblclick` targets the Popup
  under capture. Only `left` produces a `dblclick`; other buttons would hit the 5 s fallback
  (unused).
- Selection: caret click, double click (row), triple click `[0, 10]` and Shift+click `[0, 5]`
  (probe, both engines) work and keep the listbox. Firefox drag `[2, 2]` is the documented cost.
- Right press: not captured; `contextmenu`, `pointerup`, `auxclick` at the input. Chromium stays
  open, Firefox light-dismisses (pre-existing, documented in the amendment).
- Touch scroll: a touch drag starting on the input scrolls the page (173 px), `pointercancel`
  releases the capture on the Popup, the listbox stays open. Capture does not alter touch-action
  or scrolling (decided at the hit-tested input).
- Pen (Chromium CDP `pointerType: "pen"`): captured, `pointerup`/`click` on the Popup, stays open.
- `aria-activedescendant` survives a press (ArrowDown x2, press: unchanged, both engines).
- #111 press tracking: document capture-phase listeners still see the release; jsdom 459 and
  browser 273 (combobox + menu, Chromium + Firefox) pass.
- Popup closed mid-press (Escape while held, `openOnClick`): the Popup stays connected, the capture
  holds, the `click` lands on the hidden Popup, no re-open. If a consumer unmounts the Popup
  mid-press the engine drops the capture and the release is hit-tested: same as before #123.
- Pending close (Trigger with a pending `openChangeAction`) + press on the input with
  `openOnClick`: branch ends closed with no extra dispatch; master dispatched `[true, "activate"]`
  then `[false, "dismiss", "toggle"]`. An improvement.
- Trigger (#112), Clear: separate elements, untouched; their rows pass.
- Menu: `capturePointer` moved verbatim, imports updated; menu suites pass.
- Owned `onPointerDown`: type test present; no example or docs page passes it to the Input.
