# Review: #195, a second Escape on the late path (commit 193c299d, fix/195-late-escape)

Verdict: merge (minor doc nits can follow).

## Verified locally
- escape-key.test.ts 29/29, escape-last.browser.test.tsx 16/16 on Chromium + Firefox.
- master's escape-key.ts with the new tests: 2 jsdom rows and both browser rows (x2 engines) fail.
- The issue's candidate fix alone (multi-slot holder, settle disabled): Tooltip-in-Dialog row
  passes, Dialog-in-Dialog row fails on both engines; the 2 jsdom ordering rows fail. So the
  settle step is needed, as the developer found.
- Full jsdom suite: only directives.test.ts fails (needs a fresh build; environmental).
- format:check, lint, typecheck pass.

## Correctness reasoning
- No double run: run() is guarded by entries.get(event) === entry and disposes first (cancels
  the late path and the window listener). Settle only touches events with eventPhase NONE, which
  are past their record window, so no decider can join after an early run.
- Cancelled deciders (unmount between E1 and E2) are skipped by the early run too.
- consumeEscape(E1) in an early run sets only the mark (phase NONE): E2 is untouched.
- Every library record listener calls isEscapeRequest before its snapshot (Dialog, Toast,
  HoverCard, Tooltip); the window-capture global listeners run first, so settle precedes all
  library snapshots of E2.
- Decide-time snapshot is not an alternative: composedPath() is empty after dispatch and close
  watcher layers (auto popover, modal dialog) look closed by then (the reason the snapshot is at
  record). Settle in isEscapeRequest is the only point guaranteed before every snapshot.
- Inherent, not introduced: E2's target was fixed at dispatch, before the settle moved focus.

## Nits
- internal-hooks.md:260 attributes the settle to createEscapeRecord; it lives in isEscapeRequest,
  whose summary there still reads as a pure predicate.
- conventions 15 "Its first record step (isEscapeRequest)": the parts that act on themselves
  (TextField, NumberField, Menubar) also settle through isEscapeRequest.
- Toast reads endingRef (commit-time) at record and decide: after a settle it is stale, so the
  toast records and consumes E2 though it is ending (close() is a no-op). Pre-existing staleness
  (also with normal timing under a transition), harmless in practice.
- isEscapeRequest(oldEvent) on an already-decided event would settle later pending ones out of
  turn; no caller does that today.
- Missing row: a layer unmounted between E1 and E2, then E2 (early run skips the cancelled
  decider). The holder-cancel row passes on master too (guard only).
- CHANGELOG: two blank lines before the new entry.
