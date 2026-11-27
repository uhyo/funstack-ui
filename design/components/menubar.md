# Menubar

Status: **accepted** (#170, part of #162; the user's decisions of 2026-11-27), implemented in
`packages/ui/src/menubar/` and `internal/menubar-context.ts` (the bar's context, read by
`Menu.Trigger` and `Menu.Popup`). History and the test plan:
`design/CHANGELOG.md`, the #170 entries. Follows `design/conventions.md`; where this document
and the conventions disagree, the conventions win. **Read `design/components/menu.md` first**:
a Menubar is a row of ordinary `Menu.Root`s, and every rule of a menu (items and their actions,
checkbox and radio items, submenus, typeahead, requests and facts, focus return, placement,
`<ViewTransition>`) applies unchanged. This document states only what the bar adds.

Inputs: `docs/vision.md`, `design/conventions.md`, `design/components/menu.md`,
`design/components/context-menu.md`, `design/components/toggle-group.md` (the Toolbar: the
roving-focus engine of section 6 and `Menu.Trigger` inside a Toolbar, 7.4),
`docs/research/popover-menu.md`, the implemented `packages/ui/src/menu/*`,
`packages/ui/src/toolbar/*` and `internal/use-roving-focus.ts`, the WAI-ARIA APG Menubar
pattern, prior art (Base UI Menubar, Radix Menubar, React Aria, Ark UI), and working notes in
`memo/architect/menubar-navmenu-notes.md`.

A menubar is the application menu of a desktop-style app: "File  Edit  View" in a row, each
opening a menu, with the arrow keys moving between the menus. It is **not** site navigation;
that is `design/components/navigation-menu.md`.

The design in one sentence: **`Menubar` is one element, a Toolbar-like container with
`role="menubar"`, and a `Menu.Trigger` inside it becomes an item of the bar the way a
`Menu.SubmenuTrigger` is an item of its parent menu.** The bar holds no open state. Each menu
keeps its own `open` / `openChangeAction` / `onOpenChange`; the platform already shows one
`popover="auto"` at a time.

## Decisions at a glance

| # | Topic | Decision |
| --- | --- | --- |
| 1 | Anatomy | One new component, the single-element `Menubar` (`div[role=menubar]`), from `@funstack/ui/menubar`. Its children are top-level `Menu.Root`s with the existing `Menu.Trigger`, `Menu.Popup` and item parts. No `Menubar.Menu`, `Menubar.Trigger` or other re-exported part. |
| 2 | The Trigger in a bar | `Menu.Trigger` reads the bar's context (as it reads the Toolbar's today) and renders `role="menuitem"` on top of what it already renders (`popovertarget`, `aria-haspopup="menu"`, no `aria-expanded`): exactly the attributes of a `Menu.SubmenuTrigger`. A disabled one is `aria-disabled` and stays focusable. |
| 3 | Roving focus | The bar is one Tab stop. The Toolbar's engine (`internal/use-roving-focus.ts`) runs on the bar: items are found in the DOM, `tabindex` is DOM-written, ArrowLeft / ArrowRight / Home / End move between Triggers (mirrored in RTL), the last focused Trigger stays the Tab stop. Popup content is already outside the engine's sequence. |
| 4 | Open state | None on the bar. Every `Menu.Root` is its own state owner, controlled or not, as outside a bar. "A menu of the bar is open" is read from the menus, never stored. |
| 5 | Switching menus | One procedure for every switch: **focus the target Trigger, close the other menus of the bar at once (a dismissal), request the target's open.** The old menu's close is a fact (`onOpenChange(false, "dismiss")`); the new menu's open is a request (`openChangeAction(true, "activate")`, a transition, `data-pending` on its Trigger while its items load). |
| 6 | What switches | From inside a menu: ArrowRight on an item that is not a SubmenuTrigger (any depth) goes to the next menu, ArrowLeft in a top-level menu to the previous one, both with the first item focused. On the bar while a menu is open: ArrowLeft / ArrowRight / Home / End, and the pointer moving onto another Trigger, open that menu with focus left on its Trigger. |
| 7 | Hover | Hover does nothing while every menu of the bar is closed: a click (or the keyboard) opens the first menu. No delay on a hover switch. |
| 8 | Closing | Everything Menu already has. One addition: when focus leaves the bar (the bar element contains its popups), a menu still shown is hidden at once, as Menu's Tab rule. |
| 9 | ARIA | Bar: `role="menubar"`, named by the consumer (`aria-label`). Triggers: `menuitem` with `aria-haspopup="menu"`; the expanded state is the browser's, from `popovertarget`. Popups and items: unchanged. |
| 10 | Server rendering | As Menu: always library mode, no JS-free mode. Server HTML has no `tabindex`, so every Trigger is a Tab stop until hydration, and a pre-hydration click opens the (empty) popup natively. |
| 11 | Animation | Nothing new. `transition` on each `Menu.Popup` animates the opening menu; the menu a switch closes leaves by CSS (it is a dismissal). |
| 12 | Not in v1 | `orientation="vertical"`, `experimental_focusgroup`, typeahead between Triggers, items directly in the bar (a menuitem without a menu), press-drag-release, a controlled "which menu is open" on the bar. |

---

## 1. Anatomy

```tsx
import { Menu } from "@funstack/ui/menu";
import { Menubar } from "@funstack/ui/menubar";

<Menubar aria-label="Application">                          {/* div[role=menubar] */}
  <Menu.Root>
    <Menu.Trigger>File</Menu.Trigger>                       {/* button[role=menuitem][popovertarget] */}
    <Menu.Popup>                                            {/* div[popover=auto][role=menu] */}
      <Menu.Item action={newFile}>New</Menu.Item>
      <Menu.Item action={save}>Save</Menu.Item>
      <Menu.Separator />
      <Menu.Root>                                           {/* a submenu, as in any menu */}
        <Menu.SubmenuTrigger>Open recent</Menu.SubmenuTrigger>
        <Menu.Popup><RecentFiles /></Menu.Popup>
      </Menu.Root>
    </Menu.Popup>
  </Menu.Root>
  <Menu.Root>
    <Menu.Trigger>View</Menu.Trigger>
    <Menu.Popup>
      <Menu.CheckboxItem checked={dense} checkedChangeAction={(next) => { setDense(next); }}>
        Dense
      </Menu.CheckboxItem>
    </Menu.Popup>
  </Menu.Root>
</Menubar>
```

Rendered HTML after hydration, closed:

```html
<div role="menubar" aria-label="Application">
  <button type="button" id="_r_1_-trigger" role="menuitem" tabindex="0"
          popovertarget="_r_1_" aria-haspopup="menu">File</button>
  <div id="_r_1_" popover="auto" role="menu" aria-labelledby="_r_1_-trigger" …></div>
  <button type="button" id="_r_2_-trigger" role="menuitem" tabindex="-1"
          popovertarget="_r_2_" aria-haspopup="menu">View</button>
  <div id="_r_2_" popover="auto" role="menu" aria-labelledby="_r_2_-trigger" …></div>
</div>
```

| Part | Element | Role | Library state rendered | Notes |
| --- | --- | --- | --- | --- |
| `Menubar` | `div` | `menubar` | none | The roving-focus engine, the bar's context, the focus-leave rule. `render`, and `className` / `style` / `children` as functions of an empty state. |
| `Menu.Trigger` (in a bar) | `button` | `menuitem` | as outside a bar: `data-open` (optimistic), `data-pending`, `data-disabled` | An item of the bar. `tabindex` is written by the bar's engine, not rendered. |
| every other `Menu` part | | | | unchanged |

Why this shape:

- **One element, so a plain component** (conventions 1.1), named like `Toolbar`'s Root would be
  if it had no Separator. A vertical rule between menus is the standalone `Separator`
  (`orientation="vertical"`), which is not focusable and so never an item.
- **The Menu parts are reused, not re-exported.** Base UI does the same (`<Menubar>` around
  `Menu.Root`s); Radix ships a second full namespace (`Menubar.Menu`, `Menubar.Trigger`,
  `Menubar.Content`, `Menubar.Item`, …). A second namespace would double the public types and
  the docs for parts whose behaviour is identical, and a menu could not be moved into or out of
  a bar without renaming every part.
- **`Menu.Trigger` adapts through context**, which it already does for a Toolbar
  (`design/components/toggle-group.md` 7.4). A separate `Menubar.Trigger` would be a second
  name for the same button.
- **The bar is the parent menu, horizontal.** Seen from a menu, the bar plays the role a parent
  menu plays for a submenu: its Trigger is an item of the container (`menuitem`, roving focus,
  focusable when disabled), and the forward / backward arrow keys cross between the two levels.
  The rules below are the submenu rules turned by ninety degrees wherever that is possible.

A top-level `Menu.Root` rendered under a `Menubar` (not inside a `Menu.Popup`) is **a menu of
the bar**. A submenu Root is not; the bar's context ends at each `Menu.Popup`. A
`Menu.ContextTrigger` in a menu of the bar keeps working and is not an item of the bar.

---

## 2. Open state across the bar

### 2.1 Who owns what

| State | Owner | Notes |
| --- | --- | --- |
| each menu's `open` | its `Menu.Root` | Unchanged: requests through `openChangeAction`, facts through `onOpenChange` (menu.md 2.4). |
| which Trigger is the Tab stop | the bar's engine | Urgent library state outside React, DOM-written (`design/components/toggle-group.md` 6). |
| "the bar is in menu mode" | nobody | Derived when needed: some menu of the bar has an open intended (`intended()`), shown or still pending. |
| one menu at a time | the browser | Sibling `popover="auto"` elements: showing one hides the other. |

The bar keeps a registry of its menus (each menu of the bar registers its Trigger element with
what the bar needs: `intended()`, whether the popup is shown, request open, request close). The
order of the menus is the DOM order of their Triggers, read when a key is pressed, as Menu reads
its items.

### 2.2 The switch

Every move from one menu of the bar to another runs one procedure, `switchTo(target, focus,
event)`:

1. **Focus the target Trigger** (with the focus ring for a key, quietly for the pointer). If
   focus was inside the old menu, Menu's own rule closes that menu at once: focus left its tree
   (menu.md 2.2, the Tab row).
2. **Close every other menu of the bar**: one that is shown is hidden with `hidePopover()` at
   once; one whose open is still pending gets `requestClose(event, "dismiss")`, which supersedes
   the open so that menu never appears (the HoverCard rule for an open that lost its reason).
   A menu that step 1 has just hidden is skipped: its popup is already hidden and its `toggle`
   (the fact) is still queued, so it would otherwise count as intended open and receive a
   request for a close that has happened. Each closed menu hears exactly one channel.
3. **Request the target's open**: `requestOpen(event, "activate")` with the open cause `focus`
   (`"first"`: the first item is focused when the menu shows; `"none"`: focus stays on the
   Trigger). Skipped when the target is disabled: the Trigger is focused and nothing opens.

Consequences:

- The old menu's close is a **fact** on its Root: `onOpenChange(false, { reason: "dismiss" })`.
  A controlled Root needs `onOpenChange`, as every controlled menu does.
- The new menu's open is a **request** on its Root: a transition, awaited, `data-open` and
  `data-pending` on its Trigger until its items have rendered. Items that suspend hold the open;
  meanwhile no menu is shown and focus is on the pending Trigger.
- Because the Trigger is focused **before** the popup is shown, the platform records the Trigger
  as the element to return focus to. Escape and item activation in the new menu return focus to
  the right Trigger with no extra rule.
- The bar's Tab stop follows through the engine's `focusin`.

Why the old menu closes at once instead of staying until the new one is ready: it needs no new
close path (step 1 is Menu's existing rule), the focus return above comes for free, and the APG
describes the move in this order ("moves focus to the next item in the menubar, and opens its
submenu"). The alternative (leave the old menu shown with focus in it until the new one commits,
then let the platform swap them) reads better when a menu's items load slowly, but focus would
sit in a menu the user has left, and the platform would record that menu's item as the return
target. The options not taken are in
`design/CHANGELOG.md`.

### 2.3 What triggers a switch

| Where | Input | Switch |
| --- | --- | --- |
| an item that is not a `SubmenuTrigger`, any depth | ArrowRight (ArrowLeft in RTL) | next menu of the bar, `"first"` |
| an item of a top-level menu | ArrowLeft (ArrowRight in RTL) | previous menu of the bar, `"first"` |
| a Trigger whose menu is intended open | ArrowLeft / ArrowRight / Home / End | the Trigger the engine moves focus to, `"none"` |
| a Trigger, while another menu of the bar is intended open | `pointermove` (not touch) | that Trigger's menu, `"none"` |

- "Next" and "previous" wrap when the bar's `loop` is on (the default), over every Trigger,
  disabled ones included.
- In a submenu, ArrowLeft still closes the submenu (menu.md 5); it reaches the previous menu
  only from the top level.
- A `SubmenuTrigger` handles its forward arrow itself (it opens the submenu), so the popup's
  handler never sees that key un-prevented.
- `pointermove`, not `pointerenter`: a menu that appears under a resting pointer must not count
  as a move (the reason items use it, menu.md 6.2). A disabled Trigger ignores the pointer.
- With every menu closed, the arrow keys only move focus between Triggers and the pointer does
  nothing (section 4).

### 2.4 Requests and facts

Menu's table (menu.md 2.4) applies to each Root. The bar adds these causes:

| Cause | Channel | `next` | `reason` | `details.event` |
| --- | --- | --- | --- | --- |
| A switch opens this menu | `openChangeAction` | `true` | `"activate"` | the `keydown` or `pointermove` |
| A switch closes this menu while it is shown; focus left the bar | **`onOpenChange`** | `false` | `"dismiss"` | the `toggle` `ToggleEvent` |
| A switch supersedes this menu's pending open | `openChangeAction` | `false` | `"dismiss"` | the `keydown` or `pointermove` |

---

## 3. Keyboard

Per the APG Menubar pattern. Inside a menu, everything in menu.md 5 holds; the rows below are
the bar's.

| Key | Where | Behaviour | Who |
| --- | --- | --- | --- |
| Tab / Shift+Tab | outside the bar | focus enters the bar at its Tab stop: the Trigger focused last, the first one before any was | engine |
| ArrowRight / ArrowLeft | Trigger | focus the next / previous Trigger (wraps with `loop`; mirrored in RTL). If the Trigger's menu was intended open: a switch (2.3) | engine, bar |
| Home / End | Trigger | first / last Trigger; same rule | engine, bar |
| ArrowDown, Enter, Space | Trigger | open its menu, first item focused; with the menu already shown, focus its first item | `Menu.Trigger` (unchanged) |
| ArrowUp | Trigger | open its menu, last item focused | `Menu.Trigger` (unchanged) |
| ArrowRight | item, not a SubmenuTrigger | next menu of the bar, first item focused | `Menu.Popup`, bar |
| ArrowLeft | item of a top-level menu | previous menu of the bar, first item focused | `Menu.Popup`, bar |
| Escape | menu | closes the innermost menu; focus returns to its Trigger | browser (unchanged) |
| Tab / Shift+Tab | menu | closes the stack; focus moves on (Shift+Tab lands on the bar's Trigger) | `Menu.Popup` (unchanged) |
| Tab / Shift+Tab | Trigger | leaves the bar; a menu still shown is hidden | browser, bar |

- A handled key calls `preventDefault()`. `Menu.Trigger`'s ArrowDown / ArrowUp are prevented
  before the engine sees them, as in a Toolbar.
- Keys with Alt, Ctrl or Meta are ignored.
- Shift+Tab from a menu lands on the bar's Trigger rather than before the bar. The APG moves
  focus out of the menubar; this is Menu's existing behaviour (the popup follows its Trigger in
  the focus order) and one more Shift+Tab leaves.
- No typeahead between Triggers in v1 (the APG marks it optional).

---

## 4. Focus and the pointer

- **Closed bar**: hovering a Trigger moves no focus and opens nothing. A menubar sits above a
  document; mousing across it must not take focus out of a text field.
- **Click on a Trigger**: Menu's toggle, unchanged. The first click opens with the first item
  focused quietly (menu.md 6.1).
- **Menu mode, pointer moves to another Trigger**: a switch with `"none"`. The Trigger is
  focused without the ring and its menu opens with focus left there; moving down into the menu
  focuses items as usual, and ArrowDown enters it. This is the hover-opened submenu rule
  (menu.md 6.1: focus stays on the SubmenuTrigger).
- **A click on the Trigger of an open menu closes it**, also when a hover switch opened it a
  moment ago (and a click during that open's pending phase cancels it). Native menubars behave
  the same way.
- **Focus leaves the bar** (`focusout` on the bar with a `relatedTarget` outside it; the popups
  are DOM descendants of the bar, so focus inside a menu is inside the bar): every menu of the
  bar still shown is hidden at once; a pending open is superseded with `requestClose(event,
  "dismiss")`. This covers the one state Menu's own rule cannot see: a menu open with focus on
  its Trigger (after a hover switch or a pre-hydration click). A null `relatedTarget` (window
  blur) closes nothing.
- **Focus return**: Menu's (menu.md 6.3). The platform returns focus to the Trigger that opened
  the menu; 2.2 makes that the right one after a switch.

---

## 5. Props and types

```ts
export interface MenubarState {}

export interface MenubarProps
  extends Omit<ComponentPropsWithRef<"div">,
    "role" | "onKeyDown" | "onFocus" | "onBlur" | "onPointerDown" | "className" | "style" | "children"> {
  /** Arrow keys (on the bar and from inside its menus) wrap from the last menu to the first and back. Default `true`. */
  loop?: boolean;
  className?: StateValue<string | undefined, MenubarState>;
  style?: StateValue<CSSProperties | undefined, MenubarState>;
  children?: StateValue<ReactNode, MenubarState>;
  render?: RenderProp<ComponentPropsWithRef<"div">, MenubarState>;
}
```

Owned keys: `role` (`"menubar"`), `onKeyDown`, `onFocus`, `onBlur`, `onPointerDown` (the
engine's, as `Toolbar.Root`). No `aria-orientation` is rendered: horizontal is the default of
the role. The name is the consumer's (`aria-label` or `aria-labelledby`), as for a Toolbar.

`Menu.Root`, `Menu.Trigger`, `Menu.Popup`: **no new props.** In a bar:

- `Menu.Trigger` renders `role="menuitem"`, renders no `tabindex` (the engine writes it), and
  turns `disabled` into `aria-disabled="true"` (the element stays focusable and never opens),
  the mapping a `SubmenuTrigger` uses; a disabled one renders no `popovertarget`. `role`
  joins its owned keys there.
- `Menu.Root`'s `delay` / `closeDelay` stay submenu-only (the dev warning stands): a hover
  switch has no delay.
- `Menu.Popup`'s defaults are unchanged (`side="bottom"`, `align="start"`).

---

## 6. ARIA

| Element | Attributes |
| --- | --- |
| `Menubar` | `role="menubar"`; the consumer's `aria-label` / `aria-labelledby` |
| `Menu.Trigger` in a bar | `role="menuitem"`, `aria-haspopup="menu"`, `id`, `popovertarget`, `tabindex` (DOM-written), `aria-disabled="true"` when disabled; no `aria-expanded` (#121: every engine exposes the popover's state on its invoker, measured for a `menuitem` on `Menu.SubmenuTrigger`) |
| `Menu.Popup` and items | as menu.md 8 |

The popups are DOM children of the `menubar` element, between the Triggers. That is the
structure of the APG example (each `menu` sits in the bar next to its `menuitem`) and the one a
submenu already has inside its parent `menu`.

Development warnings: a `Menubar` with no menu of the bar after mount; a menu of the bar whose
Trigger renders a non-button (Menu's existing warning applies: the awaited close needs an
invoker button).

---

## 7. Server Components, platform features

- **No JS-free mode**, as Menu (conventions 7.3): arrow keys and focus management cannot come
  from the platform. `Menubar` is a `"use client"` module; all its props are serialisable, so a
  Server Component can render the bar and pass Server Functions as item actions.
- **Before hydration**: the Triggers are plain `popovertarget` buttons, each a Tab stop, each
  opening its (empty) popup natively, one at a time. Mount reconciliation fills a menu found
  open (menu.md 2.1).
- **Popover API**: each menu is its own `popover="auto"`; exclusivity, Escape, light dismiss and
  the top layer are the platform's. **Anchor positioning**: each popup against its own Trigger,
  unchanged.
- **`interestfor`**: not used, for Menu's reasons (it opens on keyboard focus and Escape
  collapses the stack). The hover switch is one `pointermove` rule.
- **`focusgroup="menubar"`** (Chromium): not in v1 (section 10).

---

## 8. Suspense, overlap, errors

Everything is Menu's (menu.md 12), per Root. What a bar makes visible:

1. **Keyboard switch, items load.** Focus on "Save" in File. ArrowRight → `switchTo(Edit,
   "first")`: Edit's Trigger is focused; File's popup sees focus leave and hides
   (`onOpenChange(false, "dismiss")` on File's Root); Edit's Root dispatches `true`: Trigger
   `data-open`, `data-pending`. `<EditItems>` suspends: the open is held, the bar shows no menu.
   Data arrives → commit → `showPopover({ source: trigger })`, first item focused.
2. **ArrowRight again before it arrives.** Focus is on Edit's Trigger and Edit is intended open:
   the engine focuses View's Trigger and the bar switches with `"none"`: Edit's pending open is
   superseded (`openChangeAction(false, "dismiss")`, never shown), View's open is requested with
   focus left on its Trigger. ArrowDown then enters View. If Edit's open was held by an async
   `openChangeAction(true)` that is still running, React entangles View's open with it: View's
   Trigger shows `data-open` and `data-pending` and its menu appears when Edit's action
   settles, as in walkthrough 3. React's behaviour, not a rule of the bar.
3. **An item's action is pending and the user switches.** "Save" shows `data-pending`; the
   pointer moves to Edit. File hides at once (step 2 of the switch); the action keeps running in
   the item's transition, and its close finds the open generation changed and does nothing
   (menu.md 10.11). React entangles a transition with a pending async action, so Edit's open
   commits when "Save" settles; until then Edit's Trigger shows `data-open` and `data-pending`.
   A rejection of "Save" goes to `reportError` (the owner left, conventions 2.4).
4. **Controlled menus.** Each Root follows conventions 3.9.4: a Root that keeps `open={true}`
   after the switch's fact is re-shown, which hides the menu the switch opened. A bar of
   controlled menus needs `onOpenChange` on each, and the existing development warning says so.

---

## 9. Styling and animation

```css
.menubar { display: flex; gap: 2px; }
.menubar > [role="menuitem"] { padding: 4px 10px; border: 0; background: none; }
.menubar > [role="menuitem"]:focus-visible,
.menubar > [role="menuitem"][data-open] { background: var(--accent-weak); outline: none; }
.menubar > [role="menuitem"][data-pending] { cursor: progress; }
.menubar > [role="menuitem"][aria-disabled="true"] { opacity: .4; }
```

`data-open` is optimistic, so the Trigger of the menu a switch asked for is highlighted at once,
before its popup shows. The popups are styled as any menu (menu.md 9).

`transition` on a `Menu.Popup` works as outside a bar. In a switch the opening menu's commit may
run a view transition; the closing menu is a dismissal and leaves by its CSS exit. For a bar the
usual choice is no animation between menus: a view transition blocks pointer input while it
runs, and a user sweeping across the bar switches several times a second.

---

## 10. Not in v1

- **`orientation="vertical"`**: the engine and `Menu.Trigger`'s perpendicular open key already
  exist for a vertical Toolbar, so this is small, but it needs its own switch keys and popup
  default side. Deferred until asked for.
- **`experimental_focusgroup`** (`focusgroup="menubar"`): the Toolbar's flag carries over; the
  bar's own key handling for menu mode must then run next to the native moves. Deferred.
- **Typeahead between Triggers** (optional in the APG).
- **Items directly in the bar** (a `menuitem` with no menu, or a link). `Menu.Item` needs a
  `Menu.Popup` around it today.
- **Press, drag, release** from a Trigger onto an item (the context menu has this gesture,
  `design/components/context-menu.md` 2.6; a Trigger does not, in a bar or outside one).
- **A bar-level `value`** naming the open menu (Radix). Each Root can be controlled already.
- **Open on hover while closed.** Not planned: section 4.

---

## 11. Test plan

Step 1 (the accessibility tree and the axe result for a `menu` that is a direct DOM child of
the `menubar`) was run at implementation and **passed**: the anatomy stands. The result, the
plan and the probe are in `design/CHANGELOG.md` (the #170 entries). Not part of the contract.
