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
