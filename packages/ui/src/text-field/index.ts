/**
 * TextField: a text field that saves itself. One `<input type="text">` (or a `<textarea>`
 * through `render`) whose `value` is the saved text; the typed text is a draft, committed on blur
 * or Enter through `valueCommitAction` in the field's transition, with `data-pending` while the
 * save runs. A rejected save shows the saved text again; Escape with an edited draft puts it
 * back.
 *
 * @see https://ui.funstack.work/components/text-field
 */
export { TextField } from "./text-field.js";
export type { TextFieldProps, TextFieldState, TextFieldValueChangeDetails } from "./text-field.js";
