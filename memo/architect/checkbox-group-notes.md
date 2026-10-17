# Architect notes: CheckboxGroup (#33), 2026-10-17

Working notes behind `design/components/checkbox-group.md`. Not a spec.

## Facts checked

- **react-dom 19.3.1 `restoreControlledInputState`**: the same-`name` walk (and the "Mixing React
  and non-React radio inputs with the same `name`" throw) is inside `if ("radio" === props.type
  && null != internalInstance)`. A checkbox restore touches the target only. So RadioGroup's
  "partial hydration unsupported" rule (conventions 3.8 rule 3, radio-group.md 5.1, #34) does
  not apply to a checkbox group; late Items only need the `onItemMounted` reconciliation that
  the shared adapter already has.
- **ARIA 1.2 `aria-required` "Used in Roles"**: checkbox, combobox, gridcell, listbox,
  radiogroup, spinbutton, textbox, tree (inherits into columnheader, rowheader, searchbox,
  switch, treegrid). `group` is not there, so a fieldset-based checkbox group cannot carry
  `aria-required` the way RadioGroup's `radiogroup` does. The per-Item native `required`
  (which maps to `aria-required` on role `checkbox`) is the only ARIA-valid announcement.
- **APG "Checkbox Example (Mixed-State)"**: checked → all controlled boxes checked; unchecked →
  all unchecked; mixed → "the controlled checkboxes return to the last combination of states they
  had when the tri-state checkbox was last mixed", or the page-load default if there was none.
  So the cycle is mixed → checked → unchecked → mixed (restored). Base UI's parent checkbox has
  no restore step (and no written rule for the click at all; its group takes `allValues`).
- `useNativeGroupReconciliation` compares with `Object.is` (`reconcile()`); a set value needs
  an `equals` option, which conventions 3.8 already anticipates for #33.

## Decisions I expect to be questioned

- **`Item` as a part, not `Checkbox` reading a context.** Checkbox §10 item 2 sketched the
  context approach "so the group needs no breaking change to Checkbox". It still needs none: the
  group simply does not use `Checkbox`. The context approach would leave `checked` /
  `defaultChecked` / `checkedChangeAction` on a member's props with nothing to do, and would
  capture an unrelated `Checkbox` placed inside the fieldset. RadioGroup already set the
  precedent of a per-group `Item`.
- **`Parent values` instead of `Root allValues`.** The Root cannot know the universe at render
  time without registration, and registration cannot produce correct SSR HTML for the Parent's
  `checked`. Putting the list on the Parent also gives section parents for free. The repetition
  (`values={ids}`) is the accepted wart.
- **`indeterminate` not suspended on the Parent.** Checkbox's `&& !pending` rule exists because
  the prop is consumer-owned and may lag the click; the Parent's value is recomputed from the
  optimistic set in the same sync render, so suspending would only hide a correct dash.
- **Dynamic native `required`.** Alternatives were `required` on every Item (wrong: all must be
  checked) and `setCustomValidity` (unlocalised message, extra prop, imperative re-apply). The
  dynamic attribute keeps everything native; its costs are the browser's wording and static
  over-blocking before hydration.
- **`details.added` / `removed`** rather than Accordion's `item` / `open`: one shape serves an
  Item, a Parent and a reset, and it is exactly what the controlled functional update needs.
- **`next` in document order.** A `querySelectorAll` per dispatch; matches `FormData.getAll`.
- **Pre-hydration Parent click is folded into the Root's mount dispatch** as the Parent's
  semantic. Without that, mount reconciliation would read the Parent's box as "checked" and the
  Items as unchanged, and either leave a lone checked Parent or (worse) have the Parent's own
  dispatch superseded by the Root's member dispatch (children's effects run first). The fold
  needs no change to the shared adapter: the Root's `readCurrent()` consumes the reports.

## Things to verify during implementation

- A Parent mount report arriving in the same commit as the Root's mount: `readCurrent()` is
  called from the Root's layout effect after the Parent's, so the report is there; confirm under
  StrictMode (effects re-run; the Parent must re-report, the Root must consume once).
- Dynamic `required` toggling and `:user-invalid` in each engine after a blocked submit, and that
  removing `required` clears `validity.valueMissing` synchronously (it should).
- Hydration: `required` differs between server (static) and client (same expression, same
  inputs) only if the optimistic set differs at hydration, which it cannot; no mismatch warning
  expected. A pre-hydration click changes DOM `checked`, not the attribute, so the attribute is
  still consistent with React's render until the platform dispatch re-renders.
- `fromSet` document-order read when an Item is inside a `render` wrapper component: it still
  renders an `<input name=…>` inside the fieldset, so the query finds it.
- Whether `toHaveAccessibleName` resolves a `<legend>` for a plain `fieldset` in jsdom (RadioGroup
  used `role="radiogroup"`; here the implicit `group` role).

## Status, 2026-10-17 (later)

Product owner accepted all eight questions as recommended. checkbox-group.md set to accepted
with the questions turned into recorded decisions; the seven conventions items applied to
`design/conventions.md` (1.1 `Parent`, 2.2 diff shape, 3.6 computed validity attributes, 3.8
`equals` and the radio-only scope of rule 3, 4.1 derived `indeterminate`, 5.3 types, resolved
question 20); checkbox.md §10 now points at the group design and withdraws its item 2.
