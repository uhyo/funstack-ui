# Review: refactor/157-split-combobox-toast (#157 candidate 12)

Commits 08fc24e (Combobox.Root split), bc14c2f (Toast.Viewport split), bbcf4c4 (dev notes), on 3894e82.

Verdict: **mergeable as is** (only low-severity nits; none blocks).

## Runs (scratch worktree at bbcf4c4)

- jsdom: `src/combobox src/toast src/__tests__/directives.test.ts` 619 passed (needs a build first for directives).
- browser `FUNSTACK_BROWSERS=chromium,firefox`, combobox + toast: 141 passed, 3 skipped (engine-conditional, pre-existing).
- typecheck, lint: clean (the two pre-existing warnings only).

## Order of hooks and effects

- Combobox: `useActiveOption` sits where the active state used to be; the only code between the old
  state and the old revalidation layout effect was `loading` / `empty` (no hooks), so the
  revalidation layout effect still runs after `useOptionRegistry`'s and before the text-record
  layout effect. `useComboboxText` adds one insertion effect (its own `useLatest`) before the
  `textRef` one; insertion effects write independent refs, unobservable. `useComboboxKeyboard`
  contains no hooks, so its call position is irrelevant; `accept` / `commitText` are declared
  above it (no TDZ).
- Toast: no layout or passive effect moved. The hotkey effect is called at its old place, after
  the mount effect. `useToastPauses` adds an insertion effect (`useLatest(setPause)`), before
  `latest`; unobservable.

## The five flagged deviations

1. `setPaused` before `syncTimers()` in the mount effect: accepted. `syncToastTimers` only
   schedules `setTimeout`s (`expire` is never called synchronously) and both are state writes in
   the same passive effect, batched together.
2. `handlers.setPause` dropped: accepted. Its only readers were the inline listeners; `watch`
   reads the hook's own `useLatest(setPause)`, which is the committed render's `setPause` exactly
   as `handlers.current.setPause` was. `setPause` itself is not in the context value.
3. Refs renamed (`pendingEdgeRef`, `autoArmedRef`, `returnTargetRef`, `lastAnnouncedRef`):
   accepted. The `*Ref` suffix is what the compiler lint keys on for writes outside the hook, and
   it is internal.
4. Keyboard hook with 8 fields and no hooks: the interface is fine (3 props passed through,
   3 grouped `Pick`s, 2 callbacks; no mode flags, so not flag soup). The `use` prefix is a misnomer
   (`menu/use-menu-keyboard.ts` does hold hooks, so the symmetry is only by name). Low: rename to a
   plain factory (`comboboxKeyDown(...)`) or keep and leave the note; not blocking.
5. Directives test lists the six new files: correct, each has `"use client"`, and the test is what
   keeps them client modules in the build.

## Mutation spot-checks (reverted, worktree removed)

| Mutation | Result |
| --- | --- |
| M2 `use-active-option`: drop `!stale` from auto-highlight | killed (2) |
| M5 `use-combobox-keyboard`: caret keys no longer clear the active option | killed (1) |
| M1 `use-toast-pauses` `watch`: no initial `hidden` read at mount | survived |
| M3 `use-combobox-text` `writeText`: no synchronous `textRef` write | survived |
| M4 `use-toast-announcements`: queued toasts ignore the Viewport's `announce` | survived |

M1, M3 and M4 also survive the same mutation on master's code: pre-existing test gaps, not
introduced by the split. Worth a follow-up test issue:
- Viewport mounted while `document.visibilityState === "hidden"` starts paused (`data-paused`).
- Viewport `announce` applies to a toast queued beyond `limit` (the existing test uses `limit={10}`).
- `textRef` written synchronously by `writeText` (a handler reading the text before commit, for
  instance a keydown that types then commits in one event).

## Findings by severity

No high or medium findings.

Low:
- `packages/ui/src/combobox/use-combobox-keyboard.ts:27` named `use*` without hooks (item 4).
- `packages/ui/src/toast/toast-viewport.tsx:157` `useToastPauses(() => syncTimers())` refers to a
  `const` declared 20 lines below; correct (called only from events / effects) but a reader trap.
  A one-line comment would help.
- `packages/ui/src/combobox/use-combobox-text.ts:42` keeps a second `useLatest` of two props the
  Root already has in `propsRef`; deliberate for self-containment, harmless.
- Test gaps M1 / M3 / M4 above (pre-existing).

Cohesion: text lane, active option, keyboard; pauses, focus (+ hotkey), announcements: each hook
owns its state and refs and exposes a small surface. Leaving the selection lane in the Root (to
keep effect order) is the right call.
