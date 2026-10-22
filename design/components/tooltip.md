# Tooltip

Status: **proposed** (2026-10-15, GitHub issue #9). Follows `design/conventions.md` (accepted);
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
  the library hides it itself (section 13, Disabled row).

The library's interaction effect checks whether the trigger element has the
`interestfor` attribute **and** `"interestForElement" in triggerElement`. If both hold it attaches
no listeners at all (beyond the `disabled` cleanup above). The two flags are designed to be set together; `experimental_interestFor`
without `experimental_hint` leaves a `manual` popup driven by interest, which still works in
Chromium (interest loss and Escape hide it) but has no outside-click dismissal.

### 2.2 Cross-engine JS (baseline, and every engine without `interestForElement`)

The effect in `Root` attaches, through `addEventListener` (not React event props, so nothing is
omitted from the trigger's prop type and consumer `onPointerEnter` et al. pass through untouched):

| Target                         | Event                                             | Behaviour                                                                                       |
| ------------------------------ | ------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| trigger                        | `pointerenter` (not `touch`)                      | start open timer (`delay`); **warm** (another `[role="tooltip"]:popover-open` in the document, section 6): hide it now and open now |
| trigger                        | `pointerleave`                                    | start close timer (`closeDelay`)                                                                |
| trigger                        | `focus` where `trigger.matches(":focus-visible")` | start open timer; warm: as above                                                                 |
| trigger                        | `blur`                                            | start close timer                                                                               |
| popup                          | `pointerenter`                                    | cancel close timer                                                                              |
| popup                          | `pointerleave`                                    | start close timer                                                                               |
| popup                          | `toggle`                                          | reconcile open state (`event.newState === "open"`) for opens and closes the library did not perform; install or remove the document listeners below |
| document (while open)          | `keydown` Escape                                  | hide now and `preventDefault()` (keeps an enclosing modal `<dialog>` or `auto` menu open; a second Escape closes them) |
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

Why Escape is `preventDefault()`ed: the document `keydown` bubbles to the library's handler
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
and stays a Server Component itself. On the native path the hydrated components attach nothing.
The product owner should confirm this reading of "zero-JS" (open question 1).

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
| pending     | n/a                                               | never emitted: no action, no transition                                                                                                               |

### 4.1 No `open`, no `openChangeAction`, no `data-open`

A tooltip's visibility is not state the application owns. Nobody persists it, nobody awaits it,
and the APG pattern defines it entirely in terms of hover, focus, Escape and blur. The
conventions (3.5) already classify popover open state as browser-owned: the browser opens and
closes the popup before React hears about it, and no transition can delay or roll that back. An
`openChangeAction` would be a notification fired from the `toggle` event; on the native path it
would be the only JS left running, and it would invite awaited work on every hover, which the
entanglement findings in `docs/research/react-async-apis.md` make expensive for the whole app.
v0 therefore offers no action prop at all. Consumers who want to observe opens for analytics can
listen to the platform's own `toggle` event on the popup element through `ref` (unsupported
escape hatch, conventions 2.6).

`data-open` is not emitted either. The platform already exposes the state as `:popover-open`,
and conventions 7.4 says not to duplicate a pseudo-class for browser-owned state. Emitting it on
the trigger would require a React state write from the `toggle` event (a render per hover) solely
to mirror what `:has(+ :popover-open)` selects today.

Controlled `open` (pinned or programmatic tooltips) is out of scope for v0. A pinned tooltip is
click-driven, which makes it a Popover with `commandfor` + `interestfor` ("hover to preview,
click to pin", research "Invoker Commands"). That component will define controlled popover state
once, following conventions 3.5 ("it follows the browser, it does not gate it"), and Tooltip can
reuse it if a real need appears.

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
    Instant browsing that keeps cold entry animations needs library state; follow-up if asked.
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
(`internal/use-resolved-placement.ts`): a `ResizeObserver` on the popup from mount (hidden to
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
@media (prefers-reduced-motion: reduce) {
  .tip {
    transition: none;
  }
}
```

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

1. **ViewTransition table (5.1 / 5.3).** Add a row stating that Tooltip renders no
   `<ViewTransition>` and has no `transition` prop, and that this follows from 3.5. The current
   wording "every part whose mount, unmount or content is driven by library state" is correct but
   a reader of 5.1 alone will expect `Popup` to wrap.
2. **Augmentation file (7.4).** Resolved: the CSS properties are augmented on
   `React.CSSProperties` inside the single `declare module "react"`; a `csstype` augmentation is
   not possible (not a dependency; TS2664 under pnpm).
3. **Id-reference merging (1.2).** "Library-controlled attributes (`aria-*` state, `id` wiring)
   win over the element's" should carve out ARIA id-reference lists (`aria-describedby`,
   `aria-labelledby`), which are merged as token lists. A trigger can be described by more than
   its tooltip.
4. **Listeners via `addEventListener` (1.5 / 7.4).** Tooltip attaches hover/focus listeners
   through refs rather than React event props, so no `on*` prop is omitted from its types. 7.4
   permits this for events React does not synthesize; it should say a part may do the same for
   synthesized events when the handlers must be feature-detected away, and that only prop-form
   handlers are omitted from the type.
5. **Required coverage (10.1).** Add: "Rows that cannot apply to a component with no action props
   (sync, async, rejection, overlap, post-await, controlled/uncontrolled parity) are listed as N/A
   in a comment at the top of the test file, with the reason."
6. **`open` in the vocabulary (4.1).** The table lists `open` on Popup and Trigger; Tooltip emits
   neither because 7.4's "do not duplicate a pseudo-class for browser-owned state" rule applies.
   Suggest the row read "library-owned open state only; browser-owned open uses `:popover-open`".
7. **RSC context providers (7.1).** Not needed by Tooltip, but the rule "directive-free files must
   not import from files with the directive" conflicts with React 19.3's sanctioned pattern of
   rendering a client-module context provider from a server file. Worth a sentence when a
   component actually needs it.

---

## 12. Implementation notes

### 12.1 Files

```
packages/ui/src/tooltip/
  index.ts                     # no directive; namespace + type re-exports
  tooltip-context.ts           # "use client": TooltipContext (ids, options, element registration), TooltipPopupContext (side, align)
  tooltip-root.tsx             # "use client": useId, useState for elements, runs useTooltipInteraction, dev warnings
  tooltip-trigger.tsx          # "use client"
  tooltip-popup.tsx            # "use client"
  tooltip-arrow.tsx            # "use client" (reads TooltipPopupContext)
  use-tooltip-interaction.ts   # "use client": the effect from section 2.2
  tooltip.test.tsx
packages/ui/src/internal/platform-attributes.d.ts   # add interestfor + interest-delay-* (section 9)
packages/ui/src/internal/anchor-position.ts         # positionArea(side, align), parsePositionArea (conventions 13; directive-free)
packages/ui/src/internal/use-resolved-placement.ts  # "use client": useResolvedPlacement({ side, align }) → { side, align, ref } (conventions 13.2)
packages/ui/src/__tests__/popover-shim.ts            # jsdom shim (section 13)
```

`index.ts`:

```ts
import { TooltipRoot } from "./tooltip-root.js";
import { TooltipTrigger } from "./tooltip-trigger.js";
import { TooltipPopup } from "./tooltip-popup.js";
import { TooltipArrow } from "./tooltip-arrow.js";

export const Tooltip = {
  Root: TooltipRoot,
  Trigger: TooltipTrigger,
  Popup: TooltipPopup,
  Arrow: TooltipArrow,
} as const;
export type { TooltipRootProps, TooltipRootState } from "./tooltip-root.js";
export type { TooltipTriggerProps, TooltipTriggerState } from "./tooltip-trigger.js";
export type {
  TooltipPopupProps,
  TooltipPopupState,
  TooltipSide,
  TooltipAlign,
} from "./tooltip-popup.js";
export type { TooltipArrowProps, TooltipArrowState } from "./tooltip-arrow.js";
```

Add `src/tooltip/index.ts` to the tsdown `entry` list.

### 12.2 Context and element registration

```ts
// tooltip-context.ts
"use client";
export interface TooltipContextValue {
  readonly popupId: string;
  readonly disabled: boolean;
  readonly provides: "description" | "name";
  readonly setTriggerElement: (el: HTMLElement | null) => void;
  readonly setPopupElement: (el: HTMLElement | null) => void;
}
export const TooltipContext = createContext<TooltipContextValue | null>(null);
export const TooltipPopupContext = createContext<{
  side: TooltipSide | null;
  align: TooltipAlign;
} | null>(null);
```

`Root` holds `const [trigger, setTrigger] = useState<HTMLElement | null>(null)` and the same for
the popup, and passes the setters down. `Trigger` and `Popup` attach a callback ref that calls the
setter and returns a cleanup that sets `null` (merged with the consumer's `ref` and the
`render` element's ref). This costs one extra render per part on mount and makes the effect
independent of sibling mount order. A part used outside `Root` throws in development with a clear
message.

### 12.3 The interaction effect

```ts
// use-tooltip-interaction.ts
"use client";
export function useTooltipInteraction(
  trigger: HTMLElement | null,
  popup: HTMLElement | null,
  options: { delay: number; closeDelay: number; disabled: boolean; interestForRequested: boolean },
): void {
  // `interestForRequested` is reported by the Trigger to the Root (layout effect) so this effect
  // re-runs and re-detects the native path when `experimental_interestFor` flips after mount.
  const getOptions = useEffectEvent(() => options);
  useEffect(() => {
    if (trigger === null || popup === null || options.disabled) return;
    // Native path: Chromium with the flag on. Per-element check so a rendered <div> never matches.
    if (trigger.hasAttribute("interestfor") && "interestForElement" in trigger) return;

    let open = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const clear = () => {
      if (timer !== undefined) {
        clearTimeout(timer);
        timer = undefined;
      }
    };
    // show/hide are skipped when the popup is no longer in the document: the passive cleanup
    // runs after DOM removal on unmount, and hidePopover() on a disconnected popover throws.
    // `open` is set synchronously here; the async `toggle` event only reconciles it afterwards.
    const isOpen = () => open || popup.matches(":popover-open");
    const show = () => {
      clear();
      timer = setTimeout(() => {
        if (!isOpen() && popup.isConnected) {
          popup.showPopover({ source: trigger });
          setOpen(true);
        }
      }, getOptions().delay);
    };
    const hide = () => {
      clear();
      timer = setTimeout(() => {
        if (isOpen() && popup.isConnected) {
          popup.hidePopover();
          setOpen(false);
        }
      }, getOptions().closeDelay);
    };
    const hideNow = () => {
      clear();
      if (isOpen() && popup.isConnected) {
        popup.hidePopover();
        setOpen(false);
      }
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        // Only installed while open: consume the key so a modal <dialog> or auto popover around
        // the tooltip does not also close (verified in Chromium 153; works for manual and hint).
        e.preventDefault();
        hideNow();
      }
    };
    // While a show timer is pending (document listeners not yet installed), a click or Escape
    // on the trigger must cancel it, or the tooltip would open after the user acted.
    const onTriggerPointerDown = () => clear();
    const onTriggerKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") clear();
    };
    const setOpen = (next: boolean) => {
      if (open === next) return;
      open = next;
      if (open) {
        document.addEventListener("keydown", onKeyDown);
        document.addEventListener("pointerdown", hideNow, true);
      } else {
        document.removeEventListener("keydown", onKeyDown);
        document.removeEventListener("pointerdown", hideNow, true);
      }
    };
    // Reconciles opens and closes the library did not perform (native light dismiss on `hint`).
    const onToggle = (e: Event) => setOpen((e as ToggleEvent).newState === "open");
    const onEnter = (e: PointerEvent) => {
      if (e.pointerType !== "touch") show();
    };
    const onFocus = () => {
      if (trigger.matches(":focus-visible")) show();
    };

    trigger.addEventListener("pointerenter", onEnter);
    trigger.addEventListener("pointerleave", hide);
    trigger.addEventListener("focus", onFocus);
    trigger.addEventListener("blur", hide);
    trigger.addEventListener("pointerdown", onTriggerPointerDown);
    trigger.addEventListener("keydown", onTriggerKeyDown);
    popup.addEventListener("pointerenter", clear);
    popup.addEventListener("pointerleave", hide);
    popup.addEventListener("toggle", onToggle);
    return () => {
      hideNow();
      trigger.removeEventListener("pointerenter", onEnter);
      /* ... remove the rest, including the document listeners ... */
    };
  }, [trigger, popup, options.disabled, options.interestForRequested]);
}
```

Open state is a local variable, never React state (conventions 3.5). It is set immediately when
the library calls `showPopover()` / `hidePopover()` and reconciled from the platform's `toggle`
event for opens and closes the library did not perform (native light dismiss on `hint`), with
`:popover-open` as the authoritative check, so the document listeners are never a task behind the
top layer. `toggle` is dispatched asynchronously after `showPopover()` (reviewer probe: a
pointerdown in the same task would otherwise leave the popup open).

`popup.showPopover` is called with the `source` option in all three engines (Chrome 137, Firefox
144, Safari 26.0). No feature check.

### 12.4 Rendering details

- `Trigger`: `type="button"` default; `interestfor={popupId}`, the two `interestDelay*` style
  entries (`interestDelayStart` as the `calc()` of section 6), the `data-fsui-tooltip-trigger`
  marker and the hoisted `<style href="@funstack/ui/tooltip-warm" precedence="fsui"
  nonce={csp?.nonce}>` (`TOOLTIP_WARM_RULES` from `internal/tooltip-warm.ts`, directive-free)
  only when `experimental_interestFor && !disabled`; `aria-describedby` / `aria-labelledby`
  merged token lists per `provides`; `data-disabled` by presence. No `aria-expanded`.
- `Popup`: `id={popupId}`, `popover={experimental_hint ? "hint" : "manual"}`, `role="tooltip"`,
  inline positioning per section 7 (the requested keywords), `data-side` / `data-align` when
  `side !== null` (owned keys only then; with `side={null}` they are neither emitted nor owned,
  so a `render` element or stylesheet-driven `data-side` passes through), `data-disabled`.
  The values come from `useResolvedPlacement({ side, align })` (7.4), whose `ref` is merged
  with `ctx.setPopupElement` and the consumer's ref; `state` carries the same values. Provides
  `TooltipPopupContext` with them.
- `Arrow`: `aria-hidden="true"`, `data-side` / `data-align` from `TooltipPopupContext` (the
  resolved values).
- All three resolve `className` / `style` / `children` / `render` through the shared
  `use-render.tsx` helper. Props spread order: library attributes, then consumer attributes, then
  library-controlled attributes re-applied (`id`, `popover`, `role`, `aria-hidden`, data state),
  with the id-reference merge applied before that step.

### 12.5 Dev-only checks (in `Root`'s effect)

```ts
if (process.env.NODE_ENV !== "production" && trigger && popup) {
  // console.error, once per instance per kind, like the shared useDevWarning helper.
  if (provides === "name" && trigger.hasAttribute("aria-label"))
    console.error(
      '[Tooltip] provides="name" with aria-label on the trigger announces the name twice. Remove aria-label.',
    );
  // A roving-tabindex item (explicit tabindex="-1" inside a menu, tablist, toolbar, radiogroup,
  // listbox, grid, tree or [focusgroup]) is reachable with the arrow keys (#57).
  if (trigger.tabIndex < 0 && !isRovingItem(trigger))
    console.error("[Tooltip] the trigger is not focusable; keyboard users cannot open the tooltip.");
  if (popup.querySelector("a[href],button,input,select,textarea,[tabindex]"))
    console.error("[Tooltip] tooltips must not contain interactive content.");
}
```

---

## 13. Test plan

jsdom 30.1.3 (installed) has **no Popover API**: `HTMLElement.prototype.showPopover`,
`hidePopover`, `togglePopover` and the `popover` IDL property are undefined, `ToggleEvent` does not
exist, and `matches(":popover-open")` returns `false` for everything. The test file therefore
uses a shim and asserts on calls, not on visibility.

`src/__tests__/popover-shim.ts`, loaded from `vitest.setup.ts`: defines `showPopover(options)`,
`hidePopover()` and `togglePopover()` on `HTMLElement.prototype` if missing. They keep a
module-level `WeakSet` of open elements, ignore redundant calls, and dispatch `beforetoggle` and
`toggle` `Event`s with `oldState` / `newState` properties set. The implementation reads open
state only from `toggle` (section 12.3), so the shim drives it fully. Tests spy with
`vi.spyOn(HTMLElement.prototype, "showPopover")`. Fake timers (`vi.useFakeTimers()`) drive the
delays; `user-event` must be configured with `advanceTimers`.

Coverage against conventions 10.1. "both" rows have no controlled mode here.

| Row                                               | Tooltip tests                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| ------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Roles and ARIA                                    | Default elements and `type="button"`; `div[popover="manual"][role="tooltip"]` with `id` equal to the trigger's `aria-describedby`; `provides="name"` yields `aria-labelledby` and no `aria-describedby`; consumer `aria-describedby="x"` becomes `"x <id>"`; `experimental_hint` renders `popover="hint"`; `experimental_interestFor` renders `interestfor="<id>"` and `interest-delay-start/end` styles from `delay`/`closeDelay`; `disabled` renders `data-disabled` on Trigger and Popup and no `interestfor`; Arrow renders `aria-hidden` and `data-side`. |
| Keyboard                                          | Tab to trigger then advance `delay`: `showPopover` called once with `{ source: trigger }`; Escape: `hidePopover` called; Tab away then advance `closeDelay`: `hidePopover` called; Escape when closed: no call. `:focus-visible` in jsdom: verify nwsapi support in setup; if absent, stub `matches` for that selector in the shim.                                                                                                                                                                                                                            |
| Hover (pattern-specific)                          | `pointerenter` then advance `delay`: shown; leave before `delay`: never shown; leave after open then advance `closeDelay`: hidden; enter popup inside `closeDelay`: not hidden; `pointerType: "touch"`: never shown; `pointerdown` on `document.body` while open: hidden immediately; `delay={0}`: shown on the next tick.                                                                                                                                                                                                                                     |
| Skip-delay (wave 11)                              | Two Roots A and B. A open (shim `:popover-open` via the `WeakSet`, `matches` stubbed for `[role="tooltip"]:popover-open`): `pointerenter` on B's trigger calls `showPopover` on B **synchronously** (no timer advance) and `hidePopover` on A; the same for `:focus-visible` focus; A's pending close timer firing afterwards calls nothing more. Nothing open: B waits `delay`. A non-FUNSTACK `<div role="tooltip" popover>` open in the document counts. Re-entering A's own trigger while A is open: no call. Native markup: with `experimental_interestFor` the Trigger renders `interest-delay-start: calc(250ms * (1 - var(--fsui-tooltip-warm, 0)))`, `data-fsui-tooltip-trigger`, and exactly one `<style>` in `document.head` whose text contains `@property --fsui-tooltip-warm` (two flagged Roots: still one); without the flag none of the three; `disabled`: none; `nonce` from a `<CSPProvider nonce="n">` lands on the `<style>`. |
| Sync action                                       | **N/A**: Tooltip has no action props. The test file states this in a leading comment and includes a type-level test (`// @ts-expect-error`) that `openChangeAction` and `open` are not accepted.                                                                                                                                                                                                                                                                                                                                                               |
| Async action, Rejection, Overlap, Post-await rule | **N/A**, same reason.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| Suspending content                                | Popup child suspends at mount with a `<Suspense>` inside Popup: fallback renders inside the popup, no `data-pending` anywhere, trigger still mounted; after resolve, content present.                                                                                                                                                                                                                                                                                                                                                                          |
| Function props                                    | `className` / `style` / `children` on Trigger receive `{ disabled }`; on Popup `{ disabled, side, align }`; on Arrow `{ side, align }`; attributes agree.                                                                                                                                                                                                                                                                                                                                                                                                      |
| `render` element                                  | `render={<a href="/x" />}` renders an anchor with the ARIA relation and working hover; a custom component receives `ref`; `render={<span />}` with `experimental_interestFor` still uses the JS path (and the dev warning fires for `tabIndex < 0`).                                                                                                                                                                                                                                                                                                           |
| Controlled/uncontrolled parity                    | **N/A**: no controllable state.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| Native step-aside                                 | Define `interestForElement` on `HTMLButtonElement.prototype` for one test, render with `experimental_interestFor`, hover and advance: `showPopover` **not** called. Without the flag under the same stub: called (flag gates the detection).                                                                                                                                                                                                                                                                                                                   |
| Positioning                                       | `side`/`align` matrix produces the `position-area` values in section 7.1 and the fallbacks string (the six-row matrix of conventions 13.1, including `inline-end` → `self-x-end`); `side={null}` emits neither style nor `data-side`; consumer `style.positionArea` wins.                                                                                                                                                                                                                                                                                                                                                                      |
| Resolved placement (wave 11)                      | In jsdom (no layout, `getComputedStyle(popup).positionArea` is `""`) `data-side` / `data-align` on Popup and Arrow equal the requested values while open; with `getComputedStyle` stubbed to return `positionArea: "span-left bottom"` (`direction: "ltr"`) and the shim's `toggle(open)` dispatched, both read `data-side="bottom" data-align="end"` and the function props agree; the stub returning `"span-all bottom"` (Firefox's form) gives `bottom` / `center`; `"span-self-x-end bottom"` gives `start` in LTR and in RTL alike; `toggle(closed)` restores the requested values; a render counter on Popup shows no extra render when the stub returns the requested keywords; `side="inline-end"` renders `data-side="inline-end"` while closed and `right` / `left` by the stubbed `direction` while open, and the counter shows **exactly one** render per show and one per hide (review M1); `side={null}` never calls `getComputedStyle`. Scroll path (review M2, deterministic): `requestAnimationFrame` replaced by a manual queue and `document.addEventListener` / `removeEventListener` spied: a show installs `scroll` (capture) and `resize`; `document.dispatchEvent(new Event("scroll"))` with the stub changed reads the old value at once and in frame 1 and writes the new one in frame 2; a second scroll between the frames re-runs the pair, and a scroll before the first frame of a pending pair triggers at most one extra pair (the restart flag, not a queue); `toggle(closed)` and unmount remove both listeners, `cancelAnimationFrame` the pending frame and call `getComputedStyle` no more. No `ResizeObserver` in jsdom: the hook guards `typeof ResizeObserver`. The parser table itself lives in `anchor-position.test.ts` (conventions 13.2's serialisations, `null` for `none`, `""`, unknown tokens and a vertical `writing-mode`). |
| Disabled                                          | Hover and focus never call `showPopover`; toggling `disabled` to true while open hides the popup on **both** paths: JS via the effect cleanup, native by an explicit `hidePopover()` when `interestfor` is removed (the browser does not hide it; reviewer probe).                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| Dev warnings                                      | `provides="name"` plus `aria-label`, a non-focusable trigger, and interactive popup content each log one `console.error` per instance.                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| Directive                                         | All five part files in `src/tooltip/` (`tooltip-context`, `-root`, `-trigger`, `-popup`, `use-tooltip-interaction`; no Arrow in v0) begin with `"use client"` in `dist`; `index.ts` does not.                                                                                                                                                                                                                                                                                                                                                                                                                                                              |

Browser mode only (not covered by jsdom; noted at the top of the test file, per conventions
10.1): actual visibility and `:popover-open`, anchor placement and fallback flips, the
`@starting-style` animation, Chromium's native `interestfor` behaviour, Safari's `hint` to
`manual` degradation, `hint` stacking over an `auto` menu. These are demonstrated in the example
app until vitest browser mode is adopted (separate decision; adopted since, `tooltip.browser.test.tsx`).

Browser rows added in wave 11 (`tooltip.browser.test.tsx`, Chromium, Firefox, WebKit; the
first real WebKit check of the computed-style claim, which the research took from source):

| Row | Assertion | Engine branches |
| --- | --- | --- |
| Resolved side on open | A trigger at the top of the viewport with `side="top"`: once shown, `data-side="bottom"` on Popup and Arrow, `state.side === "bottom"` in a `className` function; the Arrow's rect touches the popup's top edge (the docs CSS). A trigger in the middle: `data-side="top"`, and a render counter shows one render for the open (the `toggle`-driven interaction effect writes no state; the hook wrote none). | none |
| Resolved side after scroll | The trigger inside a scrollable container, tooltip open above it; scroll the container so the trigger reaches the container's top, wait two frames: `data-side` equals the side the popup box is on relative to the trigger (`placedSide` helper): `bottom` where the engine re-chose (Firefox, WebKit), `top` where it kept the option chosen at show (Chromium 156, bug #92; the popup is scroll-compensated); the tooltip stays open. On close, `data-side` is `top` again. | The invariant holds everywhere; the engine outcome is pinned behind a runtime probe (`topLayerAnchorReChoosesOnScroll`, async, in `engine.ts` or a per-row expectation), so the Chromium branch fails, citing #92, the day Chromium re-chooses (review L5). |
| Native path | With `experimental_interestFor` and `experimental_hint`, the row above on open: the observer runs on the native path too (product-owner question 1 of the amendment). | `supportsInterestFor`: native open by real hover; elsewhere the JS path opens, same assertion. |
| Inline side and RTL | `side="inline-end"`: the popup's left edge meets the trigger's right edge in LTR with `data-side="right"`; under `document.documentElement.dir = "rtl"` the popup's right edge meets the trigger's left edge with `data-side="left"`. `align="start"` on `side="bottom"` under page RTL: the right edges meet (`data-align="start"`). | none |
| Container RTL | The same two assertions with `dir="rtl"` on a wrapper `div` around the Trigger and Popup and an LTR document. | `anchorPositionHonoursParentDirection` true (Chromium, WebKit): mirrored as above. False (Firefox, Mozilla 2019601): the popup's inline edges meet neither trigger edge (the mirrored offset); assert that and the comment names the bug. Never skipped. |
| Skip-delay (wave 11) | Two adjacent triggers, `delay={400}`: hover A with the real pointer, wait for it; move straight to B: B is `:popover-open` within 100 ms and A is closed; 800 ms after leaving both, hover B: it waits about 400 ms. On the flagged (native) markup in Chromium, `getComputedStyle(triggerB).interestDelayStart` is `0s` while A is open and `0.4s` otherwise. | `supportsInterestFor` with the flags on: the native path (no library listener runs); elsewhere the JS path under the same markup; both branches assert the same timings. `supportsPopoverHint` false (Safari 27.0): `manual`, the JS path hides A. |

---

## 14. Open questions for the product owner

1. **"Zero-JS" reading.** No Tooltip part can be directive-free (section 2.4). Accept "no
   runtime behaviour JS on the native path, client components still hydrate", or ask for the
   `children`-function variant of `Root` that makes `Trigger` and `Popup` directive-free at the
   cost of a second API shape. Recommendation: accept.
2. **Baseline popover type `manual`.** Chosen over `auto` so tooltips never close open menus.
   The price is that the library owns Escape and outside-click in JS until `hint` is universal.
3. **No `open` / `openChangeAction` / `data-open` in v0** (section 4.1). Confirm that a tooltip
   is the first component with no action prop at all.
4. **Focus delay.** Keyboard focus waits `delay` like hover (parity with Chromium's native
   behaviour). Radix and Base UI open instantly on focus. Keep parity, or special-case focus to 0?
5. **Prop name `provides`** for the name/description relation. Alternatives considered:
   boolean `label` (ambiguous with string labels), `relation` (vague).
6. **No skip-delay group** in v0 (section 6).
7. **Arrow ships thin** and mis-points after a fallback flip (section 3). Ship it, or hold it
   back until a resolved-side signal exists? (Held: conventions resolved question 10. The
   signal exists since wave 11, section 7.4; see the amendment below.)
8. **vitest browser mode** is the only way to test what this component actually does in a
   browser. The jsdom plan tests the JS shim and the markup only.

---

## Amendment: resolved side and direction (wave 11, 2026-10-23, issues #20 and #53)

Status: **accepted** (product owner, 2026-10-23; see "Decisions recorded" below). Inputs: `docs/research/positioning-wave11.md` (binding verdicts),
conventions 13 (new, the cross-component rules), `memo/architect/positioning-wave11-notes.md`.
The sections above are edited in place (decisions 7 and 11, the parts table, 3, 4, 7.1, 7.3,
7.4, 7.5, 10, 12.1, 12.4, 13); this section is the audit trail, the migration notes and the
questions.

### What changed

| | v0 (as accepted) | Wave 11 |
| --- | --- | --- |
| `data-side` / `data-align`, `state.side` / `state.align` | the requested props | the **resolved** placement while shown (computed `position-area`, parsed by the shared hook; conventions 13.2), the requested props otherwise |
| Arrow after a `position-try-fallbacks` flip | points away from the trigger (documented) | points at the trigger (the attribute moved) |
| `side` values | `top` / `bottom` / `left` / `right` | plus `inline-start` / `inline-end` (`self-x-*`) |
| `align` `start` / `end` on `top` / `bottom` | physical (`span-right` / `span-left`) | inline-relative (`span-self-x-end` / `span-self-x-start`): identical in LTR, mirrored in RTL |
| Container `dir="rtl"` | ignored by `start` / `end` (physical) | followed (Chromium, WebKit); Firefox misplaced by Mozilla 2019601, asserted, no workaround |
| Renders per open | none | none unless the popup flipped (then one on open, one on close) |
| Files | | `internal/anchor-position.ts` gains `parsePositionArea`; new `internal/use-resolved-placement.ts` |

### Why this way

- **Resolved, under the same name.** The research asked whether `data-side` should become
  the resolved value or a new attribute should carry it. Same name: conventions 4.1 gives a
  state one name in three forms, every arrow or gap recipe would otherwise need two selectors,
  and the requested value is the consumer's own prop. Prior art (Radix, Base UI) does the same.
- **Observation, not positioning.** The v0 objection to a resolved side was that it needed
  `getBoundingClientRect` comparisons after every open and scroll, which is Floating UI's job
  re-done. The computed `position-area` is exact, includes the flip the browser chose, is
  current synchronously and inside `scroll` handlers, and needs no rectangle. The browser keeps
  placing; the hook reports (conventions 3.5, a new rule).
- **First frame right.** A `ResizeObserver` observing from mount sees the hidden-to-shown size
  change after layout and before paint, so the attribute is in the DOM before the first paint
  without touching the `showPopover()` call sites. `toggle` alone would leave one task (and
  possibly one frame) with the requested side.
- **No render for the common case.** The hook writes state only when the resolved pair
  differs from what it holds; most tooltips open where asked. This preserves 4.1's reason for
  not emitting `data-open`.
- **`self-*`, not a direction read.** The #53 proposal was to read the anchor's computed
  `direction` at open and pick physical keywords. The `self-x-*` keywords give the same answer
  from CSS, before hydration, and never go stale; and they gain nothing in Firefox either way,
  whose bug is independent of the keywords (conventions 13.1, 13.3).
- **Inline-relative `align`.** A reader of `align="start"` on a bottom tooltip in an RTL page
  expects the inline-start edges to meet. v0 said "physical keywords only, matching every
  prior-art library", which was true of Floating UI without a direction provider and not of
  React Aria; with `self-x-*` the library gets the logical reading for free.
- **`inline-start` / `inline-end` as public `side` values**, rather than a Menu-internal
  submenu default: a tooltip or popover "beside the trigger in reading direction" is a real
  call site that otherwise needs `side={null}` and a stylesheet, and the shared helper has the
  cells anyway. `block-*` values are not offered: the library assumes `horizontal-tb`, where
  they equal `top` / `bottom`.
- **The Arrow part.** Conventions resolved question 10 held `Arrow` "until a component shows it
  cannot be done in CSS on the popup itself". A pseudo-element arrow keyed on the Popup's
  resolved `data-side` is now correct after flips (the `::after` recipe in section 10), so the
  CSS route works; the part is still the better call site for an SVG arrow, a two-layer
  border-plus-fill arrow, or `render`, and the user picked #20 for this wave. Recommendation
  below.

### Test rows

jsdom: the "Resolved placement" row of section 13 and the parser table in
`anchor-position.test.ts`. Browser: the five rows at the end of section 13 (resolved side on
open, after scroll, on the native path, inline side and page RTL, container RTL with the
`anchorPositionHonoursParentDirection` branch). The probe itself is in
`src/__tests__/engine.ts` (conventions 13.3).

### Migration (0.1.0-alpha.9)

- A stylesheet that keyed a gap or an arrow on `data-side` now follows flips; nothing to do
  unless the stylesheet relied on the stale value.
- `align="start"` / `"end"` on `side="top"` / `"bottom"` mirror under RTL; an RTL consumer who
  compensated with `style={{ positionArea }}` can drop the override.
- `TooltipSide` widens by two members; exhaustive switches gain two cases. `state.side` is
  physical only while shown.
- Entry animations keyed on `data-side` with `@starting-style` start from the requested side on
  a flipped open (7.4); key them on opacity, or accept it.
- Docs: the Tooltip page's data-attribute table and the sentence "`data-side` is the side you
  asked for" change; the Arrow recipe uses logical insets; the `inline-end` example is added.

### Questions for the product owner

1. **The observer runs on the native path too.** With `experimental_interestFor` the
   interaction effect attaches nothing ("the library attaches nothing on the native path",
   2.1). The resolved-side hook attaches a `ResizeObserver`, `toggle`, `scroll` and `resize`
   through the Popup's ref regardless of path. Recommendation: accept; that decision was about
   not altering interaction, and the hook changes no behaviour. Alternative: skip the hook when
   the trigger has native `interestfor`, leaving `data-side` requested there (the Arrow would
   mis-point on the native path only).
2. **Ship `Tooltip.Arrow` now** (designed in section 3, never implemented under resolved
   question 10), or keep it held and document the `::after` recipe only? Recommendation: ship
   it, since the resolved side removes the reason to hold and the user chose #20; the recipe
   stays in the docs as the zero-markup alternative. If held, nothing else in this amendment
   changes.
3. **Same name for the resolved value** (`data-side`), no `data-resolved-side`. Recommendation:
   confirm.
4. **Inline-relative `align`** and the two new `side` values on Tooltip, Popover and Menu.
   Recommendation: confirm (behaviour change under RTL only; type widening).
5. **Firefox 2019601 ships unworked-around**, asserted by a runtime probe; the human comment
   on the bug is listed in the research. Recommendation: confirm.

#### Decisions recorded (product owner, 2026-10-23)

All five as recommended: (1) the observer runs on the native `interestfor` path, because it
only observes and never interacts; (2) **`Tooltip.Arrow` ships now**: the user chose #20 for
this wave, which supersedes conventions resolved question 10 (recorded there; the `::after`
recipe stays as the zero-markup alternative); (3) `data-side` carries the resolved value under
the same name; (4) inline-relative `align`, the `inline-start` / `inline-end` sides, `inline-end`
as the submenu default; (5) no workaround for Mozilla 2019601, asserted through the probe,
tracked as the human task **#89**. Part A is implementable as written; Part B below builds on
it without reopening it.

### Part B: skip-delay (wave 11, 2026-10-23, issue #21)

Status: **accepted** (product owner and user, 2026-10-23; decisions at the end of this part).
Edited in place: decision 6, the 2.1 markup, the 2.2 table, section 6 (the whole skip-delay
entry), 12.4, the 13 rows. Inputs: `docs/research/interaction-wave11.md` 1 (binding).

| | v0 (as accepted) | Wave 11 |
| --- | --- | --- |
| Second tooltip while one is showing | waits the full `delay` on both paths | opens at once; the showing one is hidden at once |
| Scope | n/a | the document: any `[role="tooltip"]:popover-open`, FUNSTACK's or not |
| API | none | **none** (no provider, no prop, no `data-` state); the warm condition is available to CSS as `:root:has([role="tooltip"]:popover-open)` |
| Native path | inline `interest-delay-start: 250ms` | inline `calc(250ms * (1 - var(--fsui-tooltip-warm, 0)))`, the `data-fsui-tooltip-trigger` marker, and a hoisted `<style href="@funstack/ui/tooltip-warm">` (`@property` + one `:root:has()` rule), rendered only by a flagged Trigger, during SSR too |
| JS path | timer | `querySelector('[role="tooltip"]:popover-open')` at hover / focus start; hide it, show now |
| Files | | `internal/tooltip-warm.ts` (the CSS string and its hash entry, directive-free); `tooltip-trigger.tsx` renders the style and reads `CSPContext` |

Why no cooldown by default: the plain rule's window ("while the previous tooltip is still
showing", 150 ms close delay included) covers moving between adjacent controls; Radix's 300 ms
after a close needs the `:root` transition trick, which overrides an app's own `<html>`
transition and restyles the document on each change. Not offered in v1; a follow-up if asked.

Why the stylesheet is acceptable: it is the native path's only way to see another element's
state (an inline delay cannot), it carries no visual declaration, it cascades only onto
elements the library marks, and it degrades to the normal delay when blocked. It does widen
conventions 12 from "positioning only" to "placement and interaction timing", which is a user
decision (question below), and it is the first library stylesheet rendered during SSR, which
is why the CSP nonce provider ships in the same wave (conventions 12).

Migration: none for the baseline path beyond the behaviour (a second tooltip opens at once; a
consumer who wants the old behaviour has no opt-out in v1). Flagged markup gains an attribute, a
`calc()` and a `<style>` in `<head>`; nonce-based CSP consumers add `<CSPProvider nonce>`.

Questions for the product owner (continuing the Part A list):

6. **Skip-delay is global and has no opt-out, no provider, no prop.** Recommendation: confirm.
7. **The shipped skip-delay stylesheet has a selector** (on a library marker attribute, setting
   one `--fsui-` property), widening the user's "positioning only" decision on shipped CSS to
   "placement and interaction timing". Needs the user. Alternative: JS-path-only skip-delay,
   which makes the flags change UX (against decision 6 of this document).
8. **No cooldown** beyond the close delay in v1. Recommendation: confirm.

#### Decisions recorded (2026-10-23)

6 confirmed (global, no opt-out, no provider, no prop). 7 **user decision, "allow it"**: the
selector rule ships; conventions 12 now reads "placement and interaction timing, never
visuals". 8 confirmed (no cooldown).

### Implementation deviations folded (Part A, d3d0359, 2026-10-23)

From `memo/developer/positioning-wave11.md`; the sections above (7.4, the scroll row) and
conventions 13.2 / 10.1 are edited in place. The review (`memo/reviewer/wave11-positioning.md`)
may add to this list.

| Finding | What changed in the design |
| --- | --- |
| A scroll does not reliably re-choose the applied option: Chromium 156 keeps the option chosen at show unless the scroll comes within about a frame of it (the popup is scroll-compensated); Firefox re-chooses, readable one frame after the event | 13.2 no longer claims "no `requestAnimationFrame`": the observer re-reads at once and in the next two frames after `scroll` / `resize`. The scroll rows assert the geometry invariant (`data-side` equals the side the popup box is on), not "flips to X". The research's timing probe scrolled one frame after the show, which is the one case Chromium re-chooses. |
| `flip-block` / `flip-inline` swap the popup's own margins, so a one-sided gap keyed on the resolved `data-side` lands on the far edge | Gap recipes are symmetric along the side's axis (`margin-block` / `margin-inline`); popover.md 10 and menu.md 7 / 9 corrected; the Arrow is unaffected. |
| Firefox container-RTL submenu: the misplaced submenu overflows and `flip-inline` applies, so its resolved side is `right` | menu.md 13.2's degraded branch asserts the applied option and the misplacement, not `left`. |
| Smaller | `parsePositionArea` takes a fourth `writingMode` argument and `rootDirection` may be a function; the observer stores `null` when the result equals the request and writes with `flushSync` from its event paths; a hidden-but-rendered popup keeps its resolved value until the box goes. |

Part B (skip-delay here; press-drag-release, touch offset, close-on-scroll and CSP in
context-menu.md) relies on none of the corrected claims: the touch gap is an inset inside
each `@position-try` option, not a margin, and nothing in Part B reads the computed
`position-area`.

### Review fold (Part A, `memo/reviewer/wave11-positioning.md`, b2f2c34, 2026-10-23)

Verdict "acceptable with minor fixes"; the code fixes are the developer's (fix-wave11a). The
design-side items, folded in place (conventions 13.2 and 10.1, 7.4 above, the 13 rows,
popover.md 10, menu.md 9):

| Item | What changed in the design |
| --- | --- |
| M1 | "No render for an unflipped open" holds for a physical `side` only; a logical side costs one render per show and one per hide (the physical `data-side` never equals the request), inherent and now stated; a jsdom render-count row pins it. |
| M2 | Deterministic jsdom rows for the scroll path (manual `requestAnimationFrame` queue, spied document listeners): install on show, old value in frame 1 and new in frame 2, re-run on a scroll between frames, removal and frame cancellation on hide and unmount. |
| M3 | The two-frame lag is both engines' (scroll-dependent anchoring applies a frame after the event; the snapshot timing is unspecified, §3.3); Chromium 156 keeping an overflowing option for a top-layer popover is a separate, non-conformant behaviour (§6.5), human task **#92**, cited from the scroll rows; "Not covered" gains the one stale painted frame after a scroll-driven flip. |
| L4 | Two correct gap recipes: a static margin on the requested edge (preferred for a class that knows its side; present at the first layout, never fallback-sensitive) or a symmetric margin keyed on `data-side` with the closed `inline-start` / `inline-end` values included; a one-sided margin on the resolved side is the wrong form. The docs and example CSS follow whichever the fix lands; both are in the design. |
| L5 | Tooltip's scroll row pins the engine outcome behind the async `topLayerAnchorReChoosesOnScroll` probe (Chromium false, Firefox true, stable at every show-to-scroll delay and under CPU load) so the Chromium branch fails, citing #92, when the bug is fixed; the Firefox container-RTL submenu row asserts `right` outright. **Popover's scroll row stays unpinned** (accepts either side, cites #92): Chromium re-chooses there in every run although the probe says it would not, an unexplained difference recorded in #92 (fixes 0cb9d23..d0a48a3). |
| M2 note | A scroll before the first frame of a pending pair sets the same restart flag, so it costs at most one extra pair at the end (kept; a jsdom row pins "at most one more pair"). |
| L4 landed | Menu docs and example CSS use the symmetric `data-side` form with the `inline-start` / `inline-end` keys (menu.md 9); the Popover page leads with the static requested-edge margin and shows the any-side keyed form second (popover.md 10). Both are the design's forms. |

### Review fold (Part B, `memo/reviewer/wave11-interaction.md`, e411798, 2026-10-23)

Verdict "acceptable with minor fixes"; the code fixes are the developer's (fix-wave11b).
Design-side items, folded in place (section 6, decision 6, the 2.1 markup, 13; conventions 12):

| Item | What changed in the design |
| --- | --- |
| M1 | The inline value is `calc(<delay>ms * (1 - var(--fsui-tooltip-warm, 0)))`: without the fallback a missing stylesheet (strict CSP, `nonce.style` without a provider, a `render` element with its own children dropping the rule) left the property unregistered, the `var()` invalid and the delay at the UA's `normal` (500 ms), not "the normal delay" the text claimed. The `<style>` renders beside the Trigger element, not in its `children`. |
| M3 | The "skip the entry animation" CSS recipe is removed: it matches the opening tooltip itself and kills every cold entry transition. Instant browsing with cold animations kept needs library state; a follow-up if asked. |
| L5 | WCAG 1.4.13 "hoverable" is a recorded trade-off (crossing a neighbouring trigger on the way to a tooltip hides it), not "unchanged"; docs note added. |
| L1, L2 | Conventions 12 records Fizz's four nonce cases (the object form with no provider drops the rules) and the one-SSR-stylesheet-per-precedence constraint. |
