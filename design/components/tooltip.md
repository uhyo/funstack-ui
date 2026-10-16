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
| 6   | Delays                | `delay` (250 ms) and `closeDelay` (150 ms) on `Root`, matching Chromium's `interest-delay` defaults. Native path: inline `interest-delay-start/end` on the trigger. JS path: timers. Same delay for hover and keyboard focus. No "skip delay" group in v0.                                                                                 |
| 7   | Positioning           | `side` (`top`) and `align` (`center`) on `Popup` set inline `position-area` and `position-try-fallbacks`. `side={null}` emits nothing so a stylesheet can take over.                                                                                                                                                                       |
| 8   | Animation             | CSS only (`@starting-style`, `transition-behavior: allow-discrete`). No `<ViewTransition>` and no `transition` prop on any Tooltip part (conventions 3.5).                                                                                                                                                                                 |
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
| `Tooltip.Arrow`   | `span aria-hidden="true"`     | Decorative. Echoes `data-side` / `data-align` from the enclosing `Popup` so CSS can draw and place it. Must be a descendant of `Popup`.                                                   |

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
  style="interest-delay-start: 250ms; interest-delay-end: 150ms"
>
  Save
</button>
<div id="_r_1_" popover="hint" role="tooltip" ...>Saves the document (Ctrl+S)</div>
```

The browser does everything: hover and keyboard focus show the popup after the delay, moving
into the popup keeps it open, de-hover and blur hide it after the end delay, Escape hides it and
cancels interest, outside click light-dismisses (`hint`), the popup is implicitly anchored to the
trigger, Android long-press works, and opening the tooltip never closes an open `auto` popover.

The library's interaction effect checks, at mount, whether the trigger element has the
`interestfor` attribute **and** `"interestForElement" in triggerElement`. If both hold it attaches
no listeners at all. The two flags are designed to be set together; `experimental_interestFor`
without `experimental_hint` leaves a `manual` popup driven by interest, which still works in
Chromium (interest loss and Escape hide it) but has no outside-click dismissal.

### 2.2 Cross-engine JS (baseline, and every engine without `interestForElement`)

The effect in `Root` attaches, through `addEventListener` (not React event props, so nothing is
omitted from the trigger's prop type and consumer `onPointerEnter` et al. pass through untouched):

| Target                         | Event                                             | Behaviour                                                                                       |
| ------------------------------ | ------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| trigger                        | `pointerenter` (not `touch`)                      | start open timer (`delay`)                                                                      |
| trigger                        | `pointerleave`                                    | start close timer (`closeDelay`)                                                                |
| trigger                        | `focus` where `trigger.matches(":focus-visible")` | start open timer                                                                                |
| trigger                        | `blur`                                            | start close timer                                                                               |
| popup                          | `pointerenter`                                    | cancel close timer                                                                              |
| popup                          | `pointerleave`                                    | start close timer                                                                               |
| popup                          | `toggle`                                          | record open state (`event.newState === "open"`); install or remove the document listeners below |
| document (while open)          | `keydown` Escape                                  | hide now                                                                                        |
| document (while open, capture) | `pointerdown`                                     | hide now (covers outside click, click on the trigger, and click on the popup)                   |

Open means `popup.showPopover({ source: trigger })`, which creates the same implicit anchor and
nesting relationship as the declarative path. Close means `popup.hidePopover()`. Both calls are
guarded by the open state recorded from `toggle`, so they are never called redundantly. A timer
that fires after `disabled` became true, or after unmount, does nothing (the effect cleanup
clears timers and hides an open popup).

Why hover and focus share one delay: Chromium's `interest-delay-start` applies to both, and the
flags must not change the user-visible behaviour of a page. `delay={0}` opens instantly for
consumers who prefer that for keyboard users.

Why pointerdown anywhere, not only outside: a tooltip that stays over a button the user just
clicked (to open a menu, say) is the most common tooltip annoyance; `manual` popovers get no
light dismiss, so the library has to do this itself anyway. After an Escape or a click, nothing
reopens the tooltip until the pointer leaves and re-enters or focus leaves and returns. That
matches "Escape cancels interest" on the native path without extra state.

### 2.3 Behaviour per engine and flag

Stable engines on 2026-10-15: Chrome 155, Firefox 158, Safari 27.0.

| Flags                      | Chromium                                                                                                                                                                                                  | Firefox                        | Safari 27.0                                                                                                               |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------ | ------------------------------------------------------------------------------------------------------------------------- |
| none (baseline)            | `manual` + JS. Escape and any pointerdown handled by JS. Never closes `auto` popovers.                                                                                                                    | same                           | same                                                                                                                      |
| `experimental_hint`        | `hint`. Native light dismiss (Escape, outside click) and hint stacking (opening one hint closes other non-ancestor hints). JS listeners still installed; their hide calls are no-ops when already closed. | same as Chromium               | `hint` is unknown, treated as `manual`. Identical to baseline; the JS Escape and pointerdown handlers are what closes it. |
| `experimental_interestFor` | Native trigger. No JS listeners. Popup is `manual`, hidden by interest loss or Escape. Android long-press works.                                                                                          | attribute ignored, baseline JS | attribute ignored, baseline JS                                                                                            |
| both                       | Fully native.                                                                                                                                                                                             | as `experimental_hint` only    | as baseline                                                                                                               |

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
export type TooltipSide = "top" | "bottom" | "left" | "right";
export type TooltipAlign = "start" | "center" | "end";

export interface TooltipPopupProps extends Omit<
  ComponentPropsWithRef<"div">,
  "id" | "popover" | "role" | "className" | "style" | "children"
> {
  /** Placement relative to the trigger via inline `position-area`. Default "top". `null` emits no inline positioning. */
  side?: TooltipSide | null;
  /** Alignment along the side. Default "center". Ignored when `side` is null. */
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
  readonly side: TooltipSide | null;
  readonly align: TooltipAlign;
}
```

`id`, `popover` and `role` are library-controlled and removed from the type. The consumer's
`style` is merged over the library's inline positioning (consumer wins), so
`style={{ positionArea: "bottom span-right" }}` overrides `side` for one-offs.

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

The arrow is deliberately thin: it reflects the _requested_ side, not the side the browser
resolved after a `position-try-fallbacks` flip. CSS exposes no resolved-placement signal, and
measuring it in JS on every open would reintroduce the positioning code this design exists to
avoid. An arrow therefore points the wrong way after a flip in v0; consumers who care can drop the
arrow or disable fallbacks. Resolved-side exposure is listed as future work (section 7.3).

---

## 4. State

| State       | Owner                                             | Where it shows                                                                                                                                        |
| ----------- | ------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| open        | **browser** (popover visibility state, top layer) | `:popover-open` on the popup; `.trigger:has(+ .popup:popover-open)` on the trigger; Chromium native path also `:interest-source` / `:interest-target` |
| disabled    | library (prop, not changeable by the user)        | `data-disabled` on Trigger and Popup; `state.disabled`                                                                                                |
| side, align | library (props)                                   | `data-side`, `data-align` on Popup and Arrow; `state.side`, `state.align`                                                                             |
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
| Escape              | closes; focus stays on the trigger; on the JS path the keydown is `preventDefault()`ed while the tooltip is open so an enclosing modal `<dialog>` does not close too (product-owner decision, mirrors close-watcher semantics for native `hint`; **pending the reviewer's verification in Chromium**). Escape or pointerdown on the trigger before `delay` elapses cancels the pending open |
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
- **No skip-delay group in v0.** Many libraries open a second tooltip instantly when another was
  just open (Radix `TooltipProvider`, Base UI `Tooltip.Provider`). Chromium's `interestfor` has no
  such behaviour, and the flags must not change UX, so the JS path does not add it. Doing it later
  would need a provider or module-level timestamp; both are deferred until there is a request.

---

## 7. Positioning

### 7.1 Built-in default

`Popup` sets, inline, from `side` and `align`:

| `side` \ `align` | `start`             | `center` | `end`              |
| ---------------- | ------------------- | -------- | ------------------ |
| `top`            | `top span-right`    | `top`    | `top span-left`    |
| `bottom`         | `bottom span-right` | `bottom` | `bottom span-left` |
| `left`           | `left span-bottom`  | `left`   | `left span-top`    |
| `right`          | `right span-bottom` | `right`  | `right span-top`   |

plus `position-try-fallbacks: flip-block, flip-inline, flip-block flip-inline`. The `center`
column uses the single-keyword form (`top` means the top row spanning all three columns) because
CSS Anchor Positioning aligns a span-all cell with `anchor-center`, so the popup is centred on the
trigger and may be wider than it. The popover UA stylesheet already supplies `position: fixed`,
and the implicit anchor comes from `interestfor` or `showPopover({ source })`, so no `anchor-name`
or `position-anchor` is needed anywhere.

Physical keywords only, matching every prior-art library. Writing-mode-aware placement is a CSS
override (`position-area: block-start`), which is why the override path has to be first class.

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
- Arrow placement that survives a fallback flip has no CSS solution today. Candidates for later:
  `@position-try` rules cannot carry custom properties; a JS `data-side` resolved from
  `getBoundingClientRect` after `toggle` is possible but is exactly the positioning JS the design
  avoids. Deferred.

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
    overlay 120ms allow-discrete;
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

`overlay` is Chromium-only and harmless elsewhere (survey). Note for Firefox: `anchor()` values
cannot be animated there, so animate `translate`/`opacity`, never the anchor insets.

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
.tip-arrow[data-side="top"] {
  bottom: -4px;
  left: calc(50% - 4px);
}
.tip-arrow[data-side="bottom"] {
  top: -4px;
  left: calc(50% - 4px);
}
.tip-arrow[data-side="left"] {
  right: -4px;
  top: calc(50% - 4px);
}
.tip-arrow[data-side="right"] {
  left: -4px;
  top: calc(50% - 4px);
}
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
    const show = () => {
      clear();
      timer = setTimeout(() => {
        if (!open && popup.isConnected) popup.showPopover({ source: trigger });
      }, getOptions().delay);
    };
    const hide = () => {
      clear();
      timer = setTimeout(() => {
        if (open && popup.isConnected) popup.hidePopover();
      }, getOptions().closeDelay);
    };
    const hideNow = () => {
      clear();
      if (open && popup.isConnected) popup.hidePopover();
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        // Only installed while open: consume the key so a modal <dialog> around the tooltip
        // does not also close (close-watcher-like; pending reviewer verification in Chromium).
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
    const onToggle = (e: Event) => {
      open = (e as ToggleEvent).newState === "open";
      if (open) {
        document.addEventListener("keydown", onKeyDown);
        document.addEventListener("pointerdown", hideNow, true);
      } else {
        document.removeEventListener("keydown", onKeyDown);
        document.removeEventListener("pointerdown", hideNow, true);
      }
    };
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

Open state is a local variable fed by the platform's `toggle` event, never React state
(conventions 3.5). It also catches opens and closes the library did not perform (native light
dismiss on `hint`), so the document listeners are always in sync with the top layer. The
`toggle` event is dispatched asynchronously after `showPopover()`; a second `show` timer cannot
fire in between because `show` clears the timer first.

`popup.showPopover` is called with the `source` option in all three engines (Chrome 137, Firefox
144, Safari 26.0). No feature check.

### 12.4 Rendering details

- `Trigger`: `type="button"` default; `interestfor={popupId}` and the two `interestDelay*` style
  entries only when `experimental_interestFor && !disabled`; `aria-describedby` / `aria-labelledby`
  merged token lists per `provides`; `data-disabled` by presence. No `aria-expanded`.
- `Popup`: `id={popupId}`, `popover={experimental_hint ? "hint" : "manual"}`, `role="tooltip"`,
  inline positioning per section 7, `data-side` / `data-align` when `side !== null` (owned keys
  only then; with `side={null}` they are neither emitted nor owned, so a `render` element or
  stylesheet-driven `data-side` passes through), `data-disabled`. Provides `TooltipPopupContext`.
- `Arrow`: `aria-hidden="true"`, `data-side` / `data-align` from `TooltipPopupContext`.
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
  if (trigger.tabIndex < 0)
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
| Sync action                                       | **N/A**: Tooltip has no action props. The test file states this in a leading comment and includes a type-level test (`// @ts-expect-error`) that `openChangeAction` and `open` are not accepted.                                                                                                                                                                                                                                                                                                                                                               |
| Async action, Rejection, Overlap, Post-await rule | **N/A**, same reason.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| Suspending content                                | Popup child suspends at mount with a `<Suspense>` inside Popup: fallback renders inside the popup, no `data-pending` anywhere, trigger still mounted; after resolve, content present.                                                                                                                                                                                                                                                                                                                                                                          |
| Function props                                    | `className` / `style` / `children` on Trigger receive `{ disabled }`; on Popup `{ disabled, side, align }`; on Arrow `{ side, align }`; attributes agree.                                                                                                                                                                                                                                                                                                                                                                                                      |
| `render` element                                  | `render={<a href="/x" />}` renders an anchor with the ARIA relation and working hover; a custom component receives `ref`; `render={<span />}` with `experimental_interestFor` still uses the JS path (and the dev warning fires for `tabIndex < 0`).                                                                                                                                                                                                                                                                                                           |
| Controlled/uncontrolled parity                    | **N/A**: no controllable state.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| Native step-aside                                 | Define `interestForElement` on `HTMLButtonElement.prototype` for one test, render with `experimental_interestFor`, hover and advance: `showPopover` **not** called. Without the flag under the same stub: called (flag gates the detection).                                                                                                                                                                                                                                                                                                                   |
| Positioning                                       | `side`/`align` matrix produces the `position-area` values in section 7.1 and the fallbacks string; `side={null}` emits neither style nor `data-side`; consumer `style.positionArea` wins.                                                                                                                                                                                                                                                                                                                                                                      |
| Disabled                                          | Hover and focus never call `showPopover`; toggling `disabled` to true while open calls `hidePopover` (effect cleanup).                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| Dev warnings                                      | `provides="name"` plus `aria-label` warns; non-focusable trigger warns; interactive popup content warns.                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| Directive                                         | All six source files in `src/tooltip/` other than `index.ts` begin with `"use client"` in `dist`.                                                                                                                                                                                                                                                                                                                                                                                                                                                              |

Browser mode only (not covered by jsdom; noted at the top of the test file, per conventions
10.1): actual visibility and `:popover-open`, anchor placement and fallback flips, the
`@starting-style` animation, Chromium's native `interestfor` behaviour, Safari's `hint` to
`manual` degradation, `hint` stacking over an `auto` menu. These are demonstrated in the example
app until vitest browser mode is adopted (separate decision).

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
   back until a resolved-side signal exists?
8. **vitest browser mode** is the only way to test what this component actually does in a
   browser. The jsdom plan tests the JS shim and the markup only.
