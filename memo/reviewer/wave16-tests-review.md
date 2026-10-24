# Wave 16 test infrastructure phase 1 review (#101, branch wave16/test-infra @ b5133f2)

Verdict: acceptable with minor fixes. No assertion weakened in a way that changes what passes today;
coverage unchanged (titles 1:1, expect count 9360 -> 9361).

## Verification done
- Scratch worktree: jsdom 2866/2866 (plus 3 shuffled runs, seeds 1-3, all green); browser Chromium
  406 passed / 5 skipped (411); Firefox 393 / 18 skipped; WebKit cannot launch here (CI runs it).
  typecheck, lint, format:check clean. (jsdom needs `pnpm build` first: production-bundle.test.ts.)
- Titles (JSON reporter, master vs branch): jsdom 2866 = 2866, identical after stripping the four
  T16 describe prefixes. Browser Chromium 412 -> 411: exactly the developer's mapping (focusgroup x2
  merged into environment.browser, Select probe moved, Meter/Progress (browser) prefixes).
- expect( lines per file: only environment.browser (+3), tabs/toolbar/select.browser (-1/-1/-2,
  moved), select.test (+1 warm-up), context-trigger.test (+1 "0 before the open").
- Flush variants: every file maps to the same semantics (2 x setTimeout -> flushTasks(2); one task
  -> flushTasks(); act-only -> flushMicrotasks(); toast two microtasks -> flushMicrotasks(2);
  browser sleep(20) -> flushFor()). Exception: field.browser's private settle stepped one task,
  the shared one steps 20 ms (slower first look, not weaker).
- Mutations:
  1. menu-popup renders the point <style> always: branch fails all 3 "<style> resource" rows;
     master's copy of the file passes all 125 (the two "renders none" rows and the first row were
     vacuous before). T15 fix confirmed.
  2. context trigger: a stationary release hides the menu -> 14 browser rows fail, including every
     converted `settle(isOpen true)` "survives / keeps it open" row.
  3. toast: pending Undo no longer pauses the timer -> the fake-timer row fails.

## settle conversions (question 1)
settle's first round is the old step (flushFor(20), then the check), so every check that passed
before passes at the same moment; extra rounds only run when the old test would have failed. The
only newly accepted behaviour is "wrong at 20 ms, right later" (slowness, or a flicker that rights
itself). Monotonic negatives (`not.toHaveBeenCalled`, `toHaveBeenCalledTimes(n)`, a closed popover
that nothing reopens) cannot be turned green by retries. Sampled all 86 sites; no site found where
a plausible bug is wrong-then-right within 2 s. Promptness is still pinned by the jsdom rows
(deterministic flushTasks(2)).

Style issue: six context-trigger rows (215, 237, 444, 690, 991, 1237) and toast.browser 145/148
are "still open" checks (a negative: nothing closed it) written as settle. Not weaker (mutation 2),
but read as "wait until open" and cost 2 s on failure. Prefer `await flushFor(); expect(...)` there.

## Findings
- Low: spyViewTransitions silently records nothing where `startViewTransition` is missing; most
  master copies threw instead. "No view transition" rows would pass vacuously on such an engine.
  Throw (or expect the API) except where a row opts in.
- Low: onCleanup/runCleanups/addStyle live in browser-helpers.ts, whose header says "real time or
  real-browser state", yet vitest.setup.ts imports runCleanups for jsdom and the node-env
  production-bundle test. Move the cleanup registry to a neutral module or fix the header.
- Low: Select beforeAll: `render(...).unmount()` leaves RTL's container in body until the first
  test's cleanup. Robust otherwise (fails loudly if React stops warning). Under T14 (no isolate)
  React's once-per-module dedupe becomes per-worker: loud failure, keep in mind.
- Nit: ViewTransitionSpy.args / .spy unused by any caller; ShowCall export unused outside.
- vitest.setup order (restore -> cleanup -> runCleanups -> settleOpenDeferreds) matches the old
  per-file hooks (stack order); the 6 files that call real hidePopover keep their own restore,
  correct. No spy is created in beforeAll / module scope, so per-test restore breaks nothing.
- delay: null: only jsdom uses setupUser (browser uses browser-user.ts). Inside one act scope a
  setTimeout(0) between keys did not commit transitions anyway; typeahead / hover timers are fake
  or well inside their windows. No reliance found.
- quietPeriod: all durations identical (tooltip 400 = closeDelay*4). animationsFinished excludes the
  bar; the enter-fade waits are now exact.

## Net line delta (packages/ui/src)
+6547 / -6794 = -247 (test files -518, new helpers/setup +271); ignoring whitespace the same -247
(slider/number-field/meter/progress describe wrap re-indents ~6000 lines).
