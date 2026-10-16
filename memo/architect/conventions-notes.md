# Architect notes: conventions (#5), 2026-10-15

Working notes behind `design/conventions.md`. Not a spec; the design doc is.

## Empirical checks run while writing (React 19.3.1, jsdom, scratchpad only)

All probes were run in the session scratchpad with the `packages/ui` node_modules; nothing was
added to the repo. Re-run them in a browser before relying on them for a release note.

1. **`useOptimistic` updates render at SyncLane** (`dispatchOptimisticSetState` in
   `react-dom-client.development.js`: `lane: 2, revertLane: requestTransitionLane()`).
   Consequence: content keyed off optimistic state that suspends shows the Suspense fallback.
   Probe: `shown = opt` -> `old` + fallback rendered; `shown = internal` -> old content only.
2. **Transition-lane `setState` before the `await` inside an async action is held until the
   action settles.** Probe: `internal=0 opt=1 pending=true` mid-flight, `internal=1` only after
   resolve. So "write before await" and "write after await" have the same observable timing for
   transition state; the only difference is behaviour when the consumer swallows an error
   (pre-await write commits anyway; post-await write is skipped if the action throws).
3. **Uncaught rejection** -> nearest Error Boundary, component subtree replaced. Caught inside the
   action -> action resolves, held updates commit.
4. **All transitions started anywhere while an async action is pending are entangled with it**
   (sibling component's `startTransition(() => setN(1))` did not commit until the unrelated async
   action resolved; reproduced with and without `act()`). Implication for the library: an awaited
   slow action in any component holds every transition in the app. Guidance: await only what the
   UI must wait for; fire-and-forget background work.
5. **Overlapping actions on one `useTransition`**: optimistic reducer shows the latest intent
   (`B`) throughout, but post-await writes land in completion order (`A` won because its promise
   resolved last). A sequence guard ("only the latest dispatch commits") is needed for
   latest-intent-wins.
6. **tsdown**: `unbundle: true` keeps `"use client"` at the top of each output file; the default
   bundled build strips it (rolldown prints a warning).

## Where I deviated from the research doc

- react-async-apis.md implication #4 recommends writing uncontrolled state only after the action
  resolves "so controlled and uncontrolled behave the same". Timing is the same either way (note
  2); the rule I actually adopted is: **trigger parts render optimistic state, content regions
  render committed state**, plus write-after-await with a latest-intent guard for rollback and
  ordering.
- The transition-type naming uses hyphens (`fsui-tabs-next`) instead of colons; colons need
  escaping in `:active-view-transition-type()` selectors.

## Prior art borrowed

- Base UI: `render` prop (element and `(props, state)` function), `className`/`style` as
  functions of state, boolean data attributes by presence, per-component subpath imports.
- React Aria Components: `children` as a function of state, data attributes == render-prop state
  with one vocabulary.
- Radix: part vocabulary (Root/List/Trigger/Content), data attributes. Rejected `asChild`.
- Ark UI: `Root`-first anatomy. Rejected `data-part`/`data-scope`.
- Headless UI: `as` prop rejected (typing cost, cannot pass props).

## Things to raise later (not blocking)

- Done 2026-10-15: research-react confirmed note 4 against ReactFiberAsyncAction.js (all transition
  updates during an async action are entangled into one scope; PR #37290 only de-entangles render
  work between lanes) and updated react-async-apis.md sections 2 and 3, replaced implication #4
  with write-after-await plus a latest-dispatch guard, and switched type names to hyphens.
  conventions.md section 3.3 can now cite the research doc instead of "supersedes" wording.
- `vitest` browser mode will be needed once components rely on Popover/anchor APIs that jsdom
  lacks; jsdom tests cover the React semantics only.

## 2026-10-16: native-input hook reconciliation (wave 2)

switch.md specified a per-input `useNativeChecked` that reported both residual paths itself;
radio-group.md assumed a group-level `useNativeInputReconciliation` called once from Root. Settled
in conventions 3.8 as three hooks: `useFormReset` (stable subscription on a form owner, the
primitive both need), `useNativeChecked` (per input; `group: true` disables its own reporting),
and `useNativeGroupReconciliation` (fieldset Root, one dispatch per group). Two facts drove the
shape: React's automatic reset runs in the mutation phase, so the subscription must be stable
(switch probe 3); and after that reset the per-input re-apply effect has already restored the
optimistic `checked`, so a reset must read `defaultChecked`, which for a group means "the radio
whose `defaultChecked` is true". RadioGroup's uncontrolled reset target now follows the latest
`defaultValue` (Items mirror `defaultValue === value`), matching Switch's rule rather than the
mount-time value it originally specified.
