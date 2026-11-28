## What's Changed

### Features

- `readOnly` on every form value control and on `Field.Root` (#203). A read-only control stays focusable and readable, is submitted with its form (unlike `disabled`), cannot be changed and never dispatches its action. `Field.Root readOnly` reaches its control, like `disabled`; `disabled` wins when both are set.
  - Checkbox, Switch, RadioGroup, CheckboxGroup: the change is refused at its source, so no `input` / `change` fires; radio arrows still move focus.
  - Select: every unselected option is disabled, so the browser refuses a pick in every engine, even before hydration.
  - Slider: keys and pointer do nothing; an assistive-technology increment is written back.
  - Combobox, MultiSelect: the popup does not open (an open one is asked to close; edited text goes back to the selection); Trigger, Clear and ChipRemove are disabled. Escape and Alt+ArrowUp still close a popup a controlled parent keeps open.
  - TextField, NumberField, OTPField: native `readonly`, as before.
  - Every control renders `data-readonly` and `state.readOnly`; `aria-readonly` is set on the roles that support it.
  - A read-only control is barred from constraint validation: native `required` is withheld, `validate` does not run, and a server error is shown but does not block submission or take focus.
- `@funstack/ui/types`: a types-only subpath for the shared types (`ChangeReason`, `ActionDetails`, `WhilePending`, `Action`, `ChangeAction`, `RenderProp`, `StateValue`, `UrgentChangeHandler`, `UrgentHandler`) (#204). The root entry still exports the same names.

### Improvements

- TextField, NumberField and OTPField now render `data-readonly` (`:read-only` does not work for the non-text controls, so one attribute is used everywhere).
- Text typed into a read-only control before hydration is restored at mount instead of being dispatched as a `"platform"` change.

**Full Changelog**: https://github.com/uhyo/funstack-ui/compare/0.1.0-alpha.28...0.1.0-alpha.29
