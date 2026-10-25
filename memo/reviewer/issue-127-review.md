# Review: #127 lost interest hides an interest-opened library Popover

Branch `origin/fix/127-interest-lost` (6b8c58d) against design amendment #127 (f7926ca, d9d3cdd).
Reviewed 2026-10-25.

## Verdict: merge after minor fixes (test-only)

The code matches the amendment line for line and I found no behavioural bug. Two mutations of the
state-clearing code that the lead asked about survive the whole suite, so add two jsdom rows
before merging (F1, F2). Everything else is low or a nit.

## Verified

- Design conformance: interestInvoker / interestOpen / interestHideTask / interestHide refs; the
  routed-open `source === interestInvoker` comparison; the task hide guarded by `:popover-open` and
  `intended()`; the `"dismiss"` intent recorded right before `hidePopover()`; the pending cancel
  `requestClose(event, "dismiss")`; detach clears all four. JS-free mode untouched (`isLibrary`
  guards). Nothing in the trigger, Root, Menu or Combobox, as planned.
- Reason and event: `"dismiss"` with the `loseinterest` event (`source` = the button), asserted in
  jsdom and on real Chromium.
- One-task deferral: an Escape / script / library-close hide that fires `loseinterest` from inside
  finds the popup hidden or `intended()` false in the task and does nothing (jsdom rows 5 and 6,
  browser Escape row). Unmount: the task is cleared on detach, and even without that its
  `isPopoverOpen(element)` guard makes it a no-op on a disconnected element. Controlled parent
  keeping `open={true}`: the apply effect re-shows after the dismissal, as documented
  (conventions 3.5). Rejection of either dispatch goes to the Error Boundary like any dismissal;
  the popup is already hidden / never shown. `ctx.intended()` reads refs, so the closure's stale
  `ctx` is fine.
- interestHide: set in the task immediately before `hidePopover()`; read and cleared at the top
  of every own-target `toggle` (including a coalesced toggle that finds the popup open again), and
  cleared on detach. Can't leak in practice, since the `toggle` of that hide always arrives
  (deferred hide, no re-entry). F1 covers the missing test.
- Firefox: inert row passes locally (no `interest` events, nothing opens). WebKit in CI (green).
- Mutations, run in a private worktree. Caught: the full fix reverted (5 jsdom, 5 Chromium rows
  including the #125 F1 row); sync hide instead of a task (4 jsdom, Chromium Escape row);
  `intended()` guard removed (2 jsdom); `!lostInterest` focus skip removed (2 jsdom, Chromium
  hover-out and Trigger rows).
- Docs: the props table reason list and the "Hover card (Chromium)" behaviour note are accurate
  (no focus return, pending cancel, click-open unaffected, other engines inert, pointer to Tooltip).

## Findings

1. **Medium (test gap): nothing tests that `interestHide` is cleared.** Deleting
   `interestHide.current = false;` in `onToggle` (packages/ui/src/internal/use-popover-popup.ts:347)
   leaves the flag stuck true after the first lost-interest hide. Every later close of that Popup
   would then skip the 6.2 rule-2 focus fallback. All 708 jsdom tests and 64 Chromium browser
   tests still pass. Suggested jsdom row: after row 1's lost-interest hide, open through the
   Trigger, focus inside, close by a dismissal that needs the fallback (the same shape row 1 uses,
   i.e. focus inside with no previously focused element). Assert that the Trigger gets focus.
2. **Low (test gap): nothing tests that `interestOpen` is cleared on `toggle(closed)`.** Deleting
   `interestOpen.current = false;` (use-popover-popup.ts:354) survives the suite. Without the
   clear, take this sequence: an interest open, then an Escape or Close, then a Trigger-click
   open, then the button hovered and left. The click-opened popup would hide, which breaks the
   amendment's "Trigger-click open stays open" row. Suggested row: `interestOpen(foreign)`, then
   `hidePopover()`, then `openThroughTrigger`, then `gainInterest` + `dispatchLoseInterest`.
   Expect it stays open with no dispatch.
3. **Low: `interestOpen` stays stale after an interest open that never shows.** This happens when
   a controlled parent refuses it, or a Trigger click cancels it. The pending-cancel clear at
   use-popover-popup.ts:426 is also untested: deleting it survives. No `toggle(closed)` follows
   such an open, so the flag survives until the next close. A later Trigger-click open would then
   hide when that button is re-hovered and left. The design accepts this for the Trigger-cancel
   case and calls it harmless. The refused-open case has the same effect but is not named there.
   Mention it in the amendment's accepted-staleness note, or clear `interestOpen` in the Trigger
   path's `requestOpen`. No code change is required to merge.
4. **Nit: interest regained before the task runs still hides.** If `interest` fires again between
   `loseinterest` and the `setTimeout(0)`, the task still hides the popup under the pointer. The
   already-open popup gets no new routed open, so `interestOpen` stays true. That needs an
   `interest-delay-start` of about 0, so it is unlikely. `if (interestInvoker.current !== null) return;`
   in the task (use-popover-popup.ts:416) would close the gap.
5. **Nit: two defensive lines are untested.** The `source !== interestInvoker.current` check
   (use-popover-popup.ts:411) and the detach `clearTimeout` (use-popover-popup.ts:478) both
   survive their own mutations. Both are defensive: Chromium clears its invoker after
   `loseinterest`, and the task is a no-op on a disconnected element. Keeping them untested is fine.
6. **Note (conforms to the design):** lost interest while a library Close/Trigger close is pending
   leaves the popup shown until that close settles (the `intended()` guard). If a controlled parent
   then refuses that close, the popup stays open with the pointer gone and no further
   `loseinterest` will come. This is acceptable as designed, but it differs from the platform,
   which would have hidden. Revisit only if reported.
