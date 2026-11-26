# HoverCard

Status: **proposed** (#166, part of #162). Not implemented. History and the questions still
open for the user: `design/CHANGELOG.md`, entry "hover-card.md". Follows
`design/conventions.md`; where this document and the conventions disagree, the conventions win.
**Read `design/components/popover.md` first** (library mode, the apply effect, requests and
facts, 2.9 on interest invokers), then `design/components/tooltip.md` (the hover / focus timers,
the two flags). This document repeats only what differs.

Inputs: `docs/vision.md`, `design/conventions.md`, `design/overlay-open-state.md`,
`docs/research/wave23-hovercard-select-multiple.md` part 1 (primary),
`docs/research/popover-anchor-tooltip.md`, the implemented `packages/ui/src/popover/*`,
`packages/ui/src/tooltip/*` and `packages/ui/src/internal/overlay/*`, the probe
`memo/architect/probes-166/interest-rules.mjs` (Chromium 156), prior art (Radix HoverCard,
Base UI PreviewCard, Ark UI HoverCard, GitHub hovercards), and working notes in
`memo/architect/hovercard-notes.md`.

A HoverCard is a rich preview that appears when the user shows **interest** in a link: the
pointer rests on it, or keyboard focus does. Unlike a Tooltip the card may hold links and
buttons, and it is not the trigger's name or description. Unlike a Popover nothing is clicked
to open it, and opening never moves focus.

It is the component where Async React pays most visibly. Showing interest starts a transition:
`openChangeAction(true)` is awaited, the content mounts inside that transition, and a card whose
content suspends appears when it is ready, with the Trigger `data-pending` meanwhile. If the
user moves on before the data arrives, the open is superseded and the card never appears. A
list of fifty mentions renders fifty empty popovers and fetches nothing until one is hovered.

## Decisions at a glance

| # | Topic | Decision |
| --- | --- | --- |
| 1 | Name | `HoverCard`, from `@funstack/ui/hover-card` (section 1.3). |
| 2 | Anatomy | `HoverCard.Root` (no DOM), `HoverCard.Trigger` (`a`), `HoverCard.Popup` (`div[popover]`, rendered right after the Trigger). No Portal, Positioner, Arrow, Close, Title or Description. |
| 3 | Open state | One mode, Popover's library mode: opening is a **request** (`openChangeAction(true)`, a transition, content from committed state, `showPopover({ source })` in the apply effect). **Every close the user causes is a fact** (`onOpenChange(false)`, urgent): lost interest, Escape, a press outside. No JS-free mode. |
| 4 | Mechanisms | Baseline: JS interest tracking (hover and `:focus-visible` focus with delays). Flag: `HoverCard.Trigger experimental_interestFor` lets Chromium decide when interest starts and ends; everything after that is the same code. |
| 5 | Popover type | `popover="manual"`; `HoverCard.Popup experimental_hint` renders `popover="hint"`. Never `auto`: hovering a link must not close the user's open menu. |
| 6 | Interest rule | The latest event wins, as in Tooltip and as Chromium does natively: any leave (the pointer leaving Trigger or Popup, focus leaving both) starts the close delay; any enter cancels it. |
| 7 | Delays | `delay` 600 ms, `closeDelay` 300 ms on Root; the same for hover and focus. |
| 8 | Trigger | A link by default. A button is allowed if its click does not open the card or anything like it. A press on the Trigger closes the card and cancels a coming open. |
| 9 | Keyboard | Tab from the Trigger goes **into** the open card, because the Popup follows the Trigger in the DOM. The library never removes the card's content from the Tab order. Escape closes. |
| 10 | Focus | Opening never moves focus. Focus returns to the Trigger only after Escape with focus inside the card, and that return does not re-open it. |
| 11 | ARIA | Trigger: nothing (`aria-describedby`, `aria-expanded`, `aria-haspopup` and `aria-details` are not rendered). Popup: `role="group"` as an overridable default. |
| 12 | Touch | Nothing on the JS path: a tap follows the link. Chromium's long-press arrives with the flag. Content must be supplementary. |
| 13 | Content | Unmounted while closed; `keepMounted` keeps it in a hidden `<Activity>`. Content that suspends holds the open. |
| 14 | Positioning | `side` (`"bottom"`) and `align` (`"center"`), the shared matrix and resolved `data-side` / `data-align` (conventions 13). |
| 15 | Animation | CSS for every close (they are facts) and by default for the open. `transition` on Popup animates the opening commit, content swaps and a controlled close. |
| 16 | `whilePending` | Not offered. No part of a HoverCard runs an action of its own; overlapping opens and cancels resolve by latest intent. |
| 17 | Directives | Every part file is `"use client"`. All props are serialisable, so a Server Component can render the parts and pass a Server Function as `openChangeAction`. |

---

## 1. Anatomy

```tsx
import { HoverCard } from "@funstack/ui/hover-card";

<HoverCard.Root>                                          {/* no DOM; ids, state, timers */}
  <HoverCard.Trigger href="/u/ada">@ada</HoverCard.Trigger>   {/* a */}
  <HoverCard.Popup>                                       {/* div[popover=manual] */}
    <UserPreview login="ada" />                           {/* mounted on open; may suspend */}
  </HoverCard.Popup>
</HoverCard.Root>
```

Rendered HTML, closed and then open:

```html
<a href="/u/ada">@ada</a>
<div id="_r_1_" popover="manual" role="group" data-side="bottom" data-align="center"
     style="position-area: bottom; position-try-fallbacks: flip-block, flip-inline, flip-block flip-inline"></div>

<a href="/u/ada" data-open="">@ada</a>
<div id="_r_1_" popover="manual" role="group" data-side="bottom" data-align="center" style="…">
  <img src="/avatars/ada.png" alt="" />
  <a href="/u/ada">Ada Lovelace</a>
  <button type="button">Follow</button>
</div>
```

| Part | Element | Library state rendered | Notes |
| --- | --- | --- | --- |
| `Root` | none | `state.open` (optimistic), `state.pending`, `state.disabled` in `children(state)` | Owns `useId`, the open state (`usePopoverRoot`), `delay` / `closeDelay` / `disabled`, and the interaction effect. No `ref`, `className`, `style`. |
| `Trigger` | `a` | `data-open` (optimistic), `data-pending`, `data-disabled` | The element the user hovers or focuses. Its click is the consumer's (the link navigates). Passed as `source` to `showPopover()`, so it is the implicit anchor. |
| `Popup` | `div` | `data-side`, `data-align`; no `data-open` (`:popover-open`) | Carries `id`, `popover`, `role="group"`, the inline placement. Children render from committed state. |

No `Close` part: a card closes when interest is lost, and a close button inside a hover preview
has no prior art. No `Title` / `Description`: the default role needs no name; a consumer who
wants one passes `aria-label`. No `Arrow`: a pseudo-element keyed on the Popup's resolved
`data-side` is the recipe, as for Popover (tooltip.md 10).

One Trigger per Root. A card shared by many triggers is not in v1 (section 13).

### 1.1 Where the Popup goes

**Render the Popup immediately after the Trigger.** The keyboard model (section 6) depends on
it in every engine: Tab from the link enters the open card because the card is next in the
DOM, and Tab from the card's last control continues with whatever follows the link.

A link in running text is the most common trigger, and a `<div>` cannot follow it inside a
`<p>`. Two shapes are valid there:

```tsx
// 1. A phrasing card: the Popup is a <span> and holds only phrasing content
//    (img, a, button, strong, span; no div, p, h3, ul). Lay it out with CSS.
<p>
  Thanks{" "}
  <HoverCard.Root>
    <HoverCard.Trigger href="/u/ada">@ada</HoverCard.Trigger>
    <HoverCard.Popup render={<span />} className="card">
      <UserPreview login="ada" />   {/* spans styled as blocks */}
    </HoverCard.Popup>
  </HoverCard.Root>{" "}
  for the review.
</p>

// 2. The Popup after the block. Root renders no DOM, so the parts need not be siblings.
<HoverCard.Root>
  <p>Thanks <HoverCard.Trigger href="/u/ada">@ada</HoverCard.Trigger> for the review.</p>
  <HoverCard.Popup className="card"><UserPreview login="ada" /></HoverCard.Popup>
</HoverCard.Root>
```

Shape 1 keeps adjacency and works everywhere; it is the one to use from a component rendered
deep inside prose (a mention in rendered Markdown). Shape 2 allows block content, and
`showPopover({ source })` still puts the card after the link in the Tab order in Chromium and
Firefox; Safari does that only for an adjacent popover (popover.md 1), so there the card's
controls are not reachable by keyboard when other focusable content sits between link and card.
React's DOM nesting warning catches a `<div>` card inside a `<p>` in development.

The library never portals the card (as every overlay here: a portalled popover inside a modal
Dialog would be inert, and nested cards rely on DOM containment, 2.6).

### 1.2 Trigger element rules

`HoverCard.Trigger` renders `<a>` and passes `href` and every other anchor prop through.
`render` substitutes a router link or a button:

```tsx
<HoverCard.Trigger render={<Link to="/u/ada" />}>@ada</HoverCard.Trigger>
<HoverCard.Trigger render={<button type="button" onClick={openProfile} />}>Ada</HoverCard.Trigger>
```

- **A link, or a button whose click opens nothing of this kind.** The card is opened by
  interest only; the Trigger's click belongs to the consumer and never opens or pins the card.
  A button that should also open the same content on click is a Popover, not a HoverCard: one
  element that shows a rich target on interest and on activation is against HTML's author
  guidance for interest invokers (popover.md 2.9), and on the JS path a touch user would get
  the click behaviour only.
- The element must be focusable; an `<a>` without `href` is not. Dev warning when the mounted
  Trigger has `tabIndex < 0`.
- The flagged native path exists only for `<a href>`, `<area href>` and `<button>`
  (`"interestForElement" in element`); any other element runs the JS path under the flag.
- The library attaches its listeners with `addEventListener` from Root (as Tooltip), so no
  `on*` prop is omitted from the type and the consumer's `onPointerEnter`, `onFocus` and
  `onClick` run untouched.

### 1.3 The name

`HoverCard`, not `PreviewCard`.

- It is the name consumers look for: Radix, shadcn/ui, Ark UI and Ariakit ship a HoverCard,
  GitHub calls its feature hovercards, and the #162 survey listed the gap under that name. Only
  Base UI says PreviewCard.
- "Preview" promises a link whose destination is previewed. That is the main use, but the
  Trigger may be a button and the content is "more about this thing", not always a page
  preview.
- "Hover" is imprecise (keyboard focus opens the card too, and long-press with the flag), but
  no more than "Tooltip" is; the platform's exact word, "interest", is one nobody searches for.

---

## 2. Interest: when the card opens and closes

### 2.1 The rule

The user **shows interest** in the Trigger by resting the pointer on it (not a touch pointer)
or by moving keyboard focus to it (`:focus-visible`), for `delay` milliseconds. The user
**loses interest** when the pointer leaves the Trigger or the Popup, or when focus leaves both,
and nothing brings it back within `closeDelay`. The latest event wins: one pending open or
close at a time (the timer pair Tooltip uses).

Two consequences of "the latest event wins", both measured in Chromium's native `interestfor`
(probe `interest-rules.mjs`, rows A and C) and therefore the same on both paths:

- A card opened by keyboard focus closes when the pointer crosses it and leaves, although the
  link still has focus.
- A card whose button the user clicked (focus is now inside) closes when the pointer leaves.
  Focus is not moved by that close (section 6.2).

Gaining interest is a **request**; it can be awaited, refused and superseded. Losing it, like
every other way a user closes the card, is a **fact** (2.5).

### 2.2 The JS path (baseline, every engine)

Root's effect attaches, through `addEventListener`:

| Target | Event | Behaviour |
| --- | --- | --- |
| Trigger | `pointerenter` (not `touch`) | start the open timer (`delay`) |
| Trigger | `focus`, when the Trigger matches `:focus-visible` | start the open timer |
| Trigger | `pointerleave`, `blur` | start the close timer (`closeDelay`) |
| Trigger | `pointerdown` | close now, or cancel the coming open; no open until fresh interest (2.4) |
| Trigger | `keydown` Escape, before anything is intended | cancel the open timer |
| Popup | `pointerenter`, `focusin` | cancel the close timer |
| Popup | `pointerleave` | start the close timer. With a button held (a text selection dragged out of the card) the timer starts at the release instead |
| Popup | `focusout` to an element outside the Popup that is not the Trigger | start the close timer |
| document, while the card is intended open | `keydown` Escape | close now and `preventDefault()`, unless the event is already prevented or the Popup contains a shown popover or an open modal dialog (2.6) |
| document, capture, while the card is intended open | `pointerdown` outside the Popup | close now |

"Intended open" is `intended()` of the Root: from the dispatch of the open until a close, so
Escape and a press outside also cancel an open whose content is still loading.

What the timers do when they fire:

- **Open timer**: `requestOpen(event, "activate")` with the `pointerenter` or `focus` event
  that started it. The Root's transition runs `openChangeAction(true)`, commits, mounts the
  content, and the apply effect calls `popup.showPopover({ source: trigger })`. Skipped when
  `disabled`, when the Trigger is disconnected, or when `true` is already intended.
- **Close timer**, and "close now": a **dismissal** with the event that caused it.
  - The card is shown: the library records a `"dismiss"` close intent and calls
    `hidePopover()`. The `toggle` reports the fact (2.5). This is the immediate, browser-shaped
    hide of conventions 3.9.2, the one Menu's Tab-out and Popover's lost-interest hide use.
  - The open is still pending (dispatched, nothing shown): `requestClose(event, "dismiss")`,
    a request that supersedes the open, so the card never appears.
  - Neither: nothing.

Why hover and focus share one delay, why touch is ignored and why Escape is prevented while
the card is open: tooltip.md 2.2. The differences from Tooltip's table are the three the
research names: focus inside the card keeps it open, a press inside the card does not close it,
and the focus return after Escape does not re-open it (2.4).

### 2.3 The flagged path (`experimental_interestFor`, Chromium)

```tsx
<HoverCard.Trigger href="/u/ada" experimental_interestFor>@ada</HoverCard.Trigger>
<HoverCard.Popup experimental_hint>…</HoverCard.Popup>
```

The Trigger gets `interestfor="<popup id>"` and inline `interest-delay-start` /
`interest-delay-end` from `delay` / `closeDelay`. Where the element implements
`interestForElement`, the **browser decides when interest starts and ends**, and the library
attaches none of the Trigger and Popup hover and focus listeners of 2.2. Everything else is the
same code, because the library still owns the open:

| Step | What happens |
| --- | --- |
| Interest (hover, keyboard focus, long-press on touch) | `interest` fires on the Popup, then the platform's show is cancelled at `beforetoggle` and routed as a request (popover.md 2.2, 2.9): `requestOpen(event, "activate")`, `details.event` the `ToggleEvent` |
| Lost interest while shown | the platform fires `loseinterest` but cannot hide a popover the library re-showed, so the library hides it as a dismissal a task later (popover.md 2.9). Measured for `manual` and `hint` (probe, the "intercept" runs) |
| Lost interest while the open is pending | `requestClose(event, "dismiss")` |
| Escape, a press outside, a press on the Trigger | the library's listeners of 2.2, on this path too: a `manual` card has no close watcher, and a card opened by `defaultOpen` or a controlled `open` has no interest to lose |

Not the same as Tooltip's native path, where the library attaches nothing: a Tooltip's open
state is the browser's, a HoverCard's is the library's, so "native" here means the platform
supplies the interest signal, not the whole behaviour.

`interestfor` is **written through the Trigger's ref after hydration**, never into the server
HTML (as Combobox's Trigger writes `popovertarget`, combobox.md 3.3). A hover before hydration
would otherwise open an empty card. The inline delays are in the server HTML; they are inert
without the attribute.

What the flag adds over the JS path: long-press on touch in Chromium (a context-menu item on a
link, immediate on a button; "explicit interest", which a press outside or Escape ends), the
`:interest-source` / `:interest-target` pseudo-classes, and the platform's own accessibility
mapping (Chromium 156 exposes a `details` relation from the link to a rich card). What it
costs: Chromium-only behaviour that follows a specification still in review (whatwg/html PR
#11006); Chromium 160 changes details of it (research 1.1).

### 2.4 No open until fresh interest

After **Escape**, after **a press on the Trigger**, and after **the library returned focus to
the Trigger** (6.2), nothing opens the card until the user shows interest afresh: the pointer
leaves the Trigger and comes back, or focus leaves and returns.

- JS path: opens start only at `pointerenter` and `focus`, so Escape and a press need no state
  (as Tooltip). The focus return is the library's own `focus()` call on a Trigger that then
  matches `:focus-visible`; a one-shot flag set around the call makes that `focus` event start
  no timer.
- Flagged path: the platform may grant interest again on its own (a script `focus()` on the
  invoker does, Chromium 156, probe row B2; an interest timer that was already running when the
  user pressed the link still fires). Every open passes the library's `beforetoggle`
  interception, so the same flag is read there: a suppressed interest open is cancelled and
  dispatches nothing. The flag is cleared by the Trigger's `pointerleave` and `blur`.

A press on the Trigger closes the card because the user has chosen the destination: after a
client-side navigation that keeps the link mounted, a preview still hanging over the new page
is wrong, and so is one that appears 600 ms after the click. Chromium's native behaviour keeps
the card open on an invoker click (probe row E); the library's `pointerdown` listener applies
its own rule on both paths.

### 2.5 Requests and facts: which cause goes where

`HoverCard.Root` is an overlay Root in the sense of conventions 3.9: `openChangeAction` hears
requests, `onOpenChange` hears facts and is only ever called with `false`.

| Cause | Channel | `next` | `reason` | `details.event` |
| --- | --- | --- | --- | --- |
| Interest in the Trigger, after `delay` (JS path) | `openChangeAction` | `true` | `"activate"` | the `pointerenter` `PointerEvent` or the `focus` `FocusEvent` |
| Interest in the Trigger (flagged path) | `openChangeAction` | `true` | `"activate"` | the `beforetoggle` `ToggleEvent` (`source` is the Trigger) |
| A foreign open: script `showPopover()`, a consumer's own invoker button | `openChangeAction` | `true` | `"activate"` | the `beforetoggle` `ToggleEvent` |
| Lost interest, Escape or a press while the open is still pending | `openChangeAction` | `false` | `"dismiss"` | the `pointerleave`, `blur`, `focusout`, `loseinterest`, `keydown` or `pointerdown` event |
| Lost interest while shown | **`onOpenChange`** | `false` | `"dismiss"` | the event that began the close delay (`pointerleave`, `blur`, `focusout`; `pointerup` after a drag); `loseinterest` on the flagged path |
| Escape while shown | **`onOpenChange`** | `false` | `"dismiss"` | the `keydown` |
| A press outside the Popup while shown, the Trigger included | **`onOpenChange`** | `false` | `"dismiss"` | the `pointerdown` |
| `disabled` became true while shown | **`onOpenChange`** | `false` | `"dismiss"` | `undefined` |
| Script `hidePopover()`; with `hint`: native light dismiss, another hint or an unrelated `auto` popover opening | **`onOpenChange`** | `false` | `"dismiss"` | the `toggle` `ToggleEvent` |
| Controlled `open` changed by the parent; the re-open of a refused fact; removal from the document | none | | | |

Every close has the reason `"dismiss"`: no part of a HoverCard carries a decision to close. A
press on the Trigger is the user acting on the link, not on the card's open state. Opens are
`"activate"`, the reason Popover already gives an interest open (popover.md 2.8); `"platform"`
can occur only through the shared mount reconciliation (a consumer's own invoker pressed before
hydration).

**Why lost interest is a fact and not a held request.** Holding it would let
`openChangeAction(false)` and an exit view transition run, in Firefox too. But a transition can
be delayed by an unrelated action that is pending elsewhere in the app, and the card would stay
over the page after the user left it. Conventions 3.9.2 already classes the lost-interest hide
with Menu's Tab-out for that reason. Cost: Firefox has no exit animation for a HoverCard
(section 9), and a controlled parent cannot veto a close, only re-open (conventions 3.9.4).

### 2.6 Nesting and other top-layer elements

- **A card never closes anything by opening.** `manual` closes nothing; `hint` closes other
  hints that are not its ancestors (an open Tooltip) and leaves `auto` popovers alone.
- **Inside a modal Dialog, a Popover or a Menu**: the card is a DOM descendant of that popup
  (it follows its Trigger), so it is not inert, a press in the card is not a light dismiss of
  the outer popup, and the outer popup closing takes the card with it.
- **A HoverCard inside a card** (a link in the card with a card of its own): the inner Popup
  follows the inner Trigger, so it is a DOM descendant of the outer Popup. Pointer and focus
  moving into the inner card have not left the outer one (`pointerleave` and `focusout` follow
  the DOM, not the top layer). Any mix of types works: a `manual` card closes nothing, and a
  `hint` inside a `hint` nests through its DOM ancestor.
- **A Menu, Select picker, Popover or Tooltip opened from inside the card** keeps the card
  open (research 1.2). Its popup is a DOM descendant too.
- **Escape closes the innermost first.** The card's Escape listener stands down while its Popup
  contains a shown popover or an open modal dialog, and when the event is already prevented
  (a Tooltip inside handled it). The nested element closes; the next Escape closes the card.
- Inside a modal `<dialog>`, the card's Escape is prevented, so the dialog stays open and a
  second Escape closes it (tooltip.md 2.2).

### 2.7 Behaviour per engine and flag

Stable engines on 2026-11-26: Chrome 158, Firefox 160, Safari 27.2.

| Flags | Chromium | Firefox | Safari 27.2 |
| --- | --- | --- | --- |
| none (baseline) | `manual` + JS interest. Escape and outside press by the library. | same | same |
| `experimental_hint` | `hint`: opening closes an open Tooltip or other hint; native light dismiss and close watcher exist next to the library's listeners (the library's run first). | as Chromium | `hint` is unknown and treated as `manual`: identical to the baseline |
| `experimental_interestFor` | the platform's interest signal, long-press on touch; the rest by the library. | attribute ignored, baseline JS | attribute ignored, baseline JS |
| both | as the two rows above | as `experimental_hint` | as the baseline |

Graduation: `experimental_hint` is removed and `hint` becomes the type when Safari 27.3 is
stable (it is in the 27.3 beta), together with Tooltip's flag. `experimental_interestFor` waits
for Gecko and WebKit.

---

## 3. Props and types

### 3.1 `HoverCard.Root`

```ts
export interface HoverCardOpenChangeDetails extends ActionDetails {
  /**
   * "activate": the user showed interest in the Trigger (hover or keyboard focus held for
   * `delay`), or something else opened the card (`details.event` is a `ToggleEvent` then).
   * "dismiss": every close: lost interest, Escape, a press outside the card.
   * "platform": the card was found open on mount; `event` is undefined.
   */
  readonly reason: ChangeReason;
}

export interface HoverCardRootState {
  /** Optimistic open state. Content rendered from it must not suspend. */
  readonly open: boolean;
  /** A request (`openChangeAction`) dispatched through this HoverCard is in flight. */
  readonly pending: boolean;
  readonly disabled: boolean;
}

export interface HoverCardRootProps {
  /** Controlled open state. A controlled Root needs `onOpenChange` too (conventions 3.9.13). */
  open?: boolean;
  /** Initial open state when uncontrolled. Shown after hydration. Default `false`. */
  defaultOpen?: boolean;
  /**
   * Requests only. Awaited for `true` when the user shows interest: the card appears when it
   * resolves and the content has rendered. Called with `false` only to cancel an open that has
   * not appeared yet (the user moved on). Never called for the close of a shown card. May be a
   * Server Function. Rejections reach the nearest Error Boundary above Root.
   */
  openChangeAction?: ChangeAction<boolean, HoverCardOpenChangeDetails>;
  /**
   * Facts only: the card was closed (lost interest, Escape, a press outside). Always `false`.
   * Called synchronously, outside any Transition, not awaited. A controlled Root adopts it
   * directly (`onOpenChange={setOpen}`); a parent that keeps `open={true}` gets the card
   * re-shown.
   */
  onOpenChange?: UrgentChangeHandler<boolean, HoverCardOpenChangeDetails>;
  /** Milliseconds of interest (hover or keyboard focus) before the open is requested. Default 600. */
  delay?: number;
  /** Milliseconds from losing interest to the close. Default 300. */
  closeDelay?: number;
  /** When true, interest never opens the card, and a shown card is closed. Default `false`. */
  disabled?: boolean;
  children?: StateValue<ReactNode, HoverCardRootState>;
}
```

- Any combination of the four open props is the same mode; a Root with none of them is an
  uncontrolled Root that starts closed.
- `disabled` gates interest only. It does not make the Trigger a disabled link, and a
  controlled `open={true}` still shows the card. When it becomes true while the card is shown
  the library closes the card as a dismissal; a pending open is cancelled.
- `delay` and `closeDelay` are on Root for Tooltip's reason: both paths need them. The defaults
  are longer than Tooltip's 250 / 150 on purpose: a card is larger, loads data and, once open,
  puts its controls in the keyboard user's path (section 6.1). Radix uses 700 / 300, Base UI
  600 / 300.

### 3.2 `HoverCard.Trigger`

```ts
export interface HoverCardTriggerState {
  /** Optimistic open state. */
  readonly open: boolean;
  /** The Root's transition is pending: the card is loading. */
  readonly pending: boolean;
  readonly disabled: boolean;
}

export interface HoverCardTriggerProps
  extends Omit<ComponentPropsWithRef<"a">, "className" | "style" | "children"> {
  /**
   * Experimental (Chromium 142+). Writes `interestfor` and `interest-delay-*` so the browser
   * decides when interest starts and ends (long-press on touch included). No effect in other
   * engines, which run the JS path.
   */
  experimental_interestFor?: boolean;
  className?: StateValue<string | undefined, HoverCardTriggerState>;
  style?: StateValue<CSSProperties | undefined, HoverCardTriggerState>;
  /** Rendered from optimistic state; must not suspend. */
  children?: StateValue<ReactNode, HoverCardTriggerState>;
  /** A link (default), a router link component, or a button (1.2). */
  render?: RenderProp<ComponentPropsWithRef<"a">, HoverCardTriggerState>;
}
```

Owned keys: `data-open`, `data-pending`, `data-disabled`, and `interestfor` while the flag is
on (written through the ref, removed while `disabled`). Nothing else: no ARIA attribute, no
event prop, no `href` handling. `aria-details`, `aria-describedby` and the rest pass through.

### 3.3 `HoverCard.Popup`

```ts
export type HoverCardSide = "top" | "bottom" | "left" | "right" | "inline-start" | "inline-end";
export type HoverCardAlign = "start" | "center" | "end";

export interface HoverCardPopupState {
  /** Committed open state. Read `:popover-open` for the DOM truth. */
  readonly open: boolean;
  /** While shown: the resolved physical side (conventions 13.2). Otherwise the `side` prop. */
  readonly side: HoverCardSide | null;
  readonly align: HoverCardAlign;
}

export interface HoverCardPopupProps
  extends Omit<
    ComponentPropsWithRef<"div">,
    "id" | "popover" | "onToggle" | "onBeforeToggle" | "className" | "style" | "children"
  > {
  /** Placement relative to the Trigger. Default `"bottom"`. `null`: the stylesheet owns it. */
  side?: HoverCardSide | null;
  /** Alignment along the side. Default `"center"`. */
  align?: HoverCardAlign;
  /**
   * `false` (default): the children are not rendered while closed; mounting them is part of the
   * opening transition. `true`: rendered in `<Activity mode="hidden">` while closed.
   */
  keepMounted?: boolean;
  /**
   * Experimental (Chrome 151+, Firefox 153+; Safari 27.2 treats it as "manual"). Renders
   * `popover="hint"`: opening the card closes an open Tooltip, and the browser's light dismiss
   * applies.
   */
  experimental_hint?: boolean;
  /**
   * Forwarded to the `<ViewTransition default>` around the popover element. Animates the
   * opening commit, content changes while open and a controlled close. Closes the user causes
   * are facts and animate with CSS only (section 9).
   */
  transition?: ViewTransitionClass;
  className?: StateValue<string | undefined, HoverCardPopupState>;
  style?: StateValue<CSSProperties | undefined, HoverCardPopupState>;
  children?: StateValue<ReactNode, HoverCardPopupState>;
  /** A `<div>` (default) or a `<span>` for a card inside running text (1.1). */
  render?: RenderProp<ComponentPropsWithRef<"div">, HoverCardPopupState>;
}
```

Owned keys: `id`, `popover`, `data-side` / `data-align` (unless `side` is `null`). **Default,
not owned:** `role="group"`. No `initialFocus`: a card never takes focus on open. No
`aria-labelledby` / `aria-describedby` wiring (there are no Title and Description parts).

### 3.4 Namespace

```ts
export const HoverCard = {
  Root: HoverCardRoot,
  Trigger: HoverCardTrigger,
  Popup: HoverCardPopup,
} as const;
```

---

## 4. State model

| State | Owner | Where it shows |
| --- | --- | --- |
| `open` | Root (`useControllableAction<boolean>`). **Library-owned for opening, browser-shaped for every user close** (2.5) | optimistic: Trigger `data-open`, `state.open` on Root / Trigger; committed: the Popup's children, `state.open` on Popup; DOM: `:popover-open` |
| `pending` | Root `useTransition` | Trigger `data-pending`, `state.pending` |
| interest (the timers, "no open until fresh interest") | Root's effect; refs, never React state | nothing. A hover that ends before `delay` renders nothing |
| `held` | Popup (popover.md 4.4) | keeps the children mounted while a CSS exit runs |
| `side`, `align` | props while closed; the browser while shown (conventions 13.2) | `data-side`, `data-align`, `state.side`, `state.align` |
| `disabled` | prop | `data-disabled` on Trigger, `state.disabled` |

### 4.1 What the user sees while an open is pending

| Surface | Reads | From the dispatch until the card shows |
| --- | --- | --- |
| Trigger `data-open`, `data-pending`, `state.open` | optimistic | present, present, `true` |
| Popup visibility, `:popover-open` | DOM | closed |
| Popup children | committed | not rendered (or hidden with `keepMounted`) |
| Root `state.pending` | transition | `true` |

During `delay`, before the dispatch, nothing is rendered and nothing is pending. `data-pending`
on a link is the hook for a quiet loading hint (`cursor: progress`, a dotted underline); many
designs will leave it unstyled.

### 4.2 Overlap, errors, veto

- **Overlap.** Interest, loss and renewed interest while an action runs resolve by latest
  intent (conventions 2.5, popover.md walkthrough 11.7): `openChangeAction` may see `true`,
  `false`, `true`, and only the last dispatch commits. An action that loads data should be
  idempotent or cached. There is no `whilePending`: that prop belongs to parts that run an
  action of their own on activation (conventions 2.5.1), and a HoverCard has none.
- **A fact while a request is in flight** cannot happen for the open (nothing is shown; the
  cancel is a superseding request). A superseded action that later rejects goes to
  `reportError` (conventions 2.4).
- **`openChangeAction(true)` rejects**: the Error Boundary above Root, which takes the link
  with it. A preview that fails must not remove the link, so the docs show the two safer
  shapes: catch inside the action, or load in the content and put an Error Boundary **inside**
  the Popup (section 5).
- **`onOpenChange` throws or rejects**: `reportError`.
- **Controlled veto of an open**: snap-back of the Trigger's `data-open`; nothing appears.
- **Controlled refusal of a close**: the card is re-shown at once without moving focus
  (conventions 3.9.4). Not a veto. `open` with `onOpenChange={() => {}}` is the way to pin a
  card open while styling it.

---

## 5. Content mounting and Suspense

As popover.md 5. The children render from committed `open`, so they mount in the opening
transition and a suspending child holds the open:

```tsx
<HoverCard.Popup className="card">
  <ErrorBoundary fallback={<span>Could not load the profile.</span>}>
    <UserPreview login="ada" />   {/* use(fetchUser("ada")) */}
  </ErrorBoundary>
</HoverCard.Popup>
```

- **Wait, then open** (no Suspense boundary inside the Popup; the default recommendation): the
  card appears complete. While it loads the Trigger is `data-pending`; if the user leaves, the
  open is cancelled and no card flashes under a pointer that is gone.
- **Open with a skeleton** (a boundary inside the Popup): the card appears after `delay` with
  the fallback; the content swaps in a later transition commit, which `transition` can animate.
- **Start loading during the delay.** The Trigger's own event props pass through, so a consumer
  who wants the data to load while the 600 ms run starts it there:
  `onPointerEnter={() => preloadUser("ada")} onFocus={() => preloadUser("ada")}`.
  The library does not do this by itself: a pointer crossing a list of links would fetch for
  each of them.
- `keepMounted` pre-renders the content in a hidden `<Activity>` at low priority. For a list of
  cards this is the wrong default; it suits a single prominent card.
- Content passed from a Server Component is already rendered in the RSC payload. To fetch on
  interest from a server-rendered page, the content is a Client Component that reads a promise
  or a cache.

The card's content must be **supplementary** (section 7): everything in it has to be reachable
without it, normally on the link's destination.

---

## 6. Focus and keyboard

### 6.1 Keyboard

| Key | Behaviour |
| --- | --- |
| Tab to the Trigger | the card opens after `delay` when focus is `:focus-visible`; focus stays on the Trigger |
| Tab, card open | focus moves **into the card**, to its first focusable element; with no focusable content, to whatever follows |
| Tab from the card's last element | focus moves to what follows the card; the card closes after `closeDelay` |
| Shift+Tab from the card's first element | back to the Trigger; the card stays open |
| Tab before `delay` has passed | the open is cancelled; focus moves on |
| Escape | closes the card (or cancels the coming one). With focus inside the card, focus returns to the Trigger and the card does not re-open (2.4) |
| Enter on the Trigger | the link's own activation; the library does nothing |

This is the platform's model (Chromium's `interestfor`, research 1.2), not Radix's, which
removes every control in the card from the Tab order and leaves keyboard users with a card they
can see and not use. The cost is real and documented: a keyboard user who pauses on a link
longer than `delay` has the card's controls in the way of the next link. That is why the
default `delay` is long, why Escape is cheap (focus stays put), and why a card with many
controls is the wrong component: content the user works in belongs in a Popover that a click
opens.

### 6.2 Focus

- **Opening never moves focus.** The Popup is not a `<dialog>`, so no focusing steps choose a
  target, and the library shows it `inert` for the duration of the `showPopover()` call (the
  mechanism of a refused re-open, popover.md 6.1), so an `autofocus` somewhere in the content
  cannot pull focus on hover either. HTML's guidance for interest targets says the same.
- **Escape with focus inside the card** returns focus to the Trigger (popover.md 6.2 rule 2;
  a `manual` popover restores nothing by itself, a `hint` restores the previously focused
  element). That `focus` does not count as interest (2.4).
- **Lost interest and a press outside never focus the Trigger.** If focus was inside the card
  (the user clicked a button in it and moved the pointer away), the browser's focus fixup
  leaves it on `<body>`; a press outside puts focus where the press lands. Focusing the Trigger
  here would re-grant interest on the flagged path and scroll a link into view that the user
  has left.
- No trapping. Tab leaves the card freely.

---

## 7. Accessibility

| | |
| --- | --- |
| Trigger | no library ARIA. Not `aria-describedby` (the card is not the link's description, and a rich card read as one string is noise). Not `aria-expanded` or `aria-haspopup` (a link that announces "collapsed" on every mention; ARIA's interest mapping is not settled, w3c/aria #2617, and Chromium does not expose it). Not `aria-details`: with the Popup next in the DOM the reading order already carries the relation, which is why HTML-AAM drops the relation for an adjacent `popovertarget` popover |
| Popup | `role="group"` by default: HTML-AAM's minimum role for a popover, which WebKit does not apply by itself. A card with real actions may pass `role="dialog"` with an `aria-label` (exposed as a non-modal dialog, research 1.2) |
| Screen readers | nothing is announced when the card appears. In browse mode the open card is the next content after the link |
| WCAG 1.4.13 | dismissible (Escape, without moving pointer or focus), hoverable (the pointer may move into the card; `closeDelay` covers the gap), persistent (until interest is lost) |

**Supplementary content only.** A touch user never sees the card on the JS path, a screen
reader user may never open it, and a keyboard user may Tab past before `delay`. Whatever the
card offers, the action buttons included, must also exist where the link leads. The docs say
this first.

Development warnings (once per instance): the mounted Trigger is not focusable; a controlled
Root without `onOpenChange` (conventions 3.9.13); a Popup or Trigger mounted without a Root
(throws).

**Touch.** The JS path ignores `pointerType === "touch"`, and a tap moves focus without
`:focus-visible`, so nothing opens and the link is followed. No library long-press: it would
fight the link's native context menu and differ from the platform's explicit interest. On the
flagged path Chromium offers the card from the long-press menu. `::interest-button`, the
platform's tap affordance, is not shipped anywhere (research 1.1).

---

## 8. Positioning

As popover.md 8: `side` (default `"bottom"`) and `align` (default `"center"`) set inline
`position-area` and `position-try-fallbacks` from the shared matrix (conventions 13.1); the
implicit anchor is the Trigger, from `showPopover({ source })`; `data-side` / `data-align` and
`state.side` / `state.align` are the resolved placement while shown (conventions 13.2);
`side={null}` hands placement to the stylesheet.

A link that wraps over two lines is one anchor box spanning both lines; the card is placed
against that box. Nothing in v1 anchors to the hovered line.

The gap between link and card is the consumer's `margin`. The pointer has `closeDelay` to
cross it; a wide gap needs a bridge:

```css
.card { margin: 6px; }
/* Optional: extend the card's hit area over the gap, on the side that faces the link. */
.card[data-side="bottom"]::before { content: ""; position: absolute; inset: -6px 0 auto; height: 6px; }
.card[data-side="top"]::before { content: ""; position: absolute; inset: auto 0 -6px; height: 6px; }
```

---

## 9. Styling, animation, ViewTransition

The library ships no CSS.

```css
.mention[data-open] { text-decoration-thickness: 2px; }   /* optimistic: from the dispatch */
.mention[data-pending] { cursor: progress; }              /* the card is loading */
.card {
  margin: 6px; inset: auto; padding: 12px; border: 1px solid; border-radius: 8px;
  opacity: 0;
  transition: opacity 120ms, display 120ms allow-discrete, overlay 120ms allow-discrete;
}
.card:popover-open { opacity: 1; }
@starting-style { .card:popover-open { opacity: 0; } }
@media (prefers-reduced-motion: reduce) { .card { transition: none; } }
```

| Change | Lane | `<ViewTransition>` | Animate with |
| --- | --- | --- | --- |
| Trigger `data-open` / `data-pending` on the dispatch, and their snap-back | sync (optimistic) | never | CSS on the attributes |
| Opening commit: children mount, `showPopover()` in the layout effect | transition, `fsui-hover-card`, `fsui-hover-card-open` | yes, with `transition` | the CSS enter above, **or** `transition`; the library cuts the CSS transition around its own show when both exist (conventions 5.1) |
| Content swap while open (a Suspense boundary inside the Popup resolving) | transition | yes, with `transition` | `transition` |
| Every user close: lost interest, Escape, press outside | urgent (a fact) | **never** | the CSS exit; none in Firefox (tooltip.md 8) |
| Controlled `open={false}` set by the parent in a transition | the parent's transition | yes, with `transition` | `transition` |
| The cancel of a pending open | transition, `fsui-hover-card`, `fsui-hover-card-close` | nothing visible changes | nothing |

CSS is the recommended animation for a HoverCard, because every close a user causes is a fact
and only CSS animates those. `transition` earns its place for the skeleton-to-content swap and
for consumers who drive `open` themselves. Any `transition` value has the mount cost of
conventions 5.1; a plain open pays none, because the children mount under the always-mounted
popover element.

---

## 10. Async walkthroughs

Notation: `C` committed, `O` optimistic, `P` pending. Uncontrolled, JS path, `manual`, no
`transition`.

1. **Hover, content suspends, card appears.** `pointerenter` on the link: open timer. 600 ms
   later: `requestOpen` → `O=true`, `P=true`; the link shows `data-open`, `data-pending`.
   `openChangeAction(true)` resolves → the commit renders `<UserPreview>`, which suspends → React
   holds the transition. Data arrives → commit: `C=true`, children in the DOM; the apply effect
   shows the popup (`inert` for the call, `source` the link): anchored below the link, focus
   untouched. `P=false`.
2. **The user leaves while it loads.** As 1 until the suspend. `pointerleave`: close timer.
   300 ms later nothing is shown and `true` is intended → `requestClose(event, "dismiss")`:
   `O=false`; `openChangeAction(false, { reason: "dismiss" })` runs; the open dispatch is
   superseded and commits nothing. The data may still arrive and stay in the consumer's cache;
   no card appears. `onOpenChange` is not called: nothing was shown.
3. **The user comes back during the cancel.** After 2's `pointerleave`, `pointerenter` again
   within 300 ms: the close timer is cancelled, the pending open continues, the card appears
   when ready. After the cancel has been dispatched: a new open timer, then a new dispatch;
   `openChangeAction` has seen `true`, `false`, `true`.
4. **Lost interest while shown.** `C=true`. The pointer leaves link and card: close timer →
   the library records the intent and calls `hidePopover()` → `beforetoggle(closed)`,
   `toggle(closed)` a task later: not an echo → the fact: `C=false` urgently,
   `onOpenChange(false, { reason: "dismiss", event: pointerleave })`. One urgent commit: the
   link loses `data-open`; the children stay for the CSS fade (`held`) and unmount after it; in
   Firefox they unmount in that commit.
5. **Keyboard: open, Tab in, Escape.** Tab to the link → `focus` with `:focus-visible` → open
   timer → card shown, focus on the link. Tab → focus on the card's first link; the link's
   `blur` started the close timer and the Popup's `focusin` cancelled it. Escape → document
   listener: no shown popover inside the card → intent recorded, `hidePopover()`,
   `preventDefault()`. Focus was inside → the library focuses the link under the one-shot flag
   → that `focus` starts no timer. The fact is reported as in 4 with the `keydown`.
6. **A press on the link while the card loads.** `pointerdown` on the Trigger:
   `requestClose(event, "dismiss")`; the click navigates. Nothing appears afterwards, also when
   a client-side navigation keeps the link mounted.
7. **`openChangeAction` rejects.** `O` reverts, nothing was shown, the error reaches the
   boundary above Root. With the fetch in the content and a boundary inside the Popup instead
   (section 5), the card opens showing that boundary's fallback and the link is untouched.
8. **A controlled parent refuses the close.** As 4, with `open={true}` kept: the popup is hidden
   for a task and re-shown in the fact's commit, without focus movement. It then stays until
   the parent changes `open`.
9. **Flagged path, Chromium.** Hover → after `interest-delay-start` the platform fires
   `interest` and tries to show → `beforetoggle` cancelled → `requestOpen` → as 1. The pointer
   leaves → `loseinterest` after `interest-delay-end` → the library hides a task later → as 4
   with the `loseinterest` event.

---

## 11. Examples

### 11.1 A mention, loaded on interest

```tsx
"use client";
export function Mention({ login }: { login: string }) {
  return (
    <HoverCard.Root>
      <HoverCard.Trigger
        href={`/u/${login}`}
        className="mention"
        onPointerEnter={() => preloadUser(login)}
        onFocus={() => preloadUser(login)}
      >
        @{login}
      </HoverCard.Trigger>
      <HoverCard.Popup render={<span />} className="card" align="start">
        <ErrorBoundary fallback={<span>Could not load @{login}.</span>}>
          <UserPreview login={login} />
        </ErrorBoundary>
      </HoverCard.Popup>
    </HoverCard.Root>
  );
}
```

### 11.2 From a Server Component, with a Server Function

```tsx
// A Server Component. `recordPreview` is a Server Function; it hears opens only.
<HoverCard.Root openChangeAction={recordPreview.bind(null, repo.id)}>
  <HoverCard.Trigger href={repo.url}>{repo.name}</HoverCard.Trigger>
  <HoverCard.Popup className="card">
    <RepoSummary repo={repo} />
  </HoverCard.Popup>
</HoverCard.Root>
```

### 11.3 Pending on the Trigger

```tsx
<HoverCard.Trigger href={url} className={({ pending }) => (pending ? "mention loading" : "mention")}>
  {name}
</HoverCard.Trigger>
```

### 11.4 Controlled

```tsx
const [open, setOpen] = useState(false);

<HoverCard.Root open={open} openChangeAction={setOpen} onOpenChange={setOpen}>
  …
</HoverCard.Root>
```

`setOpen` in the action is a transition update, in the handler an urgent one (conventions
3.9.1). Never wrap the handler's update in `startTransition`.

### 11.5 Both flags

```tsx
<HoverCard.Root delay={400}>
  <HoverCard.Trigger href="/u/ada" experimental_interestFor>@ada</HoverCard.Trigger>
  <HoverCard.Popup experimental_hint className="card">…</HoverCard.Popup>
</HoverCard.Root>
```

---

## 12. What is shared

- **Root state**: `usePopoverRoot` with `component: "hover-card"`, as Menu and Combobox use it.
- **Popup**: `usePopoverPopup` unchanged in its rules: the apply effect, the `beforetoggle`
  interception of foreign and interest opens, close intents, the fact report from `toggle`,
  `held`, the focus-return fallback, `renderContent`, the lost-interest rows
  (`use-interest-dismiss.ts`). The popover type is the part's attribute; the hook does not
  read it. New for HoverCard: every show is a no-focus show, and a dismissal can say that it
  returns no focus to the Trigger (today only the lost-interest hide can).
- **Placement**: `useAnchoredPlacement`.
- **Timers**: `createDelayedPair` (`use-delayed-pair.ts`), shared with Tooltip and Menu.
- **Interest tracking** (the listeners of 2.2) is HoverCard's own. Tooltip's
  `use-tooltip-interaction.ts` is the model, but its outcome differs (it shows and hides the
  popover itself; HoverCard dispatches a request or performs a dismissal), and it carries
  Tooltip-only rules (skip-delay, `data-instant`, close on any `pointerdown`). Extracting the
  common "when does interest start and end" half into one helper for both is a refactoring to
  judge after the implementation, not a requirement of this design.
- `Popover.Trigger`'s hook is **not** used: it is a `popovertarget` toggle with a click handler,
  and a HoverCard Trigger has neither.

---

## 13. Not in v1

- **Click to pin** ("hover to preview, click to keep open"): one element that opens the same
  rich content on interest and on activation is against HTML's author guidance (popover.md
  2.9). A card that must stay is a Popover.
- **One card for many triggers** (Base UI's detached triggers with a payload). Each Root owns
  one Trigger; unmounted content makes fifty Roots cheap.
- **Skip-delay between neighbouring cards** (Tooltip's warm opens). Cards load data and take
  the keyboard path; opening them faster while browsing a list is not obviously wanted.
- **A safe-polygon pointer corridor** (Base UI). `closeDelay` and the bridge recipe of section
  8 cover the gap.
- **An Arrow part, a Close part, Title and Description parts.**
- **Anchoring to the hovered line of a wrapped link, or to the pointer.**
- **A library long-press for touch**, and `::interest-button`.
- **`openOnFocus={false}`** (Radix's audience, "sighted pointer users only"). Chromium offers
  no such switch for `interestfor`, and the two paths should not differ.
