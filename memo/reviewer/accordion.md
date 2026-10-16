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
