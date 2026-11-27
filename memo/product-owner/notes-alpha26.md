## What's Changed

### Features

- **TextField** (`@funstack/ui/text-field`, #181): a text input that saves through an action, for autosave and inline edit.
  - **Saving:** the text saves when the field loses focus or on Enter in an `<input>`, through `valueCommitAction`. The field shows `data-pending` while the save runs, and Escape reverts unsaved typing.
  - **Model:** it follows NumberField's draft-and-commit model. A rejected save brings the saved text back; the docs show how to keep the typed text instead.
  - **Element and types:** it renders a single `<input>` (`text`, `tel`, `url`, `email`, `password`), or a `<textarea>` through `render`.
  - **Forms and Field:** it takes part in forms and `Field.Root`.
  - **Not in this release:** `type="search"` (#197) and Ctrl/Cmd+Enter in a textarea (#196).

### Behaviour Changes

- **NumberField: Escape reverts an edited draft** (#181) before anything else handles it, for example before an enclosing dialog closes. With no edited draft, Escape is unchanged.

### Fixes

- After a form reset, the first edit back to the value from before the reset was ignored (#181). This affected NumberField, Combobox's input, Slider and OTPField.

**Full Changelog**: https://github.com/uhyo/funstack-ui/compare/0.1.0-alpha.25...0.1.0-alpha.26
