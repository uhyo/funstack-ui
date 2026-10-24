# Menu (menu button)

Status: **accepted** (2026-10-17, GitHub issue #39; the product owner accepted all eleven
questions as recommended, see the end of this document). **Implemented** in #41 (a456681; the
shared `useActionTrigger` in ac7064e) and reviewed the same day: the review corrections and the
six accepted deviations are folded into the sections below and listed at the end of this
document. **Amended 2026-10-22 with the context menu** (#45, `design/components/context-menu.md`,
accepted the same day): `Menu.ContextTrigger` in 1 and 3.9, the outside right- / middle-click close for every
menu in 2.2, `data-context`, the point placement and the owned `onContextMenu` in 3.3, the
placement in 14. Follows `design/conventions.md` (accepted);
where this document and the conventions disagree, the conventions win. **Read
`design/components/popover.md` first** (accepted): Menu is built on its internal hooks
(`useOverlayRoot`, `usePopoverPopup`, `usePopoverTrigger`), its ownership split (library-owned
open and part-initiated closes, browser-owned dismissals), its apply effect, close intents,
nested focus-return rule, deferred unmount, `aria-expanded` handling, positioning helper and
`<ViewTransition>` wiring around the top-layer element. This document repeats only what differs
and adds what a menu is: items with actions, checkbox and radio items with optimistic state,
the APG keyboard model, typeahead, submenus with hover intent, and the `focusgroup="menu"` flag.

Inputs: `docs/vision.md`, `design/conventions.md`, `docs/research/popover-menu.md` (primary; its
verdicts are binding), `design/components/popover.md`, `design/components/tabs.md` (roving
focus and keyboard conventions, `experimental_focusgroup`), `design/components/toggle.md` and
`design/components/radio-group.md` (single-value optimistic state shapes),
`memo/developer/cross-engine.md` (#43: `focusGroup`, `tabindex="-1"` outside a focusgroup), the
WAI-ARIA APG Menu Button and Menu patterns, the Open UI menu-elements explainer (as a naming and
semantics guide), prior art (Base UI Menu, Radix DropdownMenu, React Aria Menu, Ark UI Menu,
Headless UI Menu), and working notes in `memo/architect/menu-notes.md`. Product-owner scoping:
context menus are out (#45); menubars are not designed here.

There is no native menu (research). The platform gives the popover half: top layer, light
dismiss, Escape, stacking and nesting through `showPopover({ source })`, the implicit anchor,
focus return for the first popover in a stack. The library owns the menu half: which item is
current, arrow keys, Home/End, typeahead, submenu keys, closing the stack when focus leaves, and
focus return for submenus. The Async React half is the point: **an item's `action` runs in a
transition with `data-pending` on the item, and the menu closes in the commit that ends it**, so
a Server Function behind "Archive" shows its progress where the user clicked and the menu leaves
with a view transition in every engine.

## Decisions at a glance

| # | Topic | Decision |
| --- | --- | --- |
| 1 | Anatomy | `Menu.Root` (no DOM; a Root rendered inside a `Menu.Popup` is a **submenu**), `Menu.Trigger` (`button[popovertarget][aria-haspopup=menu]`, no `aria-expanded`, #121), `Menu.Popup` (`div[popover=auto][role=menu]`), `Menu.Item` (`button[role=menuitem]`), `Menu.CheckboxItem` (`role=menuitemcheckbox`), `Menu.RadioGroup` (`div[role=group]`) with `Menu.RadioItem` (`role=menuitemradio`), `Menu.Group` (`div[role=group]`) with `Menu.GroupLabel`, `Menu.Separator` (`hr`), `Menu.SubmenuTrigger` (`button[role=menuitem][aria-haspopup=menu]`). No Portal, Positioner, Arrow. |
| 2 | Mode | **Always library mode.** A menu cannot be APG-conformant without JS, so there is no JS-free mode: `open` / `defaultOpen` / `openChangeAction` select controlled or uncontrolled, never a mode. The Trigger still renders `popovertarget` (#121; `commandfor` + `toggle-popover` before), so a pre-hydration click opens the (empty) menu natively and mount reconciliation fills it (Popover 2.4). |
| 3 | Item activation and close (research Q1) | `Menu.Item action` runs in the item's own transition with `data-pending` on the item; **the menu stays open until the action settles, then the whole stack closes through the root Root's library-owned close** (`requestClose`, `openChangeAction(false)` awaited, `hidePopover()` in the apply effect, view transition if set). A sync action closes in the same tick, so the browser-feel is unchanged for the common case; a slow Server Function shows progress on the item and never leaves the user with a vanished menu and no feedback. A rejection leaves the menu open and reaches the nearest Error Boundary. |
| 4 | Checkbox / radio items | `CheckboxItem` (`checked` / `defaultChecked` / `checkedChangeAction`) and `RadioGroup` (`value` / `defaultValue` / `valueChangeAction`) are state owners with `useOptimistic`: `aria-checked` and `data-checked` flip at once, `data-pending` while the action runs, rollback on rejection. **They keep the menu open by default** (APG: Space toggles without closing; toggling several options is the use case); `closeOnActivate` on every item kind overrides the default either way (`Item` defaults to `true`). |
| 5 | Keyboard | APG Menu Button + Menu: Enter / Space / ArrowDown open with the first item focused, ArrowUp with the last; Up / Down move (wrap by default, `loop={false}` stops), Home / End, typeahead, Enter / Space activate, Escape closes the innermost menu, Tab / Shift+Tab close the whole stack and move on, ArrowRight / ArrowLeft open / close submenus (mirrored under `direction: rtl`). Disabled items are focusable (`aria-disabled`) and never activate. |
| 6 | Focus model | Real DOM focus on items (roving: `tabindex="-1"` on every item, focus moved by script), never `aria-activedescendant`. On every open the first item is focused (last for ArrowUp) through the Popover hook's `autofocus` write; a hover-opened submenu keeps focus on its trigger. Pointer movement over an item focuses it, so keyboard and pointer always agree on the current item; pressing non-item space (padding, a separator) never moves focus off it. Whether the item shows a ring after a pointer open is the engine's `:focus-visible` heuristic (WebKit may show one; 6.1). |
| 7 | Submenus | A nested `Menu.Root` whose `Menu.SubmenuTrigger` is an item of the parent menu. Opened with `showPopover({ source: submenuTrigger })` (nested auto popover: the parent stays open, siblings close each other), placed `side="inline-end" align="start"` (`self-x-end span-bottom`: the right of the item in LTR, its left in RTL, the side the mirrored arrow keys point to; wave 11, #53; `side="right"` before) with `position-try-fallbacks: flip-inline`. Opened by ArrowRight / Enter / Space / click (first item focused) or by hover intent (`delay` 100 ms, no focus move); closed by ArrowLeft, Escape (innermost only), hover leaving to a sibling item (`closeDelay` 150 ms), or the stack closing. Focus returns to the SubmenuTrigger through Popover 6.2's rule (the platform restores nothing for nested popovers). |
| 8 | Hover intent (research Q5) | Timers only: `delay` / `closeDelay` on the submenu's `Menu.Root`, defaults 100 / 150 ms, implemented with the same small internal timer helper Tooltip's interaction uses for its delays, **not** Tooltip's interaction hook (focus, blur, document listeners and `interestfor` do not apply). No "safe triangle" in v0; `closeDelay` covers a diagonal move into the submenu. `interestfor` is not used (research: opens on focus and collapses the stack on Escape). |
| 9 | `experimental_focusgroup` | On `Menu.Popup`: renders `focusgroup="menu wrap|nowrap"` (`wrap` from `loop`), detected with `"focusGroup" in HTMLElement.prototype` through `useSyncExternalStore` (#43); on the native path items render **no** `tabindex` (Chromium leaves `tabindex="-1"` elements out of the group) and the JS Up / Down / Home / End branch steps aside. Typeahead, Enter / Space, submenu keys and Tab-closes-stack stay JS everywhere. |
| 10 | Closing the stack on Tab | A `focusout` listener on the **root** menu's Popup: when `relatedTarget` is outside the menu tree (the root Popup's subtree, which contains every submenu as a DOM descendant, since nothing portals), the root Popup hides itself (`hidePopover()`, the platform hides nested popovers) and every Root is notified with `reason: "dismiss"`. A null `relatedTarget` (window blur) closes nothing. A press on the Trigger of an open menu is not a focus-out: `Menu.Trigger` prevents the `mousedown` default while `intended()` is `true`, so focus stays on the current item in every engine and the click's library-owned close is the one source of the close (#110). Nor is a press on a **foreign invoker** of the root popup (a consumer `<button>` whose `popovertarget`, or `commandfor` with a popover `command`, names it): the root Popup prevents its primary `mousedown` while shown, so the click's native toggle closes the menu and #125 names it `"activate"` (#126). |
| 11 | ARIA | Trigger: `aria-haspopup="menu"`, `aria-expanded` (shown: the Root's mirror of the Popup's `toggle`, #118), `id`. Popup: `role="menu"`, `aria-labelledby` → the Trigger (or SubmenuTrigger) id. Items: explicit `role`s, `aria-disabled`, `aria-checked` from optimistic state. `Menu.Group` / `Menu.RadioGroup`: `role="group"` + `aria-labelledby` → `GroupLabel`. `Separator`: `<hr>` (implicit `separator`). |
| 12 | Pending UI | Trigger: `data-open`, `data-pending` (Root pending: open or close in flight). Item: `data-pending` while its action runs. CheckboxItem / RadioItem: `data-checked` (optimistic), `data-pending`; `RadioGroup`: `data-pending` (owner). Popup: nothing (`:popover-open`). |
| 13 | Content mounting | Conventions 3.7 unchanged: Popup children unmount when closed by default; `keepMounted` keeps them in `<Activity mode="hidden">`. Items are read from the DOM at keydown time (no registration), so mounting strategy does not affect keyboard code. |
| 14 | Animation | As Popover: CSS for opens and dismissals; `transition` on Popup wraps the `<div popover>` and animates library-driven opens and closes (item activation, Close, ArrowLeft, hover close, controlled) in every engine. Types `fsui-menu`, `fsui-menu-open`, `fsui-menu-close`; item state types `fsui-menu-check` / `fsui-menu-uncheck` / `fsui-menu-select`. |
| 15 | Out of scope | Menubars (`ArrowLeft` / `ArrowRight` between top-level menus), `interestfor`, the Open UI `<menulist>` elements (a future `experimental_` rendering), `Menu.Form`. |
| 16 | Context menus (#45) | `Menu.ContextTrigger`: a plain region (no ARIA) whose `contextmenu` or long-press opens the same `Menu.Popup` at the pointer, with no anchor (`--menu-point-x` / `-y` and three shipped `@position-try` options), `source: region` for nesting, pointer capture on the hidden popup against the Firefox / WebKit `pointerup` light dismiss, and a move (no dispatch) on a second right-click. A Root may hold a `Trigger` and a `ContextTrigger`. Also for **every** menu: a right- or middle-click outside closes the stack at once (`"dismiss"`), and every `Menu.Popup` claims the `pointerdown`s inside it so that a long-press on an item never times an enclosing region's gesture (review M1). Implemented in 27c6c11, reviewed a8d09c7. Design: `design/components/context-menu.md`. |

---

## 1. Anatomy

```tsx
import { Menu } from "@funstack/ui/menu";

<Menu.Root>                                                 {/* no DOM; owns ids, open state, context */}
  <Menu.Trigger>Actions</Menu.Trigger>                      {/* button[popovertarget][aria-haspopup=menu] */}
  <Menu.Popup align="start">                                {/* div[popover=auto][role=menu] */}
    <Menu.Item action={() => rename(id)}>Rename</Menu.Item> {/* button[role=menuitem] */}
    <Menu.Item action={archive.bind(null, id)}>Archive</Menu.Item>   {/* a Server Function */}
    <Menu.Separator />                                      {/* hr */}
    <Menu.Group>
      <Menu.GroupLabel>View</Menu.GroupLabel>
      <Menu.CheckboxItem checked={showDone} checkedChangeAction={(next) => { setShowDone(next); }}>
        Show completed
      </Menu.CheckboxItem>
      <Menu.RadioGroup value={sort} valueChangeAction={(next) => { setSort(next); }}>
        <Menu.RadioItem value="name">By name</Menu.RadioItem>
        <Menu.RadioItem value="date">By date</Menu.RadioItem>
      </Menu.RadioGroup>
    </Menu.Group>
    <Menu.Separator />
    <Menu.Root>                                             {/* a submenu: a Root inside a Popup */}
      <Menu.SubmenuTrigger>Move to</Menu.SubmenuTrigger>    {/* button[role=menuitem][aria-haspopup=menu] */}
      <Menu.Popup>                                          {/* side="right" align="start" by default */}
        <Menu.Item action={() => move(id, "inbox")}>Inbox</Menu.Item>
        <Menu.Item action={() => move(id, "later")}>Later</Menu.Item>
      </Menu.Popup>
    </Menu.Root>
    <Menu.Item action={() => remove(id)} className="danger">Delete</Menu.Item>
  </Menu.Popup>
</Menu.Root>
```

Rendered HTML (closed; ids come from one `useId` per Root):

```html
<button type="button" id="_r_1_-trigger" popovertarget="_r_1_"
        aria-haspopup="menu">Actions</button>
<div id="_r_1_" popover="auto" role="menu" aria-labelledby="_r_1_-trigger"
     data-side="bottom" data-align="start"
     style="position-area: bottom span-self-x-end; position-try-fallbacks: flip-block, flip-inline, flip-block flip-inline">
  <!-- children render on open (default); shown here as they will be. `data-side` / `data-align`
       are the resolved placement while shown (conventions 13.2): `top` here if the menu flipped. -->
  <button type="button" role="menuitem" tabindex="-1">Rename</button>
  <button type="button" role="menuitem" tabindex="-1">Archive</button>
  <hr>
  <div role="group" aria-labelledby="_r_1_-g1">
    <div id="_r_1_-g1">View</div>
    <button type="button" role="menuitemcheckbox" aria-checked="true" tabindex="-1" data-checked="">Show completed</button>
    <div role="group">
      <button type="button" role="menuitemradio" aria-checked="true" tabindex="-1" data-checked="">By name</button>
      <button type="button" role="menuitemradio" aria-checked="false" tabindex="-1">By date</button>
    </div>
  </div>
  <hr>
  <button type="button" id="_r_2_-trigger" role="menuitem" tabindex="-1"
          popovertarget="_r_2_" aria-haspopup="menu">Move to</button>
  <div id="_r_2_" popover="auto" role="menu" aria-labelledby="_r_2_-trigger"
       data-side="inline-end" data-align="start"
       style="position-area: self-x-end span-bottom; position-try-fallbacks: flip-inline">…</div>
  <!-- the submenu's `data-side` is `right` (LTR) or `left` (RTL) once shown -->
  <!-- the closed value is the requested `inline-end` -->

  <button type="button" role="menuitem" tabindex="-1" class="danger">Delete</button>
</div>
```

| Part | Element | Role | Library state rendered | Notes |
| --- | --- | --- | --- | --- |
| `Root` | none | | `state.open` (optimistic), `state.pending`, `state.submenu` in `children(state)` | `useOverlayRoot({ component: "menu", mode: "library", details: popoverDetails })`. A Root under a `MenuContext` is a submenu. |
| `Trigger` | `button` | button | `data-open` (optimistic), `data-pending`, `data-disabled`; no `aria-expanded` (a `popovertarget` invoker, #121) | `usePopoverTrigger` plus `id`, `aria-haspopup="menu"` and the open-with-focus keys. Only valid in a top-level Root (dev warning otherwise). |
| `Popup` | `div` | `menu` | `data-side`, `data-align` (the resolved placement while shown, conventions 13.2) | `usePopoverPopup` with Menu's initial-focus resolver, keyboard handling, typeahead, `focusout`, `focusgroup`; `useResolvedPlacement` for the attributes. |
| `Item` | `button` | `menuitem` | `data-pending`, `data-disabled` | `action`, `closeOnActivate` (default `true`). |
| `CheckboxItem` | `button` | `menuitemcheckbox` | `aria-checked`, `data-checked` (optimistic), `data-pending`, `data-disabled` | `checked` triple; `closeOnActivate` default `false`. |
| `RadioGroup` | `div` | `group` | `data-pending` | `value` triple; `aria-labelledby` → a `GroupLabel` child. |
| `RadioItem` | `button` | `menuitemradio` | `aria-checked`, `data-checked` (optimistic), `data-pending` (initiating item), `data-disabled` | `value`; `closeOnActivate` default `false`. |
| `Group` | `div` | `group` | none | `aria-labelledby` → `GroupLabel`. |
| `GroupLabel` | `div` | | none | `id` wiring. |
| `Separator` | `hr` | `separator` (implicit) | none | `render={<div role="separator" />}` if an `<hr>` cannot be styled as wanted. |
| `SubmenuTrigger` | `button` | `menuitem` | `data-open` (optimistic), `data-pending`, `data-disabled`; no `aria-expanded` (a `popovertarget` invoker, #121) | Both an item of the parent menu and the Trigger of the submenu: `popovertarget`, `aria-haspopup="menu"`, roving `tabindex`, typeahead participation, ArrowRight / Enter / Space / click / hover open. |
| `ContextTrigger` | `div` | none | `data-open` (optimistic), `data-pending`, `data-disabled`; inline `-webkit-touch-callout: none` | #45: the region whose `contextmenu` (and touch / pen long-press) opens the Popup at the pointer. No ARIA. Top-level Roots only. `design/components/context-menu.md`. |

Why these parts:

- **Items are `<button type="button">`** with explicit roles (research): Enter and Space
  activate natively, `type="button"` keeps them out of forms, and `render` can substitute a link
  (`render={<Link href />}` for a navigation item) at the cost of native activation, which the
  keydown handler supplies through `element.click()` (5.3), so the link still navigates. `disabled` becomes `aria-disabled="true"`, never the native
  attribute: the APG wants disabled items focusable, and Chromium's `focusgroup` skips natively
  disabled buttons.
- **A submenu is a nested `Menu.Root`**, not a `Submenu*` family. The Popover hooks already make
  a nested Root a nested auto popover; the only new part is `SubmenuTrigger`, because the trigger
  of a submenu is also an item of its parent (role, roving focus, typeahead, arrow keys). Base
  UI's `SubmenuRoot` / `SubmenuTrigger` and Radix's `Sub` / `SubTrigger` / `SubContent` were
  considered; one Root with a context-detected `submenu` flag has fewer names and the same
  behaviour.
- **Separate checkbox and radio parts, not a `type` prop** (Open UI's shape): the state triples
  differ (`checked` versus the group's `value`), and `RadioGroup` is the state owner for radios,
  as in the form `RadioGroup`.
- **`GroupLabel`, not `Label`**: the conventions' `Label` names its owner; a `Label` directly
  under `Popup` would read as the menu's name, which is the Trigger's job (`aria-labelledby`).
  `GroupLabel` is Base UI's name and is unambiguous. Added to the part vocabulary (feedback).
- **`Separator` is an `<hr>`**: the platform's separator with the implicit role, what Open UI
  proposes for `<menulist>`, and it needs no `aria-orientation` in a vertical menu.
- **No `Menu.Close`**: Escape and Tab close a menu; a "Cancel" item is a plain `Item` with no
  `action` (activation closes). No `Menu.Title` / `Description`: the Trigger names the menu.

Element constraints for `render`: `Trigger` and `SubmenuTrigger` should render a `<button>` for
the command path (another element works through the click handler, but a non-button `Trigger`'s
press while the menu is open is a light dismiss, not the awaited close of 2.2 / #110: the
platform exempts invoker buttons only; dev warning, popover.md 2.7 and #115; a non-button
`SubmenuTrigger`'s press while its submenu is open dismisses the submenu instead of moving focus
into it, with its own warning text); items may render anything
focusable (a link, a `div` with `tabIndex`), with the keydown handler providing Enter / Space;
`Popup` should render a `<div>` (a `<dialog>` would run the dialog focusing steps and fight the
item focus); `RadioGroup` / `Group` any element; `Separator` any element with `role="separator"`
if not an `<hr>`. Dev warnings as Popover.

---

## 2. Open, close and the menu's own closes

### 2.1 Open is library-owned, always

`Menu.Root` calls `useOverlayRoot` with `mode: "library"` unconditionally. Without `open` /
`defaultOpen` / `openChangeAction` it is an uncontrolled, action-less state owner (no mode
switch to warn about). Everything in Popover 2.2, 2.4 and 2.5 applies: Trigger click intercepted
(`preventDefault()` cancels the command; toggle against `intended()`), foreign opens cancelled at
`beforetoggle` and routed through the library, `showPopover({ source: trigger })` in the apply
effect, mount reconciliation for a pre-hydration click, the `awaitingClose` guard, controlled
`open`.

```tsx
// Uncontrolled, no action: the usual menu.
<Menu.Root>…</Menu.Root>

// Load the items on open: the Trigger shows data-pending until <RowActions> resolves.
<Menu.Root openChangeAction={(open) => analytics.track("row-menu", open)}>…</Menu.Root>

// Controlled.
<Menu.Root open={open} openChangeAction={(next) => { setOpen(next); }}>…</Menu.Root>
```

Why no JS-free mode: arrow keys, typeahead and focus management cannot come from the platform
outside Chromium's flagged `focusgroup`, so a menu that "works before hydration" would be a list
of buttons with Tab navigation, which the research calls acceptable progressive enhancement but
not a supported mode. The Trigger keeps `popovertarget` for that enhancement
(and for the implicit anchor and the implicit expanded state every engine exposes, #121), so a pre-hydration click opens the
menu natively, empty by default, reconciled on mount exactly as Popover 2.4. Consumers who need
items in the server HTML use `keepMounted`? No: a hidden `<Activity>` emits no HTML either. A
menu whose pre-hydration experience matters is rare; it is recorded as question 3.

### 2.2 The menu's closes

| Close | Owner | What happens | `reason` |
| --- | --- | --- | --- |
| Item activation (after its `action` settles), with `closeOnActivate` | library, **root Root** | the item calls the root menu's `requestClose(event, "activate")`; `openChangeAction(false)` of the root Root awaited; committed `false`; apply effect `hidePopover()` on the root Popup; the platform hides every nested popover; each submenu Root's `toggle` listener notifies its own `openChangeAction(false, { reason: "dismiss" })` | root: `"activate"`; submenus: `"dismiss"` |
| Trigger click while open | library | Popover 2.3: click cancelled; `requestClose(event, "activate")`; `openChangeAction(false)` awaited **with the menu still shown** and the Trigger without `data-open`, with `data-pending`, still exposed as expanded by the browser (the menu is shown, #121); committed `false`; apply effect `hidePopover()` (view transition if set). The Trigger's `mousedown` is `preventDefault()`ed while `intended()` is `true`, so the press moves no focus and the `focusout` close below cannot pre-empt the click (#110) | `"activate"` |
| ArrowLeft in a submenu, hover leaving a SubmenuTrigger to a sibling item | library, that submenu's Root | `requestClose` on the submenu's Root; `hidePopover()` in its apply effect; focus return to the SubmenuTrigger by Popover 6.2's rule (ArrowLeft) or no focus change (hover: focus was never inside) | `"activate"` (ArrowLeft) / `"dismiss"` (hover) |
| Tab / Shift+Tab, focus leaving the tree | library-initiated, browser-shaped | the root Popup's `focusout` listener calls `rootPopup.hidePopover()` at once (no await: the focus has already moved and the menu must not linger over the page); every Root is notified from `toggle` | `"dismiss"` |
| Foreign invoker click while open (a consumer `<button>` whose `popovertarget`, or `commandfor` with a popover `command`, names the root popup) | browser | the root Popup prevents the button's primary `mousedown` while shown, so the press moves no focus and the `focusout` close above cannot pre-empt the click (#126); the press is light-dismiss exempt (conventions 3.5); the click's native toggle (or `hide-popover`) hides the menu and the platform's hide returns focus to the Trigger; notified from `toggle` with the `ToggleEvent` (the `CommandEvent` for `commandfor`) whose `source` is the button (#125) | `"activate"` |
| Escape | browser | innermost menu only (the platform's close-watcher stack); focus returns to its trigger (platform for the root menu, library for a submenu); notification | `"dismiss"` |
| Light dismiss, another `auto` popover or modal dialog opening outside | browser | the whole stack; notifications | `"dismiss"` |
| Controlled parent sets `open={false}` | library | apply effect; echo | (none) |
| Right-click (`contextmenu`) or middle-button `pointerdown` outside the menu tree (#45) | library-initiated, browser-shaped | a document listener the root Popup installs while open calls `rootPopup.hidePopover()` at once, as the Tab path does (Chromium's click-based light dismiss ignores those buttons; native menus close on any click); a `contextmenu` inside the popup is only `preventDefault()`ed; one inside this Root's `ContextTrigger` is a move, not a close | `"dismiss"` |

Why item activation closes **through the root Root** rather than the item's own menu: the APG
and Open UI both close the whole menu on activation, and closing the root popover is one call
that the platform fans out to the nested ones. The item reaches the root through the context
chain (`MenuContext.rootMenu`). A submenu Root's own `openChangeAction(false)` fires as a
`"dismiss"` because, from its point of view, something outside closed it; the docs say so.

Why Tab closes with an immediate `hidePopover()` and not `requestClose`: `requestClose` awaits
`openChangeAction(false)`, and a menu that stays visible while focus is already elsewhere is a
visual bug. The hide is immediate and browser-shaped (CSS exit only); it is the one place Menu
closes the way Dialog does. `focusout` fires for Tab and Shift+Tab (to the Trigger: the popover
follows it in focus order, so Shift+Tab from the first item lands on the Trigger and closes the
menu, as the APG asks) and for a programmatic focus move elsewhere; it does not fire into
submenus (DOM descendants of the root Popup) or on ArrowLeft focus return (the SubmenuTrigger is
inside the tree).

**A press on the Trigger is not a focus-out (#110).** Chromium and Firefox focus a button on
`mousedown`; WebKit never focuses a button on click. Without a rule, a click on the Trigger of an
open menu took two paths. Chromium / Firefox: the press moved focus to the Trigger, the root
Popup's `focusout` hid the menu at once, and its `toggle` task ran before the `click` (the user
holds the button longer than a task), so the Root dispatched `(false, "dismiss")` with the
`ToggleEvent` and the click's `requestClose` found `false` already intended and did nothing: a
browser-shaped close with the wrong reason, the menu gone before `openChangeAction(false)` ran,
no view-transition exit, no veto. (jsdom fires mousedown, mouseup and click in one task, so the
shared suite row saw the click's `"activate"` and passed by that different mechanism.) WebKit:
the press moved nothing, the click dispatched `(false, "activate")`, the menu stayed shown with
its item focused until the action settled, then hid in the commit. **The WebKit path is the
intended one**: it is Popover 2.3 (the Popup's visibility follows committed state in every
overlay; optimistic feedback is the Trigger's `data-open` / `data-pending`, while its
exposed expanded state follows the shown menu, the browser's own since #121), and
it is the item-activation timing of 2.3 applied to the Trigger (pending state shown where it can
be seen, rejection leaves the menu open, exit animatable, controlled veto possible).

So `Menu.Trigger` owns `onMouseDown` and calls `preventDefault()` for the primary button while
`intended()` is `true`, the rule the Popup already applies to its non-item space (6.2) and
Combobox's buttons apply always. Not while the menu is closed: an opening click must focus the
Trigger, which is what the popover records as the element to return focus to. Consequences, now
identical in the three engines: focus stays on the current item through the pending close; a
press that never becomes a click (dragged off) leaves the menu open with its item; a rejection
leaves the menu open with focus still on the item; when the close commits, the platform's hide
returns focus to the Trigger (focus is inside the popup) or the library does (6.3). Shift+Tab to
the Trigger still closes at once: that focus move is not one a press caused. Rejected: hiding at
once on every engine (it would make the Trigger's close browser-shaped and contradict the row
above), and a "pressing" flag the `focusout` handler consults (Chromium would then hold focus on
the Trigger outside the open menu during the pending close and after a dragged-off press, with
no `focusout` left to catch a Tab).

**Nor is a press on a foreign invoker (#126).** A consumer's own `<button popoverTarget={popupId}>`
(or `commandfor` + `toggle-popover` / `hide-popover`) outside the menu is exempt from light
dismiss and its close is `"activate"` (#125), but Chromium and Firefox focus it on `mousedown`
too: the root Popup's `focusout` hid the menu as `"dismiss"`, and the click's native toggle then
re-showed the hidden popover. The root Popup therefore keeps a document capture `mousedown`
listener while shown that prevents the primary button's default when the target's closest
`<button>` is outside the popup and names it (`popoverTargetElement === popup`, or
`commandForElement === popup` with a `*-popover` command). The press then moves no focus in any
engine, the click's native toggle hides the menu, the platform's hide returns focus to the
Trigger, and a dragged-off press leaves the menu open with its item. The `focusout` listener is
unchanged: a Tab onto the same button still closes (the popover follows its source in focus order,
so Tab from the last item lands right after the Trigger), which is why ignoring an invoker
`relatedTarget` there was rejected (amendment below).

### 2.3 Item activation and `closeOnActivate` (research question 1)

```tsx
// inside MenuItem (section 14; useActionTrigger is conventions 3.4)
const { pending, run } = useActionTrigger({ openGeneration: rootMenu.openGeneration }); // the open this activation belongs to
const onClick = (event: MouseEvent) => {                             // Enter / Space arrive here too (5.3)
  if (disabled) return;
  run(
    () => action?.(createActionDetails(event.nativeEvent, {})),
    () => { if (closeOnActivate) rootMenu.requestClose(event.nativeEvent, "activate"); },
  ); // `then` is skipped when the menu was dismissed and re-opened meanwhile (Popover 3.4)
};
```

The three timings that were on the table, and why "stay open, then close in the commit" wins:

| Timing | Behaviour | Verdict |
| --- | --- | --- |
| Close at once, run the action detached | native feel; the item unmounts with the menu, so `data-pending` has nowhere to show; a slow Server Function leaves the user with no feedback and no error surface inside the menu | rejected: contradicts "pending state exposed" |
| Close at once, show pending on the Trigger | feedback lands on the wrong element (the user clicked an item, not the button) and only while the Root's transition is pending; the item's action is not the Root's | rejected |
| **Stay open with `data-pending` on the item; close when the action settles** | sync and fast actions close in the same tick (indistinguishable from "at once"); slow ones show progress where the user clicked; a rejection keeps the menu open and reaches a boundary; the close is library-driven, so `<ViewTransition>` animates the exit in every engine (the research's reason for making activation library-owned) | **chosen** |

This is the Dialog.Close / Popover.Close idiom applied to items. **Amended with #81 (2026-10-22,
`design/components/button.md` 16):** a second activation (click, Enter, Space) while the item's
own action is pending is **ignored** (`useActionTrigger`'s in-flight guard; the event is
`preventDefault()`ed) and the item renders `aria-disabled="true"` while it shows `data-pending`;
`data-disabled` and `state.disabled` are unaffected. Navigation is unaffected too: the arrows,
Home / End and typeahead never skipped disabled items (APG: disabled items are focusable; 5 and
5.3), so a pending item is an ordinary item for them; the one place that reads disabledness,
`edgeItem` (the open focus, and the Trigger's ArrowDown / ArrowUp while open), keys on
**`data-disabled`** (the `disabled` prop), not on `aria-disabled`, so a pending item is still an
enabled item for the open focus (wave 9 review L1). Before #81 a
second click re-ran the action and the first `requestClose` won. The part is still never
*natively* disabled while pending (conventions 3.6 as amended). A consumer who wants "close now,
work later" writes `action={() => { void archive(id); }}` (not awaited; conventions 2.3 item 5).
`CheckboxItem` and `RadioItem` are state owners, not pure triggers: unchanged, latest intent wins.

`closeOnActivate` (boolean): `Item` defaults to `true`; `CheckboxItem` and `RadioItem` default to
`false` (section 4). A `false` Item is a "keep open" action (a "Refresh" item, a zoom control):
the action runs with `data-pending` and the menu stays.

---

## 3. Props and types

### 3.1 `Menu.Root`

```ts
export interface MenuOpenChangeDetails extends ActionDetails {
  /**
   * "activate": the user acted on a part: Trigger or SubmenuTrigger (click, Enter / Space, arrow
   * keys), an item's activation (close), ArrowLeft (submenu close), or a foreign invoker.
   * "dismiss": Escape, a click outside, Tab / focus leaving the menu, the pointer leaving a
   * hover-opened submenu, the parent menu closing, script.
   * "platform": the menu was found open on mount (opened before hydration); `event` is undefined.
   */
  readonly reason: ChangeReason;
}

export interface MenuRootState {
  readonly open: boolean;      // optimistic
  readonly pending: boolean;   // the Root's transition (open or close in flight)
  readonly submenu: boolean;   // this Root is nested in a Menu.Popup
}

export interface MenuRootProps {
  open?: boolean;
  defaultOpen?: boolean;
  /**
   * Awaited for `true` and for closes the user asks a part for (Trigger toggle, item activation,
   * ArrowLeft); a notification for dismissals (Escape, click outside, Tab, the parent menu
   * closing). May be a Server Function. A `setState` after your own `await` needs `startTransition`.
   */
  openChangeAction?: ChangeAction<boolean, MenuOpenChangeDetails>;
  /** Arrow keys wrap from last to first and back. Default `true`. */
  loop?: boolean;
  /** Submenu only: milliseconds from hovering the SubmenuTrigger to open. Default 100. */
  delay?: number;
  /** Submenu only: milliseconds from the pointer leaving the SubmenuTrigger and the submenu to close. Default 150. */
  closeDelay?: number;
  children?: StateValue<ReactNode, MenuRootState>;
}
```

`loop`, `delay` and `closeDelay` on a top-level Root: `loop` applies; the delays are ignored with
a dev warning (no hover open at the top level in v0).

### 3.2 `Menu.Trigger`

As `PopoverTriggerProps` / `PopoverTriggerState` (owned keys: `type`, `id`, `popoverTarget`
(#121; `commandfor` / `command` and `aria-expanded` stay omitted from the type as reserved keys; a
non-button `render` renders `aria-expanded` from `shown`), `disabled`, `aria-haspopup`, `onClick`, `onKeyDown`, `data-open`,
`data-pending`, `data-disabled`). `onKeyDown` is added for ArrowDown / ArrowUp (open with the
first / last item focused; Enter / Space are the native click). Rendering a `Menu.Trigger` inside
a submenu Root is a dev warning ("use `Menu.SubmenuTrigger`").

### 3.3 `Menu.Popup`

```ts
export type MenuSide = PopoverSide;   // "top" | "bottom" | "left" | "right" | "inline-start" | "inline-end" (wave 11)
export type MenuAlign = PopoverAlign; // "start" | "center" | "end"

export interface MenuPopupState {
  readonly open: boolean;        // committed
  readonly side: MenuSide | null; // resolved (physical) while shown; the prop otherwise; null with side={null} and during a context open
  readonly align: MenuAlign;      // resolved while shown; the prop otherwise
  readonly submenu: boolean;
}

export interface MenuPopupProps
  extends Omit<ComponentPropsWithRef<"div">, "id" | "popover" | "role" | "aria-labelledby" | "onKeyDown" | "onFocus" | "onBlur" | "onMouseDown" | "onContextMenu" | "onPointerEnter" | "onPointerLeave" | "onToggle" | "onBeforeToggle" | "className" | "style" | "children"> {
  /**
   * Default `"bottom"` for a top-level menu, `"inline-end"` for a submenu (the right of the item
   * in LTR, its left in RTL). `"left"` / `"right"` stay physical. `null`: stylesheet-owned placement.
   */
  side?: MenuSide | null;
  /** Default `"start"` (both levels): inline-relative on a top / bottom side, the top edges on the others. */
  align?: MenuAlign;
  /** Conventions 3.7: `false` (default) unmounts the items while closed; `true` keeps them in a hidden Activity. */
  keepMounted?: boolean;
  /**
   * Experimental (Chromium 150+). Renders `focusgroup="menu wrap|nowrap"` and, where
   * `focusGroup` is implemented, lets the browser handle Up / Down / Home / End: items then
   * render no `tabindex`, and the JS arrow branch steps aside. Typeahead, activation, submenu
   * keys and Tab handling stay in JS. No effect in other engines. Default `false`.
   */
  experimental_focusgroup?: boolean;
  /** Library-driven opens and closes animate through a `<ViewTransition>` around this element (Popover 10.2). */
  transition?: ViewTransitionClass;
  className?: StateValue<string | undefined, MenuPopupState>;
  style?: StateValue<CSSProperties | undefined, MenuPopupState>;
  children?: StateValue<ReactNode, MenuPopupState>;
  render?: RenderProp<ComponentPropsWithRef<"div">, MenuPopupState>;
}
```

Owned keys: `id`, `popover` (`"auto"`), `role` (`"menu"`; owned here, unlike Popover, because the
keyboard model assumes it), `aria-labelledby` (the Trigger's id, token-merged with the
consumer's), `focusgroup` (with the flag), `tabIndex` (`-1`, so the popup itself can take focus
as a last resort when a menu has no items; when it has focus the arrow keys enter the items,
section 5), `data-side` / `data-align` (anchored opens) or `data-context` (a context open,
#45: then the inline style is the point placement, `--menu-point-x` / `--menu-point-y`, `inset:
auto`, `left` / `top`, `position-area: none` and the library's `@position-try` fallbacks, and
`state.side` is `null`; `side={null}` opts out of inline placement on both paths and leaves the
two custom properties), `onContextMenu` (`preventDefault()`: no native menu over the custom
one), and the handlers: `onKeyDown` (section 5), `onBlur`
(React's `focusout`, 2.2), `onMouseDown` (keeps focus on the current item when non-item space
is pressed, 6.2) and, on a submenu Popup, `onPointerEnter` / `onPointerLeave` (hover intent,
section 7). `usePopoverPopup` has no handler or `role` options; Menu attaches these as owned
props on its own element (deviation 1). No `aria-orientation` (vertical is the default for
`menu`; horizontal menus are not designed).
`initialFocus` is **not** a prop: the menu decides (section 6). The submenu's default
`position-try-fallbacks` is `flip-inline` only (research), the top level keeps Popover's three.

### 3.4 `Menu.Item`

```ts
export interface MenuItemDetails extends ActionDetails {}

export interface MenuItemState {
  /** This item's `action` is in flight. */
  readonly pending: boolean;
  readonly disabled: boolean;
}

export interface MenuItemProps
  extends Omit<ComponentPropsWithRef<"button">, "onClick" | "onKeyDown" | "onPointerMove" | "disabled" | "className" | "style" | "children"> {
  /**
   * Runs inside this item's own transition (`data-pending` on the item). May be a Server
   * Function (`details.event` is virtual, conventions 2.2). A rejection leaves the menu open and
   * reaches the nearest Error Boundary above the item. With no `action`, activation only closes.
   */
  action?: Action<[details: MenuItemDetails]>;
  /** Close the whole menu once `action` settles. Default `true`. */
  closeOnActivate?: boolean;
  /** `aria-disabled`: focusable, skipped by nothing, never activates. */
  disabled?: boolean;
  /** Text used by typeahead when the item's text content is not representative (an icon-only item). */
  label?: string;
  className?: StateValue<string | undefined, MenuItemState>;
  style?: StateValue<CSSProperties | undefined, MenuItemState>;
  children?: StateValue<ReactNode, MenuItemState>;
  render?: RenderProp<ComponentPropsWithRef<"button">, MenuItemState>;
}
```

Owned keys: `type` (on a `<button>`), `role`, `tabIndex` (`-1`; absent on the native
`focusgroup` path), `aria-disabled`, `data-pending`, `data-disabled`, `onClick`, `onKeyDown`,
`onPointerMove`. The native `disabled` attribute is omitted from the type (the prop maps to
`aria-disabled`; a `render` element's `disabled` is removed, owned as `undefined`).

### 3.5 `Menu.CheckboxItem`

```ts
export interface MenuCheckboxItemState {
  readonly checked: boolean;   // optimistic
  readonly pending: boolean;
  readonly disabled: boolean;
}

export interface MenuCheckboxItemProps extends Omit<MenuItemProps, "action" | "className" | "style" | "children" | "render"> {
  checked?: boolean;
  defaultChecked?: boolean;
  /** Awaited inside the item's transition; `aria-checked` flips optimistically and rolls back on rejection. May be a Server Function. */
  checkedChangeAction?: ChangeAction<boolean>;
  /** Default `false`: the menu stays open after toggling. */
  closeOnActivate?: boolean;
  className?: StateValue<string | undefined, MenuCheckboxItemState>;
  style?: StateValue<CSSProperties | undefined, MenuCheckboxItemState>;
  children?: StateValue<ReactNode, MenuCheckboxItemState>;
  render?: RenderProp<ComponentPropsWithRef<"button">, MenuCheckboxItemState>;
}
```

A `useControllableAction<boolean>` owner of its own (Toggle's shape with `checked`, the
platform word), `role="menuitemcheckbox"`, `aria-checked={optimistic}`, `data-checked`,
`data-pending`. Transition types `fsui-menu`, `fsui-menu-check` / `fsui-menu-uncheck`.

### 3.6 `Menu.RadioGroup`, `Menu.RadioItem`

```ts
export interface MenuRadioGroupState { readonly value: string | null; readonly pending: boolean; }

export interface MenuRadioGroupProps extends Omit<ComponentPropsWithRef<"div">, "role" | "className" | "style" | "children"> {
  value?: string | null;          // `null`: none selected; `undefined`: uncontrolled
  defaultValue?: string | null;
  /** Receives the chosen item's `value`; a selected item re-activated dispatches nothing (with `closeOnActivate` the menu still closes). */
  valueChangeAction?: ChangeAction<string>;
  className?: StateValue<string | undefined, MenuRadioGroupState>;
  style?: StateValue<CSSProperties | undefined, MenuRadioGroupState>;
  children?: StateValue<ReactNode, MenuRadioGroupState>;
  render?: RenderProp<ComponentPropsWithRef<"div">, MenuRadioGroupState>;
}

export interface MenuRadioItemState { readonly value: string; readonly checked: boolean; readonly pending: boolean; readonly disabled: boolean; }

export interface MenuRadioItemProps extends Omit<MenuCheckboxItemProps, "checked" | "defaultChecked" | "checkedChangeAction" | "className" | "style" | "children" | "render"> {
  value: string;
  className?: StateValue<string | undefined, MenuRadioItemState>;
  style?: StateValue<CSSProperties | undefined, MenuRadioItemState>;
  children?: StateValue<ReactNode, MenuRadioItemState>;
  render?: RenderProp<ComponentPropsWithRef<"button">, MenuRadioItemState>;
}
```

`RadioGroup` is the owner (`useControllableAction<string | null>`; `data-pending` on the group,
`role="group"`, `aria-labelledby` → its `GroupLabel`'s id, always emitted as on `Group`: without
a label the IDREF dangles, which accname ignores, so a consumer's `aria-label` still names the
group; deviation 5); `RadioItem` renders
`role="menuitemradio"`, `aria-checked={optimistic === value}`, `data-checked`, and `data-pending`
when it is the optimistic target while the group is pending. Transition types `fsui-menu`,
`fsui-menu-select`. A `RadioItem` outside a `RadioGroup` throws (no context).

### 3.7 `Menu.Group`, `Menu.GroupLabel`, `Menu.Separator`

`Group`: `div[role=group]` with `aria-labelledby` → its `GroupLabel`'s id (always emitted;
dangling is harmless). `GroupLabel`: `div` with the owned `id` (reads the nearest `Group` or
`RadioGroup` context). `Separator`: `hr` by default; no state. All three take `render`,
`className`, `style`, `children` (not `Separator`'s `children`: an `<hr>` is void).

### 3.8 `Menu.SubmenuTrigger`

`MenuItemProps` minus `action` / `closeOnActivate`, plus `MenuTriggerState` (`open`, `pending`,
`disabled`). Owned keys: the Trigger's (`id`, `popoverTarget` (on a `<button>` or a
component render only, #115 / #121), `aria-haspopup`,
`data-open`, `data-pending`; `aria-expanded` only on a non-button render) and the item's (`role="menuitem"`, `tabIndex`,
`aria-disabled`, `data-disabled`, `onClick`, `onKeyDown`, `onPointerMove`, `onPointerEnter`,
`onPointerLeave`). Only valid in a submenu Root (dev warning otherwise).

### 3.9 Namespace

```ts
export const Menu = {
  Root: MenuRoot, Trigger: MenuTrigger, Popup: MenuPopup,
  Item: MenuItem, CheckboxItem: MenuCheckboxItem, RadioGroup: MenuRadioGroup, RadioItem: MenuRadioItem,
  Group: MenuGroup, GroupLabel: MenuGroupLabel, Separator: MenuSeparator,
  SubmenuTrigger: MenuSubmenuTrigger,
  ContextTrigger: MenuContextTrigger, // #45
} as const;
```

---

## 4. Checkbox and radio items: optimistic state (research question 1, second half)

```tsx
<Menu.CheckboxItem defaultChecked={prefs.compact} checkedChangeAction={savePref.bind(null, "compact")}>
  Compact rows
</Menu.CheckboxItem>
```

Click or Space → the item's `useControllableAction` dispatch: `aria-checked` and `data-checked`
flip in the sync optimistic render, `data-pending` appears, `savePref` (a Server Function) is
awaited, uncontrolled state commits after it, a rejection rolls `aria-checked` back and reaches
the boundary. The menu **stays open** (`closeOnActivate` default `false`): the APG's keyboard
section says Space on a `menuitemcheckbox` changes the state without closing, the Open UI
explainer lists close-on-toggle as an open question, and the use case (toggle three view
options) wants the menu to stay. Radix and Base UI close by default; macOS does too; consumers
who want that pass `closeOnActivate`, which then closes the whole stack after the change action
settles, through the root Root, as `Item` does. Enter on a checkbox item behaves like Space
(APG lists Enter as "activates the item", which for a checkable item is the toggle; the only
difference the APG draws is that Enter may close, and `closeOnActivate` is where that lives).

`RadioItem` activation on the already-selected item dispatches nothing (a no-op against the
optimistic value, conventions 2.3 item 8), but with `closeOnActivate` it still closes the menu:
activating the current choice of a close-on-select menu closes it (deviation 3); on another
item it dispatches the group's `valueChangeAction(value)`,
with `data-pending` on the chosen item and the group, and the previous item's `aria-checked`
flipping to `false` at once. Overlapping radio dispatches: latest intent wins for uncontrolled
state (the shared hook); a controlled parent follows "update on success" with the usual caveat.

Keyboard focus is unaffected by the state change: the item keeps focus, so a user can toggle and
arrow on. Content rendered from an item's `children` function must not suspend (trigger rule).

---

## 5. Keyboard

Per APG Menu Button and Menu. Navigation lives in `Popup`'s `onKeyDown`; activation in each
item's `onKeyDown` / `onClick`; the open keys in `Trigger` / `SubmenuTrigger`.

| Key | Where | Behaviour | Who |
| --- | --- | --- | --- |
| Enter, Space, ArrowDown | Trigger | open; focus the first enabled item (`preventDefault()` on the arrow so the page does not scroll) | Trigger (Enter / Space are the native click, intercepted as in Popover) |
| ArrowUp | Trigger | open; focus the last enabled item | Trigger |
| ArrowDown / ArrowUp | item | focus next / previous item (disabled included); wrap when `loop` | Popup (JS) or the browser (`focusgroup`) |
| Home / End | item | first / last item | same |
| ArrowDown, Home / ArrowUp, End | the popup itself (a menu with no items, or focus put there by script) | first / last item | Popup |
| Printable character | item | typeahead (section 5.1) | Popup |
| Enter | item | activate (`Item`: action then close; checkable items: toggle, close only with `closeOnActivate`): the keydown is `preventDefault()`ed and the item's `element.click()` called, so activation is one `click` path for pointer and keyboard (5.3) | item |
| Space | item | as Enter, unless a typeahead buffer is active (then it is a character) | item |
| Escape | anywhere in a menu | the innermost open menu closes; focus returns to its trigger | browser (close watcher); submenu focus return by the library |
| Tab / Shift+Tab | item | the whole stack closes; focus moves on (Shift+Tab lands on the Trigger) | Popup `focusout` |
| ArrowRight (`ArrowLeft` in RTL) | SubmenuTrigger | open the submenu; focus its first item | SubmenuTrigger |
| ArrowRight | other items | nothing (no menubar in v0) | |
| ArrowLeft (`ArrowRight` in RTL) | item in a submenu | close the submenu; focus returns to its SubmenuTrigger | Popup of the submenu → `requestClose`; focus by Popover 6.2 |
| ArrowLeft | item in the top-level menu | nothing | |

Rules shared with Tabs: navigation reads the DOM at keydown time (`popup.querySelectorAll('[role^="menuitem"]')`
filtered to items whose closest `[role="menu"]` is this popup, so submenu items are excluded;
nothing is registered); focus moves with `focus({ focusVisible: true })`; `direction` comes from
`getComputedStyle(popup).direction` at keydown time; handled keys `preventDefault()`; events
with `altKey`, `ctrlKey` or `metaKey` are ignored.

### 5.1 Typeahead

Printable characters (`event.key.length === 1`, no modifiers) accumulate in a buffer that resets
500 ms after the last keystroke. The buffer is matched, case-insensitively, against each item's
typeahead text (`label` prop, else `textContent` trimmed) starting from the item **after** the
focused one and wrapping, so repeated presses of the same letter cycle through items starting
with it (the APG's "next item that starts with the character"); a multi-character buffer matches
a prefix. Disabled items are included (they are focusable). Space is a character only while the
buffer is non-empty. Submenu items are not searched from the parent. The `focusgroup` native
path does not provide typeahead, so this is JS on both paths.

### 5.2 `experimental_focusgroup` (native arrows)

```tsx
<Menu.Popup experimental_focusgroup>…</Menu.Popup>
```

Renders `focusgroup="menu wrap"` (`nowrap` with `loop={false}`) on the popup in every engine.
Detection, as Tabs after #43: `useSyncExternalStore(subscribeNever, () => experimental_focusgroup
&& "focusGroup" in HTMLElement.prototype, () => false)` in the Popup, passed to items by
context. Where true: items render **no** `tabindex` (Chromium leaves `tabindex="-1"` elements out
of the group; the probe's items were plain buttons and the group collapsed them to one Tab stop),
and the Popup's keydown returns early for ArrowUp / ArrowDown / Home / End; the browser wraps,
skips natively disabled buttons (the library never renders those) and ignores Left / Right.
Everything else stays JS: typeahead, Enter / Space, submenu keys, `focusout`. Chromium's
`focusgroup="menu"` also infers `role="menu"` / `menuitem`; the explicit roles win and are
required for the other engines. No `nomemory` / `focusgroupstart`: a menu always opens with
focus placed by the library and closes on Tab, so re-entry memory never applies.

### 5.3 One activation path: `element.click()`

Enter and Space on an item do not activate from the keydown. The item's handler prevents the
default (so a native `<button>` does not click a second time on its own) and calls
`element.click()`; the item's `onClick` is the single activation path and `details.event` is a
`click` `MouseEvent` for pointer and keyboard alike (deviation 2). Reasons: an item composed with
another trigger (`<Dialog.Trigger render={<Menu.Item />} />`, the layering row in 13.2) must run
its native `command`, and a `render`ed link (`<Menu.Item render={<Link href />} />`) must
navigate; activating from the keydown skipped both. A consumer who needs to tell the two apart
reads `details.event.detail`: `0` for a keyboard activation (a synthetic click), `> 0` for a
pointer one. A Space held on an item closes the menu once; the keyup lands on the Trigger and
does not re-open it (probed in Chromium and Firefox at review).

---

## 6. Focus

### 6.1 Initial focus on open

`Menu.Popup` passes a resolver to `usePopoverPopup` instead of the `initialFocus` prop: on open,
the hook writes `autofocus` on the resolved element right before `showPopover({ source })` and
the popover focusing steps focus it (this works for a `<div popover>`: the focus delegate is the
`autofocus` descendant; research "autofocusOnShow"). The resolver reads the **open cause**, which
the Root records at dispatch time:

| Open cause | Focus target |
| --- | --- |
| Trigger click, Enter, Space, ArrowDown; SubmenuTrigger click, Enter, Space, ArrowRight; foreign invoker; controlled open; pre-hydration reconciliation | first enabled item (first item if all are disabled; the popup itself if there are none) |
| Trigger ArrowUp | last enabled item |
| SubmenuTrigger hover (intent timer) | none: focus stays on the SubmenuTrigger (the user is mousing; moving focus would make the parent menu's keyboard state jump into the submenu) |

Focus on every open, pointer included, follows the APG example ("Actions" menu button focuses
the first item on click) and keeps Escape / Tab behaviour uniform. Whether the focused item shows
a ring is the engine's `:focus-visible` heuristic, and after a **pointer-initiated open** (a
Trigger or SubmenuTrigger `click` with `detail > 0`, recorded with the open cause) WebKit would
match `:focus-visible` on an `autofocus`ed item (review H1; Chromium and Firefox do not). So for
a pointer open the resolver returns a `QuietFocusTarget` and the Popover hook, where the engine
reads the `focusVisible` option (Chromium 145, Firefox 104, Safari 18.4), skips the `autofocus`
write and calls `item.focus({ focusVisible: false })` right after `showPopover()` (Popover 6.1,
the one exception to "never `.focus()` on open"). Keyboard and other opens keep the `autofocus`
path. With this, `:focus-visible` is false after a pointer open in all three engines (asserted
in the browser row); an engine without the option gets the `autofocus` path and its own
heuristic. The stylesheet in section 9 styles `:focus` and `:focus-visible` alike anyway,
because hover focuses items.

### 6.2 Current item follows the pointer

`onPointerMove` on an item (not `pointerenter`, which fires for a popup appearing under a resting
pointer) focuses the item without `focusVisible` when it is not already focused. Keyboard and
pointer then always agree on the current item: ArrowDown after hovering "Archive" moves to the
item below "Archive", and Enter activates the hovered item, as native menus do. Leaving the items
for empty popup space or the page changes nothing.

Pressing non-item space does not move focus either. The popup has `tabindex="-1"` (so it is
click-focusable), and a `mousedown` on its padding, a `Separator` or a `GroupLabel` would move
focus from the current item to the popup, after which Up / Down / Home / End had no item to move
from (review M1: a keyboard-plus-mouse user was stuck). The popup's owned `onMouseDown` calls
`preventDefault()` when the target is not inside an item, so the current item stays current.
Should focus land on the popup itself anyway (a menu with no items, or script), ArrowDown / Home
focus the first item and ArrowUp / End the last (section 5). The Trigger, outside the popup,
follows the same rule while the menu is open: its `mousedown` is prevented so a click that
closes the menu does not first move focus out of it (2.2, #110).

### 6.3 Focus return

Top-level menu: the platform returns focus to the Trigger on Escape, item activation
(`hidePopover()` from the apply effect runs the same hide steps) and ArrowLeft-free closes; a
light dismiss leaves focus where the mousedown put it; Tab moves it on. Submenu: the platform
restores nothing, so Popover 6.2's rule applies: `focusWasInside` at `beforetoggle(closed)` (or
the focused item unmounted in the close commit, recorded by the content probe) and focus on
`<body>` or inside after → focus the SubmenuTrigger. The same probe covers the top-level menu
when item activation closes it with `transition` set: the focused item is unmounted before
`hidePopover()` runs, the platform then restores nothing, and the apply effect focuses the
Trigger (Popover 6.2, review H1); hence `Menu.Popup` renders its items through `renderContent`. Covers Escape and ArrowLeft in
a submenu and a submenu's `toggle` after a programmatic close. When the whole stack closes from
inside a submenu (item activation, Tab), the root menu's own hide restores focus to the root
Trigger (first in stack: platform) or lets Tab's target keep it; the submenu's rule sees
`activeElement` on the Trigger or the Tab target, neither `<body>` nor inside, and does nothing.
No `returnFocus` prop.

---

## 7. Submenus

```tsx
<Menu.Root delay={100} closeDelay={150}>              {/* a submenu: Root inside a Popup */}
  <Menu.SubmenuTrigger>Move to</Menu.SubmenuTrigger>
  <Menu.Popup>…</Menu.Popup>                          {/* side="right" align="start"; flip-inline */}
</Menu.Root>
```

- **Nesting.** The submenu Popup is a DOM descendant of the parent Popup (no portal), opened by
  `showPopover({ source: submenuTrigger })` in its apply effect; the parent stays open, a sibling
  submenu closes when another opens (the platform; the closing sibling's Root is notified with
  `"dismiss"`), Escape closes the innermost, an outside click closes the stack. `popovertarget` on
  the SubmenuTrigger keeps the declarative nesting for a pre-hydration click (#121: the platform's
  "topmost popover ancestor" reads the invoker that "show popover" sets for either attribute).
- **Placement.** `side="inline-end"`, `align="start"` (wave 11, #53; `side="right"` in v0):
  `position-area: self-x-end span-bottom` (the submenu's top edge aligns with the item's top,
  its inline-start edge with the item's inline-end edge: to the right in LTR, to the left in
  RTL, where ArrowLeft is already the open key; research `rtl-point-and-submenu.mjs` verified
  both and the flip), `position-try-fallbacks: flip-inline`. `self-x-end` resolves against the
  submenu's own inherited `direction`, so an RTL container is followed too (Chromium, WebKit;
  Firefox is misplaced there by Mozilla 2019601, conventions 13.3). While shown, `data-side` is
  the resolved physical side (`right` or `left`), so a gap rule addresses both (section 9). A
  horizontal gap is the stylesheet's, symmetric (`margin-inline`: a flip swaps the popup's own
  margins, conventions 13.2). **WebKit 302008**
  (`position-try-fallbacks` on a nested popover hangs or spins): the default keeps the fallback,
  because the bug is NEW against a platform feature the vision adopts and the reporter says the
  hang itself was fixed in 26.4; a dedicated WebKit browser row opens and closes a submenu with
  the default placement under a timeout, so every CI run shows whether the contingency applies
  (13.2, review M3). **Result: the row passed on the first WebKit CI run (39021387650): no
  hang**, so question 6 is settled and the `flip-inline` default stays. Consumers who still hit
  the bug in a Safari version set `side={null}` and position the submenu in CSS without
  fallbacks. Since 842af81 (issue #56) every submenu browser row uses the default placement on
  all three engines; the WebKit-only 302008 row stays as a named guard.
- **Open by keyboard or click**: ArrowRight (ArrowLeft in RTL), Enter, Space, click on the
  SubmenuTrigger → `requestOpen(event, "activate")` with open cause "first item".
- **Open by hover intent** (research question 5): `pointerenter` on the SubmenuTrigger (not
  `touch`) starts the submenu Root's `delay` timer (100 ms); on expiry `requestOpen(event,
  "activate")` with open cause "none" (focus stays on the SubmenuTrigger; the pointer-move rule
  has already focused it). `pointerleave` from the SubmenuTrigger starts `closeDelay` (150 ms);
  `pointerenter` on the submenu Popup cancels it; `pointerleave` from the Popup starts it again;
  on expiry, if the pointer is over neither (and focus is not inside the submenu: a user who
  arrowed in and then nudged the mouse out keeps the submenu), `requestClose(event,
  "dismiss")`. Hovering a **sibling item** of the parent menu is the usual way this fires. No
  "safe triangle" / polygon in v0: a diagonal move from the SubmenuTrigger into a submenu that is
  offset by a fallback flip may cross a sibling and start the close timer, and 150 ms is the
  budget to arrive. Deferred until the example app shows it is needed.
- **Hover timers share Tooltip's defaults' shape, not its hook.** Tooltip's interaction hook
  owns focus / blur, document listeners, `interestfor` detection and a `manual` popover; none of
  that applies. The shared piece is a small internal `useDelayedPair()` (open timer, close
  timer, cancel) that Tooltip's hook is refactored to use as well, so one timer helper exists.
  The defaults differ (100 / 150 versus Tooltip's 250 / 150) because a submenu is something the
  user is already inside, not a hint over a button; Chromium's `interest-delay` defaults are
  tooltip defaults.
- **Why not `interestfor`**: Chromium-only, and it opens the submenu on keyboard focus and
  collapses the whole stack on Escape (research, verified). The JS hover path is needed in every
  engine anyway.
- **Keyboard in the submenu**: as section 5; ArrowLeft closes it (library-owned, view
  transition if the submenu Popup has `transition`) and focus returns to the SubmenuTrigger by
  6.3. Typeahead is per menu. Tab closes the whole stack (the root Popup's `focusout`).
- **Item activation in a submenu** closes the stack through the root Root (2.2). Visually the
  root Popup animates (CSS or view transition); the submenu, hidden by the platform as a nested
  popover, disappears at once (a top-layer element is not part of its parent's snapshot).
  Documented, not worked around.
- **Depth.** Unlimited in principle; every level is the same code. Three levels is the
  practical limit for users.

---

## 8. ARIA summary

| Part | Attributes |
| --- | --- |
| Trigger | `id`, `aria-haspopup="menu"`, `popovertarget` (the Popup's id), `type="button"`; **no `aria-expanded`** (#121: every engine exposes the invoker's popover state; a non-button `render` renders it from `shown`, #118); no `aria-controls` (passes through) |
| Popup | `role="menu"`, `aria-labelledby` → Trigger / SubmenuTrigger id (token-merged), `tabindex="-1"`, `popover="auto"`, `focusgroup` with the flag |
| Item | `role="menuitem"`, `tabindex="-1"` (none on the native focusgroup path), `aria-disabled="true"` when disabled, `type="button"` |
| CheckboxItem | `role="menuitemcheckbox"`, `aria-checked` (optimistic), rest as Item |
| RadioGroup | `role="group"`, `aria-labelledby` → GroupLabel |
| RadioItem | `role="menuitemradio"`, `aria-checked` (optimistic), rest as Item |
| Group / GroupLabel | `role="group"` + `aria-labelledby`; the label has the `id` |
| Separator | `<hr>` (implicit `separator`) |
| SubmenuTrigger | `role="menuitem"`, `aria-haspopup="menu"`, `id`, `popovertarget`, `tabindex="-1"`; no `aria-expanded` (#121: measured `menuitem expanded=true/false` in Chromium and `menuitem [expanded,expandable]` in Firefox from the attribute alone) |
| ContextTrigger | none (#45): no role, no `aria-haspopup`, no `aria-expanded`; `aria-label` on the Popup names a context-only menu |

All three engines map a `popovertarget` invoker to the popover's own expanded state (HTML-AAM;
`docs/research/invoker-aria-expanded.md`, `memo/architect/probes/121-popovertarget/`), so the
Trigger and SubmenuTrigger render no `aria-expanded` (#121; ARIA in HTML #514 forbids it on such
a button, and Firefox would OR an explicit value in). Before #121 they rendered `commandfor`, which
Firefox does not map, with the Root's `shown` mirror in the attribute (#118); the mirror still
feeds a non-button `render`. Placing the Popup right
after the Trigger (the natural DOM order here) suppresses the implicit `aria-details` relation
in HTML-AAM. Screen-reader pass (NVDA, JAWS,
VoiceOver) in the example app before leaving "proposed": menu button announcement, item
counts, checkbox / radio states, submenu announcement.

Development warnings: `Menu.Trigger` inside a submenu Root, `Menu.SubmenuTrigger` outside one;
an item outside a Popup; `RadioItem` outside a `RadioGroup` (throws); `delay` / `closeDelay`
on a top-level Root; a Popup rendered as a `<dialog>`; `transition` and `keepMounted` as Popover.

---

## 9. Styling and animation

```css
.menu { margin: 0; inset: auto; min-inline-size: 12rem; padding: 4px; border: 0; border-radius: 8px; box-shadow: 0 8px 32px rgb(0 0 0 / .2); }
.menu[data-side="right"], .menu[data-side="left"],
.menu[data-side="inline-start"], .menu[data-side="inline-end"] { margin-inline: 2px; }  /* submenu gap, symmetric and keyed on the resolved side, the closed logical value included so the first layout has it (conventions 13.2); a static `margin-inline-start: 2px` on a submenu class is the other correct form */
.menu [role^="menuitem"] { display: flex; inline-size: 100%; padding: 6px 10px; border: 0; background: none; text-align: start; }
.menu [role^="menuitem"]:focus-visible, .menu [role^="menuitem"]:focus { background: var(--accent-weak); outline: none; }  /* hover focuses, so :focus is the hover style too */
.menu [aria-disabled="true"] { opacity: .4; }
.menu [data-pending] { cursor: progress; }
.menu [data-pending]::after { content: ""; margin-inline-start: auto; animation: spin 1s linear infinite; }
.menu [role="menuitemcheckbox"][data-checked]::before, .menu [role="menuitemradio"][data-checked]::before { content: "✓"; }
.menu hr { margin: 4px 0; border: 0; border-top: 1px solid var(--line); }
.menu-trigger[data-open] { background: var(--accent-weak); }
```

Enter / exit CSS and `transition` exactly as Popover 10.1 / 10.2. With `transition` set, the
view transition runs for: the open commit, a close after item activation (the dominant close:
the research's reason for the whole top-layer rule), Trigger toggle, ArrowLeft, hover close and
controlled closes; dismissals (Escape, click outside, Tab) use CSS only. Keep durations short:
the page receives no pointer events during a view transition, and a menu user is about to click
something.

```tsx
<Menu.Popup transition={{ "fsui-menu-open": "menu-in", "fsui-menu-close": "menu-out", default: "none" }}>
```

Item state changes (`fsui-menu-check` and friends) land in the item's own transition; an item
has no `transition` prop in v0 (its optimistic flip is a sync render, conventions 5.1; the
settle animates nothing visible), consistent with Toggle keeping `transition` only because its
element can change content. Recorded as a conventions question (feedback 4).

---

## 10. Async walkthroughs

Notation: `C` / `O` / `P` as in Popover. Uncontrolled root menu, `keepMounted={false}`.

1. **Open by keyboard, items load.** Focus on the Trigger, ArrowDown → `preventDefault`; open
   cause "first"; dispatch `true` (`O=true`, Trigger `data-open`, `data-pending`; the exposed
   expanded state flips with `showPopover()` itself, #121).
   Children render, `<RowActions>` suspends → held. Data arrives → commit, apply effect: resolver
   finds the first enabled item, writes `autofocus`, `showPopover({ source: trigger })`: menu in
   the top layer under the Trigger, focus on the first item. `P=false`.
2. **Activate "Archive" (Server Function).** Enter on the item → `preventDefault`; the item's
   transition: `data-pending` on "Archive"; `await archive(id)` (round trip); resolves →
   `rootMenu.requestClose(event, "activate")`: `O=false` (Trigger loses `data-open`), root
   `openChangeAction(false)` (none here) → `C=false` commits: with `transition` set React starts
   a view transition, children unmount, apply effect `hidePopover()` → the platform returns focus
   to the Trigger; `toggle(closed)` → `intended()` is `false` → echo. In Firefox the exit
   animates too. Without `transition`: `held` keeps the items through the CSS fade (Chromium /
   Safari) and they unmount after.
3. **"Archive" rejects.** `data-pending` clears, the error reaches the boundary nearest the item
   (inside the Popup if the consumer placed one there, else above Root, which unmounts the menu
   and hides it). The menu stays open in the first case; `requestClose` never ran.
4. **Toggle a CheckboxItem (slow action), then ArrowDown, then Escape.** Space → the item's
   dispatch: `aria-checked="true"`, `data-checked`, `data-pending`; menu open. ArrowDown moves
   focus (unaffected). Escape → the platform hides the menu → notification `"dismiss"` on the
   Root; the item unmounts with the menu while its action is still pending; the action completes
   (the transition belongs to an unmounted component: its post-await commit is dropped, the
   uncontrolled value is lost with the item; a controlled parent's `setChecked` after the await
   still runs). Documented: checkable items in a menu that unmounts should be controlled, or use
   `keepMounted`.
5. **RadioItem switch, overlap.** "By date" then "By name" before the first settles: optimistic
   follows the latest; `data-pending` moves to "By name" and stays on the group; the first
   resolution is superseded; the final committed value is "name".
6. **Submenu by hover, then keyboard.** Pointer moves over "Move to": `pointermove` focuses it;
   `pointerenter` starts the 100 ms timer → `requestOpen` with cause "none" → submenu opens
   beside the item, focus still on "Move to". ArrowRight → the SubmenuTrigger's handler: the
   submenu is already open (optimistic) → focus its first item directly (no dispatch). ArrowLeft
   → the submenu Popup's handler: `requestClose(event, "activate")` on the submenu Root →
   `hidePopover()` in its apply effect; `focusWasInside` true, focus lands on `<body>` → the
   library focuses "Move to".
7. **Submenu item activation.** Focus on "Inbox" (submenu) → Enter → the item's transition →
   `rootMenu.requestClose` → the root Popup hides (platform hides the submenu) → the root menu's
   hide restores focus to the root Trigger; the submenu's `toggle` finds focus on the Trigger →
   no fallback; its Root notifies `"dismiss"`; the root Root's `openChangeAction(false)` carries
   `"activate"`.
8. **Tab from an item.** `focusout` on the root Popup with `relatedTarget` outside the tree →
   `rootPopup.hidePopover()` at once → focus is already on the next page element; every open
   Root is notified `"dismiss"`. Shift+Tab from the first item: `relatedTarget` is the Trigger
   (outside the Popup) → same.
9. **Hover open while a keyboard open is pending.** Pointer over "Move to" starts the timer while
   the user presses ArrowRight: the keyboard dispatch wins (timer cancelled on dispatch; a
   dispatch while `intended()` is already `true` is a no-op).
10. **Pre-hydration click on the Trigger.** Native open, empty menu, focus unchanged (no
    `autofocus` in the HTML), Chromium's implicit expanded state. Hydration → mount reconciliation
    → `"platform"` dispatch → items mount; focus is not moved; Tab enters the items (they are
    `tabindex="-1"`, so Tab goes past them: the user presses ArrowDown on the Trigger, which, with
    the menu already open, focuses the first item). Documented as the progressive-enhancement
    limit.
11. **Dismiss and re-open while an item action is pending.** Enter on "Archive" (slow Server
    Function) → `data-pending`; Escape → the platform hides the menu, `"dismiss"` notification,
    the items unmount; click the Trigger → open dispatch. React entangles a transition started
    while an async action is pending with that action: the re-open does **not** commit until
    `archive` settles, so the Trigger shows `data-open` and `data-pending` (exposed collapsed,
    #121) with no menu visible until then (React behaviour, not a library choice; review L5, documented on the
    Menu page). When it settles: the item's `then` finds the open generation changed and drops
    its close (section 14); the re-open commits, `showPopover()`, first item focused. The same
    holds for `Popover.Close` (Popover 3.4) and `Dialog.Close`.
12. **Trigger click while open, slow action (#110).** Focus on "Archive". `mousedown` on the
    Trigger → `intended()` is `true` → `preventDefault()`: focus stays on "Archive" in every
    engine (WebKit would not have moved it anyway), no `focusout`. `click` → `preventDefault` →
    `requestClose(event, "activate")`: `O=false` (Trigger: no `data-open`, `data-pending`,
    exposed state still expanded, #121), menu still shown with "Archive" focused. Action resolves →
    `C=false` commits → apply effect `hidePopover()`: focus is inside, so the platform returns it
    to the Trigger (the element focused at the open) → `toggle(closed)` → `intended()` is `false`
    → echo. Rejects → menu open, focus on "Archive", the error reaches the boundary above Root.
    Escape meanwhile → Popover 11.8 (echo, one dispatch). Tab meanwhile → `focusout` with
    `relatedTarget` outside → immediate hide; its `toggle` finds `false` intended → echo. A press
    dragged off the Trigger → no click, menu open, "Archive" still focused.

---

## 11. Call-site examples

### 11.1 Row actions with Server Functions, from a Server Component

```tsx
// Server Component
import { Menu } from "@funstack/ui/menu";
import { archiveRow, deleteRow } from "./actions"; // "use server"

export function RowMenu({ row }: { row: Row }) {
  return (
    <Menu.Root>
      <Menu.Trigger className="icon-btn" aria-label={`Actions for ${row.name}`}><DotsIcon /></Menu.Trigger>
      <Menu.Popup className="menu" align="end">
        <Menu.Item action={archiveRow.bind(null, row.id)}>
          {({ pending }) => (pending ? "Archiving…" : "Archive")}
        </Menu.Item>
        <Menu.Separator />
        <Menu.Item action={deleteRow.bind(null, row.id)} className="danger">Delete</Menu.Item>
      </Menu.Popup>
    </Menu.Root>
  );
}
```

Every part is a client module, every prop is serialisable, and the Server Functions receive
`(details)` with `details.event` absent. The menu shows "Archiving…" on the item until the
server responds, then closes.

### 11.2 View options that stay open

```tsx
"use client";
<Menu.Root>
  <Menu.Trigger>View</Menu.Trigger>
  <Menu.Popup className="menu">
    <Menu.CheckboxItem checked={dense} checkedChangeAction={(next) => { setDense(next); }}>Dense</Menu.CheckboxItem>
    <Menu.CheckboxItem checked={showArchived} checkedChangeAction={(next) => { setShowArchived(next); }}>Show archived</Menu.CheckboxItem>
    <Menu.Separator />
    <Menu.RadioGroup value={sort} valueChangeAction={(next) => { setSort(next); }}>
      <Menu.GroupLabel>Sort by</Menu.GroupLabel>
      <Menu.RadioItem value="name">Name</Menu.RadioItem>
      <Menu.RadioItem value="modified">Last modified</Menu.RadioItem>
    </Menu.RadioGroup>
  </Menu.Popup>
</Menu.Root>
```

### 11.3 Navigation items, keep-open item, submenu

```tsx
<Menu.Root>
  <Menu.Trigger>File</Menu.Trigger>
  <Menu.Popup className="menu" transition={{ "fsui-menu-open": "menu-in", "fsui-menu-close": "menu-out", default: "none" }}>
    <Menu.Item render={<Link href="/new" />}>New</Menu.Item>
    <Menu.Item action={() => refresh()} closeOnActivate={false}>Refresh</Menu.Item>
    <Menu.Root>
      <Menu.SubmenuTrigger>Open recent</Menu.SubmenuTrigger>
      <Menu.Popup className="menu">
        <RecentFiles />                       {/* use(recentFiles): the submenu opens when ready */}
      </Menu.Popup>
    </Menu.Root>
  </Menu.Popup>
</Menu.Root>
```

### 11.4 Native arrows in Chromium

```tsx
<Menu.Popup experimental_focusgroup loop={false}>…</Menu.Popup>
```

---

## 12. Suspense, overlap, errors

Covered by Popover 4.3 / 5 for the open and the Root's closes. Item-level: an item's `action` is
awaited inside the item's own transition through the shared `useActionTrigger` (conventions 3.4,
landed with #41); a rejection goes to the boundary above the item and leaves the menu open. (A
superseded rejection on the same item, two clicks with the first rejecting after the second
resolved, was caught by the hook and thrown from the item's render; since #81 an `Item` never has
two runs in flight, so that row is N/A for `Item` and stays for `CheckboxItem` / `RadioItem`,
`design/components/button.md` 16.4 M4.) A
close that belongs to an earlier open is dropped (open-generation guard, section 14); this
applies to `Item` and to `closeOnActivate` on `CheckboxItem` / `RadioItem` alike (deviation 6).
Submenu content that suspends holds the submenu's open with `data-pending` on the
SubmenuTrigger.

React entangles transitions with a pending async action: a re-open dispatched while an item's
action is still running commits only when that action settles (walkthrough 11). Until then the
Trigger shows `data-open` and `data-pending` (exposed collapsed: no menu is shown, #121) and no menu.
This is React's behaviour,
not the library's; a slow Server Function behind an item will show it, and the docs say so in
one sentence. Separately, the page receives no pointer events while a view transition runs, so
with `transition` set a click within the exit animation after a dismissal is lost: keep the
durations short (section 9).

---

## 13. Test plan

### 13.1 jsdom

The Popover shim (with the #38 additions: cancelable `beforetoggle(open)`, recorded `source`,
invoker-click emulation) covers everything but Escape and light dismiss (driven with
`hidePopover()`). Fake timers for hover intent and typeahead resets. Focus assertions on
`document.activeElement` (jsdom focuses `tabindex="-1"` elements with `.focus()`; the `autofocus`
write is asserted through the `showPopover` spy inspecting the DOM, as Popover).

| Row | Menu tests |
| --- | --- |
| Roles and ARIA | The section 1 HTML: trigger (`aria-haspopup`, `id`, `popovertarget`, no `aria-expanded`, #121), popup (`role=menu`, `aria-labelledby` = trigger id, `tabindex=-1`), items (`role`, `tabindex=-1`, `type=button`), checkbox / radio `aria-checked`, group / label wiring, `<hr>`, SubmenuTrigger (`role=menuitem` + `aria-haspopup` + `popovertarget`, no `aria-expanded`); `experimental_focusgroup` renders `focusgroup="menu wrap"` (`nowrap` with `loop={false}`) and items keep `tabindex=-1` (no `focusGroup` in jsdom); `disabled` renders `aria-disabled` and no `disabled`. |
| Keyboard | Trigger: Enter / Space / ArrowDown open with the first enabled item `autofocus`ed at `showPopover`, ArrowUp the last; in the menu: ArrowDown / ArrowUp / Home / End move focus, wrap with `loop`, stop without; disabled items receive focus; Enter / Space activate; Space with a typeahead buffer does not; modifiers ignored; RTL (`getComputedStyle` stub) swaps ArrowRight / ArrowLeft for submenus. Escape not simulable. |
| Typeahead | "a" moves to the next item starting with "a" from the focused one, wraps; "a", "a" cycles; "ar" within 500 ms matches a prefix; after 500 ms the buffer resets; `label` overrides text; submenu items not matched from the parent. |
| Sync action (both for CheckboxItem / RadioGroup; Root as Popover) | `Menu.Item action` receives `(details)` with `details.event` the native `click` for pointer and keyboard alike (the Enter / Space keydown is prevented and `element.click()` called; `detail === 0` marks keyboard, 5.3); disabled items never dispatch; a selected RadioItem re-activated never dispatches (and still closes with `closeOnActivate`); `closeOnActivate={false}` keeps the menu (no `requestClose`). |
| Async action (both) | Item: `data-pending` on the item while deferred; menu still open; resolve → root `openChangeAction(false, "activate")`, `hidePopover` called once. CheckboxItem: `aria-checked` / `data-checked` optimistic, `data-pending`, committed after resolve; stays open; with `closeOnActivate` closes after resolve. RadioGroup: `data-pending` on group and chosen item; previous item `aria-checked=false` at once. |
| Rejection (both) | Item rejects: `ErrorCatcher` inside the Popup receives it, menu open, `hidePopover` not called. CheckboxItem rejects: `aria-checked` rolls back, catcher receives. RadioGroup likewise. Caught-inside variants commit. |
| Overlap | Two RadioItem dispatches out of order: optimistic latest, committed latest. Two Item clicks (#81): action called **once**, the second is ignored and `defaultPrevented`, `aria-disabled="true"` meanwhile, one `requestClose`. |
| Open-generation guard | Dismiss (`hidePopover()`) and re-open while an Item's, a `closeOnActivate` CheckboxItem's and a `closeOnActivate` RadioItem's action is pending (`keepMounted` for the radio, since uncontrolled state unmounts with the items); on resolve the menu stays open, `requestClose` not called. The re-open commits only when the action settles (walkthrough 11). |
| Superseded rejection (both) | CheckboxItem / RadioGroup: the older dispatch rejects after and while the newer is pending; the catcher gets it. Item: the older click's rejection reaches the catcher through `useActionTrigger` (one row each for `Popover.Close` and `Dialog.Close` as well; they fail without the hook). |
| Suspending content (both) | Popup children suspend on open: `showPopover` not called, Trigger pending; resolve: called, first item focused. Submenu likewise with `data-pending` on the SubmenuTrigger. |
| Function props / `render` | Every part's state; `render={<a href />}` on an Item activates through Enter (via `click()`) and click; `render={<div role="separator" />}` on Separator. |
| Post-await rule | Controlled Root and controlled CheckboxItem / RadioGroup updating after `await`. |
| Directive | Every file under `src/menu/` except `index.ts` is `"use client"`. |
| Platform path | Mount with the popup already open (shim) → one `"platform"` dispatch; a foreign `show-popover` command is cancelled and routed; a controlled `open` flip calls `showPopover` / `hidePopover` with no echo dispatch. |
| Submenus | A nested Root detects `submenu`; its Popup defaults `side="inline-end"` (`position-area: self-x-end span-bottom`, `data-side="inline-end"` while closed), `align="start"`, fallbacks `flip-inline`; `showPopover` called with `{ source: submenuTrigger }`; ArrowRight / Enter / Space / click open with the first item `autofocus`ed; hover: `pointerenter` + 100 ms → open with no `autofocus`; `pointerleave` + 150 ms → `requestClose` ("dismiss"); entering the submenu popup cancels; keyboard focus inside blocks the hover close; ArrowLeft → `requestClose` ("activate") and, after `hidePopover` + `toggle` with focus moved to body by the test, the SubmenuTrigger is focused; `Menu.Trigger` in a submenu warns; `delay` on a top-level Root warns. |
| Stack close | Item activation in a submenu calls the root Root's close; root `openChangeAction(false, "activate")`, submenu `openChangeAction(false, "dismiss")` after the shim's nested hide (the shim must hide nested popovers when an ancestor hides: addition). `focusout` to an outside element → root `hidePopover` at once, `"dismiss"` everywhere; `relatedTarget: null` → nothing; `focusout` into a submenu item → nothing. A `mousedown` on the Trigger while open is `defaultPrevented` and focus stays on the item; while closed it is not (#110). A `mousedown` on a foreign `<button popovertarget={popupId}>` (or `commandfor` + `toggle-popover` / `hide-popover`) while open is `defaultPrevented` and focus stays on the item; on a plain button, a `commandfor` button with a non-popover `command`, a button naming another popover, or while closed it is not (#126). |
| Trigger close (#110) | With a deferred `openChangeAction`: a click on the Trigger while open leaves the menu `:popover-open` with focus on the item, the Trigger without `data-open`, with `data-pending` and no `aria-expanded` (#121; on Chromium the AX `expanded` is `true`), `hidePopover` not called; resolve → called once, `(false, "activate")` with the `click` event the only close dispatch; reject → menu still open, focus on the item. `fireEvent.blur(item, { relatedTarget: trigger })` without a press (Shift+Tab) still hides at once. The shared suite row "a click while open dispatches (false, 'activate')" now passes through the click for Menu as for Popover: drop the "(Menu: the focusout hides first)" caveats from `triggerToggles` and the Menu config comment. |
| Pointer focus | `pointermove` on an item focuses it (no `focusVisible`); on the already-focused item nothing. `mousedown` on a Separator or the popup's padding is `defaultPrevented` and focus stays on the item; with focus on the popup itself, ArrowDown / Home focus the first item and ArrowUp / End the last (M1). |
| `transition` smoke | As Popover 13.2; plus item activation with `transition` unmounts in the close commit. |
| Resolved placement (wave 11) | As Tooltip 13: the top-level popup renders `bottom span-self-x-end`; `data-side` / `data-align` and `state` are the requested values with no layout, the stubbed `getComputedStyle` pair after the shim's `toggle(open)` (`"self-x-end span-bottom"` with `direction: "rtl"` → `data-side="left"`, `data-align="start"`), the requested ones after `toggle(closed)`; a context open emits neither (unchanged). |

### 13.2 Browser mode (`menu.browser.test.tsx`, Chromium, Firefox, WebKit)

| Row | Assertion | Engine branches |
| --- | --- | --- |
| Native `focusgroup` | With `experimental_focusgroup`: ArrowDown on the first item moves focus **without** the library's `preventDefault()` (a document keydown listener sees `defaultPrevented === false`, the Tabs technique) and items have no `tabindex`; Home / End / wrap work; typeahead and Enter still work. | `supportsFocusgroup` (Chromium): native path. Elsewhere: items keep `tabindex="-1"`, the JS path prevents the keydown, same focus outcome. Both branches asserted, none skipped. |
| Keyboard end to end | Trigger ArrowDown opens with real focus on the first item; arrows, Home / End, typeahead, Enter activates and the menu closes with focus back on the Trigger; Escape closes with focus on the Trigger; Shift+Tab from the first item lands on the Trigger and closes the menu; Tab from the last item lands after the Trigger and closes. | none |
| Submenu | ArrowRight opens the submenu anchored at the item's right edge (`getBoundingClientRect`) with focus on its first item; Escape closes only the submenu and **the library** focuses the SubmenuTrigger (every engine: the platform restores nothing); ArrowLeft likewise; hover intent with real timers (open after ~100 ms, close after leaving ~150 ms, cancelled by entering the submenu); item activation in the submenu closes both with focus on the root Trigger; outside click closes both. | None for placement since 842af81 (issue #56): every submenu row, the inline-flip assertion (a submenu near the right edge flips left) included, uses the shipped default placement (`position-try-fallbacks: flip-inline`) on all three engines. WebKit 302008 is covered by one named WebKit-only guard row that opens a submenu twice with the default placement under a 15 s timeout, so a regression hangs that row by name instead of stalling the job (review M3); it passed on the first WebKit run, settling question 6. |
| Checkbox / radio | Space toggles `aria-checked` and keeps the menu open; `closeOnActivate` closes after the action; radio switch updates both items at once. | none |
| Exit animation | After item activation without `transition`: `held` keeps items until `getAnimations()` settle; after Escape likewise. | Firefox: `getAnimations().length === 0` → unmount with the commit. |
| ViewTransition | With `transition`: open calls `startViewTransition` once; item activation once with a `::view-transition-old` of the popup present during the transition; Escape only for the notification commit; without `transition` zero calls. | Assert on all three. |
| Light dismiss and layering | Click outside closes with `"dismiss"`; a Tooltip (`manual` / `hint`) on an item does not close the menu; a modal Dialog opened from an item keeps the menu open while it is a DOM descendant (and closes it when opened outside). | `supportsPopoverHint` for the hint variant. |
| Pointer focus | Moving the real pointer over items focuses them; `:focus-visible` is false after a pointer open (the quiet focus path, 6.1); a click on a Separator leaves focus on the current item and ArrowDown still moves (M1). | none: all three engines implement `focus({ focusVisible })` (WebKit verified on CI run 39021387650, H1). |
| Resolved side (wave 11) | A Trigger at the bottom of the viewport: the open menu reports `data-side="top"` and `state.side === "top"`; the existing inline-flip submenu row (near the right edge) additionally asserts the submenu's `data-side="left"` while shown and `"inline-end"` once closed. | none |
| Submenu direction (wave 11) | Under `document.documentElement.dir = "rtl"`: ArrowLeft on the SubmenuTrigger opens the submenu with its right edge at the item's left edge (`getBoundingClientRect`) and `data-side="left"`; near the left viewport edge it flips to the right (`flip-inline`); the top-level `align="start"` menu's right edge meets the Trigger's right edge. The same inside a `dir="rtl"` wrapper in an LTR document, Trigger and Popups inside it. | Container case: `anchorPositionHonoursParentDirection` true: as above; false (Firefox, Mozilla 2019601, #89): the submenu's inline edges meet neither item edge, and because the misplaced submenu overflows, `flip-inline` applies (`self-x-start span-bottom`) and the resolved `data-side` is **`right`**; the branch asserts the misplacement and that `data-side` matches whatever option applied (the geometry invariant), not `left`. Page case: none. |
| Trigger close (#110) | Open with ArrowDown (focus on the first item), `openChangeAction` deferred: a real click on the Trigger leaves `document.activeElement` on the first item, the menu `:popover-open`, the Trigger with `data-pending`, no `data-open` and no `aria-expanded` (#121; on Chromium the AX `expanded` is `true`), and the action called with `(false, "activate")` and a `click` event (not a `ToggleEvent`); resolve → hidden, focus on the Trigger, no further call. `mouse.down` on the Trigger without `mouse.up`: focus still on the item, menu open; `mouse.up` → the same close through the action. A click on the Trigger while closed focuses it (Chromium / Firefox; WebKit never does) and opens. | none: the rule removes the engine difference, so all three assert the same; only the closed-menu focus assertion branches on `browserName === "webkit"`. |

---

## 14. Implementation notes

```
packages/ui/src/menu/                    (as implemented in #41)
  index.ts                  # no directive; namespace + types; imports platform-attributes
  menu-context.ts           # "use client": MenuContext (root + per-level), MenuGroupContext, MenuRadioGroupContext, MenuListContext (focusgroup); closeStackLater
  menu-root.tsx             # "use client": useOverlayRoot({ component: "menu", mode: "library", details: popoverDetails }), submenu detection, open cause (setOpenCause / takeOpenCause), hover timers (useDelayedPair)
  menu-trigger.tsx          # "use client": usePopoverTrigger + aria-haspopup + ArrowDown/ArrowUp (openMenuWithFocus, shared with SubmenuTrigger) + onMouseDown prevented while open (#110)
  menu-popup.tsx            # "use client": usePopoverPopup with the resolver; useAnchoredPlacement or pointStyle, useMenuKeyboard, listenOutside, focusout, mousedown, useNativeFocusgroup, submenu pointer enter/leave
  use-menu-keyboard.ts      # "use client": useMenuKeyboard(menu, nativeFocusgroup) → { onKeyDown, typingAhead }: the keyboard model and typeahead of Menu.Popup
  menu-outside.ts           # no directive: listenOutside, the document contextmenu / middle-click / scroll and popup wheel listeners of a point menu (context-menu.md 14)
  menu-point.ts             # no directive: MENU_POINT_X / _Y / _GAP, MENU_POINT_HREF, MENU_POINT_RULES, MENU_POINT_FALLBACKS, pointStyle(point, stylesheetOwned) (context-menu.md 4)
  menu-gestures.ts          # no directive: startDrag, guardTouch, armClickSwallow, the slop constants (context-menu.md 2.6, 14)
  use-menu-item.ts          # "use client": the item half of every item kind: role, roving tabindex, aria-disabled, Enter/Space -> click(), pointermove focus
  menu-item.tsx             # "use client": useActionTrigger({ openGeneration: rootMenu.openGeneration })
  menu-checkbox-item.tsx    # "use client": useControllableAction<boolean>
  menu-radio-group.tsx      # "use client": useControllableAction<string | null>
  menu-radio-item.tsx       # "use client"
  menu-group.tsx            # "use client": Group, GroupLabel and Separator (three stateless parts sharing one context; one file, deviation 4)
  menu-submenu-trigger.tsx  # "use client": item + trigger; hover intent
  menu-context-trigger.tsx  # "use client" (#45): the region: contextmenu, long-press, modality, pointer capture, calling menu-gestures.ts (context-menu.md 14)
  menu-hover.ts             # no directive: scheduleHoverClose (the :hover / focus-inside checks before a hover close)
  menu-dom.ts               # no directive: items from the DOM, typeahead text, isRtl, capturePointer, isEditableTarget
  menu.test.tsx, menu.browser.test.tsx
packages/ui/src/internal/
  use-action-trigger.ts     # "use client": useActionTrigger({ openGeneration?, ignoreWhilePending?, captureSuperseded? }) => { pending, run(work, then?) } (shared with Popover.Close, Dialog.Close)
  use-delayed-pair.ts       # "use client": createDelayedPair() / useDelayedPair(): one open-or-close timer slot with cancelClose (Tooltip uses the factory inside its effect)
  use-overlay-root.ts, use-popover-popup.ts, use-popover-trigger.ts, overlay-popup.tsx   # Popover 14; extension points below
```

- **Extension points in the Popover hooks.** Landed with #40 (`src/internal/use-overlay-root.ts` and
  `use-popover-*.ts`, tested in `use-popover-hooks.test.tsx`): `useOverlayRoot({ component:
  "menu", mode: "library", details: popoverDetails, onDispatch(next, details) })` for the open-cause record and timer
  cancellation (`onDispatch` runs synchronously before every dispatch); `usePopoverPopup({
  resolveInitialFocus(popup) })`, called right before each library `showPopover()`, **no `cause`
  argument**: Menu reads the open cause from its own ref (written in `onDispatch` / before
  `requestOpen`), the hook only honours the returned element (inside the popup, else the
  platform's choice). Settled in #41 (deviation 1): `onKeyDown` / `onFocusOut` / `role` are
  **not** hook options; Menu attaches its handlers (`onKeyDown`, `onBlur`, `onMouseDown`, the
  submenu pointer handlers) and renders `role="menu"` as owned props on its own element, a
  pass-through option being indirection only. `usePopoverTrigger` gained `handlers` (merged in
  front of the Trigger's own), `activate` (a click override: `SubmenuTrigger` opens or focuses
  into, never closes) and `disabledAs: "aria"`, which is how `SubmenuTrigger` reuses it.
- **`usePopoverPopup` result is `{ setElement, visible, renderContent, reshow }`** (destructure
  it; a hook result that carries a ref trips React Compiler's ref inference once a member is
  passed as `ref`). `Menu.Popup` renders `renderContent(() => items)` (`visible ? items : null`,
  or an `<Activity>` with `keepMounted`, Popover 14.2): the probe inside `renderContent`
  is what returns focus to the Trigger when item activation closes the menu with `transition`
  (Popover 6.2, H1); without it a keyboard activation ends with focus on `<body>`.
- **`useActionTrigger` and the open-generation guard.** `const { pending, run } =
  useActionTrigger({ openGeneration: rootMenu.openGeneration })` (conventions 3.4). The item's click runs
  `run(() => action?.(details), () => { if (closeOnActivate) rootMenu.requestClose(event,
  "activate"); })`: the hook reads the root Root's open generation when `run` is called and skips
  `then` when it changed by the time the action resolved, meaning the user dismissed the menu and
  opened it again while the action ran and the close belonged to the earlier open (Popover 3.4,
  product-owner decision at the Popover review). The hook also surfaces a superseded click's
  rejection (section 12). `CheckboxItem` and `RadioItem` with `closeOnActivate` apply the same
  guard through `closeStackLater` in `menu-context.ts` (their state lives in
  `useControllableAction`, so they do not use the hook; deviation 6). `Popover.Close` and
  `Dialog.Close` use the same hook.
- **Keyboard model.** `Menu.Popup`'s `onKeyDown` and typeahead are `useMenuKeyboard(menu,
  nativeFocusgroup)` (`use-menu-keyboard.ts`, returning `{ onKeyDown, typingAhead }`); the native
  `focusgroup` path is detected by `useNativeFocusgroup` (`internal/use-native-focusgroup.ts`,
  shared with Tabs.List and ToggleGroup).
- **Keyboard activation goes through `element.click()`** (5.3): `use-menu-item.ts` prevents the
  Enter / Space keydown and calls `event.currentTarget.click()`; `onClick` is the single
  activation path, and composed triggers and `render`ed links keep their native command or
  navigation.
- **Pointer open and `:focus-visible`** (6.1): the open cause carries `pointer` (a `click` with
  `detail > 0` on the Trigger or SubmenuTrigger); for such an open the resolver returns
  `{ element, focusVisible: false }` (`QuietFocusTarget`) and `usePopoverPopup` focuses it with
  `focus({ focusVisible: false })` after `showPopover()` instead of writing `autofocus`, where
  the engine implements the option (Popover 6.1, 14.2).
- **Details builder.** Menu passes the shared `popoverDetails` as the required `details` of
  `useOverlayRoot`; a builder must build with `createActionDetails(event, { reason })`, never an
  object literal: the Proxy keeps `event`
  non-enumerable, which is what lets `openChangeAction` be a Server Function (Popover 14.1).
- **Context.** Each Root provides `MenuContext` `{ ...popover context, submenu, rootMenu
  (the top-level context), loop, delay, closeDelay, openCause (ref), nativeFocusgroup (from the
  Popup, via MenuListContext) }`. Items read the nearest Root; `rootMenu.requestClose` closes the
  stack.
- **Items from the DOM.** `items(popup) = [...popup.querySelectorAll('[role="menuitem"],
  [role="menuitemcheckbox"], [role="menuitemradio"]')].filter((el) => el.closest('[role="menu"]')
  === popup)`. Typeahead text: `el.dataset.typeahead ?? el.textContent` where `label` renders
  `data-typeahead` (an owned attribute, so a consumer cannot clash with it).
- **Open cause.** The Root writes `openCause.current = "first" | "last" | "none"` right before
  `requestOpen`; the resolver reads and clears it (default `"first"` for controlled /
  foreign / platform opens).
- **`focusout` tree test.** `rootPopup.contains(relatedTarget)`; submenus are descendants. The
  Trigger is outside on purpose (Shift+Tab closes). A `mousedown` on the Trigger while open is
  prevented (`Menu.Trigger`'s owned `onMouseDown`: primary button, `intended()` true), so only a
  keyboard or programmatic move reaches the Trigger through `focusout` (#110). A `mousedown` on a
  foreign invoker of the root popup (`popoverTargetElement === popup`, or
  `commandForElement === popup` with a `*-popover` command) is prevented the same way by a
  document capture listener the root Popup starts in `onToggle` next to `listenOutside` and stops
  on close (`internal/invoker-press.ts`, shared with Combobox, #126).
- **Hover intent.** In `SubmenuTrigger`: `pointerenter` (not `touch`) → `timers.open(delay, () =>
  requestOpen(event, "activate"))`; `pointerleave` → `timers.close(closeDelay, maybeClose)`;
  the submenu Popup's `pointerenter` → `timers.cancelClose()`, `pointerleave` → `timers.close`;
  `maybeClose` checks `popup.matches(":hover")` on both elements and `popup.contains(activeElement)`
  before `requestClose`. Any dispatch cancels both timers.
- **Checkbox / radio reasons.** No `reason` field (always a user activation); `details` is a
  plain `ActionDetails`.
- **Shim addition.** Hiding a popover hides the popovers nested in it (DOM descendants and those
  whose recorded `source` is inside it), with their own `beforetoggle` / `toggle`.
- **Dev warnings** per section 8.

---

## Conventions feedback

All eight items were applied to `design/conventions.md` at acceptance. Kept for the record:

1. **1.1 part vocabulary.** Add `GroupLabel` ("Names a `Group`; `div` with an id, wired through
   `aria-labelledby`") and note `Separator`'s default element `hr`. `Item` gains "Menu:
   `button[role=menuitem]`".
2. **2.5 / 2.4: a shared `useActionTrigger`.** Pure-trigger parts with their own transition
   (`Dialog.Close`, `Popover.Close`, `Menu.Item`) should share one internal hook that surfaces a
   superseded rejection as `useControllableAction` does, closing the gap Dialog recorded. Suggest
   naming it in 3.4 next to the state hook.
3. **3.5 ownership.** Menu adds "always library mode" as a legitimate third configuration: a
   component whose baseline cannot be JS-free still renders the declarative command for the
   anchor and the pre-hydration open. One sentence in 3.5 or 7.3.
4. **5.1 `transition` on items.** Menu items have no `transition` prop (their only library-driven
   change is the optimistic flip, which never animates). This contradicts "every animatable part
   has `transition`" only if an item counts as animatable; suggest the rule read "every part whose
   mount, unmount or content is driven by committed library state", which items are not.
5. **5.3 types.** `Menu`: `fsui-menu`, `fsui-menu-open`, `fsui-menu-close`, `fsui-menu-check`,
   `fsui-menu-uncheck`, `fsui-menu-select`.
6. **8 experimental table.** `focusgroup` row: add `Menu.Popup experimental_focusgroup`
   (`focusgroup="menu wrap|nowrap"`, no `tabindex` on items on the native path).
7. **4.1 vocabulary.** `checked` on `Menu.CheckboxItem` / `Menu.RadioItem` (optimistic,
   `aria-checked`), `open` on `Menu.Trigger` / `SubmenuTrigger`.
8. **2.2 `"dismiss"` examples.** "Focus leaving the component (Tab out of a menu), the pointer
   leaving a hover-opened submenu, a parent overlay closing."

---

## Decisions recorded (product owner, 2026-10-17)

All eleven accepted as recommended:

1. **Item activation closes after the action settles, with `data-pending` on the item** (2.3),
   not at once. Sync actions are indistinguishable; async ones show progress where the user
   clicked and get the view-transition exit. Alternative: close at once and run the action
   detached (no pending surface). Decision: as designed.
2. **Checkbox and radio items keep the menu open by default**; `closeOnActivate` on every item
   kind flips the default either way (`Item` defaults to closing). Radix, Base UI and macOS close
   on toggle; the APG's Space rule and the multi-toggle use case say stay. Decision: stay open.
3. **No JS-free mode; always library mode** (2.1). A pre-hydration click opens an empty menu that
   fills on hydration (as Dialog / Popover library mode). Alternative: always-mounted children
   so items are in the server HTML (inert buttons before hydration; every row menu's items in
   the DOM at load). Decision: as designed; revisit if a consumer needs server-rendered items.
4. **Hover intent: timers only, `delay` 100 ms / `closeDelay` 150 ms on the submenu Root, no safe
   polygon, shared timer helper with Tooltip but not Tooltip's hook** (section 7). Also: the
   pointer focuses items (6.2), the one piece of pointer tracking in the library. Decision: as
   designed; a safe polygon is a later addition if the example app shows diagonal moves failing.
5. **Tab closes the whole stack through an immediate `hidePopover()`** from `focusout` (2.2), the
   one browser-shaped close the library performs itself (no awaited `openChangeAction`, CSS exit
   only). Decision: accepted; a menu over a page whose focus has moved on must not linger.
6. **Submenu `position-try-fallbacks: flip-inline` by default despite WebKit 302008**, with
   `side={null}` as the escape hatch and a contingency (drop the fallback for submenus) if the
   first WebKit CI run hangs. Decision: as designed. **Settled 2026-10-17**: the dedicated WebKit
   row (review M3) passed on CI; no hang; the `flip-inline` default stays.
7. **Item activation in a submenu closes the whole stack through the root Root**, so the root
   `openChangeAction(false)` carries `"activate"` and each submenu's carries `"dismiss"` (2.2).
   Alternative: close only the submenu's chain with per-level `"activate"` dispatches (more
   events, no benefit). Decision: as designed.
8. **A nested `Menu.Root` is the submenu; `SubmenuTrigger` is the only new part** (section 1),
   versus a `Submenu` / `SubmenuRoot` family. Decision: as designed.
9. **`GroupLabel` and `<hr>` Separator** names and elements (section 1). Decision: as designed;
   vocabulary feedback 1 applied.
10. **`experimental_focusgroup` on `Menu.Popup` renders `focusgroup="menu wrap|nowrap"` and drops
    `tabindex` on items on the native path** (5.2), mirroring Tabs after #43. Decision: as
    designed.
11. **`useActionTrigger` shared hook** (section 12, feedback 2) to close the superseded-rejection
    gap for `Menu.Item`, `Popover.Close` and `Dialog.Close` at once, as part of #41.
    Decision: accepted; landed with #41 (ac7064e) before Menu merged, so the Item never shipped
    without it (conventions 3.4).

---

## Review corrections (2026-10-17)

From `memo/reviewer/menu.md` (review of the implementation, #41 / #47) and the developer's
notes in `memo/developer/menu.md`. Each item is folded into the section named; this list is the
audit trail. Fix decisions were taken by the product owner.

| Item | Correction | Section |
| --- | --- | --- |
| H1 | WebKit matched `:focus-visible` on the `autofocus`ed first item after a pointer open. Fix (02f2f42): a pointer-initiated open focuses the first item with `focus({ focusVisible: false })` right after `showPopover()` instead of the `autofocus` write (the resolver returns a `QuietFocusTarget`; the one exception to Popover 6.1's "never `.focus()` on open"), where the engine implements the option. WebKit on CI now reports no `:focus-visible`; the row asserts false in all three engines. | 6.1, 14; popover.md 6.1, 14.2 |
| M1 | A `mousedown` on non-item popup space (padding, Separator, GroupLabel) no longer moves focus off the current item (owned `onMouseDown`, `preventDefault()` outside items); with focus on the popup itself, ArrowDown / Home and ArrowUp / End enter the items. | 3.3, 5, 6.2, 13.1, 13.2 |
| M2 | `Dialog.Root` carries an open-generation counter and `Dialog.Close` passes it to `useActionTrigger`, as `Popover.Close` does. | dialog.md 3.4, 14 |
| M3 | A dedicated WebKit browser row exercises the default submenu placement (`flip-inline`, WebKit 302008) under a timeout. It passed on the first WebKit run (d4deae8): no hang; question 6 settled, the fallback stays. | 7, 13.2, decision 6 |
| L1 | The open-generation guard on `closeOnActivate` checkable items gets its own rows. | 13.1 |
| L2 | Stale `useActionTrigger` text corrected: here (12, 13.1, 14, decision 11), conventions 3.4, dialog.md 3.4 / 14 and popover.md's M2 row. | 12, 13.1, 14 |
| L3 | The six deviations below written into the design. | 2.3, 3.3, 3.6, 4, 5.3, 14 |
| L5 | React's entanglement of a re-open with a pending item action is documented as React behaviour. | 10 (walkthrough 11), 12 |
| L4, L6 | Test `act()` noise and context memoisation: implementation-only, no design change. | |

## Accepted deviations (product owner, 2026-10-17)

All six accepted as implemented:

1. **No `onKeyDown` / `onFocusOut` / `role` options on `usePopoverPopup`.** `Menu.Popup` attaches
   its handlers as owned props on its own element; pass-through options would be indirection
   only (3.3, 14).
2. **Keyboard activation goes through `element.click()`.** `details.event` is a `click` for Enter
   and Space too; `detail === 0` marks a keyboard activation. Required for composed triggers and
   `render`ed links (5.3, 13.1).
3. **Re-activating the selected `RadioItem` closes without dispatching** when `closeOnActivate`
   is set: activating the current choice of a close-on-select menu closes it (section 4).
4. **`Group`, `GroupLabel` and `Separator` live in `menu-group.tsx`** (section 14).
5. **`Menu.RadioGroup` always emits `aria-labelledby`**, like `Menu.Group`; a dangling IDREF is
   ignored by accname, so a consumer's `aria-label` still names the group (3.6).
6. **The open-generation guard also applies to `closeOnActivate` checkable items**: a close from
   a previous opening must not close a new one, the same rule applied the same way (12, 14).

---

## Amendment: resolved side and direction (wave 11, 2026-10-23, issues #20 and #53)

Status: **accepted** (product owner, 2026-10-23: `inline-end` as the submenu default and the
rest as Tooltip's amendment; Firefox 2019601 is #89); the cross-component rules are
conventions 13 and the reasoning is in Tooltip's amendment (same hook, same matrix). Edited in
place: decision 7, the section 1 HTML and parts table, 3.3, 7, 9, 13.1, 13.2. The context menu's RTL point placement (#88) is in
`design/components/context-menu.md`'s own amendment.

| | v0 (as accepted) | Wave 11 |
| --- | --- | --- |
| `data-side` / `data-align`, `state.side` / `state.align` | the requested props (`null` during a context open) | the resolved placement while shown, the requested props otherwise (`null` during a context open, unchanged) |
| Submenu default | `side="right"` (`right span-bottom`), physical: opened on the right in RTL while ArrowLeft opened it | `side="inline-end"` (`self-x-end span-bottom`): the side the arrow keys point to; `data-side` is `right` or `left` while shown |
| Top-level `align="start"` (default) | `bottom span-right`, physical | `bottom span-self-x-end`: right edges meet under RTL |
| `side` values | four physical | plus `inline-start` / `inline-end` |
| Container `dir="rtl"` | ignored | followed (Chromium, WebKit); Firefox misplaced (Mozilla 2019601, asserted) |
| Files | | `Menu.Popup` merges `useResolvedPlacement`'s `ref` with `setElement` / `devRef`; the hook is idle for a point open (`side` is `null` then) |

Why the submenu default is a public `side` value and not an internal "same as the arrow keys"
rule: the keyboard already reads `getComputedStyle(popup).direction` at keydown (section 5), so
an internal rule could have read it at open too; but a CSS keyword needs no read, is right
before hydration, and the same cell serves Tooltip and Popover (`side="inline-end"`), so the
helper gets the row and Menu gets the default (Tooltip amendment, "Why this way").

Migration: as conventions 13.5. The submenu's `data-side` while shown is `left` in RTL, so the
docs gap rule (`menu.css`, the playground's `menu-demo.css`) covers both sides; `MenuSide`
widens by two members; the Menu docs page's `side` row and data-attribute table change.

Questions for the product owner: Tooltip's amendment questions 3 to 5 apply. Menu-specific:

1. **Submenu default `side="inline-end"`.** The alternative is to keep `"right"` and leave RTL
   consumers to pass `side="left"` by hand (which they cannot do per direction without JS).
   Recommendation: `inline-end`.

### Part B note: the wheel guard (wave 11, #88)

Every root `Menu.Popup`, Trigger-opened included, installs a non-passive `wheel` listener on
its element while shown that `preventDefault()`s unless the menu under the pointer can scroll in
the wheel's direction, so a wheel over a menu never scrolls the page under it (native menus
consume wheel events; a non-overflowing popup chains to the page in both engines today). A
small behaviour change for Menu, as the outside right-click close was; specified in
`design/components/context-menu.md` 4.8 and its Part B amendment (product-owner question 3
there, **confirmed 2026-10-23**). Close-on-scroll applies to point-placed menus only; a Trigger-opened menu keeps
following its Trigger.

Implementation deviations of Part A (d3d0359) folded on 2026-10-23: the submenu gap is
symmetric (`margin-inline`), and the Firefox container-RTL branch asserts the applied option
(`right`, since the misplaced submenu overflows and `flip-inline` applies) rather than `left`;
the list is in Tooltip's amendment ("Implementation deviations folded") and conventions 13.2.

## Amendment: a Trigger click while open closes through the action on every engine (#110, 2026-10-24)

Status: architect decision; no API change, no new prop, no new `reason`. Edited in place:
decision 10, 2.2 (the Trigger row and the "press is not a focus-out" paragraph), 6.2,
walkthrough 12, 13.1, 13.2, 14. The cross-component rule is in conventions 3.5 ("a part's
library-owned close is the single source of that close").

| | Chromium / Firefox before | WebKit before | Every engine after |
| --- | --- | --- | --- |
| Press on the open menu's Trigger | focuses the button; the root Popup's `focusout` hides the menu at once | no focus move | `mousedown` prevented while `intended()`; no focus move |
| Dispatch | the hide's `toggle` task runs before the `click`: `(false, "dismiss")` with the `ToggleEvent`; the click's `requestClose` is a no-op (jsdom: `"activate"`, the three events share a task) | `(false, "activate")` with the `click` | `(false, "activate")` with the `click` |
| While `openChangeAction(false)` runs | menu gone; Trigger `data-pending` | menu shown, item focused; Trigger `data-pending`, no `data-open` (exposed as expanded while shown, #121) | as WebKit |
| Rejection | menu already gone | menu stays open, item focused | as WebKit |
| Controlled parent keeps `open={true}` | the popup was hidden: optimistic reverts and the apply effect re-opens it (a blink) | snap-back, nothing hidden (Popover 2.3's veto) | as WebKit |
| `transition` exit | none (browser-shaped hide, CSS only) | view transition | view transition |
| Focus after the close | on the Trigger (moved by the press) | on the Trigger (the platform's hide returns it) | on the Trigger (the platform's hide, or 6.3's fallback) |

Why not the other way round (hide at once everywhere): the Popup's visibility follows committed
state in every overlay (Popover 2.2's table, Dialog 2.2), the Trigger carries the optimistic
feedback, and 2.3 chose "stay open with pending, close in the commit" for items on the same
grounds; the Trigger is the one other part that closes a menu, and it would be odd for it to be
the one browser-shaped part. The immediate `hidePopover()` stays reserved for closes where focus
or the pointer has already left (Tab, outside right-click), as 2.2 says.

Implementation (developer): `packages/ui/src/menu/menu-trigger.tsx`, an `onMouseDown` in the
`handlers` passed to `usePopoverTrigger` (`PopoverTriggerHandlers` in
`internal/use-popover-trigger.ts` gains `"onMouseDown"`), `if (event.button === 0 &&
menu.popover.intended()) event.preventDefault()`; add `onMouseDown` to `MenuTriggerProps`'s
`Omit` list and to the owned keys in the part's doc comment and the docs page. `mousedown`, not
`pointerdown`: cancelling `pointerdown` does not prevent focus (Pointer Events), and the Popup's
own rule uses `mousedown`. Nothing changes in `menu-popup.tsx`: its `onBlur` keeps closing on
every `relatedTarget` outside the tree, the Trigger included (Shift+Tab). Tests as 13.1 and
13.2; update the two "focusout hides first" comments (suite `triggerToggles` doc,
`menu.test.tsx` config). Docs page: the `openChangeAction` row may add "the menu stays shown
until the action settles; the Trigger shows `data-pending` meanwhile" and the Trigger's owned
keys gain `onMouseDown`.

## Amendment: `aria-expanded` renders the shown state (#118, 2026-10-24)

Status: architect decision; no API change. Edited in place: decision 11, the anatomy table
(Trigger and SubmenuTrigger), 2.1's `commandfor` paragraph, the 2.2 Trigger row, the WebKit-path
paragraph under 2.2, the 8 ARIA table and the paragraph under it, walkthroughs 1, 11 and 12,
section 12's entanglement note, 13.1 and 13.2's Trigger-close rows, the #110 amendment's table.
The grounds and the engine table are in popover.md's amendment of the same name; the rule is
conventions 3.2 and decision 40.

For Menu: `Menu.Trigger` and `Menu.SubmenuTrigger` render `aria-expanded` from the Root's
`shown` mirror of the Popup's `toggle` (revised after review M1, below; `committed` for a day),
through `usePopoverTrigger`; `data-open`, `state.open`
and `children(state).open` stay optimistic. The Trigger close of #110 therefore reads
`aria-expanded="true"` with `data-pending` and no `data-open` while `openChangeAction(false)`
runs with the menu still shown, which is also what Chromium and WebKit exposed all along; and a
pending open (an item's Server Function entangling a re-open, walkthrough 11) reads `"false"`
with `data-open` and `data-pending` and no menu. `ContextTrigger` has no ARIA and is
unaffected. The screen-reader pass listed under section 8 should include the Trigger close:
"collapsed" is announced when the menu hides, not at the click.

Implementation: no Menu code changes; the hook change and the test rows are listed in
popover.md's amendment (`menu.test.tsx`: the Suspense open row and the #110 Trigger-close row;
`menu.browser.test.tsx`: `expectPendingClose`). Doc comments in `menu-trigger.tsx` and
`menu-submenu-trigger.tsx` that list `aria-expanded` among the optimistic attributes are
corrected. `MenuPage.tsx`: the entanglement sentence, the pending section's "optimistic" list
and the Trigger's data-attribute row.

Revision (review M1, 2026-10-24): the attribute renders the Root's **`shown`** mirror of the
Popup's `toggle` (an urgent `useState` in `useOverlayRoot`), not `committed`; see popover.md's
revision of the same name for the finding, the phase table and the implementation. For Menu the
observable differences are: after Escape or an outside press, `aria-expanded="false"` one task
after the hide while the `"dismiss"` notification is still pending (no longer `"true"` until it
settles, which mattered for a non-button Trigger render in every engine and for Firefox on every
Trigger); a pre-hydration open found at mount reads `"true"` at once; a submenu's
`SubmenuTrigger` follows its own Root's `shown`, which the platform's cascade hide flips through
each nested Popup's `toggle`. No Menu code changes; `menu.test.tsx` adds an Escape row with a
deferred `openChangeAction` asserting `"false"` while pending, next to the #110 Trigger-close
row's `"true"`.

## Amendment: `popovertarget` Triggers, no `aria-expanded` (#121, 2026-10-24)

Status: architect decision, user-approved through the product owner. **Breaking (DOM attributes
only; no prop or type change).** `Menu.Trigger` and `Menu.SubmenuTrigger` render
`popoverTarget={popupId}` (default action `toggle`) instead of `commandfor` +
`command="toggle-popover"`, and **no `aria-expanded`** when they render a `<button>`: HTML-AAM maps
a `popovertarget` invoker to its popover's shown state and Chromium, Firefox and WebKit all expose
it (the `menuitem` role included, measured in `memo/architect/probes/121-popovertarget/`), ARIA
in HTML #514 forbids the explicit attribute on such a button, and Firefox ORs an explicit value in.
A non-button `render` (no invoker, #115) keeps `aria-expanded` from the Root's `shown` mirror
(#118). Grounds, engine tables and trade-offs: `memo/architect/eval-121-popovertarget.md`;
cross-component rule: conventions decision 41; Popover's amendment of the same date carries the
implementation and test plan. Edited in place: decisions 1 and 2, the section 1 HTML and anatomy
table, 2.1's `commandfor` paragraph, 3.2 and the SubmenuTrigger owned keys, the nesting bullet, the
8 ARIA table and the paragraph under it, 13.1's Roles row.

What Menu keeps, unchanged: the pre-hydration open through the declarative invoker (it is now the
`popovertarget` activation; mount reconciliation fills it as Popover 2.4), the implicit anchor
(set by "show popover" from the invoker for either attribute), submenu nesting (the platform's
"topmost popover ancestor" reads the popover's invoker, which `showPopover({ source })` sets in
library mode and the activation sets before hydration), the #110 light-dismiss exemption of the
Trigger's press (`popovertarget` is exempt in all three engines), `aria-haspopup="menu"`, and the
`shown` mirror in `useOverlayRoot` (now read only by non-button renders and the Combobox Input).

Menu-specific test changes (details in Popover's plan): `menu.test.tsx` and
`menu-context-trigger.test.tsx` assert `popovertarget` equal to the Popup id and **no**
`aria-expanded` on the Trigger and SubmenuTrigger in every phase (the Suspense open row, the #110
Trigger-close row, the Escape row with a deferred `openChangeAction`, the SubmenuTrigger
pending-open row), keep the `data-open` / `data-pending` assertions, and move the `shown`-mirror
value assertions to a `render={<a href="#" />}` Trigger row. `menu.browser.test.tsx`'s
`expectPendingClose` drops the attribute and, on Chromium, asserts the Trigger's AX
`expanded=true` through `getAXNodes()` during the pending close and `false` after; the
positioning and submenu rows run unchanged with the new attribute. `MenuPage.tsx`: the Trigger
attribute row, the "optimistic" list in the pending section and the entanglement sentence.

## Amendment: a press on a foreign invoker is not a focus-out (#126, 2026-10-25)

Status: architect decision; no API change, no new prop, no new `reason`. Edited in place:
decision 10, 2.2 (a new "Foreign invoker click while open" row and the paragraph after the #110
one), 13.1, 14. The cross-component rule is in conventions 3.5 (the paragraph after the #110
`mousedown` trap); Combobox has the same amendment. Grounds and the probe:
`memo/architect/issue-126-foreign-invoker-press.md`, `memo/architect/probes/126-foreign-invoker-press/`.

The case: a consumer's own `<button popoverTarget={popupId}>` (or `commandfor` + `toggle-popover`
/ `hide-popover`) outside the menu, pressed with a real mouse while the menu is open. It is an
invoker of the popup: light dismiss exempts it (conventions 3.5) and #125 names its close
`"activate"` from `ToggleEvent.source`. But the press focuses it first in Chromium and Firefox.

| | Chromium / Firefox before | WebKit before | Every engine after |
| --- | --- | --- | --- |
| `mousedown` on the foreign invoker | focuses the button; the root Popup's `focusout` hides the menu at once (`"dismiss"`, `ToggleEvent` with `source: null`) | no focus move | the root Popup's document capture listener prevents the default; focus stays on the item |
| `pointerup` | nothing (the popup is already hidden) | light-dismiss exempt | light-dismiss exempt |
| `click` | the native toggle finds a hidden popover and **re-shows it** (plain DOM, both engines; with the library the foreign open is cancelled at `beforetoggle` and routed through `requestOpen`, which was a no-op in Chromium, where `intended()` was still `true`, and re-opened in Firefox: timing) | the native toggle hides the menu, `source` = the button | the native toggle (or `hide-popover`) hides the menu, `source` = the button |
| Dispatch | `(false, "dismiss")`, then on Firefox `(true, "activate")` | `(false, "activate")` with the `ToggleEvent` (`CommandEvent` for `commandfor`) | as WebKit |
| Focus after | on the foreign button | on the Trigger (the platform's hide returns it: focus was inside) | on the Trigger |
| Dragged-off press | menu closed (`"dismiss"`), focus on the button | menu open, item focused | menu open, item focused |
| Tab from the last item onto the foreign button | closes (`"dismiss"`) | closes | closes, unchanged |

Rule: the root Popup keeps a document capture `mousedown` listener alive while shown (started in
`onToggle` next to `listenOutside`, stopped on close) that calls `preventDefault()` for
`button === 0` when the target's closest `<button>` is outside the popup and
`popoverTargetElement === popup`, or `commandForElement === popup` with a `*-popover` `command`.
Nothing else changes: the `focusout` listener still closes on every `relatedTarget` outside the
tree (a Tab onto the foreign button, a plain foreign button's press), `Menu.Trigger` keeps its own
`onMouseDown` (judged on `intended()`: it also covers the pending-open window and a non-button
`render`, which has no `popovertarget`), submenus are not involved (the listener and the
`focusout` are the root Popup's; an invoker naming a submenu popup is not a supported pattern).

Rejected: the `focusout` path ignoring an invoker `relatedTarget`. It fixes the press (closed by
the click, `"activate"`, focus on the button) but a Tab onto the foreign button leaves the menu
open with focus outside it (APG: Tab closes), and a dragged-off press strands focus on the button
with no `focusout` left to catch the next Tab; `relatedTarget.matches(":active")` can tell a press
from a Tab at `focusout` time (true on both engines) but does not fix the drag-off. Rejected too:
documenting it. The pattern is one the library classifies on purpose (#125, whose Menu browser row
had to prevent the button's `mousedown` by hand), and a flicker plus a re-open is a bug.

Implementation (developer): `src/internal/invoker-press.ts` (directive-free):
`isPopoverInvoker(target: EventTarget | null, popup: HTMLElement): boolean` (closest `<button>`,
outside the popup, `popoverTargetElement === popup` or `commandForElement === popup` with
`/-popover$/.test(command)`; absent IDL means the engine has no such invoker, so `false`) and
`listenInvokerPresses(popup): () => void` (the capture `mousedown` listener on
`popup.ownerDocument`, cleanup returned). `menu-popup.tsx`: in the existing `onToggle`, start it
with `listenOutside` and stop it with `stopOutside()` (root only). `Menu.Popup`'s doc comment and
the docs page's `openChangeAction` row gain one sentence: a consumer's own `popovertarget` /
`commandfor` button for the popup closes it as `"activate"` and never moves focus out of the menu.

Tests. jsdom (`menu.test.tsx`): with the menu open, `fireEvent.mouseDown` on a foreign
`<button popovertarget={popupId}>` is `defaultPrevented` and `document.activeElement` is still the
item; not on a plain button, not on a `commandfor` button with `command="my-cmd"`, not on a button
naming another popover, not while the menu is closed; a `commandfor` + `hide-popover` button is
prevented. (The invoker shim of #125 provides the IDL where jsdom lacks it.) Browser
(`menu.browser.test.tsx`, Chromium, Firefox and WebKit, real pointer): the #125 foreign row drops
its `onMouseDown={(e) => e.preventDefault()}`; after `user.click(foreign)` the dispatches since the
open are exactly `[(false, "activate")]` with `details.event.type === "beforetoggle"` and
`source === foreign`, the popup is not `:popover-open`, no `(true, …)` follows within 100 ms, and
`document.activeElement` is the Trigger on every engine; a `commandfor` + `toggle-popover`
variant asserts `"activate"` with the `CommandEvent`; a dragged-off press (`user.pointer` down on
the foreign button, move to the page, release) leaves the menu `:popover-open` with the item
focused and dispatches nothing; `user.tab()` from the last item onto a foreign button placed
right after the Trigger still closes with `"dismiss"`. Mutation check: with the listener removed,
the Chromium and Firefox press rows fail (`"dismiss"`, re-open), the WebKit row passes (no focus
move there), which is why the row runs on all three.
