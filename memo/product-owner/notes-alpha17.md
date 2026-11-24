## What's Changed

This release reworks how the library separates **requests** (`*Action` props, always run in a transition, with pending and optimistic state) from **facts** (`on*` handlers, called synchronously for changes the library cannot hold). See [Action props](https://ui.funstack.work/concepts/action-props) and [Browser-owned state](https://ui.funstack.work/concepts/browser-owned-state).

### Breaking Changes

- **Overlay dismissals moved to `onOpenChange`** (#148). `Popover.Root`, `Menu.Root` (context menus and submenus included), `Combobox.Root` and `Dialog.Root` now call `openChangeAction` for requests only (Trigger, Close parts, item activation, `Dialog.Form`). A close the library did not perform (Escape, light dismiss, focus leaving, back gesture) is reported through the new `onOpenChange(false, details)`: synchronously, with no pending state and no view transition. A controlled Root needs both: `open={open} openChangeAction={setOpen} onOpenChange={setOpen}`; `open` without `onOpenChange` warns in development. Code that checked `reason === "dismiss"` in `openChangeAction` must move to `onOpenChange`. A controlled parent that keeps `open={true}` after a dismissal re-opens the popup.
- **Toast `closeAction` is renamed `onClose`** (#148) and follows the `on*` rule below.
- **Button no longer ignores clicks while pending by default** (#146). New `whilePending="run" | "ignore"` prop on `Button`, `Dialog.Close`, `Popover.Close`, `Menu.Item` and `Toast.Action`. Defaults follow who owns the action: `Button` (including a function `formAction`) runs every click; Close parts ignore repeats; `Menu.Item` and `Toast.Action` ignore repeats when they close their container (`closeOnActivate` / `closeOnSettle`). Add `whilePending="ignore"` to Save-style buttons. `aria-disabled` is set while pending only when ignoring.
- **A superseded action's rejection goes to `reportError`** (#145). When an older, overlapping action rejects after a newer one started, the error is passed to `reportError` instead of being rethrown to the Error Boundary (React's `useTransition` silently drops it). The latest action's rejection still reaches the boundary.

### Features

- **One rule for every `on*` handler** (#148): `onOpenChange`, Toast's `onClose` and Combobox's `onInputValueChange` are called synchronously and not awaited; a returned promise's rejection, or a thrown error, goes to `reportError`. `onInputValueChange` no longer warns about a returned promise. New public type `UrgentHandler`.
- **No CSS recipe for a popup with both a CSS exit and the `transition` prop** (#147). The library now cuts the popup's CSS transition around its own show and hide while a view transition runs, restoring your inline style through CSSOM (safe under a strict CSP). The `html:active-view-transition … { transition: none }` rule can be removed. Only CSS transitions are cut; write exits as `transition`, not `@keyframes`.

### Fixes

- CheckboxGroup, and ToggleGroup and Accordion without `exclusive`, no longer commit a change whose action rejected when a later change resolved (#150). Exclusive modes commit the latest resolved value.
- A CheckboxGroup form reset during an in-flight save is no longer undone by that save's rollback (#151).
- A latest action's rejection is no longer lost when its component has unmounted or is hidden (`<Activity>`, a Suspense fallback, a closed `keepMounted` overlay); it goes to `reportError` (#152).
- In `whilePending="run"` mode, a closing part closes only after its last run settles and the latest run resolved, so a rejection leaves the overlay open (#146).
- A controlled Menu, or a `<div>` Popover, re-opened after a refused dismissal no longer moves focus back inside, which removes a keyboard trap (#155).

**Full Changelog**: https://github.com/uhyo/funstack-ui/compare/0.1.0-alpha.16...0.1.0-alpha.17
