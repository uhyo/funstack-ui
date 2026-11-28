## What's Changed

This release fixes what dogfooding run 1 found: a fresh agent built a full app from the bundled skill alone (#206–#217).

### Breaking Changes

- **NumberField naming (#216).** The `role="group"` Root is no longer named by the label. Increment and Decrement now carry it ("Increase Quantity"), as in React Aria. A consumer `aria-label` on a button replaces only the word. Migration: a test that found the group by the label name should find the input with `getByRole("textbox", { name, exact })`.
- **Field references (#217).** A Field control now references the `Field.Label`, `Field.Description` and `Field.Error` ids only while those parts are mounted. There are no more dangling `aria-labelledby` / `aria-describedby` ids, and a consumer's own tokens are kept.

### Features

- **`details.reject()` (#207).** Every action can handle its own failure: catch, show a message, call `details.reject()`. The control rolls back, nothing is committed or closed, and nothing reaches an Error Boundary. Works uncontrolled. New type `Rejectable` in `@funstack/ui/types`.
- **`Form.Root error` and `Form.Error` (#208)** for form-level errors, such as a failed request. It keeps a `Dialog.Form` open, never blocks resubmitting the same values (unlike a field error) and is announced.
- **`details.valid` (#210)** on every form control's value action: `if (!details.valid) return;` skips saving text that fails `required`, `pattern` or the Field's `validate`.

### Fixes

- **Combobox (#215):** focusing a `Combobox.Input`, a chip or a `MultiSelect.Trigger` no longer throws on pages hydrated on `document` (FUNSTACK Static, FUNSTACK Router).
- **MultiSelect (#209):** `MultiSelect.Value` shows its `placeholder` while empty, also with function `children`.

### Docs and agent skill

- **Pending actions (#206):** a new section, "Pending actions hold other transitions". While any awaited action is pending, React holds every transition, so menus, tabs and dialogs wait too. It comes with recipes: don't return background saves, and start refetches after the action.
- **Error boundaries (#207):** corrected Error Boundary placement for Toast and AlertDialog.
- **Agent skill (#212):** rewritten at 40% of its length, as rules plus links. The Markdown edition prints each component's Anatomy first.
- **Smaller fixes (#211):** the Combobox listbox now spans the whole input group, `autoHighlight` is mentioned, and the Escape layering has its own section.

**Full Changelog**: https://github.com/uhyo/funstack-ui/compare/0.1.0-alpha.29...0.1.0-alpha.30
