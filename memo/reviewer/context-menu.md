# Reviewer memo: Context menu (`Menu.ContextTrigger`, #45, wave 10 #86), 2026-10-22

Reviewed on master: 27c6c11 (Menu.ContextTrigger), dc64c68 (docs page), 9c69548 (playground),
1cbabf4 (act fix in the tests). Design: `design/components/context-menu.md` (accepted, e8377ba),
the amended `menu.md`, conventions 12. The developer's deviations are in
`memo/developer/context-menu.md`.

Verdict: **acceptable with fixes.** H1 must be fixed before the next release. It is a real
activation loss for keyboard and assistive-technology users after a touch long-press. M1 should
be fixed in the same pass. The rest of the work is careful and close to the design. The pointer
capture is proven to matter, the move and the flip reset work in real engines, the outside
right-click and middle-click close does not regress Menu, and the shipped `<style>` matches
conventions 12 exactly.

Checks run:
- typecheck, lint and format:check are clean.
- jsdom `src/menu` + `src/internal`: 434 passed.
- Browser `src/menu` on Chromium and Firefox: 99 passed, 3 skipped (the Chromium-only CDP
  row). WebKit does not launch on this machine. CI run 39780281716 at 1cbabf4 is green on all
  three engines, WebKit included.
- Probe, since reverted: with `capturePointer` turned into a no-op, both "survives the pending
  pointerup" rows **fail in Firefox**. The rows really test the workaround; they do not pass
  by timing.
- Two temporary jsdom probes, since deleted, confirmed H1 and M1. Details are in each finding.

## Findings

### H1. The long-press click swallow eats the next keyboard or AT activation
- Where: `packages/ui/src/menu/menu-context-trigger.tsx:155-170` (`armClickSwallow`), armed at
  `:232`.
- What: the swallow is a document capture `click` listener. Only the next `click` or the next
  `pointerdown` disarms it, so it outlives the gesture. Design walkthrough 5 says that on iOS
  "no click is synthesised after a long-press". The usual case is therefore: the menu opens,
  the finger lifts, no click comes, and the swallow stays armed. The next *keyboard* activation
  is then swallowed. Menu items activate through `element.click()` (`use-menu-item.ts:61`), so
  Enter or Space on an item does nothing. Assistive-technology activation that dispatches a
  bare `click` with no `pointerdown` (Switch Access, or a screen-reader double-tap where it is
  not routed through pointer events) is swallowed the same way. The swallow also survives the
  menu closing, so the first keyboard "click" anywhere in the document is silently dropped.
- Confirmed (jsdom probe): a long-press opens the menu, then a `pointerup`, then Enter on the
  first item gives 0 activations. The same Enter after a right-click open gives 1.
- Why it matters: anyone who opens by long-press and then picks an item without touching the
  screen again loses the first choice with no feedback: a keyboard user on a tablet, or an AT
  user whose activation is a bare `click`. The keyboard case is certain; the AT cases depend
  on how the engine routes the activation and have not been measured.
- Fix: scope the swallow to the click that the release of *that* pointer could produce.
  - Arm on the timer, as now.
  - On the `pointerup` or `pointercancel` of `pointerId` (a document capture listener; the
    `pointerup` targets the popup because of the capture), wait one macrotask and disarm. The
    synthesised click is dispatched in the same task as the `pointerup`.
  - Also disarm on `keydown` and when the menu closes.
  - Add jsdom rows: "Enter on an item after a long-press open activates it", and "a click after
    the release task is not swallowed".

### M1. A long-press inside another menu that sits inside a region opens the region's menu
- Where: `menu-context-trigger.tsx:176-179` (`fromOwnPopup` checks only this Root's popup) and
  `:216-218`.
- What: a right-click inside *any* `Menu.Popup` is safe, because the Popup's owned
  `onContextMenu` prevents it and the region then sees `defaultPrevented`. A long-press has no
  such signal. A `Menu.Popup` of another Root rendered inside a region is not covered: a nested
  region's Popup, a toolbar dropdown, or any Menu in a card. A touch long-press on one of its
  items starts the outer region's timer. The outer menu opens, and the inner menu closes.
  - Confirmed (jsdom probe): an outer region contains an inner Root (Trigger + Popup). The
    inner menu is opened, then a touch `pointerdown` on its item is held 600 ms. Result: outer
    `openChangeAction(true)` fires and the outer popup is open.
  - The playground's "Archive" card (`packages/example/src/menu-demo.tsx`, the nested region
    with its Popup inside the card region) has exactly this shape.
- Fix: give the long-press the same rule as `contextmenu`. Either:
  - have every `Menu.Popup` claim the `pointerdown`s inside it (move `claimedPresses` to
    `menu-context.ts` and add to it from the Popup with a native `pointerdown` listener or an
    owned handler), or
  - have the region skip targets inside any `[role="menu"][popover]` that is a descendant of
    the region.
  Add a jsdom row for it.
- Related, Low: a right-click inside a non-menu popup rendered in a region (a Select listbox, a
  `Popover.Popup`) opens the region's menu and the auto-popover stack closes that popup. This
  is defensible, but worth one sentence in the docs, or the same "ignore popovers inside the
  region" rule.

### L1. A refused or rejected point open leaves the point placement on the closed popup
- Where: `packages/ui/src/menu/menu-popup.tsx:296-302`. The reset requires
  `shownPoint.current === point.generation`, so it only runs for a point that was shown. The
  placement itself is written urgently at `menu-root.tsx:150-157`.
- What: after a rejected `openChangeAction(true)`, or a controlled Root that never sets `open`,
  the closed popup keeps `data-context`, the point inline style and `state.context === true`.
  A later controlled `open={true}` that sends no dispatch opens at the stale point. Docs and
  types call `context` "committed", but it is also true on a closed popup during a pending open
  (because of the urgent write).
- Fix: reset when nothing is intended or in flight and the popup is not visible, instead of
  "was shown". For example: `!visible && !popover.pending && !popover.intended()`. Or say in the
  docs that `data-context` describes the last placement until the next open.

### L2. The modality bookkeeping hears keydowns in the capture phase but pointerdowns in the bubble phase
- Where: `menu-context-trigger.tsx:133-139` (native `keydown` capture) against `:208-209` (React
  `onPointerDown`, bubble).
- What: a descendant that stops `pointerdown` propagation (a slider, a drag handle, a canvas
  library) hides the press. A right-click after earlier typing in the region then counts as a
  keyboard open and shows the focus ring. The effect is cosmetic.
- Fix: record `pointerdown` in the same ref-attached capture listener, and keep the owned React
  handler for the long-press only.

### L3. Docs: a Popup inside the row bubbles its events to the row
- Where: `packages/docs/src/pages/ContextMenuPage.tsx:102-107`, and the comment in
  `packages/docs/src/examples/ContextMenuFiles.tsx`.
- What: with the Popup in a cell (deviation 5), clicks, keydowns and pointer events inside the
  menu bubble to the `<tr>` through both the DOM and React. A row `onClick` (selection) also
  fires on item clicks, and `.row[data-open] *` or `.row:hover` selectors reach the menu.
- Fix: one sentence in the docs, for example "events inside the menu bubble to the row: check
  `event.target` in row handlers".

### L4. Test hygiene
- `menu-context-trigger.browser.test.tsx:80-86`: 1cbabf4 removed the afterEach that released a
  stuck right button. In Firefox, files share one mouse (#62), so a row that fails between
  `mouse.down` and `mouse.up` can cascade into the following rows. Restore a bounded release
  (`commands.mouse("up", …)` directly, without the `inputHandled` wait).
- No browser row covers a *move with the button still held* (deviation 9, the re-capture after
  `reshow`). Add the "survives the pending pointerup" shape to the move: press at a new point,
  move away, release, still open.
- The move and ViewTransition absence assertions (`sleep(50)` before `calls.length` checks) are
  fixed waits. They are acceptable for "nothing happened" assertions, and every positive
  assertion uses `expect.poll`.

### L5. Design text to amend (architect)
The implementation is right and the accepted design text is now out of date:
- 1 and 11.1: the `<tr>` example is invalid HTML.
- 3.1 and 14: the placement is written urgently, not in a transition.
- 4.3: a re-show keeps the open generation.
- 2.4: the long-press nesting rule (and M1's fix).
- 13.1 and 14: the `setPointerCapture` stub is local to the test file.
- 13.2: the ViewTransition count for the outside close is 1.
- `MenuRegionContext`.

## The developer's deviations

1. **Placement written urgently.** Accepted. Placement is internal geometry, not a consumer
   state change, and nothing is dispatched for it. A move should answer the right-click at
   once, as native menus do. Entangling it with an unrelated pending item action would freeze
   the menu at the old point. The one cost is L1.
2. **Placement reset rules.** Accepted. Resetting in `onDispatch` for every non-point open, and
   in the Popup only after the exit animation, is better than the design: a controlled or
   platform open is anchored, and a CSS exit does not jump. It needs L1's extra condition.
3. **Longhands instead of `inset`.** Accepted. The effect is the same, and it avoids React's
   warning about mixing a shorthand with its longhands.
4. **A re-show does not advance the open generation.** Accepted, and needed. Without it,
   `closeStackLater` would drop the close of an item action that is pending across a move.
   This was verified by the jsdom row "a move keeps a pending item action running".
5. **The Popup may be inside the region.** Accepted. The design's `<tr>` sibling is invalid
   HTML (a `<div>` in `<tbody>`) and breaks SSR. `fromOwnPopup` handles it for this Root, but
   other Roots' popups are not covered (M1). The docs need L3.
6. **`MenuRegionContext` silences the nested-Root warning.** Accepted. Nested regions are a
   designed case (2.4). The context also reaches deeper descendants, so a genuinely misplaced
   Root inside a region is no longer warned about. That is an acceptable loss, since nothing
   can tell the two cases apart.
7. **The inner region wins for long-press too.** Accepted. It mirrors `contextmenu`'s
   `defaultPrevented` rule: a disabled inner region or an editable target that is not claimed
   falls through to the outer region, as a `contextmenu` would.
8. **The ViewTransition row counts 1.** Accepted. This matches Escape in
   `menu.browser.test.tsx`: the dismissal's notification commit runs a view transition with the
   popup already hidden. Design 13.2 should say so (L5).
9. **The jsdom `setPointerCapture` stub is local to the test file.** Accepted. A shim stub broke
   the Slider and NumberField suites, which install their own stubs only when the method is
   missing.
10. **Pointer re-capture after a move, and the `mouse` browser command.** Accepted.
    - The re-capture is defensive (a hidden element stays connected, so capture should
      survive), harmless (`setPointerCapture` is a no-op with no button down, and the
      `NotFoundError` for a lifted touch is caught), and untested (L4).
    - The `mouse` command is generic and maps frame coordinates correctly. Its `inputHandled`
      wait follows the event, not a clock. The 5 s fallback only bounds a press that produced
      no event.

## Focus areas

- **Accessibility.**
  - No ARIA on the region; the server HTML is a plain element with the touch-callout style.
  - The Popup keeps `role="menu"`. A context-only Root has a dangling `aria-labelledby`, but
    the dev check warns when no `aria-label` is given, which enforces rule 3.
  - The first item is focused quietly after a pointer open and with the ring after the keyboard
    (real Shift+F10 in Chromium; in Firefox, a real Tab plus the dispatched event). Escape
    returns focus to the focused button, `<body>`, or the Trigger, by the design's rules. All
    of this is covered in the browser rows.
  - The three rules are above the fold on the docs page.
  - H1 is the one a11y defect.
- **Engines.**
  - The capture is proven to matter (probe above).
  - The flips, the transformed ancestor and the stale-flip reset are measured in real engines.
  - Every Menu now closes at once on a right- or middle-click outside, and
    `menu.browser.test.tsx` still passes on Chromium and Firefox (CI: all three).
  - Long-press: pan → `pointercancel` cancels, the slop is 10 px, and there is no
    `touch-action`. The callout is suppressed inline; `user-select` is left to the consumer and
    documented.
  - An Android `contextmenu` that arrives after the timer has opened the menu is handled as a
    move at the same point: no native menu and no second dispatch. Acceptable.
- **Shipped `<style>`.**
  - It is rendered only for a point placement with `side !== null`, hoisted and deduplicated
    (jsdom and browser rows).
  - It contains only three `@position-try --fsui-*` at-rules (unit test).
  - It never appears in the server HTML (the placement is anchored on the server).
- **Conventions.**
  - No `on*` props were added; the owned keys match design 3.2 and 3.3.
  - Reasons: `activate` for the open, `dismiss` for the outside close.
  - The directive test lists `menu-context-trigger`.
  - Before hydration the native menu shows.
- **Docs.**
  - The props tables match the declarations: ContextTrigger's three props plus
    className/style/children/render; the Popup additions; Root `state.context`.
  - The browser notes cover every item in the design's section 12 list.
  - The Menu page paragraph and the `side` description are updated.

## Must-fix
1. H1: scope the long-press click swallow (disarm after the release task, on keydown and on
   close), with jsdom rows.
2. M1: a long-press inside any `Menu.Popup` in a region must not start the region's timer,
   with a jsdom row.

The others (L1 to L5) can follow in the same pass or be filed as follow-ups.
