# Architect notes: Toggle (#6), 2026-10-15

Working notes behind `design/components/toggle.md`. Not a spec.

## Probe: does the optimistic flip start a view transition? (React 19.3.1, jsdom)

`memo/architect/probes/toggle-viewtransition-optimistic.mjs`. Polyfills
`document.startViewTransition`, `document.fonts`, `CSS.escape`, `getComputedStyle`,
`getAnimations` and counts calls per commit for a conventions-shaped Toggle
(`useControllableAction` with `transitionType`, `<ViewTransition default="fade">`).

Run: `node memo/architect/probes/toggle-viewtransition-optimistic.mjs` from the repo root
(uses `packages/ui/node_modules`).

Results (vt = cumulative `startViewTransition` calls):

| Scenario | Optimistic commit | Final commit | Types on final |
| --- | --- | --- | --- |
| S1 uncontrolled, async resolve | vt unchanged | +1 | fsui-toggle, fsui-toggle-press |
| S2 uncontrolled, reject → boundary | vt unchanged | +1 (boundary swap) | none |
| S3 uncontrolled, sync action | vt unchanged (commits after 1 microtask) | +1 (after tick) | fsui-toggle, fsui-toggle-press |
| S4 controlled, parent sets in sync prefix | – | +1 | fsui-toggle, fsui-toggle-press |
| S5 controlled, parent never updates | vt unchanged | +1 (snap back) | none |
| S6 two clicks, resolved 2 then 1 | vt unchanged | +1 after the *last* settles | fsui-toggle, press, release |

Source reason: `dispatchOptimisticSetState` uses `lane: 2` (SyncLane); commit-time
`isViewTransitionEligible = (committedLanes & 335544064) === committedLanes` (0x13FFFF00 =
transition + retry + idle lanes), so a sync commit never calls `startViewTransition`.

Other things the probe showed:

- `data-pressed={true}` renders `data-pressed="true"`. Emit `""` for the presence form.
- Two clicks dispatch `[true, false]` when `next = !optimistic`. With `!committed` it would be
  `[true, true]`.
- `data-pending` stays until every in-flight action settles (S6: still pending after the second
  click's promise resolved first).
- The sync-lane optimistic render is not flushed synchronously inside the click handler; it
  commits in a microtask. Tests must `await` (user-event does).
- Why S1/S3/S4 carry types but S5/S2 do not: not fully traced. Hypothesis: types are queued on
  the entangled lane when a real transition update (`setInternal` / `setP`) is scheduled;
  the optimistic revert alone does not queue them. Re-verify in a browser via the example app.

## Decisions I made that the lead did not spell out

- `next = !optimistic` (not `!committed`). Required for a second click to reverse the first.
- No committed value exposed on the element (`state.committedPressed` rejected).
- `type` and `aria-pressed` omitted from `ToggleProps`, not just `onClick`.
- Transition types `fsui-toggle-press` / `-release` per conventions 5.3 (the task message said
  `fsui-toggle-pressed`; conventions win).
- Hook takes `transitionTypes` returning an array (conventions sketch had a single string).

## Things to raise later

- Server Function + `details.event` serialisation: needs a `react-server-dom-*` probe. Not
  installed in the repo; not run.
- The "flip is CSS, settle is ViewTransition" split should be the template for every trigger
  part's docs (Tab, Accordion.Trigger). Told the lead; conventions architect owns the wording.
