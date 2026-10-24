# Wave 16 source refactor, phase 2: controls (#105, tracker #100)

Branch `wave16/controls` (C2, C6, C11, C13, C3 follow-up, C5, C9). C1 is on its own branch
`wave16/controls-c1` (one commit on top) because it is not behaviour-identical (see C1 below).
Audit: `memo/reviewer/refactor-audit-controls.md`. Rebased onto master after #101 landed.

## Done (one commit per finding; C9 as several)

- C2 `internal/use-checkable-input.ts`: Field wiring, controllable action, `useNativeChecked`,
  owned input layer of Checkbox / Switch. Owned keys in the same order (role / indeterminate /
  data-indeterminate spread conditionally at their old positions).
- C6 `internal/use-fieldset-group.ts` (Root: Field binding, useId name, fieldset ref + element
  check), `intendedValue` in use-controllable-action.ts (the `base()` null check),
  `internal/group-member.ts` `groupMemberProps` (Item owned layer; `aria-checked` removal stays
  checkbox-only, `aria-invalid` only when given), `syncPresences`.
- C11 `resolveFieldDefaults` (one "own or the Field's" rule, used by useFieldControl and
  NumberField.Root) and `FieldControlBinding.fieldName` (Slider no longer reads FieldContext).
  Field.Control kept its explicit keys: `fieldInputProps` would reorder the rendered attributes.
- C13 group contexts carry `state` (Labels read it); `useRegisterCount`; NumberField `shownRef`
  is a `useLatest`; NumberField `onInputMounted` -> `onItemMounted`; FormAssociatedElement
  imported from use-form-owner-event.ts in my files.
- C3 follow-up `internal/use-item-order.ts` (CheckboxGroup, ToggleGroup Root only).
- C5 `internal/use-superseded-rejection.ts`, called first in both hooks (throw stays before
  useTransition). The mounted effect now runs before useControllableAction's dev-warning effect
  (passive, refs only).
- C9: slider-arithmetic `pointerValue` / `tiedRange` / `resolveTie` / `sliderGeometry` /
  `toArray` / `shapeOf` (+ slider-arithmetic.test.ts); `useThumbRegistry`, `useSliderDevWarnings`;
  number-field-arithmetic `keyStep` (+ number-field-arithmetic.test.ts); `syncHidden` replaces
  `mirror` in the NumberField context (the Input's after-commit write is the same code);
  `useNumberFieldDevWarnings`, `readVisible`; `fieldDataAttributes` -> field-context.ts;
  `useServerErrorVisibility`, `useFieldListeners`. Hooks sit where their code was.

## C1 (branch wave16/controls-c1)

`internal/use-step-commit.ts`. Everything matches except hook order: a single hook must call
`useActionTrigger` and `useControllableAction` in one order; NumberField had trigger first, Slider
commit first. Each hook throws its superseded rejection before its own `useTransition`, but after
the other channel's when that one comes first; React's errored-render retry then suspends on the
earlier channel's pending action. With trigger first (chosen): Slider's step-superseded errors now
surface at once (they waited for a pending commit before), commit-superseded errors wait for a
pending step (they were prompt). NumberField unchanged. Exact fix for both: one
`useSupersededRejection` shared by both channels, thrown before both transitions (needs the two
hooks to accept an external capture). Left to the coordinator.

`live` is stored wrapped (`{ value }`) for both; Slider's `shown` keeps the same array identity.
NumberField's step now clears the draft after `setPendingSource` instead of before (same batch).

## Not done / deferred

- C13 CheckboxGroup context memoisation: memoising changes when Items re-render, and the
  late-hydration snapshot relies on the registration re-render re-applying `checked`. Not
  behaviour-neutral.
- C13 ToggleGroup `register` -> `registerItem`, `useStepButtonElement` move, dropping the
  `FormAssociatedElement` re-export (combobox-root imports it): overlap with the overlay
  developer's C12 / overlay files.
- C13 controlled-value identity (Accordion / ToggleGroup JSON key vs CheckboxGroup identity):
  design decision, recorded only.
- Line count: packages/ui/src non-test 26943 -> 27290 (controls) / 27373 (with C1). The dedupes
  remove the duplicated bodies, but the C9 splits and typed option interfaces add more lines than
  they remove.
- WebKit cannot launch locally (missing host libraries); Chromium + Firefox ran, CI covers WebKit.
