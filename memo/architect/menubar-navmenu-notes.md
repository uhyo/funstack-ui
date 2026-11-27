# Menubar / NavigationMenu notes (#170, wave 26)

Docs: `design/components/menubar.md`, `design/components/navigation-menu.md` (both proposed).

## Menubar: how I got to "one element + Menu parts"

- `Menu.Trigger` already reads `ToolbarContext` (toggle-group.md 7.4). A bar context read is the
  same move. In a bar the Trigger is attribute-for-attribute a `SubmenuTrigger`
  (`button[role=menuitem][popovertarget][aria-haspopup=menu]`, aria-disabled when disabled);
  `usePopoverTrigger` has a `submenuItem` option that probably gives most of it.
- `use-roving-focus.ts` `isNestedOut` already drops `[popover]` content, so the bar's items are
  exactly the Triggers. `memory: true`, `entry: first`, as Toolbar.
- Sibling `popover="auto"` exclusivity is free. The switch only needs "focus target Trigger"
  (Menu's root-popup `focusout` then hides the old menu) + close the rest + `requestOpen`.
- Considered and rejected: old menu stays shown until the new one commits. HTML show-popover
  records `originallyFocusedElement` after hide-all-popovers but before focus fixup, so the new
  popup's "previously focused element" would be the old menu's (now hidden) item; Escape would
  drop focus on body and rely on the Popover 6.2 fallback. Not probed. Focus-first avoids the
  whole question. Listed as user decision 2.
- The in-menu forward key: the popup keydown handler of the popup the item is in (submenu
  popups handle their own items; `isMenuItem(target, popup)` keeps parents out). A
  SubmenuTrigger prevents its forward arrow first, so the popup handler's `defaultPrevented`
  guard keeps the two apart.
- The bar's context module must live in `internal/` next to `toolbar-context.ts` (Menu parts
  import it; `check-internal-layers` forbids `internal/` importing from `menu/`), so the
  registry entry is a small structural type, not `MenuContextValue`.

Not verified, for the implementer / tester:

- axe / AT tree with `div[role=menu]` as a direct child of `div[role=menubar]` (APG nests it
  under `li[role=none]`; same ownership). Submenus already nest menu in menu.
- hover switch then click on the same Trigger = close (native-like). If users trip on it, a
  short guard is the HoverCard "no open until fresh interest" shape, reversed.

## NavigationMenu: how I got to "Popover per li"

- The APG disclosure nav is `button[aria-expanded]` + region. `button[popovertarget]` +
  `div[popover]` is that with the top layer, light dismiss, Escape and exclusivity from the
  platform, JS-free. `usePopoverRoot` static mode + `usePopoverPopup` with a div (Popover
  already supports `render={<div />}`; focus stays on the trigger).
- Two library closes: focusout of the li (Menu's Tab rule), followed Link (HoverCard's "press on
  the link closes" reasoning).
- Root `value` model would enable a one-commit switch (view-transition morph between panels),
  the only real loss. Listed as user decision 2.
- Link close as a request: unverified claim that it commits together with a router transition
  (FUNSTACK Router navigates in a transition). Check in the example app.
- `ul role="list"`: Safari drops list semantics with `list-style: none`.

## If the user picks hover for NavigationMenu

Reuse `useDelayedPair` + HoverCard's JS interest table on Trigger/Popup; click = pin (set a
"pinned" flag so pointerleave does not close); ignore a click within N ms of a hover open. All
Items library mode. Shared "skip delay" between Items like Tooltip's warm open.

## Router probe result (2026-11-27) and the issue to file

Dev's probe: Link close commits on its own (50-100 ms), route 800 ms later; not one commit.
navigation-menu.md 9.3 rewritten.

Issue text for this repo (a human reports it to uhyo/funstack-router; do not file there):

> Title: FUNSTACK Router's `navigation` transition type can be consumed by an unrelated transition
>
> Found while implementing NavigationMenu (#170), FUNSTACK Router 1.6.0. The router calls
> `addTransitionType("navigation")` before an `await`, and updates its location in a nested
> `startTransition` after it. `addTransitionType` applies to the next transition commit, so
> any transition that commits in between takes the type: here the panel's close
> (`fsui-navigation-menu-close`), which commits 50-100 ms after the click. The route's own
> commit then has no types, so a page `<ViewTransition>` keyed on `navigation` does not
> animate. Chromium: every run; Firefox: about half.
> Repro: example app's NavigationMenu demo (library-mode Item, route suspending 800 ms).
> Suggested fix on the router side: call `addTransitionType` inside the same synchronous
> `startTransition` scope that sets the location (after the await).
> Our side: docs note on the NavigationMenu page (done); nothing to change in the library.
