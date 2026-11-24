# #154: per-submitter pending latch (2026-11-24)

Branch `fix/154-submitter-pending`. Implements `memo/architect/154-per-submitter-pending.md`
option L, as specified there.

- `button.tsx`: `useState` latch `submitted`, set during render when the form status names this
  Button (`named`), cleared during render when the status is idle. `formPending = named ||
  (status.pending && submitted)`. The `"ignore"` guard reads `formPending`, so A, B, A is
  cancelled.
- Tests (jsdom, `button.test.tsx` formAction block): both settle orders with two functions (plus
  "latch released" check: B alone afterwards leaves A idle); form's own action overlapping A;
  `"ignore"` A, B, A (also after `b` settled first); validation-cancelled A then B, recording every
  rendered `pending` of A (never true). The existing row 11 test changed: after `a` resolves, A
  stays pending (old assertion "only A clears" encoded the bug's sibling behaviour).
- Verified the four behaviour tests (and row 11) fail on the old `button.tsx`; the validation one
  is a guard and passes on both.
- jsdom note: `formNoValidate` on a `Button` did not bypass validation in jsdom; the test fills the
  required field instead.
- Docs: Button page (formAction row, data-pending row, behaviour summary, Forms paragraph,
  Overlapping submissions callout with the known limit, comparison table), the docs example
  comment, the playground text. Design: button.md 2.2, 6.2 (formula, rationale, known limits),
  6.4 table, walkthrough 9, 15.3 sketch note, 18.3, test row 11; conventions 2.7. SKILL.md did
  not restate the rule, unchanged.

## Review fixes (memo/reviewer/review-154.md)

- F1: `formPending` gated on `typeof formAction === "function"` as a whole; test switches A to a
  URL `formAction` and to `action` while latched (not pending, not `aria-disabled`, click not
  cancelled). Both cases fail without the gate.
- F2: button.md 29, 50, 135-136 ("from its own submission"), JSDoc sketch, 6.2 formula.
- F3: docs callout: "the Button stays pending until every overlapping submission has settled".
