# Review: #118 invoker `aria-expanded` = shown state (branch fix/118-invoker-aria-expanded, 6a11ed1)

Date: 2026-10-24. Reviewed the diff against origin/master, issue #118 (decision + plan),
conventions 3.2 / 4.1 / 7.3 / decision 40, the #118 amendments in popover.md, menu.md and
combobox.md, docs/research/invoker-aria-expanded.md, memo/developer/issue-118.md. Probes were run
in a private worktree (removed) on Chromium and Firefox.

## Verdict

**Acceptable with fixes.** Popover / Menu / SubmenuTrigger are correct and match the design in
every phase I checked. One real problem: `Combobox.Input` (M1) is not an invoker, so every engine
reads its attribute, and after a browser-owned dismissal it now reports a stale "expanded" in
Chromium and WebKit as well as Firefox. Before this change it reported "collapsed". The design
says this gap is "Firefox only", which is wrong for the Input. M1 needs an architect decision
(fix or accept-and-document) and a test before the release notes describe the change. Everything
else is low severity.

## Findings

### M1 (Medium): `Combobox.Input` is stale "expanded" in all engines after a dismissal; a regression from the optimistic value
- `packages/ui/src/combobox/combobox-input.tsx:141` (`"aria-expanded": popover.committed`).
- Design claim contradicted: popover.md amendment "Known gap, Firefox only ... Chromium and
  WebKit are right throughout"; combobox.md amendment (same rule extended to the Input).
- The Input is `role="combobox"`, not an invoker. Chromium and WebKit do not compute its expanded
  state from the popover, so they expose the attribute too. The listbox is `popover="auto"`
  (`combobox-popup.tsx:115`), so Escape and light dismiss belong to the browser. The popup hides
  at once, but `committed` flips only when the `"dismiss"` notification settles.
- Probe (Combobox, async 300 ms close action, sampled 60 ms after the dismissal):
  - Chromium, Escape: DOM `"true"`, popup hidden, focus on the input, CDP AX `expanded=true`.
  - Chromium, click outside: the same.
  - Firefox: DOM `"true"` while hidden.
  - With the Input line reverted to `optimistic`, Chromium showed DOM `"false"` and AX
    `expanded=false` at the same instant. So this is a regression in Chromium and WebKit, on the
    focused element, which is exactly the element AT is reading after Escape.
- The window is the notification's duration, plus any unrelated transition it is entangled with
  (conventions 2.3 item 5). The Combobox page itself says an open waits for a pending save; a
  dismissal notification likewise waits, so during a slow save the Input says "expanded" over a
  hidden listbox for the whole save.
- The "#514 is making engines ignore the attribute" argument behind rejecting A' does not apply
  to the Input: it is not an invoker, and the attribute is the only source of the state.
- Options for the architect:
  - (a) track a "shown" bit for the Combobox and render the Input's (and Trigger's)
    `aria-expanded` from it. It would be urgent state written from the Popup's
    `beforetoggle`/`toggle`, i.e. browser-owned state per conventions 3.5. The same bit would
    close the Firefox window on the invoker Triggers too.
  - (b) keep committed, correct the design text to "every engine for Combobox.Input (no invoker);
    Firefox only for invoker Triggers", and add the phase to the amendment table.
  - Either way, add a test row pinning the chosen value.
- Secondary, same mechanism: a library-mode Popover/Menu Trigger rendered as a non-button (`render`
  link/div, dev-warned since #115) has no `commandfor`. All engines read its attribute, so the
  stale-dismissal window applies everywhere for it too. Worth one clause in the design.

### L1 (Low): no test pins the dismissal-notification phase, the one phase the design knowingly lets diverge
- `packages/ui/src/__tests__/overlay-open-state-suite.tsx:455-481`: the "dismissal ... pending
  meanwhile" row asserts `data-open` and pending but not `aria-expanded`.
- `overlay-open-state-suite.tsx:639-656`: the "refused dismissal re-opens" row does not assert it
  either.
- Add `expectExpanded(true)` while the notification is pending (hidden popup) and
  `expectExpanded(false)` after. For the refused row, `true` throughout. That documents the
  accepted gap and makes a future A' / "shown bit" change deliberate. Combobox needs the matching
  row (see M1).

### L2 (Low): the docs and playground demos lost their instant Trigger feedback in library mode
- `packages/docs/src/examples/popover.css:121-125` and
  `packages/example/src/popover-demo.css:120-123` style only `[aria-expanded="true"]`.
- `PopoverActions.tsx` is library mode, and its open suspends for 1 s. After #118 the button no
  longer changes colour at the click, only `cursor: progress`. The docs example therefore no
  longer shows the optimistic feedback the library is built around.
- The design's own CSS (popover.md:995) says "[data-open] for the optimistic flip". Add
  `.demo-button[data-open]` / `.pop-btn[data-open]` next to the `aria-expanded` rule, which JS-free
  mode still needs. The developer's release-note line already tells consumers to do this.

### L3 (Low): the PendingOptimistic page overclaims
- `packages/docs/src/pages/PendingOptimisticPage.tsx:188-191`: "browsers report it from the popup
  itself, so it follows the shown popup".
- Firefox does not compute it, which is why the attribute changed. Neither does any engine for
  `Combobox.Input`.
- Suggest: "Chromium and Safari report it from the popup itself, so the attribute follows the
  shown popup and every browser agrees; `data-open` is the optimistic one."

### L4 (Nit): a misleading test title
- `packages/ui/src/combobox/combobox.test.tsx:772`: "a refused controlled open snaps
  aria-expanded back".
- Since #118, `aria-expanded` never leaves `"false"` for a refused open; it is `data-open` that
  snaps back.
- Retitle the row (e.g. "...keeps aria-expanded false, data-open snaps back") and assert the
  absence of `data-open`.

### L5 (Nit, design text): "the one phase where the attribute lags"
- popover.md:1155 (pre-hydration open walkthrough) calls this "the one phase where the attribute
  lags the DOM".
- There are at least two more: the dismissal-notification row of the amendment table, and the
  `defaultOpen` pre-hydration window of 2.5, where the server HTML says `"true"` while the popup
  is hidden. For the Combobox Input that window applies in every engine. It is pre-existing and
  accepted at review, not a #118 regression.
- Suggest that the amendment's "Known gap" paragraph list all three phases.

### Info
- I1: Tabs' optimistic `aria-selected` sits next to a committed panel during a suspending switch.
  Conventions 3.2 explicitly keeps it ("a selected tab"), and no engine derives `aria-selected`
  from anything else, so there is no cross-engine split. I have no objection. A clause saying why
  the "follows committed visibility" argument does not reach Tabs would pre-empt the question.
- I2: there is no SubmenuTrigger-specific pending `aria-expanded` row. It renders through the same
  hook line, and the mutation of that line fails 19 rows, so this is acceptable.

## Verified OK

- **Mutations.** Reverting `use-popover-trigger.ts:193` to `state.open` fails 19 jsdom rows
  across Popover/Menu (the shared suite, the Menu Suspense and #110 rows, and the two new Popover
  rows). Reverting either Combobox line fails 3 rows. This matches the developer's memo.
- **Chromium AX row** (`popover.browser.test.tsx:213`): green 5/5 on Chromium + Firefox. There is
  no race: each phase is held by a `deferred`, and CDP `getFullAXTree` is read after the awaited
  `act`. Chromium ignores the attribute, so the AX half guards the premise (attribute and AX
  agree) rather than the implementation; the DOM half guards the implementation. That is fine.
- **Browser-owned dismissal window** (Popover Escape, Popover light dismiss and Menu Escape, rAF
  sampling from `beforetoggle`):
  - With a sync notification: 1-2 frames (Chromium about 22-25 ms, Firefox about 11-16 ms).
  - With a 300 ms action: about 310-325 ms.
  - Chromium AX during the window: collapsed.
  - This matches the design ("one transition / the action's duration"), apart from M1 and
    entanglement.
- **Refused dismissal** (controlled): `"true"` while hidden (Firefox stale), then re-shown with
  `"true"` and `data-open` back.
- **Phases and parts:**
  - Controlled refused part close: `"true"` throughout (Popover and Combobox tests).
  - Suspense open: `"false"` while pending, then `"true"` (suite row and Menu row).
  - `keepMounted`: the attribute does not depend on it.
  - The exit hold uses `visible`, not the attribute.
  - SSR `defaultOpen`: `"true"` in `renderToString`, matching the client's first render, so there
    is no hydration mismatch.
  - Submenus and ContextTrigger: the ContextTrigger renders no ARIA, and a Trigger in the same
    Root shows `"true"` when context-open (`menu-context-trigger.test.tsx:1138`).
  - JS-free Popover: unchanged.
- **No remaining optimistic `aria-expanded`:** grep finds none. Dialog.Trigger (`show-modal`, no
  `aria-expanded`), Select, Tooltip (`interestfor`, no `aria-expanded`) and Accordion (`summary`)
  are consistent with the 3.2 bounded rule.
- **Docs pages:** the Popover, Menu and Combobox pages are accurate (apart from L2 and L3).
  ContextMenuPage:383 ("button shows aria-expanded=true while context-open") is still true.
