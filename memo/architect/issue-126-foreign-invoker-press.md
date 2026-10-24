# #126: a foreign invoker pressed while a Menu / Combobox is open (2026-10-25)

Found by the #125 developer (memo/developer/issue-125.md): a consumer's own
`<button popovertarget={popupId}>` outside a Menu, pressed with a real mouse while the menu is
open. Chromium and Firefox focus the button on `mousedown`, the root Popup's `focusout`
(`relatedTarget` = the button) hides the menu as `"dismiss"` before the `pointerup` and the
`click`; the click's native toggle then finds a hidden popover and re-shows it (Firefox, with the
first item focused); with the library Chromium ended closed with the wrong reason. Same class as
#110 (conventions 3.5, the `mousedown` focus trap), one step further out: the pressed element is
not a part.

## Probe

`probes/126-foreign-invoker-press/` (plain DOM, Playwright real pointer, Chromium 156 and
Firefox 157; WebKit cannot launch on this machine, missing GTK/GStreamer libraries, CI decides it;
the #110 finding that WebKit never focuses a button on click makes the guard a no-op there).
Two focus holders (an item inside the popup, Menu-like; an input outside it shown with
`source: input`, Combobox-like), four buttons (`popovertarget`, `commandfor` + `toggle-popover`,
`commandfor` + `hide-popover`, a plain button), three handlings, three gestures.

| Handling | Press on an invoker | Dragged-off press | Tab from the last item onto the invoker |
| --- | --- | --- | --- |
| baseline (today) | `focusout` → `hidePopover()` (source `null`, "dismiss") → `focusin(button)` → `pointerup` (light dismiss moot) → `click` → native **re-open** `beforetoggle(open, source=button)`. Both engines, both holders. `hide-popover` ends closed, wrong reason | closed, "dismiss", focus on the button | closed (correct) |
| `focusout` ignores an invoker `relatedTarget` | closed by the click's toggle, `source` = button ("activate"), focus on the button | **popup open, focus on the button**; a later Tab closes nothing (no `focusout` left) | **popup open, focus on the button** (APG: Tab closes) |
| capture `mousedown` on the document prevents the default for an invoker of the shown popup | no focus move; `click` → native hide `beforetoggle(closed, source=button)` ("activate", #125); focus returned to the Trigger (item holder: the platform's hide) / still in the input | popup open, focus still on the item / input | closed (unchanged) |

`relatedTarget.matches(":active")` is `true` at the `focusout` of a press on both engines, so a
press could be told from a Tab in the `focusout` path, but that would still strand the dragged-off
press. The guard has no such hole.

In plain DOM both engines re-open; the #125 memo saw Chromium end closed with the library. The
difference is only whether the notification's commit had landed when the click's foreign open was
cancelled at `beforetoggle` and routed through `requestOpen` (`intended()` still `true` → no
re-open): engine-dependent timing, exactly what 3.5's single-source rule exists to remove.

## Decision

A press on an invoker of this popup is not a focus-out. Menu's root Popup and Combobox's Popup
keep a document capture `mousedown` listener alive while the popup is shown (the lifecycle Menu's
`listenOutside` already has in `onToggle`) that calls `preventDefault()` for the primary button
when the target's closest `<button>` is outside the popup and names it:
`button.popoverTargetElement === popup`, or `button.commandForElement === popup` with a
`*-popover` `command`. That is the relationship light dismiss exempts, so the three steps of the
press now agree: no focus move, no light dismiss, the click's native toggle closes, #125 names it
`"activate"` with the `ToggleEvent` (or the `CommandEvent` for `commandfor`).

Own parts keep their rules: `Menu.Trigger`'s `onMouseDown` is judged on `intended()` (covers the
pending-open window and a non-button `render`, which has no `popovertarget`); Combobox's Trigger
and Clear prevent `mousedown` always. Popover is unaffected (no focus-leave close). A plain
foreign button is still an outside press: focus leaves, "dismiss".

Options weighed:
- (a) `focusout` ignores an invoker `relatedTarget`: breaks Tab-closes onto such a button and
  leaks after a dragged-off press (above). Qualified by `:active`: fixes Tab, not the drag-off.
- (b) prevent the invoker's `mousedown` (chosen): every engine ends in WebKit's state, the #110
  argument; it reaches a consumer element, but only a `<button>` that names our popup, and only
  while it is shown, the same thing the Trigger's own rule does to a consumer `render`.
- (c) document it: the pattern is one the library explicitly classifies (#125, whose Menu browser
  row had to prevent the button's `mousedown` by hand to pass), and a flicker + re-open is a bug.

Not escalated: no API change, no new reason, no new prop.
