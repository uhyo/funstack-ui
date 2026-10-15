# Architect notes: Accordion (#8), 2026-10-15

Working notes behind `design/components/accordion.md`. Not a spec.

## Probes run (scratchpad only, nothing added to the repo)

1. **Flight cannot read context in a Server Component.** `react-server-dom-webpack` 19.2.3
   (`react-server-dom-webpack-server.node.development.js`) throws
   "Cannot read a Client Context from a Server Component." for `use(Context)`. Consequence: an
   `Accordion.Item` that needs anything from `Root` (exclusive `name`, inherited `disabled`,
   dispatch) must be a `"use client"` file. HTML has no attribute inheritance for `name`, so the
   only fully directive-free design would be "consumer writes `name` on every Item", rejected.
   The Accordion therefore ships no directive-free file; what survives of "JS-free" is "no JS runs
   for the interaction, markup is complete in SSR output, works before hydration and with JS off".
2. **jsdom 29.1.1** (`packages/ui` resolution; `^30.1.3` declared, lockfile older):
   - `summary.click()` toggles `details.open` synchronously; `toggle` fires on a later task as a
     plain `Event` (no `newState`/`oldState`). Read `details.open` in handlers, never
     `event.newState`.
   - `click` with `preventDefault()` does **not** toggle. Interception strategy works in jsdom.
   - `keydown Enter` on summary does nothing (real engines synthesize `click` from the activation
     behaviour; user-event's Enter clicks only button/a/input, expected not summary).
   - `details.matches(":open")` works.
   - `name` exclusivity is **not** implemented (two same-name details both stay open).
   - `setAttribute("open", "")` fires `toggle` — tests can simulate find-in-page with it.
   - `setAttribute("hidden", "until-found")` keeps the string (not needed by Accordion anyway).
3. **ARIA in HTML, `summary`**: no corresponding role, no role allowed when it is the summary of
   its parent details; allowed aria-*: global, `aria-disabled`, `aria-haspopup`. No
   `aria-expanded` (validator: "must not be used on any summary element that is a summary for its
   parent details"). So the trigger cannot carry optimistic `aria-expanded`; AT sees the native
   (committed) state only.
4. Heading inside `<summary>` (Scott O'Hara 2018 test, WebKit bugs): VoiceOver exposes the
   heading, JAWS historically did not; buttons make children presentational but summary is not a
   button in HTML-AAM. Unverified on 2026 engines; the design treats the heading as an
   enhancement for heading navigation and does not add a `Header` part.

## Decisions I expect to be questioned

- `data-open`, not `data-expanded` (conventions 4.1 lists both rows for Accordion's trigger;
  the platform says `open` everywhere: attribute, `:open`, `ToggleEvent.newState`).
- `value` is discriminated on `exclusive`: `string | null` when exclusive, `string[]` otherwise.
- Both modes use the same four client parts; mode is decided by the presence of
  `value` / `defaultValue` / `valueChangeAction` on Root.
- `name` is rendered only in JS-free mode. In library mode React owns `open`; a second writer
  (the browser's exclusivity) would produce extra `toggle` events to reconcile.
- No arrow-key `focusgroup` flag: `focusgroup` collapses participants to one Tab stop, APG wants
  every accordion header to be a Tab stop.
- `experimental_interpolateSize` lives on Root, not Panel: `interpolate-size` is inherited and the
  animated box is `::details-content`, a pseudo-element of `<details>`; a declaration on Panel
  (its child) can never reach it.

## Entanglement and the "stacked patches" worry

Click A then B in exclusive mode, B resolves first: B's post-await commit is a transition update
inside an async-action scope, so it is held until A also settles (react-async-apis.md §2, case
2). Optimistic patches therefore never re-base onto a committed value that is newer than one of
them; the "A's stale patch wins after B commits" flicker cannot happen. Worth a browser check
once the implementation exists.
