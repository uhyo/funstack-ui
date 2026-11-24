# #156: refused re-open of a `<dialog popover>` no longer moves focus (2026-11-24)

Option (d) of `memo/architect/156-refused-reopen-focus.md`, chosen by the user. Branch
`fix/156-inert-reshow`.

## Change

- `packages/ui/src/internal/use-popover-popup.ts` `showPopup`: the `tagName !== "DIALOG"`
  exclusion on `refusedFact` is gone (a refused re-show of any element resolves no initial focus,
  writes no `autofocus`). For every popup element (`<dialog>`, `<div>`, Menu, Combobox), and
  only when it has no `inert` already, `inert` is set before `showPopover()` and removed in the
  same `finally` that removes the `autofocus`. First version did it for `<dialog>` only; the
  coordinator asked for every element so a consumer's own `autofocus` in a `<div>` popup cannot
  break the rule (jsdom row added, verified failing with the dialog-only condition). Dialog
  (`dialog-popup.tsx`) untouched.
- jsdom popover shim: the focusing steps return early when the popover is inside `[inert]`
  (jsdom ignores `inert`).

- Review 156 L1 (memo/reviewer/review-156.md): non-modal Dialog. `dialog-popup.tsx` now has its
  own `refusedFact` (set in `onClose` for a fact, cleared by a `committed` false commit), and
  `openDialog` for `!modal` skips initial focus and wraps `show()` in the same `inert` write.
  Modal (`showModal`) unchanged. jsdom dialog shim's focusing steps honour `inert`. jsdom rows
  in `dialog.test.tsx` focus (non-modal, non-modal + consumer inert, modal unchanged); the
  non-modal row fails with the write disabled.

## Tests

- jsdom `popover.test.tsx` focus: refused dismissal re-shows the dialog with `inert` during the
  call only, outside input keeps focus, no blur; with the consumer's `inert` prop the attribute
  stays; a `<div>` popup with a consumer `autofocus` child (set by ref, React drops `autoFocus`)
  keeps focus on the outside input (plus a shim check that the open itself focuses that child).
  The shim models `autofocus` for non-dialog popovers and `inert`, so no browser row was needed.
- browser `popover.browser.test.tsx` focus: the refused-Escape row now expects the Trigger for
  both `<div>` and `<dialog>`; new row: click an outside input, fact `false`, re-show, focus on
  the input, events exactly `inner:blur, outside:focus`, selection set at `click` (before the
  `toggle` and the re-show) is kept `[2,4]`, typed key replaces it, no `inert` left, inner input
  focusable afterwards.
- Verified the two browser rows and the jsdom row fail with the `inert` write disabled.
- WebKit not run locally (cannot launch). No `server.browser` branch: the spec says it works; CI
  decides. If WebKit fails the new rows, per the architect memo fall back to asserting today's
  behaviour there (option (a) for WebKit), not to `.focus()`.

## Docs

design/components/overlay-open-change.md 2.4, design/components/popover.md 6.1, docs
PopoverPage callout and BrowserOwnedStatePage paragraph (exception removed; Dialog keeps the
focusing steps).
