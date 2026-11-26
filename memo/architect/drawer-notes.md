# Architect notes: Drawer (#168), 2026-11-26

Working notes behind `design/components/drawer.md`. Not a spec.

## What I read

- #168, #162 (wave 25), vision, conventions (2.1, 2.6, 3.5, 4.1, 5.3 to 5.5, 7.3, 9.1, 12, 13),
  overlay-open-state.md whole, dialog.md (1 to 4.4, 7, 10), alert-dialog.md whole, toast.md 9
  and 10, `packages/ui/src/dialog/*` (the part hooks and `dialog-dismiss.ts`),
  `internal/pointer-capture.ts`, `internal/overlay/use-exit-animation.ts`, Slider's pointer
  code by grep.
- **Toast has no swipe.** The issue's premise is wrong: toast.md 9.2 says "Not in v1" and
  `grep -ri swipe packages/ui/src` finds nothing. The only pointer gesture in the library is
  Slider's.

## Prior art (fetched 2026-11-26)

- Base UI Drawer 1.9.0. Parts: Provider, IndentBackground, Indent, Root, Trigger, SwipeArea,
  Portal, Backdrop, Viewport, Popup, Content, Title, Description, Close,
  VirtualKeyboardProvider. `swipeDirection` on Root (default `down`), `modal: boolean |
  'trap-focus'`, snap points, reason `swipe` on `onOpenChange`. Vars
  `--drawer-swipe-movement-x/y`, `--drawer-swipe-progress` (on Backdrop),
  `--drawer-swipe-strength`, `--nested-drawers`. Source (unpkg): `utils/useSwipeDismiss.js`
  34 kB (DEFAULT_SWIPE_THRESHOLD 40, REVERSE_CANCEL_THRESHOLD 10,
  MAX_RELEASE_VELOCITY_AGE_MS 80), `drawer/viewport/DrawerViewport.js` 42 kB
  (FAST_SWIPE_VELOCITY 0.5, AXIS_LOCK_SLOP 6, `onTouchStart` plus a document `touchmove` with
  `preventDefault()` for the scroll edge), `DrawerVirtualKeyboardProvider.js` 35 kB.
- Ark UI Drawer: Root, Trigger, Backdrop, Positioner, Content, Grabber, GrabberIndicator,
  Title, Description, CloseTrigger, SwipeArea, Indent. `closeThreshold` 0.25,
  `swipeVelocityThreshold` 700, `preventDragOnScroll` true, `data-no-drag`.
- vaul (`src/constants.ts`, `src/index.tsx` on main): `direction` (default bottom),
  CLOSE_THRESHOLD 0.25, VELOCITY_THRESHOLD 0.4 (px/ms, whole-gesture average),
  SCROLL_LOCK_TIMEOUT 100, 500 ms no drag after open, `shouldDrag` walks ancestors for
  `scrollTop !== 0`, `data-vaul-no-drag`, `shouldScaleBackground`, `NestedRoot` (scales the
  parent), `handleOnly`, `repositionInputs`.
- React Aria: a real `Sheet` component now (`SheetTrigger`, `SheetOverlay`, `SheetBackdrop`,
  `Sheet`, `SheetContent`): `position` (bottom default; start / end / left / right / top),
  `swipeDirection`, `snapPoints`, `swipeAnimation` (a CSS keyframe animation tied to the
  swipe), `stackAnimation`, `preventDismissal`.

## Alternatives weighed

- **A scroll-snap sheet** (the dialog as a scroll container with two snap positions; scrolling
  the panel away closes it). The "greedy platform" answer: native physics, and the scroll-edge
  hand-off for free through scroll chaining. Not taken: needs a wrapper element and shipped
  layout CSS (the library ships none), the initial scroll position needs
  `scroll-initial-target` (Chromium only) or a script before paint, "which snap" needs
  `scrollsnapchange` (Chromium only) or `scrollend` plus measuring, a mouse cannot drag-scroll
  so desktop gets nothing, and the enter animation fights the scroll position. Worth another
  look when `scrollsnapchange` and `scroll-initial-target` are in three engines.
- **Swipe as a request** (awaited `openChangeAction(false)`, view transition for the exit in
  every engine, veto). Fails the conventions' test: the drawer is already off screen when the
  action would start; holding leaves an invisible open modal or a drawer that comes back to
  wait.
- **`requestClose()` at the release, CSS exit animates.** Simplest, and continuous in Chromium
  and Safari (the `translate` transition starts from the dragged value). Firefox has no dialog
  exit, so the drawer would vanish mid-drag. Hence "slide first, then close".
- **Inline `transform` written by the library** (vaul). Conflicts with the consumer's own
  transform and with the CSS enter; variables leave composition to the consumer.
- **`state.swiping` as React state.** JS-free mode has no place for it; `data-instant` is the
  precedent for an attribute-only, DOM-written flag.
- **A consumer-written ignore attribute** (`data-vaul-no-drag`). A new category of attribute
  for this library. `defaultPrevented` on `pointerdown` (read at the start, a task later, so a
  React handler has run) plus "another element holds capture" cover a map, a canvas, a custom
  slider. Left out; easy to add.
- **Touch only.** Would make the browser tests Chromium-only (Playwright touch) or synthetic.

## touch-action reasoning (to verify on hardware)

- Pointer Events spec: for a pan, `touch-action` is intersected from the target up to the
  nearest ancestor scroll container. So `pan-x` on the dialog does not stop a child
  `overflow-y: auto` from scrolling by touch, and does stop the dialog itself.
- The browser claims a pan inside a scroll container even when nothing overflows (the chain
  ends at the container), so the "not a candidate" rule ignores the overflow amount. From the
  spec text and memory of Chromium's behaviour, not probed.
- `pan-up` / `pan-down` would give "scroller at top: downward pans are mine" in CSS. Chromium
  only (BCD).

## For the implementer

- `useDialogRoot`: a `component` option for the types. `useDialogPopup`: a default for
  `lightDismiss`, extra owned props, a state extension, and a hook point next to
  `listenDialogDismiss` that hands out `dismiss(event)` (record intent, `requestClose()`).
- The close intent for a swipe is `{ reason: "dismiss", event: pointerup }`; the `close`
  listener already prefers a recorded intent.
- Remove the custom properties in the `close` listener and before a show, not at the release.
- Velocity: keep the last samples (time, offset), use the oldest within 100 ms of the release.
- Extent by side: bottom `vh - rect.top`, top `rect.bottom`, right `vw - rect.left`, left
  `rect.right`, measured at the start with the offset at 0.
