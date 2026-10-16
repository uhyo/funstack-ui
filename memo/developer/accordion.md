# Developer memo: Accordion (#12), 2026-10-16

Implementation of `design/components/accordion.md`. Started by a previous agent (parts, context,
`use-dev-warning`, `reducer` option on `useControllableAction`); finished here (tests, example,
two fixes). Branch `worktree-agent-aa1eb49fd5259ba32`, not pushed or merged.

## What landed

- `packages/ui/src/accordion/`: `accordion-root.tsx`, `accordion-item.tsx`,
  `accordion-trigger.tsx`, `accordion-panel.tsx`, `accordion-context.ts` (all `"use client"`),
  `index.ts` (directive-free namespace + flat types), `accordion.test.tsx` (68 tests).
- Shared internals (kept minimal):
  - `use-controllable-action.ts`: optional `reducer(prev, next, details)` for the optimistic
    reducer form; the optimistic patch is `{ next, details }` so the reducer can key by item.
    Default behaviour (replace) unchanged.
  - `use-dev-warning.ts` (new, `"use client"`): `useDevWarning(condition, message)`, once per
    instance, in an effect.
- Root entry and `@funstack/ui/accordion` subpath; `tsdown` entry; `directives.test.ts` covers
  every part file plus `use-dev-warning`.
- `packages/example/src/accordion-demo.tsx` + `.css`, wired into `App.tsx`.

## Fixes made to the inherited code

- Trigger's callback ref returned `undefined` when there was no Root (standalone Item), so
  `mergeRefs` called it back with `null` on unmount and crashed on `tagName`. It now always
  returns a cleanup.
- Root memoises `toSet(value)` on `value` so the committed set keeps its identity between renders
  of a controlled parent (otherwise `useOptimistic` re-based on every render).

## Decisions / gotchas

- jsdom 30.1.3: `summary.click()` toggles synchronously, a default-prevented click does not;
  `toggle` fires from a queued task on any `open` change including `setAttribute`; `:open`
  matches; summaries are focusable; `name` exclusivity is not implemented; Enter/Space on a
  summary do not synthesize a click. `flushToggle()` in the test file is
  `act(async () => { await setTimeout(0) })` so the toggle handler's dispatch runs inside act.
- Verified in real Chromium (Playwright 1.63, scratch script, not committed): click and Enter
  interception on a real `<summary>`, `name` exclusivity, `::details-content` grid animation, the
  platform path (`details.open = true` from script → `reason: "platform"` → re-closed when the
  parent refuses, exactly one dispatch), optimistic flip starts no view transition while the
  settling commit does with `["fsui-accordion", "fsui-accordion-expand"]`, no console errors.
  A proper `accordion.browser.test.tsx` is the follow-up now that master has browser mode.
- `AccordionRootBaseProps` also omits the native `defaultValue` from `ComponentPropsWithRef<"div">`
  (HTMLAttributes types it as `string | number | readonly string[]`, which would clash). The
  design's omit list does not mention it.
- `transition` is typed `ViewTransitionClass` like Toggle, not `ViewTransitionProps["default"]`
  as the design writes; same type in practice.
- `experimental_interpolateSize` is observable in jsdom only through the `render` function's
  `props.style` (jsdom's CSSStyleDeclaration drops the unknown property); the browser check
  confirms the attribute `interpolate-size: allow-keywords;` is rendered.
- Superseded-rejection rows (added to the conventions on master after this branch forked) are not
  in `accordion.test.tsx`; they come for free once the shared hook change lands on master.

## Branch state

Forked from `f67f405`; master has since gained browser mode (`vitest.config.ts` projects,
`test:jsdom` / `test:browser`), the Toggle review corrections to the conventions, and is about to
gain the shared-internal fixes. Expected merge conflicts: `packages/ui/package.json` (exports vs
scripts, trivially both), possibly `use-controllable-action.ts` if the other developer's change
touches the `useOptimistic` line.
