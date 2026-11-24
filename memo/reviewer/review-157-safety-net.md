# Review: test/157-safety-net (#157)

Light review, 2026-11-24, of `test/157-safety-net` (5 commits on c658d0e, tip 94689b5). The branch
adds tests only and closes the gaps listed in memo/reviewer/refactor-test-safety.md.

**Verdict: can be merged as is.** One medium and two low findings below; none blocks the merge.
Fixing the medium one is cheap and best done before the refactor starts.

## Checks run

- Scratch worktree at the branch tip, `origin/master` merged in (no conflicts), `tsdown` build,
  `pnpm test:jsdom`: 72 files, 3775 tests, all pass.
- Mutation spot-checks in the same worktree, each applied alone against the whole jsdom suite
  (jsdom + jsdom-isolated), then reverted. The worktree was removed afterwards.

| Mutation | Edit | Killed by |
| --- | --- | --- |
| UAT6 | `resolvedThen.current = null` removed from `run` | 1 row (the new three-runs row) |
| NGR9 | `lateQueued.current = false` removed from the microtask | 2 rows (uncontrolled, controlled) |
| FC3b | `previous.current === undefined \|\|` added to the early return | 1 row (the `undefined` row) |
| CTC7 | `cutting.delete(element)` removed | 2 rows (two sequential cuts, cut after a throw) |
| RF6c | `"inert"` dropped from `attributeFilter` | 1 row (the inert row) |

All five match the developer's claims.

## Findings

1. **Medium: the jsdom CTC6 row pins the mechanism, not the behaviour.**
   `packages/ui/src/internal/css-transition-cut.test.ts`, "forces a style recalculation of the
   element after the call, before restoring". It spies on `window.getComputedStyle` and expects a
   read of it while the cut is still in place. I replaced `void getComputedStyle(element).opacity`
   with `void element.offsetWidth`, which also forces a style recalculation in every engine, and
   this row failed. So the row blocks a valid refactor. The behaviour is already pinned in all
   three engines by the browser row "a style change made inside the call starts no CSS transition
   once the cut is restored" (`css-transition-cut-cssom.browser.test.ts`). Fix: drop the jsdom
   row, or label it plainly as a pin on the mechanism that a refactor may delete. Note that only
   the browser row then guards CTC6: jsdom cannot see it, and Firefox does see it with this direct
   row.
2. **Low: the UOR8 hook row checks object identity.**
   `packages/ui/src/internal/use-popover-hooks.test.tsx`, "a dismissal calls onDispatch(false,
   details) before onOpenChange": `expect(dispatched[1]).toBe(facts[0])`. Building the details
   once and passing the same object to both calls is an implementation choice. A refactor that
   builds them twice would break this row with no change in behaviour. `toEqual` (or checking
   `reason` / `event`) is enough. The order "dispatch before fact" is fine to keep: Menu's
   timer cancellation relies on it.
3. **Low: the UPP2 jsdom row depends on how focus-visible.js feature-checks.** In the same file,
   "a refused re-open with a quiet initial focus target...". It spies on
   `HTMLElement.prototype.focus` and reads `options.focusVisible` so that the probe in
   `focus-visible.ts` reports support. If that check changes, the row silently runs the non-quiet
   path and still passes, so it loses its kill without failing. That is acceptable for now. If the
   detection is ever reworked, assert inside the row that the quiet path was taken (for example,
   that `focus` was called with `focusVisible: false` at the first open).

## Behaviour vs implementation (the main question)

Apart from findings 1 and 2, the rows assert what can be observed: the DOM's `checked` value and
Tab stops, focus, `:popover-open`, `open`, which actions and facts were dispatched, and
`getAnimations()`. The hook-level rows (use-roving-focus, use-field-control,
use-native-checked, use-native-group-reconciliation, use-action-trigger) go through each hook's
public contract. They do not touch its refs. Refactors that keep those hooks keep these rows. A
refactor that merges two hooks will have to move the rows, which is the point. The Menu row "a
dismissal forgets an open cause recorded while the submenu was shown" depends on the hover timer
firing again while the submenu is shown to plant the cause. It still asserts only the outcome
(the first item gets focus after a foreign open), so it is fine.

## Flakiness

There are no real-time waits that could race. The jsdom rows use fake timers (`advance`, and
`toFake: ["setTimeout", "clearTimeout"]` in the UPP6 row, cleaned up through `onCleanup`) or
deferreds and `flushTasks`. The new browser rows are:
- css-transition-cut-cssom: fully synchronous (computed-style reads and `getAnimations()`). The
  control step (a change outside the cut does start a transition) protects against a false pass.
  It relies on WebKit listing a CSSTransition right after a style flush, which it does. I expect
  it to pass on CI, but it has not been run there yet.
- menu.browser "a pointer-opened menu whose parent refuses Escape...": uses `expect.poll` and a
  `quietPeriod(50)` that only checks nothing happened. If it ever goes wrong, it passes when it
  should fail, never the other way round. As the developer notes, it does not kill UPP2 (the
  open cause is used up before the refusal). It is a regression row for the pointer path of #155,
  and the jsdom hook row is the one that kills UPP2. That is fine.

WebKit: needs the CI run before the refactor relies on it.

## Combobox in overlay-open-state-suite

The port is sound. It uses the same pattern as the Popover and Menu ports (`popoverLikeDriver`,
`createOverlayHarness`, `useIntents` through the component context). Two overrides are correct
and belong in the config, not hidden in the suite: `openArgs` / `controlledOpenArgs` name the
Input as the `source`, because the Input is the anchor, and the List carries `content`, because
keepMounted's Activity hides the top-level content node. The part closes (an option,
`cancelsClick: false`; the Trigger as a `popovertarget` invoker, `cancelsClick: true`) and
`returnsFocus: false` match Combobox, where focus stays on the Input. The two newly shared rows
(the CommandEvent cause and the #115 non-button Trigger) are gated on `popoverTarget`, so they run
for Combobox too. As the developer notes, Combobox's #115 row passes under PT1 because its Trigger
takes its own path. That is a known gap, not a defect of the port.
