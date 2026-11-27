# Review: #194 decideEscapeLast (feat/194-escape-last @ e2c0f4b6)

Verdict: acceptable with one fix (a regression in trigger cancels), plus test gaps and nits.
The fix probably needs an architect ruling, because the design's rule 4 has the same gap.

## Must fix

1. **A trigger cancel gets skipped when another layer consumes the same Escape. This is a
   regression from master.** `internal/escape-key.ts:98-101`: `run` stops at the first
   decider once `isEscapeRequest` is false. The trigger cancels (tooltip
   `use-tooltip-interaction.ts:203`, hover card `use-hover-card-interest.ts:300`) are element
   layers, so they decide after the global layers. When a global Tooltip or HoverCard
   consumes the Escape, the coming open on the focused trigger is never cancelled.
   Reproduced in jsdom: a Tooltip is shown by hover elsewhere, the HoverCard Trigger has
   keyboard focus with its open pending, and Escape is pressed. The tooltip closes, then the
   card opens after the delay. The same probe passes on origin/master, where the trigger's
   bubble listener ran before the document listeners. The mirror case (a HoverCard shown,
   focus on a Tooltip trigger with its open pending) has the same shape.
   Rule 3 says a cancel "closes nothing shown, leaves it alone", so it should not be gated by
   another layer's consumption. Suggested fix: run cancel-only deciders before the globals
   (an option such as `{ cancel: true }`, or a third group). They never consume, so moving
   them first changes nothing else, and the `isEscapeRequest` check before each still honours
   a page `preventDefault()`. This needs a rule 4 order amendment (architect) and a row for
   each component.

## Should fix (tests)

2. The Toast's record-time stand-down snapshot is untested. If `containsOpenLayer` is moved
   into the decide step (`toast/toast-root.tsx:231`), every test still passes. Add the
   HoverCard-style row: a Menu or `auto` popover inside the toast, with a stand-in watcher
   that stops propagation and closes the popover. The toast must stay.
3. The `composedPath()` change in `internal/overlay/open-layer.ts:22-23` is untested.
   Reverting it to `event.target` passes every test. The case it covers is a HoverCard inside
   an open shadow root with a non-modal dialog inside the card, where the window sees a
   retargeted target. Add a row, or note that it is covered only by reasoning.

## Nits

4. The docs rows for Tooltip (`TooltipPage.tsx:387`) and HoverCard (`HoverCardPage.tsx:373`)
   say that only the tooltip or card closes and that an enclosing Dialog stays open. With
   `stopPropagation()` inside a **modal** Dialog, both close: this is the stated limit, and
   a browser row pins it. A short "(a modal Dialog closes too when the Escape's propagation
   was stopped)" would keep the pages honest.
5. `escape-key.ts:132`: the `decide`-identity dedupe never triggers for library callers,
   because `createEscapeRecord` passes a fresh closure each time and dedupes itself. This is
   harmless. Either keep it as public helper behaviour or drop it.
6. `createEscapeRecord`: if a second Escape is recorded before the first one's late task
   runs, the second cancels the first for that layer only. Layers that did not record the
   second event still decide on the first. The behaviour is sensible, but it is not
   documented and not tested.

## Checked, fine

- Decision order on both paths (window bubble, afterDispatch): global layers in record order,
  then element layers innermost first. The per-decider request check means one Escape closes
  one layer. Mutations M1 (no per-decider check), M2 (no reverse), M6 (always prevent),
  M7 (no early dispose), M8 (trigger listener back in the bubble phase) and M9 (no mark)
  each fail rows.
- Adding the window bubble listener mid-dispatch is safe: the window's bubble invoke clones
  its listener list later.
- Toast stand-down for close-watcher layers is sound by construction (gap 2 above). The
  Tooltip-in-toast and Menu-in-toast rows pass, and the Viewport-in-non-modal-Dialog row gives
  the toast, then the dialog.
- Combobox chip: its preventDefault happens in-handler, before the window bubble decision.
  The existing #192 and #177 rows pass.
- Tooltip and HoverCard together: rows cover both opening orders, with and without
  stopPropagation, and a tooltip inside the card (the card stands down).
- Listener cleanup: `listenDocument(false)` and the attach cleanups cancel. The Toast callback
  ref deps are all stable, so there is no re-registration per render. StrictMode double
  ref/effect: the cleanup is symmetric. This is reasoned, not tested.
- Shadow roots: the open and closed rows in dialog-escape pass. The closed-root HoverCard
  limit is stated in the rule.
- Deviations: `createEscapeRecord`, consumeEscape preventing only during dispatch, early
  dispose, the `windowOf` jsdom lookup and the moved listener assertions are all sound.
- Browser rows: on origin/master, 8 of 12 fail (Chromium and Firefox; WebKit is not
  installed locally). On the branch, 12 of 12 pass.
- typecheck, lint, format:check: pass. The jsdom suites for tooltip, hover-card, toast,
  dialog, combobox and escape-key: 1052 of 1052 pass.
