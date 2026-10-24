# Flaky form.test.tsx:415 (#120)

Symptom: CI run 40090869209 attempt 1, "a failed attempt from the focused, first invalid field
announces its message": after `user.click(submit())`, activeElement was the submit button.
(The run was re-run; `gh run view --log-failed` shows attempt 2. Attempt 1's log:
`gh api repos/uhyo/funstack-ui/actions/runs/<id>/attempts/1/logs` > zip.)

## Root cause

Not cross-file state from no-isolate (#107). A timing race inside the library's first-invalid
collector (`internal/focus-first-invalid.ts`):

- the batch for one submission attempt lived until a `setTimeout(0)`;
- the test makes two attempts (Enter in the field, then a click on Submit) with `delay: null`
  user-event, so nothing guarantees a timer runs between them. Only React's async `act` yields
  macrotasks (`setImmediate`), and whether Node's 1 ms timer is due by then is luck;
- when the timer had not fired, the click attempt joined the Enter attempt's batch, whose
  `activeBefore` was the field. Focus was now on Submit (not activeBefore, not a target), so
  `focusFirst` took the "something else took focus, don't fight it" bail.

Reproduced with `{ repeats: 400 }` on the test: about 40 bails out of 400 (instrumented
`focusFirst`). Shuffled seeds alone would rarely show it.

## Fix

A second `invalid` from an element already in the batch starts a new batch (one validation fires
`invalid` once per element, so it must be the next attempt). `collectInvalid` takes the event's
target as `source` (a group's members are distinct sources, so a radio group's several `invalid`
events stay one batch). The timer only clears its own batch. 2000 repeats pass.
Regression: field.test.tsx "a second attempt before the timer is its own batch" (two
`requestSubmit()` in one act with only microtasks between; fails deterministically without the fix).

Remaining gap: two attempts in one task with disjoint invalid sets still merge (not reachable by
a user; each attempt is its own task in a browser).
