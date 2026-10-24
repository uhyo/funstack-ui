# #123: a press on Combobox.Input while open stays open

Branch `fix/123-combobox-input-press`. Design: combobox.md amendment "a press on the Input while
open stays open (#123)", 5.1, 5.4, 3.2, 12.2, 14; conventions 3.5.

## What changed

- `internal/pointer-capture.ts`: `capturePointer` moved out of `menu/menu-dom.ts`; the Menu's
  Popup and ContextTrigger import it from there. Behaviour unchanged.
- `combobox-root.tsx`: `inputPointerDown(event)`: nothing while `disabled` or for `button !== 0`;
  otherwise `capturePointer(popup, pointerId)` when the Popup matches `:popover-open` (not the
  intent: a press during a pending close is captured too). On the context.
- `combobox-input.tsx`: `onPointerDown` is owned (in the `Omit` and in the doc comment). The
  ref-callback comment no longer claims `source` exempts the input from light dismiss.
- Docs `ComboboxPage.tsx`: the overview sentence and the Input's owned keys.
- Test harness: `mouse.dblclick` (browser-commands.ts, `dblclick` action in the vitest.config.ts
  `mouse` command, Playwright `page.mouse.dblclick`).

The #111 press tracking needs no change: its document-level capture-phase `pointerup` still sees the
captured release (the Popup is in the document). The #111 rows pass.

## Tests

jsdom (`combobox.test.tsx`, "Input press (#123)"): capture once on the Popup with the press's id
(through the shim, `capturedPointers`), touch press captured, nothing while closed, nothing for
buttons 1 and 2, nothing while disabled (controlled `open` keeps it shown), captured during a
pending close (`:popover-open`, not the intent), a throwing `setPointerCapture` swallowed,
`openOnClick` still opens from a click while closed, `onPointerDown` is an owned key (type
error). Mutations: drop the `:popover-open` check, the button check, the disabled check, use
`popover.optimistic`, drop the Input handler: each fails at least one row.

Browser (`combobox.browser.test.tsx`, "Input press (#123, browser)"), text "Wide Words", every
option listed, caret points from canvas `measureText` with the input's computed font:
- caret click at 3 with `openOnClick`: `[3, 3]`, stays open, the only `click` targets the Popup,
  no open / value dispatch;
- `mouse.dblclick` mid "Words": `[5, 10]`, stays open;
- drag 2 → 8: Chromium `[2, 8]`, Firefox `[2, 2]` (`browserName === "firefox"`, the documented
  cost), stays open; WebKit expected `[2, 8]`, CI decides;
- nested in an open Popover: both stay open;
- touch tap (CDP, Chromium only, as the Menu / NumberField touch rows): see the finding below.
Mutation: with the Input's handler removed, all 9 (chromium + firefox) fail.

The #117 row is flipped (after rebasing onto #117): "the input: nothing closes or dispatches; the
input keeps focus and its text" (shown at the press and 80 ms after the release, focus and text
kept, `aria-expanded="true"`, no dispatch).

## Finding: Chromium, touch, inside an iframe

Plain-DOM Playwright probe (Chromium 156, `hasTouch` context, `touchscreen.tap`; CDP
`Input.dispatchTouchEvent` the same), input as `source`, `popup.setPointerCapture` at the input's
`pointerdown`:

| | top-level page | same-origin iframe |
| --- | --- | --- |
| Chromium mouse | open | open |
| Chromium touch | open | **closed** (at the gesture's `click`) |
| Firefox mouse / touch | open | open |

Event order in the iframe is identical to top-level: `pointerdown:input`, `pointerup:popup`,
`mousedown` / `mouseup` / `click:input`, then `toggle`. Without capture both close; a tap inside
the popup or on a `commandfor` invoker stays open in the iframe. So Chromium's click-time
comparison (`LightDismissFromClick`) does not see the captured `pointerup` target for a touch
gesture in a subframe. Looks like a Chromium bug; recorded as #124 (human task to report
upstream). vitest's runner is an iframe, so the touch row branches on
`window === window.top` and asserts the close with `(false, "dismiss", "toggle")` in a frame.
Probe script was in the session scratchpad (touch-probe2.mjs); the matrix above is the result.

WebKit: not runnable locally; CI decides the drag and the press rows.

## Release notes

- fix: a press on `Combobox.Input` while the listbox is open no longer closes it (the Input now owns
  `onPointerDown` and captures the pointer to the Popup). In Firefox, a drag-to-select in the
  field does not extend while the listbox is open. (#123)
