# Review: #200 value inputs and forms (feat/200-align-value-inputs @ 90a07bec)

Checks run: typecheck, lint, format:check, jsdom (5632 pass), browser Chromium + Firefox for the
touched folders (pass). WebKit not runnable here.

## Findings

1. Medium. Combobox Escape while the keystroke's open is on its way (`combobox-keyboard.ts:134`):
   `isOpen` is `:popover-open`, so Escape reverts the text (e.g. "ja" -> "") and the open still
   lands: the listbox shows afterwards with the reverted text. Probed in Chromium and Firefox
   (`user.keyboard("ja{Escape}")`, then 300 ms: text "", popup :popover-open true), also inside a
   modal Dialog. Before #200 the text was kept. The window is a render, longer when the open
   transition waits on suspending results. Design 8 has an Enter row for "open requested, not
   committed" but no Escape row. Suggest: treat an intended-but-unshown open like an open
   listbox (cancel the coming open, keep the text) and add the row to combobox.md 8 / testing.md.
   The developer saw it (form-reset-button.browser.test.tsx now waits for the listbox) but did
   not raise it.
2. Low-Medium. `CheckboxGroupLabelState`, `RadioGroupLabelState` (checklist "Type names (9.4)")
   are not added or exported; the Labels still type their props with the Root state.
3. Low-Medium. CheckboxProps `readOnly` / `transition` omission is not pinned: the shared row in
   `__tests__/checkable-input-suite.tsx:833` types against `ControlProps = SwitchProps`. Removing
   "readOnly" from CheckboxProps' Omit still typechecks (verified).
4. Low. Slider.Label (`slider-label.tsx:80`) and NumberField.Label (`number-field-label.tsx:72`):
   state is the Root's, now with `invalid`, but no `data-invalid` (rule 4.1.2; Select's parts got
   it through `rootStateAttributes`).
5. Low. Conventions 9.5 lists a Slider thumb among the parts that warn on no name; none does
   (not in the #200 checklist, so maybe a follow-up).
6. Low. Design wording: "what a blur would leave" is not true with `allowCustomValue` (blur
   commits the text; Escape goes to the committed value). Implementation follows the explicit
   target and matches TextField; the rule's lead-in should say "the committed text".
7. Nits: leftover blank line where `transition` was removed (`checkbox.tsx:105`,
   `switch.tsx:91`); skill still says MultiSelect / Combobox multiple `value` is `string[]`;
   MultiSelect browser row title says "toggle event", asserts `beforetoggle`.

Verdict: acceptable with minor fixes (1 is the one behavioural item; fix or record as an issue).
