# Probes: wave 23 (#166 HoverCard, #165 Select multiple), 2026-11-26

Playwright Chromium 156.0.8078.4 and Firefox 157.0 (headless, Linux). WebKit cannot launch
locally. Run each script with `node <file>` (they resolve `playwright` from the main checkout's
`packages/ui`); outputs are next to them.

| Script | Question |
| --- | --- |
| `hovercard.mjs` | `<a href interestfor>` + rich card (`hint` and `auto`): focus open, Tab into the card, Shift+Tab, Escape, re-focus, hover into card, stacking with an open auto menu, select picker inside the card |
| `ax-focus.mjs` | CDP AX of plain vs rich targets (description vs `details`, no `expanded`, `group` role), explicit `role=dialog`; Tab order when the card is far from the invoker in the DOM |
| `nested.mjs` | Script-opened card (`hint` / `manual` / `auto`) with a nested `popovertarget` auto menu: does opening the card close an unrelated auto popover, does the nested menu keep the card, Escape inside. Chromium + Firefox |
| `timing.mjs` | Delay of `interest-delay: normal` (~503 ms in 156: the M142 to M156 default was 0.5 s) |
| `interest-button.mjs` | Does `::interest-button` render in 156 (no; it parses only) |
| `select-multiple.mjs` | `<select multiple>` with and without `size=1` / `base-select`: click/Space/Arrow selection model, events, AX. Chromium + Firefox |
| `experimental-check.mjs` | Whether Playwright's Chromium has experimental runtime features on (no: `appearance: base` unsupported); `multiple size=1` popup with the multi-popup flag explicitly disabled |
| `bisect.mjs` | Debug aid: my first hovercard run waited 400 ms, below the 156 default delay of 500 ms |
