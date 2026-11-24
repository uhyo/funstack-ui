# Review: refactor/157-step-commit (#157, refactor-audit rank 3)

Branch tip 69da889, 5 commits on 7ec703e. Reviewed 2026-11-24.

**Verdict: mergeable as is.** The minor items below can come in a follow-up.

## Checks run

- jsdom `src/slider src/number-field`: 7 files, 358 tests pass.
- browser `src/slider src/number-field`, `FUNSTACK_BROWSERS=chromium,firefox`: 57 pass, 5 skipped
  (the engine skips that were already there).
- `tsc --noEmit` on packages/ui: clean.
- Mutations of `internal/use-step-commit.ts` in a scratch worktree (now removed), running
  jsdom slider + number-field + use-action-trigger (374 tests):

| # | Mutation | Result |
| --- | --- | --- |
| M1 | `captureGesture` does not call `setLive` | caught (Slider and NumberField press tests) |
| M2 | `markGestureStart` overwrites an open gesture | caught (the new d00345d test, 3 modes) |
| M3 | rollback runs for every commit, not only the latest | caught (overlap suite, both components) |
| M4 | the `"dismiss"` step also sets `stepHeld` | **survives** |
| M5 | `takeEdit` does not consume `lastReason` | caught (Slider Field rollback test) |
| M6 | no `await undefined` before the dismiss step | **survives** |
| M7 | `normalize` runs after the no-op test | **survives**; a scratch probe shows it is observable |
| M8 | commit ignores "back where the gesture began" | caught (6 tests) |
| M9 | `held` ignores `stepHeld` | caught (Slider "no valueChangeAction" test) |
| M10 | commit leaves `gestureStart` set | caught (trailing-change tests) |

## Findings, most severe first

### Minor 1: no test covers NumberField's "round before the no-op test" (M7)

`use-step-commit.ts:177-179` (`step`): the refactor moved NumberField's rounding into a generic
`normalize` option. The audit names "rounds before the no-op check" as one of the differences
that must survive. No test catches it if it is reordered. I wrote a probe that fails under M7:
`defaultValue={1} step={0.4} format={{ maximumFractionDigits: 0 }}`, ArrowUp. The correct code
calls nothing. Under M7, `valueChangeAction(1)` runs: a no-op step reaches the consumer, which
breaks conventions 2.3 item 8. master has no such test either, so this is an old gap. The
refactor makes it more exposed, because the order now lives in shared code that a later Slider
change could rearrange. Recommendation: add that row to number-field.test.tsx ("a step that
rounds to the shown value is a no-op: no valueChangeAction, no commit").

### Minor 2: two core lines no test pins (M4, M6), both gaps that predate the branch

- M4 (`use-step-commit.ts:190`, `if (reason !== "dismiss") setStepHeld(true)`): if a dismiss sets
  `stepHeld`, `held` stays true and `live` holds the committed value. That value equals the
  optimistic value, and the next gesture rewrites `live`, so I found no reliable way to observe
  it. This is low priority.
- M6 (`use-step-commit.ts:120`, `await undefined`): this only matters when `valueCommitAction`
  throws synchronously. Then the catch would run inside the commit's `startTransition` scope,
  and the dismiss step's urgent `setLive` would be a transition update. No test throws
  synchronously, and the commit-action suite only rejects asynchronously. Worth one row in
  `commit-action-suite` ("a commit action that throws synchronously rolls back the same way").

### Nit 3: slider.md still uses the old `gesture` state name

- slider.md 4.1, `pointerdown` row (line 542 on the branch): "`gesture = { thumb: index }`". The
  state table now says `gestureThumb`.
- The worked traces near lines 1114 and 1170 use `G={thumb:0}`. They are traces, so this is
  acceptable, but they could say `gestureThumb=0`.

### Nit 4: the CHANGELOG `# Entries` heading

design/CHANGELOG.md gets a new `# Entries` top-level heading after the archive parts. That makes
sense, but other #157 branches that append their first entry at the same time will each add the
same heading. Whoever merges second should drop the duplicate.

### Nit 5: line counts versus the audit's estimate

The roots are now 784 (Slider) and 709 (NumberField) lines. The audit estimated both under about
650. That is fine: the core is half doc comment, and the remaining bulk is pointer and draft
logic that belongs in the components. Recording it only so the audit's numbers are not taken as
a target.

## Behaviour preservation (path by path)

- **step**: same order of writes (liveRef, shownRef, lastReason, setLive, setPendingSource,
  stepHeld unless dismiss, then the step transition with types and details). NumberField's
  `clearDraft` and `syncHidden` now run after `setPendingSource` instead of around it. Both setState
  calls are batched and `syncHidden` is a synchronous DOM write with nothing in between, so the
  order cannot be observed. `normalize` and `onStep` are read through the core's `useLatest`.
  The old code read `latest.current.formatter`, which is the same committed-render semantics.
  `clearDraft` and `syncHidden` are stable `useCallback([])`.
- **commit**: identical, except for the `reached === null` guard on the box (see unified item 1)
  and the boolean return value. `onCommit` keeps the announce condition verbatim
  (`activate`, source neither `"input"` nor `null`).
- **gesture open/capture**: Slider's keyboard `openGesture()` reads `shownRef.current` at the
  same point where `before` was read, so it matches the old `gestureStart = liveRef = before`.
  Platform change: same. Pointer capture: `captureGesture()` is open + `setLive(shown)`, exactly
  as before. One difference: Slider used to `setLive(shownRef.current)` with the same array
  reference, so React could skip the update. It now always sets a new box. That costs at most one
  extra render, and `setGestureThumb` renders in the same batch anyway, so nothing is
  observable. NumberField `beginHold`: same as before. Slider's native `input` uses
  `markGestureStart(before)` after a step that changed something, as before.
- **rollback**: `controlled === undefined` is `sanitize(valueProp) === undefined`, and `sanitize`
  keeps `undefined`, so it is equivalent. For Slider, `toShown(committedRef.current)` is
  `toArray`, as before. The dismiss step goes through `normalize`/`onStep`, so NumberField still
  rounds, clears the draft and writes the hidden input on a rollback.
- **pending / optimistic**: `held`, `shown` and `pending` are the same expressions.
  `optimisticShown` is the same `useMemo` over `toArray` (identity for NumberField). Slider
  passes `pendingThumb` through raw and NumberField masks it, as before.
- **form reset / platform**: both `onPlatformChange` paths are open + step + commit, unchanged.
- **Field notification**: `takeEdit` is the old consume-and-return body, unchanged.
- **Slider multi-thumb**: `fromArray` (a `useCallback` over the mount shape) goes through
  `latest`, `equalValues` is unchanged, and the `thumb` detail key is kept by `sliderDetails`.
- **Hook order**: NumberField now calls `useControllableAction` before `useActionTrigger`, and its
  `live`/`stepHeld`/`pendingSource` state comes after `draft`/`hold`. The shown/committed
  `useLatest` refs now run earlier in the component. They update in insertion effects, which all
  run before any layout effect, so moving them earlier cannot leave a reader with a stale value.
  The only visible effect is Fast Refresh state mapping during development.

## The six unified differences

I agree with all six. Item 1: `liveRef` is set together with `gestureStart` in `openGesture`, and
`markGestureStart` is only called after a step has written `liveRef`. The box is never reset, so
`reached === null` with `start !== null` cannot happen. Items 2, 4 and 6 change code only.
Item 3: the two hooks have independent effects. Item 5: the `sanitize` argument above.

## Readability

The interface is narrow enough. The options are the two actions, two sets of types, a
shape pair (`toShown`/`fromShown`), `equals`, `details`, one boolean (`captured`) and three
optional hooks (`normalize`, `onStep`, `onCommit`). Each one is a real difference between the
two components, not a mode switch. The return value has three gesture openers (`openGesture`,
`captureGesture`, `markGestureStart`) with distinct, documented meanings. Small redundancy: it
returns both `optimistic` and `optimisticShown`, and each component uses only one of them.
That is acceptable. It is not flag soup.

## Design text

slider.md 2.4 and number-field.md 2.2/2.4/4.3 now match the code: the commit clears the
gesture start to `null`, `live` is boxed, the hold or key opens at the shown value and steps from
the base, and the typed text handles "unparsable or equal to shown". The conventions 9.1 listing
is updated. The only leftover is Nit 3.
