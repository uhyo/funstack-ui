# Wave 17 improvement audit (read-only, master @ 2640d3e)

Audited 2026-10-24 for the product owner's "keep making it better" goal. Lenses: event-ordering
correctness that jsdom hides, a11y (APG), API consistency (conventions 4.1 / state objects),
docs-vs-declarations, test gaps. Out of scope: Menu Trigger close (#110), overlay browser test
dedup (#109), open "Upstream (human task)" issues.

Method:
- Scratch copy of the repo (`/tmp/claude-1000/-home-uhyo-repos-funstack-ui/7c1c2018-f4eb-4687-9fbe-78834b82f7c3/scratchpad/audit-w17/repo`);
  throwaway browser probes kept in `.../scratchpad/audit-w17/probes/` (Chromium + Firefox with
  real Playwright mouse input; WebKit is not runnable on this machine).
- jsdom suite in the copy: 3137 passed; the only failure was `directives.test.ts` asking for a
  fresh `dist/` (stale build in the copy, not a repo problem). Browser suite in the copy on
  Chromium + Firefox: 50 files, 799 passed, 23 skipped, no failures or flakes in one run.
- Docs props tables vs. the `*Props` interfaces and destructuring defaults, by script
  (`.../scratchpad/audit-w17/scripts/props.py`, `defaults.py`): no missing or wrong rows found
  (the hits were all helper-generated rows). The docs are in good shape; see D1 for the one
  behavioural sentence that is wrong.

Overall: the library is in good shape. Every area I probed beyond the two Combobox findings
below held up in real engines (Toast re-raise keeps focus, NumberField step buttons keep focus,
Tabs/ToggleGroup focus paths are documented, Dialog light dismiss needs press+click outside).
The highest-value work is the #110 class in Combobox.

## Findings

### C1 (medium) Combobox Trigger close while open is browser-shaped, not library-owned: no wait for `openChangeAction(false)`, flicker on refusal, no exit view transition
`packages/ui/src/combobox/combobox-trigger.tsx:97-123`, design `design/components/combobox.md:703`
(5.4 row 1), docs `packages/docs/src/pages/ComboboxPage.tsx:218`.

The Trigger is not the popover's `source` (the input is) and has no `commandfor`, so a press on it
is a light dismiss: the platform hides the listbox at `pointerup`, in the same task as the click,
before any action runs. The click then calls `requestClose(event, "activate")` (the toggle task
comes later and is an echo), so the reason is right, but the close is not "awaited" as design 5.4
row 1 and the docs say.

Verified (probe `combobox-trigger.browser.test.tsx`, Chromium and Firefox, identical):
- uncontrolled, `openChangeAction` resolving after 300 ms: the listbox is hidden 20 ms after the
  release; one dispatch `false:activate:click`.
- controlled `open={true}` parent that refuses the close (action does not change `open`):
  async 300 ms action -> hidden at release, shown again ~300 ms later (a visible close/re-open
  flicker); sync action -> hidden and re-shown in the same frame (exit + entry animation replays).
- With `transition` on the Popup the library-driven close's `<ViewTransition>` exit cannot run
  for this close (the popup is already hidden when the close commits). Argued from
  `use-popover-popup.ts` apply effect: committed `false` finds `shown === false` and does nothing.

Same class as #110 (an event the library does not own pre-empts the click), but engine-independent.
Fix (verified direction): make the Trigger an invoker of the popup for light-dismiss purposes. A
button with `commandfor={popupId}` (or `popovertarget`) whose click is cancelled is exempt from
light dismiss in Chromium and Firefox (probe `invoker-light-dismiss.browser.test.tsx`: `none` ->
closed, `commandfor` -> stays open, `popovertarget` -> stays open). Design 2.4 rejected
`commandfor` because of a pre-hydration click (empty, button-anchored popup); write the attribute
from the Trigger's ref / a layout effect after hydration instead of rendering it (conventions 7.4),
so the server HTML has no invoker and a hydrated click is cancelled as today (the command never
runs, so the implicit anchor stays the input). Then the `openAtPress` snapshot is unnecessary
(the state at click equals the state at press). Needs a WebKit check on CI. Alternatively,
accept the browser shape and correct design 5.4 / the docs row and the "Awaited" prop text.
Effort: M (design amendment + Trigger change + browser rows on all three engines).

### C2 (medium) Combobox: pressing the Label (or a Field.Label) while typing reverts the typed text (or commits it as a custom value) and closes the listbox; engine-dependent
`packages/ui/src/combobox/combobox-root.tsx:724-744` (`focusOut`, the `relatedTarget === null`
branch), `packages/ui/src/combobox/combobox-label.tsx:38`; design `combobox.md:706`.

A press on a non-focusable `<label for=input>` blurs the input with `relatedTarget === null`. The
deferred check runs `setTimeout(0)` after the **mousedown** task, not after the click (the comment
says "Decide after the click", but mousedown and click are always separate tasks). At that moment
`document.activeElement` is `<body>`, so `leave()` runs: listbox hidden, text reverted to the
selection's label, or (`allowCustomValue`) the partial text committed through `valueChangeAction`.
The label's activation then refocuses the input.

Verified (probe `combobox-label.browser.test.tsx`, typed "Ja" with the listbox open):
| | press-hold-release (80 ms) | quick click |
| --- | --- | --- |
| Chromium, default | text "" (reverted), closed | text kept, closed |
| Chromium, `allowCustomValue` | `valueChangeAction("Ja")`, closed | nothing dispatched, closed |
| Firefox, default | text "" (reverted), closed | text "" (reverted), closed |
| Firefox, `allowCustomValue` | `valueChangeAction("Ja")`, closed | `valueChangeAction("Ja")`, closed |

So in Firefox a plain click on the Combobox's own label throws away what the user typed, or
saves a partial value; in Chromium it depends on how long the button is held. With `openOnClick`
the forwarded label click re-opens the listbox right after.
Fix: in `focusOut`'s null branch, if a primary pointer is down (track `pointerdown` / `pointerup`
on the document, capture), defer the decision to one task after the `pointerup` (the click
follows it in the same task) instead of one task after the blur. That covers `Combobox.Label`,
`Field.Label` and any `<label for>`. A narrower alternative: `Combobox.Label` prevents the
`mousedown` default while the input is focused (focus never leaves); it does not cover
`Field.Label`. Add a browser row (hold and quick click, both modes). Effort: S-M.

### D1 (medium, docs; part of C1) ComboboxPage says the Trigger close is awaited
`packages/docs/src/pages/ComboboxPage.tsx:218`: "Awaited for opens and for the closes the library
performs (an accepted option, the Trigger)". Not true today (C1). Fix with C1, whichever way it
goes. Effort: S.

### T1 (medium, tests) No browser row exercises the Combobox Trigger close or a Label press
`packages/ui/src/combobox/combobox.browser.test.tsx` covers pointer focus on the Trigger and Clear
but not "Trigger click while open with an async / refusing `openChangeAction`" nor a press on the
Label while typing; both bugs above pass jsdom. The #110 lesson generalises: every "click X while
open" row of every overlay's closing table (design 5.4 / menu.md / popover.md) should have one
real-mouse browser row asserting visibility during the pending window and the reason. A quick
inventory of such rows: Popover Trigger (has), Menu Trigger (being added, #110), Combobox
Trigger (missing), Combobox Clear (has, light dismiss by design), Dialog Trigger non-modal (check).
Effort: S per row; M for the sweep.

### A1 (low, a11y) The fallback live region is inert while a modal dialog is open, and is dead code under the browser policy
`packages/ui/src/internal/announce.ts:32-41`. The fallback appends a `role="status"` region to
`document.body`; inside an open modal `<dialog>` everything outside is inert and hidden from AT,
so a NumberField step or `Form.Root`'s "error already focused" announcement in a modal would be
silent. In practice `ariaNotify()` exists in all three stable engines (Chromium 141, Firefox 150,
Safari 27, `src/__tests__/engine.ts:63`), so the fallback never runs in supported browsers.
Fix: drop the fallback (simplest, matches "no fallbacks" in docs/vision.md), or append it to the
topmost modal via `modal-registry.ts` as Toast does. Effort: S.

### A2 (low, a11y) `CheckboxGroup.Parent` has no `aria-controls`
`packages/ui/src/checkbox-group/checkbox-group-parent.tsx`. The APG "Checkbox (Mixed-State)"
example the design follows (`checkbox-group.md:21`, row 5) links the mixed checkbox to the boxes it
controls with `aria-controls`. The design does not mention it either way. The Items are native
inputs; the Parent knows its `values`, so it can token-merge the matching Items' ids (they need
ids from the registry). Value is modest (AT support for `aria-controls` is thin), so record a
decision rather than necessarily implement. Effort: S (decision) / M (implement).

### A3 (low, a11y) Toast Root hijacks ArrowUp / ArrowDown from content inside it
`packages/ui/src/toast/toast-root.tsx:228-237`. The Root's `onKeyDown` handles keys bubbling from
any descendant, so a text field or textarea inside a toast (an inline reply, a "name this" input)
loses caret movement to sibling-toast navigation, with `preventDefault()`. Fix: only when
`event.target === event.currentTarget` or the target is not a text-entry control. Effort: S.

### API1 (low) Conventions 4.1 vocabulary table lags the emitted attributes
`design/conventions.md:1304-1327`. Emitted but not listed: `data-modal` (Dialog.Popup,
`dialog-popup.tsx:585`; the table's `open` row even says the dialog "emits none"), `data-index`
(Slider.Thumb, `slider-thumb.tsx:242`), and `empty` lists only Combobox.List while Toast.Viewport
also emits `data-empty` (`toast-viewport.tsx`). All three are documented on their component pages,
so this is only the registry. Effort: S.

### API2 (low) Item state objects without `value`
`ToggleGroupItemState` (`toggle-group/toggle-group-item.tsx:17`) and `MenuRadioItemState`
(`menu/menu-radio-item.tsx:11`) have no `value`, while every other item-like part's state does
(Accordion Item, Tabs Tab, RadioGroup Item, CheckboxGroup Item, Select / Combobox Option). A
shared `className={(s) => ...}` or `render` function cannot tell items apart without closing over
the prop. Additive. Effort: S.

### API3 (low) Several Triggers in one overlay Root: neither supported nor warned
`internal/use-popover-trigger.ts:99-106`, `dialog/dialog-trigger.tsx:88-90`. The Root keeps one
`triggerRef` (last mounted wins; unmounting the registered one leaves `null` while another is still
mounted). A second Popover/Menu/Combobox Trigger is not the popover's `source`, so a press on it
while open is a light dismiss (C1's behaviour), focus returns to whichever registered last, and
`showPopover({ source })` anchors to it. No design or docs statement says one Trigger per Root.
Fix: a dev warning on a second registration, and a sentence in the docs (or design support for
several Triggers, as Base UI added). Effort: S (warning).

### N1 (low, needs a human check) NumberField step buttons ignore a click with `detail >= 1` that had no pointer press
`packages/ui/src/number-field/use-step-button.ts:134-141`. A click only steps when no pointer
gesture was seen **and** `detail === 0`. If an assistive technology activates the button with
synthesised mouse events but no pointer events (VoiceOver's VO+Space on macOS is the case to
check), the click has `detail === 1` and nothing steps. The `detail` condition exists for a touch
click that arrives after `pointerSeen` was reset. Combobox.Trigger solves the same problem by
falling back rather than dropping. Suggest a human VoiceOver check (add to an existing "human
check" issue); if it fails, key the guard on "a pointerup of this button happened within N ms"
instead of `detail`. Effort: S to check, S to fix.

## Not findings (checked, holds)
- Toast re-raise (`hidePopover(); showPopover()` on add) with focus on a toast or its Close: focus
  stays (Chromium, Firefox; probe `toast-reraise.browser.test.tsx`).
- NumberField step buttons: `pointerdown` is prevented, so the typed draft is the step base and
  focus stays; Enter writes the hidden input synchronously before implicit submission.
- Tabs automatic activation on a mouse click dispatches from `focus` on Blink/Gecko and `click` on
  WebKit: documented (`tabs.md:308-312`); the `next === optimistic` no-op prevents a double dispatch.
- Dialog non-modal light dismiss excludes the Trigger and needs press + click outside.
- Docs props tables and defaults match the declarations (script check, all pages).

## Ranking (value / effort)

| Rank | Id | Severity | Effort | Why |
| --- | --- | --- | --- | --- |
| 1 | C2 | medium | S-M | Loses typed input / saves a partial value on a plain label click in Firefox; small, contained fix |
| 2 | C1 + D1 | medium | M | Same class as #110; visible flicker for refusing parents, docs/design wrong; verified fix direction |
| 3 | T1 | medium | S-M | Locks in C1/C2 and closes the "click X while open" gap across overlays |
| 4 | A3 | low | S | One-line guard, avoids a real keyboard trap in rich toasts |
| 5 | A1 | low | S | Removes dead code, aligns with "no fallbacks" |
| 6 | API3 | low | S | Dev warning prevents a confusing misuse |
| 7 | API2 | low | S | Additive consistency fix |
| 8 | API1 | low | S | Registry hygiene |
| 9 | N1 | low | S | Human VoiceOver check; possible silent AT failure |
| 10 | A2 | low | S/M | Record an APG decision |

Recommended top 10: C2, C1 (+D1), T1, A3, A1, API3, API2, API1, N1, A2.
