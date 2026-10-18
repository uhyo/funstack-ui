# Progress and Meter (#68)

Implemented per design/components/progress.md (accepted 2026-10-18).

## Choices

- Directive-free Roots: chose the `internal/render-element.ts` split (design 14.1, preferred
  option), not dropping the directive from `use-render.tsx` (allowed by the conventions amendment
  f3ab2e4). `use-render.tsx` keeps `"use client"` and re-exports `resolveStateValue`,
  `rendersButton`, `DataAttributes`, so no other part changed. `mergeRenderRef(consumerRef,
  render)` in render-element.ts merges the consumer's and a render element's ref unmemoised.
- `warnOnce` in `internal/dev-warn.ts`; keys include part, condition and values;
  `resetWarnOnce()` for tests.
- Non-finite `low` / `high` / `optimum` are treated as absent (not in the design; mirrors the
  platform's attribute parser). Degenerate range: clamp yields `min`.
- `defaultValue` / `defaultChecked` are omitted from both Roots' props (review S3, reverses my
  earlier "the DOM attribute passes through" deviation: react-dom drops it on a `div`, so it was a
  silent no-op that looked like the uncontrolled spelling). The type test uses
  `@ts-expect-error`.
- Docs fixes after review: the indeterminate ring draws a fixed arc (a registered property with
  an `initial-value` never takes the `var()` fallback); ProgressUpload resets `size` / `sent`
  urgently before starting the action.
- Import-graph test in `directives.test.ts` walks the Roots' runtime imports over the sources
  and asserts the only client module reached is the context.

## RSC findings

- The provider-from-server pattern works with @funstack/static (docs build prerenders the
  ARIA values, hydrates without console errors, checked with a Playwright script against a
  static server mapping extensionless paths to .html).
- A Server Component may pass functions to the **Root** only. `Meter.Value children={fn}` from a
  Server Component fails ("Functions cannot be passed directly to Client Components"), and the
  docs build still exits 0 (the page is emitted nearly empty). Format part content in the Root's
  `children(state)` instead (MeterStorage does). Watch the build log for that message.
- Next.js scratch-app check of the pattern (design 8.1) was not done.

## Lanes

- jsdom lane rows confirm: the sync-prefix `setValue(50)` inside `startTransition(async)` is held
  (no aria-valuenow), the post-await plain write renders before settle, a post-await
  `startTransition` write is held until the action settles.
