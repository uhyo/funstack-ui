# NavigationMenu

Status: **accepted** (#170, part of #162; the user's decisions of 2026-11-27). Implemented in `packages/ui/src/navigation-menu/`. History and the test plan:
`design/CHANGELOG.md`, the #170 entries. Follows `design/conventions.md`; where this document
and the conventions disagree, the conventions win. **Read `design/components/popover.md`
first**: a NavigationMenu flyout is the Popover's two-mode model (JS-free mode, library mode,
requests and facts, the apply effect, placement, `<ViewTransition>`) on a `<div popover>` inside
a list of links. This document repeats only what differs.

Inputs: `docs/vision.md`, `design/conventions.md`, `design/overlay-open-state.md`,
`design/components/popover.md`, `design/components/hover-card.md` (interest, and why a link
press closes), `design/components/collapsible.md` and `design/components/menu.md` (what this
component is not), `docs/research/popover-anchor-tooltip.md`,
`docs/research/invoker-aria-expanded.md`, the implemented `packages/ui/src/popover/*` and
`packages/ui/src/internal/overlay/*`, the WAI-ARIA APG Disclosure Navigation Menu example, prior
art (Radix and Base UI NavigationMenu, Ark UI, Headless UI Popover Group), and working notes in
`memo/architect/menubar-navmenu-notes.md`.

A NavigationMenu is a site's main navigation: a row of links, some of which are buttons that
open a panel of more links. It is the **disclosure** pattern, not a menu: no `menu` or
`menuitem` roles, no arrow-key model, Tab moves through everything. (An application menu with
commands is `design/components/menubar.md`.)

The platform does almost all of it. A `<button popovertarget>` next to a `<div popover>`
gives the toggle, the expanded state for assistive technology, the top layer, Escape, light
dismiss, one open panel at a time, focus return and a sensible Tab order, **with no JavaScript**.
So the default NavigationMenu is JS-free: links in the server HTML, working before and without
hydration. The library adds structure, placement, two small closes after hydration, and, when
asked, the Async React half: a panel whose content loads on open.

## Decisions at a glance

| # | Topic | Decision |
| --- | --- | --- |
| 1 | Anatomy | `NavigationMenu.Root` (`nav`), `List` (`ul`), `Item` (`li`; owns one flyout's open state), `Trigger` (`button[popovertarget]`), `Popup` (`div[popover=auto]`), `Link` (`a`). From `@funstack/ui/navigation-menu`. No Portal, Positioner, Viewport, Indicator, Arrow, Content or Sub. |
| 2 | Pattern | APG disclosure navigation: buttons that show and hide panels of links. No ARIA menu roles anywhere. |
| 3 | Open state | Per `Item`, Popover's model unchanged. **JS-free mode** (an Item with none of `open` / `defaultOpen` / `openChangeAction` / `onOpenChange`): the browser owns everything, content always mounted. **Library mode**: opening and part-initiated closes are requests through `openChangeAction`; dismissals are facts through `onOpenChange`. No state on the Root. |
| 4 | One at a time | The platform: sibling `popover="auto"` elements close each other. Opening another Item's panel is a dismissal of the open one. |
| 5 | Opens on | A click on the Trigger (Enter, Space). Not on hover in v1. |
| 6 | Closes on | Trigger toggle, Escape, a press outside, another panel opening (all Popover's), plus two of this component's: **focus leaving the Item**, and **a followed `Link` inside the Popup**. |
| 7 | Keyboard | Native only: Tab / Shift+Tab through Triggers, links and open panels in DOM order; Enter / Space on a Trigger; Escape. No arrow keys in v1. |
| 8 | Focus | Opening moves no focus (a `<div popover>` has no focusing steps to run). Tab from the Trigger enters the open panel because the Popup follows it in the DOM. Escape returns focus to the Trigger. |
| 9 | ARIA | `nav` named by the consumer; `ul` with an explicit `role="list"`; Trigger with no `aria-expanded` (the browser exposes the popover's state on its invoker); Popup with no role; the current page marked with the consumer's `aria-current="page"` on a link. |
| 10 | Content | JS-free mode: always mounted (in the HTML). Library mode: unmounted while closed, `keepMounted` for a hidden `<Activity>`; content that suspends holds the open with `data-pending` on the Trigger. |
| 11 | Positioning | `side` (`"bottom"`) and `align` (`"start"`) on Popup, the shared matrix and resolved `data-side` / `data-align` (conventions 13). `side={null}` for a full-width panel placed by the stylesheet. |
| 12 | Animation | CSS for every open in JS-free mode and for dismissals; `transition` on Popup (library mode) animates library-driven opens and closes with `<ViewTransition>`. |
| 13 | Directives | `Item`, `Trigger`, `Popup`, `Link` are `"use client"` files; `Root` and `List` are directive-free. Every prop is serialisable. |
| 14 | Not in v1 | Open on hover, arrow keys, a shared viewport that morphs between panels, an indicator, nested flyouts, a Root-level `value`. |

---

## 1. Anatomy

```tsx
import { NavigationMenu } from "@funstack/ui/navigation-menu";

// A Server Component. No props that select library mode: this navigation needs no JavaScript.
<NavigationMenu.Root aria-label="Main">                          {/* nav */}
  <NavigationMenu.List>                                          {/* ul[role=list] */}
    <NavigationMenu.Item>                                        {/* li; one flyout */}
      <NavigationMenu.Trigger>Products</NavigationMenu.Trigger>  {/* button[popovertarget] */}
      <NavigationMenu.Popup>                                     {/* div[popover=auto] */}
        <ul>
          <li><NavigationMenu.Link href="/analytics">Analytics</NavigationMenu.Link></li>
          <li><NavigationMenu.Link href="/billing">Billing</NavigationMenu.Link></li>
        </ul>
      </NavigationMenu.Popup>
    </NavigationMenu.Item>
    <NavigationMenu.Item>
      <NavigationMenu.Link href="/pricing" aria-current="page">Pricing</NavigationMenu.Link>
    </NavigationMenu.Item>
  </NavigationMenu.List>
</NavigationMenu.Root>
```

Rendered HTML (JS-free mode; the id comes from one `useId` per Item):

```html
<nav aria-label="Main">
  <ul role="list">
    <li>
      <button type="button" popovertarget="_r_1_">Products</button>
      <div id="_r_1_" popover="auto" data-side="bottom" data-align="start"
           style="position-area: bottom span-self-x-end; position-try-fallbacks: flip-block, flip-inline, flip-block flip-inline">
        <ul>
          <li><a href="/analytics">Analytics</a></li>
          <li><a href="/billing">Billing</a></li>
        </ul>
      </div>
    </li>
    <li><a href="/pricing" aria-current="page">Pricing</a></li>
  </ul>
</nav>
```

| Part | Element | Library state rendered | Notes |
| --- | --- | --- | --- |
| `Root` | `nav` | none | Structure only. Name it (`aria-label`) when the page has more than one `nav`. |
| `List` | `ul` | none | Renders `role="list"`, so the list semantics survive `list-style: none` in Safari. |
| `Item` | `li` | `data-open` (optimistic) and `data-pending` in library mode, with `state.open` / `state.pending` (the owner carries its state as attributes, as `Accordion.Item` and `Collapsible.Root` do; conventions 4.1, 4.3). JS-free mode: neither attribute, `state.open` `false` (style with `:has(:popover-open)`) | The owner of one flyout: `useId`, the open state (`usePopoverRoot`), the focus-leave rule. An Item with only a `Link` in it is a plain `li`. |
| `Trigger` | `button` | `data-open` (optimistic in library mode; DOM-synced from `toggle` in JS-free mode), `data-pending` (library mode), `data-disabled` | `usePopoverTrigger`: `popovertarget`, no `aria-expanded`. |
| `Popup` | `div` | `data-side`, `data-align` (resolved while shown); no `data-open` (`:popover-open`) | `usePopoverPopup`: `id`, `popover="auto"`, inline placement. No role. Children from committed state in library mode. |
| `Link` | `a` | none | Inside a Popup, following it closes the panel (section 4). Anywhere else it is a plain `a`. `render` substitutes a router link. |

Why these parts:

- **`Item` is the owner, and it is the `li`.** A flyout needs one owner for its id and state,
  and the conventions let a Root-like owner be the structural element itself (Collapsible's
  Root is the `<details>`). The `li` is also the element the focus-leave rule needs: it contains
  the Trigger and the Popup and nothing else.
- **No state on `Root`.** Radix and Base UI keep `value` (which item is open) on the Root and
  move one shared viewport between items. Here the platform keeps the panels exclusive, each
  panel is its own top-layer element anchored to its own Trigger, and per-Item state is exactly
  Popover's, so the open props, the two modes and the requests-and-facts table need no new
  rules. Cost: no single prop says "which panel is open", and no one-commit switch between
  panels to animate (section 9).
- **`Root` and `List` add only structure.** They are kept because the structure is the
  accessibility of this pattern (`nav` > list > items), because `List` fixes a real engine quirk,
  and because the features left for later (arrow keys, hover with a shared delay) need them as
  owners; adding them later would change every call site.
- **`Popup` is a `div` with no role**, not Popover's `<dialog role="dialog">`: the APG
  disclosure pattern has a plain region, a `<div popover>` runs no focusing steps (focus stays
  on the Trigger, which is what a disclosure does), and a dialog announcement on a list of links
  is noise. A consumer who wants a landmark-like name passes `aria-label` and a `role`.
- **No `Close`, `Title`, `Description`**: the Trigger toggles and names the panel.
- **Not `<details name>`** (the Accordion's base): exclusive and JS-free too, but it has no top
  layer, no light dismiss and no Escape, and a navigation panel must not push the page down.
- **Not Menu parts.** A menu traps Tab, moves focus on open, needs JS for its baseline, and
  announces links as menu items. The APG recommends the disclosure pattern for site navigation
  for these reasons.

The Popup must be rendered **immediately after the Trigger**, inside the same `Item`: Safari
puts a popover after its invoker in the Tab order only when it is adjacent (hover-card.md 1.1).
Development warning otherwise. One Trigger and one Popup per Item.

---

## 2. The two modes

Selected per Item by Popover's rule (conventions 3.9.11), fixed at mount.

| | JS-free mode (default) | Library mode |
| --- | --- | --- |
| Selected by | none of `open`, `defaultOpen`, `openChangeAction`, `onOpenChange` | any of them |
| Toggle | the browser, through `popovertarget` | Trigger click intercepted; `openChangeAction(next)` awaited in the Item's transition; `showPopover({ source })` / `hidePopover()` in the apply effect |
| Content | always mounted, in the server HTML | from committed state: mounted on open, unmounted after the close (`keepMounted`: hidden `<Activity>`) |
| Works before hydration | completely | the Trigger opens an empty panel; mount reconciliation fills it (popover.md 2.4) |
| Pending UI | none (nothing is awaited) | `data-pending` on the Trigger; optimistic `data-open` |
| Animation | CSS | CSS, or `<ViewTransition>` with `transition` |

**Use JS-free mode for a site's navigation.** The links are in the HTML (crawlers, find-in-page
after opening, no layout shift at hydration), and nothing can fail. Library mode is for a panel
whose content is worth loading late (a "Recently viewed" panel, an account panel) or whose
open state the app needs to know.

```tsx
// Library mode: the panel's content loads on first open.
<NavigationMenu.Item openChangeAction={(open) => { if (open) preloadRecent(); }}>
  <NavigationMenu.Trigger>Recent</NavigationMenu.Trigger>
  <NavigationMenu.Popup>
    <RecentPages />                 {/* use(recent): the Trigger is data-pending until it resolves */}
  </NavigationMenu.Popup>
</NavigationMenu.Item>
```

The two modes can be mixed in one navigation: each Item decides for itself, and the platform
keeps them exclusive either way.

---

## 3. Open and close

### 3.1 Opening

A click on the Trigger (Enter and Space are the native click). Nothing else opens a panel in v1:
no hover, no focus, no arrow key.

Why not hover: the APG disclosure pattern is click-only; touch has no
hover, so every panel must open on a press anyway; a button that opens on hover **and** toggles
on click closes the panel under a user who hovers and then clicks (the libraries that do both
add a timed "ignore the click" window); and HTML's guidance for interest invokers is that one
element should not show the same rich target on interest and on activation (popover.md 2.9).
The hover-first component in this library is HoverCard, whose trigger's click belongs to the
link.

### 3.2 Closing

| Close | Owner | What happens | `reason` (library mode) |
| --- | --- | --- | --- |
| Trigger click while open | library mode: library; JS-free: browser | Popover 2.3: `openChangeAction(false)` awaited with the panel still shown, then `hidePopover()` in the commit | `"activate"`, request |
| A followed `Link` inside the Popup | library | section 4 | `"activate"`, request |
| Escape | browser | focus returns to the Trigger | `"dismiss"`, fact |
| A press outside | browser | light dismiss | `"dismiss"`, fact |
| Another Item's panel (or any other `auto` popover) opening | browser | the platform hides this one | `"dismiss"`, fact |
| **Focus leaving the Item** | library-initiated, browser-shaped | below | `"dismiss"`, fact |
| Controlled `open={false}` | library | apply effect | none |

**Focus leaving the Item.** The `li` listens to `focusout`. When `relatedTarget` is an element
outside the Item, a shown Popup is hidden at once with `hidePopover()`; in library mode an open
that is still pending is superseded with `requestClose(event, "dismiss")`. A null
`relatedTarget` (window blur, a removed element) closes nothing. This is Menu's Tab rule
(menu.md 2.2) on a different container. Without it, a keyboard user who tabs past the last link
of a panel leaves it open over the page, and the next focused element may sit under it.

The rule needs the hydrated component. Before hydration, and on a page that never hydrates, a
panel stays open until Escape, a press outside or another panel; nothing is lost but tidiness.
It runs in both modes: in JS-free mode it is a DOM-level `hidePopover()` that no React state
hears about, like the `data-open` write (conventions 7.4).

In library mode the fact's `details.event` is the `focusout` `FocusEvent` that caused the hide
(its `relatedTarget` says where focus went), not the `toggle`, as HoverCard reports the event
that began a library-initiated dismissal (hover-card.md 2.5).

**A press on a foreign invoker is not a focus-out.** A consumer's own button outside the Item
that names the panel (`popovertarget`, or `commandfor` with a popover command) would take focus
on `mousedown` in Chromium and Firefox, and this rule would hide the panel before the button's
click toggled it, showing it again. While shown, the Popup installs Menu's guard (menu.md 2.2,
#126): the primary `mousedown` on such a button is prevented, so the press moves no focus and
the button's own toggle is the one close, reported as `"activate"`.

### 3.3 Requests and facts (library mode)

Popover's table (popover.md 2.8) applies to each Item. This component's rows:

| Cause | Channel | `next` | `reason` |
| --- | --- | --- | --- |
| Trigger click while closed; a foreign open | `openChangeAction` | `true` | `"activate"` |
| Trigger click while open | `openChangeAction` | `false` | `"activate"` |
| A followed Link inside the Popup | `openChangeAction` | `false` | `"activate"` |
| Focus leaving the Item while the open is pending | `openChangeAction` | `false` | `"dismiss"` |
| Focus leaving the Item while shown | **`onOpenChange`** | `false` | `"dismiss"` |
| Escape, a press outside, another panel opening | **`onOpenChange`** | `false` | `"dismiss"` |
| Found open at hydration | `openChangeAction` | `true` | `"platform"` |

A controlled Item needs `onOpenChange`, as every controlled overlay (conventions 3.9.13).

---

## 4. Links

```tsx
<NavigationMenu.Link href="/pricing" aria-current="page">Pricing</NavigationMenu.Link>
<NavigationMenu.Link render={<Link to="/analytics" />}>Analytics</NavigationMenu.Link>
```

`NavigationMenu.Link` renders an `<a>` and passes every anchor prop through.

- **Following a Link inside a Popup closes the panel.** On a `click` with the primary button and
  no modifier key, the Link closes its Item's panel: in library mode `requestClose(event,
  "activate")` (awaited, a transition, `<ViewTransition>` if set); in JS-free mode
  `hidePopover()`. A modified click (new tab, new window, download) leaves the panel open, so
  several links can be opened from it.
- The rule reads the click and nothing else. `defaultPrevented` is not consulted: a router's
  link prevents the default precisely when it navigates. Nor is `target` or `download`: a
  `target="_blank"` Link closes the panel as well (the user has chosen, and resolving the
  effective browsing context is not worth a rule); `closeOnActivate={false}` keeps it open.
- Why: with a client-side router the navigation keeps the `nav` mounted, and a click inside a
  popover is not a light dismiss, so the panel would stay open over the new page. A full page
  load makes the close moot. This is HoverCard's reasoning for a press on its link (hover-card.md
  2.4): the user has chosen the destination.
- `closeOnActivate={false}` opts a Link out (a link that changes something inside the panel).
  The prop name is Menu's.
- The close is attached with `addEventListener` through the ref, so `onClick` is not an owned
  key and a consumer's or a router's own click handling runs untouched (as HoverCard's Trigger).
- When the panel closes, the platform returns focus from the Link to the Trigger; where focus
  goes after the navigation is the router's business.
- **A Link outside a Popup** (a top-level entry) does nothing beyond rendering the `<a>`. It may
  be a plain `<a>` or the router's link; the part is offered there so a navigation reads
  uniformly.
- **The current page** is marked by the consumer with `aria-current="page"`, a native attribute
  that passes through and that `[aria-current="page"]` styles. The library adds no `current`
  prop and no `data-current`: it does not know the URL, and a second spelling of a native
  attribute is what conventions 7.4 avoids. A router's link component that sets `aria-current`
  itself works through `render`.

---

## 5. Keyboard and focus

| Key | Where | Behaviour | Who |
| --- | --- | --- | --- |
| Tab / Shift+Tab | anywhere | the document's order: Trigger, then its open panel's links, then the next top-level entry | browser |
| Enter, Space | Trigger | toggle the panel | browser (library mode: intercepted click) |
| Enter | Link | follow it | browser |
| Escape | Trigger or panel, panel open | close; focus on the Trigger | browser |

- **Opening moves no focus.** The user who pressed Enter on "Products" is still on "Products";
  Tab enters the panel. There is no `initialFocus` prop.
- **Tab order** relies on the Popup following its Trigger in the DOM: every engine then puts the
  popover's content right after its invoker. Tab from the last link of a panel moves to the next
  top-level entry, and the focus-leave rule closes the panel behind it.
- **Focus return**: the platform's for Escape. Popover's fallback (popover.md 6.2: focus was
  inside and the platform left it on `<body>`) is kept through the shared hook; it matters in
  WebKit, where a clicked button was never focused.
- **No arrow keys.** The APG example adds optional arrow-key movement between the top-level
  buttons; v1 leaves it out so that the keyboard behaviour is identical before and after
  hydration.

---

## 6. Props and types

```ts
export interface NavigationMenuOpenChangeDetails extends ActionDetails {
  /** "activate": the Trigger, a followed Link, a foreign invoker. "dismiss": Escape, a press outside, another panel opening, focus leaving the Item, script. "platform": found open at hydration. */
  readonly reason: ChangeReason;
}

export interface NavigationMenuItemState {
  readonly open: boolean;     // optimistic, `data-open` (library mode); `false` in JS-free mode (conventions 4.1 rule 3)
  readonly pending: boolean;  // `data-pending` (library mode)
}

export interface NavigationMenuItemProps
  extends Omit<ComponentPropsWithRef<"li">, "className" | "style" | "children"> {
  open?: boolean;
  defaultOpen?: boolean;
  /** Requests: the Trigger's toggle and a followed Link's close. Awaited. May be a Server Function. */
  openChangeAction?: ChangeAction<boolean, NavigationMenuOpenChangeDetails>;
  /** Facts: the panel was dismissed. Always `false`, synchronous, not awaited. */
  onOpenChange?: UrgentChangeHandler<boolean, NavigationMenuOpenChangeDetails>;
  className?: StateValue<string | undefined, NavigationMenuItemState>;
  style?: StateValue<CSSProperties | undefined, NavigationMenuItemState>;
  children?: StateValue<ReactNode, NavigationMenuItemState>;
  render?: RenderProp<ComponentPropsWithRef<"li">, NavigationMenuItemState>;
}
```

- `NavigationMenu.Root`: `ComponentPropsWithRef<"nav">` plus `render`, and `className` /
  `style` / `children` as functions of an empty state (conventions 1.3; as `Menu.Group`).
- `NavigationMenu.List`: `ComponentPropsWithRef<"ul">` plus `render` and the same function
  props; `role` defaults to `"list"` (overridable).
- `NavigationMenu.Trigger`: `PopoverTriggerProps` / `PopoverTriggerState` unchanged (owned keys:
  `type`, `popoverTarget`, `disabled`, `onClick` in library mode, `data-open`, `data-pending`,
  `data-disabled`; `aria-expanded`, `commandfor`, `command` reserved).
- `NavigationMenu.Popup`: `ComponentPropsWithRef<"div">` minus the owned keys (`id`, `popover`,
  `data-side`, `data-align`), plus `side?: PopoverSide | null` (default `"bottom"`), `align?:
  PopoverAlign` (default `"start"`), `keepMounted?: boolean`, `transition?: ViewTransitionClass`
  (both library mode only, as Popover), `render`, and `className` / `style` / `children` as
  functions of `{ open, side, align }` (`open` committed).
- `NavigationMenu.Link`: `ComponentPropsWithRef<"a">` plus `closeOnActivate?: boolean` (default
  `true`), `render`, and the function props of an empty state. No owned keys.

An `Item`'s own `focusout` listener is attached through the ref as well, so `onBlur` is not
owned. Its owned keys are `data-open` and `data-pending`. Every part's JSDoc has its "Owned
keys" line, `Item` and `List` included (conventions 1.5).

---

## 7. ARIA

| Part | Attributes |
| --- | --- |
| Root | `<nav>` (the `navigation` landmark); the consumer's `aria-label` / `aria-labelledby` |
| List | `<ul role="list">` |
| Item | `<li>` |
| Trigger | `<button type="button" popovertarget>`; no `aria-expanded` and no `aria-controls` (conventions 7: every engine exposes the popover's shown state on its invoker; a non-button `render` gets `aria-expanded` from the shown mirror, as Popover) |
| Popup | `<div popover="auto">`, no role, no name |
| Link | `<a>`; the consumer's `aria-current="page"` on the current page's link |

Development warnings: a Popup that does not directly follow its Trigger; more than one Trigger
or Popup in an Item; a Trigger or Popup outside an Item (throws: no context); Popover's
warnings for a non-button Trigger, a controlled Item without `onOpenChange`, and `transition` /
`keepMounted` in JS-free mode.

---

## 8. Server Components, platform features

- **Directives.** `Item`, `Trigger`, `Popup` and `Link` are `"use client"` files (context for
  the id and the mode; the listeners). `Root` and `List` read no context and call no hook, so
  they are directive-free, as the standalone `Separator`. "JS-free" keeps its meaning from
  conventions 7.3: no behaviour JS runs for the interaction and the markup works before and
  without hydration; the parts are still in the client bundle.
- **Without JavaScript**: open, close, Escape, light dismiss, one panel at a time, the expanded
  state, the Tab order, placement and CSS animation all work. Missing until hydration: the
  focus-leave close and the Link close (the second only matters with a client router, which is
  not running either).
- **Popover API** (`popover="auto"`, `popovertarget`): the whole open model. **CSS Anchor
  Positioning**: the implicit anchor from the invoker; `side` / `align` through the shared
  helper. **`@starting-style` / `allow-discrete`**: the enter and exit.
- **`interestfor`**: not used. It is Chromium-only, and it would put an interest relation and
  an activation relation to the same target on one button (3.1).
- **Forms**: none. A search field inside a panel is the consumer's.

---

## 9. Suspense, animation

Library mode follows Popover 4 and 5 unchanged:

1. **Open, content loads.** Click "Recent" → the Item's transition: Trigger `data-open`
   (optimistic), `data-pending`; `openChangeAction(true)` awaited; `<RecentPages>` suspends:
   the open is held and any panel already open stays open. Data arrives → commit →
   `showPopover({ source: trigger })`; the platform hides the other panel (its Item hears a
   `"dismiss"` fact, or nothing in JS-free mode).
2. **The user tabs away meanwhile.** Focus leaves the Item → the pending open is superseded;
   the panel never appears.
3. **A Link is followed, with a client-side router.** The close and the navigation are two
   commits. The Link's `click` requests the close: the Item's transition awaits
   `openChangeAction(false)` and commits as soon as it settles, the panel hides in that commit
   (with `transition` set, in a view transition of its own), and focus returns to the Trigger.
   The new page commits whenever it is ready, in the router's transition, with its own view
   transition if the page has one. **The panel does not wait for the new page**, and nothing
   in the library ties the two together. Measured with FUNSTACK Router 1.6.0 and a route that
   suspends for 800 ms, in Chromium and Firefox: the close commits 50 to 100 ms after the
   click, the route about 800 ms later. Two limits of that measurement:
   - It holds for a router that updates its location in a transition of its own after an
     `await` (FUNSTACK Router does). An `openChangeAction(false)` that is still pending when
     the router starts that transition may be entangled with it by React, and the panel would
     then stay until the page is ready; not measured, and not a behaviour to rely on.
   - **Transition types may land on the close commit.** `addTransitionType` applies to the next
     transition that commits, whoever started it. A router that adds its type before its own
     update is scheduled (FUNSTACK Router 1.6.0 adds `navigation` before an `await`) can
     therefore have the type consumed by the panel's close, which commits first; the page's
     commit then carries no type. Seen in Chromium in every run and in Firefox in half of
     them. The library cannot prevent it (the type is added to React's global pending set
     before the close commits); the docs page says so, and a Popup `transition` map keyed on
     `fsui-navigation-menu-close` is unaffected by the extra type.

   In JS-free mode the Link hides the panel in the click itself.
4. **`openChangeAction` rejects**: the error reaches the nearest Error Boundary above the Item;
   the panel keeps its previous state (conventions 2.4).

In JS-free mode nothing suspends on open: the content is part of the page and streams with it.

Animation:

```css
.nav-panel { opacity: 0; translate: 0 -4px; transition: opacity .15s, translate .15s, display .15s allow-discrete, overlay .15s allow-discrete; }
.nav-panel:popover-open { opacity: 1; translate: 0; }
@starting-style { .nav-panel:popover-open { opacity: 0; translate: 0 -4px; } }
.nav-trigger[data-open] { color: var(--accent); }                   /* after hydration */
.nav-trigger:has(+ :popover-open) { color: var(--accent); }         /* without JavaScript */
[aria-current="page"] { font-weight: 600; }
```

`transition` on a library-mode Popup wraps the `<div popover>` in a `<ViewTransition>` and
animates library-driven opens and closes (Trigger toggle, a followed Link, controlled changes)
in every engine; dismissals use CSS. Types: `fsui-navigation-menu`,
`fsui-navigation-menu-open`, `fsui-navigation-menu-close`.

Moving from one panel to another is two changes on two owners (a dismissal, then an open), so
there is no single commit in which one panel could morph into the other. That effect needs a
Root-level owner and is out of v1.

A full-width panel: `side={null}` and the stylesheet (`position: fixed; inset-inline: 0; top:
anchor(bottom)`); the implicit anchor still applies. On small screens the usual answer is a
different component around the same links (a Drawer or a Collapsible); the docs show one recipe.

---

## 10. Not in v1

- **Open on hover** (3.1).
- **Arrow keys** between top-level entries, Home / End (optional in the APG).
- **A shared viewport** that resizes between panels, an **indicator** under the active Trigger,
  an **arrow**: all need a Root-level owner.
- **Nested flyouts** (a panel inside a panel). A nested Item would work as a nested auto
  popover, but the focus-leave rule and placement defaults are not designed for it.
- **A Root-level `value`** / `valueChangeAction` naming the open Item.
- **A `current` prop** on Link (section 4).

---

## 11. Test plan

Step 1 (a Link's close and a router transition) was run at implementation; its result is
walkthrough 3 of section 9. The plan and the results are in `design/CHANGELOG.md` (the #170
entries). Not part of the contract.
