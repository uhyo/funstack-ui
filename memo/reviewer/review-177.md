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
