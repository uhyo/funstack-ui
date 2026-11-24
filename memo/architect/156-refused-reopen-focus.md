# #156: a `<dialog popover>` re-opened after a refused outside click takes focus back (2026-11-24)

Scope: controlled Popover, default `<dialog popover>` element, parent keeps `open={true}`. The
user clicks an outside `<input>`; light dismiss hides the popover; the library re-shows it
(overlay-open-change.md 2.4, user decision: prop and DOM never disagree); the browser's dialog
focusing steps move focus into the popover. Design 6.1: the library never calls `.focus()` on
open.

Probe: `memo/architect/probes-156/issue156.browser.test.tsx.txt` (how to run is in its header),
results in `memo/architect/probes-156/output.txt`. Chromium and Firefox (local Playwright builds).
**WebKit was not run** (it cannot launch locally): every WebKit statement below is from the spec
only.

## 1. What the platform does (spec + probe)

Spec (HTML, fetched 2026-11-24):

- *Popover focusing steps*, step 2: "If subject is a dialog element, then run the dialog focusing
  steps given subject and return." So yes, they apply to `<dialog popover>` by spec, on every
  `showPopover()`.
- *Dialog focusing steps*: control = the dialog if it has `autofocus`, else its focus delegate,
  else **the dialog itself**; then "Run the focusing steps for control" with the note "If control
  is not focusable, this will do nothing."
- *Focusable area* requires "the element is not inert"; *focusing steps* step 4 returns when the
  target's DOM anchor is inert.
- *Light dismiss*: decided on `pointerup` (same target as `pointerdown`). The click's focus moved
  at `mousedown`, before that.
- *Show popover* stores the element focused at the time of the show as the popover's "previously
  focused element" (first popover in a stack); *hide popover* focuses it only if focus is inside
  the popover.

Probe rows (same result in Chromium and Firefox unless noted):

| Row | Finding |
| --- | --- |
| R1 | `showPopover()` on a `<dialog popover>` always moves focus: to the first focusable child; with no focusable child, with `tabindex="-1"` on the dialog, with `autofocus` on a disabled child, or with only an inert child, to **the dialog itself**. The outside input gets `blur` / `focusout`. No content or attribute arrangement of the children avoids it. |
| R2 | **`inert` on the dialog for the duration of the `showPopover()` call** (set before, removed right after): the popover is shown, focus does not move, the outside input receives **no** `blur` / `focus` event, its selection is kept, and the popover's content is focusable again as soon as the attribute is removed. |
| R3 | Restoring with `.focus()` after the show works too, but the outside input sees `blur`, `focusout`, then `focus`, `focusin` (and the inner element `focus`, `blur`). |
| R4 | Order of a real click on the outside input: `pointerdown`, `mousedown`, **`focus` (outside)**, then the hide (`beforetoggle(closed)` after `pointerup` in Chromium, before it in Firefox), `click`, `toggle(closed)`. Focus is already on the outside input before the popover closes. |
| R5 | After the (baseline) re-show, a later Escape that closes the popover returns focus to the **clicked outside element**, not the Trigger: the re-show recorded it as the previously focused element. |
| L1 baseline, `<dialog>` | The issue: after the click, focus is on the popover's input; a typed key goes into the popover. Same after a click on empty space and after a refused Escape. |
| L1 baseline, `<div>` (`render={<div />}`) | Focus stays on the clicked input; the key goes there (this is #155). |
| L1 `inert` variant, `<dialog>` | Identical to the `<div>` row in every column: focus on the clicked input with a single `focus` event, the key goes there, empty-space click leaves focus on `<body>`, no `inert` attribute left behind. |
| L1 `.focus()` restore variant, `<dialog>` | Focus ends on the clicked input, after an extra `blur` + `focus` pair on it. A click on empty space still ends with focus inside the popover (there is no element to restore to; it would need a `blur()` as well). |

Consequences for the questions asked:

- **Does the dialog focusing step run for `showPopover()` in all engines?** Yes by spec; observed
  in Chromium and Firefox here, and in WebKit by the existing "platform probe" row in
  `popover.browser.test.tsx` (CI).
- **Do `autofocus`, no focusable content, or `tabindex` change it?** No: the dialog itself is the
  fallback target (R1).
- **Can the re-open be deferred until the click's focus has moved?** Pointless: focus moved at
  `mousedown`, before the popover even closed (R4). The re-show takes focus whenever it runs.
- **Can a `<dialog popover>` be shown without the focusing steps?** Not through another method
  (`show()` runs the same steps and is not a popover show; `showModal()` throws / is modal). But
  the steps do nothing when the dialog is `inert` at that moment (R2), which is spec behaviour,
  not an engine accident.

## 2. Options

### (a) Accept and document (status quo)

Already done by #155's review fix (overlay-open-change.md 2.4, PopoverPage). Cost: none. What
stays: with the default element a refusing parent makes outside fields unreachable by pointer
(reachable by Tab), and the "no initial focus on a refused re-open" rule of #155 has an exception
for Popover's default element. The documented way out already exists: `render={<div />}`.

### (b) Restore focus with `.focus()` after the re-show

Works for the reported case (R3, L1), but:

- it is the `.focus()` design 6.1 forbids (a new exception next to the quiet-focus one);
- the clicked field gets a spurious `blur` + `focus` (validate-on-blur fields, `onBlur` commits,
  a Combobox that closes on focus leaving all observe it);
- empty-space clicks need a second branch (`blur()` the element the platform focused);
- needs `preventScroll`, and a check that the saved element is still connected and focusable.

### (c) Render a `<div>` popover when refusal is expected

The library cannot know in advance that a parent will refuse, and swapping the element when it
finds out would remount the popup. So this can only be advice to the consumer, which is option
(a)'s documentation: "if you keep a Popover open on purpose, render a `<div>`". No library work.

### (d) `inert` around the re-show (found by the probe)

In `showPopup` (`packages/ui/src/internal/use-popover-popup.ts`), for a refused re-show of a
`<dialog>`: set `inert` if the popup does not have it, call `showPopover()`, remove it in the
existing `finally`. The `tagName !== "DIALOG"` exclusion on the `refusedFact` line goes away, so
the #155 rule becomes one rule for every popover element: **a refused re-open never moves
focus.**

- About six lines, in the place that already writes `autofocus` around the same call. No
  `.focus()`, so 6.1 stands as written (one sentence added: "on a refused re-open of a `<dialog>`
  the popup is `inert` for the duration of the call, so the dialog focusing steps focus
  nothing").
- No focus events at all on the clicked element (R2): the user's click simply wins.
- Empty-space click and Escape behave as for the `<div>` popup with no extra code (L1).
- Behaviour change beyond the reported case: after a refused **Escape**, focus now stays on the
  Trigger (where the platform returned it) instead of going back inside. That is what #155
  decided for `<div>` popups and Menu; today's `<dialog>` test row asserts the opposite and
  would be flipped.
- Dialog (`dialog-popup.tsx`, `showModal()` / `show()`) is not touched: a modal dialog must hold
  focus, and outside content is inert there anyway.

Risks, all small:

- WebKit is unverified. The spec says it works; the browser row added with the change runs on
  WebKit in CI and would show a failure. If WebKit differs, fall back to (a) there (assert the
  documented degraded behaviour, as CLAUDE.md prescribes), not to (b).
- The attribute is observable for the length of one synchronous call: a consumer's
  `beforetoggle` listener or a `MutationObserver` can see it; a consumer CSS rule on `[inert]`
  with a transition could start from the inert style (the focusing steps force a style update).
  Nothing is painted in between.
- A consumer's own `inert` prop on the Popup must be left alone (write only when absent).
- jsdom: the popover shim in `src/__tests__/overlay-helpers.ts` emulates the dialog focusing
  steps and has no notion of `inert`; it needs one line so the jsdom rows agree with the browsers.

### Rejected outright

- Not re-opening after a pointer dismissal: contradicts the user decision (prop and DOM agree).
- Deferring the re-open: no effect (R4).
- A non-dismissable Popover mode (`popover="manual"`): a different feature; it would remove the
  reason to refuse, but it is new API and not what #156 asks.

## 3. Comparison

| | Outside field reachable by pointer | `.focus()` by the library | Events on the clicked field | Code | Rule for consumers |
| --- | --- | --- | --- | --- | --- |
| (a) accept | no (default element); yes with `render={<div />}` | none | `blur` (focus is taken) | 0 | "refused re-open: no initial focus, except Popover's default element" |
| (b) restore | yes | yes (6.1 exception) | `blur` + `focus` | ~15 lines, two branches | same as (d), with visible focus churn |
| (c) `<div>` | yes, if the consumer opts in | none | none | 0 (docs only; same as (a)) | same as (a) |
| (d) `inert` | yes | none | none | ~6 lines + 1 shim line | "a refused re-open never moves focus" |

## 4. Recommendation

**(d)**, if the user wants the behaviour fixed: it is the smallest change that removes the
problem, it removes an exception from the docs rather than adding one, and it keeps 6.1 intact.
It is conditional on the WebKit CI row passing.

**(a)** is a legitimate answer too, and costs nothing: the scenario needs a parent that
deliberately keeps a Popover open against a dismissal (docs already say "adopt a fact's
`false`"; an un-migrated parent gets the dev warning), it is not a keyboard trap, and
`render={<div />}` is a working escape hatch today. If the user picks (a), close #156 with the
existing documentation and add "render a `<div>`" to the sentence in PopoverPage.

Not recommended: (b). It costs more than (d), breaks 6.1, and is observable by the clicked field.

Decision for the user: (d) or (a). The one behavioural point to confirm with (d): after a
refused Escape on the default Popover, focus stays on the Trigger instead of returning inside
(consistent with #155's decision for Menu and `<div>` popups).

## 5. If (d) is accepted: work list

1. `use-popover-popup.ts` `showPopup`: drop the `DIALOG` exclusion; `inert` around the call for a
   refused `<dialog>` show.
2. Tests: flip the `<dialog>` row of "a refused Escape re-opens ..." (focus on the Trigger); add a
   browser row for the click on an outside input (focus and typed key land outside, no `blur` on
   it, no `inert` left); jsdom shim honours `inert`.
3. Docs: overlay-open-change.md 2.4 (remove the `<dialog>` exception and the #156 clause),
   popover.md 6.1 (the sentence above), PopoverPage and BrowserOwnedStatePage (same removal),
   SKILL.md if it repeats the exception.

## 6. Side finding (not part of #156)

R5: after any re-show of a refused fact, the platform's "previously focused element" is whatever
had focus at the re-show (the clicked outside element, or the Trigger). A later adopted Escape
with focus inside the popover returns focus there rather than to the Trigger. This holds for
`<div>` popups today and in every option above; design 6.2 only corrects a return to `<body>`.
Arguably right (focus goes back to where the user last was). No action proposed.
