# #157: slimming the design docs, second pass (working notes)

Branch `docs/157-spec-slim-2` (pushed, not merged), on top of master 92fe01d. First pass:
`memo/architect/157-spec-slim.md`. Review that asked for the citation check:
`memo/reviewer/review-157-spec-slim.md` (L7, L8).

## Result in one line

`design/conventions.md` went from 3,192 to 3,018 lines (284 k to 257 k characters). The target
of 1,500 to 1,800 lines is **not** reached, and cannot be by rewriting alone; see "Why the
target is still far" below.

## Method

- Each rewritten section was replaced whole, and the text it had was appended **verbatim** to
  `design/CHANGELOG.md` under the new entry "2026-11-24, #157: conventions.md, second slimming
  pass" (one `###` part per section, with the section's heading). Nothing was dropped: where the
  short text and the archived text disagree, the short text is the rule and the archive shows
  what was meant.
- Section numbers and the numbered rules that the source cites did not move (3.8 rules 1 to 9,
  2.3 items, 3.9.x). 3.9 was not touched (the #159 developer may be editing it), nor dialog.md.
- Where a section restated a helper's algorithm it now states what the helper guarantees and
  names the file. Checked against the code before pointing at it: `use-controllable-action.ts`,
  `use-action-trigger.ts`, `use-pure-trigger.ts`, `use-step-commit.ts`, `render-element.ts`
  (`disabledButton`, `pendingAriaDisabled`, `cancelClick`), `use-form-reset.ts`
  (`useResetTarget`), `use-native-group-reconciliation.ts`, `css-transition-cut.ts`.
- Scratch files must not end in `.md`: a PostToolUse formatter hook rewrites Markdown written
  with the Write tool (padded tables, `_emphasis_`, reformatted CSS in fences). `design/` is
  excluded from oxfmt, so the documents keep their own style; I wrote fragments as `.txt`.

## Lines, before and after

| Document | Before (92fe01d) | After | Characters before / after |
| --- | --- | --- | --- |
| conventions.md | 3192 | 3018 | 283,902 / 257,080 |
| combobox.md | 1335 | 1331 | |
| number-field.md | 1164 | 1157 | |
| select.md | 886 | 886 | |
| slider.md | 1217 | 1213 | |
| toast.md | 1280 | 1279 | |
| progress.md, radio-group.md | 899, 880 | 899, 880 | one cross-reference each |
| CHANGELOG.md | 11005 | 12372 | |

Per section of conventions.md (lines / characters, measured heading to next heading):

| Section | Before | After | What changed |
| --- | --- | --- | --- |
| 1.1 (the part table) | 80 / 9,973 | 81 / 8,271 | one line per name; per-component detail is in each anatomy |
| 1.2 (the `type` / `disabled` bullet) | 118 / 8,981 | 115 / 8,428 | the `disabledButton` rule as a nested list |
| 2.2 | 119 / 8,505 | 111 / 8,079 | `createActionDetails` named, not quoted |
| 2.4 Errors | 112 / 7,314 | 98 / 6,365 | probe evidence out; bullets merged |
| 2.5 with 2.5.1 `whilePending` | 178 / 13,640 | 162 / 12,273 | naming rationale and the Status column out; mechanics point to button.md 5, 16, 18 |
| 2.6 | 89 / 6,352 | 81 / 5,527 | "why a handler name" shortened; rules as a list |
| 3.4 shared hook | 166 / 9,524 | 101 / 6,888 | the 64-line sketch of the hook is gone; guarantees and helper names |
| 3.5 | 151 / 18,079 | 177 / 15,389 | the 4.5 k-character table cell is a list (more lines, fewer characters) that points to 3.8 rule 6 for the reset target |
| 3.8 | 112 / 20,082 | 94 / 13,279 | hook table is name / users / one paragraph; rules 1 to 9 kept |
| 5.1 | 140 / 11,608 | 132 / 9,902 | measurements and the cut's steps out (research note, `css-transition-cut.ts`) |
| 7.2 | 37 / 2,244 | 30 / 2,172 | the tsdown config named, not quoted |
| 7.3 | 111 / 7,676 | 95 / 5,671 | bundle numbers, bug numbers and the #94 story out |
| 12 | 81 / 6,551 | 71 / 5,173 | Fizz evidence out (`docs/research/interaction-wave11.md` 2.4) |
| 13.2 | 124 / 9,912 | 96 / 6,647 | engine probe evidence out |

## Why the target is still far

A rewrite that keeps every rule saves 10 to 25 percent of a section, not half: these sections
are rules nearly sentence by sentence, and turning a dense paragraph into a list can add lines
while it removes characters (3.5). What is left, by size: 3.9 (264 lines, not touched), 3.5
(177), 2.5 with 2.5.1 (162), 5.1 (132), 2.2 (110), 9.1 (110, the index of `internal/`), 1.2
(115), 3.4 (101), 2.4 (98), 13.2 (96), 3.8 (94), 7.3 (93).

The realistic way to 1,500 to 1,800 lines is a **split**, which is a structure decision and
not mine to take alone:

- `design/overlay-open-state.md`: 3.9 (264 lines) plus the three traps of 3.5 (60).
- `design/internal-hooks.md`: 3.4, 3.8 and the file index of 9.1 (about 300 lines). These are
  contracts for implementers, not conventions a component designer chooses between.
- `design/placement.md`: 13 (215 lines) and 12 (69).
- `design/testing.md`: 10 (70 lines, 18 k characters).

Each would leave its heading and a stub in conventions.md ("Moved to `design/<file>.md`"), and
`scripts/check-design-refs.mjs` would have to treat that stub like the changelog one (today it
only recognises "Moved to `design/CHANGELOG.md`"). That brings conventions.md to about 1,950;
the Decisions table (7.8 k characters that repeat sections 1 to 13) and 2.2's serialisation
detail would cover the rest.

## Doc / code disagreements found

- **7.2 quoted a `tsdown` config with five entries** (root, toggle, tabs, accordion, tooltip);
  `packages/ui/tsdown.config.ts` lists every component, `csp` and the skill-installer bin. Fixed
  by naming the file instead of quoting it.
- **3.8's tables under-listed users.** `useNativeGroupReconciliation` is also called by
  `NumberField.Root` (`number-field-root.tsx`), and `useNativeChecked` by `CheckboxGroup.Item`
  and `CheckboxGroup.Parent`. Added.
- **3.4 said the pure triggers are `Dialog.Close`, `Popover.Close`, `Menu.Item`**; the code
  (and 2.5.1) also has `Button` and `Toast.Action`, and the parts with `whilePending` go
  through `usePureTrigger`, which 3.4 did not mention. Fixed.
- **3.4's sketch had drifted from the hook**: the real options are `controlled`,
  `defaultValue`, `initialValue`, `action`, `transitionTypes`, `reducer`, `warn`, and the hook
  returns `latestInFlight`, `adopt`, `adoptFact`, `epoch` as well. The sketch is gone.
- **`render-element.ts` cited "progress.md 14.1"**, which was item 1 of the archived
  implementation notes and never a heading, and said "a directive-free part cannot `useMemo`",
  which conventions 7.1 contradicts (`useMemo` is in React's `react-server` export list). The
  comment now cites progress.md 8.1 and makes no claim about `useMemo`.
- **`dialog.browser.test.tsx` cited "design 11.10"** for walkthrough 10 of section 11.
- Not resolved, flagged: conventions 2.4 keeps the first pass's open point ("a rejection that
  arrives while hidden does not reach the boundary when shown again: a deliberate deviation
  from React"), which was once "pending user confirmation".
- Not resolved, flagged: `tooltip.md` is full of "wave 11 / wave 12, #93, the amendment at the
  end" (25 "wave" mentions) and its tables were reformatted with padding by some formatter;
  `context-menu.md` has 20 "wave" and 17 "deviation" mentions; `field-form.md` 17 "review".
  Out of this pass's scope (the task named number-field, slider, select, combobox).

## Citation check (review L7)

`scripts/check-design-refs.mjs`, run by `pnpm lint`, has a second check: a section citation in
`packages/*/src` (`.ts`, `.tsx`, `.mts`, `.mjs`, `.css`) must resolve.

- Forms: `<doc>.md 3.4`, `<doc>.md section 3`, `<doc>.md, section 3`, `conventions 3.4`, lists
  (`button.md 16 / 18`, `popover.md 2.3, 10.2`, `4.1 and 4.2`), across a comment's line wrap.
  Also `design 14` inside a component folder, checked against that component's document
  (`field` and `form` to field-form.md, `meter` to progress.md, `toolbar` to toggle-group.md,
  `menu` to menu.md or context-menu.md). `design N` in `internal/` and `__tests__/` is not
  checked: the document is not named.
- `<doc>.md` is `design/conventions.md`, `design/components/<doc>.md`, else
  `docs/research/<doc>.md`; a path picks the file; `memo/` and the changelog are skipped.
- Resolves: a heading with that number; or the nearest existing numbered ancestor is a stub
  ("Moved to `design/CHANGELOG.md` ..."); or the document has no numbered heading
  (`overlay-open-change.md`).
- Result on the tree: 1,079 citations, all resolve after two fixes (above). Tested by planting
  eight bad citations in a scratch source file: all eight reported, exit 1.
- Gaps: "section 11 walkthrough 10" style item numbers are not checked (only headings);
  citations between design documents are not checked (only from source); a citation such as
  `button.md 5.2` in a comment is read as the design document even if the author meant
  `docs/research/button.md` (write the path).

## Inline history (review L8)

A script removed whole parentheticals that only point into history ("(review M2)",
"(deviation 6)", ", #145)"), 75 places in number-field, slider, select and combobox; about 35
more were edited by hand where the sentence carried a reason worth keeping. In conventions.md:
the L8 items ("since #148", "review M1", "wave 9, 5fc05d5") and a dozen like them. Left alone:
issue numbers that name open work (#34, #52, #77, #89, #91, #92, #124), dialog.md's
"wave 9, 5fc05d5" (not touching dialog.md), and `// conventions 3.8 (#67)` inside a code fence.

## Left over

- The split above, if the line target matters.
- 10.1's long cells (Placement, Action naming, Re-entry: 2 k characters each) restate test
  files; 9.1 repeats each helper's header comment.
- Inline history in tooltip.md, context-menu.md, field-form.md, menu.md, dialog.md.
- CLAUDE.md still does not mention `design/CHANGELOG.md` or what `pnpm lint` checks in
  `design/` (the user's file).
