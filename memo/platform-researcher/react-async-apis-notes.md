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
