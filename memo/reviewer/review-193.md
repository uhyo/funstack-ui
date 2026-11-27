# Review: #193 Field edit fix (fix/193-combobox-field @ 354cda81)

Verdict: **acceptable with minor fixes** (no must-fix).

## Verified

- New rows fail on the old code (field-root.tsx + use-server-error-visibility.ts reverted):
  browser 11/30 fail in Chromium+Firefox run (all Chromium rows for controlled controls + the
  server-error row), jsdom 6/6 new rows fail. All pass on the branch.
- Branch: field/, form/, combobox, otp-field, select, number-field, checkbox, slider,
  multi-select browser tests pass in Chromium and Firefox (418 passed). jsdom suite passes except
  directives.test.ts (needs `pnpm build`, unrelated). typecheck, lint, format:check pass.
- WebKit: not runnable locally (host libs missing); CI must cover. Per spec WebKit checkpoints
  after each callback like Chromium; `afterDispatch` takes the task path there, so the fix applies.
- Scratch probes (Chromium + Firefox, deleted): `{End}d{Enter}` on a controlled input flipping to
  invalid blocks the submit and keeps "bad"; `{End}b{Enter}` with a shown server error submits
  "ab" (pendingEdit guard) and the same errors re-show after the settle (settle count).
- Settle-count logic: edit before first settle (at 0 = settles 0) dismisses; edit recorded before
  a settle but applied after it is stale (correct: the settle re-arms); edit during a flight hides
  until the settle; rebase over render-phase increment can no longer hide the answer. Owner edit
  replacing a pending own edit keeps the dismissal. Unmount cancels.
- notifyChange controls (Checkbox, RadioGroup, Slider, MultiSelect, NumberField commit) keep their
  synchronous path; native input/change they also fire just add a harmless deferred refresh.

## Should fix

1. design/components/field-form.md:278-279 — "still the urgent lane ... in the same microtask as
   before where it is not". Inaccurate: the deferred setState runs with no `window.event` and no
   update priority, so React's `resolveUpdatePriority` gives DefaultLane (not the SyncLane the
   listener write had). It commits in a Scheduler task after the microtask/setTimeout, so in
   Firefox/script dispatch the commit is also later than before, and in Chromium it is
   setTimeout + a Scheduler task (a paint may show the stale aria-invalid / Field.Error for a
   frame). Either wrap the deferred writes in `flushSync` (field-root.tsx:363-369; the dispatch is
   over, so safe) to keep the old sync-commit semantics, or correct the sentence ("not a
   transition; committed in a default-priority render after the dispatch").
2. Test gap: the central claims "an Enter in the next task submits against it" and "a submission
   attempt before the state write is not blocked by the edited-away message" have only the jsdom
   model (focusout dispatched inside the listener). Add the two browser rows above
   (`{End}d{Enter}` blocked; `{End}b{Enter}` with a server error submits and re-shows) to
   field-edit.browser.test.tsx; in Chromium they exercise the window between the event task and
   the setTimeout task for real.

## Nits

3. field-root.tsx:475 — `showsServerError` reads `latest.current.serverShown`, stale (true) while
   an edit's dismissal is pending. Harmless today (only read at a settle, which re-arms anyway),
   but could consult `pendingEdit` for consistency with `writeSlot`.
4. field-root.tsx:364 — the `cancelEditRefresh.current !== cancel` guard is redundant with the
   cancel function (a cancelled callback never runs); fine as defence, could note why.
5. use-server-error-visibility.ts:7 — `dismiss` doc still says "hide ... until the next settle";
   accurate, but mention it is the synchronous form of `recordEdit()()` for callers after commit.
6. field-edit.browser.test.tsx: `{Control>}a` select-all is Linux/Windows only; fine for CI, note
   for anyone running on macOS WebKit.
