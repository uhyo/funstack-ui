# #122 slow openChangeAction docs examples

Docs-only: `PopoverSlowOpen.tsx`, `MenuSlowOpen.tsx`, `ComboboxSlowOpen.tsx` (2 s `openChangeAction`,
always on), anchors `#slow-open-change-action` on /components/popover, /components/menu,
/components/combobox (in "Optimistic and pending").

Observed in Chromium (Playwright, CDP `Accessibility.getPartialAXTree` on the built site):

- Pending open: `data-open` + `data-pending`, popup hidden, AX expanded=false. Settles: shown, true.
- Part-initiated close (Trigger, Close, item, accepted option): `data-open` drops at once, popup
  stays shown, AX expanded=true until the action settles.
- Escape / outside click: hidden and AX expanded=false at once; Trigger (and Combobox Input)
  `data-pending` while the dismiss notification runs.
- Submenu: own openChangeAction, hover and ArrowRight both wait for it.
- Combobox Input `aria-expanded` follows `shown` (urgent mirror), same as the Trigger.

The "Firefox gap" text in #122 predates #121: button Triggers now render `popovertarget` and no
`aria-expanded`, and Gecko maps `popovertarget` natively (bug 1867811), so no stale explicit
attribute remains on buttons. Not measured in Firefox AX (Playwright has no AX API there).

Serving the built docs locally: `/components/popover.html` 404s in the client router; need a
server that maps `/components/popover` to the .html (scratch `srv.mjs`).
