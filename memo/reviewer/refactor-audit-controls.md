# Refactor audit: non-overlay components (issue #100)

Scope: toggle, toggle-group, toolbar, button, checkbox, checkbox-group, radio-group, switch,
slider, number-field, field, form, progress, meter, tabs, accordion, csp, index.ts, and the
internal modules they use. Behaviour-preserving tidy-ups only (public API, DOM, data attributes
and timing unchanged). Paths below are relative to `packages/ui/src/`. Audited 2026-10-24 at
1208aa2.

Ranking is value / risk. Size estimates are net lines removed from `src/` (tests excluded).

## Summary table

| id | what | est. size | risk |
|----|------|-----------|------|
| C1 | Slider + NumberField share one "step / commit" two-channel hook | -120 net, 2 files -200 | med-high |
| C2 | Checkbox + Switch share one checkable-input hook | -60 | low |
| C3 | One `internal/value-set.ts` for set/order helpers (CheckboxGroup, ToggleGroup, Accordion, validity) | -45 | low |
| C4 | Promote `useSelectPartRef` to a generic part-ref (element check) helper, ~10 sites | -90 | low |
| C5 | Superseded-rejection machinery shared by `useControllableAction` and `useActionTrigger` | -35 | med |
| C6 | RadioGroup / CheckboxGroup: shared fieldset-group root hook and member wiring | -60 | low-med |
| C7 | `resolveKey` / `Move` / focus helper duplicated verbatim in tabs-list and use-roving-focus | -25 | low |
| C8 | `useNativeFocusgroup(flag)` (4 copies) and `useHydratedMount` in CheckboxGroup.Parent | -25 | low |
| C9 | Split slider-root (963), number-field-root (776), field-root (503) along natural seams | file size -30% | low-med |
| C10 | Dead code / dead fields | -15 | low |
| C11 | Field wiring done three ways; helpers living in Root files | -20, clarity | low-med |
| C12 | Focusable-disabled button props helper (#83 rule) | -15, one rule in one place | low |
| C13 | Sibling inconsistencies (context shape, naming, memoisation, file layout) | clarity | low |
| C14 | Tabs / Accordion declare `reason` with local unions (conventions 2.2 says never) | 2 types | type-level API (needs PO) |
| C15 | Comment hygiene | -150 comment lines | none |
| C16 | Type tidiness | small | low |
| C17 | Considered and rejected | — | — |

---

## C1. Slider and NumberField: one two-channel step/commit hook

Both Roots implement the same design (slider.md 2.4, number-field.md 2.4): urgent `live` value,
step transition via `useActionTrigger({ ignoreWhilePending: false })`, commit via
`useControllableAction`, "held" derivation, rollback-to-committed with `reason: "dismiss"`,
`lastReason` feeding `useFieldValueChange`, label registry. The spans are line-for-line parallel:

| concern | slider/slider-root.tsx | number-field/number-field-root.tsx |
|---|---|---|
| state: live / held / pendingX / refs | 268-285 | 236-254 |
| `runCommit` with dismiss rollback (identical incl. comment) | 287-301 | 287-304 |
| commit `useControllableAction` + `committedRef` | 303-312 | 306-315 |
| step trigger (identical comment) | 314-316 | 283-285 |
| `held` / `shown` / `pending` | 318-321 | 317-319 |
| `lastReason` + `useFieldValueChange(..., takeEdit)` (identical body) | 352-359 | 335-339 |
| `stepTo` / `step` (no-op check, write refs, set live, set held, run step action with STEP_TYPES) | 397-425 | 355-387 |
| `commitGesture` / `commit` | 427-441 | 401-417 |
| open gesture (`gestureStart = shown; liveRef = shown`) | 545-547, 621-622, 759-760 | 420-423 |
| label registry | 500-511 | 599-603 |
| STEP_TYPES / COMMIT_TYPES | 178-179 | 142-143 |

Proposal: `internal/use-step-commit.ts`, generic over the value `V` and a per-step "meta"
(`thumb: number | null` / `source: NumberFieldSource`):

```ts
useStepCommit<V, Meta, Details>({
  controlled, defaultValue, initialValue, component,
  changeAction, commitAction,            // valueChangeAction / valueCommitAction
  details: (reason, meta) => object,     // { reason, thumb } / { reason, source }
  equals,                                // equalValues / Object.is
  types: { step, commit },               // transitionTypes("slider", ...)
  holding,                               // gestureThumb !== null / hold !== null
})
// -> { shown, optimistic, committed, pending, pendingMeta, shownRef,
//      openGesture(), step(next, meta, reason, event, beforeWrite?), commit(meta, reason, event) }
```

The NumberField-only parts (`f.round(next)`, `clearDraft()`, `writeHidden(next)`) go in a
`beforeStep` callback; the Slider-only `replaceAt` stays at its call sites. `useStepCommit` also
owns `lastReason` and the `useFieldValueChange` call (key function: `join("\u0000")` for Slider).
The label registry becomes `useRegisterCount()` (C13) in both.

Net: about -200 lines from the two Roots, +80 for the hook. More importantly the delicate
batching (setLive / setStepHeld / setPendingX in one batch before `run`) lives in one place.

Risk: medium-high. The setState batching order and the `shownRef` write-ahead (slider 406-407,
number-field 368-369) must be preserved exactly; NumberField's `shownRef` is a plain `useRef`
written in `useInsertionEffect` (number-field-root 252, 324-326) while Slider uses `useLatest`
and writes into it; both are equivalent (see C13). Protected by slider.test.tsx,
slider.browser.test.tsx (3 engines, drag/keys/rollback), number-field.test.tsx,
number-field.browser.test.tsx, field.test.tsx (Slider/NumberField inside Field). Do it as its
own commit after C9's pure extractions so the diff is reviewable.

## C2. Checkbox and Switch: one checkable-input hook

checkbox/checkbox.tsx 134-229 and switch/switch.tsx 120-202 are the same code with two
differences (Checkbox's `indeterminate`; Switch's `role: "switch"`). Duplicated spans:
`useFieldControl` call (checkbox 136-144 / switch 122-130), `useControllableAction` (146-156 /
132-142), `useFieldValueChange` (157-159 / 143-145), `useNativeChecked` (165-175 / 147-156),
`useMergedRef` (184 / 160), and the owned layer `fieldInputProps`, `type`, `checked`,
`defaultChecked: undefined`, `aria-checked: undefined`, `disabled`, `data-*`, `onChange` with
`guardCheckableChange` (197-226 / 173-199). The JSDoc of `checked`, `defaultChecked`,
`checkedChangeAction`, `disabled`, `value`, `transition` is also verbatim.

Proposal: `internal/use-checkable-input.ts`:

```ts
useCheckableInput({ component, typePrefix, onWord, offWord, checked, defaultChecked,
  checkedChangeAction, disabled, rest, indeterminate? })
// -> { optimistic, pending, disabled, shownIndeterminate, ref, libraryProps }
```

Each component keeps its props interface, state object, `role`, and `useRender` /
`useTransitionBoundary` call. About -60 lines. Props JSDoc stays duplicated (public docs).

Risk: low. `__tests__/checkable-input-suite.tsx` (1419 lines) already runs the same behaviour
matrix against both components, plus checkbox/switch browser tests.

## C3. One module for set / order helpers

Byte-identical or near-identical helpers:

- `reduce(set, patch)`: checkbox-group-root 143-148, toggle-group-root 146-151 (same comment).
- `Patch` / `CheckboxGroupPatch`: toggle-group-root 140-143, checkbox-group-context 5-8.
- `sortByOrder`: checkbox-group-root 154-160, toggle-group-root 154-160.
- `arraysEqual`: checkbox-group-root 186-188, toggle-group-root 162-164, and already exported
  from internal/validity.ts 66-68 (used by field-root).
- `setsEqual`: checkbox-group-root 136-140, accordion-root 148-152.
- `EMPTY` + `toSet`: checkbox-group-root 130-134, toggle-group-root 133-138,
  accordion-root 115-120 (toggle-group and accordion identical, incl. the string / null cases).
- `byDocumentOrder`: toggle-group-root 166-169, accordion-root 154-157, while
  internal/validity.ts 175-182 already exports `sortByDocumentOrder` (form-root, focus-first-invalid).
- Duplicate-value dev warning inside the post-commit order sync: checkbox-group-root 420-429,
  toggle-group-root 327-335.

Proposal: `internal/value-set.ts` (directive-free) with `EMPTY_SET`, `toSet`, `setsEqual`,
`applyPatch`, `SetPatch`, `sortByOrder`, `arraysEqual`, `firstDuplicate`; move
`sortByDocumentOrder` + a `compareDocumentOrder` comparator out of validity.ts into
`internal/dom-order.ts` (validity.ts is a Field module; these are generic). Keep
`CheckboxGroupPatch` as an alias if anything public names it (it is internal today).

About -45 lines. Risk: low (pure functions). Protected by checkbox-group.test.tsx,
toggle-group.test.tsx, accordion.test.tsx, field/form tests. Note the accordion comparator
returns `1` for "not following" while validity's returns `0` for unrelated nodes; for distinct,
non-nested items both orders agree.

Optional follow-up (med risk): the "keep Items' document order in state, refreshed after the
Root's commit" effect exists twice (checkbox-group-root 406-433, toggle-group-root 311-340, the
latter says "CheckboxGroup's approach"). A `useItemOrder(readItems, optimistic, extraChanged?)`
hook would hold it once; ToggleGroup's extra `disabled` tracking makes the signature less clean,
so only do it with C3 if it reads well.

## C4. Generic part-ref helper for "expected a <tag>" dev checks

Hand-rolled `warned = useRef(false)` + callback ref + `console.error("expected ... but got
<tag>")` + `return () => {}` / node bookkeeping, in scope:

- radio-group-root 288-301 and checkbox-group-root 435-448 (identical except the name)
- field/field-label.tsx 33-45, field/field-control.tsx 61-73, form/form-submit.tsx 49-62,
  form/form-root.tsx 100-104 (inside its own ref)
- slider/slider-label.tsx 40-54, number-field/number-field-label.tsx 112-122
- number-field/number-field-input.tsx 116-134
- accordion-item ~100-110, accordion-trigger ~92-100
- internal/use-native-checked.ts 68-84 (type check)

select/select-dom.ts 21-54 already has the generic version (`useSelectPartRef(component, tag,
position?)` -> `{ ref, node }`). Promote it to `internal/use-part-ref.ts` with a predicate and a
reason string: `usePartRef(component, accepts: (el) => boolean, expected: string, why: string)`.
The Select auditor owns select-dom.ts; coordinate (Select keeps its `position` check as an option
or a thin wrapper).

About -90 lines across ~11 sites. Risk: low; messages must stay byte-identical where tests match
them (checkable-input-suite 761-764 matches `expected to render an \`<input type="checkbox">\``
and `but got .<button>.`; grep the tests for each message before changing). Note two message
styles exist ("expected to render a <x> element" vs Slider/NumberField Label's "expected a <label>
element"); unify only if no test pins the old text.

## C5. Superseded-rejection machinery, twice

internal/use-controllable-action.ts 71-75 and internal/use-action-trigger.ts 35-39: identical
`report()`. use-controllable-action 89-99, 114-123, 149-165 and use-action-trigger 53-58, 62,
68-73, 85-98: the same `supersededError` state thrown before `useTransition`, the
`hasSupersededError` ref, the `mounted` ref, the `latest` id, and the catch branch.

Proposal: `internal/use-superseded-rejection.ts`:

```ts
const rejection = useSupersededRejection(); // useState + throw-in-render + mounted ref
// in the catch: if (id === latest) throw error; rejection.capture(error);
```

Call it first in both hooks so the throw stays before `useTransition` (the comment at
use-controllable-action 94-96 explains why; keep it once, in the new hook).

About -35 lines. Risk: medium: hook order and the "throw before useTransition" placement are
load-bearing. Protected by internal/use-controllable-action.test.tsx (superseded rejection
rows), button.test.tsx, slider/number-field rejection tests.

## C6. RadioGroup / CheckboxGroup shared fieldset wiring

Root (radio-group-root 199-213, 288-302 vs checkbox-group-root 226-241, 435-449):
`useFieldControl({ labelable: false, ... })`, `required`/`disabled` from the binding,
`useId()` fallback name, `fieldsetRef`, the fieldset element check (C4), `useMergedRef`, and the
`base()` intent read (radio 233-238, checkbox 300-304, also use-native-checked 87 and 154).
Proposal: `useFieldsetGroup({ component, name, disabled, required })` ->
`{ field, name, required, disabled, fieldsetRef, rootRef }`.

`base()`: add `intent(optimistic)` or have `useControllableAction` return a stable
`latestIntent()` that applies the explicit null check (the doc at
use-native-group-reconciliation 21-26 tells every caller to write that check by hand).

Items (radio-group-item 81-145 vs checkbox-group-item 85-159): the `onItemMounted` closure
with `syncPresence` for `data-checked`/`data-pending`/`data-disabled` (radio 94-105, checkbox
101-112, also parent 147-158), and the owned layer `type`, `name`, `value`, `checked`,
`defaultChecked: undefined`, `disabled: disabledProp`, `form`, `required`, `data-*`, and the
`guardCheckableChange` onChange. A `groupMemberProps(...)` helper plus a
`syncServerAttributes(el, {...})` loop.

About -60 lines. Risk: low-med (group reconciliation timing untouched; only wiring moves).
Protected by radio-group/checkbox-group jsdom + browser tests, use-native-group-reconciliation.test.tsx.

## C7. Duplicated arrow-key resolution

tabs/tabs-list.tsx 38-57 and internal/use-roving-focus.ts 165-184: `type Move` and
`resolveKey(key, orientation, rtl)` are byte-identical; `focusTab` (tabs-list 66-69) equals
`focusItem` (use-roving-focus 186-189). Export them from a small `internal/arrow-keys.ts` (or
from use-roving-focus). About -25 lines. Risk: low. Protected by tabs.test.tsx,
toolbar.test.tsx, toggle-group.test.tsx, use-roving-focus.test.tsx.

## C8. Feature-detection stores

`useSyncExternalStore(subscribeNever, () => flag && "focusGroup" in HTMLElement.prototype,
() => false)` with a module-level `subscribeNever`: toolbar-root 53-54/76-80,
toggle-group-root 176-177/343-347, tabs-list 72/98-102, menu/menu-popup 147/350-354 (overlay
auditor's file; same helper). One `useNativeFocusgroup(flag)` in internal/ (the `"focusGroup"`
spelling, issue #43, then lives in one place). About -20 lines.

checkbox-group-parent.tsx 77 and 115-119 re-implement `useHydratedMount()`
(internal/use-hydrated-mount.ts) exactly: same subscribe/client/server snapshots. Use the hook.
(-6 lines, zero risk.)

## C9. Oversized files: splits along natural seams

slider/slider-root.tsx (963 lines, one 720-line function):
- Pure pointer math into slider-arithmetic.ts: `valueAt` (651-663) as
  `pointerValue(rect, x, y, orientation, rtl, min, max)`; the stacked-thumb tie detection and
  `resolveTie` (681-706) as `tiedRange(values, index)` / `resolveTie(tied, raw)`. Both become
  unit-testable; -40 lines from the Root.
- Thumb registry + first-input `formElement` getter-ref (443-496) -> `useThumbRegistry()`.
- Dev warnings (780-825) -> `useSliderDevWarnings(...)` in its own file.
- Geometry custom properties (829-837) -> `sliderGeometry(shown, min, max)` pure.
With C1 the Root lands near 550 lines.

number-field/number-field-root.tsx (776):
- The key -> compute switch (478-524) -> pure `keyStep(key, shiftKey, bounds, largeStep)` in
  number-field-arithmetic.ts (unit-testable, -30 from the Root).
- Mount reconciliation `readCurrent` (614-635) -> named function.
- Dev warnings (655-684) -> `useNumberFieldDevWarnings`.
- `writeHidden` (271-281) and number-field-input 142-151 are the same "hidden.value = text;
  mirror()" code: expose `syncHidden(value)` in the context instead of `mirror`, and the
  Input's layout effect calls it. That also removes the Input's runtime import of `hiddenText`
  from the Root (number-field-input 25).

field/field-root.tsx (503):
- Server-error visibility state machine (198-230: dismissed / suppressed / suppressNext and the
  pending edge) -> `useServerErrorVisibility(formPending, serverMessages)`.
- Native control listeners (329-362) and form-owner listeners (364-392) ->
  `useFieldListeners(...)`.
- `fieldDataAttributes` (495-503) moves to internal/field-context.ts: four parts import it
  from field-root.tsx today (field-label 8, field-control 9, field-error 8, field-description 7).

checkbox-group-root.tsx (523): with C3 and C6 most of its 70 lines of top-level helpers move out;
the remaining Root is ~400.

Risk: low for the pure extractions (same code, new home), low-med for the hooks (effect order
inside the component must be kept: e.g. slider's registry must be declared before
`useNativeGroupReconciliation`). Protected by the component suites above.

## C10. Dead code

- `SliderContextValue.shownValue` (slider-context.ts 25-26, set at slider-root 861 and listed in
  the memo deps 889): no reader. grep `ctx.shownValue|\.shownValue` finds none (slider-thumb has
  its own local `shownValue`). Remove field, entry and dep.
- slider/slider-arithmetic.ts 7 `export { decimalsOf }`: only slider.test.tsx imports it from
  there, and number-field-format.test.ts already tests `decimalsOf` from internal/decimal.ts
  (220-222, same assertions as slider.test.tsx 268-270). Drop the re-export and the duplicate test.
- slider-arithmetic.ts 100-104 `percent(value, min, max)` equals
  `clamp(percentage(value, min, max), 0, 100)` from internal/range-value.ts (both return 0 for
  `max <= min`). Use range-value; also share the `EPSILON = 1e-9` constant
  (slider-arithmetic 10, number-field-arithmetic 14) and the `Math.max(decimalsOf(step),
  decimalsOf(min))` rule (slider-arithmetic 20, number-field-arithmetic 16-18) in internal/decimal.ts.
- number-field/use-step-button.ts 7-8 export `HOLD_DELAY` / `HOLD_INTERVAL`, used only in-file.
  Harmless; drop `export` unless tests are meant to read them (none do).
- `NumberFieldSource` (number-field-context.ts 11) duplicates the inline union of
  `NumberFieldValueChangeDetails.source` (number-field-root 58) minus nothing: declare the detail
  field as `NumberFieldSource` (same type, one source).

Nothing else in scope is dead: every exported function/const in the audited internals has a
non-test importer (checked by script; remaining unreferenced exports are option/result interface
types, which is the house style).

## C11. Field wiring done three ways

- Switch, Checkbox, RadioGroup, CheckboxGroup, Field.Control: `useFieldControl(...)`.
- NumberField.Root: reads `use(FieldContext)` and recomputes "own or the Field's" itself
  (number-field-root 224-231), then NumberField.Input calls `useFieldControl` with the already
  resolved values (number-field-input 99-107).
- Slider.Root: calls `useFieldControl` and additionally `use(FieldContext)?.name`
  (slider-root 334) to get the Field's own name for the Thumb warning.

Tidy: add `fieldName` (the Field's own `name`) to `FieldControlBinding`; Slider drops its second
context read. NumberField.Root could use `useFieldControl`'s resolution helpers for
`disabled`/`required`/`name` without registering (a `resolveFieldDefaults(field, own)` pure
function extracted from use-field-control 150-152), so the rule exists once.
Field.Control (field-control 85-91) spreads `id/name/disabled/required` + `attributes` by hand;
`...fieldInputProps(field), disabled: field.disabled` is the same set.

Risk: low-med (NumberField's Field behaviour is covered by number-field + field tests).

## C12. Focusable-disabled button props (#83)

Same three-line owned block in toggle/toggle.tsx 104,121-123; toggle-group-item.tsx 82,101-103;
number-field-increment.tsx 71,98-99; button.tsx 110,159-161 (variant: also pending). Plus the
`rendersButton(render) ? { type: "button" }` line in Toggle 115, ToggleGroup.Item 99,
NumberField 96. A `buttonDisabledProps(render, disabled)` next to `isHostButton` in
internal/render-element.ts keeps the #83 rule in one place (Button keeps its own because of
`pending`). -15 lines; risk low (toggle/toggle-group/number-field/button tests pin the
attributes).

## C13. Sibling inconsistencies

- Group contexts: RadioGroup context exposes `optimistic`; CheckboxGroup exposes `optimistic`
  *and* `value` (the ordered array); ToggleGroup `optimistic`; Tabs `optimistic`. Labels rebuild
  the Root state from context fields (radio-group-label 30-35, checkbox-group-label same) while
  Slider/NumberField/Field/Progress/Meter put `state` in the context. Put `state` in the
  RadioGroup/CheckboxGroup contexts and let the Labels read it (then the two Label files are
  identical modulo names).
- Memoisation (#48): RadioGroup, Tabs, Accordion, ToggleGroup, Slider, NumberField, Field memoise
  their context; CheckboxGroup.Root builds a fresh object every render (checkbox-group-root
  464-494) with closures over `optimistic`. Make it stable like ToggleGroup (useLatest +
  useCallback). Perf-only; low-med risk.
- Registration naming: `registerItem` (Accordion, CheckboxGroup), `register` (ToggleGroup
  context 24), `registerThumb`/`registerLabel` (Slider), `onItemMounted` vs NumberField's
  `onInputMounted` (number-field-context 318) for the same adapter callback. Pick `registerItem`
  and `onItemMounted`.
- Label counting: Slider (slider-root 500-511, with an extra ref) and NumberField (599-603) each
  hand-roll a registered-count state; a tiny `useRegisterCount()` returns `[count, register,
  countRef]`.
- `shownRef`: NumberField writes a `useRef` from `useInsertionEffect` by hand (252, 324-326),
  exactly what `useLatest` does (Slider uses `useLatest` and writes into it). Use `useLatest`.
- Controlled-value identity: Accordion (230-235) and ToggleGroup (243-254) key the controlled set
  on `JSON.stringify(value)`; CheckboxGroup (267-271) memoises on the array identity, so an inline
  `value={[...]}` re-bases every render there only. Behaviour-visible (re-base frequency), so a
  design decision, not a pure refactor: record it, do not change in #100.
- File layout: `useStepButtonElement` and `NumberFieldButtonState` live in
  number-field-increment.tsx and number-field-decrement.tsx imports them from its sibling;
  `use-step-button.ts` already exists for the shared logic. Move the shared element hook there.
- `FormAssociatedElement` is defined in use-form-owner-event.ts and re-exported by
  use-form-reset.ts; slider-root and use-native-group-reconciliation import it via the re-export.
  Import from the source and drop the re-export.

## C14. Local `reason` unions (needs a PO decision; type-level change)

design/conventions.md 2.2 (366-368) and 9.4 (1932-1933): every details type declares
`readonly reason: ChangeReason` "never a local union". Two do not:
tabs/tabs-context.ts 8 `TabsChangeReason = "activate" | "platform"` (used by
`TabsValueChangeDetails.reason`, tabs-root 29) and accordion/accordion-context.ts 5
`AccordionChangeReason` (accordion-root 41). Switching to `ChangeReason` widens the public
field type (a consumer's exhaustive `switch` with a `never` check would stop compiling), so it is
not strictly behaviour-preserving. Either fix in #100 with a changelog note, or amend the
convention to allow documented subsets. Internal call signatures (`select`, `dispatchChange`)
can take `ChangeReason` regardless.

## C15. Comment hygiene

Comment lines are ~24% of the audited source (3716 / 15595 lines incl. internals);
use-native-checked.ts is 38%, slider-root 17%, checkbox-group-root 25%.

Patterns, with rough counts:

1. History / review references instead of explanation (~15): "review fold F1" (button 110,
   render-element 66), "Slider M2" (number-field-root 378), "walkthrough 9.6" (accordion-root
   308), "design open question 2, product owner decision" (tabs-root 131), "field-form.md
   amendment `validityElement`" (field-root 249, field-context 42, use-field-control 24). Replace
   with the reason, or a design section number.
2. Bare issue numbers (44 refs in scope: #48 x15, #35 x14, #83 x8, #64 x3, ...). Where the
   sentence already explains the code, drop the number ("Memoised (#48): ..." x4 -> "Memoised:
   ..."); keep it only where the issue holds a repro the comment cannot.
3. A 4-line public-JSDoc paragraph about static `transition` and the 250 ms cross-fade
   ("Static: without `transition` ... (issue #35)") is repeated on 12 `transition` props
   (toggle 58-61, switch 81-84, checkbox 93-96, checkbox-group-item 51-54, radio-group-item
   45-48, checkbox-group-parent 65-68, and the overlay parts). ToggleGroup.Item already uses a
   one-line form (toggle-group-item 40-44). Pick the short form everywhere (it is consumer
   docs, so keep a sentence, not a reference) or move the long text to the docs site.
4. Duplicated module docs: use-form-reset.ts 12-16 repeats use-form-owner-event.ts 63-67
   verbatim; replace with "Built on `useFormOwnerEvent` (same owner-following rules)".
   number-field-root 295-296 / slider-root 292-293 identical comments (goes away with C1).
5. Very long explanatory blocks that belong in design docs (keep a 1-2 line summary + section
   pointer): use-latest.ts 5-21 (stale-window essay), use-native-checked.ts 125-132 (re-apply
   order; already in conventions 3.8 and pinned by a test), use-native-group-reconciliation.ts
   49-66 (RadioGroup wiring walkthrough), checkbox-group-root 340-351, 406-415.
6. Stale comments:
   - tabs/tabs-context.ts 32: "detected in an effect" — it is a `useSyncExternalStore` with a
     `false` server snapshot (tabs-list 98-102).
   - radio-group-root 43 and checkbox-group-root 61: state `disabled` documented as "The
     `disabled` prop"; it is `field.disabled` (prop or the Field's), as Switch/Checkbox say.
   - use-native-checked.ts 24: `group` documented as "`RadioGroup.Item`"; CheckboxGroup.Item
     and CheckboxGroup.Parent use it too.

Estimated -150 comment lines without losing information.

## C16. Type tidiness

- `"horizontal" | "vertical"` declared six times: ToolbarOrientation (toolbar-root 10),
  RovingOrientation (use-roving-focus 10), ToolbarContextValue inline (toolbar-context 7),
  TabsOrientation (tabs-context 4), SliderOrientation (slider-root 54), ToggleGroupOrientation
  (toggle-group-context 4). Add `Orientation` to internal/types.ts and alias the public names to
  it (public names unchanged).
- `ref as RefCallback<HTMLElement>` (use-field-control 148): the `useCallback` result is already
  assignable; check with `pnpm typecheck` and drop.
- `...({ indeterminate: undefined } as object)` twice (checkbox 205, checkbox-group-parent 221):
  type the library layer as `Partial<ComponentPropsWithRef<"input">> & DataAttributes &
  { indeterminate?: undefined }` once (C2 helps).
- `fieldInputRef as Ref<HTMLInputElement | null>` (slider-thumb 131): type
  `SliderFieldWiring.inputRef` as `RefCallback<HTMLInputElement>` at the source.
- `NumberFieldSource` vs inline union: see C10.

## C17. Considered and rejected

- A shared `isDev` module (40 copies of `const isDev = process.env.NODE_ENV !== "production"`):
  the build is unbundled, and a per-module literal is what lets consumers' bundlers fold and
  strip dev branches without cross-module constant propagation. Keep the copies.
- A factory for Progress / Meter parts (Label/Track/Indicator/Value differ only in their data
  attributes): conventions 9.1 is one part per file, the Roots are directive-free Server
  Component parts, and each file is ~40 lines. The shared arithmetic already lives in
  internal/range-value.ts. Leave as is.
- Accordion's own arrow-key handler (accordion-root 159-189, 355-366) vs `useRovingFocus`:
  accordion triggers are all Tab stops (APG Accordion), not a roving group. Different pattern.
- `useUntilFound` has one caller (tabs-panel); fine, it is the documented single home of the
  `hidden="until-found"` workaround.

## Suggested order

1. C10, C8, C7, C15 (stale + history comments), C16 — mechanical, low risk.
2. C3, C4, C12 — new small internal helpers.
3. C2, C6, C11, C13 — component wiring.
4. C9 pure extractions, then C5, then C1 (largest, most timing-sensitive).
C14 waits for a PO decision.
