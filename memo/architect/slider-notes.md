# Architect notes: Slider (#54, wave 5), 2026-10-18

Working notes behind `design/components/slider.md`. Not a spec.

## Prior art read for this design

- Base UI 1.9 `Slider`: Root (`value: number | readonly number[]`, `onValueChange(value,
  eventDetails)`, `onValueCommitted`, `min/max/step/largeStep/minStepsBetweenThumbs`,
  `orientation`, `format`, `thumbAlignment`), Value (`<output>`), Control, Track, Indicator,
  Thumb (`<div>` + visually hidden `<input type="range">` per thumb, `getAriaLabel(index)`,
  `getAriaValueText(formattedValue, value, index)`, `inputRef`), `index` derived from a composite
  list. Shift+Arrow = `largeStep`. Pointer code with capture.
- Radix `Slider`: Root (`value: number[]` always, `onValueChange`, `onValueCommit`, `inverted`,
  `minStepsBetweenThumbs`), Track, Range, Thumb (span; collection index), a `BubbleInput`
  (hidden input that dispatches a synthetic `input` event through the prototype value setter so
  form-level listeners see changes).
- React Aria `Slider`: `SliderTrack`, `SliderThumb index={n}` (explicit index; `<VisuallyHidden>`
  native range inside), `SliderOutput`, `onChange` / `onChangeEnd`.
- Ark UI `Slider`: Root, Label, ValueText, Control, Track, Range, Thumb (`index` prop),
  `HiddenInput` as a separate part, Marker/MarkerGroup, `onValueChange` / `onValueChangeEnd`.

Borrowed: hidden native range per thumb (Base UI, React Aria), explicit `index` (React Aria, Ark),
`minStepsBetweenThumbs` (Radix, Base UI), the change/commit pair (everyone). Rejected: `<output>`
for the value (live region chatter, research §2), a synthetic `input` event from the hidden input
(Radix; needs the prototype-setter trick and a nested React dispatch inside `pointermove`), a
separate `HiddenInput` part (Ark; a Thumb without it is broken), `number[]`-always (Radix; the
single-thumb call site reads worse), `largeStep` / Shift+Arrow (v2; PageUp/PageDown is native).

## The lane problem, worked through

The question the task asked for: what is urgent and what is a transition during a drag.

1. The thumb under the pointer must move in the same event. `useOptimistic` does that **only
   while a transition is pending** (verified by the researcher's `react-range.mjs`: the
   optimistic DOM followed the drag because the action was still unresolved). With a sync
   `valueChangeAction` (or none) each step's transition finishes in a microtask and the
   optimistic value reverts to `committed`, so between two `pointermove`s the thumb would snap
   to the committed value unless committed state follows every step.
2. Making every step commit state (model A: each `input` is a full `useControllableAction`
   dispatch) fixes that for uncontrolled mode, but then a controlled "update on success" parent
   (`valueCommitAction={async (v) => { await save(v); startTransition(() => setValue(v)); }}`
   with no `valueChangeAction`) snaps during the drag, and a rejected save can never roll the
   value back in uncontrolled mode, because the steps already committed it.
3. Holding one transition open for the gesture (`await pointerup`) is forbidden: an action must
   never await user input, and a pending async action entangles every transition in the app
   (`react-async-apis.md`, "still entangled" item 2).
4. Making the step action urgent (`UrgentChangeAction`, Combobox's lane) would make a controlled
   parent's `setPrice(v)` a sync render of whatever the value drives; the canonical slider demo
   (a filter that re-renders a list) is exactly what transitions exist for. React does not require
   urgency here (the native input restore is satisfied by any sync-lane render of the new prop).

Result: a separate **`live`** value (`useState`, written in the event, like Combobox's active
option: it is the position under the pointer, immediate) plus a pure derivation,
`shown = held && live !== null ? live : optimistic`, `held = dragging || stepPending ||
commitPending`. No effect clears `live`; it is simply ignored once nothing is pending. Steps run
through `useActionTrigger` (own transition, superseded-rejection surfacing, no state); the commit
runs through `useControllableAction` (optimistic, uncontrolled write on resolve, latest wins).

Checks against the React facts in `react-async-apis.md`:

- A step's `isPending=false` and a controlled parent's `setPrice(v)` (sync prefix of the same
  event) share the event's transition lane, so `held` drops in the commit that lands the adopted
  value: no snap at release while a suspended list is still loading.
- The commit's optimistic revert may land *before* an adopted step lane commits (different
  events, different hooks, parallel transitions since 19.3): irrelevant, because `held` keeps
  `live` on screen until `stepPending` is false. Test row "no snap at release" guards it.
- Uncontrolled `setInternal(next)` after the commit's `await` lands with `isPending=false`
  (the action scope), so success shows `optimistic === committed === next` in one commit.
- A pending save plus a new drag: `live` moves (urgent), step transitions are held by the save's
  action scope (entanglement), the thumb still follows; documented like Combobox walkthrough 6.

## Decisions I went back and forth on

- **Which action commits uncontrolled state.** `valueCommitAction` (the gesture), not
  `valueChangeAction` (the step). Gives rollback on a failed save for free; costs one sentence of
  documentation ("the value is committed when the gesture's commit action resolves"). Escalated.
- **Commit rule.** Dispatch the commit only when the gesture's final value differs from its value
  at gesture start (not "on every pointerup"); a key press is a one-step gesture. A drag that
  returns to its start dispatched steps and no commit.
- **Revert notification.** On a rejected commit in uncontrolled mode the Root dispatches one more
  step with `reason: "dismiss"` and the committed value, so a `valueChangeAction` consumer's
  preview follows the rollback (Combobox's text revert precedent). Controlled parents own their
  state and are not notified. Escalated.
- **`Indicator` vs `Range`.** Conventions 1.1 says reuse vocabulary; `Indicator` ("purely visual
  element that tracks state") fits, Base UI uses it, Radix says `Range`. Chose `Indicator`.
- **Two elements in `Thumb`.** The styled element plus the hidden input. Every library does it;
  the alternative (`Slider.Input` child part) makes a Thumb without it silently broken. Proposed
  as a conventions exception for "a visually hidden native control inside a styled part".
- **No synthetic `input` / `change` on the hidden input for pointer gestures.** Radix does it
  (`BubbleInput`); it needs the `HTMLInputElement.prototype.value` setter trick to get past
  React's value tracker and would re-enter React's event system from inside `pointermove`.
  Consequence: a `<form onChange>` listener sees keyboard changes only. Escalated.
- **Default value.** The platform's (`min + (max - min) / 2`, step-sanitised), not `min`:
  native-first, as Select adopts the browser's default. Escalated.
- **Step grid and an unreachable `max`.** Follow the platform's sanitisation exactly (the DOM
  would disagree otherwise); dev warning when `max` is not on the grid. Escalated.
- **Vertical ArrowLeft/ArrowRight.** JS-normalised (Right increases, APG) because Firefox
  decreases on Right for a vertical range (research §1); every other key stays native.
- **`aria-labelledby` on a multi-thumb Root.** Emitted while a `Slider.Label` is mounted
  (registration, Combobox L1), consumer tokens merged; never a dangling IDREF.
- **No `transition` on any part** (Select precedent): nothing mounts from library state, every
  move is urgent or optimistic. Rollbacks animate with a CSS transition on the registered custom
  property, disabled under `[data-dragging]`.

## Things to verify during implementation

- `held` derivation: no snap between pointermoves with a sync step action (uncontrolled), no snap
  at release while an adopted step lane is suspended (controlled), rollback to the pre-gesture
  value after a rejected commit (uncontrolled) and after an "update on success" parent's refusal.
- `setPointerCapture` + `pointer-events: none` on the hidden input: the Thumb element receives
  the pointer in all three engines; focus moved with `input.focus()` after a prevented
  `pointerdown` does not match `:focus-visible` (Chromium, Firefox; WebKit unverified).
- WebKit: `writing-mode: vertical-lr; direction: rtl` on the hidden input gives a vertical AX
  orientation (BCD says 16.5 for vertical ranges; AX not probed).
- `aria-valuetext` exposure on a native range in Firefox and WebKit (Chromium serialises it;
  the CDP probe could not confirm platform exposure).
- jsdom: no range key stepping, no layout; keyboard rows set the value through the native setter
  and fire `input` + `change` (the researcher's probe shape); pointer rows mock
  `getBoundingClientRect` on the Track and polyfill `setPointerCapture` if the setup lacks it.
- Firefox form-state restoration of a range value across reloads reaches the mount
  reconciliation the same way as a checkbox's `checked`.

## Status

Design written as proposed (`design/components/slider.md`), with the conventions changes under
"Conventions feedback (proposed)" (another architect holds `conventions.md` for Toast) and the
product decisions under "For the product owner".

## Review fold-in (2026-10-18)

Folded `memo/reviewer/slider.md` and the fixes 3b96bcb (H1), 8fffbca (M3), 330ba8c (M1, M2,
L1 to L4) into the design; audit table "Review corrections (#54)" at the end of
`design/components/slider.md`. Developer deviations 1 to 5 accepted and recorded; 6 is L4.

What I learned, in order of how much it changes the design:

- **M2 changed the lane rule, not just a flicker.** "A step is a transition" now reads "a step
  is a transition when there is a `valueChangeAction`". With no step action there is nothing
  to run and nothing to keep interruptible, so the transition existed only to make `held` true.
  That hidden job is now an explicit urgent flag, `stepHeld` (set by every step except the
  `"dismiss"` revert, cleared by the commit). The reason it must exist is react-dom's
  end-of-event restore of a controlled input: between a key's `input` and its `change` the
  prop must already be the new value, or the restore writes the old one back and Firefox
  fires no `change` at all. Worth remembering for any future controlled native input whose
  "shown" value is derived rather than stored.
- **H1 moved an RTL promise from the platform to the library.** The research table said
  "RTL mirrored by the browser"; WebKit's `RangeInputType::handleKeydownEvent` has no
  direction check. The fix reads the computed `direction` at each keydown (not at mount, not
  from `document.dir`), through the vertical path. Horizontal LTR is still fully native, which
  is the thing worth protecting.
- **Walkthrough 2 was wrong about what the user sees.** A rejection in uncontrolled mode goes
  to the boundary above the Root, which unmounts the slider; the "slide-back" I described is
  only observable with the slider mounted (a parent that catches the failure in its action, or
  a non-adopting parent at release). The optimistic revert still happens, it is just not
  rendered by anything. Docs must not promise a slide-back for uncontrolled mode.
- **L2 is a generic-parts lesson.** A part cannot see its Root's `T`, so defaulting the part's
  `T` to the narrow case (`number`) is a lie that type-checks. Default to the union and let the
  consumer narrow. Same applies to any future generic Root with child parts.
- **M4 is the real design debt**: Field relies on native `input` / `change` and pointer
  gestures fire none (product-owner item 8). Recorded as 9.4 pointing at #60; the decision
  (`BubbleInput` vs a direct Field hook) must precede #60.

Open after the fold-in: WebKit CI on 330ba8c fails the rollback-animation browser row (no
`transitionstart` at release). My unverified hypothesis is in the audit table: the release now
clears `data-dragging` (transition `none` → on) and lands the return value in the same style
change, which WebKit may not transition. The developer owns it; the row, not the recipe, is the
likely fix.

Conventions: nothing changed. Suggested wording (not applied): 3.2's urgent row describes
`held` as "while a pointer is captured or a step or commit is in flight"; it is now also "or a
step is waiting for its gesture's commit (`stepHeld`)", and 2.3 item 5 / 3.3 could say "a step
starts a transition only when there is a step action". 3.8 `useFieldControl` row: Slider's
two-part control (labelable input in the Thumb, group element in the Root) does not fit "spread
into the owner part's libraryProps"; decide with #60.

## #60, Slider inside a Field (proposed 2026-10-18, slider.md 9.4)

Decisions and the alternatives I dropped:

- **Hook in the Root, attributes split through context.** The Thumb cannot call
  `useFieldControl`: the labelable/group choice needs the count and the Field allows one
  registration. The hook's "spread attributes into libraryProps" contract is for one-element
  controls; for Slider the Root routes `ref` / `id` / `aria-describedby` to Thumb 0's input
  (single) or keeps them on its own div (multi), and `aria-invalid` to every input in both
  shapes. No hook API change needed (the Field reviewer's M4 worry about the contract was about
  the spread convention, not the hook's shape).
- **`thumbId(0)` = the Field's control id** rather than making Field.Label point at the
  library id: the Field owns the control id (Field 7.1) and `Slider.Label` keeps working
  unchanged since it reads `thumbId(0)`.
- **Group `aria-describedby` on the Root div**, not duplicated per input: consistent with
  RadioGroup / CheckboxGroup. If the screen-reader pass shows group descriptions unread, the
  per-input duplication is a one-line change in the Thumb (it already merges `describedBy`).
- **Notify at the commit, keyed on `optimistic`,** not per move: the DOM already shows `live`
  during a drag; validating sixty times a second buys nothing; the native key path has the same
  granularity (`change`). Cost: a controlled adopt-steps parent notifies per step; acceptable
  (the Field's mirror compare prevents renders).
- **`edit` from the commit reason**: `"activate"` → dismiss; `"platform"` / `"dismiss"` → not an
  edit. A rollback keeping a shown server error is deliberate (the server judged that value).
- **`required` not applicable**: warn rather than silently ignore.
- **No BubbleInput**: closes the section-13 question for the library's own needs.

Open for the PO: accept 9.4; the `required` warning (vs. silent ignore); group description
placement if the SR pass disagrees.
