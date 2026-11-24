# #157 rank 11: slim the overlay hook interfaces

Branch `refactor/157-overlay-interfaces` (not merged), from master f0a7fac. Internal only; no
test weakened or removed. Source: memo/architect/refactor-audit.md rank 11, rule map rows 6, 7, 14.

## Commits

1. 44b779e `refactor(ui): move the popover shown mirror out of useOverlayRoot into usePopoverRoot`
   - `useOverlayRoot` (core, Dialog) no longer has `shown` / `setShown` / `hiddenBeforeToggle`.
   - `usePopoverRoot(options)` (same module): `useOverlayRoot({ ...options, isShown: isPopoverOpen })`
     + the `useState` mirror + `hiddenBeforeToggle`, memoised on `[root, shown, ...stable]`, so the
     value changes exactly when it did before. Popover, Menu, Combobox Roots call it.
   - `PopoverRootValue` is an interface extending `OverlayRootValue<HTMLElement, []>`;
     `DialogContextValue` extends `OverlayRootValue` without `Omit`.
   - `isShown` is required on `useOverlayRoot` (was optional, default `:popover-open`).
   - Runtime difference: Dialog.Root has one `useState` fewer and its context object has no
     `shown` / `setShown` keys (no reader existed; types forbade it). Not observable.
   - Docs: conventions 3.2 `shown` row + 9.1 listing; menu.md, combobox.md, popover.md 15 hook name.
2. 85d9a46 `refactor(ui): group OverlayRootValue's members by the parts that use them`
   - `OverlayRootState` (mode, ids, committed, optimistic, pending, epoch),
     `OverlayRootRequests<CloseArgs>` (intended, requestOpen, requestClose, openGeneration,
     recordCloseIntent), `OverlayRootPopupChannel<CloseArgs>` (notifyClosed, nextOpenGeneration,
     takeCloseIntent, latestInFlight), `OverlayRootRefs<Popup>` (triggerRef, popupRef).
     Types and comments only.
3. 12b05ed `refactor(ui): usePopoverTrigger takes onActivate and submenuItem ...`
   - `activate` + `beforeOpen` -> `onActivate(event)` (default `toggleFromTrigger(ctx, native)`).
     Menu.Trigger passes `toggleFromTrigger(menu.popover, native, () => setOpenCause(...))`, the
     exact call the hook made before. `toggleFromTrigger` itself untouched (followup branch moves it).
   - `disabledAs: "aria"` -> `submenuItem: true`, which also picks the non-button warning text
     (was keyed on `activate !== undefined`). Both were SubmenuTrigger-only. Warning text unchanged
     (menu.test.tsx:2211 pins it).
   - Docs: conventions 1.2 `alwaysFocusable` sentence.
4. 9d10ed4 `refactor(ui): fold usePopoverPopup's resolveInitialFocus into initialFocus`
   - One option: ref | selector | resolver function. `staticFocus` (non-function) is what the
     JS-free `autofocus` write and the callback ref deps use, so an inline resolver still does not
     re-create the ref. Edge: a JS consumer passing a function as Popover's public `initialFocus`
     (type says ref | string) would now have it called as a resolver; type-violating input only.
   - Docs: popover.md 6.1, 15.

Each commit with a design doc change has a CHANGELOG `## 2026-11-24, #157: ...` entry.

## Member counts

| Interface | Before | After |
| --- | --- | --- |
| `OverlayRootValue` | 20 (flat) | 17 (6 state + 5 requests + 4 popup channel + 2 refs) |
| `PopoverRootValue` | 20 (alias) | 20 (17 + `shown`, `setShown`, `hiddenBeforeToggle`) |
| `DialogContextValue` (typed) | 21 (20 - 2 omitted + 3) | 20 (17 + `modal`, `takeCloseReturnValue`, `requestClose` restated) |
| `UseOverlayRootOptions` | 10 (`isShown?`) | 10 (`isShown` required); `usePopoverRoot` takes 9 |
| `UsePopoverTriggerOptions` | 7 | 6 |
| `UsePopoverPopupOptions` | 7 | 6 |

## Test changes (adaptations, not weakening)

`internal/use-popover-hooks.test.tsx` drives the internal hooks directly, so it follows the
renames: `useOverlayRoot` -> `usePopoverRoot` (the harness and the #48 stability row: stability
of `usePopoverRoot` implies the core's, since `root` is a memo dependency), and
`initialFocus: undefined, resolveInitialFocus: resolve` -> `initialFocus: resolve` (one row title
and the header comment renamed). Assertions unchanged.

## Left as is

- `epoch`: no part reads it, but it is what makes a fact re-render the parts (in the memo); now
  documented as such. Removing it from the value but keeping it in the deps would trip the
  hooks lint on an unused dependency.
- `usePopoverPopup`'s `source` and `reshow` (Menu only), `whileShown` (Menu and Combobox): one
  optional function each; a Menu extension object would not make them clearer.
- `combobox-trigger.tsx` (own Trigger) and Dialog's apply / close handlers: untouched.

## Test runs

At 9d10ed4 (and typecheck / lint / format / jsdom at every commit): `pnpm typecheck`, `pnpm lint`
(3 warnings, all pre-existing on master: toast.test.tsx, menu-submenu-trigger.tsx,
combobox-root.tsx:597, checked against master's file), `pnpm format:check`, `pnpm test:jsdom`
(81 files, 3899 tests), `pnpm build` green. `FUNSTACK_BROWSERS=chromium,firefox pnpm test:browser`:
54 files, 1049 passed, 39 skipped (master: same, memo issue-157-helpers.md; no browser test
file differs from master). WebKit not run locally.
