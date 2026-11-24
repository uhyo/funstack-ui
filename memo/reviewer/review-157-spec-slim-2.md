# Review: #157 second spec-slim pass (`docs/157-spec-slim-2`, 7e2a25b on 92fe01d)

Reviewed 2026-11-24 in a detached worktree of `origin/docs/157-spec-slim-2`. Architect notes:
`memo/architect/157-spec-slim-2.md`. First-pass review: `memo/reviewer/review-157-spec-slim.md`.

## Verdict

**Mergeable, with minor fixes.** None of them blocks the merge. No current rule is lost from
the twelve rewritten sections. Every pre-pass section is in the new CHANGELOG entry verbatim.
The CHANGELOG diff only adds lines. `pnpm lint` passes ("all 1079 section citations resolve")
and so does `pnpm format:check`. The citation check caught every planted citation in the forms
it claims to handle. The findings below are small accuracy points in 3.4 / 3.8, a stale header
comment in the script, and false negatives of the citation check that should be written down.

## What was checked, and how

1. **Verbatim archive.** A script pulled each section (13.2, 12, 7.3, 5.1, 3.8, 3.5, 3.4, 2.6,
   2.5.1, 2.4) out of `master:design/conventions.md` (92fe01d text) and tested whether it is a
   substring of the new CHANGELOG. 13.2, 5.1, 3.8, 3.5, 3.4, 2.6, 2.5.1 and 2.4 match exactly.
   12 and 7.3 differ only by the trailing `---` separator, which the archive replaces with the
   next part's heading. The 1.1 table part and the 1.2 bullet part go the other way (each
   archive block is a substring of the old file): both match.
2. **CHANGELOG add-only.** `git diff master...branch -- design/CHANGELOG.md` has 0 removed lines.
3. **Fidelity.** Old and new sections were read side by side, rule by rule. What was dropped is
   probe evidence, measurements, rejected options, history and implementation steps. Where
   per-part detail left 1.1 (`aria-controls` on Increment/Decrement, Progress's dangling
   `aria-labelledby`, ContextTrigger's data attributes, Field.Label dropping `for`), it is
   still in the component documents (number-field.md decision 9, progress.md 8, menu.md /
   context-menu.md 10, field-form.md). The 3.5 reset-target detail moved to 3.8 rule 6, and
   rule 6 has all four input kinds. The select reset result and the `validityElement` mirror
   are still in select.md and conventions 3.6.
4. **Code.** Read `use-controllable-action.ts`, `use-action-trigger.ts`, `use-pure-trigger.ts`
   and `tsdown.config.ts`. Grepped the callers of every 3.8 helper.
5. **History removals.** Read the word diff of all ~115 removals in number-field, slider,
   select, combobox, toast, progress and radio-group, about 30 of them closely in context.
   Every issue number that was removed is a closed issue (checked with `gh`), except #52 (see
   N1).
6. **Citation check.** Planted 15 citations in `packages/ui/src/toggle/zz-planted.ts`, ran the
   script, then deleted the file (the worktree was removed afterwards).

## Findings, by severity

### Low

**L1. 3.4 says `committed` is `controlled ?? internal`, which is wrong for a `null` controlled
value** (`design/conventions.md` 3.4, first bullet after the signature block).
The hook does `isControlled ? controlled : internal` with `isControlled = controlled !==
undefined` (`use-controllable-action.ts:150-151`). With `??`, a controlled `null` (RadioGroup
`value={null}`, NumberField `value={null}`) would fall back to internal state. This is the
nullish trap that 3.8 rule 1 warns about two sections later. The code's own JSDoc says
"`x ?? internal`" too (`use-controllable-action.ts:52`). Write "`controlled` when it is not
`undefined`, else internal state" in both places.

**L2. 3.4 contradicts itself about how the continuous controls reach `useActionTrigger`.**
The paragraph first says the steps go "through `internal/use-step-commit.ts`". The
`ignoreWhilePending` bullet then says "The continuous controls call `useActionTrigger`
directly". In the code, only `use-step-commit.ts:162` and `use-pure-trigger.ts:54` call it.
Slider and NumberField reach it through `useStepCommit`. Suggested wording: "call it without
`usePureTrigger` (through `useStepCommit`) and run every step."

**L3. The 3.8 table still leaves out some users.** The brief asked for these lists to be
complete:
- `useFormReset`: "the hooks below, Combobox". It is also called directly by `Select.Value`
  (`select/select-value.tsx:123`, the `<selectedcontent>` refresh) and by
  `CheckboxGroup.Parent` (`checkbox-group/checkbox-group-parent.tsx:196`).
- `resolveFieldDefaults`: "`useFieldControl`; `NumberField.Root`". It is also called by
  `Combobox.Root` (`combobox/combobox-root.tsx:278`).
The other rows match the callers: `useNativeChecked` (CheckboxGroup Item and Parent added),
`useNativeGroupReconciliation` (RadioGroup, CheckboxGroup, Select through
`useNativeSelectValue`, Slider, NumberField), `useFieldControl`, `useFieldValueChange`,
`useItemOrder`, `intendedValue`, `useFormOwnerEvent`, `useCheckableInput`,
`useFieldsetGroup` and `groupMemberProps`. The `onPlatformChange(next, event, path)`
signature also matches (`use-native-group-reconciliation.ts:37`).

**L4. The script's header comment contradicts its code** (`scripts/check-design-refs.mjs`,
header, check 2). The header says '"design 14" (a component's own document, with no file name)
is not checked either: the document is not named'. The code checks `design N` in every
component folder (`ownCitationPattern`, `ownDocuments`), and the planted `design 88` in
`toggle/` was reported. The architect memo describes the code correctly. Fix the header: only
`internal/` and `__tests__/` are skipped.

**L5. False negatives of the citation check.** Of the 15 planted citations, these 8 forms were
caught: `conventions 3.42`, `design/components/popover.md section 99.1`, `button.md 16 / 77`,
`design 88` in a component folder, a citation that wraps over a comment line, `[conventions
3.99](...)`, `conventions §99` and `button.md sections 5 and 99`. These 7 forms pass silently:
- **A document name that does not exist** (`popovr.md 3.4`): `citedDocument` returns `null` and
  the citation is skipped. This is the false negative that matters most, because a typo or a
  renamed document goes unnoticed. Today the only real hit is `refactor-test-safety.md 2.9` in
  `internal/use-roving-focus.test.tsx:180`, a memo cited without its `memo/` path. Suggestion:
  report a `<name>.md N` whose document resolves nowhere, unless it has a `memo/` path. Fix
  that one comment by writing the path.
- **A component name without `.md`** (`Popover 3.4`, `Menu 6.2`, `Toast 10.2`): 5 occurrences in
  the source today (`combobox-root.tsx:227`, `menu-gestures.ts:75`, `use-exit-animation.ts:14`,
  `dialog-popup.tsx:371`, `overlay-browser-suite.tsx:131`). All 5 resolve today.
  `dialog-popup.tsx:371` "as Popover 14.1" points into popover.md 14, which is a stub now. That
  is the same kind of stale pointer the architect fixed in `render-element.ts`.
- **A second number after prose**: in "design 11, walkthrough 10, and 12.5"
  (`dialog.browser.test.tsx:6`) only 11 is checked. 12.5 exists today.
- **Ranges** (`conventions 3.4-3.99`): only the first number is checked.
- **Parenthesised or postfix forms**: `popover.md (3.4)` and `section 99 of conventions`. Neither
  form occurs in the source today.
- **A backtick after the name** (`` `conventions.md` 99 ``). This form does not occur in the
  source today.
- **A letter suffix** (`conventions 3.99a`): the regex backtracks to `3`, which exists, so it
  passes. This is rare.
Add the first two gaps to the "Gaps" list in the architect memo, or to the script header.
Fixing the unknown-document case is worth the few lines it takes.

### Nits

**N1.** `select.md` (the reset walkthrough, about line 751): "(#52)" was removed, but #52 is an
open upstream issue. The architect memo says open-work numbers stay. A second #52 reference
survives at select.md:581, so nothing is lost. The removal is just inconsistent with the stated
rule.

**N2.** 5.1's table now writes `_under a new DOM element_` where the old text had
`*under a new DOM element*`. This is the formatter-hook artefact the architect memo describes.
It renders the same, but `design/` is not formatted, so the change is noise in the diff.

**N3.** 7.2 now describes `tsdown.config.ts` in prose. The prose leaves out the
`src/bin/skill-installer.ts` entry and the `exports.exclude` / `bin` options. Add "and the
skill-installer bin, excluded from the exports map", or say less: "see the file".

**N4.** slider.md 9.4 now opens "Accepted, including the dev warning ...", with no subject.
"This section is accepted, including ..." reads better.

**N5.** slider.md 7 (Direction): "(left to the browser, ArrowRight in Safari increases the
value ...)" is a little hard to parse. "(if left to the browser, ArrowRight in Safari would
increase ...)" makes the counterfactual clear.

**N6.** 3.5: the light-dismiss trap lost the reason why Combobox's Trigger writes
`popovertarget` only after hydration (a pre-hydration activation would open an empty,
mis-anchored popup). 7.4 is cited and holds the mechanism. The reason is still in 7.3's last
paragraph only as "the popup must be anchored to the input". This is acceptable.

## Remarks (no change needed)

- The old 3.5 said "Two traps" and listed three. The new text says "Three traps", which is a
  correction.
- 3.5's "adopted through the urgent action" became "urgent handler", which is right after #96.
- The `## 12. Shipped functional CSS` heading inside the CHANGELOG entry breaks the entry's
  heading levels. The first pass's archive set the same precedent (`## 14. Test plan` and
  others).
- Accepted losses of detail, all recoverable from the code comments and the archive:
  - 3.8 rule 3: the per-render token versus a `useRef` flag, and "a programmatic change while
    members are dehydrated is harmless".
  - `useFormOwnerEvent`: re-read after every commit, re-subscribe only on change,
    `useEffectEvent`. Rule 4 keeps the why; the how is now only in the file.
  - 3.4: "every pure trigger reads `whilePending` per render so the value is the one of the
    activation's render". `usePureTrigger` does it, and 2.5.1's "effective value" paragraph
    keeps the observable rule.
- `render-element.ts` and `dialog.browser.test.tsx`: both citation fixes are correct
  (progress.md 8.1 exists; dialog.md 11 and 12.5 exist).
