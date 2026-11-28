# #200: consistency alignment, value inputs and forms

Branch `feat/200-align-value-inputs`, from master 23586b44. Checklist: `design/CHANGELOG.md`,
entry "2026-11-28, #199", section "Implementation checklists", "#200".

## Where things landed

- `useModeWarnings(controlled, hasDefault, { component, prop })` in `internal/use-dev-warning.ts`.
  Called by `useControllableAction` (so `useStepCommit` gets it through it: calling it there too
  would warn twice), `OTPField.Root` (`value`), `useComboboxText` (`inputValue`).
- Name warnings: `NameRules` gained `labels` (`element.labels`) and `legend`; presets
  `CONTROL_NAME` (labels + title) and `GROUP_NAME` (legend). The fieldset groups warn from
  `use-fieldset-group.ts` (shared by RadioGroup and CheckboxGroup), not from each Root.
  A callback ref of `ElementCheck<HTMLElement>` does not merge into a `Ref<HTMLSelectElement>` /
  `Ref<HTMLInputElement>` (no bivariance for non-null params): annotate the variable as
  `ElementCheck<HTMLInputElement>`.
- Combobox Escape: `revertText` in the Root, called from `combobox-keyboard.ts` only when
  `!isPopoverOpen(popup)` and `isEscapeRequest`. Target: `labelFor(selection.optimistic)` (a
  committed custom value is its own label in the cache), `""` with `multiple`.
  Consequence found in `form-reset-button.browser.test.tsx`: typing then Escape before the
  listbox is shown now reverts the text (the open was still on its way). The test waits for the
  listbox now. With `allowCustomValue` and no committed value the target is `""`, not the typed
  text, although a blur would commit the text: the design says "the committed custom value".
- `NumberFieldSource` no longer includes `null`; internal uses are `NumberFieldSource | null`.
- The Popup `transition` JSDoc paragraph was copied from `origin/feat/201-align-overlays`
  (`popover-popup.tsx`, 4f44da5c) into `combobox-popup.tsx` and `multi-select-popup.tsx`.

## Left alone (outside the checklist, noted for the report)

- Select's non-Root parts (Trigger, Value, Group, GroupLabel, Separator) get `state.invalid`
  from the shared `SelectRootState` but render no `data-invalid` (and Group / GroupLabel /
  Separator no `data-pending` / `data-disabled` either): conventions 4.1 rule 2 would want them.
- Slider.Label's state is the Root's, so it has `dragging` / `orientation` without the attributes.
