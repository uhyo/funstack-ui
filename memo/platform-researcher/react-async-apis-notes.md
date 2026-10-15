# Working notes: React async APIs research (2026-10-15)

- Docs vs. implementation drift: useTransition/startTransition pages still say overlapping
  Transitions are "batched together"; 19.3 CHANGELOG (#37290, enableParallelTransitions) says they
  render independently. Recorded both in the doc; design advice is the same either way.
- Stability determined from: 19.3 blog (ViewTransition + Fragment refs explicitly "stable"),
  19.2 blog + CHANGELOG (Activity, useEffectEvent, cacheSignal listed as new features, no Canary
  banner on reference pages), ReactFeatureFlags.js (enableViewTransition=true;
  enableGestureTransition and enableDefaultTransitionIndicator = __EXPERIMENTAL__).
- Unverified-by-docs items flagged in the doc for demo checks: Suspense fallback behavior for a
  hidden Activity's suspended children; ViewTransition animating streamed SSR Suspense reveals;
  useOptimistic with several concurrent Actions on one hook.
- `layout` prop appears once on the addTransitionType page but not on the ViewTransition page;
  treated as undocumented.

## Update after architect's probe (same day)

- Corrected the doc: PR #37290 covers render independence only. The async action scope in
  ReactFiberAsyncAction.js still entangles every transition update started while any async action
  is pending ("we can't tell which action an update corresponds to. So instead, we entangle them
  all into one"). Architect reproduced on 19.3.1 in jsdom.
- Added: useOptimistic dispatches at SyncLane with a transition revertLane, so suspending content
  keyed off optimistic state shows a fallback. Rule adopted: triggers read optimistic, content
  reads committed.
- Replaced implication #4 with the architect's write-after-await + latest-dispatch guard rule.
- Transition type naming switched to hyphens.

## Probes (React 19.3.1, jsdom, no act(); run with `node memo/platform-researcher/probes/<file>`)

01: async action in A + sibling standalone startTransition in a later event -> sibling held
    until A's promise resolves; urgent setState not held; both transition updates commit together.
02: sync transition in A that suspends in an already revealed boundary + sibling transitions in
    later events -> siblings commit while A is pending (parallel transitions, #37290).

Source facts: v19.3.0 ReactFiberLane.getHighestPriorityLanes returns getHighestPriorityLane(lanes)
for transition update lanes when enableParallelTransitions (true); shipped build: `lanes & -lanes`.
Shipped requestTransitionLane returns currentEntangledLane when an async action scope is open.
entangleTransitionUpdate still entangles transition lanes on the same hook queue. The flag is
gone from main's ReactFeatureFlags.js (cleaned up after 19.3).
