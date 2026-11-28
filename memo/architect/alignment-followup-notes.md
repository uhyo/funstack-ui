# #199 follow-up (reviews of #201 / #202), working notes

2026-11-28. Branch `design/alignment-followup`. The record is the CHANGELOG entry
"2026-11-28, #199 follow-up: four rules the reviews of #201 and #202 left open (design)".

- Handler survey method: for every non-test file, the `on*` keys that appear as object keys
  (the library props) against the `"on*"` strings of the file's `Omit`. Parts whose handlers
  come from a shared hook (`usePopoverTrigger`, `useOverlayClose`, `use-menu-item.ts`) need
  the hook's keys checked against the part's type by hand. A lint script could do this
  (`scripts/`, beside `check-design-refs.mjs`); not written.
- Rule B (omit what the part passes) was chosen over rule A (omit by what the handler does).
  The issue text leaned to A. Flagged for the user in the entry.
- `Field.Label`'s handler reads `event.defaultPrevented`, and `Form.Root` honours a prevented
  `onSubmit` from the `render` element. So "the library's handler cannot be cancelled" is not
  true of every part; 1.5 no longer says so.
- `Form.Submit` does not omit `aria-disabled` (owned, takes `disabled`). In the checklist.
- Toggle's missing `aria-disabled` omit (align-202 finding 1) is a code fix, not a rule; not
  in this entry.
- Not checked in a browser: whether Chromium with `focusgroup` really double-moves when the
  JS engine also handles the arrow key (the engine calls `preventDefault()`; the native
  handler may respect it). The entry says "not measured". The ownership holds either way (the Toolbar
  Tab-stop split is certain).
