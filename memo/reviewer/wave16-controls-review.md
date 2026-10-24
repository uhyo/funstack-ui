# Review: wave 16 controls refactor (#105, tracker #100)

Branches: `origin/wave16/controls` (3e6dd03, 14 commits) and `origin/wave16/controls-c1`
(7b637ab, C1 on top). Reviewed 2026-10-24 in a scratch worktree (removed).

Gates run on wave16/controls: typecheck, lint, format:check, build pass; jsdom 2881/2881;
browser (chromium + firefox) 799 passed / 23 skipped (no test changes on the branch besides the
two new arithmetic files). C1 branch: typecheck, build, jsdom 2881/2881, slider + number-field
browser pass.

## Verdict

wave16/controls: acceptable with minor fixes. No behaviour change found.
C1: do not take as is. Recommendation: drop C1; fix the cross-channel superseded-rejection
delay separately (it is a latent defect on master in both components).

## A. Behaviour preservation (verified)

- C2 useCheckableInput: same hook order (useFieldControl, useControllableAction,
  useFieldValueChange, useNativeChecked, useMergedRefs). Checkbox always has `indeterminate`
  (default false) so `mixed` is always true there; Switch passes none, so `indeterminate` /
  `data-indeterminate` keys absent and useNativeChecked gets `undefined` as before. Owned-key
  order identical (role after type for Switch).
- C6: useFieldsetGroup moves useElementCheck / useCallback / useMergedRefs to the top of the
  Roots. None has a layout or passive effect (only useLatest's insertion effect, ref writes);
  the merged ref order (libraryRef, field.ref) unchanged; useId stays the first useId after
  useFieldControl. groupMemberProps: radio keys identical (no aria-checked, no aria-invalid key
  since `invalid` not passed), checkbox keys identical incl. aria-invalid position.
  syncPresences iterates an object literal: insertion order = old call order.
  RadioGroup Root ref callback deps `[]` -> `[fieldsetRef]` (stable ref object): no change.
- C5: throw still before useTransition in both hooks (only useState/useRef/useEffect/useCallback
  precede it). Semantics identical (latest -> rethrow; unmounted -> drop; first -> setState;
  later -> report). Passive "mounted" effect now precedes useDevWarnings' effects: refs only.
- C9 extractions: every hook replaced code in place; effect positions unchanged
  (useItemOrder layout effect, useServerErrorVisibility render-phase edge, useFieldListeners
  layout effect + 4 useFormOwnerEvent, dev-warning effects). New deps are all stable
  (setSuppressNext, dismiss, refs).
- NumberField syncHidden: byte-for-byte the old Input effect body (write if hidden exists, then
  mirror which bails on either ref null) and the old writeHidden. Same call sites, same timing.
- onInputMounted -> onItemMounted: NumberFieldContext is internal (not exported from
  number-field/index.ts); no docs/example references. hiddenText un-exported, also internal.
- C11/C13: resolveFieldDefaults identical rule; RadioGroup state now useMemo'd (identity only);
  CheckboxGroup context still unmemoised (deliberately).
- Dev texts: moved verbatim; production-bundle.test passes.

Mutation checks (jsdom unless noted), each helper broken once:
- use-checkable-input disabled guard / aria-checked removal: Checkbox AND Switch fail.
- group-member data-pending / ownDisabled: RadioGroup AND CheckboxGroup fail.
- use-fieldset-group element check: both fail.
- use-superseded-rejection no-throw: 16 files fail incl. use-action-trigger.test (trigger path)
  and Toggle/Checkbox/... (controllable path).
- use-item-order no-sync / duplicate warning: CheckboxGroup AND ToggleGroup fail.
- resolveFieldDefaults name / disabled: Field, Checkbox, NumberField (+groups) fail.
- use-register-count countRef: Slider fails (NumberField does not use the ref).
Gaps (pre-existing, now in shared helpers):
- syncPresences no-op: only RadioGroup fails; CheckboxGroup.Item/.Parent late-hydration
  attribute sync unpinned (jsdom and chromium browser).
- useFieldsetGroup fallback name replaced by a constant: nothing fails (two unnamed groups on
  one page sharing a radio name is unpinned).
- superseded burst rule: only Toggle pins it; no useActionTrigger burst test. `mounted` guard:
  unpinned. use-controllable-action.test.tsx has no direct superseded test (the audit said it
  did).

## B. Module assessment

Good (real dedupe or a cohesive seam, narrow interface):
- use-checkable-input, use-fieldset-group, use-superseded-rejection, use-item-order,
  resolveFieldDefaults / fieldName, intendedValue, fieldDataAttributes move, slider/NF pure
  arithmetic (+ unit tests), syncHidden, use-server-error-visibility (best of the C9 hooks:
  2 inputs, 3 outputs, owns a state machine).
- group-member: fine; nit: `disabled` and `ownDisabled` side by side are easy to swap; rename
  `disabled` -> `effectiveDisabled` or document at the call sites.
- use-thumb-registry: single user but cohesive (registry + getter ref + its warnings). Keep.

Neutral / borderline:
- use-register-count (27 lines for ~5-12 lines each); NumberField gets an unused countRef. Keep
  for naming consistency, or inline back; either way small.
- use-slider-dev-warnings / use-number-field-dev-warnings: options interfaces mirror Root
  locals (10 and 9 fields; NF passes both raw min/max and bounds). They do take ~50 lines of
  warnings out of the Roots. Acceptable; trim the option JSDoc to one line each.

Recommend un-split / fix:
- use-field-listeners (105 lines, 7 options, all Root locals passed through: controlRef,
  element, refresh, dismiss, setSuppressNext, attempted, errorCount). Two unrelated listener
  groups behind one wide interface; the reader of field-root now chases `refresh` across files.
  Also inverts ownership: field-root.tsx:26 imports `RefreshOptions` (the Root's own refresh
  signature) from the listeners file. Either inline it back (Field.Root is 413 lines with it
  out, ~450 back) or at least move `RefreshOptions` back to field-root.
- use-checkable-input option `rest` (named after the call-site variable): rename to `own` or
  pass name/required/id explicitly. Nit.

## C. C1 (useStepCommit)

Confirmed the developer's analysis with a scratch test (uncontrolled Slider, two key presses,
deferred step and commit actions):
- Case A, superseded STEP rejection while commits pending: master/controls: boundary not called
  until the commits settle; C1: prompt.
- Case B, superseded COMMIT rejection while a step is pending: master/controls: prompt; C1:
  waits for the step.
NumberField on master already has C1's order (trigger first), i.e. case B is delayed today.
Neither case is pinned by any test, so C1 silently moves the defect instead of fixing it.

Other C1 notes: +83 lines (254-line hook, 4 type parameters, 15 options incl. toShown /
toValue / normalize / onStep / fieldKey, 3 extra entry points ensureGesture / holdShown /
openGesture); a `react-hooks/exhaustive-deps` disable; number-field-root.tsx: the
`/** The hidden input's value for value. */` JSDoc now sits on `identity` instead of
`hiddenText`; useFieldValueChange's layout effect moves before useFieldControl in Slider (no
layout effect between, harmless).

Remaining duplication if dropped: ~90-100 parallel lines per Root (state + refs ~15, runCommit
~16, commit useControllableAction + committedRef ~10, held/shown ~4, useFieldValueChange ~6,
step ~30, commit ~13, openGesture ~4), of which ~60 are identical modulo names; the rest
already differs (NF round / clearDraft / syncHidden / announce, Slider array conversion).

Recommendation: drop C1. Separately (a fix, not a refactor, with the two scratch scenarios as
tests for both Slider and NumberField): add an optional external capture to
useControllableAction and useActionTrigger and call one useSupersededRejection in each Root
before both hooks. That makes both cases prompt in both components for ~15 lines. If the team
still wants C1 afterwards, it becomes behaviour-neutral then; judge it on readability alone
(I would still not take it at +83 lines).
