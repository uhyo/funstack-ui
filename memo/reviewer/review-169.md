# Review: feat/169-small-parts (c47d414e), #169 + #180

Reviewed 2026-11-26 against design/components/separator.md, field-form.md 4.3 / 7.4,
conventions 1.1 / 3.6 / 7.1 / 9.2, CHANGELOG entries, memo/developer/issue-169.md.

Verdict: merge after fixes (one design question, small docs gaps). No blocker.

## Runs

- pnpm test:jsdom: 93 files, 4311 tests pass.
- Browser (Chromium + Firefox locally; WebKit not installed): 62 files, 1155 pass, 47 skipped.
- Regression check: with slider-root.tsx and use-step-button.ts reverted to origin/master, all six
  new #180 rows fail (2 jsdom, 4 browser). Restored afterwards. The tests catch the bug.

## Findings

M1. Field.Control outside a Field: constant all-false state disagrees with the in-Field state.
- packages/ui/src/field/field-control.tsx:64-71, :123.
- Inside a Field, FieldState.disabled / required include the control's own props
  (field/field-root.tsx:451-452, `disabled || control?.disabled`). So
  `<Field.Control disabled className={(s) => s.disabled ? "off" : ""} />` gives "off" inside a
  Field and "" outside. The case 4.3 gives for the feature ("a consumer's own styled input built
  on Field.Control" working in a search box or table cell) is exactly the one that breaks.
  Standalone Checkbox / Switch etc. also report their own `disabled` in state.
- The code follows field-form 4.3 as written, so this is a design question, not a bug.
- Fix: outside a Field, state = `{ ...STANDALONE_STATE, disabled: disabled ?? false,
  required: required ?? false }` (memoise or two frozen-per-combination constants), still no
  data-* attributes. Amend field-form 4.3 + a CHANGELOG entry; update the
  "function props receive the constant valid, all-false state" row in field.test.tsx, the Field
  page note and the "Field.Control on its own" paragraph. invalid / validity / pending stay
  constant (no validation without a Field). A render element's own `disabled` is not seen,
  same as inside a Field.

L1. Roadmap "Behaviour changes" has no entry for this branch.
- packages/docs/src/pages/RoadmapPage.tsx:30 (the list; MultiSelect #165 has one).
- Upgrades will notice: Field.Control no longer throws outside a Field.Root; Slider and
  NumberField step buttons no longer move / dispatch inside `<fieldset disabled>`; new Separator.
- Fix: one `<li>` naming #169 and #180.

L2. Server Components page still says Progress and Meter are the only directive-free exceptions.
- packages/docs/src/pages/ServerComponentsPage.tsx:49-55.
- Fix: add Separator (directive-free, no context at all).

L3. FieldAddress example drops focus after a save.
- packages/docs/src/examples/FieldAddress.tsx:24 (`setEditing(false)`), :81 (Submit inside the
  fieldset).
- On success the fieldset is disabled while focus is on Form.Submit inside it: focus falls to
  body. Not during pending, so the stated rule holds, but the example the page shows next to
  "do not drop focus" drops it.
- Fix: put the Submit row outside the fieldset (disabled={!editing} on it), or keep editing
  mode after save, or focus the "Edit the address" checkbox after setEditing(false).

N1. CHANGELOG: no blank line before the new `## 2026-11-26, #169 ...` heading
  (design/CHANGELOG.md, right after the `use-multiple-selection.ts` bullet). Renders, but the
  file's other entries are separated by a blank line.

N2. SKILL.md Separator line says decorative is "the only valid line inside a Combobox or
  MultiSelect listbox"; a Group boundary styled in CSS is the other spelling (separator.md 4).
  Soften to "the valid separator element inside ...".

N3. Separator server-render row `hydrates without a mismatch` (separator.test.tsx:157-167)
  never unmounts the hydrated root before `host.remove()`. Harmless now; keep a handle and
  `root.unmount()` in act for hygiene (the jsdom project shares one window, isolate: false).

## Checked, no finding

- Separator: `<hr>`, implicit separator role, aria-orientation both values, decorative
  -> role="none" with aria-orientation removed (owned-layer undefined), role kept from a render
  element while not decorative, data-orientation always, no children / role in the type, not
  focusable. Directive-free: no hook, no context, renderElement + mergeRenderRef; directives
  test rows (file list + import graph) cover it. Subpath in package.json / tsdown / index.ts.
- Field.Control inside a Field: unchanged (same owned layer; `id` now destructured from typed
  props instead of a cast, same warning). Outside: libraryProps undefined, id / name / disabled /
  required moved into pass-through so a render element's own win; useFieldControl returns the
  own props and a no-op ref outside. Other parts still throw.
- #180 Slider: beginGesture bails before preventDefault / capture / focus when any registered
  range input matches :disabled; covers Track and Thumb (both call beginGesture). Read at press.
- #180 NumberField: inheritsDisabled checks the button and the visible input, so a
  render={<span />} button is covered; the disabled path preventDefaults pointerdown (no focus
  theft); the no-pointer click path bails too. data-disabled / state unchanged.
- No other behaviour changed in the source diff.
- Props tables (Separator page, Field.Control id row) match the TypeScript declarations.
- Sidebar: new "Layout" group is just a new `group` value in navigation.ts; route added.

## Open edge: Combobox / MultiSelect option in an already-open popup, fieldset disabled later

Real by reading, not reproduced (my probe could not be run from this sandbox). Options are
divs, never disabled; acceptSingle / acceptMultiple (combobox-root.tsx:900, :923) check only
the prop / Field `disabled`. Whether the popup survives depends on the engine: if disabling the
focused Input fires blur, `leave()` (combobox-root.tsx:1044) closes the listbox because the
prop is still false, and the edge is gone; the HTML focus fixup rule fires no blur, so in an
engine that follows it the listbox stays open and an option click dispatches
valueChangeAction on a disabled control. Hover / pointer on options is also live.
Trigger: programmatic disable while open (timer, server push, or another form's pending state).
Low severity; worth a low-priority issue in this repo: "Combobox / MultiSelect: option click
in an open popup dispatches after an ancestor fieldset becomes disabled (#180 follow-up)",
asking first for a three-engine browser row, then the same rule (bail in accept* when the
Input / Trigger matches :disabled, and close the popup).
