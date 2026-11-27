# #194: every JS Escape layer records and decides last (branch feat/194-escape-last)

- `internal/escape-key.ts`: `consumeEscape` (WeakSet mark), `decideEscapeLast` (WeakMap<Event, Entry>,
  one window bubble listener + one `afterDispatch` per event; globals in record order, then
  element layers reversed), plus `createEscapeRecord()`: the one-slot holder each listener keeps
  its pending cancel in (same event twice ignored, a new event cancels the old one, `cancel()` for
  the cleanup). Not in the design's list of exports; added to avoid five copies of the slot.
- Two refinements needed to keep the #177 rows unchanged:
  - `consumeEscape` only calls `preventDefault()` while the event is dispatching
    (`eventPhase !== NONE`). After the dispatch a cancel does nothing for anyone, but it would
    still flip `defaultPrevented` (the #177 row asserts `false` on the late path).
  - Cancelling the last live decider of an event disposes the entry (window listener removed,
    late path cancelled): the #177 "unmount while a record is pending removes the listener" row.
- jsdom: `event.currentTarget` at a window capture listener is not `=== window` under vitest's
  jsdom (`target.window === target` failed), so `windowOf` reads `target.document.defaultView`.
- Toast: listener added in the Root's callback ref (cleanup removes it and cancels); `ending`
  through `useLatest`. `onKeyDown` keeps the arrows only.
- Tooltip / HoverCard window listener cleanup (`listenDocument(false)`) also cancels the pending
  decision. Two tooltip rows spied on `document.removeEventListener("keydown")`; they now spy on
  the window (capture) — listener-location assertions, not behaviour.
- Browser rows: `src/__tests__/escape-last.browser.test.tsx`. ToastRootProps omits `onKeyDown`,
  so the toast row's stopping handler sits on a wrapper inside the Root. A closed Dialog unmounts
  the tooltip: `tipOpen` reads `queryByTestId`.

## Review round (memo/reviewer/review-194.md, architect 47e40e22)

- Must fix 1: `DecideEscapeLastOptions.cancel`; `run` orders cancels, globals, element layers
  reversed. Both Trigger cancels pass `{ cancel: true }`. Rows: escape-key (cancel first despite a
  consuming global, late path too, page preventDefault stops it), tooltip and hover-card (hint
  elsewhere + coming open; with page preventDefault). Mutation (drop the option) fails the rows.
- Should fix 2: toast row with an `auto` popover and a stand-in watcher (stop + hide); fails when
  the snapshot moves to decide. 3: open-shadow HoverCard with a non-modal dialog inside
  (dialog-escape, `it.runIf(mode === "open")`); fails with `event.target` in open-layer.ts.
- Nit 4 done (Tooltip, HoverCard pages). Nit 6 skipped (#195).
