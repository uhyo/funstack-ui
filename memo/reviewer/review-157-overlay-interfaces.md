# Review: refactor/157-overlay-interfaces (#157, audit candidate 11)

Branch `origin/refactor/157-overlay-interfaces` at acc9503, 5 commits on f0a7fac (44b779e,
85d9a46, 12b05ed, 9d10ed4, acc9503). Reviewed 2026-11-24.

**Verdict: mergeable as is.** Nothing blocks; three optional nits below.

## Verification

- Scratch worktree: branch + master (af646e4, clean) + `origin/refactor/157-helpers-followup`
  (ce06e91). `combobox-root.tsx`, `use-popover-trigger.ts` and `menu-popup.tsx` auto-merged; the
  only conflict was `design/CHANGELOG.md` (both sides append entries at the end; keep both,
  this branch's three first). On the combined tree: `pnpm typecheck`, `pnpm lint` (only the
  pre-existing ref warnings), `pnpm format:check` green; `pnpm test:jsdom` ui 81 files / 3904
  tests pass, docs 14 pass.
- `FUNSTACK_BROWSERS=chromium,firefox pnpm test:browser` on the combined tree: 54 files, 1049
  passed, **39 skipped** (1088), same as master.
- Mutations (separate scratch worktree at acc9503, each reverted, worktree removed):
  1. `usePopoverRoot` memo without `shown` in deps: killed (aria-expanded rows, the shared suite's
     `[link Trigger]` rows).
  2. `alwaysFocusable: false` instead of `submenuItem`: killed (menu.test "a disabled
     SubmenuTrigger is aria-disabled, never natively disabled, and does not open").
  3. Non-button warning keyed on `onActivate !== undefined` (the old key, now wrong since
     Menu.Trigger passes `onActivate`): killed (menu.test "warns for a non-button Trigger: its
     close while open is a light dismiss").
  4. Popup callback-ref deps on `initialFocus` instead of `staticFocus`: killed (3 tests in
     combobox and menu-context-trigger: listeners re-attached on every render).
  5. Menu.Trigger's open cause loses `isPointerClick`: survives jsdom on this branch alone (as in
     review-157-helpers.md, browser-only pin); killed once the followup's 5a9295c jsdom test is
     applied. So after both merges it is pinned in jsdom too.

## Commit 1: `usePopoverRoot`

- Memo stability: `usePopoverRoot` memoises `{ ...root, shown, setShown, hiddenBeforeToggle }`
  on `[root, shown, setShown, hiddenBeforeToggle]`; `setShown` has `[]` deps and
  `hiddenBeforeToggle` depends on `popupRef` (a stable ref object). So the value changes iff
  `root` or `shown` changes, which is exactly the old single memo's dependency set (`epoch`
  included, through `root`). Mutation 1 confirms `shown` is load-bearing.
- `{ ...options, isShown: isPopoverOpen }` creates a new object per render, but
  `useOverlayRoot` only destructures it and reads `isShown` through `useLatest`; no identity use.
- `hiddenBeforeToggle` used `callbacks.current.isShown ?? isPopoverOpen`; no popover Root passed
  `isShown`, so hard-coding `isPopoverOpen` is the same function. `clearLater` likewise: Dialog
  passes `isDialogOpen`, the popover Roots now pass `isPopoverOpen` (was the default).
- Hook order: the `shown` `useState` moves after all of `useOverlayRoot`'s hooks. Consistent per
  component, so harmless.
- Dialog losing `shown` / `setShown` / `hiddenBeforeToggle`: no reader in `dialog/` (grepped),
  the old type omitted the first two; nothing spreads or enumerates the context. Unobservable.

## Commit 2: grouping

Types and comments only. The groups are a real readability gain over a flat 20-member list, and
the doc comments say who calls what. They are descriptive rather than enforced (every part still
receives the whole intersection), and slightly approximate: `recordCloseIntent` (in Requests) is
also called by both Popups and `useApplyOpenState`; `latestInFlight` (in PopupChannel) is read by
Dialog.Root, which the comment says. Fine for an internal type.

## Commit 3: `onActivate` / `submenuItem`

- Handler order: `onClick` still runs `preventDefault`, the `disabled` check, then
  `onActivate(event)` or the default `toggleFromTrigger(ctx, event.nativeEvent)`. Menu.Trigger's
  `onActivate` is the exact old call (`toggleFromTrigger(menu.popover, native, () =>
  setOpenCause(...))`; `menu.popover` is the `ctx` it hands the hook). SubmenuTrigger's
  `onActivate` is its old `activate`. Merging of component handlers in front is untouched.
- Disabled: `alwaysFocusable: submenuItem` equals the old `disabledAs === "aria"`; only
  SubmenuTrigger set either. Mutation 2 pins it.
- Warning wording: old key `activate !== undefined` was true only for SubmenuTrigger; new key
  `submenuItem` is true only for SubmenuTrigger. Text strings unchanged. Keying on `onActivate`
  would have been a regression (Menu.Trigger now passes one); mutation 3 shows the test catches it.
- `submenuItem` couples two behaviours, but they always come together and the name says why.

## Commit 4: `initialFocus` resolver

- `staticFocus` (undefined for a function) is what the callback ref deps and the JS-free
  `autofocus` write use, so Menu's and Combobox's inline resolvers still do not re-create the
  ref (mutation 4). `resolveFocusTarget` reads `initialFocus` from the same render's options as
  the old `options.resolveInitialFocus`.
- Public type: `Popover.Popup`'s `initialFocus` stays `RefObject<HTMLElement | null> | string`
  (popover-popup.tsx:105). Keep it so: the resolver contract (called with the popup element,
  `QuietFocusTarget`) is internal.
- Edge case (plain JS passing a function to Popover's `initialFocus`): before, it was treated as a
  ref (`fn.current` undefined), giving the "outside the popup" dev warning and the platform's
  choice. Now it is called: a function returning an element works (undocumented), one returning
  `null` or a non-element object leaves it to the platform, but one returning `undefined` throws
  `TypeError` at `resolved.element` (use-popover-popup.ts:169) inside the open. Acceptable: it is
  type-violating input only, and the library does not validate other prop types at runtime.
  Optional hardening: `if (resolved == null) return null;` at use-popover-popup.ts:167 (Base UI
  migrants may pass a function `initialFocus` in JS).

## Nits (optional)

1. Stale comments naming `useOverlayRoot` for what is now `usePopoverRoot`:
   menu/menu-root.tsx:247 ("`popover` is memoised by `useOverlayRoot`"),
   menu/menu-context.ts:68 and combobox/combobox-context.ts:16 ("The shared popover machinery
   (`useOverlayRoot`...)").
2. The `resolved == null` guard above.
3. Merge note: CHANGELOG conflict with helpers-followup is append-only; keep both sides.
