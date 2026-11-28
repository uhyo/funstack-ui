# Consistency alignment, design part (#199), working notes

2026-11-28. Branch `design/alignment`. The record is the entry "2026-11-28, #199: consistency
alignment, one standard per topic (design)" in `design/CHANGELOG.md`: decisions, breaking
changes, open questions, and the checklists for #200 / #201 / #202.

Things to remember when the code comes back for review:

- No source file was changed. Code comments that cite sections still resolve (no heading was
  renumbered; 3.10 and 9.5 are new).
- Conventions 4.1 no longer lists emitters. A script like `check-design-refs.mjs` could compare
  the `data-*` attributes each part writes with the members of its `State` (rules 1 and 2);
  not written.
- The `whole` option of `useControllableAction`'s dispatch stays for Accordion's mount
  reconciliation, although `details` now carries the full diff and the reducer could replay
  it. Worth a look once #202 is in.
- Left unruled: a variant's state and details type names (`ComboboxMultipleRootState`,
  `ComboboxMultipleValueChangeDetails`), and `value` / `values` in one state (X-L6).
- The docs site and the skill still say the old things; they are the technical writer's half
  of #199 and each code issue's own pages.

Answered the same day (in the CHANGELOG entry, "Questions answered"): the triggers lose
`transition` too (rule: all rendered state optimistic); Combobox `multiple` Escape clears the
search text; file ownership per the checklists confirmed; X-L2 assigned.
