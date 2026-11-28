# Consistency audit: value inputs and forms

Audited 2026-11-28 at fd4c414b (alpha.27). Family: TextField, NumberField, Combobox, MultiSelect,
Select, OTPField, Slider, Checkbox, CheckboxGroup, Switch, RadioGroup, Toggle, ToggleGroup,
Field, Form. Paths are relative to `packages/ui/src/` unless they start with `design/` or
`packages/`. The three behaviour claims marked "probed" were checked with a throwaway jsdom test
in a worktree (deleted afterwards, not committed).

## Matrix (what is already uniform)

| concern | state of the family |
| --- | --- |
| action names | `<state>ChangeAction` everywhere; `valueCommitAction` on Slider, NumberField, TextField (commit-only, conventions 3.1 exception); urgent `onValueChange` (OTPField), `onInputValueChange` (Combobox); `completeAction` (OTPField). Matches conventions 2.1. |
| `details.reason` | `ChangeReason` on every details type except Toggle and ToggleGroup (finding L1). `"platform"` for reset / mount everywhere; `"dismiss"` only for rollback notices (Slider / NumberField step channel, Combobox text). |
| set-valued diff | `added` / `removed` on CheckboxGroup, ToggleGroup, MultiSelect, Combobox `multiple`. |
| controlled triple, `null` empty | uniform; Select `""` and TextField's commit name are recorded exceptions (conventions 3.1). |
| mode-switch / both-set dev warning | every `useControllableAction` / `useStepCommit` owner (`warn:` option). Not the urgent states (M1). |
| rollback | every transition state owner uses `useControllableAction`; uncontrolled state written on resolve only. |
| Field wiring | `useFieldControl` (TextField, Slider, NumberField.Input, Combobox.Input, Select, MultiSelect.Trigger, OTPField.Input, Checkbox/Switch via `use-checkable-input`, RadioGroup/CheckboxGroup via `use-fieldset-group`); every owner calls `useFieldValueChange`. `name` / `disabled` / `required` default from the Field everywhere. |
| reset / mount reconciliation | all form controls dispatch `"platform"`; shared suites `value-action-suite`, `checkable-input-suite`, `commit-action-suite`, `native-group-platform-suite`. |
| IME guard | `isComposingKey` in TextField, NumberField, Combobox listbox keys, MultiSelect; OTPField composition model. One raw spelling left (L3). |
| Escape draft revert | TextField and NumberField (conventions 15). Combobox differs (M4). |
| `data-pending` / `data-disabled` | on owner and acting part everywhere. |
| `data-invalid` | every control inside a Field. `state.invalid` / `state.required` are not uniform (M3). |

## Findings, ranked

### H1. A disabled Combobox or MultiSelect still submits its value; every other control does not

- `combobox/combobox-root.tsx:1219-1229` (single hidden input) and
  `internal/form/hidden-values.tsx:22-35` (Combobox `multiple`, MultiSelect,
  `multi-select/multi-select-root.tsx:441`) render the hidden inputs with **no `disabled`**.
- NumberField works the same way (a hidden native input carries the form value) but passes
  `disabled` (`number-field/number-field-input.tsx:247`), so it is not submitted. Slider, OTPField,
  TextField, Select, Checkbox, Switch, RadioGroup and CheckboxGroup are not submitted either
  (native `disabled`, or `<fieldset disabled>`).
- Probed: a `<form>` holding a disabled Combobox (`defaultValue="a"`), a disabled MultiSelect
  (`["x"]`) and a disabled NumberField (`3`) gives `FormData` `[["c","a"],["m","x"]]`.
- `Field.Root disabled` has the same gap: the Field docs say it "natively disables the control",
  but a Combobox or MultiSelect inside still posts.
- Intentional? Recorded as a trade-off (`design/components/combobox.md` 11.1 at line 1225;
  `design/components/multi-select.md` B.10 at line 633: "a disabled native select posts nothing;
  a consumer who wants that wraps the component in `<fieldset disabled>`"). No reason is given
  for posting. NumberField, designed later on the same hidden-input model, chose the native
  rule, so the family now has both rules.
- Standard: **disabled means not submitted**, the HTML rule. Pass `disabled` to every hidden
  input (`HiddenValues` takes a `disabled` prop; Combobox's single input too). The reset
  listener and the Field registration are not affected: a disabled input is still
  form-associated and still gets `reset`.
- Breaking: yes, behaviour (a server that read the disabled value stops getting it). Alpha, so
  acceptable; CHANGELOG entry and docs rows (Combobox, MultiSelect `disabled`).
- Severity: **high**. A server action sees data from one disabled control and not from its
  neighbour.

### M1. The urgent controllable states have no mode-switch or "both set" dev warning

- `otp-field/otp-field-root.tsx:294-306` (`value` / `defaultValue`) and
  `combobox/use-combobox-text.ts` (`inputValue` / `defaultInputValue`) derive `controlled`
  themselves and warn about nothing. Every transition state goes through
  `internal/action/use-controllable-action.ts:282-300`, which warns on both props set and on a
  switch after mount.
- Probed: rendering `value={undefined} defaultValue="1"` then `value="12"` on OTPField, and the
  same on Combobox `inputValue`, logs no `console.error`.
- Conventions 3.1: "Switching between modes after mount is unsupported (dev warning)", with no
  exception for the urgent lane (2.6).
- Standard: move `useDevWarnings` out of `useControllableAction` as a small helper (for example
  `useModeWarnings(controlled, hasDefault, warn)` in `internal/`) and call it from the OTPField
  Root and from `useComboboxText`. Add the two rows to the OTPField and Combobox tests.
- Breaking: no (dev-only).
- Severity: **medium**.

### M2. `transition` follows two opposite rules

- Have it: `toggle/toggle.tsx:76`, `checkbox/checkbox.tsx:106`, `switch/switch.tsx:92`,
  `radio-group/radio-group-item.tsx:62`, `checkbox-group/checkbox-group-item.tsx:66`,
  `checkbox-group/checkbox-group-parent.tsx:84`, `toggle-group/toggle-group-item.tsx:61`.
- Do not: Select (all parts), Slider, NumberField, TextField, OTPField, `Combobox.Option`,
  `MultiSelect.Option`.
- The reasons cancel each other out. `design/components/select.md` decision 13 and
  `design/components/slider.md` decision 11 say no `transition` because "nothing mounts from
  library state and every attribute is optimistic". That is just as true of a Checkbox `<input>`
  and a `RadioGroup.Item`. `design/components/radio-group.md` 10 (line 705) keeps it "for parity
  with Toggle and Tabs (product-owner decision)". The skill (`SKILL.md:19`) says parts "whose
  content is driven by library state" take `transition`, which describes neither group.
- Standard (needs a PO decision): one rule in conventions 5.1. Recommended: the Select / Slider
  rule, and remove `transition` from the optimistic-only parts. Their only effect is an update
  animation on the settle commit, and a consumer gets that with their own `<ViewTransition>`
  keyed on the `fsui-*` types every one of them already emits. The alternative is to add
  `transition` to the trigger parts of Select, MultiSelect and Combobox options for parity.
- Breaking: removing is a breaking type and behaviour change; adding is not.
- Severity: **medium**. Users will find `transition` on a Checkbox and look for it on the
  Select next to it.

### M3. Field state is exposed as `data-invalid` everywhere, but `state.invalid` / `state.required` only here and there

- `state.invalid`: only `OTPFieldState` (`otp-field/otp-field-root.tsx:82`). TextField,
  NumberField (Root and Input), Slider (Root and Thumb), Select, Checkbox, Switch, RadioGroup,
  CheckboxGroup, `Combobox.Input` and `MultiSelect.Trigger` all render `data-invalid` inside a
  Field, but their state has no `invalid`.
- `state.required`: only `TextFieldState` (`text-field/text-field.tsx:63`) and `NumberFieldState`
  (`number-field/number-field-root.tsx:67`). OTPField, RadioGroup, CheckboxGroup and MultiSelect
  have a `required` prop, and the `Combobox.Input` has one, but none of their states carries it.
- `state.readOnly`: TextField, NumberField and OTPField all have it (consistent).
- Conventions 4.1: "A state has one name. It appears as `data-<name>` on the element, as
  `state.<name>`". The conventions 4.1 `invalid` row (`design/conventions.md:1427`) also lists
  only OTPField, NumberField and TextField among the controls.
- Standard: every control part that renders `data-invalid` has `state.invalid` (`false` outside
  a Field, OTPField's rule). Every owner with a `required` prop has `state.required` ("own or the
  Field's"). Update the 4.1 row to say "every control inside a Field".
- Breaking: no (additive fields).
- Severity: **medium**. A `className={({ invalid }) => …}` works on OTPField only.

### M4. Escape on edited text: TextField and NumberField revert it, Combobox leaves it

- `text-field/text-field.tsx:259-264` and `number-field/number-field-root.tsx:489-497` revert an
  edited draft and consume the key (conventions 15, "A draft reverted on Escape").
- Combobox (single, without `allowCustomValue`): typed text that does not match is also a
  draft in effect, since it reverts to the selection's label on blur. But Escape only closes the
  listbox (the platform's close watcher), and a second Escape while closed does nothing of its
  own (`design/components/combobox.md:1046-1047`), so an enclosing Dialog closes with the text
  still edited. The same applies to MultiSelect's typeahead, which has no text, so that one is
  not a finding.
- Intentional? Combobox.md 1.x ("Escape closes; it does not clear", line 151) is about
  *clearing* the selection. Reverting the text to the selection's label was never weighed
  against the later conventions 15 rule.
- Standard: when the listbox is closed and the text differs from what a blur would leave (the
  selection's label, or the committed custom value), Escape reverts the text through
  `onInputValueChange` with `reason: "dismiss"` (the reason a revert already uses) and consumes
  the key; otherwise it is not handled. This matches APG's optional "if the listbox is not
  displayed, clears the combobox", in the revert form.
- Breaking: behaviour only (one more Escape before an enclosing dialog closes).
- Severity: **medium**. Needs a design decision; list it with conventions 15.

### M5. `readOnly` is honoured by the text controls only; elsewhere it is accepted and ignored

- Honoured: TextField (`text-field/text-field.tsx:115`), NumberField, OTPField (prop, state,
  no dispatch).
- `Combobox.Input` does not omit `readOnly` (`combobox/combobox-input.tsx:47-67`), and nothing
  in `combobox/` reads it. Probed: `<Combobox.Input readOnly>`, ArrowDown, ArrowDown, Enter
  dispatches `valueChangeAction("a")`. The attribute blocks typing only. The Trigger and Clear
  change the value too.
- Checkbox and Switch accept `readOnly` through the input props and the box still toggles
  (`design/components/switch.md:343` records "no effect (platform)"). Select, Slider, RadioGroup,
  CheckboxGroup, MultiSelect and `Field.Root` have no `readOnly`.
- Standard: either (a) a library `readOnly` on every value owner (Root or single element:
  focusable, no dispatch for user interaction, still submitted, `state.readOnly`; Base UI and
  React Aria do this), or (b) `readOnly` only on the text controls, with `readOnly` added to the
  `Omit` of `ComboboxInputProps`, `CheckboxProps` and `SwitchProps`, so that a prop that cannot
  work is a type error. (b) is the minimum. (a) is a feature and needs PO input.
- Breaking: (b) is a type-level break for anyone passing it now (it never worked); (a) is
  additive.
- Severity: **medium** (silent no-op on a form control prop; the Combobox case changes the value).

### M6. Commit-details type names follow three patterns

- Slider: `SliderValueChangeDetails` (step) and `SliderValueCommitDetails` (commit), at
  `slider/slider-root.tsx:50,66,151`.
- NumberField: one `NumberFieldValueChangeDetails` for both actions
  (`number-field/number-field-root.tsx:40,100`), whose doc has to say that `"dismiss"` happens on
  `valueChangeAction` only.
- TextField: the commit-only action is typed `TextFieldValueChangeDetails`
  (`text-field/text-field.tsx:40,97`). It has no change action at all, and the name is the one
  conventions 3.1 says it avoided for the prop.
- Standard: `<Component>ValueCommitDetails` for every `valueCommitAction` (Slider's pattern). Add
  `TextFieldValueCommitDetails` and `NumberFieldValueCommitDetails`, keep the old names as
  deprecated aliases for one release, and update `design/components/text-field.md:180,207,671`
  and the docs props tables.
- Breaking: no, with the aliases.
- Severity: **medium** (public type names users import; low runtime impact).

### L1. Toggle and ToggleGroup details have no `reason`

- `toggle/toggle.tsx:30-33` (empty interface) and `toggle-group/toggle-group-root.tsx:30-35`
  (`added` / `removed` only). Every other details type in the family has
  `reason: ChangeReason`, CheckboxGroup's set-valued one included.
- Justified in substance (a `<button>` has no platform path, so the value would always be
  `"activate"`). Still, generic consumer code (`details.reason === "platform"` to skip a save on
  reset) does not type-check on these two.
- Standard: add `readonly reason: ChangeReason` (always `"activate"`) to both.
- Breaking: no. Severity: **low**.

### L2. No accessible-name dev warning on most value controls

- Present: `OTPField.Input` (`otp-field/otp-field-input.tsx:203-215`), Slider group and the
  multi-thumb case (`slider/slider-thumb.tsx:204`), Combobox Trigger / List / Clear / Chips,
  MultiSelect List.
- Absent: TextField, `NumberField.Input` / Root group, Select, Checkbox, Switch, RadioGroup and
  CheckboxGroup (fieldset without legend or `aria-label`), ToggleGroup Root (APG wants a group
  name), icon-only Toggle.
- Standard: every part the consumer must name gets the `use-name-warning` check (labels
  resolved the way OTPField does it: `<label for>`, wrapping `<label>`, `aria-label(ledby)`).
- Breaking: no (dev-only). Severity: **low**.

### L3. One IME guard is spelled by hand

- `combobox/combobox-root.tsx:1081` (chip keydown) checks `event.key === "Process" ||
  event.keyCode === 229`. Everything else uses `isComposingKey` (`internal/escape-key.ts:16`,
  `isComposing || keyCode === 229`), and conventions 15 names it as the one helper.
- Standard: `isComposingKey(event) || event.key === "Process"`, or fold `"Process"` into the
  helper if it is meant generally.
- Breaking: no. Severity: **low** (code).

### L4. Docs wording: keyboard table headers and Field rows

- Headers: `["Input", "Effect"]` (TextField, NumberField, OTPField pages),
  `["Interaction", "Behaviour"]` (Checkbox, Switch, Toggle), `["Key", "Behaviour", "Dispatches"]`
  (CheckboxGroup, RadioGroup), `["Key", "Listbox", "Behaviour"]` (Combobox, MultiSelect),
  `["Key", "Horizontal", "Vertical"]` (Slider) and `["Key", "Horizontal", "Vertical", "Effect"]`
  (ToggleGroup) in `packages/docs/src/pages/*Page.tsx`.
- Standard: first column "Key", last column "Behaviour", optional "Dispatches" column on every
  form control (TextField and NumberField state it in prose today).
- Checkbox's "Owned keys" text (`CheckboxPage.tsx:156`) lists `name` and `required` as taken
  from the Field but not `disabled`, which it also takes (`internal/form/use-checkable-input.ts:66-75`).
  TextField's page lists all three. Switch has the same gap.
- `disabled` rows: Checkbox and Switch say "Native `disabled`; never dispatches" with no
  "or the Field's", while TextField and OTPField add it.
- Severity: **low**.

### L5. Conventions and skill lag the code

- `design/conventions.md:1427` (`invalid` row): see M3.
- `SKILL.md:19` (the `transition` rule): see M2. `SKILL.md:14` lists action names but not
  `valueCommitAction` / `completeAction`, the two names agents most often get wrong.
- Severity: **low**.

## Justified differences (not findings)

- `required` on `Combobox.Input`, not on the Root as for MultiSelect: it is the native
  constraint of the visible input (combobox.md decision 9; multi-select.md B table).
- Value order: pick order for MultiSelect and Combobox `multiple`, document order for
  CheckboxGroup and ToggleGroup (multi-select.md B.6: options may not be mounted).
- Mode flag polarity: `exclusive` (ToggleGroup, Accordion; multiple is the default) against
  `multiple` (Combobox; single is the default). Each flag names the non-default mode.
- No form participation for Toggle and ToggleGroup (toggle-group.md decision 3: a form choice is
  a RadioGroup).
- Select.Root is the `<select>` itself, and Combobox.Root renders no element (native element
  rule, select.md decision 1).
- Label parts: NumberField, Slider, Combobox, MultiSelect, RadioGroup and CheckboxGroup have
  one because a group or listbox needs a name. TextField, OTPField, Select, Checkbox and Switch
  are labelable elements (text-field.md 1, otp-field.md 2).
- No `data-readonly` (number-field.md decision 15: `:read-only`).
- No `required` / `readOnly` on Slider (a range has neither constraint).
- OTPField's text is urgent (`onValueChange`, no rollback); its request is `completeAction`
  (conventions 2.1).
- TextField's `ref` is typed for `<input>`; a textarea ref goes on the `render` element
  (text-field.md line 102).
- `details.source` (NumberField) against `details.thumb` (Slider): different domains.
- `disabled` docs on NumberField and Slider that say `data-disabled` ignores
  `<fieldset disabled>`: conventions 3.6, the same rule as everywhere.
