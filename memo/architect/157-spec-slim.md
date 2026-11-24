# #157: slimming the design docs (working notes)

Branch `docs/157-spec-slim`. Proposal: `memo/architect/refactor-audit.md` section 3. User
decisions: issue #157, comment of 2026-11-24.

## Method

- `design/CHANGELOG.md` is the archive: one part per source document and step, text verbatim,
  headings and section numbers as written. `scripts/check-design-refs.mjs` skips it.
- A numbered section that leaves a document keeps its heading and a one-line stub, so "design
  14" / "popover.md 14.2" in a source comment still lands somewhere (the stub names the
  changelog part). Unnumbered tails ("Amendment: ...", "Review corrections") leave nothing.
- Before a tail moves, its outcome is checked against the body and written in where missing.
- Reserved until `feat/157-align` is merged: `accordion.md`, `toast.md`, `field-form.md`.

## Baseline (lines, master at c658d0e + 1)

conventions 3487; accordion 1008; button 1571; checkbox-group 1262; checkbox 551; combobox
2381; context-menu 1455; dialog 2731; field-form 1601; menu 1678; number-field 1497;
overlay-open-change 949; popover 2474; progress 1168; radio-group 1074; select 1122; slider
1512; switch 980; tabs 1029; toast 1585; toggle-group 1411; toggle 806; tooltip 1762. Total
35,094 (design docs only).

## Steps

1. Pure history: conventions Status paragraph, Resolved questions (45), Open questions;
   "Conventions feedback", "Questions for the product owner", "For the product owner",
   "Cross-component", "Recommendations" and "Open questions" tails of 17 component docs.

## Found on the way

- `context-menu.md` 3.2 opens a stray code fence (` ```ts ` before "**Reset to `anchor`**");
  everything after it rendered as code until the next fence. Fixed in the context-menu step.
