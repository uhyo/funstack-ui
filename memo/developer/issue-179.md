# Issue #179: flaky Firefox HoverCard row (2026-11-26)

Row: "the pointer crosses into the card and it stays; leaving both closes it after closeDelay".
CI failure: `expected <span></span> to be null` at 749 ms, i.e. the `isOpen` poll had passed and
the synchronous `queryByText("Ada Lovelace")` right after it failed.

Cause: test race, not a library bug, and not timers or shared pointer state (those would have
failed the `quietPeriod` check or timed out the poll). The lost-interest close calls
`hidePopover()`, which clears `:popover-open` synchronously; the children unmount only after the
`toggle` task makes committed `false` (use-popover-popup.ts) and React renders it. That is the
designed order (closes are facts reported by `toggle`). A poll tick that lands between the hide
and that render sees closed + content still mounted. Under CI load Firefox hit that window once.

Fix: poll the content removal too (`expect.poll(() => queryByText(...)).toBeNull()`). It still
asserts the content unmounts after the close.

Local: Firefox 10/10 runs of the file green (15 passed, 5 skipped each); Chromium green; WebKit
does not launch on this machine.
