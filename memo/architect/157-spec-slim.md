# #157: slimming the design docs (working notes)

Branch `docs/157-spec-slim` (pushed, not merged). Proposal: `memo/architect/refactor-audit.md`
section 3. User decisions: issue #157, comment of 2026-11-24.

## Method

- `design/CHANGELOG.md` is the archive: one part per source document and step, text verbatim,
  headings and section numbers as written. `scripts/check-design-refs.mjs` skips it.
- A numbered section that leaves a document keeps its heading and a one-line stub, so "design
  14" / "popover.md 14.2" in a source comment still lands somewhere (the stub names the
  changelog part). 56 stubs. Unnumbered tails ("Amendment: ...", "Review corrections") leave
  nothing.
- Before a tail moved, its outcome was checked against the body and written in where missing.
  Most amendments already said "edited in place"; the ones that did not were #148 (requests and
  facts: every overlay doc still called a dismissal an `openChangeAction(false)`
  "notification"), #146 / #81 in button.md, and #147 (the consumer CSS recipe).
- Body text that the fold replaced (superseded rules, "Amended ..." notes inside sections,
  stale pseudo-code) was removed, not moved; `git show bda96ce:design/...` has it. The Status
  paragraphs of the component docs are archived as the last part of the changelog.
- Source comments: only the citations of `overlay-open-change.md` changed (16 files, comments
  only; one test title keeps the old citation because a title is code).

## Lines, before and after

| Document | Before | After |
| --- | --- | --- |
| conventions.md | 3487 | 3161 (264 of them are the new 3.9) |
| accordion.md | 1008 | 878 |
| button.md | 1571 | 1005 |
| checkbox-group.md | 1262 | 1014 |
| checkbox.md | 551 | 484 |
| combobox.md | 2381 | 1335 |
| context-menu.md | 1455 | 1003 |
| dialog.md | 2731 | 1814 |
| field-form.md | 1601 (1608 after feat/157-align) | 1347 |
| menu.md | 1678 | 1166 |
| number-field.md | 1497 | 1169 |
| overlay-open-change.md | 949 | 21 (stub with a section map) |
| popover.md | 2474 | 1486 |
| progress.md | 1168 | 899 |
| radio-group.md | 1074 | 880 |
| select.md | 1122 | 886 |
| slider.md | 1512 | 1222 |
| switch.md | 980 | 782 |
| tabs.md | 1029 | 846 |
| toast.md | 1585 (1591 after feat/157-align) | 1279 |
| toggle-group.md | 1411 | 1035 |
| toggle.md | 806 | 644 |
| tooltip.md | 1762 | 985 |
| **Rules total** | **35,094** | **25,341** |
| CHANGELOG.md | 0 | 10,645 |

## Not done: conventions.md is at 3,161 lines, not 1,500 to 1,800

What was done there: the Status list and both question logs moved out; every issue number,
date, decision marker and review reference removed from the Decisions table and sections 1 to
13; 2.4, 2.5.1, 2.6 lost their status and "what this replaces" text; 3.5's light-dismiss bullet
restructured; 9.1 completed; 13.5 moved; 3.9 added (the overlay rule).

Why it is not shorter: removing history does not remove lines, because the history was inline
in sentences that also carry a rule. Reaching the target is a rewrite of the rules themselves,
not a cut, and it needs a decision about what leaves the document. Candidates, with a rough
size, for a follow-up step:

- 1.1's part vocabulary (26 rows, 10k characters) repeats what each component doc's anatomy
  says; keep the names and one line each (about -30 lines but -7k characters).
- 3.5's "Residual browser path" table cell is one 5k-character sentence listing every
  component's reset / hydration path; it belongs in 3.8 as a list, and half of it restates 3.8.
- 3.8 (111 lines, 20k characters) is the internal hook contract of five hooks; it could move to
  the hooks' own doc comments with a short rule list left here.
- 2.5.1 (about 140 lines) and button.md 16 / 18 state the same `whilePending` rule twice; one
  of them should be the pointer.
- 3.9 and the bullets of 3.5 about mixed ownership and cancelable steps overlap.
- 5.1 (140 lines), 7.3 (112 lines), 13.2 (124 lines) carry probe evidence and rejected options
  next to the rule; the evidence could move to `docs/research/` or the changelog.
- 10.1's coverage table has cells of 2k+ characters that restate test files.

## Contradictions resolved

- toggle-group.md: `Toolbar.Button` as a part (decisions 1, 12 to 14, anatomy, 2.4 / 2.5
  examples, 3.4, 3.6 exports, state table, keyboard / ARIA / ViewTransition tables, 11.5, 12,
  13). Now `Button` from `@funstack/ui/button`; 3.4 and 11.5 keep their numbers with the
  current rule. Code agrees (`toolbar/index.ts`).
- toggle-group.md 11.5 and button.md decisions 3 to 5, section 5, 6.4: "a second click is
  ignored" as the unconditional rule. Now `whilePending`, default `"run"` for Button. Code
  agrees (`use-action-trigger.ts`: `ignoreWhilePending = false`).
- toast.md: `closeAction` in the body and the heading of 9; "since #81" guard text; the
  "N/A since #81" and `closeAction` rows were in the test plan, which moved. Now `onClose` and
  `whilePending` with the `closeOnSettle` default.
- popover.md, dialog.md, menu.md, combobox.md, context-menu.md: a dismissal described as an
  `openChangeAction(false)` notification with `data-pending` and a view transition (mode
  tables, close tables, Root props, state / error sections, view-transition tables,
  walkthroughs). Now a fact on `onOpenChange` (conventions 3.9).
- dialog.md 2.3, 2.5, walkthroughs 8 and 13: the stored dismissal (`dismissedWhilePending`)
  and the pseudo-code around it. Replaced by the rule (a dismissal during a pending part close
  is reported at once and supersedes it).
- popover.md decision 1, the mode table, 2.1, walkthrough 9: the Trigger as
  `commandfor` + `command="toggle-popover"` with `aria-expanded="false"`. Now `popovertarget`,
  no `aria-expanded`.
- popover.md 10.2, dialog.md 10.3, combobox.md 11: the consumer recipe
  `html:active-view-transition ... { transition: none }`. Now the library's cut.
- tooltip.md, accordion.md: status "proposed" for shipped components; tooltip 2.4 asked the
  product owner to confirm a reading that conventions 7.3 has since fixed.
- button.md 17.1: the Toast and Form.Submit rows follow feat/157-align.
- context-menu.md 3.2: a stray unclosed code fence (everything after it rendered as code).
- Dead file references: `toolbar/toolbar-button.tsx`, `internal/toggle-button-props.ts`,
  `internal/invoker-press.ts`, `report-superseded.ts`, `accordion-static.tsx`,
  `notifications.tsx`, `tabs-ids.mjs`, `platform-attributes.d.ts`, `index.mjs`. Gone from the
  rules (most were in moved sections); the lint check keeps it that way.

## Where the doc and the code might disagree (not verified against the code)

- conventions 2.4, last contract bullet: a latest rejection that arrives while its owner is
  hidden is reported and does not reach the boundary when the owner is shown again. The text
  said "a deliberate deviation from React, pending user confirmation (resolved question 43)".
  I kept the rule and dropped "pending user confirmation"; if the user never confirmed, this is
  still open.
- dialog.md 2.5: the apply-effect pseudo-code was replaced by three bullets written from the
  design text and the #148 / #156 amendments, not from `dialog-popup.tsx`.
- popover.md 2.5 keeps its pseudo-code with one comment changed; it predates #148 / #155 / #156
  (no `refusedFact`, no `inert`, no marker variable).
- button.md 5.1's click handler now includes `submittedWith.current = formAction` from section
  18.2; I did not compare it with `button.tsx`.
- "Docs page(s)" / "Documentation requirements" sections (button 14, progress 13,
  toggle-group 15, context-menu 12) were moved with the test plans. The user's list did not
  name them; they were instructions for a finished wave, so I treated them as not contract.

## Left over

- conventions.md length (above).
- Inline history that survives in component docs: "(review M3)", "(deviation B1)", "since
  #112" phrasing. Counts: about 17 "review" mentions each in number-field.md and slider.md, 12
  in select.md, a handful elsewhere; combobox.md has about ten "since / before #n". Harmless but
  not "current rules only".
- Component docs still cite their own moved sections by number ("the browser row in 13.2");
  the stubs make these resolve, the sentences could go.
- CHANGELOG.md is 10,645 lines in one file. The audit offered `design/history/` with one file
  per document as the alternative; splitting it is mechanical.
- CLAUDE.md does not mention `design/CHANGELOG.md` or the new lint step (I do not edit it).
