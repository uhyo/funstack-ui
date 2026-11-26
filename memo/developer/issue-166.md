# #166 HoverCard (developer notes, 2026-11-26)

Branch `feat/166-hovercard` (from `design/166-hovercard`, master merged in).

## Shape

- `hover-card/hover-card-root.tsx`: `usePopoverRoot({ component: "hover-card", mode: "library" })`,
  plus trigger / popup elements in state (for the interest effect), `interestForRequested`, and
  the `suppressed` ref ("no open until fresh interest", one flag for both paths).
- `hover-card/use-hover-card-interest.ts`: the JS path's listeners (timer pair from
  `createDelayedPair`), the Trigger's pointerdown / Escape / fresh-interest listeners on both
  paths, document Escape + capture pointerdown while `optimistic || committed` (also attached
  right before the open timer's `requestOpen`). `dismiss()`: shown -> blur focus inside (unless
  Escape's focus return), `recordCloseIntent({ reason: "dismiss", event })`, `hidePopover()`;
  pending -> `requestClose(event, "dismiss")` unless `hiddenBeforeToggle()` (the card was just
  hidden, its fact still queued).
- `hover-card/hover-card-popup.tsx`: `usePopoverPopup` with `quietShow`, `allowOpen` (cancels
  the Trigger's interest show while suppressed), `elements: ["DIV", "SPAN"]`.
- Trigger writes `interestfor` in a layout effect / its ref (never server HTML); inline
  `interest-delay-*` are rendered whenever the flag is on.

## Gotchas

- Fake timers: a 0 ms timer created inside another timer's callback is scheduled 1 ms later
  (sinon's "during tick" rule), so the jsdom file flushes tasks with `advance(1)` (`task()`).
- A press on the Trigger reaches the document capture listener first; the Trigger's own listener
  must not dispatch `requestClose` again (WeakSet of handled events + `hiddenBeforeToggle`).
- WebKit cannot launch locally (WSL); ran branch CI for it.

## Follow-up: re-probe on Chromium 160

Chromium 160 ships `InterestForSpecAlignment` (research wave 23, 1.1). When Playwright's
Chromium is 160+:

1. Re-run `memo/architect/probes-166/interest-rules.mjs` (rows A, B, B2, C, E and the
   "intercept" runs).
2. Check whether "suppress next focus interest" makes the library's flag redundant for the
   focus return after Escape (row B2): if the platform no longer grants interest on a script
   `focus()` of the invoker, the `allowOpen` interception still has to cover a press on the
   Trigger (an interest timer already running) - keep it unless that changes too.
3. Check that a re-shown popover (`showPopover({ source })` after cancelling the interest show)
   still gets `loseinterest` without the platform hiding it (popover.md 2.9); HoverCard's
   lost-interest close on the flagged path depends on it (`use-interest-dismiss.ts`).
4. Run `hover-card.browser.test.tsx` "experimental_interestFor (Chromium)" rows; update
   hover-card.md 2.3 / 2.4 and the CHANGELOG if anything moved.
