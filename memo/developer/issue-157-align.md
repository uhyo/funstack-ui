# #157 behaviour alignments (B items 2, 5, 8 of memo/architect/refactor-audit.md)

Branch `feat/157-align`, one commit per item.

## 1. Accordion document order (572a80b)

- `accordion-root.tsx`: `sortedItems()` sorts the registry (`Map<details, value>`) with
  `compareDocumentOrder`; `fromSet` uses `sortByOrder` from value-set.ts (same as ToggleGroup /
  CheckboxGroup). Mount reconciliation iterates `sortedItems()`, so exclusive mode's winner is the
  first opened item in document order.
- `registeredValues()` is only called from the action wrapper (inside the transition), so reading
  the DOM there is fine.
- Tests: an Item inserted between existing ones (rerender `[a, c]` -> `[a, b, c]`), and an Item
  behind a Suspense boundary that resolves after a later sibling registered. Both failed before.
- design/components/accordion.md already said document order: no doc change needed.

## 2. disabled rule (ed75e3f)

- Toast.Action / Toast.Close: own `disabled` prop, `disabledButton(render, disabled).props`,
  `data-disabled`, `state.disabled`, click `preventDefault()` when disabled. Toast.Action merges
  the disabled `aria-disabled` with the pending-ignoring one.
- Form.Submit: narrower than Button on purpose. Native `disabled` on every submitter (no render,
  host `<button>`, host `<input>`, and a component, which `rendersButton` assumes renders a
  button). Only a host element of another tag (`<a>`, `<div>`) gets `aria-disabled` plus a
  cancelled click (handler installed only while disabled). Reason: the existing #83 test and
  JSDoc deliberately keep native `disabled` on a component render, since only native `disabled`
  stops a submitter before hydration and blocks implicit submission. Button (`type="submit"`
  with a component render) takes the aria branch instead; that inconsistency is pre-existing and
  could be raised with the architect if wanted.
- Docs: ToastPage (props rows, state, owned keys, data attributes), FieldPage (Form.Submit row,
  owned keys, aria-disabled data-attribute row). Design: toast.md 4 types + one paragraph,
  field-form.md 4.5 owned keys. There is no FormPage / form.md; Form lives in FieldPage and
  field-form.md.

## 3. Form.Root rejections (705be63)

- Failing tests first: superseded rejection (both settle orders), after unmount, while hidden by
  `<Activity>`: all four saw zero `reportError` calls before the fix.
- Fix: `latestRun` counter + `useConnected()`; in the transition, rethrow only when latest and
  connected, else `reportDropped`. Same rule as `useActionTrigger`. Did not move the transition
  into `useActionTrigger` (out of scope; audit mentions it as a possible follow-up).
- Docs: FieldPage bullet; field-form.md rejection bullet, test-plan row, N/A row.

## Results

typecheck, lint (2 pre-existing warnings), format:check, test:jsdom (3611 + 14), build, browser
(Chromium) for accordion / toast / form: all pass.
