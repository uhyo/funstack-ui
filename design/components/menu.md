# Menu (menu button)

Status: **accepted** (2026-10-17, GitHub issue #39; the product owner accepted all eleven
questions as recommended, see the end of this document; the shared `useActionTrigger` lands as
a follow-up after Popover merges). Follows `design/conventions.md` (accepted);
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
| 1 | Anatomy | `Menu.Root` (no DOM; a Root rendered inside a `Menu.Popup` is a **submenu**), `Menu.Trigger` (`button[commandfor][command=toggle-popover][aria-haspopup=menu]`), `Menu.Popup` (`div[popover=auto][role=menu]`), `Menu.Item` (`button[role=menuitem]`), `Menu.CheckboxItem` (`role=menuitemcheckbox`), `Menu.RadioGroup` (`div[role=group]`) with `Menu.RadioItem` (`role=menuitemradio`), `Menu.Group` (`div[role=group]`) with `Menu.GroupLabel`, `Menu.Separator` (`hr`), `Menu.SubmenuTrigger` (`button[role=menuitem][aria-haspopup=menu]`). No Portal, Positioner, Arrow. |
| 2 | Mode | **Always library mode.** A menu cannot be APG-conformant without JS, so there is no JS-free mode: `open` / `defaultOpen` / `openChangeAction` select controlled or uncontrolled, never a mode. The Trigger still renders `commandfor` + `toggle-popover`, so a pre-hydration click opens the (empty) menu natively and mount reconciliation fills it (Popover 2.4). |
| 3 | Item activation and close (research Q1) | `Menu.Item action` runs in the item's own transition with `data-pending` on the item; **the menu stays open until the action settles, then the whole stack closes through the root Root's library-owned close** (`requestClose`, `openChangeAction(false)` awaited, `hidePopover()` in the apply effect, view transition if set). A sync action closes in the same tick, so the browser-feel is unchanged for the common case; a slow Server Function shows progress on the item and never leaves the user with a vanished menu and no feedback. A rejection leaves the menu open and reaches the nearest Error Boundary. |
| 4 | Checkbox / radio items | `CheckboxItem` (`checked` / `defaultChecked` / `checkedChangeAction`) and `RadioGroup` (`value` / `defaultValue` / `valueChangeAction`) are state owners with `useOptimistic`: `aria-checked` and `data-checked` flip at once, `data-pending` while the action runs, rollback on rejection. **They keep the menu open by default** (APG: Space toggles without closing; toggling several options is the use case); `closeOnActivate` on every item kind overrides the default either way (`Item` defaults to `true`). |
| 5 | Keyboard | APG Menu Button + Menu: Enter / Space / ArrowDown open with the first item focused, ArrowUp with the last; Up / Down move (wrap by default, `loop={false}` stops), Home / End, typeahead, Enter / Space activate, Escape closes the innermost menu, Tab / Shift+Tab close the whole stack and move on, ArrowRight / ArrowLeft open / close submenus (mirrored under `direction: rtl`). Disabled items are focusable (`aria-disabled`) and never activate. |
| 6 | Focus model | Real DOM focus on items (roving: `tabindex="-1"` on every item, focus moved by script), never `aria-activedescendant`. On every open the first item is focused (last for ArrowUp) through the Popover hook's `autofocus` write; a hover-opened submenu keeps focus on its trigger. Pointer movement over an item focuses it, so keyboard and pointer always agree on the current item. |
| 7 | Submenus | A nested `Menu.Root` whose `Menu.SubmenuTrigger` is an item of the parent menu. Opened with `showPopover({ source: submenuTrigger })` (nested auto popover: the parent stays open, siblings close each other), placed `side="right" align="start"` with `position-try-fallbacks: flip-inline`. Opened by ArrowRight / Enter / Space / click (first item focused) or by hover intent (`delay` 100 ms, no focus move); closed by ArrowLeft, Escape (innermost only), hover leaving to a sibling item (`closeDelay` 150 ms), or the stack closing. Focus returns to the SubmenuTrigger through Popover 6.2's rule (the platform restores nothing for nested popovers). |
| 8 | Hover intent (research Q5) | Timers only: `delay` / `closeDelay` on the submenu's `Menu.Root`, defaults 100 / 150 ms, implemented with the same small internal timer helper Tooltip's interaction uses for its delays, **not** Tooltip's interaction hook (focus, blur, document listeners and `interestfor` do not apply). No "safe triangle" in v0; `closeDelay` covers a diagonal move into the submenu. `interestfor` is not used (research: opens on focus and collapses the stack on Escape). |
| 9 | `experimental_focusgroup` | On `Menu.Popup`: renders `focusgroup="menu wrap|nowrap"` (`wrap` from `loop`), detected with `"focusGroup" in HTMLElement.prototype` through `useSyncExternalStore` (#43); on the native path items render **no** `tabindex` (Chromium leaves `tabindex="-1"` elements out of the group) and the JS Up / Down / Home / End branch steps aside. Typeahead, Enter / Space, submenu keys and Tab-closes-stack stay JS everywhere. |
| 10 | Closing the stack on Tab | A `focusout` listener on the **root** menu's Popup: when `relatedTarget` is outside the menu tree (the root Popup's subtree, which contains every submenu as a DOM descendant, since nothing portals), the root Popup hides itself (`hidePopover()`, the platform hides nested popovers) and every Root is notified with `reason: "dismiss"`. A null `relatedTarget` (window blur) closes nothing. |
| 11 | ARIA | Trigger: `aria-haspopup="menu"`, `aria-expanded` (optimistic), `id`. Popup: `role="menu"`, `aria-labelledby` → the Trigger (or SubmenuTrigger) id. Items: explicit `role`s, `aria-disabled`, `aria-checked` from optimistic state. `Menu.Group` / `Menu.RadioGroup`: `role="group"` + `aria-labelledby` → `GroupLabel`. `Separator`: `<hr>` (implicit `separator`). |
| 12 | Pending UI | Trigger: `data-open`, `data-pending` (Root pending: open or close in flight). Item: `data-pending` while its action runs. CheckboxItem / RadioItem: `data-checked` (optimistic), `data-pending`; `RadioGroup`: `data-pending` (owner). Popup: nothing (`:popover-open`). |
| 13 | Content mounting | Conventions 3.7 unchanged: Popup children unmount when closed by default; `keepMounted` keeps them in `<Activity mode="hidden">`. Items are read from the DOM at keydown time (no registration), so mounting strategy does not affect keyboard code. |
| 14 | Animation | As Popover: CSS for opens and dismissals; `transition` on Popup wraps the `<div popover>` and animates library-driven opens and closes (item activation, Close, ArrowLeft, hover close, controlled) in every engine. Types `fsui-menu`, `fsui-menu-open`, `fsui-menu-close`; item state types `fsui-menu-check` / `fsui-menu-uncheck` / `fsui-menu-select`. |
| 15 | Out of scope | Context menus (#45), menubars (`ArrowLeft` / `ArrowRight` between top-level menus), `interestfor`, the Open UI `<menulist>` elements (a future `experimental_` rendering), `Menu.Form`. |

---

## 1. Anatomy

```tsx
import { Menu } from "@funstack/ui/menu";

<Menu.Root>                                                 {/* no DOM; owns ids, open state, context */}
  <Menu.Trigger>Actions</Menu.Trigger>                      {/* button[commandfor][command=toggle-popover][aria-haspopup=menu] */}
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
<button type="button" id="_r_1_-trigger" commandfor="_r_1_" command="toggle-popover"
        aria-haspopup="menu" aria-expanded="false">Actions</button>
<div id="_r_1_" popover="auto" role="menu" aria-labelledby="_r_1_-trigger"
     data-side="bottom" data-align="start"
     style="position-area: bottom span-right; position-try-fallbacks: flip-block, flip-inline, flip-block flip-inline">
  <!-- children render on open (default); shown here as they will be -->
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
          commandfor="_r_2_" command="toggle-popover" aria-haspopup="menu" aria-expanded="false">Move to</button>
  <div id="_r_2_" popover="auto" role="menu" aria-labelledby="_r_2_-trigger"
       data-side="right" data-align="start"
       style="position-area: right span-bottom; position-try-fallbacks: flip-inline">…</div>
  <button type="button" role="menuitem" tabindex="-1" class="danger">Delete</button>
</div>
```

| Part | Element | Role | Library state rendered | Notes |
| --- | --- | --- | --- | --- |
| `Root` | none | | `state.open` (optimistic), `state.pending`, `state.submenu` in `children(state)` | `usePopoverRoot({ component: "menu", mode: "library" })`. A Root under a `MenuContext` is a submenu. |
| `Trigger` | `button` | button | `aria-expanded`, `data-open` (optimistic), `data-pending`, `data-disabled` | `usePopoverTrigger` plus `id`, `aria-haspopup="menu"` and the open-with-focus keys. Only valid in a top-level Root (dev warning otherwise). |
| `Popup` | `div` | `menu` | `data-side`, `data-align` | `usePopoverPopup` with Menu's initial-focus resolver, keyboard handling, typeahead, `focusout`, `focusgroup`. |
| `Item` | `button` | `menuitem` | `data-pending`, `data-disabled` | `action`, `closeOnActivate` (default `true`). |
| `CheckboxItem` | `button` | `menuitemcheckbox` | `aria-checked`, `data-checked` (optimistic), `data-pending`, `data-disabled` | `checked` triple; `closeOnActivate` default `false`. |
| `RadioGroup` | `div` | `group` | `data-pending` | `value` triple; `aria-labelledby` → a `GroupLabel` child. |
| `RadioItem` | `button` | `menuitemradio` | `aria-checked`, `data-checked` (optimistic), `data-pending` (initiating item), `data-disabled` | `value`; `closeOnActivate` default `false`. |
| `Group` | `div` | `group` | none | `aria-labelledby` → `GroupLabel`. |
| `GroupLabel` | `div` | | none | `id` wiring. |
| `Separator` | `hr` | `separator` (implicit) | none | `render={<div role="separator" />}` if an `<hr>` cannot be styled as wanted. |
| `SubmenuTrigger` | `button` | `menuitem` | `aria-expanded`, `data-open` (optimistic), `data-pending`, `data-disabled` | Both an item of the parent menu and the Trigger of the submenu: `commandfor` + `toggle-popover`, `aria-haspopup="menu"`, roving `tabindex`, typeahead participation, ArrowRight / Enter / Space / click / hover open. |

Why these parts:

- **Items are `<button type="button">`** with explicit roles (research): Enter and Space
  activate natively, `type="button"` keeps them out of forms, and `render` can substitute a link
  (`render={<Link href />}` for a navigation item) at the cost of native activation, which the
  keydown handler supplies. `disabled` becomes `aria-disabled="true"`, never the native
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
the command path (another element works through the click handler); items may render anything
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
not a supported mode. The Trigger keeps `commandfor` + `toggle-popover` for that enhancement
(and for the implicit anchor and `aria-expanded` mapping), so a pre-hydration click opens the
menu natively, empty by default, reconciled on mount exactly as Popover 2.4. Consumers who need
items in the server HTML use `keepMounted`? No: a hidden `<Activity>` emits no HTML either. A
menu whose pre-hydration experience matters is rare; it is recorded as question 3.

### 2.2 The menu's closes

| Close | Owner | What happens | `reason` |
| --- | --- | --- | --- |
| Item activation (after its `action` settles), with `closeOnActivate` | library, **root Root** | the item calls the root menu's `requestClose(event, "activate")`; `openChangeAction(false)` of the root Root awaited; committed `false`; apply effect `hidePopover()` on the root Popup; the platform hides every nested popover; each submenu Root's `toggle` listener notifies its own `openChangeAction(false, { reason: "dismiss" })` | root: `"activate"`; submenus: `"dismiss"` |
| Trigger click while open | library | Popover 2.3 | `"activate"` |
| ArrowLeft in a submenu, hover leaving a SubmenuTrigger to a sibling item | library, that submenu's Root | `requestClose` on the submenu's Root; `hidePopover()` in its apply effect; focus return to the SubmenuTrigger by Popover 6.2's rule (ArrowLeft) or no focus change (hover: focus was never inside) | `"activate"` (ArrowLeft) / `"dismiss"` (hover) |
| Tab / Shift+Tab, focus leaving the tree | library-initiated, browser-shaped | the root Popup's `focusout` listener calls `rootPopup.hidePopover()` at once (no await: the focus has already moved and the menu must not linger over the page); every Root is notified from `toggle` | `"dismiss"` |
| Escape | browser | innermost menu only (the platform's close-watcher stack); focus returns to its trigger (platform for the root menu, library for a submenu); notification | `"dismiss"` |
| Light dismiss, another `auto` popover or modal dialog opening outside | browser | the whole stack; notifications | `"dismiss"` |
| Controlled parent sets `open={false}` | library | apply effect; echo | (none) |

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

### 2.3 Item activation and `closeOnActivate` (research question 1)

```tsx
// inside MenuItem
const [pending, startOwnTransition] = useTransition();
const activate = (event: Event) => {
  if (disabled) return;
  const details = createActionDetails(event, {});
  startOwnTransition(async () => {
    await action?.(details);
    if (closeOnActivate) rootMenu.requestClose(event, "activate");
  });
};
```

The three timings that were on the table, and why "stay open, then close in the commit" wins:

| Timing | Behaviour | Verdict |
| --- | --- | --- |
| Close at once, run the action detached | native feel; the item unmounts with the menu, so `data-pending` has nowhere to show; a slow Server Function leaves the user with no feedback and no error surface inside the menu | rejected: contradicts "pending state exposed" |
| Close at once, show pending on the Trigger | feedback lands on the wrong element (the user clicked an item, not the button) and only while the Root's transition is pending; the item's action is not the Root's | rejected |
| **Stay open with `data-pending` on the item; close when the action settles** | sync and fast actions close in the same tick (indistinguishable from "at once"); slow ones show progress where the user clicked; a rejection keeps the menu open and reaches a boundary; the close is library-driven, so `<ViewTransition>` animates the exit in every engine (the research's reason for making activation library-owned) | **chosen** |

This is the Dialog.Close / Popover.Close idiom applied to items, and the conventions' rule that a
part is never disabled while pending holds: a second click re-runs the action (latest intent);
the first `requestClose` wins and later ones are no-ops against `intended()`. A consumer who
wants "close now, work later" writes `action={() => { void archive(id); }}` (not awaited;
conventions 2.3 item 5).

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

As `PopoverTriggerProps` / `PopoverTriggerState` (owned keys: `type`, `id`, `commandfor`,
`command`, `disabled`, `aria-haspopup`, `aria-expanded`, `onClick`, `onKeyDown`, `data-open`,
`data-pending`, `data-disabled`). `onKeyDown` is added for ArrowDown / ArrowUp (open with the
first / last item focused; Enter / Space are the native click). Rendering a `Menu.Trigger` inside
a submenu Root is a dev warning ("use `Menu.SubmenuTrigger`").

### 3.3 `Menu.Popup`

```ts
export type MenuSide = PopoverSide;   // "top" | "bottom" | "left" | "right"
export type MenuAlign = PopoverAlign; // "start" | "center" | "end"

export interface MenuPopupState {
  readonly open: boolean;        // committed
  readonly side: MenuSide | null;
  readonly align: MenuAlign;
  readonly submenu: boolean;
}

export interface MenuPopupProps
  extends Omit<ComponentPropsWithRef<"div">, "id" | "popover" | "role" | "aria-labelledby" | "onKeyDown" | "onFocus" | "onBlur" | "onToggle" | "onBeforeToggle" | "className" | "style" | "children"> {
  /** Default `"bottom"` for a top-level menu, `"right"` for a submenu. `null`: stylesheet-owned placement. */
  side?: MenuSide | null;
  /** Default `"start"` (both levels). */
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
as a last resort when a menu has no items), `data-side` / `data-align`, the three handlers. No
`aria-orientation` (vertical is the default for `menu`; horizontal menus are not designed).
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
  /** Receives the chosen item's `value`; a selected item re-activated is a no-op. */
  valueChangeAction?: ChangeAction<string>;
  className?: StateValue<string | undefined, MenuRadioGroupState>;
  style?: StateValue<CSSProperties | undefined, MenuRadioGroupState>;
  children?: StateValue<ReactNode, MenuRadioGroupState>;
  render?: RenderProp<ComponentPropsWithRef<"div">, MenuRadioGroupState>;
}

export interface MenuRadioItemState { readonly checked: boolean; readonly pending: boolean; readonly disabled: boolean; }

export interface MenuRadioItemProps extends Omit<MenuCheckboxItemProps, "checked" | "defaultChecked" | "checkedChangeAction" | "className" | "style" | "children" | "render"> {
  value: string;
  className?: StateValue<string | undefined, MenuRadioItemState>;
  style?: StateValue<CSSProperties | undefined, MenuRadioItemState>;
  children?: StateValue<ReactNode, MenuRadioItemState>;
  render?: RenderProp<ComponentPropsWithRef<"button">, MenuRadioItemState>;
}
```

`RadioGroup` is the owner (`useControllableAction<string | null>`; `data-pending` on the group,
`role="group"`, `aria-labelledby` → a `GroupLabel` child's id if present); `RadioItem` renders
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
`disabled`). Owned keys: the Trigger's (`id`, `commandfor`, `command`, `aria-haspopup`,
`aria-expanded`, `data-open`, `data-pending`) and the item's (`role="menuitem"`, `tabIndex`,
`aria-disabled`, `data-disabled`, `onClick`, `onKeyDown`, `onPointerMove`, `onPointerEnter`,
`onPointerLeave`). Only valid in a submenu Root (dev warning otherwise).

### 3.9 Namespace

```ts
export const Menu = {
  Root: MenuRoot, Trigger: MenuTrigger, Popup: MenuPopup,
  Item: MenuItem, CheckboxItem: MenuCheckboxItem, RadioGroup: MenuRadioGroup, RadioItem: MenuRadioItem,
  Group: MenuGroup, GroupLabel: MenuGroupLabel, Separator: MenuSeparator,
  SubmenuTrigger: MenuSubmenuTrigger,
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

`RadioItem` activation on the already-selected item is a no-op against the optimistic value
(conventions 2.3 item 8); on another item it dispatches the group's `valueChangeAction(value)`,
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
| Printable character | item | typeahead (section 5.1) | Popup |
| Enter | item | activate (`Item`: action then close; checkable items: toggle, close only with `closeOnActivate`); `preventDefault()` so a native button does not also click | item |
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
the first item on click) and keeps Escape / Tab behaviour uniform; `:focus-visible` heuristics
hide the ring after a pointer open in every engine.

### 6.2 Current item follows the pointer

`onPointerMove` on an item (not `pointerenter`, which fires for a popup appearing under a resting
pointer) focuses the item without `focusVisible` when it is not already focused. Keyboard and
pointer then always agree on the current item: ArrowDown after hovering "Archive" moves to the
item below "Archive", and Enter activates the hovered item, as native menus do. Leaving the items
for empty popup space or the page changes nothing.

### 6.3 Focus return

Top-level menu: the platform returns focus to the Trigger on Escape, item activation
(`hidePopover()` from the apply effect runs the same hide steps) and ArrowLeft-free closes; a
light dismiss leaves focus where the mousedown put it; Tab moves it on. Submenu: the platform
restores nothing, so Popover 6.2's rule applies: `focusWasInside` at `beforetoggle(closed)`
and focus on `<body>` or inside after → focus the SubmenuTrigger. Covers Escape and ArrowLeft in
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
  `"dismiss"`), Escape closes the innermost, an outside click closes the stack. `commandfor` on
  the SubmenuTrigger keeps the declarative nesting for a pre-hydration click.
- **Placement.** `side="right"`, `align="start"`: `position-area: right span-bottom` (the
  submenu's top edge aligns with the item's top, its left edge with the item's right; research
  verified the implicit anchor from `source`), `position-try-fallbacks: flip-inline`. A
  horizontal gap is the stylesheet's (`margin-inline-start`). **WebKit 302008**
  (`position-try-fallbacks` on a nested popover hangs or spins): the default keeps the fallback,
  because the bug is NEW against a platform feature the vision adopts and the reporter says the
  hang itself was fixed in 26.4; the first WebKit CI run of the submenu rows decides (section
  13.3). Consumers who hit it set `side={null}` and position the submenu in CSS without
  fallbacks. If the CI run hangs, the submenu default drops to no fallbacks until the bug is
  fixed (question 6).
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
| Trigger | `id`, `aria-haspopup="menu"`, `aria-expanded` (optimistic), `commandfor`, `command="toggle-popover"`, `type="button"`; no `aria-controls` (passes through) |
| Popup | `role="menu"`, `aria-labelledby` → Trigger / SubmenuTrigger id (token-merged), `tabindex="-1"`, `popover="auto"`, `focusgroup` with the flag |
| Item | `role="menuitem"`, `tabindex="-1"` (none on the native focusgroup path), `aria-disabled="true"` when disabled, `type="button"` |
| CheckboxItem | `role="menuitemcheckbox"`, `aria-checked` (optimistic), rest as Item |
| RadioGroup | `role="group"`, `aria-labelledby` → GroupLabel |
| RadioItem | `role="menuitemradio"`, `aria-checked` (optimistic), rest as Item |
| Group / GroupLabel | `role="group"` + `aria-labelledby`; the label has the `id` |
| Separator | `<hr>` (implicit `separator`) |
| SubmenuTrigger | `role="menuitem"`, `aria-haspopup="menu"`, `aria-expanded`, `id`, `commandfor`, `command`, `tabindex="-1"` |

Chromium's implicit `aria-expanded` and `aria-details` for `commandfor` invokers are overridden
by the explicit attributes; placing the Popup right after the Trigger (the natural DOM order
here) also suppresses the `aria-details` relation in HTML-AAM. Screen-reader pass (NVDA, JAWS,
VoiceOver) in the example app before leaving "proposed": menu button announcement, item
counts, checkbox / radio states, submenu announcement.

Development warnings: `Menu.Trigger` inside a submenu Root, `Menu.SubmenuTrigger` outside one;
an item outside a Popup; `RadioItem` outside a `RadioGroup` (throws); `delay` / `closeDelay`
on a top-level Root; a Popup rendered as a `<dialog>`; `transition` and `keepMounted` as Popover.

---

## 9. Styling and animation

```css
.menu { margin: 0; inset: auto; min-inline-size: 12rem; padding: 4px; border: 0; border-radius: 8px; box-shadow: 0 8px 32px rgb(0 0 0 / .2); }
.menu[data-side="right"] { margin-inline-start: 2px; }              /* submenu gap */
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
   cause "first"; dispatch `true` (`O=true`, Trigger `aria-expanded="true"`, `data-pending`).
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
awaited inside the item's `useTransition`; a rejection goes to the boundary above the item; a
superseded rejection on the same item (two clicks, the first rejects after the second resolved)
is **dropped by React** (Dialog.Close's known gap, repeated here). To close it, the implementation
should give `Menu.Item`, `Popover.Close` and `Dialog.Close` one shared internal
`useActionTrigger(action)` that applies the superseded-rejection logic of `useControllableAction`
without the state; recorded as implementation note and conventions feedback 2. Submenu content
that suspends holds the submenu's open with `data-pending` on the SubmenuTrigger.

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
| Roles and ARIA | The section 1 HTML: trigger (`aria-haspopup`, `aria-expanded`, `id`, `commandfor`), popup (`role=menu`, `aria-labelledby` = trigger id, `tabindex=-1`), items (`role`, `tabindex=-1`, `type=button`), checkbox / radio `aria-checked`, group / label wiring, `<hr>`, SubmenuTrigger (`role=menuitem` + `aria-haspopup` + `aria-expanded` + `commandfor`); `experimental_focusgroup` renders `focusgroup="menu wrap"` (`nowrap` with `loop={false}`) and items keep `tabindex=-1` (no `focusGroup` in jsdom); `disabled` renders `aria-disabled` and no `disabled`. |
| Keyboard | Trigger: Enter / Space / ArrowDown open with the first enabled item `autofocus`ed at `showPopover`, ArrowUp the last; in the menu: ArrowDown / ArrowUp / Home / End move focus, wrap with `loop`, stop without; disabled items receive focus; Enter / Space activate; Space with a typeahead buffer does not; modifiers ignored; RTL (`getComputedStyle` stub) swaps ArrowRight / ArrowLeft for submenus. Escape not simulable. |
| Typeahead | "a" moves to the next item starting with "a" from the focused one, wraps; "a", "a" cycles; "ar" within 500 ms matches a prefix; after 500 ms the buffer resets; `label` overrides text; submenu items not matched from the parent. |
| Sync action (both for CheckboxItem / RadioGroup; Root as Popover) | `Menu.Item action` receives `(details)` with `details.event` the native event (`click` for pointer, `keydown` for Enter); disabled items never dispatch; a selected RadioItem re-activated never dispatches; `closeOnActivate={false}` keeps the menu (no `requestClose`). |
| Async action (both) | Item: `data-pending` on the item while deferred; menu still open; resolve → root `openChangeAction(false, "activate")`, `hidePopover` called once. CheckboxItem: `aria-checked` / `data-checked` optimistic, `data-pending`, committed after resolve; stays open; with `closeOnActivate` closes after resolve. RadioGroup: `data-pending` on group and chosen item; previous item `aria-checked=false` at once. |
| Rejection (both) | Item rejects: `ErrorCatcher` inside the Popup receives it, menu open, `hidePopover` not called. CheckboxItem rejects: `aria-checked` rolls back, catcher receives. RadioGroup likewise. Caught-inside variants commit. |
| Overlap | Two RadioItem dispatches out of order: optimistic latest, committed latest. Two Item clicks: action called twice, `requestClose` once effective. |
| Superseded rejection (both) | CheckboxItem / RadioGroup: the older dispatch rejects after and while the newer is pending; the catcher gets it. Item: documented gap, asserted via the shared `useActionTrigger` once implemented. |
| Suspending content (both) | Popup children suspend on open: `showPopover` not called, Trigger pending; resolve: called, first item focused. Submenu likewise with `data-pending` on the SubmenuTrigger. |
| Function props / `render` | Every part's state; `render={<a href />}` on an Item activates through keydown Enter and click; `render={<div role="separator" />}` on Separator. |
| Post-await rule | Controlled Root and controlled CheckboxItem / RadioGroup updating after `await`. |
| Directive | Every file under `src/menu/` except `index.ts` is `"use client"`. |
| Platform path | Mount with the popup already open (shim) → one `"platform"` dispatch; a foreign `show-popover` command is cancelled and routed; a controlled `open` flip calls `showPopover` / `hidePopover` with no echo dispatch. |
| Submenus | A nested Root detects `submenu`; its Popup defaults `side="right"`, `align="start"`, fallbacks `flip-inline`; `showPopover` called with `{ source: submenuTrigger }`; ArrowRight / Enter / Space / click open with the first item `autofocus`ed; hover: `pointerenter` + 100 ms → open with no `autofocus`; `pointerleave` + 150 ms → `requestClose` ("dismiss"); entering the submenu popup cancels; keyboard focus inside blocks the hover close; ArrowLeft → `requestClose` ("activate") and, after `hidePopover` + `toggle` with focus moved to body by the test, the SubmenuTrigger is focused; `Menu.Trigger` in a submenu warns; `delay` on a top-level Root warns. |
| Stack close | Item activation in a submenu calls the root Root's close; root `openChangeAction(false, "activate")`, submenu `openChangeAction(false, "dismiss")` after the shim's nested hide (the shim must hide nested popovers when an ancestor hides: addition). `focusout` to an outside element → root `hidePopover` at once, `"dismiss"` everywhere; `relatedTarget: null` → nothing; `focusout` into a submenu item → nothing. |
| Pointer focus | `pointermove` on an item focuses it (no `focusVisible`); on the already-focused item nothing. |
| `transition` smoke | As Popover 13.2; plus item activation with `transition` unmounts in the close commit. |

### 13.2 Browser mode (`menu.browser.test.tsx`, Chromium, Firefox, WebKit)

| Row | Assertion | Engine branches |
| --- | --- | --- |
| Native `focusgroup` | With `experimental_focusgroup`: ArrowDown on the first item moves focus **without** the library's `preventDefault()` (a document keydown listener sees `defaultPrevented === false`, the Tabs technique) and items have no `tabindex`; Home / End / wrap work; typeahead and Enter still work. | `supportsFocusgroup` (Chromium): native path. Elsewhere: items keep `tabindex="-1"`, the JS path prevents the keydown, same focus outcome. Both branches asserted, none skipped. |
| Keyboard end to end | Trigger ArrowDown opens with real focus on the first item; arrows, Home / End, typeahead, Enter activates and the menu closes with focus back on the Trigger; Escape closes with focus on the Trigger; Shift+Tab from the first item lands on the Trigger and closes the menu; Tab from the last item lands after the Trigger and closes. | none |
| Submenu | ArrowRight opens the submenu anchored at the item's right edge (`getBoundingClientRect`) with focus on its first item; Escape closes only the submenu and **the library** focuses the SubmenuTrigger (every engine: the platform restores nothing); ArrowLeft likewise; hover intent with real timers (open after ~100 ms, close after leaving ~150 ms, cancelled by entering the submenu); item activation in the submenu closes both with focus on the root Trigger; outside click closes both. | WebKit 302008: on `browserName === "webkit"` the submenu Popup renders `side={null}` with a comment; the inline-flip assertion (a submenu near the right edge flips left) runs on Chromium and Firefox. Watch the first WebKit run for a timeout with the default fallbacks in one dedicated row (`test.fails` style record, not a skip). |
| Checkbox / radio | Space toggles `aria-checked` and keeps the menu open; `closeOnActivate` closes after the action; radio switch updates both items at once. | none |
| Exit animation | After item activation without `transition`: `held` keeps items until `getAnimations()` settle; after Escape likewise. | Firefox: `getAnimations().length === 0` → unmount with the commit. |
| ViewTransition | With `transition`: open calls `startViewTransition` once; item activation once with a `::view-transition-old` of the popup present during the transition; Escape only for the notification commit; without `transition` zero calls. | Assert on all three. |
| Light dismiss and layering | Click outside closes with `"dismiss"`; a Tooltip (`manual` / `hint`) on an item does not close the menu; a modal Dialog opened from an item keeps the menu open while it is a DOM descendant (and closes it when opened outside). | `supportsPopoverHint` for the hint variant. |
| Pointer focus | Moving the real pointer over items focuses them; `:focus-visible` is false after a pointer open. | none (assert `:focus-visible` only where `matches` supports it; all three do). |

---

## 14. Implementation notes

```
packages/ui/src/menu/
  index.ts                  # no directive; namespace + types; imports platform-attributes
  menu-context.ts           # "use client": MenuContext (root + per-level), MenuGroupContext, MenuRadioGroupContext, MenuListContext (focusgroup)
  menu-root.tsx             # "use client": usePopoverRoot({ component: "menu", mode: "library" }), submenu detection, open-cause ref, hover timers' options
  menu-trigger.tsx          # "use client": usePopoverTrigger + aria-haspopup + ArrowDown/ArrowUp
  menu-popup.tsx            # "use client": usePopoverPopup with the resolver; keyboard, typeahead, focusout, focusgroup detection
  menu-item.tsx             # "use client": useActionTrigger; role/tabindex/aria-disabled; pointermove focus
  menu-checkbox-item.tsx    # "use client": useControllableAction<boolean>
  menu-radio-group.tsx      # "use client": useControllableAction<string | null>
  menu-radio-item.tsx       # "use client"
  menu-group.tsx, menu-group-label.tsx, menu-separator.tsx   # "use client" (context for ids)
  menu-submenu-trigger.tsx  # "use client": item + trigger; hover intent
  menu.test.tsx, menu.browser.test.tsx
packages/ui/src/internal/
  use-action-trigger.ts     # "use client": own transition + superseded-rejection surfacing (shared with Popover.Close, Dialog.Close)
  use-delayed-pair.ts       # "use client": open/close timer pair (Tooltip's hook refactored onto it)
  use-popover-*.ts          # from #38; extension points below
```

- **Extension points needed in the Popover hooks** (to add while implementing #40 or #41):
  `usePopoverRoot({ component, mode: "library", onDispatch?(next, details) })` for the open-cause
  record and timer cancellation; `usePopoverPopup({ resolveInitialFocus(popup, cause), onKeyDown,
  onFocusOut, role })`; `usePopoverTrigger` reusable by `SubmenuTrigger` with extra handlers
  merged in order (consumer's, then the item's, then the trigger's).
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
  Trigger is outside on purpose (Shift+Tab closes).
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
   first WebKit CI run hangs. Decision: as designed.
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
    Decision: accepted as a follow-up after Popover merges; until then the Item uses
    `useTransition` and the superseded-rejection row records the gap (conventions 3.4).
