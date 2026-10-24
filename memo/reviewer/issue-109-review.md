# Review: test/109-overlay-browser-suite (#109), 2026-10-24

Branch 62f5fd1 (3 commits) vs origin/master. Developer notes: memo/developer/issue-109.md.

## Verdict

Merge with fixes. Nothing blocks the merge. M1 is worth adding before merge because it turns the
one surviving mutation into a killed one, and it costs about eight lines.
No coverage loss: every removed browser and jsdom assertion has an equal or stronger
replacement, and the suite added real rows (Menu exit/#64/CSS-exit rows, Dialog part-close held
exit, Popover recipe=true dismissal, submit variant of the CSS-exit rows).

## Verification

- Branch alone, chromium+firefox: dialog/popover/menu/environment browser files 260 pass,
  2 skipped (pre-existing). jsdom dialog/popover/menu 664 pass. lint, format:check pass.
- #110 has landed on master (e4c6079, 9d273c6, 34933fd). Trial merge of the branch with
  origin/master 481cfc3: no conflict. tsc clean, jsdom 667 pass, menu.browser 78 pass on
  chromium+firefox. The pre-landing tip of fix/110 conflicted only on the import block of
  menu.browser.test.tsx (`deferred` vs the suite imports). Master's version merges cleanly.
  Rebase onto master before merging anyway.
- Old vs new compared row by row for all three components (see Coverage below).
- Own mutations (private worktree, removed afterwards):
  - M9 (developer's survivor: drop `if (echo && transition !== undefined) return;` in
    overlay-popup.tsx useCloseHold.afterClose) plus a MutationObserver re-mount count in the
    suite's "a CSS exit (recipe=%s)" row: 5 fail on Chromium (recipe=false: Dialog Close /
    submit / controlled, Popover Trigger click, Menu item activation), "expected 1 to be 0".
    Without the mutation, 3 repeated runs on chromium+firefox: 32/32 pass each time. So the
    survivor can be killed deterministically. See M1.
  - M10: apply effect in use-popover-popup.ts as `useEffect` instead of `useLayoutEffect`
    (the close/open run after the update callback): 10 fail on chromium+firefox ("the open and a
    Trigger click / an item activation each run one view transition" and the CSS-exit part-close
    rows). The tightened timing row now catches a realistic mutation on both engines, not only
    the 150 ms delay.
  - (Developer's M1/M5 survive on Firefox by design: Firefox runs no exit animation. The
    `browserName === "chromium"` guard keeps the held branch non-vacuous where it matters. Same
    shape as the old rows, so nothing is lost. WebKit still depends on CI.)

## Findings

M1 (medium). overlay-browser-suite.tsx:416-443. The "a CSS exit (recipe=%s)" rows do not pin
"with `transition`, a library close does not re-mount the content for the CSS exit". The notes
call M9 a survivor because "a check races the fade". That is not so: counting `content` nodes
re-added to the popup (a MutationObserver from before `partClose.close()` until after the quiet
period, then `expect(remounts).toBe(0)`) is race-free. It fails only with the mutation and passed
3/3 runs clean. Add it (or a mount counter as in Dialog's local #46 row "mounted once") and move
M9 to the killed column of the notes.

L1 (low). Issue #109 comment 2 (one real-mouse row per "click X while open" closing-table entry
for Popover, Dialog, Menu, Select, Combobox, Tooltip) is not done on this branch. Only Popover's
Trigger click is covered by real input (suite `partClose`). The comment allows a follow-up, so
open a follow-up issue before closing #109.

L2 (low). Some setup is still duplicated next to the suite:
- dialog.browser.test.tsx:632-723 keeps its own `heldExitStyle` / `watchExit` / `finishExit`
  for the #46 row, which are near copies of the suite's `exitStyle` / `watchExit` /
  `expectHeldThenReleased`.
- dialog.browser.test.tsx:725 and popover.browser.test.tsx:479 repeat the suite's ViewTransition
  `beforeEach` / `afterEach` / `open()` (spy, leaveActEnvironment, pop keyframes).

Exporting the two helpers from the suite (or from browser-helpers.ts) would remove about 60
more lines. Optional. The #46 "controlled close keeps the content, mounted once" row could also
become a suite row if Popover and Menu share that behaviour.

N1 (nit). overlay-browser-suite.tsx:64. `OverlayViewTransitionProps.keepMounted` is never passed
by the suite. It exists for the local focus rows. Menu's `Plain` (menu.browser.test.tsx:181)
silently ignores `keepMounted` and `controlled`. Either document that `controlled` is honoured
only where a `partCloses` entry sets it, or drop `keepMounted` from the shared type and add it
locally (Dialog already adds `modal` that way).

N2 (nit). overlay-browser-suite.tsx:167. `details as unknown as { returnValue?: string }`. This
is acceptable in a test, but a `dismissDetails?: (details: D) => void` hook would avoid the cast
and allow other per-component detail checks.

N3 (nit, titles). overlay-browser-suite.tsx:418. Under "a CSS exit (recipe=true)" the title
"…, a live new image only in Chromium without the recipe" describes the other branch. It is
accurate but reads oddly. Something like "%s has the old image; a live new image only where
the box still fades (Chromium, recipe=false)" would fit both. The other titles describe
behaviour well, and the mapping in the notes is complete.

## Coverage (old to new)

- Dialog: Escape row identical (returnValue "", event "close"). Held exit and #64 rows are
  identical; the #64 row now passes the `flushFor(50)` flush. In the pop open/close rows,
  `:modal` moved from `updateCallbackDone` to after `finished` (still asserted). Polling
  `calls` before `isOpen` makes the row stronger. The recipe part-close rows' "display none, old
  image, no new image" is now `fading === false` plus the old/new image checks: equivalent. The
  characterisation row is the recipe=false variant and now also asserts the old image. The
  without-transition row is identical.
- Popover: every row is kept. The dismissal held-exit row lost its extra "Inside" button, but the
  harness now has a Close part, so focus content still exists. The pop rows gained quiet
  periods. The CSS-exit dismissal row gained recipe=true. The without-transition row gained a
  dismissal.
- Menu: the Escape row is stronger (call count, next, event type, aria-expanded). Exit rows are
  equal (`rename` became `content`). The part close is still an item activation (Enter in the
  exit rows, click in the VT rows). The open focus check and the focus return after activation
  are kept in afterOpen / afterClose. The Trigger click while open is correctly left out (#110,
  now on master with its own rows).
- jsdom disabled-render suite: Dialog / Popover / Menu rows are equivalent or stronger (Dialog
  Close rows now open through the Trigger, Menu Trigger rows also check the `showPopover` spy,
  Popover `data-disabled` folded in). The suite API (Harness, isOpen, spyOpen, triggerVariants,
  optional close) is small and pays for itself. The generic `P` cast is documented.

## Suite API

`describeOverlayInBrowser` is clear: `open` / `partClose` / `dismissEvent` / `ariaExpanded`, plus
a `viewTransition` block with `Plain` / `partCloses` / `dismiss` / `afterOpen`. The comments
explain why each component chose its part close and its dismissal. The split of `Harness`
(library-mode exit/Escape rows) and `Plain` (no wrapper, VT rows) is justified in its doc
comment. The suite pays for itself: about 456 lines replace about 800 and run more rows.
