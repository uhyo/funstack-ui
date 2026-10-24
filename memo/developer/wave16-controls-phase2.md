# Wave 16 source refactor, phase 2: controls (#105, tracker #100)

Branch `wave16/controls` (C2, C6, C11, C13, C3 follow-up, C5, C9, the cross-channel fix).
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

## C1: dropped (PO decision); the cross-channel fix instead

C1 (`useStepCommit`) moved a latent defect instead of fixing it: a superseded rejection thrown
after the other channel's `useTransition` waited for that channel's pending action (React's
errored-render retry suspends there). Slider: step rejection while commits pend (case A);
NumberField: commit rejection while a step pends (case B). Branch `wave16/controls-c1` deleted.

Fix (`fix(ui)` commit): `useControllableAction` / `useActionTrigger` take an optional
`captureSuperseded`; both Roots call one `useSupersededRejection()` before both hooks. The hooks
still call their own (never set when external), so no conditional hook call. Tests "superseded
rejection across channels" in slider.test.tsx and number-field.test.tsx (both cases each); before
the fix Slider's step case and NumberField's commit case failed (boundary not called).

## Review follow-ups (memo/reviewer/wave16-controls-review.md)

- Tests for the gaps: CheckboxGroup late Item / Parent attribute sync (a hydrated Item click
  with the action settled before the gate opens: with a pending action jsdom never hydrated the
  boundary), two unnamed groups' distinct names (both groups), direct superseded rows in
  use-controllable-action.test.tsx and use-action-trigger.test.tsx (burst, unmount guard,
  external capture). Each checked by breaking the helper once.
- use-field-listeners inlined back; `effectiveDisabled`; `own`; NumberField's Label count inline;
  dev-warning options with one doc line.
- After wave16/overlays merged (rebase had no conflicts): NumberField step buttons use
  `disabledButton`; ToggleGroup `registerItem`; `useStepButtonElement` and the button types live in
  use-step-button.ts; the `FormAssociatedElement` re-export is gone (combobox already imported the
  source).

## Not done / deferred

- C13 CheckboxGroup context memoisation: memoising changes when Items re-render, and the
  late-hydration snapshot relies on the registration re-render re-applying `checked`. Not
  behaviour-neutral.
- C13 controlled-value identity (Accordion / ToggleGroup JSON key vs CheckboxGroup identity):
  design decision, recorded only.
- Line count (non-test packages/ui/src): 26943 on master -> 27274. The dedupes
  remove the duplicated bodies, but the C9 splits and typed option interfaces add more lines than
  they remove.
- WebKit cannot launch locally (missing host libraries); Chromium + Firefox ran, CI covers WebKit.
