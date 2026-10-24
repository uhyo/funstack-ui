# Issue #127: lost interest hides an interest-opened library Popover

Design: design/components/popover.md, amendment "lost interest hides an interest-opened popup
(#127)". Branch `fix/127-interest-lost`.

## Implementation

`internal/use-popover-popup.ts`, library mode: `interest` / `loseinterest` listeners (callback
ref), refs `interestInvoker`, `interestOpen`, `interestHide` (timer). The routed `beforetoggle`
open sets `interestOpen` when `toggle.source` is the remembered invoker; `toggle(closed)` and the
detach clear it. Lost interest: shown → task hide (`setTimeout(0)`, guarded on `:popover-open` and
`intended()`, `"dismiss"` intent with the `InterestEvent` recorded right before `hidePopover()`);
hidden and intended → `requestClose(event, "dismiss")`.

## Tests

- jsdom (`popover.test.tsx`, "interestfor (#127)" both modes + Trigger-less controlled row);
  helpers in `src/__tests__/interest-shim.ts` (`dispatchInterest`, `dispatchLoseInterest`,
  `gainInterest` = `interest` + `showPopover({ source })`).
- The pending-cancel rows resolve the open before the close: the harness's controlled parent
  adopts resolutions in arrival order (conventions 2.5), so an out-of-order resolve would end
  `true` in controlled mode, which is the parent's business, not #127's.
- Browser (`popover.browser.test.tsx`, last describe): Chromium hover/hover-out, Tab in / Tab out
  (popup content with nothing focusable: the dialog focusing steps focus the dialog; Tab from it
  goes to the element after the Root, `after` prop on `Library`), 600 ms cancel, Escape while
  hovered, Trigger with `interestfor`; Firefox/WebKit inert row. #125 F1 row lost its fallback.

## Mutations (all caught)

- Sync hide in `loseinterest` (no task): jsdom row 1 (hide happens before the task) and row 5
  (event `loseinterest` instead of the Escape `toggle`); browser Escape row.
- No `interestOpen` check: jsdom row 3.
- No pending cancel: jsdom row 2 and the Trigger-less row; browser 600 ms row.
- No `intended()` guard in the task: jsdom "library's own close began" row.
- Without the fix: F1 row, hover-out, Tab, 600 ms and Trigger rows fail on Chromium.

## Finding: focus return re-opened a Trigger with `interestfor`

Hover open of the default `<dialog>` Popup → dialog focusing steps focus the input. Hover-out →
task hide → 6.2 rule-2 fallback focused the Trigger → Chromium gave the Trigger interest by focus
→ the popup re-opened and stayed. arch-127 chose option A (design commit d9d3cdd): an
`interestHide` flag set in the task right before `hidePopover()`, read and cleared in every
`toggle`, skips `returnFocus` for that hide (focus stays on `<body>` when nothing was focused
before the hover, as the platform's own lost-interest hide). The timer ref is `interestHideTask`.
Mutation (drop the flag): browser hover-out row (focus `<body>`) and Trigger row (re-opens), and
jsdom row 1 (Trigger focused).

## Review fixes (memo/reviewer/issue-127-review.md)

- F1: jsdom row "after a lost-interest hide, a later dismissal returns focus to the Trigger
  again" (mutation: drop the `interestHide` clear in `onToggle` → fails).
- F2: jsdom row "an interest open closed otherwise does not make a later Trigger-click open
  interest-closable" (drop the `interestOpen` clear at `toggle(closed)` → fails); plus "a
  cancelled pending interest open ..." for the pending-cancel clear (drop it → fails).
- F4 (PO: adopt): the hide task also returns when `interestInvoker` is set again (interest
  regained before the task ran); jsdom row "interest regained before the hide task runs keeps the
  popup shown" (drop the guard → fails). **For the architect:** the amendment's task snippet
  does not show this guard yet.
- F3: one sentence added to the amendment's accepted-staleness note (a controlled parent refusing
  an interest open leaves `interestOpen` stale, harmless for the same reason). **For the
  architect** to confirm the wording.
- F5, F6: no change (F6 accepted by the lead as following the design).

## Release notes

fix: a library-mode Popover opened by an `interestfor` button now hides on lost interest
(Chromium), and lost interest during a pending open cancels it (#127).
