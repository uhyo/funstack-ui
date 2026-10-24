# Review: #125 foreign popovertarget close is "activate" (branch feat/125-toggle-source)

Verdict: **acceptable with minor fixes** (F1 and the one-line part of F2 before merge).

Probes: Chromium 156, Firefox 157 (Playwright, page probe + vitest browser probe on the branch).
WebKit would not launch locally; CI's WebKit job is green.

## Verified correct

- Own parts never close with a source: Popover/Menu Trigger, Close, Combobox.Trigger, SubmenuTrigger
  all preventDefault their click in library mode; library closes are `hidePopover()` (source null).
- Engine rows (Chromium + Firefox identical): nested child hidden by a parent's popovertarget close
  -> child source null, parent source = button (also when the button sits inside the child);
  another auto popover opening (keyboard Enter on its popovertarget, or `showPopover({source})`)
  hides the first with source null; light dismiss, Escape, `togglePopover({source})` hiding -> null;
  commandfor hide-popover -> command event, then beforetoggle/toggle with source = button.
- Open path unchanged. Engines without `source`: `toggleSource` is undefined -> "dismiss" as before.
- Shims: source on show/hide for popovertarget and commandfor, null for hidePopover(),
  togglePopover() hiding and nested hides, coalesced toggle takes the latest: matches HTML.
- Mutations (jsdom): drop `unlessRecorded` -> 4 fail; drop the source check -> 21 fail. Rows
  fail for the right reason.
- #126 is out of scope; docs only claim "activate" for Popover; popover.md 2.3 scopes Menu/Combobox
  correctly.

## Findings

F1 (medium) interestfor lose-interest closes become "activate" on Chromium.
`use-popover-popup.ts:308`. Probe: `<button interestfor=A>` hover-out / blur hides A with
`beforetoggle.source === button` (Chromium 156). A consumer's interestfor on a library Popover
(hover card) now reports a pointer leaving as "activate"; conventions.md 3.x lists "the pointer
leaving" under "dismiss". Fix: record only when the source is this popup's popovertarget invoker,
e.g. `(source as HTMLButtonElement).popoverTargetElement === element` (commandfor is already covered
by onCommand). Update the popover.md 2.3 row ("null for Escape, light dismiss and script" is
incomplete). Optional Chromium-only browser row behind the interestfor feature check.

F2 (medium, pre-existing; #125 makes it reach the new row) stale intent from a hide-popover command
on a closed popover. `use-popover-popup.ts:354` records for any `hide-popover` command, but engines
fire `command` regardless of state (HTML: "element state is not considered"; probe: Chromium and
Firefox fire it at a hidden popover). `clearLater` keeps it (popup not shown), so the next close is
misreported: confirmed on the branch in Chromium + Firefox: foreign hide button clicked while closed,
open via Trigger, Escape -> `activate` + old CommandEvent; with `unlessRecorded`, a later
popovertarget close also gets the stale CommandEvent. The jsdom shims mask it:
`popover-shim.ts:221-222` (and `dialog-shim.ts:111-114`) make validity state-dependent, contrary
to the spec. Fix: `command === "hide-popover" && isPopoverOpen(element)` (as toggle-popover);
make the shims' isValid state-free (the run step already checks validity) and add the row.
Dialog JS-free `recordCloseIntent` at `dialog-popup.tsx:357` has the same shape: follow-up issue.

F3 (low) `menu.browser.test.tsx:1018-1022`: the new describe sits between the #110 comment block
and the "Trigger click while open (#110)" describe it documents. Move it above the comment.

F4 (nit) `use-overlay-root.ts:23`: "names no cause beyond a `popovertarget` invoker" - commandfor
(and interestfor) set source too; popover.md 2.3 prose already says it right.
