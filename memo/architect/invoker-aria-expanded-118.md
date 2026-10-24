# #118 invoker `aria-expanded`: notes (2026-10-24)

Decision: option A of `docs/research/invoker-aria-expanded.md`, extended to `Combobox.Input`.
`aria-expanded` = committed (shown) state on Popover/Menu/Combobox Triggers and the Combobox
Input; `data-open` / `state.open` stay optimistic. Amendments in popover.md (grounds, engine
table, implementation, tests), menu.md, combobox.md; conventions 3.2 (bounded rule), 4.1 `open`
row, 7.3, decision 40.

Why the Input too: one widget, one listbox, one answer. Its explicit attribute wins everywhere
(no invoker), so leaving it optimistic would have made it the odd part out after the Trigger
change. APG combobox: `aria-expanded` tracks the popup being visible.

Why not A' (also DOM-write in library mode, closing the Firefox dismissal window): second writer
for a React-rendered attribute; the window is Firefox-only and bounded; #514 is heading toward
"user agents ignore the attribute"; E removes the attribute. Revisit only on screen-reader
evidence. Note for the record that A' would be consistent (React patches only changed props, so
a DOM write to the value `committed` is about to become never conflicts).

The one phase where the attribute lags the DOM after A: the platform path (pre-hydration open,
popup already shown, `committed` false until the `"platform"` dispatch settles). Firefox reads
`"false"` for a shown popup there; Chromium/WebKit are right. Recorded in the walkthrough.

Option E (`popovertarget`, no `aria-expanded`) is in its own issue; trade-offs to carry over:
- `popovertarget` is typed by `@types/react` (`popoverTarget`, `popoverTargetAction`), so the
  7.4 augmentation row loses `command` / `commandfor` for Triggers (Close may keep them).
- No `command` event from the library's own Trigger; `use-popover-popup.ts` `onCommand` only
  matters for foreign invokers, which may still use `commandfor`. Foreign `popovertarget`
  invokers already read as `"dismiss"` today.
- Light-dismiss exemption: HTML's "topmost clicked popover" covers both attributes; the #112
  reviewer's probe verified `popovertarget` on Chromium and Firefox; WebKit's
  `handlePopoverLightDismiss` checks both. Re-run the #112 browser rows on WebKit CI.
- Implicit anchor: "show popover" sets it from the invoker for both attributes; verify the Menu
  positioning rows.
- `ToggleEvent.source` is set for both.
- JS-free styling: consumers styling `[aria-expanded="true"]` in JS-free mode lose the hook (no
  `data-open` there); offer `button:has(+ [popover]:popover-open)` or a DOM-written `data-open`.
- Test observability: jsdom cannot see the implicit state; the Chromium CDP row becomes the
  only state assertion (Firefox/WebKit untestable in CI for this).
- WebKit quirk (research upstream report 2): an invoker inside its own popover gets
  AXExpanded=YES; affects `Popover.Close` whichever attribute it uses. Confirm in Safari.
- Vision: `popovertarget` is the older, more widely supported attribute; moving the Trigger
  back to it is not a modernity loss, the Close keeps the command.

When w3c/html-aria#514 merges: recheck Gecko's OR for `popovertarget` and axe-core #4837; the
#118 decision stands either way, E becomes more urgent.
