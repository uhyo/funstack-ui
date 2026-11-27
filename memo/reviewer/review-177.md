# Review: #177 non-modal Dialog Escape vs inner manual HoverCard / Tooltip

Branch `fix/177-dialog-escape` at f46cca10, against origin/master. Verdict: **acceptable with
fixes**. The ordering fix is right and the tests catch the bug. One regression (closed shadow
root) must be fixed, and the stopPropagation side effect needs an architect decision.

Verified: jsdom dialog/drawer/hover-card/tooltip (614 pass); new browser rows on Chromium and
Firefox pass; CI on f46cca10 green (WebKit included). With master's `dialog-dismiss.ts` the 4
new jsdom rows and the 4 non-modal/`hint false` browser rows fail (Chromium, Firefox): the rows
pin the bug. Nested non-modal in non-modal and an open shadow root checked with a scratch row:
correct.

## Must fix

1. Closed shadow root regression, `packages/ui/src/dialog/dialog-dismiss.ts:28-30` and `:76`.
   At the window, `composedPath()` leaves out nodes inside a closed shadow tree, so
   `path.indexOf(dialog)` is -1 and the dialog never closes on Escape. Scratch jsdom row (Dialog
   portalled into `attachShadow({ mode: "closed" })`): fails on the branch, passes on master.
   The library already supports a dialog inside a shadow root (dialog.md 2.x, the `submit`
   listener on `getRootNode()`, `dialog-popup.tsx:476`). Fix suggestion: keep a bubble listener on
   the dialog that runs the inner-layer check (where `target` and the path are not retargeted)
   and records the event in a WeakSet; the window listener only checks
   `seen.has(event) && !event.defaultPrevented && dialog.open`. Add an open + closed shadow root
   row.

## Needs the architect

2. `stopPropagation()` now cancels a non-modal Dialog's Escape, `dialog-dismiss.ts:72-77`. Any
   listener between the target and the window that stops propagation, including a React
   `onKeyDown` with `e.stopPropagation()` on an ancestor **outside** the dialog (React calls the
   native `stopPropagation()` at the root container, which is below the window), now keeps every
   non-modal Dialog/Drawer open. A modal dialog's close watcher ignores `stopPropagation()`
   (only a canceled keydown matters), and so do the `auto` overlays (Popover, Menu, Combobox,
   MultiSelect, Select). The changelog and dialog.md 2.6 / section 9 say the rule is "as a modal
   dialog's close watcher", which holds for `preventDefault()` only; the stopPropagation part is
   in memo/developer/issue-177.md but not in the design or on DialogPage. There is precedent for
   treating `stopPropagation()` as a consumer opt-out (`submit`, `dialog-popup.tsx:369`), so it
   is defensible, but it is a public behaviour change: the architect should ratify it and
   dialog.md 2.6 plus `packages/docs/src/pages/DialogPage.tsx:550-554` should state it. No row
   pins it either way.
3. The rule edits in dialog.md 2.6 / section 9, hover-card.md 2.6 and tooltip.md were made
   without the architect. Content is consistent with overlay-open-state.md (no Escape layering
   rule there) and conventions; ask the architect to confirm together with 2.

## Should fix (tests)

4. No row for two non-modal dialogs (nested or siblings), now that each adds a window listener,
   `dialog.test.tsx:405-532`. The logic is right (scratch row: inner closes, outer stays, then
   outer closes); pin it.
5. No row for the stopPropagation behaviour (whatever 2 decides).
6. Not mentioned but also fixed: Combobox chips prevent Escape so that "the close request of an
   enclosing Dialog or Popover is not run" (`combobox/combobox-root.tsx:1123-1126`); before
   this branch a non-modal Dialog closed anyway (its element listener ran before React's root).
   Worth a row and a changelog clause.

## Nits

7. `dialog-dismiss.ts:76-77`: the window listener is installed for every mounted non-modal
   Popup, open or not; attach while open only (like `syncOutside`) to keep N closed dialogs from
   adding N window listeners.
8. `design/components/dialog.md:62` of the diff (2.6 paragraph): one line is far longer than
   the surrounding wrap.
9. Browser rows non-modal + `hint true` (`dialog.browser.test.tsx:573-577`) exercise the fix only
   in WebKit (Safari 27.0 maps to manual); elsewhere the hint close watcher already handled it.
   The comment says so; fine.
10. Pre-existing, follow-up issues rather than this branch: the dialog Escape listener does not
    skip `isComposing` (HoverCard does); Tooltip's document Escape listener
    (`tooltip/use-tooltip-interaction.ts:150-159`) does not check `defaultPrevented`, so it hides
    on an Escape a Combobox chip already consumed.

## Re-review, fix/177-dialog-escape at 75f05880

Verdict: **acceptable**. The capture record / per-event window decide / `afterDispatch` late path
matches the two architect entries (cca8d3c0, ccd1b419), with no deviation.

- Must-fix 1 (closed shadow root): fixed, since the path is read at the dialog. Covered by
  `dialog-escape.test.tsx:105-147` (open + closed, with and without a HoverCard).
- Needs-architect 2/3: decided (preventDefault cancels, stopPropagation does not) and written
  into dialog.md 2.6, the section 9 rows and DialogPage.
- Should-fix 4-6: nested and sibling rows (:149, :171), stopPropagation rows (:190-264, plus
  browser rows for a real key and an `auto` popover), Combobox chip row (:266).
- Nit 7 (listener leak): fixed. A window listener exists only during one Escape's dispatch,
  and cleanup removes the capture listener, the window listener and the late call. Covered by
  :340-397.
- Verified: jsdom dialog/drawer/hover-card/tooltip/combobox 1006 pass; browser dialog +
  hover-card on Chromium and Firefox 168 pass; lint and typecheck clean. Mutation: with
  f46cca10's dialog-dismiss.ts 8 of the 16 new rows fail, including both closed-shadow rows;
  with the old HoverCard `containsOpenLayer` the dialog-inside-card row fails.

Nits:

- Merge order. `internal/after-dispatch.ts:4` cites "internal-hooks.md 3.8 rule 5" and
  dialog.md 2.6 cites "conventions 3.8 rule 5", but on this branch rule 5 is "Reset reads
  `defaultChecked`". The rule exists only on review/185. The lint resolves section numbers,
  not rules, so it passes. If #177 merges first, the citation points at the wrong rule until
  #185 lands; the `directives.test.ts` row is deferred the same way.
- Re-entrancy (`dialog-dismiss.ts`, `record`): a listener that synchronously dispatches
  another Escape inside the dialog during the first one's dispatch replaces the pending
  record, so the outer Escape is dropped. The comment "the old event's dispatch is over" does
  not hold in that case. This is rare; a comment is enough.
- The follow-ups from nit 10 still stand (`isComposing`; Tooltip's `defaultPrevented`). File
  them as issues.
