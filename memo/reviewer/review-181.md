# Review: TextField (#181), branch feat/181-text-field @ b5d10ac4

Against origin/master. Design: design/components/text-field.md (b82123c0, 9dd98018),
number-field.md 4.2, conventions 15. Dev notes: memo/developer/text-field.md.

Verdict: **acceptable with minor fixes** (one product bug, two vacuous test rows).

Ran: jsdom text-field + number-field + field (397 pass); browser text-field + field-edit on
Chromium and Firefox (66 pass). WebKit not run locally.

## Must fix

1. **Stale React value tracker after a form reset: the first input event that produces the
   pre-reset text is dropped.** `text-field.tsx:282-287` (`onResetEvent` writes
   `element.defaultValue = resetTarget`). The reset algorithm then writes the DOM value past
   React's value tracker (no JS setter), and since the DOM already holds the target, react-dom
   does not write `node.value` on the next render, so the tracker keeps the pre-reset text.
   Repro (jsdom probe, uncontrolled `defaultValue="Draft"`): commit "Report", `form.reset()`
   (shows "Draft"), one change event to "Report": no draft opens, the input shows "Report",
   the blur commits nothing; saved value "Draft" and DOM text "Report" disagree. Passes when the
   write is removed. Triggers in practice: the first edit after a reset is a paste, autofill,
   or a single character equal to the old text. The same bug is in NumberField (pre-existing,
   `number-field-root.tsx:608`): `defaultValue={1}`, commit "5", reset, type "5": nothing
   dispatched. Probably also Slider / Combobox text (same rule-6 mirror), not checked.
   The test driver works around it (`__tests__/drivers/text-field.tsx:31-33`: `value = ""`
   before each gesture) instead of the component handling it; the dev memo notes the symptom.
   Fix: sync the tracker after the algorithm (in the `onReset` path, e.g. a script write
   `element.value = element.value`), and drop the driver workaround so the suite rows cover
   it. Worth an issue in this repo for the other rule-6 controls.
2. **Vacuous "equal draft" Escape rows (TextField and NumberField).**
   `text-field.test.tsx:403-413` and `number-field.test.tsx:1083-1092` type the current text
   ("Draft", "1") with one `fireEvent.change`; React's tracker dedups it, so no draft opens and
   the row tests "no draft" twice. Mutations removing the equality check survive in both
   (`text-field.tsx:249` `open === latest.current.optimistic`, `number-field-root.tsx:493`).
   Type something else first ("Dra" then "Draft"; "12" then "1").

## Nits

3. Driver `expectResetTarget` no-op (`drivers/text-field.tsx:59`): acceptable. The reset rows
   still assert the dispatched target and the shown text after the reset; there is no DOM
   mirror to read for a controlled value input. Once 1 is fixed, a row for "an edit after a
   reset back to the old text" would be the useful assertion.
4. Mutation: removing the `defaultValue` write survives every jsdom and browser row — the write
   is unobservable apart from bug 1 (it only matters for the frame between a real reset click
   and the task-later dispatch). If kept, no row pins it.
5. `useFieldValueChange(text)` (`text-field.tsx:207`) notifies the Field on every keystroke
   too (refresh + `form.refreshFields`), not only on revert / rollback / controlled change.
   Correct per design 7, a little wasted work per keystroke.
6. Docs props table: `type` default `"text"` (`TextFieldPage.tsx:191-196`) holds only for the
   default element; with `render` the library sets no type.
7. Field.Root's "no form control registered" dev message (`field-root.tsx:509-511`) lists
   controls and omits TextField (and OTPField); cosmetic, since TextField registers.
8. Browser reset row prevents mousedown on the reset button (`text-field.browser.test.tsx:189`)
   to keep the draft open: fine and documented; a sibling row without it (blur commits the
   draft, then the reset) would cover the common toolbar-less case.
9. Driver header comment line 3 is one overlong line (oxfmt skips comments).

## Checked, no finding

- Draft/optimistic split, blur and Enter commit, IME Enter (`isComposing`, 229), equal draft
  (commit path, mutation killed), disabled/readOnly (killed), textarea Enter (killed).
- Rejection with a newer draft open: draft kept, Escape then shows the rolled-back value.
- Escape: `isEscapeRequest` + `consumeEscape` in the field's React handler runs before the
  non-modal Dialog's `decideEscapeLast` decision (window/afterDispatch) and before modal
  Dialog / auto Popover close watchers; browser rows pass. Mutation removing the consume kills
  the Dialog rows.
- Mount reconciliation: focused -> draft, unfocused -> one platform commit, StrictMode once
  (mutations killed). Reset clears the draft (killed), base = `intendedValue`.
- Field: wiring, server error dismissal, own `data-pending`, #193 rows for controlled and
  uncontrolled TextField with a blur in the script.
- Type warnings: search/number as prop and on render, once; text/tel/url/email/password silent.
- Transition types via the suite driver; types test rejects onChange/onKeyDown/onBlur.
- NumberField Escape: compares text (`1.0` over `1` killed by a parse-compare mutation), no
  draft -> untouched (killed), placed after the disabled/readOnly/composing guard. No
  regression in the NumberField suite.
- A11y: native textbox, no built-in strings, no aria-busy.
