# Architect notes: RadioGroup (#28), 2026-10-16

Working notes behind `design/components/radio-group.md`. Not a spec.

## react-dom 19.3.1 source reads (`packages/ui/node_modules/react-dom/cjs/react-dom-client.development.js`)

1. **`updateInput` writes `element.checked` from the prop on every host update**
   (`null != checked && (element.checked = checked && ...)`), with no diff against the previous
   prop or the DOM. `updateProperties` calls it whenever the `<input>` fiber updates, and every
   Item re-renders on a context change. Consequence: a rollback render (optimistic reverting)
   re-syncs the DOM by itself. RadioGroup needs **no** "re-apply committed state after settle"
   layout effect, unlike Accordion (where `<details open>` is diffed prop-to-prop).
2. **`initInput` during hydration keeps the DOM's `checked`** (`element.checked = isHydrating ?
   element.checked : !!checked`) and sets `element.defaultChecked = !!checked` from the initial
   prop. So the reset target is the mount-time value, and a pre-hydration click survives
   hydration silently (hence mount reconciliation).
3. **`restoreStateOfTarget` for a radio with a `name`** calls `updateInput` on the target and on
   every other `input[name=…][type=radio]` under the same root with the same `.form`, throwing
   "Mixing React and non-React radio inputs with the same `name`" if one has no fiber. Then
   `updateValueIfChanged` re-tracks each. This runs after `flushSyncWork()`, so it writes the
   optimistic props.
4. **Event order for one native `click`**: the Simple plugin (`onClick`) pushes to the dispatch
   queue first; the Change plugin (`createAndAccumulateChangeEvent`, `onChange`) after. So a
   pass-through `onClick` runs before the library's `onChange`, and `event.defaultPrevented` set
   there is visible to us. `onChange` is only queued when `getInstIfValueChanged` sees the tracked
   `checked` change, so clicking the already-checked radio fires no `onChange`.

## Probe interpretation

- `memo/platform-researcher/probes/05-browser/output-radios.txt` shows `afterResolve: { dom:
  "--c", committed: "a" }`. That is **not** a failed rollback: `app.js`'s `newDeferred` keeps only
  the latest resolver, so `window.resolveAction()` resolves c's action and b's never settles; the
  async-action scope keeps the transition open, `setCommitted("c")` is held, and optimistic stays
  "c". DOM "c" is consistent with optimistic "c". Nothing in the design depends on that number.
- `04-controlled-checkbox-transition.output.txt` §5: `optimistic=true: after click=-b-,
  pending=-b-, settled=-b-` is the radio case this design relies on.
- `07-form-action-reset.output.txt`: with a `reset` listener on `input.form` plus a microtask
  re-read, DOM and state agree after React's automatic reset. For RadioGroup the listener goes on
  `fieldset.form` (fieldset is form-associated and honours the `form` attribute).

## user-event 14.6.8 (`dist/esm/event/radio.js`)

`walkRadio` on ArrowUp/Down/Left/Right: collects `input[type=radio][name=…]` in document order,
walks with wrap, skips disabled (`isDisabled`, which includes fieldset inheritance), focuses the
target and dispatches `click`. No RTL awareness. Good enough for the jsdom keyboard rows; RTL and
real wrap go to browser mode.

## Decisions I expect to be questioned

- Shape 1 anatomy (Item = the visible input, no Indicator). Reason: an `<input>` has no children;
  a sibling Indicator needs a repeated `value`; CSS `:has()` / `+` already do the job; and I
  expect Checkbox/Switch to be plain single-element components rendering the input (conventions
  decision 1), which leaves no room for an Indicator there either. Section 14 of the design has
  shape 2 fully enough to swap.
- `next: string | null`. Reset to "nothing checked" is the common `<form action>` case; not
  dispatching it leaves `data-checked` stale. Tabs keeps `string` because its UI cannot deselect
  and it has no platform path that empties it.
- No `orientation`, no `Home`/`End`, no `focusgroup`: native radios already match APG exactly;
  every one of these would be the component's first keyboard JS or a prop that changes nothing.
- "Cancelled before our handler ⇒ no dispatch" (pass-through `onClick` with `preventDefault`).
  The platform reverts the DOM, React restores the unchanged props; dispatching anyway would be
  the research's documented desync. It is a consequence, not a veto API; flagged for the
  conventions.
- Reset of a disabled group dispatches. A `form.reset()` is the form author's action on the
  whole form, not the user's on one disabled control.
- `Label` (= `<legend>`) over `Legend`: vocabulary consistency; the first-child rule is documented.

## Things to verify during implementation

- `toHaveAccessibleName` on `fieldset[role=radiogroup]` with a `<legend>` in jsdom
  (dom-accessibility-api should compute it; else browser mode).
- That `useRender` + `cloneElement` with `render={<input />}` keeps `type="radio"` as an owned key
  even when the element passes `type="checkbox"` (the merge order says yes).
- react-dom does not log a hydration warning for a radio whose DOM `checked` differs from the
  server attribute (research probe 04 §8 says no); re-check with a `hydrateRoot` test.
- StrictMode double layout effect: the second `reconcile` sees `latestInFlight().next` equal to
  the DOM value and must not dispatch twice.
- Whether `fieldset.form` is non-null for a fieldset with a `form=` attribute pointing at a form
  elsewhere in the document (spec says yes; jsdom to confirm).

## Status, 2026-10-17

Status line was already "accepted". Folded: Root `form` is owned (fieldset and every radio through
context; `memo/developer/radio-group.md`), Item `disabled` owned in 13.5, and a "Hydration" bullet
in section 6: any Suspense boundary between Root and Items makes those Items hydrate later, so the
partial-hydration dev warning fires for them; the message has no link.
