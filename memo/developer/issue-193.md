# #193: Field state write during an edit's dispatch loses keystrokes (developer notes)

Branch `fix/193-combobox-field` from origin/master (29ec64d6).

## Root cause (probed, Chromium vs Firefox)

- Field.Root listens to `input` / `change` on the control (capture); React's listener is on the
  root, so the Field's runs first. Its `setMirror` (sync lane) is flushed by React in a microtask.
- Chromium: a microtask queued in the Field's listener for a real keystroke saw
  `eventPhase === 2` (AT_TARGET): the checkpoint runs between listeners. The commit re-rendered the
  control with its previous controlled `value`; my own capture listener registered after the
  Field's already saw "ba" for "bad". React's onChange then read the reverted DOM.
- Firefox: the same microtask saw `eventPhase === 0` (after the dispatch). Hence Chromium only.
- Only a keystroke whose mirror changes commits (validity flags, messages, userInvalid), so
  "the keystroke that flips validity". `dismiss()` (server error shown) did the same.
- Not the Combobox draft, `selectionchange`, or `setCustomValidity`.

## Survey (old code, real keys outside act)

Lost in Chromium: Combobox text; controlled Field.Control; Field.Control render=<select>
controlled (arrow keys: input then change, React's onChange is `change`); Select (same);
OTPField (first digit: "" -> "1" flips to patternMismatch); the keystroke that dismisses a
shown server error. Fine: uncontrolled Field.Control, NumberField (validity moves at commit),
Checkbox / Switch (Space), RadioGroup (Space, arrows), Slider (arrows), MultiSelect.
Probe files deleted; WebKit not installed locally (CI covers it).

## Fix

- `writeSlot` (DOM only) split out of `refresh`; `refreshAfterEdit(event, edit)`: slot now, then
  `afterDispatch` -> dismissal + full `refresh` (recomputes the slot after React restored a value
  a controlled parent refused). The latest edit cancels the previous pending write; a pending
  own-edit dismissal survives an owner edit replacing it.
- `pendingEdit` ref: while an edit's write is pending, every `writeSlot` keeps the server
  message out (blur / Enter-submit in between).
- `useServerErrorVisibility`: `dismissed` flag -> `editedAt` settle count + `recordEdit()`.
  Needed because jsdom's OTPField submitOnComplete row broke: the deferred dismissal landed in
  the flight and React rebased it over the settle's render-phase reset, hiding the answer.
- Rejected: synthetic onInput batching (a select commits between input and change), a document
  listener (stopPropagation), a transition (2.4), always a task.

## Tests

- jsdom `field.test.tsx` "an edit's state write waits for the event's dispatch (#193)":
  `flushSync` in a target-phase listener after the Field's models Chromium's checkpoint. All
  rows failed on the old code (the server-message row fails without the `pendingEdit` guard).
- browser `field/field-edit.browser.test.tsx`: 7 controls x {validate, required}, both
  directions, before/after a blur (aria-invalid live), plus the server-error row. 11 of 15
  failed in Chromium on the old code (uncontrolled and NumberField are guards).
