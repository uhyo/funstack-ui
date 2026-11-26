# Popover

Status: **accepted**, implemented. History (reviews, amendments, implementation notes, the
test plan): `design/CHANGELOG.md`, parts "popover.md". The code under
`packages/ui/src/popover/` and `src/internal/overlay/use-popover-*.ts` is the
ground truth where this document is silent. Follows `design/conventions.md` (accepted);
where this document and the conventions disagree, the conventions win. **Read
`design/components/dialog.md` first**: Popover is the Dialog's two-mode model (JS-free mode
through Invoker Commands, library mode with a library-owned open keyed on committed state)
applied to a `popover="auto"` element, and it reuses Dialog's `initialFocus`, close intents,
apply effect, mount reconciliation and deferred unmount. Then `design/components/tooltip.md` for
the Popover API half: `showPopover({ source })`, the implicit anchor, `side` / `align`, and the
no-portal, no-positioner rule. This document repeats only what differs.

Inputs: `docs/vision.md`, `design/conventions.md`, `docs/research/popover-menu.md` (primary;
its verdicts are binding), `docs/research/popover-anchor-tooltip.md`, `docs/research/dialog.md`
("no portals", close requests), `docs/research/react-async-apis.md`,
`docs/research/view-transition-mount-cost.md` (#35), the implemented `packages/ui/src/dialog/*`
and `packages/ui/src/tooltip/*`, the WAI-ARIA APG Dialog (non-modal guidance) and Disclosure
patterns, prior art (Base UI Popover, Radix Popover, React Aria Popover, Headless UI Popover),
and working notes in `memo/architect/popover-notes.md`.

Popover is the Dialog's non-modal sibling and the base Menu (#39) is built on. The platform
gives it the top layer, light dismiss, Escape, one-at-a-time stacking with nesting, the implicit
anchor and CSS placement, a declarative trigger that works before hydration, and focus return to
the trigger. The library adds the Async React half, as in Dialog: opening is a transition keyed
on committed state, so a popover whose content loads shows the Trigger pending and opens when
the content is ready; and closes that the user asks a part for (the Trigger, a Close button) run
through the library too, so `<ViewTransition>` can animate the exit in every engine, Firefox
included. A dismissal (Escape, a click outside) is the browser's: a fact, reported to
`onOpenChange` (conventions 3.9, section 2.8).

## Decisions at a glance

| # | Topic | Decision |
| --- | --- | --- |
| 1 | Anatomy | `Popover.Root` (no DOM), `Popover.Trigger` (`button[popovertarget]`), `Popover.Popup` (`dialog[popover="auto"][aria-modal="false"]`), `Popover.Close` (`button[commandfor][command="hide-popover"]`), `Popover.Title` (`h2`), `Popover.Description` (`p`). No Portal, no Positioner, no Arrow, no Backdrop, no Form (section 1). |
| 2 | Two modes, one anatomy | **JS-free mode** (Root has none of `open` / `defaultOpen` / `openChangeAction` / `onOpenChange`): the browser owns everything; content always mounted; works from a Server Component and before hydration. **Library mode**: open is library-owned (Trigger click intercepted, `openChangeAction(true)` awaited, content from committed state, `showPopover({ source })` in a layout effect). |
| 3 | Who closes | In library mode the line is **parts versus dismissals**, not open versus close as in Dialog: a close the user asks a part for (Trigger toggle, `Popover.Close`, a controlled `open={false}`) is **library-owned**: `openChangeAction(false)` is awaited, committed `false` lands, `hidePopover()` runs in the apply effect of that commit. Escape, light dismiss, a foreign invoker and script are **browser-owned facts**: reported to `onOpenChange` from `toggle` with `reason: "dismiss"` (`"activate"` for a foreign invoker), synchronously, committed `false` urgently, never through `openChangeAction` (2.8, conventions 3.9). The popover's close is freely cancelable (no anti-abuse rule, no `close()` from a form), which Dialog's is not. |
| 4 | Element | `<dialog popover="auto">` with an explicit `aria-modal="false"` (Chromium exposes it as modal otherwise) and `role="dialog"` as an overridable default. The popover focusing steps run the dialog focusing steps (verified in Chromium, Firefox and WebKit; no library fallback), so focus moves into the popup on open as the APG asks for a non-modal dialog, with the same `initialFocus` / `autofocus` story as Dialog. `render={<div />}` keeps focus on the trigger (disclosure-style). |
| 5 | Dismissal | `auto` only: light dismiss, Escape, Android back, one-at-a-time stacking are the platform's in every engine. No `lightDismiss` prop, no `manual` variant in v0. |
| 6 | Nesting | A Popover inside a Popup is a nested auto popover: opened with `commandfor` or `showPopover({ source })` so the outer stays open; Escape closes the innermost; an outside click closes the stack. The platform restores focus only for the first popover in a stack, so the library restores focus to the Trigger when focus was inside the closed popup (or inside the content the close commit unmounted) and the platform left it on `<body>` (section 6.2). Never portals (inside a modal Dialog a portalled popover would be inert). |
| 7 | Pending UI | Trigger: `data-open` (optimistic), `data-pending` (library mode). **No `aria-expanded` on a `<button>` Trigger**: it is a `popovertarget` invoker and every engine exposes its popover's own shown state; a non-button `render` (no invoker) renders `aria-expanded` from the Root's urgent `shown` mirror of the popup's `toggle`. The Popup emits no `data-open` (`:popover-open` is exact). Root has no DOM, so `pending` lives on the Trigger and in Root's `children(state)`. JS-free mode: `data-open` is written on the Trigger from the popup's `toggle` listener (no React state). |
| 8 | Reasons | `details.reason`: `"activate"` (Trigger, Close, a foreign invoker), `"dismiss"` (Escape, light dismiss, script `hidePopover()`, lost interest on an `interestfor` button), `"platform"` (found open on mount after a pre-hydration click). No `returnValue`: popovers have none. |
| 9 | Content mounting | Library mode: children unmount when closed by default; `keepMounted` keeps them in `<Activity mode="hidden">` (boolean only). Unmount waits for the popover's CSS exit animation **unless `transition` is set**, in which case a library-driven close unmounts in the close commit and the view transition carries the content out (section 4.4). JS-free mode: always mounted. |
| 10 | Positioning | `side` (`"bottom"`) and `align` (`"center"`) on Popup set inline `position-area` and `position-try-fallbacks`, the shared matrix of conventions 13.1 (physical sides plus `inline-start` / `inline-end`; inline-relative `align` on a horizontal side); `side={null}` emits nothing. `data-side` / `data-align` and `state.side` / `state.align` are the **resolved** placement while shown (conventions 13.2). Anchor: the implicit anchor from `popovertarget` (JS-free) or `showPopover({ source: trigger })` (library). |
| 11 | Animation | CSS (`@starting-style`, `allow-discrete`, `overlay`) for every open and for dismissals; exit is progressive enhancement (none in Firefox). With `transition`, `<ViewTransition>` wraps **the `<dialog popover>` element itself** and animates library-driven opens and closes in all three engines, Firefox's exit included; a dismissal never starts a view transition; where a popup has both, the library cuts its CSS transition around its own show and hide (10.2). |
| 12 | Directives | Every part file is `"use client"` (context for ids and mode). "JS-free" means no behaviour JS runs for the interaction and the markup works before hydration, as in Dialog. A directive-free Popover is not scheduled: it is viable in principle (a static `popoverTarget` Trigger needs no ARIA kept current, and all three engines map `popovertarget`) and stays unscheduled for the reasons Accordion's option B is (conventions 7.3). |
| 13 | For Menu | The Root state, the Popup machinery (apply effect, listeners, close intents, focus-return fallback, deferred unmount, `aria-expanded` sync), the Trigger interception and the positioning helper are internal hooks that `Menu` (#39) composes with `role="menu"`, `aria-haspopup`, item parts and keyboard handling of its own (section 15). |

---

## 1. Anatomy

```tsx
import { Popover } from "@funstack/ui/popover";

<Popover.Root>                                        {/* no DOM; owns ids, mode, state, context */}
  <Popover.Trigger>Filters</Popover.Trigger>          {/* button[popovertarget] */}
  <Popover.Popup side="bottom" align="start">         {/* dialog[popover=auto][aria-modal=false] */}
    <Popover.Title>Filters</Popover.Title>            {/* h2; wires aria-labelledby */}
    <Popover.Description>Narrow the list.</Popover.Description>
    <FilterForm />
    <Popover.Close>Done</Popover.Close>               {/* button[commandfor][command=hide-popover] */}
  </Popover.Popup>
</Popover.Root>
```

Rendered HTML (JS-free mode; ids come from one `useId` in Root):

```html
<button type="button" popovertarget="_r_1_">Filters</button>
<dialog
  id="_r_1_"
  popover="auto"
  role="dialog"
  aria-modal="false"
  aria-labelledby="_r_1_-title"
  aria-describedby="_r_1_-description"
  data-side="bottom"
  data-align="start"
  style="position-area: bottom span-self-x-end; position-try-fallbacks: flip-block, flip-inline, flip-block flip-inline"
>
  <h2 id="_r_1_-title">Filters</h2>
  <p id="_r_1_-description">Narrow the list.</p>
  …
  <button type="button" commandfor="_r_1_" command="hide-popover">Done</button>
</dialog>
```

| Part | Element | Role | Library state rendered | Notes |
| --- | --- | --- | --- | --- |
| `Root` | none | | `state.open` (optimistic), `state.pending` in `children(state)` | Owns `useId`, mode, the state hook, refs and context. No `ref`, `className`, `style`. |
| `Trigger` | `button` | button | `data-open` (optimistic in library mode; DOM-synced from `toggle` in JS-free mode), `data-pending` (library mode), `data-disabled` whenever disabled, in every mode; `aria-expanded` only on a non-button `render` (the shown popup, from the Root's `shown` mirror) | `popoverTarget` (the Popup's id; default action `toggle`). No `aria-expanded` on the invoker (ARIA in HTML #514; the engines expose the popover's state). No `aria-haspopup` (APG disclosure has none; Menu adds `"menu"`). |
| `Popup` | `dialog` | `dialog` (explicit) | `data-side`, `data-align`; no `data-open` (`:popover-open`) | Carries `id`, `popover="auto"`, `aria-modal="false"`, `aria-labelledby`, `aria-describedby`, inline placement. The content region: children render from committed state in library mode. |
| `Close` | `button` | button | `data-pending` (when `action` runs), `data-disabled` | `command="hide-popover"`. |
| `Title` | `h2` | heading | none | `id` wiring. `render={<h3 />}` changes the level. |
| `Description` | `p` | | none | `id` wiring. |

Why these parts, where they differ from Dialog:

- **`Popup` is the `<dialog popover>` itself.** The research verdict: the popover focusing steps
  run the dialog focusing steps for a `<dialog>`, so the popup gets Dialog's initial focus and
  `autofocus` behaviour from the platform, and the role is `dialog` natively. Two facts about
  this element that are easy to get wrong: `showPopover()` does **not** set the `open`
  attribute, so `dialog.open` stays `false` while the popover is shown, `dialog.close()` is a
  no-op, `<form method="dialog">` does not close it, and no `cancel` / `close` events fire; only
  `beforetoggle` / `toggle` do. And Chromium exposes a `<dialog popover>` as `modal=true` in the
  accessibility tree (research; a human-reported upstream bug, #44), so the library always renders
  `aria-modal="false"`.
- **No `Form` part.** `Dialog.Form` exists because `<form method="dialog">` is the platform's
  "submit closes"; a popover-shown dialog ignores it. "Submit, then close" is a `<form action>`
  inside the Popup plus a controlled `open` (example 12.4) or a `Popover.Close action`. A Form
  part can be added later without changing anything here.
- **No `lightDismiss` prop, no `modal`.** Light dismiss and Escape are what `popover="auto"` is.
  A panel that must survive stray clicks is a Dialog; a popover that must stay open while the
  user works elsewhere (`manual`) is a different component (a pinned panel, a toast) and is not
  designed in v0.
- **`Title` and `Description`** are the same parts as Dialog's: `aria-labelledby` /
  `aria-describedby` are always emitted and token-merged with the consumer's; dangling references
  are skipped by the accessible-name computation. A popup with neither a Title nor an
  `aria-label` / consumer `aria-labelledby` warns in development once it has been shown, because
  `role="dialog"` requires a name. A popup whose content is not a dialog (an info card with no
  interactive content) may pass `role="group"` or `role="region"` through; `role` is a default,
  not an owned key (section 3.3).

Element constraints for `render`: `Trigger` and `Close` should render a `<button>` for the
command path (a non-button `render` works in library mode through the click handler, never in
JS-free mode; dev warning in both modes, as Dialog: in library mode a non-button Trigger's
close while open is a light dismiss, not the library-owned close, 2.7). `Popup` may render a `<dialog>` (default) or a `<div>`
(section 6.1, focus stays on the trigger); anything else warns. The library's `[popover]`,
`role`, `aria-modal` and ids go on whichever element renders.

Render the Popup **immediately after the Trigger** where the layout allows it. Safari 27.0 does
not place a far popover next in the Tab order after its invoker (research, WPT
`popover-focus-2` / `-4`), which matters for the `<div>` variant where focus stays on the
trigger; and HTML-AAM suppresses the redundant `aria-details` relation when the popover is the
next accessibility sibling. With the default `<dialog>` focus moves into the popup on open, so
adjacency is a recommendation, not a requirement (as `popovertarget` links by id, the parts need
not be siblings at all).

---

## 2. The two modes

| | JS-free mode | Library mode |
| --- | --- | --- |
| Selected when | Root has none of `open`, `defaultOpen`, `openChangeAction`, `onOpenChange` | Root has any of them |
| Open | Browser: the Trigger's `popovertarget` | Library: Trigger click intercepted, dispatch inside the Root's transition, `showPopover({ source: trigger })` in a layout effect of the commit that mounts the content; foreign opens cancelled at `beforetoggle` and routed the same way |
| Close by a part (Trigger, Close) | Browser: `popovertarget` / `command="hide-popover"` | Library: click intercepted, dispatch `false`, `hidePopover()` in the apply effect after the action settles |
| Close by dismissal (Escape, light dismiss, foreign invoker, script) | Browser | Browser; a fact: committed `false` urgently and `onOpenChange(false)` called from `toggle` |
| Content | Always mounted | Rendered from committed `open`; unmounted while closed unless `keepMounted` |
| Trigger open state | exposed by the browser from the popover (`popoverTarget`); `data-open` DOM-synced from `toggle` after hydration (section 9) | exposed by the browser likewise; `data-open` React-rendered (optimistic); `aria-expanded` only on a non-button `render`, from the Root's `shown` mirror |
| `data-open`, `data-pending` on Trigger | never emitted | emitted |
| `openChangeAction` | n/a | requests only: awaited for `true` and for part-initiated `false` |
| `onOpenChange` | n/a | facts only: called synchronously for a dismissal, not awaited |
| Works before hydration | yes | the native open happens; the library reconciles on mount (2.4) |
| `transition` on Popup | accepted, no effect, dev warning | yes |

Switching modes after mount is unsupported (dev warning), like controlled/uncontrolled.

### 2.1 JS-free mode

```tsx
// app/toolbar.tsx: a Server Component. No client component of your own, no behaviour JS.
import { Popover } from "@funstack/ui/popover";

export function ShareButton({ url }: { url: string }) {
  return (
    <Popover.Root>
      <Popover.Trigger className="btn">Share</Popover.Trigger>
      <Popover.Popup className="popover">
        <Popover.Title>Share this page</Popover.Title>
        <input readOnly value={url} />
        <Popover.Close>Done</Popover.Close>
      </Popover.Popup>
    </Popover.Root>
  );
}
```

The browser does all of it: the Trigger's `popovertarget` opens the popup in the top layer,
anchored below the button; the dialog focusing steps focus the input (the first sequentially
focusable descendant); Escape, a click outside and the Done button's `hide-popover` close it and
return focus to the Trigger; opening another `auto` popover closes this one.

When the element to focus is not the first focusable one, use `initialFocus` (a selector, so it
serialises from a Server Component), not `autoFocus`: React writes `autofocus` only into
server-rendered HTML, not when it renders the element on the client (a client navigation to a
Server Component page), whereas the library writes the attribute from `initialFocus` after mount
in JS-free mode and keeps it there (6.1). `autoFocus` remains the plain-HTML alternative for
markup that is always server-rendered. The Trigger is a `popovertarget` invoker and renders no
`aria-expanded`: all three engines expose its popover's own shown state, before hydration too
(section 9).

What still runs JS in this mode, after hydration: the `toggle` listener that writes `data-open`
on the Trigger (a styling hook only; the exposed state needs no JS) and restores focus for
nested popovers (6.2), the `Close` action when given, and development warnings. None of them
changes React state. A page that never hydrates styles the open Trigger with `:has()` instead:
`.btn:has(+ .popover:popover-open)` when the Popup follows the Trigger (section 10).

What this mode cannot do: load content on open, show pending state, or start open (a popover's
open state cannot be server-rendered: there is no attribute for it). Those are library mode.

### 2.2 Library mode: open is library-owned

Any of `open`, `defaultOpen`, `openChangeAction` on Root turns the Popover into a FUNSTACK state
owner through `useControllableAction<boolean>`, exactly as Dialog:

```tsx
// Uncontrolled: the popup opens when the action resolves and the content has rendered.
<Popover.Root defaultOpen={false} openChangeAction={(open) => analytics.track("filters", open)}>

// Controlled, local state: a Transition update for requests, an urgent one for dismissals.
<Popover.Root open={open} openChangeAction={(next) => { setOpen(next); }} onOpenChange={setOpen}>

// Controlled, server-backed: update on success, re-wrapped after the await.
<Popover.Root
  open={open}
  openChangeAction={async (next) => {
    if (next) await prefetchFilters();
    startTransition(() => setOpen(next)); // required after an await
  }}
  onOpenChange={setOpen}                  // a dismissal: adopt it directly, never wrapped
>
```

The Trigger intercepts its click (the command runs as the button's activation behaviour, after
`click`, only if it was not cancelled; Enter and Space synthesise the same `click`):

```tsx
// inside PopoverTrigger (library mode)
onClick={(event) => {
  event.preventDefault();                       // the browser does not run the popovertarget toggle
  if (disabled) return;
  const next = !root.intended();                // toggle against what the user already intends
  root.dispatch(next, { event: event.nativeEvent, reason: "activate" });
}}
```

Unlike `Dialog.Trigger`, which only opens, a popover trigger is a **toggle**: a click while the
popup is optimistically open dispatches `false` (a library-owned close, 2.3). A second click
during a pending open is therefore a cancel, resolved by latest intent (walkthrough 11.7).

The commit that sets committed `open` to `true` renders the Popup's children. If they suspend,
React keeps the popup closed and the Trigger `data-pending` until the data is ready. The same
commit's layout effect calls `popup.showPopover({ source: trigger })`, which creates the same
implicit anchor, focus-order insertion and nesting as the declarative `popovertarget` path, and the
dialog focusing steps run against fully rendered content.

**Foreign opens.** `beforetoggle` for an open is cancelable on a popover (research), and it
fires for every way a popover can open: a consumer's own `<button commandfor={id}
command="show-popover">`, a script `showPopover()`, anything. The Popup listens natively and, in
library mode, cancels every open it did not start itself (a flag set around the library's own
`showPopover()` call) and dispatches `true` with the `ToggleEvent` as `details.event` and
`reason: "activate"`. One listener covers what Dialog needed a `command` listener for, with no
list of commands to maintain. (`ToggleEvent.source` is the invoker when there was one: Chrome
140, Firefox 145, Safari 26.5.)

What the user sees while the open is pending:

| Surface | Reads | During a pending open |
| --- | --- | --- |
| `Trigger` `data-open`, `data-pending`, `state.open` | optimistic | present, present, `true` |
| `Trigger` exposed expanded state | the popover's own (`popovertarget`, every engine); `aria-expanded` from `shown` on a non-button `render` only | collapsed (nothing is shown) |
| `Popup` `:popover-open`, visibility | DOM (follows committed) | closed |
| `Popup` children | committed | not rendered (default) or hidden (`keepMounted`) |
| `Root` `state.pending` | transition | true |

### 2.3 Library mode: three kinds of close

| Close | Owner | What happens | `reason` | `details.event` |
| --- | --- | --- | --- | --- |
| Trigger click while open | library | click cancelled; dispatch `false`; `openChangeAction(false)` awaited; committed `false` commits; apply effect `hidePopover()` (view transition if `transition` is set) | `"activate"` | the `click` `MouseEvent` |
| `Popover.Close` (with or without `action`) | library | click cancelled; `action` awaited in the Close's own transition (`data-pending` on the button); then the same dispatch as above | `"activate"` | the `click` `MouseEvent` |
| Controlled parent sets `open={false}` | library | apply effect `hidePopover()`; the resulting `toggle` is an echo, no dispatch and no callback | (none) | |
| Escape, Android back, AT dismiss, light dismiss | browser | popover hidden at once; `toggle` → a **fact**: requests in flight superseded, committed `false` written urgently (uncontrolled), `onOpenChange(false)` called synchronously (conventions 3.9.3) | `"dismiss"` | the `toggle` `ToggleEvent` |
| A foreign `hide-popover` / `toggle-popover` invoker | browser | the Popup's `command` listener records an `"activate"` intent while the popup is shown (the `command` event fires whatever the popover's state, HTML; one at a hidden popup closes nothing and records nothing); `toggle` consumes it | `"activate"` | the `CommandEvent` |
| A foreign `popovertarget` invoker | browser | no `command` event; the Popup's `beforetoggle` listener records an `"activate"` intent when the close's `ToggleEvent.source` is a button or input whose `popoverTargetElement` is the popup. Other sources stay dismissals: `null` (Escape, light dismiss, script, another popover opening), a `commandfor` invoker (its `command` row above); an `interestfor` button never reaches this row in library mode (its lost-interest hide is the library's own `hidePopover()`, next row). An intent already recorded for this close wins (a button with both `commandfor` and `popovertarget` runs its command, whose `command` listener comes first); `toggle` consumes it | `"activate"` | the `beforetoggle` `ToggleEvent` (its `source` is the button) |
| Script `hidePopover()`, another `auto` popover or modal dialog opening elsewhere | browser | as a dismissal | `"dismiss"` | the `toggle` `ToggleEvent` |
| Lost interest on an `interestfor` button naming the popup, after an interest open (Chromium, 2.9) | library, by proxy | the platform fires `loseinterest` on the popup but cannot hide it (the library's re-show lost the interest relationship, 2.9), so the Popup records a `"dismiss"` intent and calls `hidePopover()` one task later if the popup is still shown; during a pending interest open it dispatches `false` instead. Browser-shaped: not awaited, not vetoable, CSS exit only | `"dismiss"` | the `loseinterest` `InterestEvent` (its `source` is the button) |

Why the line is drawn here and not at "close is browser-owned" as in Dialog: a dialog's close
requests are vetoable only once per user activation and `close()` from a `method="dialog"` form
not at all, so Dialog cannot honestly promise a library-owned close. A popover's part-initiated
closes are plain commands the library cancels like it cancels the open, and the popover hides
when the library says so. That is what makes the exit animatable by `<ViewTransition>` in every
engine (10.2), and it is the shape Menu needs for "activate an item, run its action, close in the
commit" (#39). Dismissals remain the browser's: `beforetoggle` for a close is not cancelable, and
a user who pressed Escape expects the popup to go away now. Every row whose owner is not the
library is a fact (2.8).

Close intents work as in Dialog 2.3: the `toggle` event names no cause beyond its invoker
(`ToggleEvent.source`: Chrome 140, Firefox 145, Safari 26.5), so the Popup records what caused
the close just before it happens and the `toggle` listener consumes it; a recorded intent that
did not result in a close is cleared by one `setTimeout(0)` that clears it only if the popover is
still open. That clear cannot tell a hidden popup's stale intent from one waiting for its
`toggle`, so nothing is recorded for a popup that is already hidden. In library mode the only recorded intents are
foreign invokers. The library's own Trigger and Close never produce a close with a `source`:
their clicks are cancelled and the close is the library's `hidePopover()`, whose `source` is
`null`. The library's own `hidePopover()` is recognised by a marker set in the apply effect
around the call: a `toggle` that arrives for it is an echo and reports nothing. Every other
`toggle(closed)` is a fact, also one that arrives while a part's close is pending (conventions
3.9.2).

The `popovertarget` row lives in `usePopoverPopup`, so Menu and Combobox classify a
foreign `popovertarget` close the same way (Combobox 5.4 has no row of its own for foreign
invokers; its opens already follow 2.2). There a press on a foreign button usually moves focus
out of the menu tree or the input first, and that `focusout` closes the popup as `"dismiss"`
before the click (Menu 2.2, Combobox 5.4); the `"activate"` row applies to a press that keeps
focus where it was (a button that prevents its `mousedown`, a platform where a click does not
focus a button such as Safari on macOS, a script `click()`).

**A controlled parent that refuses a dismissal.** The popup is already closed when
`onOpenChange(false)` is called. If the parent keeps `open={true}`, the apply effect re-shows
the popup in the fact's own commit, without moving focus (conventions 3.9.4); a controlled Root
without `onOpenChange` warns in development. This is not a veto. A controlled parent that
refuses a **part-initiated** close (keeps `open={true}` after a Trigger or Close click) gets a
plain snap-back: nothing was hidden, the Trigger's `data-open` returns, the popup stays open.
That is a real veto, because the close was library-owned; the docs say so and show the usual
"adopt `false` unless …" shape for it.

### 2.4 Pre-hydration opens and mount reconciliation (library mode)

Library mode renders the same `popovertarget` markup, so a click before
hydration opens the popover natively, anchored and focused by the browser, and **empty** with the
default mounting (the children are not in the server HTML while committed `open` is `false`;
with `defaultOpen`, see 2.5). On mount, a Popup layout effect
compares `popup.matches(":popover-open")` with committed `open` and, if open and committed is
`false`, dispatches `openChangeAction(true, { event: undefined, reason: "platform" })`. The
content mounts into the already-open popover when the action settles; if the parent refuses or
the action rejects, the apply effect hides it. Focus is not moved when the content lands. Unlike
`<dialog>`, a popover leaves no attribute behind, so no `suppressHydrationWarning` is needed.

### 2.5 Controlled `open`, the apply effect and the re-open race

The Popup re-applies committed state to the DOM in a layout effect after every commit, only
while nothing is in flight (Dialog 2.5):

- **Show** (committed `true`, popup hidden, no `toggle` outstanding: `awaitingClose`):
  - initial focus (6.1): the `initialFocus` target gets `autofocus` for the duration of the
    call, so the popover focusing steps focus it; a component's resolver may instead return a
    **quiet** target (Menu's first item after a pointer open), which is focused after the show
    with `focus({ focusVisible: false })`. Never `.focus()` otherwise;
  - `showPopover({ source })` under the `opening` flag (the `beforetoggle` listener lets this
    one through). `source` is the Trigger, or what the component supplies (Combobox: the
    input), and is passed only when it is connected;
  - when the Popup has `transition`, the call runs inside `withCssTransitionCut` (10.2);
  - **the re-show of a refused fact** (`refusedFact`, conventions 3.9.4): no initial focus
    target, and the popup is `inert` for the duration of the call (unless the consumer set
    `inert`), so the focusing steps find nothing. The flag is set when a fact hides the popup,
    cleared by any commit with committed `false` and consumed by this show.
- **Hide** (committed `false`, popup shown): set the `libraryHide` marker, so the `toggle`
  listener recognises the library's own hide and reports nothing (2.3); `hidePopover()`,
  inside the same cut when `transition` is set; then return focus if the close commit
  unmounted the focused content (6.2 rule 1).
- **After every commit, in flight or not**: forget "content had focus" while the popup is
  shown (content that left while open is not a close), and release a `held` that no animation
  is going to release (4.4).

The re-open race is the same as Dialog's: a native hide is synchronous but `toggle` arrives a
task later, so a commit landing in between would see committed `true`, a hidden popup and nothing
in flight and would call `showPopover()` again. The guard is `awaitingClose`, set in the
synchronous `beforetoggle(closed)` listener and cleared in `toggle`. `beforetoggle` fires inside
the hide steps in every engine and in the jsdom shim. As Dialog's, the flag and the `libraryHide`
marker belong to the element. When the callback ref attaches a different element (a remount
during a hide, such as a change of `transition`), the old element's `toggle` never reaches the
Popup: a library hide has nothing to report and both are cleared there; a fact is replayed in a
timer task (`setTimeout(0)`, not the `toggle`'s own task: it can run later, and an input task can
come first), doing the closed `toggle`'s work on the old element: `onOpenChange(false)` with the
recorded intent's `event` and `reason`, else `"dismiss"` and no `event`. The wait is held until
then. No replay once the Popup has unmounted; a Popup a Suspense boundary hides (ref detached,
still mounted) still gets it. The attach runs in the layout phase before the Popup's
apply effect (the element is its descendant). The same element attached again (a new merged ref)
changes nothing.

One effect covers: the normal open, `defaultOpen` on mount, a controlled open without a Trigger,
a controlled close, a library-driven close after `openChangeAction(false)` settled, the re-show
of a refused dismissal (no initial focus, conventions 3.9.4), and the close after a rejected or
refused pre-hydration open. It also
returns focus after a hide whose close commit already unmounted the focused content (6.2) and
releases a `held` that no animation is going to release (4.4).

**`defaultOpen` and the server HTML.** `defaultOpen={true}` is committed state from the first
render, as in Dialog: the content and the Trigger's `data-open` are in the server HTML. Only the
*showing* waits for hydration, because HTML has no attribute for an open popover. The Trigger
exposes collapsed until the apply effect's first `showPopover()`, because the browser derives the
state from the popover itself (`popovertarget`, no `aria-expanded`; a non-button `render`'s
attribute follows the `shown` mirror with the same timing).

### 2.6 Nesting and stacking

A `Popover.Root` rendered inside a Popup is a nested auto popover and needs nothing from the
consumer. The platform's rules (research, "Stacking and nesting", verified in Chromium and
Firefox): opening the inner through its Trigger (`popovertarget` in JS-free mode,
`showPopover({ source })` in library mode) keeps the outer open whatever the DOM position; two
inner popovers close each other; Escape closes the innermost only; an outside click closes the
whole stack (each Root gets its own `onOpenChange(false, { reason: "dismiss" })`); clicking in the outer popup
closes the inner only; opening an unrelated `auto` popover or a modal dialog *outside* the stack
closes the stack; a modal Dialog opened from *inside* a Popup keeps the Popup open (it is a DOM
descendant, never a portal).

What the platform does not do, and the library does: restore focus when a **nested** popover
closes. The spec restores focus only for the first popover in a stack, so Escape in an inner
popover leaves focus on `<body>` in every engine. Section 6.2 has the rule; it is the same rule
Menu applies to submenus.

One cost to know (as Dialog 2.6): an inner Popup with `transition` set mounts its
`<ViewTransition>` together with the outer content, and react-dom starts a document view
transition for any boundary that mounts in a transition commit (#35). Leave `transition` off the
inner Popup unless the animation is wanted.

WebKit: `position-try-fallbacks` on a nested popover had an open hang / CPU-spin bug (WebKit
302008). It did not bite on WebKit CI (Menu submenus, the nested Combobox listbox, and since
6e48fe6 the nested Popover rows all run the default placement on every engine, section 13.3);
consumers who still hit it in a Safari version set `side={null}` on the inner Popup and position
it in CSS without fallbacks.

### 2.7 Trigger-less and non-button triggers

A Popup without a Trigger (controlled `open`, example 12.3) opens through the apply effect with
`showPopover()` and **no `source`**: no implicit anchor, so `position-area` has nothing to anchor
to and the UA stylesheet centres the popover (`inset: 0; margin: auto`). Style it with
`side={null}`. An `anchor` prop (a ref to any element passed as `source`) is deferred until a
component needs it; context menus (#45) will need a pointer anchor, which is different again.
Nested, Trigger-less popovers still work when the inner Popup is a DOM descendant of the outer
(the "DOM child" nesting rule).

A `render={<a href />}` Trigger works in library mode (click handler) and never in JS-free mode
(only buttons run commands). Note that in library mode a non-button Trigger is still passed as
`source`, so anchoring and focus order work. What a non-button Trigger does **not** get is the
library-owned close of 2.3: HTML's light dismiss spares the shown popover's invoker only
through the button attributes (`commandfor` with a popover command, `popovertarget`; the
`source` alone does not count, and an `<a>` or `<span>` cannot be an invoker), so a press on a
non-button Trigger while the popup is open hides it at `pointerup`, a task before the `click`.
The click still dispatches `(false, "activate")` in the right direction (the hide's `toggle`
task lands after the click, which is in the `pointerup` task, so `intended()` is still `true`),
but the close is browser-shaped: nothing is awaited, a controlled parent cannot veto it (it
re-opens, as for any dismissal) and there is no `<ViewTransition>` exit. Nothing in the
platform can give an `<a>` the exemption, so the library does not try (a `pointerdown`
snapshot, Combobox's pre-#112 shape, would only fix a direction that is already right). The
guarantee is therefore stated for a `<button>` Trigger, and the existing non-button dev warning
runs in library mode too, with that text. Consumers who need a link-shaped Trigger render a
`<button>` styled as one.

### 2.8 Requests and facts: which cause goes where

The rule is conventions 3.9: `openChangeAction` hears requests, `onOpenChange` hears facts.
For `Popover.Root`:

| Cause | Channel | `next` | `reason` | `details.event` |
| --- | --- | --- | --- | --- |
| Trigger click while closed | `openChangeAction` | `true` | `"activate"` | `click` |
| A foreign open: a consumer's invoker button, script `showPopover()`, interest (cancelled at `beforetoggle`, routed through the library) | `openChangeAction` | `true` | `"activate"` | `beforetoggle` `ToggleEvent` |
| `<button>` Trigger click while open | `openChangeAction` | `false` | `"activate"` | `click` |
| `Popover.Close`, after its own `action` if it has one | `openChangeAction` | `false` | `"activate"` | `click` |
| Lost interest while the interest open is still pending | `openChangeAction` | `false` | `"dismiss"` | `loseinterest` |
| Found open at hydration (2.4) | `openChangeAction` | `true` | `"platform"` | `undefined` |
| Escape, Android back, an assistive-technology dismiss | **`onOpenChange`** | `false` | `"dismiss"` | `toggle` `ToggleEvent` |
| Light dismiss (click outside) | **`onOpenChange`** | `false` | `"dismiss"` | `toggle` |
| Another `auto` popover or a modal dialog opening outside the stack; a parent popover closing | **`onOpenChange`** | `false` | `"dismiss"` | `toggle` |
| Script `hidePopover()` | **`onOpenChange`** | `false` | `"dismiss"` | `toggle` |
| A foreign `hide-popover` / `toggle-popover` `commandfor` button | **`onOpenChange`** | `false` | `"activate"` | `CommandEvent` |
| A foreign `popovertarget` button | **`onOpenChange`** | `false` | `"activate"` | `beforetoggle` `ToggleEvent` (`source` is the button) |
| Lost interest after an interest open, popup shown (the library's `hidePopover()` by proxy) | **`onOpenChange`** | `false` | `"dismiss"` | `loseinterest` |
| A non-button Trigger (`render={<a />}`) pressed while open (light dismiss hides it at `pointerup`, before the `click`; 2.7) | **`onOpenChange`** | `false` | `"activate"` | `click` |
| Controlled `open` changed by the parent; the library's re-open of a refused fact; removal from the document | none | | | |

The non-button Trigger row: when the Trigger's click finds `true` intended but the popup no
longer `:popover-open`, it records an `"activate"` close intent with the click and dispatches
nothing; the pending `toggle` reports the fact.

Nesting: an outside click closes the whole stack and each Root gets its own
`onOpenChange(false, { reason: "dismiss" })`; Escape closes the innermost only. Focus return
(6.2) is driven by the `toggle` listener, not by the channel.

### 2.9 Interest invokers (`interestfor`)

A `<button interestfor={popupId}>` naming a library-mode Popup (a consumer's own button, or the
Trigger with `interestfor` added through props) opens it on interest, through the foreign-open
route of 2.2, and **loses it on lost interest**: the library hides the popup itself, as a
dismissal (`reason: "dismiss"`, `details.event` the `loseinterest` `InterestEvent`, whose
`source` is the button). The library has to: its interception of the open at `beforetoggle`
and its own re-show lose the platform's interest relationship, so the platform fires
`loseinterest` on the popup but does not hide it. Lost interest **during a pending interest
open** cancels the open (a request: dispatch `false`, same reason and event), so a hover card
whose content is still loading does not appear under a pointer that has left. Nothing changes
in JS-free mode, where the platform's own interest relationship is intact. No prop is added.
The rows below are for a button that does nothing else to the popup. **A button that opens the
popup on activation should not also carry `interestfor` for it**, the Trigger included: the
Popup is rich content, and HTML's author guidance for interest invokers (whatwg/html PR #11006;
`docs/research/wave23-hovercard-select-multiple.md` 1.1) rules out one element that shows the
same rich target on interest and on activation, because the interest relation then replaces
the `popovertarget` one in the accessibility mapping. "Hover to preview, click to pin" is
therefore not a pattern the library recommends. The component for a hover preview is HoverCard
(`hover-card.md`), in every engine; Tooltip remains the component for `role="tooltip"` content.

| Situation (library mode, Chromium) | What happens | `reason` | `details.event` |
| --- | --- | --- | --- |
| Interest on a button naming the popup (hover or keyboard focus, after `interest-delay-start`) | `interest` fires on the popup, then the platform's show is cancelled at `beforetoggle` and routed as in 2.2; the Popup remembers that this open was an interest open; the popup shows when the action settles, anchored to the Trigger (`source`), or centred without one (2.7) | `"activate"` | the `beforetoggle` `ToggleEvent` (unchanged) |
| Lost interest (pointer left button and popup, or blur, after `interest-delay-end`) while the popup is shown and the current open was an interest open | the Popup records a `"dismiss"` intent and calls `hidePopover()` **in a task** (`setTimeout(0)`), only if the popup is still shown then; the `toggle` consumes the intent and notifies | `"dismiss"` | the `loseinterest` `InterestEvent` |
| Lost interest while the interest open is still pending (popup hidden, `intended()` true) | dispatch `false`: latest intent wins, the open never shows (walkthrough 11.7 shape); `openChangeAction` sees `true` then `false` | `"dismiss"` | the `loseinterest` `InterestEvent` |
| Lost interest while shown, but the current open was **not** an interest open (Trigger click, foreign `commandfor`, pre-hydration) | nothing: the platform rule (`invokedVia`) says a click-opened popover does not hide on lost interest | | |
| `loseinterest` fired from inside another hide (Escape, light dismiss, script, the apply effect) | the task finds the popup hidden and does nothing; the hide reports once | (that hide's) | |
| Pointer re-enters the button or the shown popup before `interest-delay-end` | nothing fires; the popup stays | | |

The hide is browser-shaped even though the library calls it: nothing is awaited, a controlled
parent that keeps `open={true}` sees the popup re-open after the action (conventions 3.5), the
exit is the 10.1 CSS exit and `held` works as for any dismissal, and there is no
`<ViewTransition>` exit (10.2). The one deliberate difference from a plain popover is the
`ToggleEvent.source` of the hide: `null` (a script `hidePopover()`), not the button; the button
is on `details.event.source` instead. Focus: the platform's lost-interest hide and
`hidePopover()` both run the "focus previous element" steps, so a focus-driven interest open
closed by blur leaves focus where the user moved it, and a hover open never moved focus unless
`initialFocus` / the dialog focusing steps did, which behave as for any library open (6.1).
**The lost-interest hide skips the 6.2 rule-2 fallback**: when
the dialog focusing steps had moved focus into the popup and nothing was focused before the
hover open, `hidePopover()` leaves focus on `<body>`, and the fallback's `focus()` on the Trigger
would grant a Trigger that carries `interestfor` interest by focus, re-opening the popup the user
just left (measured: hide, `toggle(closed)`, focus return, `interest`, re-open, in one frame).
The platform's own lost-interest hide restores only the previously focused element (which the
`hidePopover()` call already does when focus is inside) and never focuses the invoker, so the
library does the same here: a flag set in the task before `hidePopover()` and consumed by
`onToggle(closed)` suppresses the Trigger fallback for this one hide; a foreign button's hide
behaves identically (focus to the previous element, else `<body>`). Nested interest-opened
popups therefore leave focus on `<body>` after a lost-interest hide, as the platform does.
Other engines: `interestfor` is inert in Firefox and WebKit, so the button does nothing there;
a hover preview that works in every engine is a HoverCard (`hover-card.md`), whose JS path
supplies the interest signal. Menu and Combobox inherit the rows (shared hook); HoverCard's
flagged path is built on them.

---

## 3. Props and types

Shared types come from `packages/ui/src/internal/types.ts`; `transition` is typed with React's
`ViewTransitionClass` as on every animatable part.

### 3.1 `Popover.Root`

```ts
export interface PopoverOpenChangeDetails extends ActionDetails {
  /**
   * "activate": the user acted on a part: Trigger (open or close), Close, or a foreign invoker
   * (`details.event` is a `CommandEvent` / `ToggleEvent` then).
   * "dismiss": the user closed the popover without a part: Escape, Android back, an assistive-
   * technology dismiss gesture, a click outside; or script / another top-layer element hid it.
   * "platform": the popover was found open on mount (opened before hydration); `event` is undefined.
   */
  readonly reason: ChangeReason;
}

export interface PopoverRootState {
  /** Optimistic open state. Content rendered from it must not suspend. */
  readonly open: boolean;
  /** A request (`openChangeAction`) dispatched through this Popover is in flight (library mode only). */
  readonly pending: boolean;
}

export interface PopoverRootProps {
  /** Controlled open state. `undefined` means uncontrolled (and, with the other three absent, JS-free mode). */
  open?: boolean;
  /**
   * Initial open state in uncontrolled library mode. `true` renders the content and the Trigger's
   * open state into the server HTML; the popover itself is shown after hydration (HTML has no
   * attribute for an open popover).
   */
  defaultOpen?: boolean;
  /**
   * Requests only. Awaited for `true` (the popover opens when it resolves and the content has
   * rendered) and for a `false` the user asked a part for (Trigger, Close: the popover hides
   * when it resolves, with a view transition if `transition` is set). Never called for a
   * dismissal. May be a Server Function. Rejections reach the nearest Error Boundary above Root.
   *
   * A `setState` placed after your own `await` is not a Transition update; wrap it in
   * `startTransition` (React limitation).
   */
  openChangeAction?: ChangeAction<boolean, PopoverOpenChangeDetails>;
  /**
   * Facts only: the popover was closed without the library performing the close (Escape, a
   * click outside, a foreign invoker, script). Called synchronously with `false`, outside any
   * Transition, not awaited; a returned promise's rejection and a throw go to `reportError`.
   * A controlled Root adopts it directly (`onOpenChange={setOpen}`, never wrapped in
   * `startTransition`); a parent that keeps `open={true}` gets the popover re-shown.
   */
  onOpenChange?: UrgentChangeHandler<boolean, PopoverOpenChangeDetails>;
  children?: StateValue<ReactNode, PopoverRootState>;
}
```

No `ref`, `className`, `style` (no DOM), no `modal`, no `disabled` (the Trigger is). `state.open`
is `false` in JS-free mode (the real state is `:popover-open`), as Dialog decided.

### 3.2 `Popover.Trigger`

```ts
export interface PopoverTriggerState {
  /** Optimistic open state (library mode); `false` in JS-free mode. */
  readonly open: boolean;
  /** The Root's transition is pending (an open or a part-initiated close). */
  readonly pending: boolean;
  readonly disabled: boolean;
}

export interface PopoverTriggerProps
  extends Omit<ComponentPropsWithRef<"button">, "onClick" | "aria-expanded" | "className" | "style" | "children"> {
  /** Native `disabled`: a disabled button is not a valid invoker and never dispatches. */
  disabled?: boolean;
  className?: StateValue<string | undefined, PopoverTriggerState>;
  style?: StateValue<CSSProperties | undefined, PopoverTriggerState>;
  /** Rendered from optimistic state; must not suspend. */
  children?: StateValue<ReactNode, PopoverTriggerState>;
  /**
   * Should render a `<button>`; another element works only in library mode (click handler), and
   * a press on it while the popup is open is a light dismiss rather than the awaited close (2.7).
   */
  render?: RenderProp<ComponentPropsWithRef<"button">, PopoverTriggerState>;
}
```

Owned keys: `type` (`"button"`, on a `<button>` only), `popoverTarget` (on a `<button>` or a
component render only: another element is no invoker; `popoverTargetAction` is owned too
and never written: the default `toggle`, which a `render` element cannot change), `disabled`, `aria-expanded`, `data-open`, `data-pending`,
`data-disabled`, and `onClick` only when installed (library mode; in JS-free mode the Trigger
installs no handler and a `render` element's own `onClick` passes through). `commandfor` and
`command` are omitted from the type as reserved keys and owned as `undefined` at runtime, so a
`render` element's own values are stripped too (a second activation behaviour on the Trigger's
button would conflict with its `popovertarget`, and Invoker Commands win over it). `aria-haspopup` is not rendered
and passes through (a consumer may set `"dialog"`; Menu's trigger sets `"menu"`). `aria-expanded`
is owned in both modes and **rendered only when no `popoverTarget` is** (a non-button `render`):
there it is the shown state (the Root's `shown` mirror of the popup's `toggle`) in library
mode and `"false"` in JS-free mode (such an element cannot open anything there). On a `<button>` the
browser exposes the popover's own state and ARIA in HTML #514 forbids the attribute. In
JS-free mode `data-open` is kept current on the Trigger by the Popup's `toggle` listener (section 9).

### 3.3 `Popover.Popup`

```ts
/** `inline-start` / `inline-end` follow the popup's `direction` (wave 11; conventions 13.1). */
export type PopoverSide = "top" | "bottom" | "left" | "right" | "inline-start" | "inline-end";
export type PopoverAlign = "start" | "center" | "end";

export interface PopoverPopupState {
  /** Committed open state (library mode); `false` in JS-free mode. Read `:popover-open` for the DOM truth. */
  readonly open: boolean;
  /**
   * While shown: the physical side the browser placed the popup on (after any fallback flip;
   * conventions 13.2). Otherwise the `side` prop. `null` with `side={null}`.
   */
  readonly side: PopoverSide | null;
  /** While shown: the resolved alignment; otherwise the `align` prop. */
  readonly align: PopoverAlign;
}

export interface PopoverPopupProps
  extends Omit<
    ComponentPropsWithRef<"dialog">,
    "id" | "popover" | "open" | "aria-modal" | "onToggle" | "onBeforeToggle" | "className" | "style" | "children"
  > {
  /**
   * Placement relative to the Trigger through inline `position-area`, with
   * `position-try-fallbacks` flipping it when it does not fit. Default `"bottom"`. `null` emits
   * no inline positioning (and no `data-side` / `data-align`), so a stylesheet owns placement.
   * `"inline-start"` / `"inline-end"` follow the popup's direction.
   */
  side?: PopoverSide | null;
  /**
   * Alignment along the side. Default `"center"`. On a top / bottom side `start` / `end` are
   * inline-relative (mirrored under `direction: rtl`); on the other sides the top / bottom
   * edges. Ignored when `side` is `null`.
   */
  align?: PopoverAlign;
  /**
   * Library mode: what happens to the children while the popover is closed.
   * - `false` (default): not rendered. Mounting them is part of the opening transition, so
   *   content that suspends holds the open until it is ready. Unmount waits for the popover's
   *   exit animation (CSS), or happens in the close commit when `transition` is set.
   * - `true`: rendered inside `<Activity mode="hidden">`: DOM and state preserved, effects
   *   stopped, pre-rendered at low priority. Not in the server HTML.
   * Ignored in JS-free mode (always mounted).
   */
  keepMounted?: boolean;
  /**
   * Element to focus when the popover opens: a ref, or a selector resolved inside the popup.
   * The library writes `autofocus` on it right before `showPopover()` and the platform focuses
   * it. Default: the platform's choice for a `<dialog>` (first focusable descendant; the popup
   * itself if none); for `render={<div />}` focus stays on the Trigger.
   */
  initialFocus?: RefObject<HTMLElement | null> | string;
  /**
   * Library mode only. Forwarded to the `<ViewTransition default>` around the popover element
   * itself. Animates the opening commit, content changes while open, and every library-driven
   * close (Trigger, Close, controlled `open={false}`), in all engines; dismissals (Escape,
   * click outside) are the browser's, start no view transition and animate with CSS only. Ignored (dev warning) in JS-free
   * mode.
   *
   * Static: without `transition` the part renders no `<ViewTransition>`; changing it between
   * `undefined` and a value remounts the element. A Root inserted by a transition with
   * `transition` set on its Popup pays the page cross-fade (#35); a plain open does not, because
   * the children mount under the already-mounted popover element.
   */
  transition?: ViewTransitionClass;
  className?: StateValue<string | undefined, PopoverPopupState>;
  style?: StateValue<CSSProperties | undefined, PopoverPopupState>;
  children?: StateValue<ReactNode, PopoverPopupState>;
  /** A `<dialog>` (default) or a `<div>` (focus stays on the Trigger). */
  render?: RenderProp<ComponentPropsWithRef<"dialog">, PopoverPopupState>;
}
```

Owned keys: `id`, `popover` (`"auto"`), `open` (never rendered; owned so a `render` element
cannot add it), `aria-modal` (`"false"`), `aria-labelledby` and `aria-describedby`
(token-merged), `data-side` / `data-align` (only when `side !== null`, as Tooltip). **Defaults,
not owned:** `role="dialog"` (a consumer `role` wins: `alertdialog`, or `group` / `region` for
a non-interactive card rendered as a `<div>`); rendered explicitly because WebKit implements no
minimum role for `[popover]` and the `<div>` variant needs it. `onToggle` / `onBeforeToggle` are
omitted: react-dom does attach them on a hydrated popover (unlike `<dialog>`), but React 19.3.1
still emulates bubbling, so a nested popover's toggle would reach them; the library's own
listeners are native and target-filtered, and consumers who want the platform events use `ref`.
The consumer's `style` is merged over the library's inline positioning (consumer wins).

### 3.4 `Popover.Close`

```ts
export interface PopoverCloseState {
  /** The `action` is in flight. */
  readonly pending: boolean;
  readonly disabled: boolean;
}

export interface PopoverCloseProps
  extends Omit<ComponentPropsWithRef<"button">, "onClick" | "className" | "style" | "children"> {
  /**
   * Runs inside this part's own transition (`data-pending` on the button), then closes the
   * popover: in library mode through the Root (`openChangeAction(false)` awaited, view
   * transition if set), in JS-free mode with `hidePopover()`. A rejection reaches the nearest
   * Error Boundary above the Close part and leaves the popover open. If the popover was
   * dismissed and opened again while the action ran, the close is dropped: it belonged to the
   * earlier open. Without `action` in JS-free mode the button is a native
   * `command="hide-popover"` invoker.
   */
  action?: Action<[details: ActionDetails]>;
  /**
   * What a click does while this part's `action` is pending. `"ignore"`: nothing (the click is
   * cancelled, `aria-disabled="true"` meanwhile). `"run"`: the action runs again; the popover
   * still closes once. No effect without `action`. Conventions 2.5.1.
   * Default `"ignore"`.
   */
  whilePending?: WhilePending;
  /** Native `disabled`; owned, so a `render` element cannot re-enable the button. */
  disabled?: boolean;
  className?: StateValue<string | undefined, PopoverCloseState>;
  style?: StateValue<CSSProperties | undefined, PopoverCloseState>;
  children?: StateValue<ReactNode, PopoverCloseState>;
  render?: RenderProp<ComponentPropsWithRef<"button">, PopoverCloseState>;
}
```

Owned keys: `type`, `commandfor`, `command` (`"hide-popover"`; on a `<button>` or a component
render only), `disabled`, `onClick` (library
mode, or with `action`), `data-pending`, `data-disabled`. No `value` and no `returnValue`:
popovers have none. The Close keeps `commandfor` + `command="hide-popover"` under #121
(`popovertargetaction="hide"` would buy nothing: Chromium and Firefox expose no expanded state for
an invoker inside its own popover with either attribute, and the `command` event is what tells the
Popup a foreign hide's reason). In library mode the click is always intercepted, with or without `action`,
so every Close goes through the Root's transition and the apply effect; in JS-free mode without
`action` the browser runs the command, with `action` the part runs it then calls
`popup.hidePopover()` directly (a browser-owned close; the `toggle` listener has no Root state to
notify). The action runs through the shared `useActionTrigger({ openGeneration })`
(conventions 3.4).

**`whilePending`** (conventions 2.5.1). `Popover.Close` is a part whose activation the library
owns (it hides the popover with no user code), so the default is `"ignore"`, also for a Close
that is given an `action` (mixed ownership: the consumer's function, then the library's close):
a repeated click while the Close's own action is pending is ignored (click
`preventDefault()`ed) and the button renders `aria-disabled="true"` while it shows
`data-pending` (the action and the hide commit; not while natively disabled, conventions 1.2). With `whilePending="run"` every click runs the
action again in the part's transition: `data-pending` until every run has settled, **no**
`aria-disabled` from pending. The close is requested once, when the last run in flight settles,
and only if the latest run resolved, in library and JS-free mode alike, and still dropped for a
stale open as below. So a rejection leaves the popover open in both modes. An older run's
rejection goes to `reportError`, the latest one's to the boundary above the Close (conventions
2.4). Without `action` the prop has no effect: nothing of the part's own is pending, and a
repeated click finds the close already intended.

**A stale close is dropped.** The action's continuation runs after an `await`; if the user
dismissed the popover and opened it again meanwhile, `intended()` is `true` again and a naive
`requestClose` would close the new open. The Close records the Root's **open generation** at the
click (`openGeneration()`, a counter bumped by every `requestOpen` and by the Popup's
`beforetoggle(open)`, so foreign and pre-hydration opens count too) and, after the `await`,
returns without closing when it changed. The action's
result stands; only the close is dropped. Menu's item activation and `Dialog.Close` use the same
guard through `useActionTrigger` (dialog.md 3.4). One React behaviour to know: a
re-open dispatched while the Close's action is still pending is entangled with that action and
commits only when it settles, so the Trigger shows `data-open` / `data-pending` (and
`aria-expanded="false"` on a non-button render) and no popover until then (Menu 12, walkthrough 11).

### 3.5 `Popover.Title`, `Popover.Description`

Identical in shape to `Dialog.Title` / `Dialog.Description` (`h2` / `p`, owned `id`, state
`PopoverPopupState` through context). Implementation may share code with Dialog's.

### 3.6 Namespace

```ts
export const Popover = {
  Root: PopoverRoot,
  Trigger: PopoverTrigger,
  Popup: PopoverPopup,
  Close: PopoverClose,
  Title: PopoverTitle,
  Description: PopoverDescription,
} as const;
```

---

## 4. State model

| State | Owner | Library-owned or browser-owned | Where it shows |
| --- | --- | --- | --- |
| `open` | Root (`useControllableAction<boolean>`) | **Library-owned for opening and for part-initiated closing, browser-owned for dismissals** in library mode; fully browser-owned in JS-free mode | optimistic: Trigger `data-open`, `state.open` on Root/Trigger; committed: Popup children mounting, `state.open` on Popup; shown: exposed by the browser from the `popovertarget` Trigger, and the Root's urgent `shown` mirror of the popup's `toggle` for `aria-expanded` on a non-button Trigger render; DOM: `:popover-open` |
| `pending` | Root `useTransition` | library | Trigger `data-pending` (whenever the Root is pending, Dialog 4.2), Root `state.pending` |
| Close `pending` | Close part `useTransition` | library | `data-pending` on that Close button |
| `held` | Popup local state | library (derived from committed and the DOM's running animations) | keeps children mounted until the hide has finished animating; not exposed |
| `side`, `align` | props while closed; the browser's applied `position-try-fallbacks` option while shown (observed, urgent; conventions 3.5, 13.2) | browser (observed) | `data-side`, `data-align`, `state.side`, `state.align` on Popup: resolved while shown, requested otherwise |
| `keepMounted`, `initialFocus` | props | n/a | nothing |
| focus position, top-layer order, implicit anchor | browser | browser | `document.activeElement`, `:popover-open` |

### 4.1 The hook and the reducer

`useControllableAction<boolean, PopoverOpenChangeDetails>` with the default replace reducer;
`transitionTypes` returns `fsui-popover` plus `fsui-popover-open` or `fsui-popover-close`.
`next` is computed against `intended()` (the latest in-flight dispatch's `next`, else the
optimistic value): the Trigger toggles it; `requestOpen` skips when `true` is already intended
(StrictMode re-run of the mount reconciliation). A fact goes through `adoptFact(false)`
(conventions 3.4, 3.9.5): it supersedes every request in flight and writes committed `false`
urgently; it is not a dispatch and adds no transition type.

### 4.2 Where `data-pending` lands

As Dialog 4.2: `trigger.pending = root.pending`. Opens and part-initiated closes belong to the
Trigger; a dismissal never pends (a request it superseded may still show `data-pending` until
it settles, conventions 3.9.5). The Popup never carries `data-pending`; while a
part-initiated close is pending the popup is still committed-visible, and a consumer who wants to
dim it selects `.popup:has([data-pending])` (a `Close` with `action`) or styles from Root's
`children(state)`.

### 4.3 Error, rollback, veto

- **`openChangeAction(true)` rejects.** Boundary above Root; optimistic reverts; nothing was
  shown. Caught-inside variant: resolves, commits, opens.
- **Part-initiated `openChangeAction(false)` rejects.** The popup is still open (nothing was
  hidden). The error reaches the boundary above Root, which unmounts the component, and the
  removal hides the popover (the platform hides a removed popover without events). Caught
  inside: resolves, commits `false`, hides.
- **`onOpenChange` throws, or its promise rejects.** `reportError`; the UI is untouched. A
  request a fact superseded that later rejects goes to `reportError` too.
- **Controlled veto of an open**: snap-back of the Trigger's `data-open`; nothing opened.
- **Controlled veto of a part-initiated close**: snap-back; the popup stays open (a real veto,
  2.3). **Controlled refusal of a dismissal**: re-shown at once, without moving focus; not a veto.

### 4.4 Exit animations and the deferred unmount

Two exits exist, and the Popup must not keep children for the wrong one:

- **A dismissal** (browser close) runs the consumer's CSS exit (Chromium and Safari; Firefox hides
  instantly). Dialog's mechanism applies unchanged: the `toggle(closed)` listener calls
  `getAnimations({ subtree: true })` (after flushing style), filters out animations that never
  end and those already running at the synchronous `beforetoggle(closed)` (a baseline, as Toast
  10.2: a progress bar inside is not the exit), and if any remain sets `held` (an urgent,
  library-internal write) **before** adopting the fact, so the urgent commit that sets committed
  `false` keeps the children; when the
  animations settle, `setHeld(false)` unmounts them as a **normal update, never in a
  transition**: the popup is already `display: none`, nothing visible changes, and only
  transition commits start a document view transition.
- **A library-driven close** commits `false` first and hides in the layout effect, so the
  children would already be gone when the fade starts. Two cases:
  - **`transition` set**: the children unmount in the close commit and `hidePopover()` runs in
    its layout effect, inside the view transition React started for that commit. The old snapshot
    was captured before the mutation, so it contains the content; `::view-transition-old(…)` is
    the exit. No `held`: keeping the children would make the later unmount a second, invisible
    view transition that holds every transition for 250 ms (#35).
  - **`transition` absent**: the Popup holds the children for the hide. During render, when
    committed flips from `true` to `false` (the "previous value in state" pattern), it sets
    `held` to `true`, so `visible = committed || held` stays `true` through the close commit; the
    apply effect hides the popup; the `toggle(closed)` listener (a task later, style flushed)
    reads the animations; with none, `held` is cleared at once (a normal update; the extra
    commit is invisible, the popup is already `display: none`), otherwise when they settle.

**The release rule in the apply effect.** The render-time derivation (committed `true → false`,
no `transition`) also fires for a dismissal's commit, which lands after the
`toggle(closed)` listener already ran its animation read; nothing later would clear that hold.
So the apply effect (2.5), after every commit, releases `held` when all of: `held` is set,
committed is `false`, no `holdUntil` wait is running, no `toggle` is pending (`awaitingClose`)
and the popup is not `:popover-open`. Cost: one extra invisible commit per dismissal without an
exit animation. This holds for a dismissal, a library-driven close, a refused dismissal
(committed goes back to `true`: no release, the re-open shows the kept children) and a re-open
during a wait (`waiting()` blocks the release; the wait's generation counter drops the stale
settle): all correct.

`keepMounted` uses the same flag: `<Activity mode={committed || held ? "visible" : "hidden"}>`.
The `held` → `false` update is a normal (non-transition) update: it carries no `fsui-*` types
and starts no view transition.

---

## 5. Content mounting and Suspense

As Dialog 5, with the popover's words: `keepMounted={false}` (default) requests data when the
user opens the popup, inside the opening transition, with the Trigger pending; `keepMounted`
pre-renders at low priority inside a hidden `<Activity>`; JS-free mode always mounts.
`"until-found"` is not accepted (a closed popover is `display: none`). The two Suspense shapes
(wait-then-open, open-with-skeleton) are the consumer's choice; a boundary placed inside the
Popup shows its fallback inside the open popover and swaps in a later transition commit, which
`transition` can animate. Content rendered from a Trigger's `children` function must not suspend.

A popover that opens fifty times from fifty table rows (an "actions" popover per row) is the case
this is for: fifty closed popovers, zero fetches, one fetch per open.

---

## 6. Focus

### 6.1 Initial focus

With the default `<dialog>` element the popover focusing steps run the **dialog focusing steps**
(research, verified in Chromium 156 and Firefox 157, and in WebKit on the first CI run: the raw
platform probe in `popover.browser.test.tsx` asserts it in all three engines): an `autofocus`
descendant, else the first sequentially focusable descendant, else the popup itself. That is the APG's non-modal dialog
behaviour (focus moves in; Escape returns it), and it means the `initialFocus` prop works exactly
as Dialog's: the library writes `autofocus` on the resolved element right before `showPopover()`
and removes it after; it never calls `.focus()` on open, with **one exception**: a
resolver function as the hook's `initialFocus` (Menu) may return a `QuietFocusTarget`
(`{ element, focusVisible: false }`) for a pointer-initiated open, and where the engine reads
the `focusVisible` option (a getter probe on a detached element, `internal/overlay/focus-visible.ts`;
Chromium 145, Firefox 104, Safari 18.4) the hook skips the `autofocus` write and calls `element.focus({ focusVisible:
false })` right after `showPopover()` instead, so a mouse open does not paint a focus ring on the
item (Menu 6.1). Elsewhere the `autofocus` path runs as before. `initialFocus` itself
never takes this path.

**A refused re-open never moves focus** (conventions 3.9.4): the re-show of
a dismissal the controlled parent refused writes no `autofocus`, and the popup (any element) is
`inert` for the duration of the `showPopover()` call (written only when the consumer has not set
`inert`, removed right after), so the popover focusing steps focus nothing (an inert element is
not a focusable area): neither the dialog focusing steps of the default `<dialog>` nor a
consumer's own `autofocus` descendant in a `<div>` popup. Focus stays where the dismissal put it: the
element clicked outside, with no `blur` / `focus` event and its selection kept, or the Trigger
after Escape. Still no `.focus()`. The brief `inert` is observable during the call: a consumer's
`beforetoggle` listener on the Popup sees it, and a `MutationObserver` gets its two attribute
records (`toggle` is a later task and never sees it); an `inert` a consumer's `beforetoggle`
listener writes imperatively during that call is removed with the library's.

```tsx
<Popover.Popup initialFocus="[name=query]">…<input name="query" />…</Popover.Popup>
<Popover.Popup initialFocus={titleRef}>…<Popover.Title ref={titleRef} tabIndex={-1}>…</Popover.Popup>
```

To keep focus on the Trigger (a disclosure-style popover: an info card, a preview the user reads
before tabbing in), render a `<div>`: the popover focusing steps then move focus only to an
`autofocus` descendant, and there is none unless `initialFocus` says so.

```tsx
<Popover.Popup render={<div />} role="region">…</Popover.Popup>
```

The library keeps `role` (default `dialog`, overridden here), `aria-modal="false"`, ids and
placement on the `<div>`. Tab from the Trigger then enters the popup, which is why adjacency
(section 1) matters for this variant in Safari.

**No library focus fallback on open.** The contingency this design carried for WebKit (a
first-focusable fallback after `showPopover()` on a `<dialog>`) is closed: WebKit runs the dialog
focusing steps (CI run 39006036945, raw probe `[webkit] <dialog popover> focusing steps move
focus inside: true`). There is no library fallback: it
was a no-op in every engine, wrote a permanent `tabindex="-1"` and its "first tabbable"
heuristic diverged from the platform (inert subtrees, shadow DOM). The jsdom shim emulates the
focusing steps instead (13.1), so the jsdom rows assert the same focus outcome as the browsers.

In JS-free mode `autoFocus` in the markup works only when React rendered it on the server (React
drops the attribute and calls `.focus()` at mount on the client, which does nothing in a hidden
popover); `initialFocus` is written after mount in that mode and kept, so it works for
server-rendered and client-rendered markup alike. Recommend `initialFocus` (2.1).

### 6.2 Return focus

For the first popover in a stack the platform returns focus to the element that was focused when
the popover was shown (the Trigger), on Escape, `hidePopover()` and a foreign invoker; a light
dismiss leaves focus where the mousedown put it (the clicked button, or `<body>` for empty
space). For a **nested** popover the platform restores nothing (spec: `shouldRestoreFocus` is
set only when no auto popover was already showing), so Escape in an inner popover drops focus on
`<body>` in every engine. The library's rule, implemented in the Popup's listeners and valid in
both modes:

1. In `beforetoggle(closed)` (synchronous, focus not yet moved by the hide), record
   `focusWasInside = popup.contains(document.activeElement)` **or focus was inside the content
   when the close commit unmounted it** (below).
2. In `toggle(closed)`: if `focusWasInside` and `document.activeElement` is now `<body>` or
   still inside the hidden popup, focus the Trigger registered with Root (`triggerRef`) when it is
   connected and not inside a hidden popover; if there is no such Trigger, `blur()` the active
   element so focus does not stay on an element inside a `display: none` subtree. For a
   library-driven close the apply effect runs the same check right after its `hidePopover()`
   (2.5), so focus is back on the Trigger in the close commit rather than a task later.

**The unmounted-content case.** A library-driven close with `transition` set and
`keepMounted` false unmounts the children *in the close commit*, before `hidePopover()` runs in
its layout effect. If the user activated a `Popover.Close` (or a Trigger / a submit inside the
popup that sets a controlled `open={false}`, or a Menu item) from the keyboard, the focused
element is removed first, focus falls to `<body>`, and the platform then restores nothing (it
restores only when focus is inside the popover at the hide). Rule 1's `beforetoggle` read would
see `<body>` and the library would do nothing either. The fix is a snapshot taken before the DOM
removal: `usePopoverPopup` returns `renderContent(() => children)`, which wraps the library-mode
content in an internal probe component whose layout-effect cleanup records `popup.contains(activeElement)`
(React runs a deleted component's layout cleanups before it detaches its host nodes). That flag
is OR-ed into `focusWasInside` at `beforetoggle(closed)`, and it is cleared on every open and
whenever content unmounts while the popup stays open (a content swap is not a close). With
`keepMounted`, `<Activity mode="hidden">` does not detach the focused node synchronously, so the
ordinary rule covers it; without `transition` the children are held (4.4) and focus is still
inside at the hide. The Popup must render its content through `renderContent` (which covers both
mounting shapes, 14.4), and so must Menu.Popup and Combobox.Popup.

Why "was inside", not "is on body": a light dismiss on empty space moves focus to `<body>`
*before* the hide, and the platform deliberately leaves it there; restoring to the Trigger would
differ from the platform for the first popover and, for an outside click that closes a stack,
would focus an inner Trigger that sits inside a now-hidden outer popup. With the rule above the
library only fills the platform's gap: Escape, ArrowLeft-style programmatic closes and foreign
invokers in a nested popover, and the "opener removed while open" case Dialog 6.2 also covers.
Menu applies the same rule to submenus (research, "Focus").

No `returnFocus` prop in v0; a consumer who needs a specific target focuses it in
`openChangeAction(false)` (after its own `await`, with the usual `startTransition` wrap for any
state).

### 6.3 No trapping, Tab leaves

A popover is not modal: Tab past the last element leaves the popup and it **stays open** (research,
verified). That is the APG non-modal dialog's allowed behaviour and the library does nothing
about it; Menu closes its stack on focus leaving (#39), Popover does not. Shift+Tab from the
first element returns to the Trigger: `popovertarget` and `showPopover({ source })` insert the
popover after its invoker in sequential focus order (Chromium 156 and Firefox 157; Safari 27.0
only when DOM-adjacent, section 1).

---

## 7. Dismissal

| Close request | JS-free and library mode, every engine |
| --- | --- |
| Escape, Android back, AT dismiss | platform (the `auto` popover's close watcher); innermost popover first; inside a modal `<dialog>` the popover closes first and the dialog stays |
| Click outside | platform light dismiss (`pointerdown` + `pointerup` outside the popover, its invoker and its nested popovers); closes the whole stack |
| Click on the Trigger | not a light dismiss (the invoker is part of the popover's ancestry); JS-free: `toggle-popover` hides; library: intercepted, library-owned close |
| Another `auto` popover or a modal dialog opens outside the stack | platform: the stack closes ("hide all popovers until") |
| `hint` popover (a Tooltip) opens inside or beside | nothing: hints never close `auto` popovers (and the Tooltip baseline is `manual`) |
| Close part | JS-free: `hide-popover`; library: intercepted |
| Lost interest (`interestfor` button naming the Popup; Chromium) | JS-free: platform; library: the Popup hides on `loseinterest` when the open was an interest open, or cancels the pending open (amendment) |

Nothing in the library handles Escape or outside clicks; the Tooltip's JS Escape
(`preventDefault()` while a tooltip is open) and Dialog's non-modal Escape listener (which yields
to an open `auto` popover inside the dialog) already cooperate with this. `closedby` does not
apply to popovers. Escape cannot be disabled in v0 (as Dialog).

---

## 8. Positioning

`Popup` sets, inline, from `side` (default `"bottom"`) and `align` (default `"center"`), the
same `position-area` matrix as Tooltip 7.1, the shared one of conventions 13.1 (`bottom` →
`bottom`, `bottom` + `start` → `bottom span-self-x-end`, `right` + `start` → `right
span-bottom`, `inline-end` → `self-x-end`, and so on) plus `position-try-fallbacks: flip-block,
flip-inline, flip-block flip-inline`. The popover UA stylesheet supplies `position: fixed` and
the implicit anchor comes from `popovertarget` or `showPopover({ source })`, so no `anchor-name`
or `position-anchor` is needed. The matrix lives in one shared helper,
`internal/overlay/anchor-position.ts` (`positionArea(side, align)`, `POSITION_TRY_FALLBACKS`), which
Tooltip, Popover and Menu import; `PopoverSide` / `PopoverAlign` are the flat public names for
Popover.

The matrix is direction-aware without JS: `top` / `bottom` / `left` /
`right` are physical, `inline-start` / `inline-end` and the `start` / `end` alignment on a
horizontal side use the `self-x-*` keywords, which resolve against the popup's own inherited
`direction` and so follow a `dir="rtl"` container as well as an RTL page (plain logical
keywords would resolve against the root; conventions 13.1). Firefox misplaces any anchored popup whose parent box has a direction
different from the root's (Mozilla 2019601, conventions 13.3); no workaround ships.

`data-side` / `data-align` and `state.side` / `state.align` are the
**resolved** placement while the popup is shown: the applied `position-try-fallbacks` option
read from `getComputedStyle(popup).positionArea` by the shared `useResolvedPlacement` hook
(conventions 13.2: a `ResizeObserver` from mount, `toggle`, `scroll` and `resize` while shown;
a plain state written only when the pair changed, so an unflipped open costs no render). Closed,
on the server, or unmappable: the requested values. The gap rules of section 10 therefore sit on
the side that actually faces the Trigger after a flip; the inline `position-area` stays the
requested one. In JS-free mode the hook runs the same way (it hangs off the Popup's ref and the
platform's `toggle`, not off library state), so a `popovertarget`-opened popover reports its
resolved side too. Popover has no Arrow part; a pseudo-element
arrow keyed on the Popup's `data-side` is the recipe (Tooltip 10).

Override paths, as Tooltip 7.2: `style` on Popup (consumer wins over the inline values; the
resolved `data-side` then reports what the override produced), or `side={null}` for
stylesheet-owned placement (no inline properties, no `data-side` / `data-align`, the hook idle).
Vertical writing modes are a CSS override.

Default `bottom` / `center` rather than Tooltip's `top`: a popover is a panel the user works in,
and every prior-art library opens it below the trigger.

---

## 9. Keyboard and ARIA

| Key | Behaviour | Who |
| --- | --- | --- |
| Enter / Space on Trigger | toggles (JS-free: the command; library: the intercepted click) | browser / Trigger |
| Tab / Shift+Tab | moves through the popup's content; the popup follows the Trigger in focus order; Tab past the end leaves, the popup stays open | browser |
| Escape | closes the innermost open popover (or an open Tooltip first); focus returns to the Trigger (first in stack: platform; nested: library, 6.2); `onOpenChange(false, { reason: "dismiss" })` in library mode | browser / Popup listener |
| Escape inside a modal Dialog opened from the popup | closes the Dialog only (its close watcher is on top); a second Escape closes the popover | browser |

| Part | ARIA |
| --- | --- |
| Popup | `role="dialog"` (explicit default; WebKit has no minimum role for `[popover]`), `aria-modal="false"` (always; Chromium's `<dialog popover>` exposure), `aria-labelledby` → Title id, `aria-describedby` → Description id, both always emitted and token-merged |
| Trigger | `popoverTarget` (the Popup's id) and **no `aria-expanded`** on a `<button>`: HTML-AAM maps a `popovertarget` invoker to an implicit expanded state that Chromium, Firefox and WebKit all expose from the popover itself (`docs/research/invoker-aria-expanded.md`; `memo/architect/probes/121-popovertarget/`), and ARIA in HTML #514 forbids the explicit attribute on such a button (Firefox would OR it in). So the exposed state equals `:popover-open` at the show or hide itself, with no mirror to lag, in both modes and before hydration; `data-open` and `state.open` stay optimistic. A non-button `render` is no invoker and renders `aria-expanded` from the Root's `shown` mirror (an urgent mirror of the popup's `toggle` read from `:popover-open`) in library mode, `"false"` in JS-free mode. A native-disabled Trigger is no invoker either and exposes no state while its popup is shown: transient, accepted. JS-free mode: the Popup's native `toggle` listener writes `data-open` on the Trigger element after hydration (reads `:popover-open`, not `newState`) and the Trigger's ref syncs it once for a pre-hydration open; a styling hook, not ARIA. No `aria-haspopup` (passes through), no `aria-controls` (the implicit expanded state plus the next-in-focus-order popup is the APG disclosure shape; `aria-controls` passes through for consumers who want it) |
| Close | plain button; an icon-only one gets an `aria-label` from the consumer |
| Title | `h2` by default |

Development warnings (effect in Popup, once per instance): no accessible name once shown, checked
only when the popup's `role` is `dialog`, `alertdialog` or `menu` (a `<div>` card rendered with
`role="group"` or no role gets no warning; a `region` is the consumer's to name); `initialFocus`
unresolved or outside the popup; a Trigger or Close rendered as a non-button in JS-free mode; a
Popup rendered as something other than a `<dialog>` or `<div>`; a Popup mounted without a Root
(throws, as every component); `transition` or `keepMounted={false}` in JS-free mode; mode change
after mount. Screen-reader behaviour with `aria-modal="false"` on a `<dialog>` popover (NVDA,
JAWS, VoiceOver) must be checked in the example app before the component leaves "proposed".

---

## 10. Styling, animation, ViewTransition

The library ships no CSS. Hooks, both modes:

```css
.popover { margin: 0; inset: auto; padding: 16px; border: 0; border-radius: 8px; box-shadow: 0 8px 32px rgb(0 0 0 / .2); }
.popover { margin-block-start: 6px; }   /* the gap, static on the requested edge (side="bottom"): a flip swaps it to the other edge by itself (conventions 13.2) */
/* One class for several sides instead: symmetric along the axis, keyed on the resolved side, the
   closed logical values included; never one-sided on the resolved side (it lands on the far edge). */
.popover-any[data-side="top"], .popover-any[data-side="bottom"] { margin-block: 6px; }
.popover-any[data-side="left"], .popover-any[data-side="right"],
.popover-any[data-side="inline-start"], .popover-any[data-side="inline-end"] { margin-inline: 6px; }
.btn[data-open] { background: var(--accent-weak); }       /* both modes: optimistic in library mode, the shown popup in JS-free mode */
.btn:has(+ .popover:popover-open) { background: var(--accent-weak); } /* a page that never hydrates (no data-open yet); the Popup must follow the Trigger */
.btn[data-pending] { cursor: progress; }                  /* library mode */
.popover:has([data-pending]) { opacity: .7; }             /* a Close action running */
```

`inset: auto` is restated because the popover UA stylesheet sets `inset: 0`; Tooltip's
implementation check (7.3) found that `position-area` coexists with it, so this line is a
stylistic reset, not a requirement.

### 10.1 Enter and exit (CSS, both modes)

```css
.popover {
  opacity: 0;
  translate: 0 -4px;
  transition: opacity 120ms, translate 120ms, display 120ms allow-discrete, overlay 120ms allow-discrete;
}
.popover:popover-open { opacity: 1; translate: 0 0; }
@starting-style { .popover:popover-open { opacity: 0; translate: 0 -4px; } }
@media (prefers-reduced-motion: reduce) { .popover { transition: none; } }
```

Enter works in all three engines. Exit is progressive enhancement: Chromium (with `overlay`) and
Safari animate it, Firefox hides at once (research). The library never waits on it except to
delay the unmount (4.4), which is a no-op where there is no animation. On iOS, WebKit 317926
(`position-try-fallbacks` + `@starting-style` hang) is noted next to the snippet in the docs.

### 10.2 `transition` (ViewTransition, library mode only)

Popup renders `<ViewTransition default={transition}>` as the outermost node of its output,
**around the `<dialog popover>` element itself**, only when `transition` is given (conventions
5.1). The research probe (React 19.3.1,
Chromium 156 and Firefox 157) is the basis: with the boundary around the popover element and
`showPopover()` / `hidePopover()` in a layout effect of a transition commit, the open commit
produces `::view-transition-new(name)` of the popup's box and the close commit
`::view-transition-old(name)`; a boundary placed inside the popover around content mounted on
open gets no enter at all, because it has no box while the popover is `display: none`. In
Firefox this is the only way a popover exit can animate.

| Change | Lane | `<ViewTransition>` | Animate with |
| --- | --- | --- | --- |
| Trigger's `data-open` flip on click, and its snap-back | sync (optimistic) | never | CSS on `[data-open]` |
| Trigger's exposed expanded state | the browser's, from the popover itself (synchronous with the show / hide); `aria-expanded` on a non-button `render` is the Root's `shown` mirror, sync, urgent, one task after `showPopover()` / `hidePopover()` | never | none (`[data-open]` is the styling hook) |
| Opening commit: children mount, then `showPopover()` in the layout effect | transition, `fsui-popover-open` | yes: the popup's box as `new` (a `<dialog popover>` has no `::backdrop` of its own while shown as a popover) | `transition` prop, **or** the CSS enter in 10.1, not both for the same open |
| Content swap while open | transition | yes | `transition` prop |
| **Library-driven close** (Trigger, Close, controlled `open={false}`): children unmount and `hidePopover()` in the same commit | transition, `fsui-popover-close` (none for a controlled close) | yes: the popup's box as `old`, content included, in Chromium, Firefox and WebKit. The library cuts the popup's CSS transition around the hide, so a 10.1 CSS exit on the same popup does not show as a live, fading copy next to the `old` image | `transition` prop |
| Dismissal (Escape, click outside): hidden by the browser; a fact, one urgent commit | urgent, no type | never (conventions 3.9.8) | CSS exit in 10.1 (not in Firefox) |
| Re-show of a dismissal a controlled parent refused | urgent | never | CSS enter in 10.1 |
| `held` → `false` after a CSS exit | normal update (not a transition), no types | never: the children exit inside a hidden popup; a transition here would start a second, invisible document view transition | nothing |

Mount cost (#35): a plain open starts no document view transition even with `transition` set,
because the children mount under the always-mounted popover element (the same shield as Dialog
10.3; verified there by the developer). A `Popover.Root` inserted by a transition with
`transition` on its Popup, or a nested Popup with `transition` mounting with outer content, pays
the cross-fade. The page-policy CSS from conventions 5.1 (`::view-transition-old(root),
::view-transition-new(root) { animation: none }`, `::view-transition { pointer-events: none }`)
is the consumer's choice; keep popover view transitions short, since the page receives no
pointer events while one runs.

```tsx
<Popover.Popup transition={{ "fsui-popover-open": "pop-in", "fsui-popover-close": "pop-out", default: "none" }}>
```

```css
::view-transition-new(.pop-in) { animation: 160ms ease-out both pop-in; }
::view-transition-old(.pop-out) { animation: 120ms ease-in both pop-out; }
@media (prefers-reduced-motion: reduce) {
  ::view-transition-group(*), ::view-transition-old(*), ::view-transition-new(*) { animation: none !important; }
}
```

**The CSS exit of 10.1 stays next to `transition`; the library keeps them apart** (as Dialog
10.3, where the reasoning and the per-engine evidence live). When `transition` is set, the view
transition is the animation for every library-driven change and the CSS exit of 10.1 animates
dismissals. They must not overlap: in Chromium a popover with the `display` / `overlay`
transition stays rendered through its fade after `hidePopover()`, so a library-driven close's
view transition would capture the fading popup as a live `::view-transition-new(…)` next to the
`old` image (a double image), and the open's `@starting-style` enter would run under the view
transition's enter. So `usePopoverPopup` wraps its own `showPopover()`, the apply effect's
`hidePopover()` and Menu's `reshow()` (one cut around both halves) in `withCssTransitionCut`
when the Popup has `transition` (conventions 5.1, `internal/overlay/css-transition-cut.ts`); Menu and
Combobox get it through the shared hook. No consumer CSS is needed. The hides the library
performs as dismissals (a JS-free Close with `action`, Menu's Tab-out, outside press and drag
release, Combobox's focus-leave, a lost interest) are facts and are not cut.

---

## 11. Async walkthroughs (library mode)

Notation: `C` = committed open, `O` = optimistic open, `P` = Root pending. Uncontrolled,
`defaultOpen={false}`, `keepMounted={false}`, no `transition` unless stated.

1. **Open with content that suspends.** Click Trigger → `preventDefault` (no native command)
   → dispatch `true`: `O=true`, `P=true`; Trigger `data-open`, `data-pending`
   (exposed state still collapsed: the popup is hidden); popup hidden. Action resolves → `setInternal(true)` (transition) → children
   render, `<FilterOptions>` suspends → React holds. Data arrives → commit: `C=true`, children in
   the DOM; apply effect writes `autofocus` on the `initialFocus` target, `showPopover({ source:
   trigger })` with `opening` set (the `beforetoggle` listener lets it pass) → top layer,
   anchored, focus inside. `toggle(open)` a task later: `O` and `C` agree, nothing to do. `P=false`.
2. **Escape.** `C=true`. Escape → close watcher → `beforetoggle(closed)` (sync:
   `awaitingClose=true`, `focusWasInside` recorded) → hidden; platform restores focus to the
   Trigger → `toggle(closed)` (a task later): `awaitingClose=false`; focus is on the Trigger, no
   fallback; `getAnimations()` finds the fade (Chromium/Safari) → `held=true` (urgent) → the
   fact: `adoptFact(false)` writes `C=false` urgently and `onOpenChange(false, { reason:
   "dismiss", event: toggleEvent })` is called synchronously. One urgent commit: `O=false`,
   `C=false`, `P=false`; the Trigger loses `data-open` and never shows `data-pending`; children
   kept (`held`) → fade ends → `held=false` (a normal update) → children unmount. Firefox: no
   animations, children unmount in the fact's commit. `openChangeAction` is not called.
3. **Trigger click while open (library-driven close), `transition` set.** `C=true`, `O=true`.
   Click → `preventDefault` → `intended()` is `true` → dispatch `false` with `"activate"` and the
   `MouseEvent`: `O=false` (Trigger loses `data-open`; the exposed state stays expanded, the popup is
   still shown), `P=true`. Action
   resolves → `C=false` commits: React starts a view transition (the boundary's subtree changed),
   captures the popup's box with its content as `old`, unmounts the children, runs the apply
   effect's `hidePopover()` inside the update callback (`beforetoggle` sets `awaitingClose`;
   `focusWasInside` false, focus is on the Trigger), the `new` snapshot has no box → the exit
   animation plays in every engine. `toggle(closed)`: the hide carries the library's marker → echo,
   no dispatch, no callback; `getAnimations()` ignored (no `held` with `transition`). `P=false`. Had the close
   come from a `Popover.Close` inside the popup activated with the keyboard, the unmount would
   have moved focus to `<body>` before the hide; the content probe records that, and the
   apply effect focuses the Trigger right after `hidePopover()` (6.2).
4. **Same, `transition` absent.** As 3 until `C=false`: the render sees committed `true → false`
   and sets `held=true`, so the children stay; apply effect `hidePopover()`; `toggle(closed)`
   finds the CSS fade (Chromium/Safari) → `held` cleared when it settles, or at once (Firefox,
   or no CSS exit); both are normal updates. The user sees the popup fade with its content.
5. **`Popover.Close` with `action` (apply filters), action rejects.** Click → `preventDefault`
   (cancels `hide-popover`) → the Close's transition: `data-pending` on the button; `await
   applyFilters()` rejects → the error reaches the boundary nearest the Close (inside the popup
   if the consumer placed one there; else above Root, which unmounts the component and thereby
   hides the popover). `requestClose` never ran; `openChangeAction` never ran; a surviving popup
   stays open. If the user instead dismisses the popover (Escape) and opens it again while
   `applyFilters()` runs, the continuation finds the open generation changed and returns: the
   new open stays (3.4).
6. **Controlled parent refuses a part-initiated close.** As 3, with `openChangeAction={(next)
   => { if (next || canClose()) setOpen(next); }}`: the action resolves, the parent keeps
   `open={true}`, `O` reverts to `true`, `C` never changed, the apply effect sees `C=true` and the
   popup open → nothing. The Trigger's `data-open` snapped back; the popup never blinked. A real
   veto, available because this close was library-owned.
7. **Overlap: second click during a pending open.** Click 1: dispatch `true` (`O=true`, slow
   action). Click 2: `intended()` is `true` → dispatch `false`: `O=false`, latest intent is the
   close. Action 1 resolves: superseded, no `setInternal(true)`. Action 2 resolves:
   `setInternal(false)`, `C` already `false`, no change; the apply effect finds nothing to do. Net:
   never opened, both actions called, `openChangeAction` saw `true` then `false`. A superseded
   rejection (action 1's) is passed to `reportError` by the shared hook, not to the boundary
   (conventions 2.4). The Trigger shows `data-pending`
   from click 1 until action 2 settles.
8. **Dismissal during a pending part-initiated close.** As 3 with a slow action: `O=false`,
   `P=true`, `C=true`, popup still open. Escape → browser hides → `toggle(closed)`: not the
   library's hide → a fact: the pending close is superseded, `C=false` urgently,
   `onOpenChange(false, { reason: "dismiss" })` at once; `held` may be set for the fade. The
   consumer was asked (`openChangeAction(false)`), then told. The action keeps running; its
   resolution changes nothing, its rejection goes to `reportError`; `P` (and the Trigger's
   `data-pending`) stays until it settles (conventions 3.9.5). Focus returned to the Trigger by
   the platform at the Escape.
9. **Pre-hydration click, then hydration.** Server HTML: Trigger with `popovertarget` and no
   `aria-expanded`, empty `<dialog popover>`. Click → native open, anchored, focus on the popup
   element (nothing focusable inside); the browser exposes the Trigger as expanded. Hydration →
   the Popup's mount effect finds `:popover-open` and `C=false` → dispatch `true` with `{
   reason: "platform", event: undefined }` (a request, conventions 3.9.12) → `O=true` (Trigger
   `data-open`, `data-pending`; the Popup's mount read set `shown` from `:popover-open` for a
   non-button render's `aria-expanded`) → action resolves → `C=true` → children mount into the
   open popup; the apply effect sees it open → nothing. Focus stays where the platform put it.
   If the parent refuses or the action rejects: after settle `C=false`, popup open →
   `hidePopover()` (the library's own: an echo), focus returns to the Trigger, no callback.
10. **Nested popover, Escape in the inner.** Outer `C=true`; inner Trigger (inside the outer
    Popup) clicked → inner dispatch → inner `showPopover({ source: innerTrigger })`: both open,
    inner anchored beside its Trigger, focus inside the inner. Escape → inner hides (the outer
    stays); platform restores nothing (second in stack) → inner `beforetoggle` recorded
    `focusWasInside=true` → inner `toggle(closed)`: `activeElement` is `<body>` → the library
    focuses the inner Trigger (connected, inside the still-open outer popup) → the inner Root's
    `onOpenChange(false, { reason: "dismiss" })`. A second Escape closes the outer; the platform returns focus to the outer Trigger.
11. **Nested popover, click outside.** Both close (`onOpenChange(false, { reason: "dismiss" })` on each Root). Inner
    `focusWasInside` is `false` (the mousedown already moved focus), so the library does not touch
    focus; it is wherever the platform left it, as for a single popover.

---

## 12. Call-site examples

### 12.1 Server Component, JS-free

Section 2.1. Everything is in the server HTML; the Server Function below runs through a plain
form, and closing is the user's Done button. `initialFocus` (a selector) rather than `autoFocus`
on the textarea: the attribute is written after mount, so it works after a client navigation to
this page too (6.1).

```tsx
<Popover.Root>
  <Popover.Trigger className="btn">Report</Popover.Trigger>
  <Popover.Popup className="popover" initialFocus="[name=reason]">
    <Popover.Title>Report this post</Popover.Title>
    <form action={reportPost.bind(null, post.id)}>
      <textarea name="reason" />
      <button type="submit">Send</button>
    </form>
    <Popover.Close>Cancel</Popover.Close>
  </Popover.Popup>
</Popover.Root>
```

### 12.2 Client Component, uncontrolled, content loaded on open

```tsx
"use client";
export function ActionsCell({ row }: { row: Row }) {
  return (
    <Popover.Root defaultOpen={false}>
      <Popover.Trigger className="icon-btn" aria-label="Actions">
        {({ pending }) => (pending ? <Spinner aria-hidden /> : <DotsIcon />)}
      </Popover.Trigger>
      <Popover.Popup className="popover" align="end" transition="pop">
        <Popover.Title>Actions</Popover.Title>
        <RowActions id={row.id} />          {/* use(fetchPermissions(id)): the popup opens when ready */}
        <Popover.Close action={() => archive(row.id)}>Archive</Popover.Close>
      </Popover.Popup>
    </Popover.Root>
  );
}
```

`defaultOpen={false}` selects library mode; the Trigger spins while permissions load; "Archive"
shows `data-pending`, then the popup closes through the Root with the `pop` view transition, in
Firefox too.

### 12.3 Controlled, opened without a Trigger

```tsx
"use client";
const [open, setOpen] = useState(false);

<Popover.Root open={open} openChangeAction={(next) => { setOpen(next); }} onOpenChange={setOpen}>
  <Popover.Popup side={null} className="popover popover-centered">
    <Popover.Title>Keyboard shortcuts</Popover.Title>
    <ShortcutList />
    <Popover.Close>Close</Popover.Close>
  </Popover.Popup>
</Popover.Root>
```

No Trigger, so no anchor (`side={null}`, positioned by the stylesheet) and no focus return
target of the library's; the platform returns focus to whatever was focused when the popup
opened. A `useEffect` elsewhere may `startTransition(() => setOpen(true))` (a keyboard shortcut).

### 12.4 Submit, then close (controlled)

```tsx
"use client";
const [open, setOpen] = useState(false);

<Popover.Root open={open} openChangeAction={(next) => { setOpen(next); }} onOpenChange={setOpen}>
  <Popover.Trigger>Rename</Popover.Trigger>
  <Popover.Popup initialFocus="[name=title]">
    <Popover.Title>Rename</Popover.Title>
    <form
      action={async (formData) => {
        await rename(formData);
        startTransition(() => setOpen(false));   // a controlled, library-driven close: view transition if set
      }}
    >
      <input name="title" defaultValue={title} />
      <SubmitButton>Save</SubmitButton>          {/* useFormStatus().pending */}
      <Popover.Close>Cancel</Popover.Close>
    </form>
  </Popover.Popup>
</Popover.Root>
```

A `Popover.Form` part is deliberately absent (section 1); this is the documented shape.

### 12.5 Disclosure-style: focus stays on the Trigger

```tsx
<Popover.Root>
  <Popover.Trigger className="link">What is this?</Popover.Trigger>
  <Popover.Popup render={<div />} role="region" aria-label="Explanation" side="top" className="popover">
    <p>…</p>
    <a href="/docs/pricing">Learn more</a>
  </Popover.Popup>
</Popover.Root>
```

Render the Popup right after the Trigger so Tab enters it in every engine.

### 12.6 Nested: a Popover inside a Popover, and a modal Dialog from a Popover

```tsx
<Popover.Root defaultOpen={false}>
  <Popover.Trigger>Share</Popover.Trigger>
  <Popover.Popup>
    <Popover.Title>Share</Popover.Title>
    <Popover.Root defaultOpen={false}>                      {/* nested auto popover */}
      <Popover.Trigger>Permissions</Popover.Trigger>
      <Popover.Popup side="right" align="start">…</Popover.Popup>
    </Popover.Root>
    <Dialog.Root>                                           {/* JS-free modal from inside the popup */}
      <Dialog.Trigger>Advanced…</Dialog.Trigger>
      <Dialog.Popup>…</Dialog.Popup>
    </Dialog.Root>
  </Popover.Popup>
</Popover.Root>
```

Outer parts must sit outside the inner Root (nearest-context binding, as Dialog 12.5). The inner
popover is anchored beside its Trigger; Escape closes it and the library returns focus to
"Permissions". The Dialog is a DOM descendant, so opening it keeps the popover open; its Escape
closes the dialog first.

---

## 13. Test plan

Moved to `design/CHANGELOG.md` (part "popover.md"). Not part of the contract: the code and the tests are the reference.

## 14. Implementation notes

Moved to `design/CHANGELOG.md` (part "popover.md"). Not part of the contract: the code and the tests are the reference.

## 15. What Menu (#39) reuses, and what is Menu's own

Reused as is, through the internal hooks (`internal/overlay/use-overlay-root.ts`, `use-popover-popup.ts`, `use-popover-trigger.ts`):

- The two modes and the Root state (`usePopoverRoot` with `component: "menu"`), including
  `intended()`, `requestOpen` / `requestClose`, the fact route (`adoptFact`), close intents, and the
  `"activate"` / `"dismiss"` / `"platform"` reasons.
- The Popup machinery (`usePopoverPopup`): apply effect with `showPopover({ source })` and the
  `autofocus` write, or the quiet `focus({ focusVisible: false })` for a `QuietFocusTarget`
  (Menu passes an `initialFocus(popup)` function, returning its first or last item from the open
  cause in its own ref, quiet for a pointer open), `beforetoggle` open interception, the `toggle` fact report,
  `awaitingClose`, the `held` deferred unmount, the JS-free `aria-expanded` sync, the
  **nested focus-return rule** (6.2), which is exactly "focus the parent item when a submenu
  closes", and `renderContent`, which Menu.Popup must render its items through so that an item
  activation closing the menu with `transition` set (the focused item unmounts in the close
  commit) still returns focus to the Trigger.
- The library-driven close: `requestClose(event, "activate")` after an item's action, so the menu
  hides in the commit that ends the action and `<ViewTransition>` animates the exit in every
  engine; guarded by `openGeneration()` recorded at activation, as `Popover.Close` (3.4). Whether Menu closes before or after the action settles, and what checkbox / radio
  items do, is #39's decision (research question 1); both timings are expressible: close
  immediately = `popup.hidePopover()` with a recorded `"activate"` intent (browser-owned, CSS
  exit); close after = `requestClose` (library-owned, view transition).
- The Trigger (`usePopoverTrigger`), the positioning helper, the shim additions, the
  `transition` wiring around the top-layer element, the nesting rules (a submenu is a nested auto
  popover opened with `source`), and the WebKit 302008 test branch.

Menu-specific, left to #39: `role="menu"` on a `<div popover>` (not `<dialog>`), `aria-haspopup`
and `aria-labelledby` to the trigger, item parts (`Item`, `CheckboxItem`, `RadioItem`, `Group`,
`Separator`, `Submenu*`) with `action` props, `aria-checked` from `useOptimistic`, roving
tabindex with Up / Down / Home / End and wrap, typeahead, ArrowRight / ArrowLeft for submenus
(RTL-aware), closing the stack on Tab or focus leaving the tree, hover intent for submenus
(research question 5; not shared with Tooltip's timers in Popover, which has no hover open),
`aria-disabled` on items, `experimental_focusgroup="menu"` with the corrected `focusGroup`
detection, and the ownership vocabulary of its `open` (recommendation: the same as Popover,
Dialog option C; research question 3).

---
