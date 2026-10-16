# Reviewer memo: Accordion (#12), 2026-10-16

Reviewed master at 2e0ed5d (the merge c66167e plus the libraryProps refactor that landed during
the review) against `design/conventions.md`, `design/components/accordion.md`, and the Toggle
review standard. `pnpm build`, `pnpm test:run` (162 tests incl. browser env smoke),
`pnpm typecheck`, `pnpm lint` pass. `dist/accordion/*.mjs` parts and `internal/use-dev-warning.mjs`
start with "use client"; `accordion/index.mjs` is directive-free; exports map has `./accordion`.

Verdict: **acceptable with minor fixes** (one real bug in the platform path, hydration polish,
missing test rows, example/design CSS bug, design-text corrections).

## Probes run (scratch tests under src/zzprobe, deleted afterwards)

1. Merge order (before 2e0ed5d): render element beat `data-open`, `open`, `aria-disabled`. Fixed
   by 2e0ed5d. Residual: a library value of `undefined` means "not defined", so a render element's
   `data-open` / `aria-disabled` / `name` shows through when the library's is off. `name` matters:
   `render={<details name="g" />}` in library mode re-creates a second writer.
2. Race, multiple mode, uncontrolled: click A (pending), then `setAttribute("open")` on B.
   Calls: `[["a"],"trigger"]`, `[["b"],"platform"]`. Optimistic shows A+B; final: A closed, B
   open. `dispatchFromDom` computes `next` from the DOM, which does not contain pending optimistic
   opens; latest-wins then drops the user's A. Exclusive mode: B wins, arguably correct.
3. Hydration (renderToString, set `details.open = true`, hydrateRoot): library and JS-free mode
   both log React's "attributes of the server rendered HTML didn't match" once. Passing
   `suppressHydrationWarning` on the Item silences it (0 errors). State is preserved and reconciled
   functionally. Two pre-clicked items dispatch twice: `["a"]` then `["a","b"]` (b not yet
   registered when a's layout effect runs). Design says "called once".
4. StrictMode + pre-hydration click, controlled accept, slow action: on hydration the item closes
   (strict re-run of the layout effect takes the "re-apply" branch because `mounted` is a ref
   that survives the simulated remount, `rootPending` is stale false), reopens when the action
   settles. Non-strict: stays open throughout. Dev-only flash.
5. Superseded rejection through Accordion: reaches the boundary (shared hook works).
6. Controlled update-on-success, multiple mode, click A then B, B resolves first: final parent
   state `["a"]`; B's open is lost (parent writes land in completion order; `next` is a whole
   set). Uncontrolled: both orders end A+B open (correct).
7. Types (tsc on a scratch file): discrimination on `exclusive` works, contextual `next` is
   `string[]` / `string | null`, wrong shapes error, `(n) => save(n)` returning a Promise<Response>
   accepted, a dynamic boolean `exclusive={b}` is accepted (TS distributes the discriminant).

## Follow-up: should library-controlled keys be owned? (asked by the lead)

Yes. A key present in `libraryProps` should be owned: it overrides the element and, when its value
is `undefined`, deletes the element's/pass-through value. A part that does not own a key in some
mode omits the key instead of passing `undefined`.

- Why: conventions 1.2 says library-controlled attributes "win"; today they win only when truthy,
  so `:not([data-open])` / `:not([data-pressed])` styling and `[aria-disabled="true"]`-based nav
  are unreliable, and `render={<details name>}` re-creates a second writer in library mode.
  Toggle is affected the same way (`data-pressed`/`data-pending`/`data-disabled` are `undefined`
  when off; `aria-pressed` and `onClick` are always defined so they are fine).
- Escape hatch is not lost: the function form of `render` hands the consumer the props, and they
  can override anything after spreading. Element form is for merging, not overriding state.
- Change: in `merge-props.ts`, the library layer (only) treats `hasOwn(over, key) && value ===
  undefined` as delete. Element and pass-through layers keep "undefined = not given" (JSX optional
  props are routinely `undefined`).
- Required call-site adjustments, otherwise owning would strip consumer handlers:
  Item `onToggle` only in library mode (`...(isLibrary && { onToggle })`), Item `name` (owned in
  both modes is fine: static non-exclusive deleting an element `name` is acceptable, or omit in
  static non-exclusive), Trigger `onClick` only when installed. Then the "nope shows through" line
  in the 2e0ed5d precedence test flips to "absent".
- Conventions 1.2 text: add "Library-controlled keys are owned: when the part computes no value
  the attribute is absent, whatever the `render` element says. Use the function form of `render`
  to override library attributes deliberately."
