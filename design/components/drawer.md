# Drawer

Status: **decided and implemented** (#168, part of #162). The decisions and the implementation
notes are in the 2026-11-26 #168 entries of `design/CHANGELOG.md`. Follows
`design/conventions.md`; where this document and the conventions disagree, the conventions win.
**Read `design/components/dialog.md` first**: a Drawer is a Dialog, and every rule of that
document applies unless this one says otherwise. This document states only what differs.

Inputs: `docs/vision.md`, `design/conventions.md`, `design/overlay-open-state.md`,
`design/placement.md` (the side vocabulary), `design/components/dialog.md` and
`alert-dialog.md` (the shape of a namespace that runs Dialog's code), `toast.md` 9.2 (the swipe
it reserves and does not have), `slider.md` (the library's one pointer gesture),
`docs/research/dialog.md`, the implemented `packages/ui/src/dialog/*`, prior art read on
2026-11-26 (Base UI Drawer 1.9.0 and its source, React Aria `Sheet`, Ark UI Drawer, vaul), BCD
8.1.11 of the same day, and the working notes in `memo/architect/drawer-notes.md`.

A drawer (a sheet) is a `<dialog>` attached to an edge of the viewport that the user can push
back to that edge. Everything a dialog does is Dialog's: top layer, `::backdrop`, inert page,
Escape, focus, the open that waits for its content, the Close part with an `action`, the Form.
What this component adds is one prop that says which edge, and one gesture.

## Decisions at a glance

| # | Topic | Decision |
| --- | --- | --- |
| 1 | Shape | A separate namespace, `Drawer`, at `@funstack/ui/drawer`: `Root`, `Trigger`, `Popup`, `Title`, `Description`, `Close`, `Form`. Every part runs the code of the matching Dialog part (section 9). Not a prop on `Dialog`. No `Handle`, `Backdrop`, `Viewport`, `Portal`, `SwipeArea` part. |
| 2 | Side | `side` on `Drawer.Popup`: `"top" \| "bottom" \| "left" \| "right" \| "inline-start" \| "inline-end"`, default `"bottom"`. Rendered as `data-side`, a prop echo present in the server HTML. The library places nothing: the consumer's CSS reads the attribute. |
| 3 | Modal | `modal` on Root, default `true`, as Dialog. A non-modal drawer (`show()`) is a side panel next to a usable page. |
| 4 | Light dismiss | `lightDismiss` on Popup defaults to the Root's `modal`: `true` for a modal drawer, `false` for a non-modal one. Otherwise Dialog's prop. |
| 5 | Swipe to dismiss | `swipeDismiss` on Popup, default `true`. Pointer Events (mouse, pen, touch), one pointer, toward the drawer's edge. Released past 25% of the drawer's extent, or faster than 0.5 px/ms toward the edge, the drawer closes; otherwise it returns. No prop for the numbers. |
| 6 | A swipe close is a fact | The library finishes the motion, then calls `dialog.requestClose()`: the browser closes the dialog, and the Root hears `onOpenChange(false, { reason: "dismiss", event: <the pointerup> })`. Never `openChangeAction`, never pending, never a view transition (conventions 3.9.2, 3.9.8). |
| 7 | The drag is CSS variables | While a pointer drags, the Popup carries `data-swiping` and the inline custom properties `--drawer-swipe-x`, `--drawer-swipe-y` (px) and `--drawer-swipe-progress` (0 to 1). The consumer's `translate` consumes them. The library writes no `transform` and ships no CSS. |
| 8 | Scroll versus drag | A press inside a scroll container along the drawer's axis belongs to that container, for every pointer type. A drag starts anywhere else in the drawer. The Popup renders an inline `touch-action` that keeps the cross axis for the browser. Pulling a scrolled-to-top body to dismiss is not in v1 (section 5.3). |
| 9 | Snap points | Not in v1 (section 10). |
| 10 | No-JS path | Dialog's JS-free mode, unchanged: `command="show-modal"`, `command="request-close"`, content and `data-side` in the server HTML, CSS enter and exit. The swipe needs hydration and works in JS-free mode after it, as `lightDismiss` does. |
| 11 | Reduced motion | Nothing in the library to turn off. The finger-following drag stays; the release is the consumer's CSS transition, and with `transition: none` the close or the return is immediate. |
| 12 | Nested drawers | Dialog's nesting. A swipe moves only the drawer the press landed in. No parent scaling, no count variable. |
| 13 | Background scaling | Not offered: it styles an element outside the component. A CSS recipe covers the static case (section 8.3). |
| 14 | Transition types | `fsui-drawer`, `fsui-drawer-open`, `fsui-drawer-close`. Not Dialog's: a drawer slides where a dialog fades, and a page-level `:active-view-transition-type()` rule must tell them apart. |

---

## 1. Anatomy

```tsx
import { Drawer } from "@funstack/ui/drawer";

<Drawer.Root>                                    {/* no DOM */}
  <Drawer.Trigger>Filters</Drawer.Trigger>
  <Drawer.Popup side="bottom">                   {/* dialog[data-side=bottom] */}
    <div className="grabber" aria-hidden />      {/* decoration; the consumer's */}
    <Drawer.Title>Filters</Drawer.Title>
    <div className="drawer-body">…</div>         {/* the scroll container, if any */}
    <Drawer.Close>Done</Drawer.Close>
  </Drawer.Popup>
</Drawer.Root>
```

Rendered HTML (JS-free mode):

```html
<button type="button" commandfor="_r_1_" command="show-modal">Filters</button>
<dialog id="_r_1_" aria-labelledby="_r_1_-title" data-modal="" data-side="bottom"
        style="touch-action: pan-x pinch-zoom">
  <div class="grabber" aria-hidden="true"></div>
  <h2 id="_r_1_-title">Filters</h2>
  <div class="drawer-body">…</div>
  <button type="button" commandfor="_r_1_" command="request-close">Done</button>
</dialog>
```

| Part | Element | Is Dialog's | Differs in |
| --- | --- | --- | --- |
| `Root` | none | `Dialog.Root` | transition types (decision 14) |
| `Trigger` | `button` | `Dialog.Trigger` | nothing |
| `Popup` | `dialog` | `Dialog.Popup` | `side` and `data-side`; `swipeDismiss`, `data-swiping`, the three custom properties, the inline `touch-action`; the default of `lightDismiss` |
| `Title`, `Description` | `h2`, `p` | Dialog's | nothing |
| `Close` | `button` | `Dialog.Close` | nothing |
| `Form` | `form` | `Dialog.Form` | nothing |

Why a separate namespace and not `<Dialog.Popup side swipeDismiss>`:

- **The defaults are the component**, as for AlertDialog: an edge, a swipe that is on, a
  backdrop that dismisses. A Dialog with three props set each time is a recipe to forget.
- **A Dialog must not pay for the gesture.** The build is unbundled (conventions 7.2). As a
  prop, the pointer tracking would be imported by every `Dialog.Popup`; as a namespace it is
  imported by `Drawer.Popup` only.
- **The names are the ones people type.** Base UI, Ark UI and vaul (shadcn/ui) say `Drawer`.
  React Aria says `Sheet`; this library has one name, and `swipeDismiss={false}` is the
  shadcn/ui "Sheet".
- **It costs little code.** The parts are thin callers of the Dialog part hooks, as
  AlertDialog's are (section 9).

Why no more parts. Prior art has `Backdrop`, `Portal`, `Viewport` / `Positioner`, `Handle` /
`Grabber`, `SwipeArea`, `Indent`. The first three are the top layer and `::backdrop`. A handle
without snap points does nothing a `<div aria-hidden>` does not: the whole drawer is the grab
area. `SwipeArea` (swipe from the screen edge to open) and `Indent` are sections 10 and 8.3.

**The parts share Dialog's context**, as AlertDialog's do: a `Dialog.Close` inside a
`Drawer.Popup` closes the drawer, and an `AlertDialog.Root` nested in a drawer is the confirm of
`dialog.md` 12.5.

---

## 2. Side

```ts
export type DrawerSide = "top" | "bottom" | "left" | "right" | "inline-start" | "inline-end";
```

The vocabulary is `AnchorSide` of conventions 13.1: four physical sides and the two inline
logical ones, which follow the popup's own `direction`. `start` / `end` are not used: in this
library those words are alignments.

`side` does two things and no more:

1. **`data-side` on the Popup**, with the value of the prop, in every mode and in the server
   HTML. It is a prop echo like `data-modal`, not the resolved side of an anchored popup
   (conventions 13.2): nothing flips a drawer. `state.side` is the same value.
2. **The swipe's direction** (section 4): toward that edge. For the inline sides the library
   reads the Popup's computed `direction` at the press, as Slider does; it is a gesture-time
   read, not placement.

The library writes no inset, no size and no transform. Placement is the consumer's stylesheet,
and a `<dialog>` in the top layer needs little:

```css
.drawer { position: fixed; margin: 0; border: 0; max-inline-size: none; max-block-size: none; }
.drawer[data-side="bottom"]     { inset: auto 0 0 0; inline-size: 100%; max-block-size: 90dvh; }
.drawer[data-side="inline-end"] { inset-block: 0; inset-inline: auto 0; block-size: 100dvh;
                                  inline-size: min(24rem, 90vw); }
```

Logical insets on the dialog resolve against its own writing mode, which it inherits from its
DOM parent, so `inline-end` is right in a left-to-right subtree and left in a right-to-left
one with no script.

Default `"bottom"`: the default of Base UI, Ark UI, React Aria and vaul, and the side a phone
uses.

---

## 3. Modal, light dismiss

`modal` is Dialog's prop on the Root, default `true`. Both values are real drawers: a modal
bottom sheet, and a non-modal inspector panel next to a page that stays usable. Unlike
AlertDialog nothing is removed from the types. A non-modal drawer is never JS-free (there is no
`show` command, `dialog.md` 2.6).

**`lightDismiss` defaults to `modal`.** Dialog's default is `false` because a stray click must
not lose a half-filled form. A drawer already accepts a swipe as a dismissal, so that argument
is conceded, and every prior art closes a modal drawer on a press on the backdrop. A non-modal
drawer has no backdrop and stays open by default: closing a side panel on any click on the page
would defeat it. The mechanism is Dialog's (`dialog.md` 7): the JS `pointerdown` + `click`
baseline, or native `closedby="any"` with `experimental_closedBy`. Consequence to know: before
hydration, and without the flag, a press on the backdrop does nothing. `closedby` is in Chrome
134 and Firefox 141 and BCD lists it for Safari 27.3 (stable is 27.2), so the flag is close to
graduating; then the attribute is in the server HTML.

Escape, the Close part, the Form and `returnValue` are Dialog's.

---

## 4. Swipe to dismiss

```tsx
<Drawer.Popup side="bottom">                    {/* swipe down closes */}
<Drawer.Popup side="inline-end" swipeDismiss={false}>   {/* a panel that only buttons close */}
```

### 4.1 The gesture

Native listeners on the `<dialog>`, attached after hydration in both modes while `swipeDismiss`
is `true`. Pointer Events only.

| Step | Rule |
| --- | --- |
| Press | `pointerdown`, `isPrimary`, the primary button. Recorded, nothing else: no capture, no `preventDefault()`, so a tap, a click and a text selection are untouched. |
| Not a candidate | The press is on the `::backdrop`; inside a nested `<dialog>` or an open popover; on a text-entry or range control (`input`, `textarea`, `select`, `[contenteditable]`); inside a scroll container along the drawer's axis (section 5); or the drawer is closing. |
| Start | The pointer has moved 6 px, more along the drawer's axis than across it, and toward the edge. The library then takes pointer capture on the dialog (`internal/pointer-capture.ts`) and sets `data-swiping`. A first move in another direction drops the press for good. |
| Not a start | At that moment the press's `pointerdown` was `defaultPrevented` (a consumer's opt-out, read late so a React handler has run); another element holds the pointer's capture (a Slider thumb, a map); or a mouse press has produced a text selection by then. With real input this rarely applies: a mouse drag along the drawer's axis moves the drawer (pointer capture, and the Move row below, keep it from selecting), a drag across the axis drops the press and selects text as usual. |
| Move | offset = the distance moved toward the edge, never below 0 (no overdrag in v1). Written to the custom properties (4.3) on every `pointermove`. No React render. A text selection a mouse press has made since it went down is removed on each move: Firefox keeps extending it under pointer capture, and a drag moves, it does not select. |
| Release | `pointerup`. **Dismiss** when the offset is at least 25% of the extent, or the velocity toward the edge over the last 100 ms is at least 0.5 px/ms; **but return** when the pointer was moving back (more than 0.1 px/ms away from the edge). Otherwise return. The press is the gesture's first sample (offset 0 at its time): an engine may coalesce a flick's moves into the one `pointermove` that starts the drag. |
| Abort | `pointercancel`, a lost capture, a second primary press, the dialog closing for any other reason, the Popup unmounting: return (or just clean up when the dialog is gone). |

The extent is the distance that takes the drawer fully off its edge, measured once at the
start: for `bottom`, the viewport's height minus the dialog's top.

The numbers are constants. Prior art for them: vaul and Ark UI close at 25% of the size; vaul's
velocity is 0.4 px/ms and Base UI's fast swipe is 0.5 px/ms; Base UI samples the release
velocity over the last 80 ms and cancels on a reversal.

Mouse and pen are included, not only touch. One code path serves all three, a desktop user can
try the drawer, and the browser tests can drive the gesture with a real mouse in the three
engines (Playwright has no touch drag outside Chromium). With capture taken, the `click` that
follows a mouse drag lands on the dialog, so the button the drag started on is not activated.

### 4.2 The release: the library finishes the motion, the browser closes

**Dismiss:**

1. `data-swiping` is removed and the offset is written to the full extent (`progress` 1). The
   consumer's `transition` on `translate` now carries the drawer off the edge.
2. The library waits for the animations that write started
   (`exitAnimations` with a baseline, `internal/overlay/use-exit-animation.ts`: finite
   animations only, the ones already running excluded). None (no transition, reduced motion):
   no wait.
3. If the dialog is still open, the library records the close intent (`"dismiss"`, the
   `pointerup` event) and calls `dialog.requestClose()`. From here it is Dialog's fact path
   (`dialog.md` 2.3): the `close` event, `adoptFact(false)`, `onOpenChange`.
4. The `close` listener removes the custom properties. If `requestClose()` did not close the
   dialog (a consumer's `onCancel` prevented it), they are removed at once and the drawer
   slides back.

Presses during the wait start no new drag.

**Return:** `data-swiping` is removed and the custom properties are removed; the same CSS
transition brings the drawer back.

Why the motion is finished before the close and not left to the CSS exit: Firefox does not
transition `display` (BCD: `transition-behavior` partial in Firefox 161), so a `<dialog>` has
no CSS exit there and a drawer closed at the release would vanish under the finger. While the
dialog is still open the slide is an ordinary `translate` transition, which every engine runs.
After it, the browser's close has nothing left to show: in Chromium and Safari the CSS exit
runs from one off-screen position to another.

### 4.3 What the Popup exposes

| Name | On | Value | Written |
| --- | --- | --- | --- |
| `data-swiping` | Popup | present while a pointer is dragging the drawer (from the start to the release or abort) | DOM write, in the task of the first offset write |
| `--drawer-swipe-x`, `--drawer-swipe-y` | Popup, inline | the offset as a physical vector in px: `0px 120px` for a bottom drawer pulled down 120 px, `-80px 0px` for a left one | DOM write (`style.setProperty`), per `pointermove`; absent when no gesture has moved the drawer |
| `--drawer-swipe-progress` | Popup, inline | offset / extent, 0 to 1 | same |

- **Attribute only, no `state.swiping`.** The gesture is DOM-only in both modes, as
  `data-instant` on a Tooltip is (conventions 4.1): JS-free mode has no React state to put it
  in, and a render per gesture buys nothing. The Popup's render functions do not see it.
- **Two physical components**, so one rule serves every side:
  `translate: var(--drawer-swipe-x, 0px) var(--drawer-swipe-y, 0px)`.
- **`::backdrop` inherits them** from the dialog (every engine: Chrome 122, Firefox 120,
  Safari 17.4), so the backdrop can fade with the drag.
- The names follow `--slider-value` and `--menu-point-x`: geometry the part writes for the
  consumer's CSS, never positioning by the library.

The starter stylesheet (docs, not shipped):

```css
.drawer {                                   /* closed: off its edge */
  transition: translate 300ms cubic-bezier(.32, .72, 0, 1),
              display 300ms allow-discrete, overlay 300ms allow-discrete;
}
/* `:where()` keeps the closed positions at the specificity of `.drawer`, below `.drawer:open` */
.drawer:where([data-side="bottom"]) { translate: 0 100%; }
.drawer:where([data-side="inline-end"]:dir(ltr)) { translate: 100% 0; }
.drawer:where([data-side="inline-end"]:dir(rtl)) { translate: -100% 0; }

.drawer:open { translate: var(--drawer-swipe-x, 0px) var(--drawer-swipe-y, 0px); }
@starting-style {
  .drawer[data-side="bottom"]:open { translate: 0 100%; }
  /* … one line per side used */
}
.drawer[data-swiping], .drawer[data-swiping]::backdrop { transition: none; }

/* A side drawer's vertical list that the swipe may start in (5.1) */
.drawer:where(:not([data-side="top"], [data-side="bottom"])) .drawer-list {
  overflow-x: hidden; overflow-y: auto; touch-action: pan-y pinch-zoom;
}

.drawer::backdrop { opacity: 0; transition: opacity 300ms, display 300ms allow-discrete, overlay 300ms allow-discrete; }
.drawer:open::backdrop { opacity: calc(1 - var(--drawer-swipe-progress, 0)); }
@starting-style { .drawer:open::backdrop { opacity: 0; } }

@media (prefers-reduced-motion: reduce) {
  .drawer, .drawer::backdrop { transition: none; }
}
```

One `transition` on `translate` is the enter, the exit of a dismissal, the release of a swipe
and the return of a cancelled one.

### 4.4 A swipe close is a fact

The test of conventions 2.1: if the callback rejects, or the parent ignores it, can the library
put the UI back without the user noticing? No. The user has thrown the drawer off the screen.
Holding that close behind `openChangeAction` would leave either a modal dialog that is open and
invisible, or a drawer that slides back in to wait. It is in the set conventions 3.9.2
describes: a hide the library triggers but cannot hold. It is `lightDismiss` with a different
gesture, and it uses the same call (`requestClose()`, so a consumer's `onCancel` sees it).

| Cause | Channel | `next` | `reason` | `details.event` | `returnValue` |
| --- | --- | --- | --- | --- | --- |
| A swipe released past the threshold | **`onOpenChange`** | `false` | `"dismiss"` | the `pointerup` `PointerEvent` | `""` |
| Every other cause | as `dialog.md` 2.7 | | | | |

- No new `reason`: `"dismiss"` is "the user closed it without a part". A consumer that must
  tell a swipe from Escape reads `details.event?.type`.
- Uncontrolled: committed `false` is written urgently in the `close` task. Controlled: the
  parent adopts in `onOpenChange`. A parent that keeps `open={true}` gets the drawer re-opened
  in the same task (conventions 3.9.4), and the CSS enter slides it back in: not a veto.
- Requests in flight are superseded (conventions 3.9.5): a `Drawer.Close action` that is
  running keeps running, and its close is a no-op.
- JS-free mode: the same gesture and the same `requestClose()`; there is no Root state and no
  callback.

### 4.5 The swipe and the view transition

`transition` on the Popup is Dialog's (`dialog.md` 10.3): it animates the opening commit,
content swaps, and every library-driven close (Close, Form, a controlled close).

| Change | Animated by |
| --- | --- |
| Open through the Trigger; Close part; Form; controlled close | the view transition if `transition` is set, else the CSS enter and exit |
| Escape, backdrop press | CSS exit (not in Firefox), as every dismissal |
| The drag | nothing: the custom properties follow the pointer |
| A swipe's release, a cancelled swipe's return | the CSS transition on `translate`, in every engine |

- A swipe never starts a view transition: it is a fact, and its commit is urgent (conventions
  3.9.8). A drawer styled with `transition` only, and no CSS transition on `translate`, jumps
  at the release. The docs say: the drag needs the CSS transition; the view transition is
  optional on top.
- Both may be set. The library already cuts the dialog's CSS transitions around its own
  `showModal()` and `close()` when `transition` is set
  (`internal/overlay/css-transition-cut.ts`), so a Close click animates once.
- A library-driven close that commits while a pointer is dragging (a Form action settling)
  aborts the gesture; the view transition's old snapshot is the drawer where the finger held
  it. The custom properties are removed in the `close` listener.
- A view transition that starts during a drag (a content swap) may cancel the pointer in some
  engines. That is the abort row: the drawer returns.

---

## 5. Scroll inside the drawer

### 5.1 The rule

**A press inside a scroll container along the drawer's axis, between the target and the Popup,
is not a swipe.** "Scroll container" is by computed `overflow` (`auto` or `scroll` on that
axis), whether or not the content overflows right now, and for every pointer type. The body
scrolls; the header, the grabber, the footer and the padding drag.

**The Popup renders an inline `touch-action`** while `swipeDismiss` is on: `pan-x pinch-zoom`
for `top` / `bottom`, `pan-y pinch-zoom` for the four horizontal sides. Without it a touch drag
on the drawer's axis is the browser's pan, and the pointer is cancelled before the gesture
starts. It is in the server HTML and a consumer's `style` overrides it.

What follows:

- **A side drawer has no conflict.** Its content scrolls vertically, natively, the Popup itself
  included; a horizontal drag is the swipe. A horizontal scroller inside (a carousel) keeps its
  own drags.
- **A top or bottom drawer must scroll in a child, not in the Popup.** `touch-action` is
  intersected from the touched element up to the nearest scroll container, so a child with
  `overflow-y: auto` scrolls by touch and the area outside it drags. A Popup that is itself the
  vertical scroller cannot be scrolled by touch under `pan-x`. Development warning, once per
  instance, when a `top` / `bottom` Popup with `swipeDismiss` has a scrollable computed
  `overflow-y` and content taller than its box.
- The rule ignores the amount of overflow so that touch and mouse agree: the browser claims a
  touch pan inside a scroll container even when nothing overflows.
- **Computed `overflow` pairs the axes.** `overflow-y: auto` alone computes `overflow-x` to
  `auto` too (CSS Overflow: `visible` becomes `auto` next to a non-`visible` value), so a
  vertical list inside a side drawer is also a horizontal scroll container and its presses do
  not drag, by mouse or by touch (the touch-action chain ends at that list, whose own
  `touch-action` is `auto`). A side drawer that should drag from its list gives the list
  `overflow-x: hidden` and `touch-action: pan-y pinch-zoom`; one that scrolls in the Popup
  itself needs nothing. The rule stays; the silent failure gets a development warning, once
  per instance: a press in a side drawer refused by a scroll container whose computed
  `overflow-x` is `auto`, whose `overflow-y` is not `visible` and which has no horizontal
  overflow (`scrollWidth <= clientWidth`) logs the recipe. The starter stylesheet (4.3)
  carries it.

Documented with the rule: `overscroll-behavior: contain` on the scrolling child, so a scroll
that reaches its end does not chain to the page (Safari applies it only to a container that
overflows); and Dialog's scroll lock recipe (`dialog.md` 10.2).

### 5.2 Why Pointer Events and `touch-action`

The platform decides who owns a touch at the press, from `touch-action`, and tells the page
with `pointercancel` when it takes the gesture. Declaring the regions in CSS and listening to
Pointer Events is the whole mechanism: no non-passive listener, no scroll blocking, no
measuring while the finger moves, and the same code for mouse, pen and touch.

### 5.3 Not in v1: pulling a scrolled-to-top body

The phone idiom "the list is at its top, keep pulling down and the sheet follows" needs a
decision per gesture, after the press, and Pointer Events cannot make it: the directional
`touch-action: pan-up` / `pan-down` that would express it in CSS are Chromium-only (BCD:
Firefox and Safari have neither). Base UI does it with Touch Events: a non-passive
`touchmove` listener calls `preventDefault()` on the first move when the scroller is at its
start edge and the finger moves toward the drawer's edge (its viewport module is about 40 kB
of source for this and its edge cases). It can be added later without an API change:
the rule of 5.1 gains "unless the scroller is at its start edge and the move is toward the
edge", and one listener is added. It needs probes on real touch hardware in the three engines
first, which the test setup cannot provide today.

---

## 6. Props and types

```ts
export type DrawerOpenChangeDetails = DialogOpenChangeDetails;   // reason, event, returnValue
export type DrawerRootProps = DialogRootProps;                   // open, defaultOpen, openChangeAction, onOpenChange, modal
export type DrawerRootState = DialogRootState;

export type DrawerTriggerProps = DialogTriggerProps;
export type DrawerTriggerState = DialogTriggerState;

export interface DrawerPopupState extends DialogPopupState {     // open, modal
  /** The `side` prop. */
  readonly side: DrawerSide;
}

export interface DrawerPopupProps
  extends Omit<DialogPopupProps, "className" | "style" | "children" | "render"> {
  /**
   * The edge the drawer is attached to. Rendered as `data-side` (also in the server HTML); the
   * swipe goes toward it. `inline-start` / `inline-end` follow the drawer's own `direction`.
   * The library places nothing: style `[data-side]`. Default `"bottom"`.
   */
  side?: DrawerSide;
  /**
   * Let the user drag the drawer toward its edge to close it (mouse, pen, touch; after
   * hydration). The close is a dismissal: reported to `onOpenChange`, never to
   * `openChangeAction`. While dragging the drawer has `data-swiping`, `--drawer-swipe-x`,
   * `--drawer-swipe-y` and `--drawer-swipe-progress`; your CSS moves it. Also renders an inline
   * `touch-action`. Always give another way to close (`Drawer.Close`). Default `true`.
   */
  swipeDismiss?: boolean;
  /** As `Dialog.Popup`'s. Default: the Root's `modal`. */
  lightDismiss?: boolean;
  className?: StateValue<string | undefined, DrawerPopupState>;
  style?: StateValue<CSSProperties | undefined, DrawerPopupState>;
  children?: StateValue<ReactNode, DrawerPopupState>;
  render?: RenderProp<ComponentPropsWithRef<"dialog">, DrawerPopupState>;
}

export type DrawerCloseProps = DialogCloseProps;
export type DrawerCloseState = DialogCloseState;
export type DrawerFormProps = DialogFormProps;
export type DrawerFormState = DialogFormState;
export type DrawerTitleProps = DialogTitleProps;
export type DrawerDescriptionProps = DialogDescriptionProps;

export const Drawer = {
  Root: DrawerRoot, Trigger: DrawerTrigger, Popup: DrawerPopup, Title: DrawerTitle,
  Description: DrawerDescription, Close: DrawerClose, Form: DrawerForm,
} as const;
```

`keepMounted`, `initialFocus`, `experimental_closedBy`, `transition`, `role` pass-through and
the mode rule (a Root with none of `open`, `defaultOpen`, `openChangeAction`, `onOpenChange` is
JS-free) are Dialog's.

Owned keys on the Popup, in addition to Dialog's: `data-side`, `data-swiping`. The inline
`touch-action` is merged under the consumer's `style`. `--drawer-swipe-*` are written through
the DOM and are not in the rendered `style`; a consumer `style` that sets them is not
supported.

---

## 7. The no-JS path, reduced motion, accessibility

**JS-free mode** is Dialog's (`dialog.md` 2.1) and a drawer loses nothing in it: the Trigger and
the Close are Invoker Commands, the content, `data-side` and `touch-action` are in the server
HTML, the CSS of 4.3 runs the enter and (outside Firefox) the exit, Escape closes. It works
from a Server Component.

| | Before hydration | After hydration, JS-free mode | Library mode |
| --- | --- | --- | --- |
| Open, Close, Escape | browser | browser | library / browser (Dialog) |
| Backdrop press | nothing (native with `experimental_closedBy`) | JS baseline | JS baseline |
| Swipe | nothing; the drawer's axis does not pan either | closes; no callback exists | closes; `onOpenChange` |

So a drawer always renders a `Drawer.Close`: it is what closes it before hydration on a phone
without a keyboard.

**Reduced motion.** The library ships no animation (conventions 5.4) and makes no `matchMedia`
check. The drag is direct manipulation and stays, as it does on the platforms that have the
gesture. The release and the return are the consumer's CSS transition; the starter stylesheet
turns it off under `prefers-reduced-motion: reduce`, and then step 2 of 4.2 finds nothing to
wait for: the drawer closes at the release, or returns in one frame.

**Accessibility.** A drawer is a dialog: role, name, description, focus and keyboard are
`dialog.md` 6 and 9, unchanged. The swipe is a path-based pointer gesture, so WCAG 2.5.1 asks
for another way: Escape (modal, and the JS baseline of a non-modal drawer), the backdrop of a
modal drawer, and the Close part. Development warning, once per instance: a Popup with
`swipeDismiss` that closes, at the end of any showing, while no Close part of it has mounted
since the Popup did (a Close that mounted once counts for the instance's lifetime; the check
is a hint, not a per-showing audit). A grabber is decoration
(`aria-hidden`); it is not a button, because it has no action that a key could perform.

---

## 8. Nested drawers, and what is around the drawer

### 8.1 Nesting

Dialog's rule (`dialog.md` 2.6): an inner Root inside an outer Popup has its own ids and
context, modal dialogs stack in the top layer, Escape closes the topmost one. For the swipe:
the press must have the Popup as its nearest `<dialog>`, so a drag in the inner drawer never
moves the outer one, and a nested popover's presses are its own.

### 8.2 Not offered: the parent that steps back

Base UI and vaul scale or shift the parent drawer while a child is open and follow the child's
swipe with it (`--nested-drawers`, `data-nested-drawer-swiping`). It needs a registry of open
drawers and a write on an element that is not the swiped one. The static part is CSS today,
because the inner dialog is a DOM descendant of the outer Popup:

```css
.drawer:has(dialog:open) { scale: .96; }   /* the inner dialog is in the top layer, unaffected */
```

### 8.3 Not offered: background scaling

vaul's `shouldScaleBackground` and Base UI's `Indent` scale the application behind the drawer.
The element is the consumer's, outside every part of the component: the reason Dialog rejected
a scroll-lock attribute on `<html>` (`dialog.md` 10.2). The static effect is one rule:

```css
.app { transition: scale 300ms, border-radius 300ms; transform-origin: top; }
html:has(.drawer:modal) .app { scale: .96; border-radius: 12px; }
```

It does not follow the finger: the custom properties are on the dialog and do not reach its
ancestors. A consumer who wants that reads them in their own `pointermove` listener.

---

## 9. Implementation: what is shared

`packages/ui/src/drawer/` has one `"use client"` file per part, each a caller of a Dialog part
hook, as AlertDialog's (`alert-dialog.md` 8). `DialogNamespace` gains `"Drawer"`.

| Drawer part | Runs | With |
| --- | --- | --- |
| `Root` | `useDialogRoot` | the consumer's `modal`; the component name for the transition types (one new option; Dialog and AlertDialog pass `"dialog"`) |
| `Popup` | `useDialogPopup` | `lightDismiss` defaulted from the Root; extra owned props (`data-side`, the `touch-action` style); `side` added to the state; the swipe attached to the dialog element (below) |
| `Trigger`, `Title`, `Description`, `Close`, `Form` | the Dialog hooks | the part name |

New code, in two layers (conventions 9.1):

- **A flat `internal/` module, directive-free: the swipe tracker.** Pointer bookkeeping and
  arithmetic only: candidate press, start (slop, axis, direction), offset, release velocity,
  the dismiss / return decision, abort. It takes an element, an axis and direction, predicates
  for "not a candidate", and callbacks (`start`, `move(offset)`, `end("dismiss" | "return",
  event)`). It knows nothing of dialogs. **This is the piece Toast can use** when its reserved
  `swipeDirection` is built (`toast.md` 9.2): the same tracker, with `data-ending` as the
  close. The arithmetic is a pure function with a unit test, as `slider-arithmetic.ts` is.
- **In the drawer folder: the glue.** The candidate predicates of 4.1 and 5.1, the extent, the
  custom-property writes, the release of 4.2, the development warnings.

`useDialogPopup` gains one option, `attachDismiss`: a function called with the dialog element
where the JS dismissals are installed (`dialog-dismiss.ts`), given a `dismiss(event)` that
records the close intent and calls `requestClose()`, and returning a cleanup. Light dismiss
could be expressed through the same option; that refactor is not required. Also `ownProps`
(the extra owned keys) on `useDialogPopup`, and `component` (`"dialog"` or `"drawer"`) on
`useDialogRoot`. The Close-part warning of section 7 learns of the Close parts through a
development-only context, `DialogCloseRegistry`, that the Drawer Popup provides and every
Dialog-family Close part reports its element to (a `Dialog.Close` closes a drawer too).

Files: `internal/swipe-arithmetic.ts` (the numbers and the pure functions),
`internal/swipe.ts` (the tracker), `drawer/drawer-swipe.ts` (the glue), the part files in
`drawer/`.

Shared without change: `useOverlayRoot` and the fact path, the apply effect, `held` and the
exit read, the CSS transition cut, initial focus, the modal registry Toast's Viewport uses (a
toast shows above an open modal drawer), `capturePointer`, `exitAnimations`, the development
warnings of Dialog worded with the Drawer part names. Slider shares `capturePointer` only: its
gesture maps a position to a value and commits through an action.

Rows to add to the conventions when this is implemented (vocabulary, no rule change): 4.1
`swiping` (attribute only) and `side` on `Drawer.Popup` (a prop echo); 5.3 the three types;
`design/overlay-open-state.md` 3.9 and 3.9.2 (Drawer.Root is Dialog.Root; the swipe in the list
of hides the library triggers but cannot hold).

Tests. jsdom: the tracker's arithmetic, the request / fact rows with synthetic pointer events,
the shared Dialog suites run against the Drawer namespace. Browser, three engines, real mouse:
drag past the threshold closes with `onOpenChange` and no `openChangeAction`; a short drag
returns; a fast flick closes; a drag inside a scroller scrolls nothing and moves nothing; a
controlled refusal re-opens; the custom properties and `data-swiping` across a gesture; the
release waits for the `translate` transition in Firefox.

---

## 10. Not in v1

- **Snap points** (`snapPoints`, an active snap point, a handle that cycles them). They are a
  second component's worth of design: a new piece of state that is neither request nor plain
  fact (the user drags to a point; is a controlled parent asked or told?), sizes the library
  would have to own (today it owns none), keyboard access to each point, and the virtual
  keyboard under a partly open sheet (Base UI ships a separate provider for it). The swipe
  tracker and the three custom properties are the base it would build on, and nothing in v1
  blocks it.
- **Pulling a scrolled-to-top body** to dismiss (5.3).
- **Swipe from the screen edge to open** (`SwipeArea`): it needs an element outside the dialog,
  conflicts with the browser's own edge gestures (back navigation in Safari), and an open is a
  request that may wait for content, which a drag cannot.
- **Props for the thresholds**, overdrag with resistance, a velocity variable for the release
  duration (Base UI's `--drawer-swipe-strength`), a swipe-ignore attribute (`preventDefault()`
  on `pointerdown` and pointer capture are the opt-outs).
- **Virtual keyboard handling.** A bottom sheet with a text field is sized by the consumer
  (`dvh`, `interactive-widget`, `VisualViewport`); engines differ and the library does not
  paper over them in v1.
- **Parent scaling and background scaling** (8.2, 8.3).

---

## 11. Async walkthroughs

Library mode, uncontrolled, unless stated. Everything not listed is `dialog.md` 11.

1. **Swipe closes.** Press on the header, drag down: `data-swiping`, the properties follow.
   Release at 40%: the drawer slides out (CSS), `requestClose()`, `close` event, committed
   `false` urgently, `onOpenChange(false, { reason: "dismiss", event: pointerup })`, focus
   returned by the platform. Nothing was pending.
2. **Open with content that suspends.** Dialog's: the Trigger is pending, the drawer slides in
   complete. There is nothing to swipe until it is shown.
3. **Swipe while a `Drawer.Close action` is pending.** The fact supersedes; the action keeps
   running; its close is a no-op; a rejection goes to `reportError` if the Close has unmounted
   (conventions 2.4, 3.9.5).
4. **Swipe while `openChangeAction(false)` is awaited** (a Close was clicked, the drawer is
   still shown): the swipe is reported at once; the request's outcome decides nothing.
5. **A Form action settles during a drag.** The settle's close is a request; if nothing else
   is in flight it commits, the apply effect closes the dialog, the gesture aborts. The user's
   finger is left on nothing, which is what the submit asked for.
6. **Controlled parent keeps `open`.** The drawer slides out, closes, re-opens in the `close`
   task and slides in (CSS enter). Documented as "adopt a dismissal".
7. **`onCancel` prevents the close.** The drawer slid out, the dialog stayed open: the
   properties are removed and it slides back. Once per user activation, as the platform has it.
8. **Escape during a drag.** The platform closes the dialog; the gesture aborts; one fact, with
   the `close` event.
9. **Children re-render or suspend during a drag.** Nothing: the gesture holds no React state
   and writes only custom properties React does not render.
