# Tooltip

Status: **accepted**, implemented. History (open questions, the wave 11 and wave 12 amendments,
implementation notes, the test plan): `design/CHANGELOG.md`, parts "tooltip.md". Follows
`design/conventions.md`;
where this document and the conventions disagree, the conventions win.

Inputs: `docs/vision.md`, `design/conventions.md`, `docs/research/popover-anchor-tooltip.md`
(primary; its verdicts are binding), `docs/research/react-async-apis.md`,
`docs/research/modern-platform-survey.md`. Prior art: Base UI Tooltip, React Aria Tooltip,
Radix Tooltip, Ark UI Tooltip. Working notes: `memo/architect/tooltip-notes.md`.

Tooltip is the library's "zero-JS where possible" proving ground. The platform owns layering
(top layer), placement (CSS Anchor Positioning), animation (`@starting-style`) and, in
Chromium behind a flag, the hover/focus trigger itself (`interestfor`). The library's JS is a
thin, feature-detected shim for the trigger that steps aside wherever the browser can do the job.

## Decisions

| #   | Topic                 | Decision                                                                                                                                                                                                                                                                                                                                   |
| --- | --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | Anatomy               | `Tooltip.Root` (no DOM; owns ids, options, the interaction effect), `Tooltip.Trigger` (`button`), `Tooltip.Popup` (`div[popover] role="tooltip"`), `Tooltip.Arrow` (`span`, optional, decorative). No Portal, no Positioner.                                                                                                               |
| 2   | Open state            | **Browser-owned** (top layer). No `open`, `defaultOpen`, `openChangeAction` or `data-open` in v0. Style with `:popover-open`.                                                                                                                                                                                                              |
| 3   | Mechanisms            | Baseline: `popover="manual"` + JS (hover/focus with delays, `showPopover({ source })`, Escape, pointerdown-anywhere). Flags: `Tooltip.Popup experimental_hint` renders `popover="hint"`; `Tooltip.Trigger experimental_interestFor` renders `interestfor` and the JS steps aside where `interestForElement` exists on the trigger element. |
| 4   | Baseline popover type | `manual`, not `auto`: `auto` would close an open menu or combobox when a tooltip inside or beside it opens.                                                                                                                                                                                                                                |
| 5   | Name vs description   | Explicit `provides="description" \| "name"` on `Root` (default `description`). `name` sets `aria-labelledby`, `description` sets `aria-describedby`; never both.                                                                                                                                                                           |
| 6   | Delays                | `delay` (250 ms) and `closeDelay` (150 ms) on `Root`, matching Chromium's `interest-delay` defaults. Native path: inline `interest-delay-start/end` on the trigger. JS path: timers. Same delay for hover and keyboard focus. **Skip-delay (wave 11, #21): while any `[role="tooltip"]:popover-open` exists in the document, a tooltip opens with no delay and the other one is hidden at once; global, no provider, no prop.** Native path: a shipped `@property` + `:root:has()` rule feeding `interest-delay-start: calc(<delay> * (1 - var(--fsui-tooltip-warm, 0)))`; JS path: a `querySelector` at hover / focus start. |
| 7   | Positioning           | `side` (`top`) and `align` (`center`) on `Popup` set inline `position-area` and `position-try-fallbacks` through the shared matrix of conventions 13.1: physical sides plus `inline-start` / `inline-end`, inline-relative `align` on a horizontal side (wave 11, #53). `side={null}` emits nothing so a stylesheet can take over.                                                                                                                                                                       |
| 11  | Resolved side         | `data-side` / `data-align` on Popup and Arrow (and `state.side` / `state.align`) are the **resolved** placement while the tooltip is shown, read from the computed `position-area` by the shared observer (conventions 13.2), and the requested values otherwise. The Arrow therefore points at the trigger after a fallback flip (wave 11, #20). |
| 12  | Warm opens            | `data-instant` on `Popup` (presence) while the tooltip is shown by an open that began while another `[role="tooltip"]:popover-open` existed (the skip-delay condition, read at the open's `beforetoggle`), so `.tip[data-instant] { transition: none }` skips the entry animation on a warm open and keeps it on a cold one (wave 12, #93). A DOM write from the popup's synchronous `beforetoggle` on **both** paths, before the first style recalc of the open; cleared at the close's `beforetoggle`; never React state, no `state.instant`, no prop. The interaction hook's only listener on the native path (the placement observer's `toggle` listener, 7.4, is there on every path). |
| 8   | Animation             | CSS only (`@starting-style`, `transition-behavior: allow-discrete`, `overlay` required for Chromium's exit). Exit fade is progressive enhancement (none in Firefox); the library never waits on it. No `<ViewTransition>` and no `transition` prop on any Tooltip part (conventions 3.5).                                                                                                                                                                                 |
| 9   | Directives            | Every file is `"use client"`. No directive-free part is possible because the trigger/popup id link needs context and only Client Components read context. "Zero-JS" here means no runtime behaviour JS on the native path, not no hydration.                                                                                               |
| 10  | Touch                 | JS path ignores `pointerType === "touch"`; no long-press in v0. Chromium's native long-press works on the native path. Tooltip content must never be the only place information lives.                                                                                                                                                     |

---

## 1. Anatomy

```tsx
import { Tooltip } from "@funstack/ui/tooltip";

<Tooltip.Root>
  <Tooltip.Trigger>Save</Tooltip.Trigger>
  <Tooltip.Popup>
    Saves the document (Ctrl+S)
    <Tooltip.Arrow />
  </Tooltip.Popup>
</Tooltip.Root>;
```

Rendered HTML (baseline, no flags):

```html
<button type="button" aria-describedby="_r_1_">Save</button>
<div
  id="_r_1_"
  popover="manual"
  role="tooltip"
  data-side="top"
  data-align="center"
  style="position-area: top; position-try-fallbacks: flip-block, flip-inline, flip-block flip-inline"
>
  Saves the document (Ctrl+S)
  <span aria-hidden="true" data-side="top" data-align="center"></span>
</div>
```

| Part              | Element                       | Role in the design                                                                                                                                                                        |
| ----------------- | ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Tooltip.Root`    | none                          | Generates the popup id (`useId`), holds `delay` / `closeDelay` / `disabled` / `provides`, provides context, and runs the one interaction effect once both elements are mounted. No `ref`. |
| `Tooltip.Trigger` | `button` (`type="button"`)    | The element the user hovers or focuses. Receives the ARIA relation and, with the flag, `interestfor` plus `interest-delay-*`. Registers its element with `Root`.                          |
| `Tooltip.Popup`   | `div[popover] role="tooltip"` | The content, in the top layer. Carries the id, the popover type, and the inline placement. Registers its element with `Root`.                                                             |
| `Tooltip.Arrow`   | `span aria-hidden="true"`     | Decorative. Echoes the **resolved** `data-side` / `data-align` from the enclosing `Popup` (wave 11, #20) so CSS can draw and place it on the edge that faces the trigger, after a fallback flip too. Must be a descendant of `Popup`. Held by conventions resolved question 10 until wave 11; see the amendment at the end. |

Why `Root` renders no DOM: a wrapper would sit between the trigger and its layout parent (a
toolbar, a flex row) and change the layout of every call site. The popup is in the top layer, so
there is nothing to wrap. The trigger and popup must be rendered as siblings with the popup
immediately after the trigger: the HTML spec recommends this reading order for popovers and JAWS
reads adjacent tooltips as part of the wrong button otherwise (research, "Accessibility notes").

One trigger per `Root`. Two triggers for one popup is a different component (a shared
description) and is out of scope.

### Trigger element rules

The native path (`interestfor`) only works on `<button>`, `<a href>`, `<area href>` and SVG
`<a href>`. `Tooltip.Trigger` renders `<button type="button">` by default and accepts `render`
for a link or a custom button component:

```tsx
<Tooltip.Trigger render={<a href="/docs/shortcuts" />}>Shortcuts</Tooltip.Trigger>
<Tooltip.Trigger render={<IconButton />}><BoldIcon /></Tooltip.Trigger>
```

This cannot be restricted at the type level (a `render` element's type is not statically
knowable through a custom component), so the rule is documented and checked at runtime:

- With `render` of a non-button, non-link element, the native path never applies even with the
  flag on. The JS path handles it, because feature detection is per element
  (`"interestForElement" in triggerElement` is false on a `<div>`).
- The element must be focusable. A `<span>` trigger needs `tabIndex={0}`. Dev warning when the
  mounted trigger has `tabIndex < 0`.
- A natively `disabled` button does not reliably receive pointer or focus events and is not a
  valid interest invoker, so a tooltip on it never opens in any mode. Consumers who need a
  tooltip on a disabled control use `aria-disabled="true"` on the button instead. Documented,
  not worked around.

---

## 2. Two mechanisms

### 2.1 Native (Chromium, flags on)

```tsx
<Tooltip.Root>
  <Tooltip.Trigger experimental_interestFor>Save</Tooltip.Trigger>
  <Tooltip.Popup experimental_hint>Saves the document (Ctrl+S)</Tooltip.Popup>
</Tooltip.Root>
```

```html
<button
  type="button"
  interestfor="_r_1_"
  aria-describedby="_r_1_"
  data-fsui-tooltip-trigger=""
  style="interest-delay-start: calc(250ms * (1 - var(--fsui-tooltip-warm, 0))); interest-delay-end: 150ms"
>
  Save
</button>
<div id="_r_1_" popover="hint" role="tooltip" ...>Saves the document (Ctrl+S)</div>
<!-- in <head>, hoisted by React (server and client), once per document, rendered by the
     flagged Trigger (section 6, wave 11): -->
<style data-href="@funstack/ui/tooltip-warm" data-precedence="fsui">
  @property --fsui-tooltip-warm { syntax: "<number>"; inherits: false; initial-value: 0; }
  :root:has([role="tooltip"]:popover-open) [data-fsui-tooltip-trigger] { --fsui-tooltip-warm: 1; }
</style>
```

The browser does everything: hover and keyboard focus show the popup after the delay, moving
into the popup keeps it open, de-hover and blur hide it after the end delay, Escape hides it and
cancels interest, outside click light-dismisses (`hint`), the popup is implicitly anchored to the
trigger, Android long-press works, and opening the tooltip never closes an open `auto` popover.

Two platform behaviours differ from the JS path and are documented, not corrected
(product-owner decision: the library attaches nothing on the native path). Verified in
Chromium 153 by the reviewer:

- **Escape inside a modal `<dialog>` closes the hint and the dialog together** (with or without
  user activation in the dialog). A hint opened by a `popovertarget` click closes alone; one
  opened by interest does not. The library has no handler on this path, so it cannot intercept.
- **A click on the trigger does not close the tooltip**: an invoker click is not light dismiss,
  so the tooltip stays over the button the user just activated until interest is lost.
- **`disabled` flipped to true while open removes `interestfor` but does not hide the popup**;
  the library hides it itself.

The library's interaction effect checks whether the trigger element has the
`interestfor` attribute **and** `"interestForElement" in triggerElement`. If both hold it attaches
no interaction listeners at all (beyond the `disabled` cleanup above); since wave 12 one passive
`beforetoggle` listener on the popup writes `data-instant` on both paths (the amendment for
#93), which handles nothing and cancels nothing, and the placement observer's `toggle` listener
(7.4, `useResolvedPlacement`) is attached on every path as before. The two flags are designed to be set together; `experimental_interestFor`
without `experimental_hint` leaves a `manual` popup driven by interest, which still works in
Chromium (interest loss and Escape hide it) but has no outside-click dismissal.

### 2.2 Cross-engine JS (baseline, and every engine without `interestForElement`)

The effect in `Root` attaches, through `addEventListener` (not React event props, so nothing is
omitted from the trigger's prop type and consumer `onPointerEnter` et al. pass through untouched):

| Target                         | Event                                             | Behaviour                                                                                       |
| ------------------------------ | ------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| trigger                        | `pointerenter` (not `touch`)                      | start open timer (`delay`); **warm** (another `[role="tooltip"]:popover-open` in the document, section 6): open now, then hide it (that order, so the popup's `beforetoggle` sees it; wave 12) |
| trigger                        | `pointerleave`                                    | start close timer (`closeDelay`)                                                                |
| trigger                        | `focus` where `trigger.matches(":focus-visible")` | start open timer; warm: as above                                                                 |
| trigger                        | `blur`                                            | start close timer                                                                               |
| popup                          | `pointerenter`                                    | cancel close timer                                                                              |
| popup                          | `pointerleave`                                    | start close timer                                                                               |
| popup                          | `beforetoggle` (both paths)                       | open: write `data-instant` by presence from "another `[role=\"tooltip\"]:popover-open` exists" (`syncPresence`); close: remove it (wave 12, #93). Synchronous, before the top-layer insertion, so the first style recalc of the open sees it |
| popup                          | `toggle`                                          | reconcile open state (`event.newState === "open"`) for opens and closes the library did not perform; install or remove the document listeners below |
| window (while open, capture)   | `keydown` Escape                                  | record as a global layer; decided last (conventions 15 rule 4): hide now and `consumeEscape` (keeps an enclosing modal `<dialog>`, non-modal `Dialog` (dialog.md 2.6), toast or `auto` menu open; a second Escape closes them), unless the Escape was consumed (a handler prevented it, a Combobox chip; or a layer recorded earlier took it) or belongs to an IME composition. `stopPropagation()` anywhere does not keep the tooltip open |
| trigger (capture)              | `keydown` Escape                                  | record as a cancel (`{ cancel: true }`); decided last, before every layer that closes (conventions 15 rule 4): cancel a pending open, unless a handler prevented the Escape. Another tooltip or card closing on the same Escape does not stop it. The event is left alone |
| document (while open, capture) | `pointerdown`                                     | hide now (covers outside click, click on the trigger, and click on the popup)                   |

Open means `popup.showPopover({ source: trigger })`, which creates the same implicit anchor and
nesting relationship as the declarative path. Close means `popup.hidePopover()`. The open flag is
set **immediately** after `showPopover()` / `hidePopover()` and every decision is additionally
guarded by `popup.matches(":popover-open")`, not only by the asynchronous `toggle` event:
`toggle` fires in a later task in Chromium, so a pointerdown in the same task as `showPopover()`
would otherwise find the flag and the document listeners one task behind (reviewer probe). A timer
that fires after `disabled` became true, or after unmount, does nothing (the effect cleanup
clears timers and hides an open popup).

Why hover and focus share one delay: Chromium's `interest-delay-start` applies to both, and the
flags should change the user-visible behaviour of a page as little as possible (the residual
differences are the platform behaviours listed in 2.1). `delay={0}` opens instantly for
consumers who prefer that for keyboard users.

Why pointerdown anywhere, not only outside: a tooltip that stays over a button the user just
clicked (to open a menu, say) is the most common tooltip annoyance; `manual` popovers get no
light dismiss, so the library has to do this itself anyway. After an Escape or a click, nothing
reopens the tooltip until the pointer leaves and re-enters or focus leaves and returns. That
matches "Escape cancels interest" on the native path without extra state.

Why Escape is `preventDefault()`ed: the library decides in a `keydown` listener on the window,
*before* the browser's close request reaches a modal `<dialog>` or an `auto` popover, so without
it one Escape would close the tooltip and the enclosing dialog or menu together (verified in
Chromium 153: with `hidePopover(); event.preventDefault()` in the same handler the dialog and
menu stay open and a second Escape closes them). This holds for `manual` and `hint` alike, so
on `hint` the JS handler is what closes the tooltip, not native light dismiss.

### 2.3 Behaviour per engine and flag

Stable engines on 2026-10-15: Chrome 155, Firefox 158, Safari 27.0.

| Flags                      | Chromium                                                                                                                                                                                                  | Firefox                        | Safari 27.0                                                                                                               |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------ | ------------------------------------------------------------------------------------------------------------------------- |
| none (baseline)            | `manual` + JS. Escape (hidden + `preventDefault()`, so an enclosing dialog or `auto` menu stays open) and any pointerdown handled by JS. Opening never closes `auto` popovers.                              | same                           | same                                                                                                                      |
| `experimental_hint`        | `hint`. Native outside-click dismiss and hint stacking (opening one hint closes other non-ancestor hints). JS listeners still installed; Escape is still handled by the JS keydown (it runs before the native close request) and `preventDefault()`ed. | same as Chromium               | `hint` is unknown, treated as `manual`. Identical to baseline; the JS Escape and pointerdown handlers are what closes it. |
| `experimental_interestFor` | Native trigger. No JS listeners. Popup is `manual`, hidden by interest loss or Escape. Android long-press works. Trigger click does not close it.                                                           | attribute ignored, baseline JS | attribute ignored, baseline JS                                                                                            |
| both                       | Fully native. Escape also closes an enclosing modal `<dialog>` (platform behaviour, 2.1).                                                                                                                 | as `experimental_hint` only    | as baseline                                                                                                               |

Graduation: when Safari ships `hint` (STP 249 today), `experimental_hint` is removed and `hint`
becomes the default type; the JS Escape and pointerdown listeners stay for `interestfor`-less
engines. When Gecko and WebKit ship `interestfor`, `experimental_interestFor` is removed, the
attribute is always rendered, and the JS trigger path becomes a `render`-of-non-button fallback.

### 2.4 Directives

All files are `"use client"`. The reason is structural, not laziness: `Trigger` and `Popup` are
siblings that must share one id, the only React mechanism for that is context, and Server
Components can render a context provider but cannot read one. The alternatives were considered and
rejected for v0:

- `children` as a function on `Root` that hands the ids to the consumer, who passes them to
  directive-free `Trigger` and `Popup` parts as props. Works, but it is a second, uglier API shape
  whose only benefit is skipping hydration of three tiny components.
- Consumer-supplied `id` on both parts. Same shape problem, and it moves id uniqueness onto the
  consumer.

What "Server Component usage" means for Tooltip: every part takes only serializable props and
there are no action props, so a Server Component renders `<Tooltip.Root>` and friends directly
and stays a Server Component itself. On the native path the hydrated components attach nothing
("JS-free" in the sense of conventions 7.3: no behaviour JS on the native path, client components
still hydrate).

---

## 3. Props

### `Tooltip.Root`

```ts
export interface TooltipRootProps {
  /** Milliseconds from hover or focus to open. Default 250 (Chromium's interest-delay-start). */
  delay?: number;
  /** Milliseconds from de-hover or blur to close. Default 150 (Chromium's interest-delay-end). */
  closeDelay?: number;
  /** When true the tooltip never opens. ARIA relations stay in place. */
  disabled?: boolean;
  /**
   * Which accessibility relation the tooltip provides for the trigger.
   * "description" (default): aria-describedby. "name": aria-labelledby, for icon-only triggers.
   */
  provides?: "description" | "name";
  children?: ReactNode | ((state: TooltipRootState) => ReactNode);
}

export interface TooltipRootState {
  readonly disabled: boolean;
}
```

No `ref`, no `className`, no `style` (no DOM). No `open` / `defaultOpen` / `openChangeAction`
(section 4).

### `Tooltip.Trigger`

```ts
export interface TooltipTriggerProps extends Omit<
  ComponentPropsWithRef<"button">,
  "className" | "style" | "children"
> {
  /**
   * Experimental (Chromium 142+). Renders `interestfor` and `interest-delay-*` so the browser
   * owns hover/focus; the JS trigger path is skipped where `interestForElement` is supported.
   * No effect in other engines (attribute ignored, JS path runs). Pair with `Popup experimental_hint`.
   */
  experimental_interestFor?: boolean;
  className?: string | ((state: TooltipTriggerState) => string | undefined);
  style?: CSSProperties | ((state: TooltipTriggerState) => CSSProperties | undefined);
  children?: ReactNode | ((state: TooltipTriggerState) => ReactNode);
  render?: RenderProp<ComponentPropsWithRef<"button">, TooltipTriggerState>;
}

export interface TooltipTriggerState {
  readonly disabled: boolean;
}
```

- `type` defaults to `"button"` and may be overridden (a submit button can have a tooltip).
- `aria-describedby` / `aria-labelledby` given by the consumer are **merged** as token lists with
  the library's id, not replaced. A trigger may legitimately be described by something else too.
- `aria-label` together with `provides="name"` is a dev warning (double announcement, research
  "Accessibility notes").
- The library attaches no React event props, so no `on*` prop is omitted from the type.

### `Tooltip.Popup`

```ts
/** `inline-start` / `inline-end` follow the popup's `direction` (wave 11; conventions 13.1). */
export type TooltipSide = "top" | "bottom" | "left" | "right" | "inline-start" | "inline-end";
export type TooltipAlign = "start" | "center" | "end";

export interface TooltipPopupProps extends Omit<
  ComponentPropsWithRef<"div">,
  "id" | "popover" | "role" | "className" | "style" | "children"
> {
  /**
   * Placement relative to the trigger via inline `position-area`. Default "top". `null` emits
   * no inline positioning. `"inline-start"` / `"inline-end"` follow the popup's direction.
   */
  side?: TooltipSide | null;
  /**
   * Alignment along the side. Default "center". On a top / bottom side `start` / `end` are
   * inline-relative (mirrored under `direction: rtl`); on the other sides they are the top /
   * bottom edges. Ignored when `side` is null.
   */
  align?: TooltipAlign;
  /**
   * Experimental (Chrome 151+, Firefox 153+; Safari 27.0 treats it as "manual"). Renders
   * `popover="hint"` instead of `popover="manual"`: native light dismiss, and the tooltip can open
   * over an `auto` popover without closing it.
   */
  experimental_hint?: boolean;
  className?: string | ((state: TooltipPopupState) => string | undefined);
  style?: CSSProperties | ((state: TooltipPopupState) => CSSProperties | undefined);
  children?: ReactNode | ((state: TooltipPopupState) => ReactNode);
  render?: RenderProp<ComponentPropsWithRef<"div">, TooltipPopupState>;
}

export interface TooltipPopupState {
  readonly disabled: boolean;
  /**
   * While shown: the physical side the browser placed the popup on (`"top"` / `"bottom"` /
   * `"left"` / `"right"`, after any fallback flip). Otherwise the `side` prop. `null` with
   * `side={null}`.
   */
  readonly side: TooltipSide | null;
  /** While shown: the resolved alignment; otherwise the `align` prop. */
  readonly align: TooltipAlign;
}
```

`id`, `popover` and `role` are library-controlled and removed from the type. The consumer's
`style` is merged over the library's inline positioning (consumer wins), so
`style={{ positionArea: "bottom span-right" }}` overrides `side` for one-offs; `data-side`
then reports what that override resolved to while shown (section 7.4).

### `Tooltip.Arrow`

```ts
export interface TooltipArrowProps extends Omit<
  ComponentPropsWithRef<"span">,
  "aria-hidden" | "className" | "style" | "children"
> {
  className?: string | ((state: TooltipArrowState) => string | undefined);
  style?: CSSProperties | ((state: TooltipArrowState) => CSSProperties | undefined);
  children?: ReactNode | ((state: TooltipArrowState) => ReactNode);
  render?: RenderProp<ComponentPropsWithRef<"span">, TooltipArrowState>;
}

export interface TooltipArrowState {
  readonly side: TooltipSide | null;
  readonly align: TooltipAlign;
}
```

The arrow is deliberately thin: a `span` that echoes the Popup's `side` / `align` through
`TooltipPopupContext` and draws nothing itself. Since wave 11 (#20) those are the **resolved**
values while the tooltip is shown (section 7.4), so the arrow sits on the edge that faces the
trigger after a `position-try-fallbacks` flip as well. (The v0 text here said CSS exposes no
resolved-placement signal and that measuring in JS would reintroduce positioning code; the
computed `position-area` is that signal, read without geometry.)

---

## 4. State

| State       | Owner                                             | Where it shows                                                                                                                                        |
| ----------- | ------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| open        | **browser** (popover visibility state, top layer) | `:popover-open` on the popup; `.trigger:has(+ .popup:popover-open)` on the trigger; Chromium native path also `:interest-source` / `:interest-target` |
| disabled    | library (prop, not changeable by the user)        | `data-disabled` on Trigger and Popup; `state.disabled`                                                                                                |
| side, align | props while closed; **browser** (the applied `position-try-fallbacks` option, observed, written urgently; conventions 3.5 and 13.2) while shown | `data-side`, `data-align` on Popup and Arrow; `state.side`, `state.align`: the resolved placement while shown, the requested one otherwise (wave 11, #20) |
| instant     | **browser** (the top-layer state of the other tooltips at the moment this open begins) | `data-instant` on Popup, written by presence from the popup's `beforetoggle` on both paths and removed at the close's; **no `state.instant`** (wave 12, #93, amendment) |
| pending     | n/a                                               | never emitted: no action, no transition                                                                                                               |

### 4.1 No `open`, no `openChangeAction`, no `data-open`

A tooltip's visibility is not state the application owns. Nobody persists it, nobody awaits it,
and the APG pattern defines it entirely in terms of hover, focus, Escape and blur. The
conventions (3.5) already classify popover open state as browser-owned: the browser opens and
closes the popup before React hears about it, and no transition can delay or roll that back.
Every tooltip open and close is performed by the browser or by timers the user drives, so
nothing about it is a request (conventions 2.1): there is no `openChangeAction`, and **if a
callback is ever wanted it is `onOpenChange` only** (both `true` and `false`, synchronous, not
awaited). It is not offered: on the native path it would be the only JS left running.
Consumers who want to observe opens for analytics can listen to the platform's own `toggle`
event on the popup element through `ref` (unsupported escape hatch, conventions 2.6).

`data-open` is not emitted either. The platform already exposes the state as `:popover-open`,
and conventions 7.4 says not to duplicate a pseudo-class for browser-owned state. Emitting it on
the trigger would require a React state write from the `toggle` event (a render per hover) solely
to mirror what `:has(+ :popover-open)` selects today.

`data-instant` (wave 12) is the one attribute Tooltip writes for browser-owned state, because
no pseudo-class carries it: it is a DOM write from the popup's `beforetoggle`, never a React
state write, so it has no `state.instant` counterpart for the same reason there is no
`state.open` (conventions 7.4; the amendment for #93).

Controlled `open` (pinned or programmatic tooltips) is out of scope for v0. A pinned tooltip is
click-driven, which makes it a Popover. One button that previews on hover and pins on click is
not offered: HTML's author guidance for interest invokers rules it out for rich content
(popover.md 2.9). Popover defines controlled popover state, following conventions 3.5 ("it
follows the browser, it does not gate it"), and Tooltip can reuse it if a real need appears.

### 4.2 Async React edge cases

Every question in the conventions' action model is answered "not applicable" here, and the test
file says so explicitly (section 10):

- **Action rejects**: no action.
- **Overlapping actions**: none. Overlapping _interactions_ (hover then focus, pointer leaving
  the trigger and entering the popup) are resolved by the single timer pair in the effect: the
  latest event wins, and a pending open or close is cancelled by the opposite event.
- **Children suspend**: `Popup` content is rendered on mount, hidden by the popover's
  `display: none`. Content that suspends (a `use()` inside the tooltip) suspends the consumer's
  nearest Suspense boundary at mount, not at open time, and there is no transition to hold the old
  UI. If the boundary is inside `Popup` the fallback is what the user sees should the tooltip open
  before the data arrives; if it is above `Root`, the whole trigger disappears behind the fallback.
  Tooltip content should be static. The docs show the "boundary inside Popup" form for the rare
  async case.
- **Optimistic state**: none.

---

## 5. Accessibility

### 5.1 Name or description

The APG pattern says the trigger references the tooltip with `aria-describedby`. That is wrong
for an icon-only button: the tooltip text _is_ the button's name, and `aria-label` plus
`aria-describedby` makes VoiceOver announce it twice (research, citing Jake Archibald's 2026-07
post). Chromium's `interestfor` applies the right relation automatically for plain hints; the
library must apply it everywhere else, and it cannot know whether the trigger has a name without
reading the DOM after mount (which would differ between server and client renders). So the
relation is an explicit prop on `Root`:

| `provides`                | Trigger gets                   | Use when                                             |
| ------------------------- | ------------------------------ | ---------------------------------------------------- |
| `"description"` (default) | `aria-describedby="<popupId>"` | the trigger has visible text or its own name         |
| `"name"`                  | `aria-labelledby="<popupId>"`  | icon-only triggers; do **not** also set `aria-label` |

Both relations work while the popover is hidden (`display: none` does not break id references),
so assistive technology users hear the text on focus even in an engine where the visual tooltip
would not open.

Dev warnings (effect in `Root`, development builds only):

- `provides="name"` and the trigger has an `aria-label` attribute.
- The mounted trigger is not focusable (`tabIndex < 0`).
- The popup contains focusable content. Tooltips are never interactive; interactive content
  belongs in a non-modal dialog or a future Popover. (On the Chromium native path, interactive
  content also silently switches the hint to "rich" semantics: `aria-expanded`, `aria-details`,
  focus order. The warning protects against that drift.)

### 5.2 ARIA and keyboard summary

|                     |                                                                                         |
| ------------------- | --------------------------------------------------------------------------------------- |
| Popup               | `role="tooltip"`; a `hint` popover has no implicit role, so this is always rendered     |
| Trigger             | `aria-describedby` or `aria-labelledby` (above); no `aria-expanded`, no `aria-haspopup` |
| Tab to trigger      | opens after `delay` when focus is `:focus-visible` (pointer focus does not open)        |
| Escape              | closes; focus stays on the trigger; on the JS path the keydown is `preventDefault()`ed while the tooltip is open so an enclosing modal `<dialog>` does not close too (product-owner decision; verified by the reviewer in Chromium 153 for `manual` and `hint`: dialog and `auto` menus stay open, a second Escape closes them). Escape or pointerdown on the trigger before `delay` elapses cancels the pending open |
| Tab away            | closes after `closeDelay`                                                               |
| Hover trigger       | opens after `delay`; stays open while the pointer is over the trigger or the popup      |
| Pointer leaves both | closes after `closeDelay`                                                               |
| Any pointerdown     | closes                                                                                  |

### 5.3 Touch

No hover exists. The JS path ignores touch pointers, so a touch user never sees the tooltip,
which matches every other engine and the APG's stance that tooltip content must not be the only
place a piece of information lives. The Chromium native path offers long-press. `::interest-button`
(an explicit tap affordance) is not shipped anywhere and is not designed for. Screen reader focus
on touch devices fires `focus`, so the ARIA relation still works. No long-press emulation in v0:
it would differ from the native behaviour, conflict with the context menu, and `::interest-button`
is the platform's answer in progress.

---

## 6. Delays

`delay` and `closeDelay` live on `Root` because they describe the tooltip, not one part, and
because both mechanisms need them: the native path writes them onto the trigger, the JS path
reads them in `Root`'s effect.

- **Native path**: inline style on the trigger, `interestDelayStart: "<delay>ms"` and
  `interestDelayEnd: "<closeDelay>ms"`, emitted only when `experimental_interestFor` is on so the
  baseline markup is unchanged. React hyphenates them for SSR; in engines without the property the
  assignment is an inert expando. The properties are typed on `React.CSSProperties` (section 9).
- **JS path**: `setTimeout` with the same values; `useEffectEvent` reads the latest props so
  changing a delay does not tear down the listeners.
- **Skip-delay (wave 11, #21; `docs/research/interaction-wave11.md` 1, binding).** Every
  desktop toolkit has a "browse mode": once one tooltip is showing, the next one appears at
  once (GTK, Windows `TTDT_RESHOW`, macOS), and Radix / Base UI / React Aria emulate it. The v0
  text deferred it because Chromium's `interestfor` had no such behaviour and the flags must not
  change UX; the research shows the native path can do it in CSS, so both paths get the **same
  rule, global per document, with no provider and no prop**:

  > A tooltip opens with **no delay while any `[role="tooltip"]:popover-open` exists in the
  > document**, its close delay included, and the tooltip that was showing is hidden at once.

  - **Why global and provider-less.** Tooltip is rendered from Server Components with nothing
    around it (2.4); a required provider (Radix) adds a wrapper to every app, cannot span React
    roots or a second copy of the library, and only exists to hold a timer. The condition is a
    DOM fact (`:popover-open`), so it is read from the DOM (conventions 3.5, "read the DOM when
    it needs the value"); it counts any popover tooltip on the page, FUNSTACK's or not, which
    is what a user moving along a toolbar expects.
  - **JS path.** At `pointerenter` / `:focus-visible` focus: find the open tooltip
    (`otherOpenTooltip(doc, popup)`: iterate `[role="tooltip"][popover]` and ask each
    `matches(":popover-open")`, rather than one
    `querySelector('[role="tooltip"]:popover-open')`: the same result in browsers, and jsdom's
    shim answers `matches` only; deviation B6); if found and not this popup, `clear()`,
    `other.hidePopover()` (its own Root sees the `toggle` and detaches its listeners; a
    pending close timer of that Root finds it closed and does nothing) and `show()` now, no
    timer. Otherwise the ordinary `delay` timer. The check is stateless: no module-level
    timestamp, nothing to share.
  - **Native path (`experimental_interestFor`).** Chromium reads `interest-delay-start` from the
    trigger's computed style when the hover starts, so the inline value becomes
    `calc(<delay>ms * (1 - var(--fsui-tooltip-warm, 0)))` and the flagged Trigger renders the
    library's second shipped stylesheet (conventions 12, the proposed selector exception):

    ```css
    @property --fsui-tooltip-warm { syntax: "<number>"; inherits: false; initial-value: 0; }
    :root:has([role="tooltip"]:popover-open) [data-fsui-tooltip-trigger] { --fsui-tooltip-warm: 1; }
    ```

    rendered as `<style href="@funstack/ui/tooltip-warm" precedence="fsui">` **beside** the
    Trigger element (the part returns `<>{warmRules}{element}</>`; React hoists it into
    `<head>` on the server and the client, nothing lands in place, and no `<ViewTransition>`
    wraps a Trigger). Not inside `children`: a `render` element with its own children
    (`render={<a href="/pricing">Pricing</a>}`) wins the `children` merge and would drop the
    rule (review M1).
    Verified: the second tooltip opens 2 ms after the pointer arrives (probe `skip-delay.mjs`),
    and `hint` stacking closes the first natively. The registered non-inherited property
    invalidates only the marked triggers, not the document. The Trigger carries the marker
    `data-fsui-tooltip-trigger` only with the flag, so baseline markup is unchanged; it works
    before hydration like the rest of the native path. **Degradation:** the `var()` carries an
    explicit fallback, `var(--fsui-tooltip-warm, 0)`. Without it, a missing stylesheet (a
    strict `style-src` without the hash or nonce; an app that passes `nonce: { style }` to React
    but renders no `<CSPProvider>`, where Fizz drops the rule; a `render` element dropping it)
    leaves the property unregistered and unset, the `var()` invalid at computed-value time, and
    `interest-delay-start` at its initial `normal`: Chromium's **500 ms**, not the Root's
    `delay` (review M1, probed). With the fallback the inline value computes to the Root's
    `delay` and only the skip is lost, which is the intended degradation; `interest-delay-end`
    is untouched either way. The `@property` initial value matters only once the rule is in. This is the
    first library stylesheet rendered during SSR, which is what makes the CSP nonce provider
    necessary (conventions 12, `<CSPProvider nonce>`; the Trigger reads it and forwards
    `nonce`).
  - **Keyboard** behaves the same: arrowing along a Toolbar shows each tooltip at once (the
    focus path checks the same condition; `:interest-source` treats focus like hover).
  - **Not in v1:** a cooldown longer than `closeDelay` (Radix's 300 ms after a close; needs a
    `:root` transition that fights an app's `<html>` transition and restyles the document),
    an opt-out (a Root that always waits), and a `data-instant` / `state.warm` for skipping
    the entry animation on a warm open. **No CSS recipe exists for the last one** (review M3):
    `:root:has([role="tooltip"]:popover-open) .tip { transition: none }` matches the tooltip
    being opened itself once it is `:popover-open`, so every cold open loses its entry
    transition too, while on a skip the previous tooltip is already hidden when the next one's
    style changes, so "another tooltip is open" is never observable from CSS at that moment.
    No replacement recipe is possible. Instant browsing that keeps cold entry animations
    needs library state: **`data-instant` on the Popup, wave 12 (#93, the amendment at the end
    of this document)**, written from the popup's `beforetoggle` on both paths.
  - **Accessibility:** WCAG 1.4.13's dismissible and persistent requirements are unchanged;
    **hoverable has one new trade-off** (review L5): the pointer crossing a neighbouring
    trigger B on its way from trigger A to A's tooltip now opens B at once and hides A, where
    before wave 11 B's 250 ms timer let A survive the crossing; both paths do it (the JS path's
    `hidePopover()`, the native path's warm `0s` plus `hint` stacking), native platforms behave
    the same way, and it matters only where the path to a tooltip crosses another trigger (a
    tooltip beside a vertical toolbar). Documented: place tooltips away from neighbouring
    triggers in dense toolbars. Skipping happens only after the user has already shown interest
    in a neighbouring control; nothing is announced on show.

---

## 7. Positioning

### 7.1 Built-in default

`Popup` sets, inline, from `side` and `align`:

| `side` \ `align` | `start`                    | `center`       | `end`                        |
| ---------------- | -------------------------- | -------------- | ---------------------------- |
| `top`            | `top span-self-x-end`      | `top`          | `top span-self-x-start`      |
| `bottom`         | `bottom span-self-x-end`   | `bottom`       | `bottom span-self-x-start`   |
| `left`           | `left span-bottom`         | `left`         | `left span-top`              |
| `right`          | `right span-bottom`        | `right`        | `right span-top`             |
| `inline-start`   | `self-x-start span-bottom` | `self-x-start` | `self-x-start span-top`      |
| `inline-end`     | `self-x-end span-bottom`   | `self-x-end`   | `self-x-end span-top`        |

plus `position-try-fallbacks: flip-block, flip-inline, flip-block flip-inline`. The `center`
column uses the single-keyword form (`top` means the top row spanning all three columns) because
CSS Anchor Positioning aligns a span-all cell with `anchor-center`, so the popup is centred on the
trigger and may be wider than it. The popover UA stylesheet already supplies `position: fixed`,
and the implicit anchor comes from `interestfor` or `showPopover({ source })`, so no `anchor-name`
or `position-anchor` is needed anywhere.

The matrix is the shared one of conventions 13.1 (wave 11, #53; the v0 matrix was physical
throughout, `top span-right` for `start`). `top` / `bottom` / `left` / `right` are physical;
`inline-start` / `inline-end` follow the popup's own `direction` through the `self-x-*`
keywords, which resolve against the popup's writing mode and so honour a `dir="rtl"` container,
unlike the plain logical keywords (`inline-end`), which resolve against the root. `align`
`start` / `end` on a horizontal side is inline-relative for the same reason (`span-self-x-end`:
the popup's inline-start edge meets the trigger's). In an LTR page every cell places exactly
where the v0 matrix did; under RTL, `start` / `end` and the inline sides mirror. Writing-mode
placement beyond that (vertical text) is a CSS override, which is why the override path has to
be first class.

### 7.2 Override paths

1. `style` on `Popup` (consumer wins over the library's inline values).
2. `side={null}`: no inline `position-area`, no `position-try-fallbacks`, no `data-side` /
   `data-align`; the stylesheet owns placement entirely.

```css
/* side={null} */
.tip {
  position-area: block-end;
  position-try-fallbacks: --tip-above;
  margin-block: 6px;
}
@position-try --tip-above {
  position-area: block-start;
}
```

An inline default is the only way the component works with no stylesheet at all; the cost is that
a stylesheet cannot override the two inline properties without `side={null}`. That trade-off is
accepted over shipping a mandatory CSS file.

### 7.3 Open implementation checks

- Verify in the example app that the UA's `inset: 0; margin: auto` on `[popover]` coexists with
  `position-area` (the spec resolves auto margins to 0 under `position-area`, and non-auto insets
  resolve against the position-area cell, so it should). If any engine misplaces the popup, the
  inline style additionally sets `inset: auto`, nothing more.
- Arrow placement that survives a fallback flip: resolved in wave 11 by section 7.4 (the v0
  text deferred it, since `@position-try` rules cannot carry custom properties and a
  `getBoundingClientRect` comparison would have been positioning JS; the computed
  `position-area` needs neither).

### 7.4 Resolved side (wave 11, #20)

While the tooltip is shown, `Popup` reads which `position-try-fallbacks` option the browser
applied from `getComputedStyle(popup).positionArea` (every engine reports the applied option;
research `arrow-flip.mjs`, `resolved-side-timing.mjs`) and renders **that** as `data-side` /
`data-align` and `state.side` / `state.align`; the Arrow echoes it through
`TooltipPopupContext`. Closed, on the server, or when the computed value cannot be mapped, the
requested values are rendered. The mechanism is the shared hook of conventions 13.2
(`internal/overlay/use-resolved-placement.ts`): a `ResizeObserver` on the popup from mount (hidden to
shown is a resize delivered after layout and before paint, so the first frame is right), the
`toggle` event, and `scroll` (document, capture, passive) plus `resize` (window) while shown,
each read at once and again in the next two animation frames (both engines apply
scroll-dependent anchoring a frame after the event, the timing being unspecified; Chromium 156
additionally keeps an overflowing option for a top-layer popover after the first frames, bug
#92; conventions 13.2); a plain `useState` written only when the pair changed. A tooltip with a
**physical** `side` that opens where it was asked to costs **no render** (4.1's "no React work
per hover" holds); a flipped one, and every open of a tooltip with `side="inline-start"` /
`"inline-end"` (the physical `data-side` never equals the logical request), costs one render on
open and one on close (review M1). The starter stylesheet's gap is a plain `margin: 6px`
on purpose: a flip swaps the popup's own margins, so a gap is either static on the requested
edge or symmetric, never one-sided on the resolved side (conventions 13.2).

```html
<!-- requested side="top", no room above: -->
<div popover="manual" role="tooltip" data-side="bottom" data-align="center"
     style="position-area: top; position-try-fallbacks: flip-block, flip-inline, flip-block flip-inline">
  Saves the document (Ctrl+S)
  <span aria-hidden="true" data-side="bottom" data-align="center"></span>
</div>
```

The inline style keeps the requested `position-area` (the browser needs it to keep choosing);
only the attributes report the outcome. With `side={null}` the hook is idle and nothing is
emitted, as before: the parser cannot interpret consumer `@position-try` rules that set insets.
A consumer who positions in CSS and wants a pure-CSS arrow has Chromium's anchored container
queries (`container-type: anchored; @container anchored(fallback: flip-block) { … }`),
documented as a recipe, not shipped (Chromium-only).

Known limit: `@starting-style` is resolved before the observer's write, so an entry animation
keyed on `data-side` starts from the requested side's starting values on a flipped open
(conventions 13.2). The docs' entry recipe (section 8) keys on opacity and a fixed `translate`,
which is unaffected.

### 7.5 Direction (wave 11, #53)

Nothing in Tooltip reads `direction`. The `self-x-*` keywords of the matrix make `align`
`start` / `end` and `side="inline-start"` / `"inline-end"` follow the popup's inherited
direction, container-level `dir="rtl"` included, in Chromium and WebKit. **Firefox** misplaces
any `position-area` popup along the inline axis when the popup's parent box has a direction
different from the root's (Mozilla 2019601, conventions 13.3, human task #89; physical keywords
included, so v0 was affected too). No workaround ships; the browser row asserts the degradation
behind the `anchorPositionHonoursParentDirection` probe.

---

## 8. Animation and `<ViewTransition>`

Open and close are performed by the browser outside any React transition, so `<ViewTransition>`
cannot observe them. Per conventions 3.5, Tooltip parts render **no** `<ViewTransition>` and have
**no** `transition` prop. This is consistent with conventions 5.1 (parts whose mount, unmount or
content is _driven by library state_ wrap in ViewTransition): nothing in Tooltip is driven by
library state. Section 11 asks the conventions to say so in the ViewTransition table.

The animation is CSS, shown in the docs with the reduced-motion block:

```css
.tip {
  opacity: 0;
  translate: 0 4px;
  transition:
    opacity 120ms,
    translate 120ms,
    display 120ms allow-discrete,
    overlay 120ms allow-discrete; /* required in Chromium: without it the popup leaves the top
                                     layer on close and fades out under z-indexed content */
}
.tip:popover-open {
  opacity: 1;
  translate: 0 0;
  @starting-style {
    opacity: 0;
    translate: 0 4px;
  }
}
.tip[data-instant] {
  transition: none; /* a warm open (another tooltip was showing): no entry animation, wave 12 */
}
@media (prefers-reduced-motion: reduce) {
  .tip {
    transition: none;
  }
}
```

The `[data-instant]` rule skips the entry animation of a warm open (skip-delay, section 6) and
leaves a cold open's alone; the attribute is written before the open's first style recalc, so
no transition is created rather than cancelled (the amendment for #93, with the probe). Because
it is removed at the close's `beforetoggle`, the exit transition is never affected.

The **entry** fade works in all three engines. The **exit** fade is progressive enhancement
(`docs/research/popover-anchor-tooltip.md`, correction of 2026-10-16, screenshot-probed on
Chromium 156 and Firefox 157):

- Chromium **requires** `overlay … allow-discrete` in the transition list; without it the popup
  leaves the top layer the moment it closes and fades out underneath z-indexed page content.
  `overlay` is ignored by Gecko and WebKit, so it stays in every documented snippet.
- Firefox hides the popover instantly on close: Gecko cannot transition `display`, so no exit
  animation runs there. WebKit animates the exit (Safari 27.0 fixed the closing-animation bug).

Consequence for the component and its tests: nothing may wait on the exit animation. `hidePopover()`
is final the moment it is called; the library never listens for `transitionend` or inspects
`getAnimations()` before, during or after a close, and the Chromium browser tests assert the
closed state, not the fade. Note for Firefox: `anchor()` values cannot be animated there either,
so animate `translate`/`opacity`, never the anchor insets.

---

## 9. Platform attribute typing

`src/internal/platform-attributes.ts` (the one augmentation module, conventions 7.4) gains:

```ts
declare module "react" {
  interface ButtonHTMLAttributes<T> {
    interestfor?: string | undefined;
  } // DefinitelyTyped #74664
  interface AnchorHTMLAttributes<T> {
    interestfor?: string | undefined;
  }
  interface AreaHTMLAttributes<T> {
    interestfor?: string | undefined;
  }
  interface CSSProperties {
    interestDelay?: string | undefined;
    interestDelayStart?: string | undefined;
    interestDelayEnd?: string | undefined;
  }
}
export {};
```

`popover` (including `"hint"`) is already typed in `@types/react` 19.3.0, and `csstype` 3.2.3
already types `positionArea`, `positionTryFallbacks`, `positionAnchor` and `anchorName`, so only
`interestfor` and `interest-delay-*` need augmenting. The CSS properties are added to
`React.CSSProperties`, **not** via `declare module "csstype"`: `csstype` is not a dependency of
the package, so under pnpm that augmentation fails with TS2664 and would not reach consumers.

---

## 10. Examples

### Icon-only button: the tooltip is the name

```tsx
<Tooltip.Root provides="name">
  <Tooltip.Trigger className="icon-btn">
    <BoldIcon />
  </Tooltip.Trigger>
  <Tooltip.Popup className="tip">Bold</Tooltip.Popup>
</Tooltip.Root>
```

### Text button: the tooltip is a description

```tsx
<Tooltip.Root>
  <Tooltip.Trigger className="btn">Save</Tooltip.Trigger>
  <Tooltip.Popup className="tip" side="bottom">
    Saves the document (Ctrl+S)
  </Tooltip.Popup>
</Tooltip.Root>
```

### Link trigger

```tsx
<Tooltip.Root>
  <Tooltip.Trigger render={<Link href="/pricing" />}>Pricing</Tooltip.Trigger>
  <Tooltip.Popup className="tip">Opens the pricing page</Tooltip.Popup>
</Tooltip.Root>
```

### Server Component, native path (Chromium gets zero runtime JS behaviour)

```tsx
// app/toolbar.tsx — a Server Component. No client component of your own is needed.
import { Tooltip } from "@funstack/ui/tooltip";

export function Toolbar({ doc }: { doc: Doc }) {
  return (
    <div className="toolbar">
      <Tooltip.Root provides="name" delay={400}>
        <Tooltip.Trigger experimental_interestFor className="icon-btn">
          <SaveIcon />
        </Tooltip.Trigger>
        <Tooltip.Popup experimental_hint className="tip">
          Save {doc.title}
        </Tooltip.Popup>
      </Tooltip.Root>
    </div>
  );
}
```

In Chromium the hydrated parts attach nothing; Firefox and Safari run the JS trigger path under
the same markup.

### Custom placement entirely in CSS

```tsx
<Tooltip.Popup side={null} className="tip tip-inline-end">
  ...
</Tooltip.Popup>
```

```css
.tip-inline-end {
  position-area: inline-end;
  position-try-fallbacks: flip-inline;
  margin-inline: 6px;
}
```

### Arrow

```tsx
<Tooltip.Popup className="tip">
  Bold
  <Tooltip.Arrow className="tip-arrow" />
</Tooltip.Popup>
```

```css
.tip {
  position: fixed;
} /* UA default, restated for clarity */
.tip-arrow {
  position: absolute;
  width: 8px;
  height: 8px;
  background: inherit;
  rotate: 45deg;
}
/* `data-side` is the side the browser resolved, so these hold after a flip (7.4). */
.tip-arrow[data-side="top"] {
  bottom: -4px;
  inset-inline-start: calc(50% - 4px);
}
.tip-arrow[data-side="bottom"] {
  top: -4px;
  inset-inline-start: calc(50% - 4px);
}
.tip-arrow[data-side="left"] {
  right: -4px;
  top: calc(50% - 4px);
}
.tip-arrow[data-side="right"] {
  left: -4px;
  top: calc(50% - 4px);
}
/* `data-align` is inline-relative on a top / bottom side: logical insets keep it right in RTL. */
.tip-arrow[data-align="start"] {
  inset-inline-start: 12px;
}
.tip-arrow[data-align="end"] {
  inset-inline-start: auto;
  inset-inline-end: 12px;
}
```

The same drawing with no Arrow part, as a pseudo-element on the popup (what resolved question
10 of the conventions asked for; works since `data-side` is resolved on the Popup itself):

```css
.tip::after {
  content: "";
  position: absolute;
  width: 8px;
  height: 8px;
  background: inherit;
  rotate: 45deg;
}
.tip[data-side="top"]::after { bottom: -4px; inset-inline-start: calc(50% - 4px); }
.tip[data-side="bottom"]::after { top: -4px; inset-inline-start: calc(50% - 4px); }
```

### Function props

```tsx
<Tooltip.Popup className={({ side }) => `tip tip-${side ?? "custom"}`}>...</Tooltip.Popup>
<Tooltip.Trigger className={({ disabled }) => (disabled ? "btn muted" : "btn")}>Save</Tooltip.Trigger>
```

### Starter stylesheet (docs, not shipped)

```css
.tip {
  margin: 6px; /* gap from the trigger; UA margin:auto is overridden */
  padding: 4px 8px;
  border: 0;
  border-radius: 4px;
  background: CanvasText;
  color: Canvas;
  font-size: 0.875rem;
  max-inline-size: 24rem;
}
```

---

## 11. Conventions feedback

Moved to `design/CHANGELOG.md` (part "tooltip.md"). Not part of the contract: the code and the tests are the reference.

## 12. Implementation notes

Moved to `design/CHANGELOG.md` (part "tooltip.md"). Not part of the contract: the code and the tests are the reference.

## 13. Test plan

Moved to `design/CHANGELOG.md` (part "tooltip.md"). Not part of the contract: the code and the tests are the reference.

## 14. Open questions for the product owner

Moved to `design/CHANGELOG.md` (part "tooltip.md"). Not part of the contract: the code and the tests are the reference.
