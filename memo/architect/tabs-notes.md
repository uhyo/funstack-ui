# Architect notes: Tabs (#7), 2026-10-15

Working notes behind `design/components/tabs.md`. Not a spec; the design doc is.

## Probes run (React 19.3.1, jsdom, scratchpad only)

Script: `scratchpad/probe/activity-probe.mjs` (not in the repo). Re-run in a browser before a
release note.

1. **Hidden `<Activity>` whose child suspends does not show the parent `<Suspense>` fallback.**
   Visible sibling rendered normally on first paint. Switching to the hidden panel inside a
   `useTransition` kept the old panel visible with `pending=true`; after the promise resolved the
   old panel got `display: none !important` and the new one appeared. So `keepMounted` panels
   pre-fetch without blocking.
2. **SSR of `<Activity mode="hidden">` emits nothing** (`renderToString` returned `""`); visible
   emits `<!--&-->…<!--/&-->`. Hidden `keepMounted` panels are therefore client-rendered after
   hydration, not in the HTML. `"until-found"` is the mode for content-in-HTML.
3. Hidden Activity rendered its suspending child exactly once (pre-render attempt), confirming the
   `use()` fetch starts early.
4. `csstype` 3.2.3 (installed) types `anchorName` and `positionAnchor`, so the Indicator's inline
   styles need no augmentation.

## Decisions I went back and forth on

- **Automatic vs manual default.** Kept automatic. The APG caveat is about focus latency, which
  the transition model removes; the remaining cost is action volume with awaited round trips, and
  that is a per-site choice documented next to the prop. Owner can flip it.
- **Focus-tracking state.** Rejected. Transition-lane focus state would lag during async actions
  and urgent state is deferred by the vision. Roving `tabindex` derives from optimistic value
  (APG reference behaviour); the `value === null` case uses a focusable List that redirects focus,
  so nothing is written to the DOM outside React. An earlier draft used a layout effect to promote
  the first tab; dropped because React would not reconcile the stale `tabindex` later.
- **Automatic activation dispatch site.** Chose the Tab's `focus` event (one site for JS roving,
  `focusgroup`, click and programmatic focus). Cost: `details.event` is a `FocusEvent` for mouse
  selection in Blink/Gecko but a `MouseEvent` in WebKit. Radix's `mousedown` trick was the
  alternative; not worth a second dispatch site.
- **Panel registry for `aria-controls`.** Rejected; dangling `aria-controls` is harmless and a
  registry costs a render. Ids derive from `rootId + slug(value)`.
- **Indicator positioning.** CSS Anchor Positioning (per-tab `anchor-name`, Indicator
  `position-anchor`) plus ViewTransition `update` for the slide. No ResizeObserver. Anchor must
  precede the positioned element in tree order, so Indicator goes last in List.
- **`keepMounted` shape.** `boolean | "until-found"` rather than a three-value enum
  (`inactive="unmount" | "hidden" | "until-found"`). Boolean reads best for the common case and
  the conventions already use the word. Flagged as a naming choice in the report.
- **Direction type base.** Committed value, because the panel is what animates by direction.
- **No-op guard** compares against optimistic, so re-clicking the committed tab while another is
  pending cancels the intent (section 9.4 of the design).

## Things surfaced for conventions

- Server Functions cannot be passed directly as `xChangeAction`: `details.event` is a DOM Event
  and is not serialisable. Affects every component.
- `useControllableAction.transitionType` returns one string; Tabs needs two plus the dispatching
  element for direction.
