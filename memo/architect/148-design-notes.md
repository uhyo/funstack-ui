# Architect memo: #148 design pass (2026-11-24)

Design: `design/components/overlay-open-change.md` (proposed, pending user review).

Things considered and dropped, kept here so they are not re-derived:

- **Lane probe for the dev warning.** Start a library transition right after calling
  `onOpenChange` and warn when `open` flips in the same commit. Transitions scheduled in one
  event share a lane, so it would detect a `startTransition`-wrapped setter exactly. Fails on
  entanglement: with any async action pending, every transition commits together, so an
  intentional "refuse while saving, close when saved" lands in the probe's commit.
- **`useDeferredValue(open) === open` to detect a transition render**: tells the lane of the
  closing render, not when the update was scheduled; same false positive.
- **"No user input between re-open and close"**: fails on the same example.
- Result: W1 (static) + optional W3 (100 ms window, residual stated).

Not probed (listed in the design, section 11): batching of updates from a native `toggle`
listener with the parent's `setOpen`; `useOptimistic` passthrough re-base dropping stale
patches via an epoch; re-open inside a running CSS exit; a Server Function called outside a
transition per framework.

Open point I raised against the brief: a popup found open at hydration is request-shaped
(rollback possible, load-on-open, Suspense); the brief lists it as a fact. Both variants are
specified (2.12).

`notifyClosed` has exactly two call sites today (`use-popover-popup.ts`, `dialog-popup.tsx`,
plus Dialog's stored-dismissal send): that set is the definition of "fact".
`requestClose(event, "dismiss")` exists in `menu-hover.ts` and `use-interest-dismiss.ts`:
requests with a dismiss reason, unchanged.
