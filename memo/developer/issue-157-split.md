# #157 rank 12: split combobox-root.tsx and toast-viewport.tsx

Branch `refactor/157-split-combobox-toast` (not merged). Internal only: no behaviour or public
API change, component indexes untouched.

## Combobox (commit 08fc24e)

`combobox-root.tsx` 831 -> 695 lines.

- `use-combobox-text.ts` (71): internal text, `query` (`useDeferredValue`), `stale`, `textRef`,
  `writeText`. Inputs are the three text props; it keeps its own `useLatest` for `inputValue` /
  `onInputValueChange` (same timing as the Root's `propsRef`: insertion effect).
- `use-active-option.ts` (82): `activeValue`, `activeRef`, `setActive`, `pendingEdgeRef`,
  `autoArmedRef` (5 members) and the revalidation layout effect (design 6.5). Called at the
  position the state used to be declared, so the layout effect still runs before the Root's
  text-record effect.
- `use-combobox-keyboard.ts` (125): `move`, `activeEnabled` and the Input's `keydown`. Has no
  hooks inside (named `use*` for symmetry with `menu/use-menu-keyboard.ts`). Its options are
  8 fields (three props, `popover`, `options`, `active`, `accept`, `commitText`): no loose refs,
  only grouped objects, but over the audit's "five" if that counts inputs too.
- The refs returned by `useActiveOption` are named `*Ref`: with the plain names
  (`pendingEdge.current = …`) oxlint's React-compiler `immutability` rule warns at the writes in
  the Root.
- Not extracted: the selection lane (`runValueAction`, `dispatchValue`, `textRecord`, the
  text-record layout effect). Its interface would be 7+ inputs, and moving
  `useFieldValueChange` / the layout effect would change effect order.

## Toast (commit bc14c2f)

`toast-viewport.tsx` 671 -> 532 lines.

- `use-toast-pauses.ts` (93): `paused`, `holding(source)`, `anyHeld()`, `setPause`, `watch(doc)`
  (stable; visibility + window focus/blur listeners, publishes `paused`). The Viewport's mount
  effect calls `watch` where it used to inline the listeners. One reorder: `setPaused` now runs
  before `syncTimers()` in that effect; `syncToastTimers` touches no React state, so it is
  unobservable.
- `use-toast-focus.ts` (111): `useToastFocus` (`returnTargetRef`, `sortedRoots`,
  `moveFocusOut`) and `useToastHotkey` (the hotkey effect, called at its old position so the
  passive effect order is unchanged).
- `use-toast-announcements.ts` (73): `lastAnnouncedRef`, `queueAnnouncement`, `announceQueued`
  (the queued-toast loop of the region layout effect).
- `handlers.setPause` dropped from the Viewport's `useLatest` bag: only the old inline
  listeners read it.

## Checks

typecheck, lint (only the two pre-existing warnings), format:check, test:jsdom (3856 after the
combobox commit, 3859 after the toast commit: each adds three directive cases), build, and the
combobox + toast browser tests on Chromium and Firefox (141 passed, 3 engine-conditional skips
that pre-exist).
