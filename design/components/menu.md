# Menu (menu button)

Status: **accepted**, implemented. History (decisions, reviews, accepted deviations,
amendments, implementation notes, the test plan): `design/CHANGELOG.md`, parts "menu.md". The
context menu (`Menu.ContextTrigger`) is `design/components/context-menu.md`. Follows `design/conventions.md` (accepted);
where this document and the conventions disagree, the conventions win. **Read
`design/components/popover.md` first** (accepted): Menu is built on its internal hooks
(`usePopoverRoot`, `usePopoverPopup`, `usePopoverTrigger`), its ownership split (library-owned
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
| 10 | Closing the stack on Tab | A `focusout` listener on the **root** menu's Popup: when `relatedTarget` is outside the menu tree (the root Popup's subtree, which contains every submenu as a DOM descendant, since nothing portals), the root Popup hides itself (`hidePopover()`, the platform hides nested popovers) and every Root is notified with `reason: "dismiss"`. A null `relatedTarget` (window blur) closes nothing. A press on the Trigger of an open menu is not a focus-out: `Menu.Trigger` prevents the `mousedown` default while `intended()` is `true`, so focus stays on the current item in every engine and the click's library-owned close is the one source of the close (#110). Nor is a press on a **foreign invoker** of the root popup (a consumer `<button>` whose `popovertarget`, or `commandfor` with a popover `command`, names it): the root Popup prevents its primary `mousedown` while shown, so the click's native toggle closes the menu and #125 names it `"activate"` (#126). The Trigger is itself a `popovertarget` invoker of the root popup (#121), so that guard also covers it whenever the menu is shown, including a pending close where `intended()` is `false`: a second press then keeps focus on the item and the menu shown, and its click re-opens through `requestOpen` with no hide and re-show (#126 review). |
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
| `Root` | none | | `state.open` (optimistic), `state.pending`, `state.submenu` in `children(state)` | `usePopoverRoot({ component: "menu", mode: "library", details: popoverDetails })`. A Root under a `MenuContext` is a submenu. |
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

`Menu.Root` calls `usePopoverRoot` with `mode: "library"` unconditionally. Without `open` /
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
| Item activation (after its `action` settles), with `closeOnActivate` | library, **root Root** | the item calls the root menu's `requestClose(event, "activate")`; `openChangeAction(false)` of the root Root awaited; committed `false`; apply effect `hidePopover()` on the root Popup; the platform hides every nested popover; each submenu Root's `toggle` listener reports the fact to its own `onOpenChange(false, { reason: "dismiss" })` (2.4) | root: `"activate"`; submenus: `"dismiss"` |
| Trigger click while open | library | Popover 2.3: click cancelled; `requestClose(event, "activate")`; `openChangeAction(false)` awaited **with the menu still shown** and the Trigger without `data-open`, with `data-pending`, still exposed as expanded by the browser (the menu is shown); committed `false`; apply effect `hidePopover()` (view transition if set). The Trigger's `mousedown` is `preventDefault()`ed while `intended()` is `true`, so the press moves no focus and the `focusout` close below cannot pre-empt the click | `"activate"` |
| ArrowLeft in a submenu, hover leaving a SubmenuTrigger to a sibling item | library, that submenu's Root | `requestClose` on the submenu's Root; `hidePopover()` in its apply effect; focus return to the SubmenuTrigger by Popover 6.2's rule (ArrowLeft) or no focus change (hover: focus was never inside) | `"activate"` (ArrowLeft) / `"dismiss"` (hover) |
| Tab / Shift+Tab, focus leaving the tree | library-initiated, browser-shaped | the root Popup's `focusout` listener calls `rootPopup.hidePopover()` at once (no await: the focus has already moved and the menu must not linger over the page); a fact: every Root's `onOpenChange` is called from its `toggle` | `"dismiss"` |
| Foreign invoker click while open (a consumer `<button>` whose `popovertarget`, or `commandfor` with a popover `command`, names the root popup) | browser | the root Popup prevents the button's primary `mousedown` while shown, so the press moves no focus and the `focusout` close above cannot pre-empt the click; the press is light-dismiss exempt (conventions 3.5); the click's native toggle (or `hide-popover`) hides the menu and the platform's hide returns focus to the Trigger; a fact, reported from `toggle` with the `ToggleEvent` (the `CommandEvent` for `commandfor`) whose `source` is the button | `"activate"` |
| Escape | browser | innermost menu only (the platform's close-watcher stack); focus returns to its trigger (platform for the root menu, library for a submenu); a fact (`onOpenChange`) | `"dismiss"` |
| Light dismiss, another `auto` popover or modal dialog opening outside | browser | the whole stack; a fact on every Root | `"dismiss"` |
| Controlled parent sets `open={false}` | library | apply effect; echo | (none) |
| Right-click (`contextmenu`) or middle-button `pointerdown` outside the menu tree | library-initiated, browser-shaped (a fact) | a document listener the root Popup installs while open calls `rootPopup.hidePopover()` at once, as the Tab path does (Chromium's click-based light dismiss ignores those buttons; native menus close on any click); a `contextmenu` inside the popup is only `preventDefault()`ed; one inside this Root's `ContextTrigger` is a move, not a close | `"dismiss"` |

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
exposed expanded state follows the shown menu, the browser's own), and
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
// inside MenuItem (useActionTrigger is conventions 3.4)
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

This is the Dialog.Close / Popover.Close idiom applied to items. A consumer who wants "close
now, work later" writes `action={() => { void archive(id); }}` (not awaited; conventions 2.3
item 5). `CheckboxItem` and `RadioItem` are state owners, not pure triggers: latest intent
wins.

`closeOnActivate` (boolean): `Item` defaults to `true`; `CheckboxItem` and `RadioItem` default to
`false` (section 4). A `false` Item is a "keep open" action (a "Refresh" item, a zoom control):
the action runs with `data-pending` and the menu stays.

**`whilePending`** (conventions 2.5.1) says what a second activation (click, Enter, Space)
does while the item's own action is pending. An Item is of **mixed ownership**: the `action` is
the consumer's, the close after it is the library's, so the default follows `closeOnActivate`:
`"ignore"` when the menu closes after the action, `"run"` for a keep-open item. Under
`"ignore"` the activation is dropped (the event is `preventDefault()`ed) and the item renders
`aria-disabled="true"` while it shows `data-pending`; `data-disabled` and `state.disabled` are
unaffected, and the part is never natively disabled while pending. Navigation is unaffected
too: the arrows, Home / End and typeahead never skip disabled items (APG: disabled items are
focusable; 5 and 5.3), so a pending item is an ordinary item for them; the one place that reads
disabledness, `edgeItem` (the open focus, and the Trigger's ArrowDown / ArrowUp while open),
keys on **`data-disabled`** (the `disabled` prop), not on `aria-disabled`, so a pending item is
still an enabled item for the open focus.

```tsx
<Menu.Item action={archive}>Archive</Menu.Item>                                 // "ignore": one run, then the menu closes
<Menu.Item closeOnActivate={false} action={zoomIn}>Zoom in</Menu.Item>          // "run": every activation counts
<Menu.Item closeOnActivate={false} action={refresh} whilePending="ignore">Refresh</Menu.Item>
<Menu.Item action={log} whilePending="run">Log</Menu.Item>                      // runs again; the menu closes once
```

- **`closeOnActivate` (the default): `"ignore"`.** A resolved run makes the library close the
  menu and the item leaves with it; there is nothing to count and a second Enter can only repeat
  the side effect.
- **`closeOnActivate={false}`: `"run"`.** The library does nothing but run the consumer's
  function, so the item is a `Button` that lives in a menu, and takes `Button`'s default. This
  is the counter case #146 was raised for.
- In `"run"` mode the item renders `data-pending` until every run has settled and **no**
  `aria-disabled` from pending (`aria-disabled` is then the `disabled` prop alone); a closing
  item requests the close once, when the last run in flight settles, and only if the latest run
  resolved (product-owner decision on review F1, 2026-11-24; conventions 2.5.1; the
  open-generation guard as before), so a rejection keeps the menu open in both modes; an older
  run's rejection goes to `reportError`, the latest one's to the boundary above the item
  (conventions 2.4, #145; `menu.test.tsx` "whilePending (#146)").
- An Item without `action` only closes. It runs through the item's transition all the same,
  making the close request synchronously in the activation, inside that transition (as a Close
  part without `action`, conventions 4.3), so the synchronous prefix of
  `openChangeAction(false)` runs during the event dispatch; an Item with `action` requests in
  the continuation, after the action. It shows `data-pending` while the close it asked for waits (a Root `openChangeAction(false)`
  that is awaited, or another pending action the close is entangled with; conventions 4.3).
  The prop has no effect and the item renders no `aria-disabled` from pending: nothing of its
  own is in flight to ignore, and a second activation is a no-op (conventions 2.3 item 8).
- `CheckboxItem` and `RadioItem` get **no** `whilePending`: state owners, latest intent wins.

The alternative, a fixed `"ignore"` whatever `closeOnActivate` says, is one line simpler in the
props table and makes the keep-open counter item need `whilePending="run"`.

### 2.4 Requests and facts: which cause goes where

The rule is conventions 3.9, applied to each `Menu.Root` independently: the top-level one, a
context-menu Root and each submenu Root have the same `openChangeAction` / `onOpenChange` pair.

| Cause | Channel | `next` | `reason` |
| --- | --- | --- | --- |
| Trigger click, Enter / Space / ArrowDown / ArrowUp on the Trigger, while closed | `openChangeAction` | `true` | `"activate"` |
| `ContextTrigger`: `contextmenu`, long-press, Shift+F10 / the Menu key (`context-menu.md` 2) | `openChangeAction` | `true` | `"activate"` |
| `SubmenuTrigger`: click, ArrowRight, Enter, hover after `delay` | `openChangeAction` (the submenu's Root) | `true` | `"activate"` |
| A foreign open (invoker button, script) | `openChangeAction` | `true` | `"activate"` |
| Found open at hydration | `openChangeAction` | `true` | `"platform"` |
| Item activation with `closeOnActivate`, after the item's `action` | `openChangeAction` (the **root** Root) | `false` | `"activate"` |
| Trigger click while open | `openChangeAction` | `false` | `"activate"` |
| ArrowLeft in a submenu | `openChangeAction` (that submenu's Root) | `false` | `"activate"` |
| The pointer leaving a hover-opened submenu, after `closeDelay` (held by the library) | `openChangeAction` (that submenu's Root) | `false` | `"dismiss"` |
| Escape (the innermost menu) | **`onOpenChange`** | `false` | `"dismiss"` |
| Light dismiss; another `auto` popover or modal dialog opening outside | **`onOpenChange`** (every Root of the stack) | `false` | `"dismiss"` |
| Tab / Shift+Tab, focus leaving the menu tree (the library's immediate `hidePopover()`) | **`onOpenChange`** | `false` | `"dismiss"` |
| Right-click or middle-button press outside the tree | **`onOpenChange`** | `false` | `"dismiss"` |
| Context menu placed at a point: scroll of the document or an ancestor; captured-pointer release outside (`context-menu.md` 5) | **`onOpenChange`** | `false` | `"dismiss"` |
| A submenu hidden because its parent menu closed, whatever closed the parent (also a request on the root: item activation) | **`onOpenChange`** (the submenu's Root) | `false` | `"dismiss"` |
| A foreign invoker button closing the root popup | **`onOpenChange`** | `false` | `"activate"` |
| Script `hidePopover()` | **`onOpenChange`** | `false` | `"dismiss"` |
| A context-menu **move** (right-click inside the region while open, `context-menu.md` 4.3); controlled prop change; re-open of a refused fact | none | | |

Menu-specific:

- **An item's action is pending and the user presses Escape.** The fact closes the menu at
  once. Uncontrolled: committed `false`; the items unmount (after the CSS exit, `held`). The
  item's action keeps running in the item's own transition; its continuation finds the menu
  closed (open-generation guard) and requests nothing; its rejection follows the "owner left"
  rule (`reportError`, conventions 2.4).
- **Item activation closes a root with open submenus.** One request on the root Root
  (`openChangeAction(false, "activate")`); when the root popup hides in its commit, each submenu
  Root gets `onOpenChange(false, { reason: "dismiss" })` from its own `toggle`. A controlled
  submenu Root needs `onOpenChange` like any other controlled Root (the library would otherwise
  try to show it again under a hidden parent); the development warning covers it.
- `ContextTrigger` and `SubmenuTrigger` render optimistic `data-open` and the Root's
  `data-pending` like the Trigger. `data-context` on the Popup keeps its own rule (until the
  popup is hidden and its exit is over).
- `aria-expanded` on a `SubmenuTrigger` (a `menuitem`, not an invoker button) is the `shown`
  mirror.
- `CheckboxItem` / `RadioItem` state (`checkedChangeAction`, `valueChangeAction`) is not open
  state: actions.
- **A refused re-open runs no initial focus** (conventions 3.9.4): focus stays where the
  dismissal put it, so a controlled Menu without `onOpenChange` cannot trap the keyboard.

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
   * Requests only: awaited for `true` and for closes the user asks a part for (Trigger toggle,
   * item activation, ArrowLeft). Never called for a dismissal. May be a Server Function. A
   * `setState` after your own `await` needs `startTransition`.
   */
  openChangeAction?: ChangeAction<boolean, MenuOpenChangeDetails>;
  /**
   * Facts only: the menu was closed without the library holding the close (Escape, click
   * outside, Tab, the parent menu closing, a foreign invoker). Called synchronously with
   * `false`, not awaited; a controlled Root adopts it directly (`onOpenChange={setOpen}`).
   * Conventions 3.9, section 2.4.
   */
  onOpenChange?: UrgentChangeHandler<boolean, MenuOpenChangeDetails>;
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
  /**
   * What an activation does while this item's `action` is pending. `"ignore"`: nothing (the
   * event is cancelled, `aria-disabled="true"` meanwhile). `"run"`: the action runs again.
   * Conventions 2.5.1 (#146). Default (user decision; conventions resolved question 44):
   * `"ignore"` when `closeOnActivate`, `"run"` with `closeOnActivate={false}`.
   */
  whilePending?: WhilePending;
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
  submenu closes when another opens (the platform; the closing sibling's Root hears
  `onOpenChange(false, "dismiss")`), Escape closes the innermost, an outside click closes the stack. `popovertarget` on
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
Trigger and SubmenuTrigger render no `aria-expanded` (ARIA in HTML #514 forbids it on such
a button, and Firefox would OR an explicit value in). The Root's `shown` mirror
feeds a non-button `render`. Placing the Popup right
after the Trigger (the natural DOM order here) suppresses the implicit `aria-details` relation
in HTML-AAM.

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

Enter / exit CSS and `transition` exactly as Popover 10.1 / 10.2 (no consumer rule:
the library cuts the CSS transition around its own show / hide during a view transition). With
`transition` set, the view transition runs for: the open commit, a close after item activation
(the dominant close: the research's reason for the whole top-layer rule), Trigger toggle,
ArrowLeft, hover close and controlled closes; dismissals (Escape, click outside, Tab) use CSS
only. Keep durations short: the page receives no pointer events during a view transition, and a
menu user is about to click something.

```tsx
<Menu.Popup transition={{ "fsui-menu-open": "menu-in", "fsui-menu-close": "menu-out", default: "none" }}>
```

```css
::view-transition-new(.menu-in) { animation: 120ms ease-out both menu-in; }
::view-transition-old(.menu-out) { animation: 120ms ease-in both menu-out; }
```

Why the cut matters here (#132, #147; Popover 10.2, Dialog 10.3, conventions 5.1): a
library-driven close hides the menu with `hidePopover()` in the layout effect of the close
commit, and with the `display` / `overlay` transition on the popup Chromium would keep the
closing box rendered through its fade, so the close's view transition would capture it as a live
`::view-transition-new(…)` next to the `old` image, a double image. `usePopoverPopup` cuts the
popup's CSS transition around that call (and around the open and Menu's `reshow`) while a view
transition runs. The shared overlay browser suite pins it for Menu on every CI run (its "plus a
CSS exit" rows assert `display: none` with the `old` image only at `ready`). A submenu is a DOM
descendant of its parent, so when the parent's hide takes it down it has no box left to capture:
the cut on the parent is enough (architect probe, `memo/architect/147-reevaluation.md`).

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
   to the Trigger; `toggle(closed)` → the hide carries the library's marker → echo. In Firefox the exit
   animates too. Without `transition`: `held` keeps the items through the CSS fade (Chromium /
   Safari) and they unmount after.
3. **"Archive" rejects.** `data-pending` clears, the error reaches the boundary nearest the item
   (inside the Popup if the consumer placed one there, else above Root, which unmounts the menu
   and hides it). The menu stays open in the first case; `requestClose` never ran.
4. **Toggle a CheckboxItem (slow action), then ArrowDown, then Escape.** Space → the item's
   dispatch: `aria-checked="true"`, `data-checked`, `data-pending`; menu open. ArrowDown moves
   focus (unaffected). Escape → the platform hides the menu → `onOpenChange(false, "dismiss")` on the
   Root, committed `false` at once; the item unmounts with the menu while its action is still pending; the action completes
   (the transition belongs to an unmounted component: its post-await commit is dropped, the
   uncontrolled value is lost with the item; a controlled parent's `setChecked` after the await
   still runs). Documented: checkable items in a menu that unmounts should be controlled, or use
   `keepMounted`. Either way, if the action then rejects, the item is gone (unmounted) or hidden
   (`keepMounted`: effects disconnected), so the rejection is passed to `reportError` and no
   boundary shows, not even when the menu reopens (conventions 2.4, #152).
5. **RadioItem switch, overlap.** "By date" then "By name" before the first settles: optimistic
   follows the latest; `data-pending` moves to "By name" and stays on the group; the first
   resolution is superseded; the final committed value is "name". If the first action rejects
   instead, the error is passed to `reportError`, not to the boundary, and the menu stays as the
   newer pick left it (conventions 2.4, #145).
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
   no fallback; its Root hears `onOpenChange(false, "dismiss")`; the root Root's `openChangeAction(false)` carries
   `"activate"`.
8. **Tab from an item.** `focusout` on the root Popup with `relatedTarget` outside the tree →
   `rootPopup.hidePopover()` at once → focus is already on the next page element; every open
   Root hears `onOpenChange(false, "dismiss")`. Shift+Tab from the first item: `relatedTarget` is the Trigger
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
    Function) → `data-pending`; Escape → the platform hides the menu, the `"dismiss"` fact,
    the items unmount; click the Trigger → open dispatch. React entangles a transition started
    while an async action is pending with that action: the re-open does **not** commit until
    `archive` settles, so the Trigger shows `data-open` and `data-pending` (exposed collapsed,
    #121) with no menu visible until then (React behaviour, not a library choice; review L5, documented on the
    Menu page). When it settles: the item's `then` finds the open generation changed and drops
    its close; the re-open commits, `showPopover()`, first item focused. The same
    holds for `Popover.Close` (Popover 3.4) and `Dialog.Close`.
12. **Trigger click while open, slow action (#110).** Focus on "Archive". `mousedown` on the
    Trigger → `intended()` is `true` → `preventDefault()`: focus stays on "Archive" in every
    engine (WebKit would not have moved it anyway), no `focusout`. `click` → `preventDefault` →
    `requestClose(event, "activate")`: `O=false` (Trigger: no `data-open`, `data-pending`,
    exposed state still expanded, #121), menu still shown with "Archive" focused. Action resolves →
    `C=false` commits → apply effect `hidePopover()`: focus is inside, so the platform returns it
    to the Trigger (the element focused at the open) → `toggle(closed)` → the hide carries the
    library's marker → echo. Rejects → menu open, focus on "Archive", the error reaches the
    boundary above Root. Escape meanwhile → a fact (conventions 3.9.5): `onOpenChange(false)`
    at once, the pending close is superseded. Tab meanwhile → `focusout` with `relatedTarget`
    outside → immediate hide; its `toggle` carries no marker → a fact likewise. A press
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
awaited inside the item's own transition through the shared `useActionTrigger` (conventions
3.4); the latest run's rejection goes to the boundary above the item and leaves the menu open.
Two runs of one `Item` overlap only under `whilePending="run"` (2.3); a superseded rejection,
there and for a `CheckboxItem` or `RadioGroup` dispatch, is passed to `reportError`
(conventions 2.4). A close that belongs to an earlier open is dropped (open-generation guard);
this applies to `Item` and to `closeOnActivate` on `CheckboxItem` / `RadioItem` alike.
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

Moved to `design/CHANGELOG.md` (part "menu.md"). Not part of the contract: the code and the tests are the reference.

## 14. Implementation notes

Moved to `design/CHANGELOG.md` (part "menu.md"). Not part of the contract: the code and the tests are the reference.
