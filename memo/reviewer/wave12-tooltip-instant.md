# Review: wave 12, Tooltip `data-instant` on warm opens (#93)

Branch `wave12/tooltip-instant` (577e5ec, d357163, ce2e16e on 63898db), reviewed 2026-10-23
against `design/components/tooltip.md` (amendment for #93, 2.1, 2.2, 4.1, 12.3, 12.4, 13 rows),
`design/conventions.md` 4.1 / 7.4 / question 37, `docs/vision.md`.

**Verdict: acceptable with minor fixes.** No must-fix. The mechanism matches the design exactly.

## Verified

- Classification: one `beforetoggle` listener on the popup, attached before the `disabled` /
  native-path branches and removed after `attachInteraction`'s cleanup, so the cleanup's
  `hidePopover()` (disabled flip, deps change) still clears the attribute. `beforetoggle` does not
  bubble, so a popover nested inside the tooltip content cannot misfire it.
- Warm branch order (show, then guarded hide): B's `beforetoggle` sees A `:popover-open` on the JS
  path; with `hint` on the JS path (Firefox) the stacking already hid A and the `isOpen` guard
  skips. If `show()` bails (popup or trigger disconnected) A is still hidden, as before.
  Skip-delay, focus and ARIA behaviour otherwise unchanged; A's pending close timer still finds it
  closed; A's Root still detaches its document listeners from its `toggle`.
- Exit: removal at the close's `beforetoggle` lands in the same style change as the
  `:popover-open` loss, so the after-change style has the transition back and exits animate.
- Unmount: passive cleanup runs after DOM removal, the guarded `hide` does nothing, no write.
- Mutation checks in a scratch worktree (jsdom tooltip file, 138 tests, all pass unmodified):
  - warm branch reverted to hide-then-show: 9 rows fail (both "A still open at beforetoggle" rows
    included);
  - listener on `toggle` instead of `beforetoggle`: 13 rows fail (developer reports all 6 browser
    rows fail too);
  - listener removed before `detach()` in the cleanup: the JS-path "disabled flipped" row fails.
  So the rows pin the timing, the order and the cleanup order.
- Browser rows: conditions only (`expect.poll` on `:popover-open`, then `frames()`), counted
  `transitionrun` / `animationstart` with a `target === popup` filter, cold count asserted > 0 so a
  dead stylesheet cannot pass vacuously. Cross-engine valid: Chromium + flags runs the native path
  (probe P4), Firefox runs the JS path with real `hint` stacking, WebKit (Safari 27 `hint` ->
  `manual`) the JS path with the explicit hide.
- Docs: data-attribute row, animation CSS, skip-delay recipe with the before-hydration caveat;
  docs example and playground CSS rules have the right specificity (0,2,0 over `.tip`'s 0,1,0).
- Deviations: (1) `attachInteraction` extraction is fine and keeps one cleanup; (2) the "only
  listener" jsdom row allowing `useResolvedPlacement`'s `toggle` is correct (that listener exists
  on every path since 7.4).

## Should-fix

1. **Stale "no listeners" wording for the native path** (design 2.1 now says "no interaction
   listeners").
   - `packages/docs/src/pages/TooltipPage.tsx:140` (Trigger props table, `experimental_interestFor`:
     "the library attaches no listeners")
   - `packages/docs/src/pages/TooltipPage.tsx:433` (engine table: "native trigger, no JS listeners")
   - `packages/example/src/tooltip-demo.tsx:57` ("the library attaches no listeners")
   Scenario: a reader auditing the flagged path (CSP, "works without our JS") is told nothing is
   attached, while the Root now attaches a `beforetoggle` listener (and `useResolvedPlacement`'s
   `toggle` was already there). Suggest "no interaction listeners (only a passive `beforetoggle`
   that writes `data-instant`)".

## Nits

1. `packages/ui/src/tooltip/use-tooltip-interaction.ts:36` "The only listener on the native path":
   the popup also carries `useResolvedPlacement`'s `toggle` listener (the developer's own
   deviation 2). Say "this hook's only listener on the native path". Same wording in
   `design/components/tooltip.md:28` ("The native path's one listener"), for the architect.
2. `packages/ui/src/tooltip/use-tooltip-interaction.ts:92`: the edited comment line is about 150
   columns (oxfmt does not rewrap comments); rewrap to the file's width.
3. `packages/ui/src/tooltip/use-tooltip-interaction.ts:63` passes the `useEffectEvent` function
   `getDelays` into a module-level helper. Correct at runtime (only called from timers the effect
   sets up), and oxlint accepts it, but React's guidance is that effect events are called, not
   passed; eslint-plugin-react-hooks may flag it if adopted. Passing `() => getDelays()` or the
   comment noting it would make the intent explicit. Optional.
4. No jsdom row for the JS path with `experimental_hint` on a warm open (the show's `hint` stacking
   hides A and the guard skips `hidePopover()`): the shim has no `hint` stacking, so this branch is
   exercised only by Firefox running the "experimental_interestFor markup" browser rows. Worth one
   sentence in that describe's comment (`tooltip.browser.test.tsx`, "elsewhere the JS path runs
   under the same markup") naming Firefox as the JS + `hint` coverage.
