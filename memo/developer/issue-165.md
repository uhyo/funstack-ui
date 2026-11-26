# Developer notes: MultiSelect (#165), 2026-11-26

Branch `feat/165-multi-select` (from `design/165-select-multiple`, master merged in after #164).

## What moved to internal/

- `combobox/use-option-registry.ts` -> `internal/use-option-registry.ts` (flat). Takes the
  namespace as the first argument for the duplicate warning (`"Combobox"` keeps the exact old
  message). Exports `ListboxOptionEntry` (Combobox's `ComboboxOptionEntry` is now an alias),
  `optionId` (re-exported from combobox-context so Combobox imports are unchanged) and
  `optionLabel`.
- `combobox/use-active-option.ts` -> `internal/use-active-option.ts` (flat). The popover is typed
  structurally (`{ committed, intended }`) so a flat module does not import `overlay/`.
  Two additions, both inert for Combobox: `PendingEdge` may be a resolver
  `(enabled) => value | null` (MultiSelect: first selected, typeahead match), and `loading`
  holds the pending edge back while a Status is mounted in the List.
- `combobox/use-deferred-leave.ts` -> `internal/use-deferred-leave.ts` (flat). `inputRef` renamed
  `surfaceRef`, `chipsRef` optional.
- `combobox/use-multiple-selection.ts` -> `internal/action/use-multiple-selection.ts`. Generic
  over the component's extra detail fields (`Extra`: Combobox `{ custom }`, MultiSelect `{}`);
  `component` (transition-type stem) and `part` (warning name) are parameters, `resetFields` the
  extra fields of a reset. The detail key order is unchanged (`reason, added, removed, ...extra`).
- New `internal/form/hidden-values.tsx` (`HiddenValues`, directive-free component): the
  one-per-value hidden inputs. Combobox multiple uses it too. A plain function call
  `renderHiddenValues({ firstRef })` tripped oxlint's react(refs) rule; a component does not.
- New `internal/typeahead.ts` (directive-free): Menu's buffer and matcher, lifted out of
  `menu/use-menu-keyboard.ts` (`pushTypeahead`, `findTypeahead`, `typeaheadMatch`,
  `isTypingAhead`). Menu behaviour unchanged (menu tests pass, jsdom and browser).

`check-internal-layers`: all flat except the selection hook (action/) and HiddenValues (form/).

## Field changes

- `FieldContextValue.controlElement()`; `Field.Label` cancels its click and focuses the control
  when the registered control is a `<button>`.
- `focusTargetOf(button)` returns the button.
- `Field.Root` adds its `invalid` listener on `validityElement()` when the registered element
  resolves no validity element of its own and the validity element is outside it. The effect
  now depends on `control`, and MultiSelect passes `validityElement` only while `required`, so
  the registration changes with `required`.

## B.16 results and the fallback

Probe (temporary `debug.browser.test.tsx`, deleted): a form with a hidden one-option
`<select required>` and a button below it; submit, then click the button.

- Firefox: the click under the bubble is swallowed **even with a plain visible `<select
  required>` and no hand-over** (mode "none"). With MultiSelect the listbox opens right under the
  Trigger, where the bubble is, so clicks on the first options did nothing (the browser test
  "a selection lets the form submit" failed after an earlier test had shown a bubble). A hand-over
  deferred to a task / two rAFs left focus on body in Firefox (not pursued).
- Chromium: clicks under the bubble go through.
- Headless: the bubble itself cannot be seen or positioned in any engine.

Took the fallback of memo/architect/select-multiple-notes.md: cancel `invalid` on the validity
element; on a submission attempt (`:user-invalid`, jsdom fallback: always) call
`collectInvalid(trigger, validationMessage, select)` so the first invalid control in document
order still gets focus; `Field.Error` shows the message. Outside a Field: blocked, focused, no
text. Documented on the docs page and in multi-select.md B.10 / B.16.

AX (Chromium CDP): Trigger `combobox`, `expanded` false -> true -> false; listbox
`multiselectable`; options `selected`.

## Other choices

- `data-placeholder` on Value whenever the selection is empty, also with function children
  (design said "the default content ... carries data-placeholder"; amended).
- `Select.Root multiple`: warns and is **dropped** (not passed to the `<select>`): a
  `<select multiple>` with `value={string}` would be broken React state. Design said "gains a
  development warning"; dropping is recorded in select.md 13 and the CHANGELOG.
- Trigger owns `onKeyUp` (Space is prevented on keyup too, a guard for the keyup half of a
  button's activation; not probed without it). Verified in all three engines: Space opens /
  toggles exactly once.
- Trigger focuses itself in the click handler only when it is not already focused.
- Without `name` the reset listener follows the validity element, else the Trigger (a button
  has a form owner).
- The validity `<select>` has `autocomplete="off"` (no Firefox form-state restoration) and is
  disabled with the Trigger.
- The anchor name is `--fsui-multi-select-<trigger id, non-word chars replaced>`.

## Commands

- jsdom: all 88 files pass; browser (Chromium, Firefox locally): combobox, menu, field, select,
  multi-select pass. WebKit cannot launch here (`browserType.launch` error); branch CI
  (`gh workflow run ci.yml --ref feat/165-multi-select`) is green on all three engines.

## Not done / for later

- Screen-reader pass (NVDA, JAWS, VoiceOver) of the toggle under `aria-activedescendant`.
- WebKit `flip-block` nested in a Popover (302008) not probed.
- Firefox form-state restoration across a reload not probed (ruled out by `autocomplete="off"`).
