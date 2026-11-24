# Review: #154 per-submitter pending latch (branch `fix/154-submitter-pending`, 4797a2a)

Date: 2026-11-24. Verdict: **acceptable with minor fixes** (mergeable; the fixes are a one-line
gate and design-text touch-ups, none blocks).

## Verification

- Button jsdom tests: 68/68 pass on the branch. With `button.tsx` reverted to master, 5 fail
  (row 11 updated, both settle orders, form's own action overlapping A, `"ignore"` A, B, A).
  The validation-cancelled test passes on both; it is a guard against option T, fine as such.
- Button browser tests, Chromium: 14/14 pass (the change has no browser-only behaviour).
- `pnpm lint`, `pnpm format:check`, ui `typecheck`: pass.
- Own probes (jsdom, deleted afterwards): StrictMode overlap A/B, both orders: correct, A
  rendered a bounded number of times (no loop). Button outside a form: never pending.
  `useActionState` dispatch as A's `formAction` with B overlapping under `"ignore"`: A latched,
  third click cancelled, idle after both settle. `formAction` removed / changed to a URL while
  latched: see F1.

## Latch correctness

- Two render-phase updates are mutually exclusive (`named` implies `status.pending`), each is
  idempotent after one re-render: no loop. StrictMode double render: idempotent.
- Render-phase updates take the render lane and are discarded with an abandoned render, so the
  latch commits only with a render that showed `named`; it is cleared in the render where the
  form status reverts (the commit of the entangled transition). Consistent with React's
  derived-state pattern.
- Server Function: still a function on the client, identity-compared; `$$FORM_ACTION` and the
  rendered `formaction` are untouched (no wrapper). Outside a form `useFormStatus` is idle, so
  never latched. A Button that never submitted: only `named` sets the latch, so never pending
  (except the documented shared-function case).
- `"ignore"` guard reads `formPending`, which now holds through overlap; test covers A, B, A and
  A again after `b` settled. `aria-disabled="true"` holds while latched (asserted in row 11).

## Findings

### F1 (minor) The latch outlives a `formAction` that is no longer a function
`packages/ui/src/button/button.tsx:180`:
`const formPending = named || (status.pending && submitted);`
`named` is gated on `typeof formAction === "function"`, the latched branch is not. Probe: A
latched, then re-rendered with `action` instead of `formAction` under `"ignore"`: A shows
`data-pending` and `aria-disabled="true"`, yet a click runs `action` (the `action` path guards
on `useActionTrigger`'s own pending). So the Button announces "unavailable" while acting, an
a11y/state contradiction. With a URL `formAction` the latched Button keeps `data-pending` and the
`ignoring && formPending` guard cancels the navigating click, contrary to design 6.2 ("A string
`formAction` ... no pending, no guard"). Master had neither (its single expression was gated).
Contrived (prop switch mid-flight), but a regression and trivial to fix:
`typeof formAction === "function" && (named || (status.pending && submitted))` (or gate the
latched term). Worth a one-line test.

### F2 (minor, docs) Stale or loose design text
- `design/components/button.md:263`: the `formAction` JSDoc sketch still says "pending while its
  own submission runs (not while another submitter's does)"; the real JSDoc was updated.
- `design/components/button.md:135-136`: "pending from its click until ..." contradicts the
  rule (a validation-cancelled click never latches); say "from its own submission". The edited
  line is also left unwrapped (cosmetic).
- `design/components/button.md:29` and `:50` (decision summary, formula row) still state the
  bare `status.action === <fn>` comparison / "own submissions only"; add "(latched, 6.2, #154)"
  or leave as history, but row 50 reads as the current formula.

### F3 (nit) Docs callout wording
`packages/docs/src/pages/ButtonPage.tsx:339-342`: "both stay pending" lists `Form.Submit` and
"Enter in a field" as the other submitter; for those "both" is the Button and the form channel.
Accurate enough; optional rephrase ("the Button stays pending until every overlapping
submission has settled").

## Conformance

- Vision / conventions 2.7: still the one allowed own-`formAction` reading of the channel; no
  wrapper, no new prop, transitions untouched, pending exposed through the same state.
- Conventions 2.7 text, button.md 6.2 / 6.4 / walkthrough 9 / 18.3 / row 11, docs page props
  table, data-attribute row, behaviour summary, callout, example comment and playground all
  state the new rule consistently. SKILL.md does not restate the rule (checked).
- Known limits (`requestSubmit` twice in one task, shared function) are documented in design and
  docs.
