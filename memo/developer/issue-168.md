# #168 Drawer (developer notes)

Branch `feat/168-drawer`, from `design/168-drawer` (837cff30) + master.

## Shape of the code

- `internal/swipe-arithmetic.ts` (constants + pure functions, unit-tested) and
  `internal/swipe.ts` (the tracker: `trackSwipe(element, { press, extent, start, move, end })`,
  returns `{ dragging, cancel, dispose }`). Flat, directive-free, no dialog knowledge: Toast's
  reserved `swipeDirection` can use it with `data-ending` as the close.
- `drawer/drawer-swipe.ts`: the glue (candidates of 4.1 / 5.1, direction incl. computed
  `direction` for inline sides, extent, the three custom properties, `data-swiping`, the release
  that waits for `exitAnimations(dialog, baseline)` then `dismiss(event)`; `beforetoggle` closed
  aborts a drag; `close` removes the properties; `beforetoggle` open clears stale ones).
- Dialog hooks gained: `useDialogRoot({ component })`, `useDialogPopup({ ownProps,
  attachDismiss })` (attachDismiss gets `dismiss(event)` = record `{ reason: "dismiss", event }`
  + `requestClose()`), `DialogCloseRegistry` context (dev only) that `useDialogClose` reports to,
  for the "no Close" warning.
- `Drawer.Popup` wraps className / style / children / render to add `side` to the state rather
  than making `useDialogPopup` generic.

## Findings (engines)

- Chromium: under pointer capture a mouse drag selects nothing, also when it starts on text.
  With Playwright's moves the selection is still collapsed when the slop is crossed, so the
  design's "a mouse press has produced a text selection" refusal practically never triggers.
- Firefox: the selection of the press keeps extending under pointer capture (from padding too:
  Firefox starts a selection at the nearest caret). Added: while dragging, a selection made
  since the press is removed on each move (design 4.1 Move row amended).
- Chromium coalesces a flick's moves (one pointermove per frame); the press is the first
  velocity sample so a flick whose moves were coalesced into the starting move still counts.
- Playwright `mouse.move(x, y, { steps })` is paced at one step per frame (~16 ms). A flick test
  needs the release in the same command (`mouse.up(x, y, "left", steps)`), else the command
  round-trip before `up` eats the 100 ms window under load.
- Under a full `pnpm test:run` (jsdom + browser in parallel) even one-command gestures were too
  slow for 0.5 px/ms. The flick and reversal rows now record the events the engine delivered,
  compute the tracker's decision from them with the pure arithmetic, assert the drawer agrees,
  and retry (5 attempts) until an attempt was the gesture the row is about; with
  `strictInputTiming` (vitest `provide`, true when `CI` is set) a row with no qualifying attempt
  fails, locally it passes on the agreement alone. Commands:
  `mouseFlick(from, to, steps)` (press, moves, release in one command) and `mouse.up(x, y,
  button, steps)` (moves then release in one command).
- Click after a mouse drag that started on a button lands on the `<dialog>` (Chromium, Firefox,
  WebKit via CI).
- The release wait works in Firefox: `exitAnimations` lists the `translate` transition the
  custom-property write starts (the dialog is still open right after the release).
- RTL: logical insets on a top-layer dialog follow its inherited direction (Chromium, Firefox,
  WebKit via CI).
- The design's starter CSS had a specificity bug: `.drawer[data-side="inline-end"]:dir(rtl)`
  (0,3,0) beats `.drawer:open` (0,2,0). Closed positions go in `:where()`.
- Computed overflow pairs axes: `overflow-y: auto` makes `overflow-x` compute to `auto`, so a
  vertical list in a side drawer is a horizontal scroll container (not a candidate). Documented
  in drawer.md 5.1 and the docs page.

## Verification

- Local browsers: Chromium + Firefox (`FUNSTACK_BROWSERS=chromium,firefox`); WebKit lacks host
  libraries here. Branch CI `gh workflow run ci.yml --ref feat/168-drawer`: run 45832112889
  green on all jobs (ci, chromium, firefox, webkit) at e7ea916a.

## Human device checks (real touch hardware)

1. iOS Safari, Android Chrome, Android Firefox: a touch pan inside the bottom sheet's
   `overflow-y: auto` body scrolls it although the Popup has `touch-action: pan-x pinch-zoom`;
   a vertical touch drag on the header / grabber / footer keeps delivering pointer events and
   drags the sheet (no `pointercancel`).
2. No `click` is synthesised on the button a touch drag started on (drag from "Apply" in the
   docs example: the action must not run).
3. A horizontal touch drag on a side drawer (`pan-y pinch-zoom`) drags it; vertical scrolling of
   the side drawer's own content still works by touch.
4. The side-drawer list recipe (`overflow-x: hidden; touch-action: pan-y` on a child scroller)
   lets a horizontal swipe start inside the list.
5. Pinch zoom still works on a drawer (the `pinch-zoom` keyword).
6. iOS Safari edge-swipe back navigation versus a left / inline-start drawer swipe.
7. After the slide, the CSS exit in Safari shows no jump (CI WebKit is green on the "no jump"
   row, but on a phone with a 300 ms transition it is worth a look).
8. Pen input (Apple Pencil, Surface pen): a pen drag swipes, a pen tap clicks.
9. A view transition that starts during a drag (a content swap): does the engine cancel the
   pointer? Not probed.
