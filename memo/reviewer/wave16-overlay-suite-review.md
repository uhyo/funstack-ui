# Review: wave16/overlay-suite (#106, tracker #100), 2026-10-24

Branch 8fcdb32 vs origin/master. Audit: refactor-audit-tests.md T7, T8, T16.

## Verdict

Acceptable with minor fixes (none blocking). The suite is a faithful, near-literal
generalisation of Dialog's and Popover's rows; it found real coverage gaps (Menu had no Root
rejection / refusal / overlap / stale-intent rows: mutations there now fail suite rows that
nothing caught before).

## Verification

- jsdom dialog/popover/menu: 661 pass. typecheck, lint, format:check pass. Browser
  (chromium+firefox) dialog/button/toolbar: 131 pass, 1 skipped (pre-existing).
- Mutations repeated (developer's): latest-dispatch guard dropped (8 failures incl. S: overlap
  11.8/11.7 uncontrolled on all three); stale intent never cleared (S: close intents on all three
  + Popover's two local rows). Same results as the notes.
- Own, Menu: Trigger toggles against `committed` instead of `intended()`: 9 failures (S: 11.7 and
  11.8 both modes, plus pre-existing L1 rows). Item close reason "dismiss": 10 failures (S:
  part close, 11.13, close-intents rows, plus pre-existing). Trigger never closes: 5 failures (S:
  click-while-open both, 11.7 both, local row).
- Old vs new Dialog rows compared line by line for sync/async/rejection: assertions preserved;
  `returnValue`, `close("x")` args, `""` for controlled close all still pinned. Swapping
  `close()` for `requestClose()` in the moved rows loses nothing: the library does not listen to
  `cancel` (shim: requestClose = cancel + close(v)).

## Findings

L1. Menu "a click while open dispatches (false, 'activate'): a library-owned close" passes by a
different mechanism. Instrumented: the Trigger's mousedown moves focus out of the popup, the
root Popup's focusout hides it (menu-popup.tsx:281-287) before the click; the click then
dispatches (false, 'activate') against intended() and the `toggle` is swallowed as an echo.
Outcome is right (design 2.2 says 'activate'), title is not for Menu. The menu.test.tsx config
comment already explains it; add "(Menu: the focusout hides first)" to the suite row or the
`triggerToggles` doc. Side note for the PO/architect (pre-existing, not this branch): with an
async openChangeAction(false), Chromium/Firefox hide at once (button focus on click), WebKit
(no focus on click) keeps the menu open until it settles.

L2. Vacuous assertion for Popover: suite `part-initiated close` ends with
`expect(trigger()).toHaveFocus()` (overlay-open-state-suite.tsx:399). Popover's partClose clicks
the Trigger, so focus is there regardless. Real for Dialog and Menu. Either gate it or comment it.

L3. Popover and Menu drivers duplicate ~25 lines verbatim (spyShow/spyHide, openArgs, dismiss,
dismissEvent "toggle", detailsKeys, foreignOpen, openBeforeHydration, controlledOpen/CloseArgs).
A `popoverLikeDriver(...)` default in the suite file would cut each config to ~8 lines and make
Combobox (also on useOverlayRoot, not covered) cheap to add. `returnValue` is derivable from
`detailsKeys.includes("returnValue")`.

L4. Inconsistent T16 cleanup: Dialog's "disabled on link and component renders" lost "#83" and
"(review M1)"; Popover's twin (popover.test.tsx:1012, 1101, 1117) and the "(H1)" describe at
:1370 keep them. Menu titles keep "(M1)", "M1:".."M4:" (menu.test.tsx:517, 566, 996-1134).

L5. Review-id comments (`// review M1 (memo/reviewer/dialog-46.md).`, 14 in dialog*.test.tsx,
3 in dialog.browser). They follow T16 as I wrote it, but O16's rule for source (keep the reason,
drop the id) is the better rule: these comments carry provenance only, point at per-role memo
files that are not documentation, and git history has it. Recommend dropping them (or replacing
with a one-clause reason where the title does not say why). Zero risk.

N1. Menu row "a controlled parent that adopts after its own await opens and closes"
(menu.test.tsx:1755) is fully covered by the suite now; delete. "a controlled open flip" and the
pre-hydration row overlap the suite but pin autofocus / walkthrough 10; could be trimmed to those
asserts.

N2. Menu now has two harnesses (Harness with `root`, OpenStateHarness). Acceptable.

N3. Suite hardcodes the part's value "x" (returnValue checks) coupled to the harness default
content; documented in `OverlaySuiteHarnessProps.content`. Acceptable.

## Design questions answered

- Driver: 5 booleans (returnValue, triggerToggles, ariaExpanded, partCloseCancelsClick,
  foreignOpenCallsOpen), each a real behavioural property, none a "skip row N" switch. Not leaky.
- Future overlays: Combobox fits (same root; partClose = option pick). Tooltip and Select are not
  on useOverlayRoot and do not open by click: not this suite.
- Size: 1005 lines is ~220 of types/harness and ~780 of rows that are literal moves; no cheap
  shrink inside the file beyond L3.
- Dialog split: cohesive (core / Close and library-owned closes / Form and method=dialog /
  disabled renders). Fine.

## Remaining reductions: recommendation

- Now (cheap, zero risk): L3 shared popover-like driver, N1, L4/L5 comment/title cleanup.
- Later, own issue: browser overlay rows (Escape dismiss + focus, exit-animation keep, VT "pop"
  open/close/dismiss-once, "without transition") are triplicated across dialog/popover/menu
  .browser files (~200 lines, audit T8); cross-engine and riskier, needs its own mutation pass.
  Disabled-renders twin (dialog-disabled.test.tsx vs popover.test.tsx:1012, menu.test.tsx:406)
  also a separate small suite.
