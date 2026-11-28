# Review: dev/208 (#208 Form.Root error / Form.Error, #209 MultiSelect.Value placeholder, #210 details.valid)

Branch `origin/dev/208` at 3fc48aa1, against design `design/CHANGELOG.md` (dogfood #208-#210
entries), conventions 2.2, field-form.md 3.7, 4.7, 7.5, 11.9.

Verdict: **acceptable with minor fixes.** No blocking defect found.

Ran: typecheck OK; jsdom `field/details-valid`, `form/*`, `multi-select` (195 passed); browser
`details-valid` + `form` in Chromium and Firefox pass (WebKit would not launch on this machine,
an environment problem, not the branch).

## Findings (by severity)

### Medium

1. `form/form-root.tsx` settle, focus-move branch: `announce(form, formMessages)` runs *before*
   `first.target.focus()`. A focus change usually flushes the screen reader's speech queue, so
   the form-level text is likely cut off by the focus announcement. Focus first, then announce
   (a `normal` ariaNotify queues behind the focus speech). Record for the human SR pass if kept.
2. Merge: `design/CHANGELOG.md` conflicts with master (master appended the #207 entry and the
   11.9 amendment 83cc1cff). The "implemented" entry must go at the end on merge (append-only),
   and needs a blank line before its heading (it is glued to "…a human task."). Deviation 1 is
   already resolved on master by 83cc1cff; the entry's "left to the architect" is stale.

### Minor

3. Computed controls ignore `disabled` in the native half: CheckboxGroup (`validOf`), MultiSelect,
   Combobox return `false` for a `required` + `disabled` control with an empty next value, while
   the read controls return `true` (a disabled element is barred, `valueMissing` false). Only
   reachable through a form reset (`"platform"`) of a disabled control. Inconsistent across
   controls; add `!disabled` to the predicates (or document).
4. `form/form-error.tsx`: `useRender` resolves function `children` / `className` / `style` /
   `render` eagerly, so they are called with `messages: []` while the part renders `null`, against
   the doc "Never empty while the part renders". A consumer `({ messages }) => messages[0].x`
   crashes with no error. Render the element in an inner component only while non-empty, or
   reword the doc. (Field.Error has the same shape but its state is never contract-violating.)
5. Tests: the browser click-time row covers controlled *uncheck* only; the case that depends on
   React's post-handler restore is controlled unchecked -> click (`valid` true). RadioGroup has no
   browser click-time row although the design feasibility table asked for one for all three.
6. Tests: `form.browser.test.tsx` "a real settle" guards the `ariaNotify` assertions with
   `if (notify !== null)`, a silent skip; CLAUDE.md asks to branch on `engine.ts` feature checks
   and assert. The "message is in the accessibility tree" assertion is approximated by
   `toBeVisible`.
7. Skill: "call `useActionState` inside the Popup (library mode)" does not say how to get library
   mode; add `<Dialog.Root defaultOpen={false}>` (the trap is the whole point of 11.9).

### Checked, fine

- `valid` timing: Checkbox/Switch read the input in the click (already toggled), Radio the first
  `willValidate` radio, Select in `change`, TextField the draft element; reset paths read after
  the microtask/reset; mount reconciliation reads the pre-hydration DOM. NumberField: every
  dispatch (typed commit, step, `"dismiss"` revert) passes `onStep` -> `syncHidden(next)` before
  `details`, so the "no reorder" deviation (3) is correct.
- `validateNext` mirrors `writeSlot` (same owner, FormData, `readOnly` skip). Patches use the
  Field-resolved `name`; Combobox single patches `""` for null like its hidden input.
- No double announcement: no live region on Form.Error; one `announce` per settle, merged when
  focus is already on the field; nothing at mount; count-based presence handles several parts.
- `hasFormError` used by both autoReset and Dialog.Form settle.
- #209 matches B.7 including `placeholder={null}`.
- Types: deviation 2 (not on `@funstack/ui/types`) is right per conventions 9.2. Deviation 4
  (`requiredRef`) is acceptable; the layout effect without deps writes each commit.
- Docs/skill match the code (FieldPage props tables, 11.9 recipe with `defaultOpen={false}`).
