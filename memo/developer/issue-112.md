# #112 Combobox Trigger close (developer notes)

Branch `fix/112-combobox-trigger-close`.

- Trigger writes `commandfor` / `command="toggle-popover"` in its ref callback (button only),
  cleanup removes them; non-button `render` gets a one-time `useElementCheck` warning.
- `onClick` cancels first, then toggles on `intended()`. Snapshot / `onPointerCancel` /
  `detail === 0` branch removed. Two jsdom rows that pinned the old snapshot behaviour were
  deleted (they asserted the removed path: a click after a dismissal now opens, judged on
  `intended()`, covered by the new "toggles against the intended state" row).
- Browser rows written first: failed unfixed on Chromium and Firefox (9 failures), except the
  sync-refusal frame sampler on Firefox, which passes unfixed (the re-show lands inside one
  frame there). Chromium catches it.
- Mutation results (Chromium + Firefox):
  - no attributes written: all close rows + pre-hydration row fail; jsdom markup rows fail.
  - `command="--x"` (custom command): the close rows still PASS on Chromium and Firefox; only
    the attribute assertions catch it. So both engines exempt any `commandfor` invoker from light
    dismiss, contrary to the design's "a custom command is not exempt" (spec reading). Harmless
    for us (we write the real command), reported to the architect.
  - click not cancelled: close rows fail; the closed-click row needed a `beforetoggle` count
    (the library's apply effect re-shows with `source: input`, so geometry alone cannot see a
    command that ran).
- Real click into an srcdoc iframe: `commands.mouse("click")` at `toPagePoint(frameRect +
  elementRect)`, waiting on the iframe window's `pointerup` (browser-commands' `mouse` waits on
  the test window and would hit its 5 s fallback).

## Review follow-ups (memo/reviewer/issue-112-review.md)

- F3: refusal rows also assert no `beforetoggle` "closed"; the unfixed Trigger now fails both
  refusal rows on Chromium and Firefox (Firefox's sync row was blind before).
- F4: link-render row (`render={<a href="#" />}`): light-dismissed at the press, one
  `(false, activate, click)`, no re-open over 200 ms. Mutation "judge on the DOM's
  `:popover-open` instead of `intended()`" fails it on both engines.
- F5: jsdom render-swap row (button -> span) checks the old button loses both attributes;
  removing the cleanup fails it. Plus a `@ts-expect-error` owned-key row for `commandfor` /
  `command`.
- F6: docs say "a `<button>` Trigger"; the non-button warning uses #115's wording.
- F1/F7: design text edited in a separate `docs(design)` commit (one-off PO approval).
- Rebase onto #111 duplicated two imports (`renderToString`, `mouse`) in the test files (review
  F8); folded into the first commit so every commit type-checks.

## Release notes: type-level breaking change

`ComboboxTriggerProps` no longer accepts `commandfor` or `command` (owned: written by the
library after hydration on a `<button>`). `onPointerCancel` is no longer owned and is accepted
again (passed through to the element). Behaviour: a `<button>` Trigger click while open now
keeps the listbox shown until `openChangeAction(false)` settles; a controlled parent that keeps
`open={true}` sees no flicker; the close runs the `<ViewTransition>` exit. A non-button Trigger
warns in development.
