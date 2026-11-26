# Review: Combobox `multiple` with chips (#164)

Branch `feat/164-combobox-multiple`, head 43919d24. Reviewed 2026-11-26 against
design/components/combobox.md 15, conventions 1.1 / 2.5 / 5.3 / 11, the six decisions in the
issue comment and CHANGELOG, memo/developer/issue-164.md.

## Verdict

**Merge after fixes** (two medium findings, M1 and M2, both small). The set-valued contract,
the single-mode regression surface and the tests are in good shape.

## Runs

- jsdom + jsdom-isolated (after `pnpm build`): 83 files, 4005 tests pass.
- Browser, Chromium + Firefox, `src/combobox`: 144 pass, 4 skipped (`runIf` engine rows: CDP
  a11y tree is Chromium-only, one WebKit row). `combobox-multiple.browser.test.tsx` was run 3x
  with no flake. WebKit cannot launch locally (as for the developer); CI was green.
- typecheck, lint (design refs, layering), format:check: clean.
- Scratch probes (written, run, deleted; no source touched):
  - #151 case: add fr (pending), remove fr (pending), form reset to `["jp"]` (equal to the
    intended value) is dispatched; then add resolves, removal rejects: the final value is
    `["jp"]`. Correct.
  - Duplicates in `defaultValue` (`["jp","jp","fr"]`): normalised, the form posts
    `["jp","fr"]`. Correct.
  - Focused chip whose addition is rolled back (a superseded rejection): focus ends on the
    document body (M2).
  - Chip content `{v}` plus a ChipRemove holding an aria-hidden "×", value never seen by an
    Option, Backspace: announces `"TypeScript× removed"` (M1).

## Findings

### M1 (medium): the removal announcement's textContent fallback includes aria-hidden content
`packages/ui/src/combobox/combobox-root.tsx:788-792` uses `entry.element.textContent.trim()`.
`textContent` ignores `aria-hidden`, so the documented recipe (design 15.7 at
design/components/combobox.md:1728, `ComboboxChipRemoveProps.children` JSDoc at
combobox-chips.tsx:308, docs page row at ComboboxPage.tsx:685) does not work. The docs' own
live example (ComboboxTags.tsx) hits it: Backspace on the preselected "TypeScript" chip
(no Option mounted yet) announces "TypeScript× removed".
Fix: compute the fallback text skipping `[aria-hidden="true"]` subtrees and the ChipRemove
button (a TreeWalker, or clone and strip), or go with "pass `label`" and change the design and
docs to say only CSS content is safe. Add a jsdom row with an aria-hidden "×".

### M2 (medium): focus is lost when a focused chip is unmounted by anything except its own keys
Chip removal by the chip's own Backspace / Delete moves focus first (good). But a rollback of a
pending addition (latest or superseded), a controlled parent dropping the value, or a reset
while a chip has focus unmounts the focused element: focus goes to the body, no `leave` runs
(the text stays, nothing is committed under `allowCustomValue`), and a keyboard or screen
reader user is dropped at the document start. Design 15.6 only says a reappearing chip does
not take focus.
Fix: in Chip's registration cleanup (combobox-chips.tsx:238-242; a layout cleanup runs before
the host node is removed), when the chip element contains `document.activeElement`, move
focus to the next chip, else the previous one, else the Input, as the Backspace rule does.
Add a line to design 15.6 and a test (superseded rejection while focused).

### m1 (minor; the developer's point 5): Enter while an open is still committing submits the form
combobox-keyboard.ts:144-154. Same corollary as design 8, but in multiple mode the text is
never a value, so Enter with typed text never means "submit this". The common case is "type a
search, Enter to pick", and whether that does nothing or submits the form depends on whether
the open commit landed (the developer hit it in the browser rows). Suggested: with `multiple`,
when the text is not empty and the popover is intended open (`popover.optimistic` or the open
intent, not `:popover-open`), prevent the key and keep the text; keep the current rule when
the listbox is intended closed (the Escape-then-Enter race of design 8 is about closing, so it
is unaffected). If kept as is, say so explicitly in 15.6 (now only implied through design 8).
Not blocking.

### m2 (minor): a chip focused while an open is pending gets the listbox opened under it
combobox-root.tsx:1054-1058: `hideListbox` only hides a popup that is already `:popover-open`.
With a slow `openChangeAction` (or before the open commit lands): type, Home, ArrowLeft; the
chip is focused, then the open commits and shows a listbox that cannot be operated, which
15.6 rules out. Fix: in `chips.focusIn`, also drop a pending open (a dismiss intent or
`requestClose` when `popover.optimistic` is true).

### m3 (minor): the printable-key hand-over misses IME and AltGr
combobox-root.tsx:996 returns on `ctrlKey` before the switch, so AltGr characters (Windows
reports Ctrl+Alt) typed on a chip are lost; combobox-root.tsx:1041 requires
`key.length === 1`, so an IME start (`key === "Process"`, keyCode 229: any Japanese or
Chinese user with the IME on) and astral characters are lost too (focus stays on the chip,
nothing is typed). Fix: test ctrl/meta only for the navigation keys, accept
`getModifierState("AltGraph")`, and also focus the Input for `"Process"` / keyCode 229 (and use
`[...key].length === 1`). Add the IME case to the manual pass if no engine can automate it.

### m4 (minor): JSDoc and docs of shared props still describe only single mode
- `allowCustomValue` JSDoc (combobox-root.tsx:177-185: "empty text dispatches `null`",
  "reverts to the selection's label") and its docs row (ComboboxPage.tsx:325) do not mention
  the multiple behaviour (adds the text, Enter prevented open or closed, added on leave).
- `defaultInputValue` JSDoc (combobox-root.tsx:136-142) tells the consumer to pass the label
  with `defaultValue`; wrong with `multiple`.
- The props table type column for `value`, `defaultValue`, `valueChangeAction`, `announce`
  shows only the single types (ComboboxPage.tsx:261-279, 348); the multiple types are only in
  the descriptions. Show both, e.g. "`string | null`; `string[]` with `multiple`".

### n1 (nit): Chips keeps a consumer aria-label while its role is dropped
combobox-chips.tsx:113-118 drops the library's `aria-labelledby` when empty, but a consumer's
`aria-label` (design 15.7 names it as the alternative) stays on a role-less div, where naming
is prohibited (axe `aria-prohibited-attr`). Strip both while empty, or document it.

### n2 (nit): `Partial<ComboboxRootProps>` no longer spreads into `Combobox.Root`
`Partial` of the union is not assignable to either member (the tests switched to
`ComboboxSingleProps` for this reason). Consumer wrappers doing the same break at the type
level. Mention it next to the docs note "The props type is ... discriminated on `multiple`".

### n3 (nit): conventions 1.1 now has two "A second exception" paragraphs
design/conventions.md:123 and :127. Make the Combobox one "A third exception" (or reorder).

### n4 (nit): no Combobox test for the #151 rule
The equal-to-intended reset while in flight (use-multiple-selection.ts:113-121) is untested
here (CheckboxGroup has one). The behaviour is correct (probe above); add the row so a later
refactor of `reset` is caught.

### n5 (nit): a removal is announced before it is known to land
`announceRemoval` runs before the dispatch; a rejection brings the chip back silently.
Consistent with optimistic UI (the error goes to the boundary or `reportError`); say in 15.7
that no "restored" announcement is made.

## The developer's six points

1. Both selection hooks every render, the other idle: fine. `useMountFixed` keeps the mode;
   the idle hook gets undefined controlled/default props and no action, so it can neither warn
   about a controlled/uncontrolled switch nor dispatch. The cost is one `useOptimistic` and a
   few closures. After an (ignored, warned) mode switch the other mode's props are cast into
   the mounted mode's hook; acceptable for a dev-warned misuse.
2. Chip label snapshot in three places: correct, and each has a job. Option mount covers a
   preselected value learnt later; the layout effect covers values arriving from outside
   (controlled, reset) whose label is cached; the pick-time write saves one synchronous
   re-render (the layout effect would catch it too, since `labels.set` precedes it). The
   snapshot is never pruned; bounded by distinct values, harmless.
3. Leave rule: counting Chips as inside and closing on chip focus matches 15.6; moves between
   the Input and a chip keep the press tracking right (`inside` returns before `unwatch`).
   Gaps: m2 (pending open), M2 (focused chip unmounted).
4. `useComboboxForm` `resetValue(event)`: internal only; single mode computes the same target
   (`useResetTarget(valueProp, defaultValueProp)`) with the same `next === optimistic` guard as
   before. No behaviour change.
5. Enter before the open commits: m1.
6. Deviations: Chips owning onFocus/onBlur matches the Input owning them and the design table
   lists them; dropping `aria-labelledby` while empty is correct ARIA (n1 for the consumer's
   label); preventing Escape on a chip fits "Escape returns to the Input" and is verified in a
   modal Dialog on Chromium and Firefox. All three accepted.

## Conformance notes (no action)

- Patch reducer, replay of resolved changes, absolute (`whole`) reset with the diff, the #151
  rule, `removed` in value order, no-op parts filtered: match conventions 2.5 / 3.3 and
  CheckboxGroup; the shared value-action suite runs with a Combobox driver.
- Pending: Option / Chip / ChipRemove when optimistic and committed membership differ; Chips
  when the value action is pending; Input on the Root's pending. Matches 15.5.
- Hidden inputs: one per optimistic value, a nameless placeholder when empty, `hiddenRef` on
  the first; the form-owner subscription re-reads after every commit, so the element swap is
  safe. `required` rendered only while empty and `aria-required` always, in and out of a
  Field; the SSR row covers the pre-hydration attribute.
- Single mode: Option `pending`, Input `data-selected`, ArrowLeft/Right, Backspace, reset and
  the hidden input are behaviourally identical; the single tests changed only types.
- ARIA: `aria-multiselectable` only with `multiple`; list and listitem; chips tabindex -1;
  one Tab stop verified with the real keyboard.
- Transition types `fsui-combobox-select` / `fsui-combobox-deselect` per the 5.3 table, tested.
- Docs props tables match the TS declarations except m4; the SKILL.md entry is accurate.
