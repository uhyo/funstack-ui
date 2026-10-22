# Popover

Status: **accepted** (2026-10-17, GitHub issue #38; the product owner accepted all eight
questions as recommended, see the end of this document; the Dialog view-transition close
follow-up is issue #46). **Implemented** (#40); the review's corrections
(`memo/reviewer/popover.md`, fixes in commit 35e57e1) are folded in, see "Review corrections"
at the end; the Dialog #46 review's M2 (keep the CSS exit next to `transition`, cut it while a
view transition runs) applies to Popover too and is folded into 10.2 and 13.3 (2026-10-18, commit
5dcce5f). The code under `packages/ui/src/popover/` and `src/internal/use-popover-*.ts` is the
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
and working notes in `memo/architect/popover-notes.md`. Product-owner answers to the research's
open questions: context menus are out of scope (#45); `<ViewTransition>` wraps the top-layer
element (conventions 3.5 / 5.1 amended with this design); Dialog's own close animation is a
follow-up, not changed here; the `focusgroup` detection fix (#43) is applied to conventions 8
and the Tabs design in the same commit.

Popover is the Dialog's non-modal sibling and the base Menu (#39) is built on. The platform
gives it the top layer, light dismiss, Escape, one-at-a-time stacking with nesting, the implicit
anchor and CSS placement, a declarative trigger that works before hydration, and focus return to
the trigger. The library adds the Async React half, as in Dialog: opening is a transition keyed
on committed state, so a popover whose content loads shows the Trigger pending and opens when
the content is ready; and it adds one thing Dialog does not have yet: closes that the user asks a
part for (the Trigger, a Close button) run through the library too, so `<ViewTransition>` can
animate the exit in every engine, Firefox included.

## Decisions at a glance

| # | Topic | Decision |
| --- | --- | --- |
| 1 | Anatomy | `Popover.Root` (no DOM), `Popover.Trigger` (`button[commandfor][command="toggle-popover"]`), `Popover.Popup` (`dialog[popover="auto"][aria-modal="false"]`), `Popover.Close` (`button[commandfor][command="hide-popover"]`), `Popover.Title` (`h2`), `Popover.Description` (`p`). No Portal, no Positioner, no Arrow (conventions resolved question 10), no Backdrop, no Form (section 1). |
| 2 | Two modes, one anatomy | **JS-free mode** (Root has none of `open` / `defaultOpen` / `openChangeAction`): the browser owns everything; content always mounted; works from a Server Component and before hydration. **Library mode**: open is library-owned (Trigger click intercepted, `openChangeAction(true)` awaited, content from committed state, `showPopover({ source })` in a layout effect). |
| 3 | Who closes | In library mode the line is **parts versus dismissals**, not open versus close as in Dialog: a close the user asks a part for (Trigger toggle, `Popover.Close`, a controlled `open={false}`) is **library-owned**: `openChangeAction(false)` is awaited, committed `false` lands, `hidePopover()` runs in the apply effect of that commit. Escape, light dismiss, a foreign `hide-popover` invoker and script are **browser-owned** and notified from `toggle` with `reason: "dismiss"` (`"activate"` for a foreign invoker). The popover's close is freely cancelable (no anti-abuse rule, no `close()` from a form), which Dialog's is not. |
| 4 | Element | `<dialog popover="auto">` with an explicit `aria-modal="false"` (Chromium exposes it as modal otherwise) and `role="dialog"` as an overridable default. The popover focusing steps run the dialog focusing steps (verified in Chromium, Firefox and WebKit; no library fallback), so focus moves into the popup on open as the APG asks for a non-modal dialog, with the same `initialFocus` / `autofocus` story as Dialog. `render={<div />}` keeps focus on the trigger (disclosure-style). |
| 5 | Dismissal | `auto` only: light dismiss, Escape, Android back, one-at-a-time stacking are the platform's in every engine. No `lightDismiss` prop, no `manual` variant in v0. |
| 6 | Nesting | A Popover inside a Popup is a nested auto popover: opened with `commandfor` or `showPopover({ source })` so the outer stays open; Escape closes the innermost; an outside click closes the stack. The platform restores focus only for the first popover in a stack, so the library restores focus to the Trigger when focus was inside the closed popup (or inside the content the close commit unmounted) and the platform left it on `<body>` (section 6.2). Never portals (inside a modal Dialog a portalled popover would be inert). |
| 7 | Pending UI | Trigger: `aria-expanded` and `data-open` (optimistic), `data-pending` (library mode). The Popup emits no `data-open` (`:popover-open` is exact). Root has no DOM, so `pending` lives on the Trigger and in Root's `children(state)`. JS-free mode: `aria-expanded` is written on the Trigger from the popup's `toggle` listener (no React state). |
| 8 | Reasons | `details.reason`: `"activate"` (Trigger, Close, a foreign invoker), `"dismiss"` (Escape, light dismiss, script `hidePopover()`), `"platform"` (found open on mount after a pre-hydration click). No `returnValue`: popovers have none. |
| 9 | Content mounting | Library mode: children unmount when closed by default; `keepMounted` keeps them in `<Activity mode="hidden">` (boolean only). Unmount waits for the popover's CSS exit animation **unless `transition` is set**, in which case a library-driven close unmounts in the close commit and the view transition carries the content out (section 4.4). JS-free mode: always mounted. |
| 10 | Positioning | `side` (`"bottom"`) and `align` (`"center"`) on Popup set inline `position-area` and `position-try-fallbacks`, the shared matrix of conventions 13.1 (physical sides plus `inline-start` / `inline-end`; inline-relative `align` on a horizontal side; wave 11, #53); `side={null}` emits nothing. `data-side` / `data-align` and `state.side` / `state.align` are the **resolved** placement while shown (conventions 13.2; wave 11, #20). Anchor: the implicit anchor from `commandfor` (JS-free) or `showPopover({ source: trigger })` (library). |
| 11 | Animation | CSS (`@starting-style`, `allow-discrete`, `overlay`) for every open and for browser-owned closes; exit is progressive enhancement (none in Firefox). With `transition`, `<ViewTransition>` wraps **the `<dialog popover>` element itself** and animates library-driven opens and closes in all three engines, Firefox's exit included (research, "ViewTransition"). |
| 12 | Directives | Every part file is `"use client"` (context for ids and mode). "JS-free" means no behaviour JS runs for the interaction and the markup works before hydration, as in Dialog. |
| 13 | For Menu | The Root state, the Popup machinery (apply effect, listeners, close intents, focus-return fallback, deferred unmount, `aria-expanded` sync), the Trigger interception and the positioning helper are internal hooks that `Menu` (#39) composes with `role="menu"`, `aria-haspopup`, item parts and keyboard handling of its own (section 15). |

---

## 1. Anatomy

```tsx
import { Popover } from "@funstack/ui/popover";

<Popover.Root>                                        {/* no DOM; owns ids, mode, state, context */}
  <Popover.Trigger>Filters</Popover.Trigger>          {/* button[commandfor][command=toggle-popover] */}
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
<button type="button" commandfor="_r_1_" command="toggle-popover" aria-expanded="false">Filters</button>
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
| `Trigger` | `button` | button | `aria-expanded` (optimistic in library mode; DOM-synced in JS-free mode), `data-open`, `data-pending` (library mode), `data-disabled` whenever disabled, in every mode (wave 9, 5fc05d5) | `commandfor` + `command="toggle-popover"`. No `aria-haspopup` (APG disclosure has none; Menu adds `"menu"`). |
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
JS-free mode; dev warning, as Dialog). `Popup` may render a `<dialog>` (default) or a `<div>`
(section 6.1, focus stays on the trigger); anything else warns. The library's `[popover]`,
`role`, `aria-modal` and ids go on whichever element renders.

Render the Popup **immediately after the Trigger** where the layout allows it. Safari 27.0 does
not place a far popover next in the Tab order after its invoker (research, WPT
`popover-focus-2` / `-4`), which matters for the `<div>` variant where focus stays on the
trigger; and HTML-AAM suppresses the redundant `aria-details` relation when the popover is the
next accessibility sibling. With the default `<dialog>` focus moves into the popup on open, so
adjacency is a recommendation, not a requirement (as `commandfor` links by id, the parts need
not be siblings at all).

---

## 2. The two modes

| | JS-free mode | Library mode |
| --- | --- | --- |
| Selected when | Root has none of `open`, `defaultOpen`, `openChangeAction` | Root has any of them |
| Open | Browser: `command="toggle-popover"` | Library: Trigger click intercepted, dispatch inside the Root's transition, `showPopover({ source: trigger })` in a layout effect of the commit that mounts the content; foreign opens cancelled at `beforetoggle` and routed the same way |
| Close by a part (Trigger, Close) | Browser: `toggle-popover` / `hide-popover` | Library: click intercepted, dispatch `false`, `hidePopover()` in the apply effect after the action settles |
| Close by dismissal (Escape, light dismiss, foreign invoker, script) | Browser | Browser; `openChangeAction(false)` notified from `toggle` |
| Content | Always mounted | Rendered from committed `open`; unmounted while closed unless `keepMounted` |
| `aria-expanded` on Trigger | DOM-synced from `toggle` after hydration (section 9) | React-rendered from optimistic state |
| `data-open`, `data-pending` on Trigger | never emitted | emitted |
| `openChangeAction` | n/a | awaited for `true` and for part-initiated `false`; a notification for dismissals |
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

The browser does all of it: the Trigger's `toggle-popover` opens the popup in the top layer,
anchored below the button; the dialog focusing steps focus the input (the first sequentially
focusable descendant); Escape, a click outside and the Done button's `hide-popover` close it and
return focus to the Trigger; opening another `auto` popover closes this one.

When the element to focus is not the first focusable one, use `initialFocus` (a selector, so it
serialises from a Server Component), not `autoFocus`: React writes `autofocus` only into
server-rendered HTML, not when it renders the element on the client (a client navigation to a
Server Component page), whereas the library writes the attribute from `initialFocus` after mount
in JS-free mode and keeps it there (6.1). `autoFocus` remains the plain-HTML alternative for
markup that is always server-rendered. In Chromium the invoker gets an implicit `aria-expanded`; the library renders it
explicitly for every engine (section 9).

What still runs JS in this mode, after hydration: the `toggle` listener that writes
`aria-expanded` on the Trigger and restores focus for nested popovers (6.2), the `Close` action
when given, and development warnings. None of them changes React state.

What this mode cannot do: load content on open, show pending state, or start open (a popover's
open state cannot be server-rendered: there is no attribute for it). Those are library mode.

### 2.2 Library mode: open is library-owned

Any of `open`, `defaultOpen`, `openChangeAction` on Root turns the Popover into a FUNSTACK state
owner through `useControllableAction<boolean>`, exactly as Dialog:

```tsx
// Uncontrolled: the popup opens when the action resolves and the content has rendered.
<Popover.Root defaultOpen={false} openChangeAction={(open) => analytics.track("filters", open)}>

// Controlled, local state: sync prefix, a Transition update.
<Popover.Root open={open} openChangeAction={(next) => { setOpen(next); }}>

// Controlled, server-backed: update on success, re-wrapped after the await.
<Popover.Root
  open={open}
  openChangeAction={async (next) => {
    if (next) await prefetchFilters();
    startTransition(() => setOpen(next)); // required after an await
  }}
>
```

The Trigger intercepts its click (the command runs as the button's activation behaviour, after
`click`, only if it was not cancelled; Enter and Space synthesise the same `click`):

```tsx
// inside PopoverTrigger (library mode)
onClick={(event) => {
  event.preventDefault();                       // the browser does not run toggle-popover
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
implicit anchor, focus-order insertion and nesting as the declarative `commandfor` path, and the
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
| `Trigger` `aria-expanded`, `data-open`, `data-pending`, `state.open` | optimistic | `"true"`, present, present |
| `Popup` `:popover-open`, visibility | DOM (follows committed) | closed |
| `Popup` children | committed | not rendered (default) or hidden (`keepMounted`) |
| `Root` `state.pending` | transition | true |

### 2.3 Library mode: three kinds of close

| Close | Owner | What happens | `reason` | `details.event` |
| --- | --- | --- | --- | --- |
| Trigger click while open | library | click cancelled; dispatch `false`; `openChangeAction(false)` awaited; committed `false` commits; apply effect `hidePopover()` (view transition if `transition` is set) | `"activate"` | the `click` `MouseEvent` |
| `Popover.Close` (with or without `action`) | library | click cancelled; `action` awaited in the Close's own transition (`data-pending` on the button); then the same dispatch as above | `"activate"` | the `click` `MouseEvent` |
| Controlled parent sets `open={false}` | library | apply effect `hidePopover()`; the resulting `toggle` is an echo, no dispatch | (no dispatch) | |
| Escape, Android back, AT dismiss, light dismiss | browser | popover hidden at once; `toggle` → dispatch `false` as a notification: optimistic `false`, action awaited inside the Root's transition, uncontrolled state committed after it | `"dismiss"` | the `toggle` `ToggleEvent` |
| A foreign `hide-popover` / `toggle-popover` invoker | browser | the Popup's `command` listener records an `"activate"` intent; `toggle` consumes it | `"activate"` | the `CommandEvent` |
| Script `hidePopover()`, another `auto` popover or modal dialog opening elsewhere | browser | as a dismissal | `"dismiss"` | the `toggle` `ToggleEvent` |

Why the line is drawn here and not at "close is browser-owned" as in Dialog: a dialog's close
requests are vetoable only once per user activation and `close()` from a `method="dialog"` form
not at all, so Dialog cannot honestly promise a library-owned close. A popover's part-initiated
closes are plain commands the library cancels like it cancels the open, and the popover hides
when the library says so. That is what makes the exit animatable by `<ViewTransition>` in every
engine (10.2), and it is the shape Menu needs for "activate an item, run its action, close in the
commit" (#39). Dismissals remain the browser's: `beforetoggle` for a close is not cancelable, and
a user who pressed Escape expects the popup to go away now. The `openChangeAction` doc comment
says which closes are awaited and which are notified.

Close intents work as in Dialog 2.3: the `toggle` event carries no source, so the Popup records
what caused the close just before it happens and the `toggle` listener consumes it; a recorded
intent that did not result in a close is cleared by one `setTimeout(0)` that clears it only if
the popover is still open. In library mode the only recorded intents are foreign invokers; the
library's own `hidePopover()` calls are recognised through `intended()` (the latest in-flight
dispatch's `next`, else the optimistic value): a `toggle` that arrives while the user already
intends `false` is an echo and dispatches nothing.

**A controlled parent that refuses a dismissal.** The popup is already closed when the action
runs. If the parent keeps `open={true}`, optimistic reverts to `true` after the action settles
and the apply effect re-opens the popup. This is conventions 3.5 ("it follows the browser, it
does not gate it"), the same as Dialog, and not a veto. A controlled parent that refuses a
**part-initiated** close (keeps `open={true}` after a Trigger or Close click) gets a plain
snap-back: nothing was hidden, the Trigger's `data-open` returns, the popup stays open. That is
a real veto, because the close was library-owned; the docs say so and show the usual
"adopt `false` unless …" shape for it.

### 2.4 Pre-hydration opens and mount reconciliation (library mode)

Library mode renders the same `commandfor` / `command="toggle-popover"` markup, so a click before
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

```ts
useLayoutEffect(() => {
  if (!isLibrary) return;
  const popup = popupRef.current;
  if (popup === null || !popup.isConnected) return;
  if (!root.pending && root.latestInFlight() === null) {
    const shown = popup.matches(":popover-open");
    if (committedOpen && !shown) {
      if (!awaitingClose.current) {             // hidden, but its `toggle` has not arrived yet: wait
        applyInitialFocus(popup, initialFocus); // writes `autofocus`, section 6.1
        opening.current = true;                 // the beforetoggle listener lets this one through
        try { popup.showPopover({ source: triggerRef.current ?? undefined }); }
        finally { opening.current = false; removeInitialFocus(); }
      }
    } else if (!committedOpen && shown) {
      root.recordCloseIntent(undefined);
      popup.hidePopover();                      // echo: `toggle` finds `false` intended, skips
      if (focusWasInside.current) returnFocus(popup); // the close commit may have unmounted the focused content (6.2 rule 1)
    }
  }
  if (committedOpen && popup.matches(":popover-open")) contentHadFocus.current = false; // content left while open: not a close
  if (held && !committedOpen && !waiting() && !awaitingClose.current && !popup.matches(":popover-open")) release(); // 4.4
});
```

The re-open race is the same as Dialog's: a native hide is synchronous but `toggle` arrives a
task later, so a commit landing in between would see committed `true`, a hidden popup and nothing
in flight and would call `showPopover()` again. The guard is `awaitingClose`, set in the
synchronous `beforetoggle(closed)` listener and cleared in `toggle`. `beforetoggle` fires inside
the hide steps in every engine and in the jsdom shim.

One effect covers: the normal open, `defaultOpen` on mount, a controlled open without a Trigger,
a controlled close, a library-driven close after `openChangeAction(false)` settled, the re-open
of a refused dismissal, and the close after a rejected or refused pre-hydration open. It also
returns focus after a hide whose close commit already unmounted the focused content (6.2) and
releases a `held` that no animation is going to release (4.4).

**`defaultOpen` and the server HTML.** `defaultOpen={true}` is committed state from the first
render, as in Dialog: the content and the Trigger's `aria-expanded="true"` / `data-open` are in
the server HTML. Only the *showing* waits for hydration, because HTML has no attribute for an
open popover: before the apply effect's first `showPopover()` the Trigger says expanded while
the popup is hidden (accepted at review; Dialog parity).

### 2.6 Nesting and stacking

A `Popover.Root` rendered inside a Popup is a nested auto popover and needs nothing from the
consumer. The platform's rules (research, "Stacking and nesting", verified in Chromium and
Firefox): opening the inner through its Trigger (`commandfor` in JS-free mode,
`showPopover({ source })` in library mode) keeps the outer open whatever the DOM position; two
inner popovers close each other; Escape closes the innermost only; an outside click closes the
whole stack (each Popup notifies its own Root with `"dismiss"`); clicking in the outer popup
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
(only buttons run commands); dev warning, as Dialog. Note that in library mode a non-button
Trigger is still passed as `source`, so anchoring and focus order work.

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
  /** An `openChangeAction` dispatched through this Popover is in flight (library mode only). */
  readonly pending: boolean;
}

export interface PopoverRootProps {
  /** Controlled open state. `undefined` means uncontrolled (and, with the other two absent, JS-free mode). */
  open?: boolean;
  /**
   * Initial open state in uncontrolled library mode. `true` renders the content and the Trigger's
   * open state into the server HTML; the popover itself is shown after hydration (HTML has no
   * attribute for an open popover).
   */
  defaultOpen?: boolean;
  /**
   * Awaited for `true` (the popover opens when it resolves and the content has rendered) and for
   * a `false` the user asked a part for (Trigger, Close: the popover hides when it resolves, with
   * a view transition if `transition` is set). A notification for a dismissal (Escape, click
   * outside: the popover is already hidden; the action runs inside the Root's transition). May
   * be a Server Function. Rejections reach the nearest Error Boundary above Root.
   *
   * A `setState` placed after your own `await` is not a Transition update; wrap it in
   * `startTransition` (React limitation).
   */
  openChangeAction?: ChangeAction<boolean, PopoverOpenChangeDetails>;
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
  /** The Root's transition is pending (an open, a part-initiated close or a dismissal notification). */
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
  /** Should render a `<button>`; another element works only in library mode (click handler). */
  render?: RenderProp<ComponentPropsWithRef<"button">, PopoverTriggerState>;
}
```

Owned keys: `type` (`"button"`, on a `<button>` only), `commandfor`, `command`, `disabled`,
`aria-expanded`, `data-open`, `data-pending`, `data-disabled`, and `onClick` only when installed
(library mode; in JS-free mode the Trigger installs no handler and a `render` element's own
`onClick` passes through). `aria-haspopup` is not rendered and passes through (a consumer may
set `"dialog"`; Menu's trigger sets `"menu"`). `aria-expanded` is owned in both modes: in JS-free
mode its React value is `"false"` and the DOM value is kept current by the Popup's `toggle`
listener (section 9).

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
   * click outside) are the browser's and animate with CSS only. Ignored (dev warning) in JS-free
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
  /** Native `disabled`; owned, so a `render` element cannot re-enable the button. */
  disabled?: boolean;
  className?: StateValue<string | undefined, PopoverCloseState>;
  style?: StateValue<CSSProperties | undefined, PopoverCloseState>;
  children?: StateValue<ReactNode, PopoverCloseState>;
  render?: RenderProp<ComponentPropsWithRef<"button">, PopoverCloseState>;
}
```

Owned keys: `type`, `commandfor`, `command` (`"hide-popover"`), `disabled`, `onClick` (library
mode, or with `action`), `data-pending`, `data-disabled`. No `value` and no `returnValue`:
popovers have none. In library mode the click is always intercepted, with or without `action`,
so every Close goes through the Root's transition and the apply effect; in JS-free mode without
`action` the browser runs the command, with `action` the part runs it then calls
`popup.hidePopover()` directly (a browser-owned close; the `toggle` listener has no Root state to
notify). **Amended with #81 (2026-10-22, `design/components/button.md` 16):** a repeated click
while the Close's own action is pending is **ignored** (the hook's in-flight guard, click
`preventDefault()`ed) and the button renders `aria-disabled="true"` while it shows `data-pending`
(the action and the hide commit). Before #81 repeated clicks re-ran the action and the first hide
won. The action runs through the shared `useActionTrigger({ openGeneration })` (conventions 3.4;
landed with #41); its superseded-rejection path is no longer reachable from a Close (the row in
the test plan becomes the single-run rejection row, `button.md` 16.4 P3).

**A stale close is dropped.** The action's continuation runs after an `await`; if the user
dismissed the popover and opened it again meanwhile, `intended()` is `true` again and a naive
`requestClose` would close the new open. The Close records the Root's **open generation** at the
click (`openGeneration()`, a counter bumped by every `requestOpen` and by the Popup's
`beforetoggle(open)`, so foreign and pre-hydration opens count too) and, after the `await`,
returns without closing when it changed (product-owner decision at review, L3). The action's
result stands; only the close is dropped. Menu's item activation and `Dialog.Close` use the same
guard through `useActionTrigger` (menu.md 14, dialog.md 3.4). One React behaviour to know: a
re-open dispatched while the Close's action is still pending is entangled with that action and
commits only when it settles, so the Trigger shows `aria-expanded="true"` / `data-pending` and
no popover until then (Menu 12, walkthrough 11).

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
| `open` | Root (`useControllableAction<boolean>`) | **Library-owned for opening and for part-initiated closing, browser-owned for dismissals** in library mode; fully browser-owned in JS-free mode | optimistic: Trigger `aria-expanded`, `data-open`, `state.open` on Root/Trigger; committed: Popup children mounting, `state.open` on Popup; DOM: `:popover-open` |
| `pending` | Root `useTransition` | library | Trigger `data-pending` (whenever the Root is pending, Dialog 4.2), Root `state.pending` |
| Close `pending` | Close part `useTransition` | library | `data-pending` on that Close button |
| `held` | Popup local state | library (derived from committed and the DOM's running animations) | keeps children mounted until the hide has finished animating; not exposed |
| `side`, `align` | props while closed; the browser's applied `position-try-fallbacks` option while shown (observed, urgent; conventions 3.5, 13.2; wave 11, #20) | browser (observed) | `data-side`, `data-align`, `state.side`, `state.align` on Popup: resolved while shown, requested otherwise |
| `keepMounted`, `initialFocus` | props | n/a | nothing |
| focus position, top-layer order, implicit anchor | browser | browser | `document.activeElement`, `:popover-open` |

### 4.1 The hook and the reducer

`useControllableAction<boolean, PopoverOpenChangeDetails>` with the default replace reducer;
`transitionTypes` returns `fsui-popover` plus `fsui-popover-open` or `fsui-popover-close`.
`next` is computed against `intended()` (the latest in-flight dispatch's `next`, else the
optimistic value): the Trigger toggles it; `notifyClosed` skips the dispatch when `false` is
already intended (echo of the library's own `hidePopover()`, or a dismissal that landed during a
pending part-initiated close); `requestOpen` skips when `true` is already intended (StrictMode
re-run of the mount reconciliation).

### 4.2 Where `data-pending` lands

As Dialog 4.2: `trigger.pending = root.pending`. Opens, part-initiated closes and dismissal
notifications all belong to the Trigger. The Popup never carries `data-pending`; while a
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
- **Dismissal notification rejects.** The popup is already hidden; as Dialog 4.3 (the boundary
  unmounts the component; a re-open is observable only for a controlled parent that refuses or
  an action that catches without adopting `false`).
- **Controlled veto of an open**: snap-back of the Trigger's `data-open`; nothing opened.
- **Controlled veto of a part-initiated close**: snap-back; the popup stays open (a real veto,
  2.3). **Controlled refusal of a dismissal**: re-opens; not a veto.

### 4.4 Exit animations and the deferred unmount

Two exits exist, and the Popup must not keep children for the wrong one:

- **A dismissal** (browser close) runs the consumer's CSS exit (Chromium and Safari; Firefox hides
  instantly). Dialog's mechanism applies unchanged: the `toggle(closed)` listener calls
  `getAnimations({ subtree: true })` (after flushing style), filters out animations that never
  end and those already running at the synchronous `beforetoggle(closed)` (a baseline, as Toast
  10.2: a progress bar inside is not the exit; #64), and if any remain sets `held` (an urgent, library-internal write) **before** dispatching
  the notification, so the commit that sets committed `false` keeps the children; when the
  animations settle, `setHeld(false)` unmounts them as a **normal update, never in a
  transition**: the popup is already `display: none`, nothing visible changes, and only
  transition commits start a document view transition. (The first implementation released in a
  transition, so a dismissal with `transition` set and a CSS exit ran two root cross-fades and
  two pointer-events-free windows for one Escape; review M1.)
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
no `transition`) also fires for a dismissal's *notification* commit, which lands after the
`toggle(closed)` listener already ran its animation read; nothing later would clear that hold.
So the apply effect (2.5), after every commit, releases `held` when all of: `held` is set,
committed is `false`, no `holdUntil` wait is running, no `toggle` is pending (`awaitingClose`)
and the popup is not `:popover-open`. Cost: one extra invisible commit per dismissal without an
exit animation. Traced at review for a dismissal, a library-driven close, a refused dismissal
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
`resolveInitialFocus` resolver (Menu) may return a `QuietFocusTarget`
(`{ element, focusVisible: false }`) for a pointer-initiated open, and where the engine reads
the `focusVisible` option (a getter probe on a detached element; Chromium 145, Firefox 104,
Safari 18.4) the hook skips the `autofocus` write and calls `element.focus({ focusVisible:
false })` right after `showPopover()` instead, so a mouse open does not paint a focus ring on the
item (Menu 6.1, review H1). Elsewhere the `autofocus` path runs as before. `initialFocus` itself
never takes this path.

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
focus inside: true`). The fallback that was implemented up front was removed at review (L1): it
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

**The unmounted-content case (review H1).** A library-driven close with `transition` set and
`keepMounted` false unmounts the children *in the close commit*, before `hidePopover()` runs in
its layout effect. If the user activated a `Popover.Close` (or a Trigger / a submit inside the
popup that sets a controlled `open={false}`, or a Menu item) from the keyboard, the focused
element is removed first, focus falls to `<body>`, and the platform then restores nothing (it
restores only when focus is inside the popover at the hide). Rule 1's `beforetoggle` read would
see `<body>` and the library would do nothing either. The fix is a snapshot taken before the DOM
removal: `usePopoverPopup` returns `wrapContent(children)`, which wraps the library-mode content
in an internal component whose layout-effect cleanup records `popup.contains(activeElement)`
(React runs a deleted component's layout cleanups before it detaches its host nodes). That flag
is OR-ed into `focusWasInside` at `beforetoggle(closed)`, and it is cleared on every open and
whenever content unmounts while the popup stays open (a content swap is not a close). With
`keepMounted`, `<Activity mode="hidden">` does not detach the focused node synchronously, so the
ordinary rule covers it; without `transition` the children are held (4.4) and focus is still
inside at the hide. The Popup must render its content through `wrapContent` in both mounting
shapes (14.4), and so must Menu.Popup.

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
first element returns to the Trigger: `commandfor` and `showPopover({ source })` insert the
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
the implicit anchor comes from `commandfor` or `showPopover({ source })`, so no `anchor-name`
or `position-anchor` is needed. The matrix lives in one shared helper,
`internal/anchor-position.ts` (`positionArea(side, align)`, `POSITION_TRY_FALLBACKS`), which
Tooltip, Popover and Menu import; `PopoverSide` / `PopoverAlign` are the flat public names for
Popover.

Since wave 11 (#53) the matrix is direction-aware without JS: `top` / `bottom` / `left` /
`right` are physical, `inline-start` / `inline-end` and the `start` / `end` alignment on a
horizontal side use the `self-x-*` keywords, which resolve against the popup's own inherited
`direction` and so follow a `dir="rtl"` container as well as an RTL page (plain logical
keywords would resolve against the root; conventions 13.1). An LTR page places exactly as the
v0 physical matrix did. Firefox misplaces any anchored popup whose parent box has a direction
different from the root's (Mozilla 2019601, conventions 13.3); no workaround ships.

Since wave 11 (#20) `data-side` / `data-align` and `state.side` / `state.align` are the
**resolved** placement while the popup is shown: the applied `position-try-fallbacks` option
read from `getComputedStyle(popup).positionArea` by the shared `useResolvedPlacement` hook
(conventions 13.2: a `ResizeObserver` from mount, `toggle`, `scroll` and `resize` while shown;
a plain state written only when the pair changed, so an unflipped open costs no render). Closed,
on the server, or unmappable: the requested values. The gap rules of section 10 therefore sit on
the side that actually faces the Trigger after a flip; the inline `position-area` stays the
requested one. In JS-free mode the hook runs the same way (it hangs off the Popup's ref and the
platform's `toggle`, not off library state), so a `commandfor`-opened popover reports its
resolved side too. Popover has no Arrow part (conventions resolved question 10); a pseudo-element
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
| Escape | closes the innermost open popover (or an open Tooltip first); focus returns to the Trigger (first in stack: platform; nested: library, 6.2); `openChangeAction(false, { reason: "dismiss" })` in library mode | browser / Popup listener |
| Escape inside a modal Dialog opened from the popup | closes the Dialog only (its close watcher is on top); a second Escape closes the popover | browser |

| Part | ARIA |
| --- | --- |
| Popup | `role="dialog"` (explicit default; WebKit has no minimum role for `[popover]`), `aria-modal="false"` (always; Chromium's `<dialog popover>` exposure), `aria-labelledby` → Title id, `aria-describedby` → Description id, both always emitted and token-merged |
| Trigger | `aria-expanded`: library mode renders the optimistic value; JS-free mode renders `"false"` and the Popup's native `toggle` listener writes `"true"` / `"false"` on the Trigger element after hydration (reads `:popover-open`, not `newState`, so a stale task cannot lie), and the mount effect syncs it once for a pre-hydration open. Chromium's implicit invoker state is thereby overridden by the explicit attribute, and Gecko / WebKit (unverified for the implicit mapping) get it too. No `aria-haspopup` (passes through), no `aria-controls` (`aria-expanded` plus the next-in-focus-order popup is the APG disclosure shape; `aria-controls` passes through for consumers who want it) |
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
.btn[aria-expanded="true"] { background: var(--accent-weak); }  /* both modes */
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
5.1 and the rule added with this design to 3.5 / 5.1). The research probe (React 19.3.1,
Chromium 156 and Firefox 157) is the basis: with the boundary around the popover element and
`showPopover()` / `hidePopover()` in a layout effect of a transition commit, the open commit
produces `::view-transition-new(name)` of the popup's box and the close commit
`::view-transition-old(name)`; a boundary placed inside the popover around content mounted on
open gets no enter at all, because it has no box while the popover is `display: none`. In
Firefox this is the only way a popover exit can animate.

| Change | Lane | `<ViewTransition>` | Animate with |
| --- | --- | --- | --- |
| Trigger's `data-open` / `aria-expanded` flip on click, and its snap-back | sync (optimistic) | never | CSS on `[data-open]` |
| Opening commit: children mount, then `showPopover()` in the layout effect | transition, `fsui-popover-open` | yes: the popup's box as `new` (a `<dialog popover>` has no `::backdrop` of its own while shown as a popover) | `transition` prop, **or** the CSS enter in 10.1, not both for the same open |
| Content swap while open | transition | yes | `transition` prop |
| **Library-driven close** (Trigger, Close, controlled `open={false}`): children unmount and `hidePopover()` in the same commit | transition, `fsui-popover-close` (none for a controlled close) | yes: the popup's box as `old`, content included, in Chromium, Firefox and WebKit (CI). With the 10.1 CSS exit on the popup, Chromium keeps the hidden box rendered through its fade, so the `new` snapshot carries a live, fading copy next to the `old` image (a double image) unless the recipe below cuts the fade | `transition` prop, with the recipe below when the CSS exit is kept |
| Dismissal (Escape, click outside): hidden by the browser, then a notification commit | notification commit, `fsui-popover-close` | without a CSS exit the popup is already `display: none` and there is nothing to animate; with one, the commit usually lands inside the fade, so in Chromium it captures the fading box in both snapshots; the recipe below cuts the fade at the transition and hands the rest of the exit to the `old` snapshot (Dialog 10.3) | CSS exit in 10.1 (not in Firefox), with the recipe below |
| `held` → `false` after a CSS exit | normal update (not a transition), no types | never: the children exit inside a hidden popup; a transition here would start a second, invisible document view transition (review M1) | nothing |

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
/* Keep the CSS exit of 10.1 for dismissals, but not while a view transition runs. */
html:active-view-transition .popover { transition: none; }
@media (prefers-reduced-motion: reduce) {
  ::view-transition-group(*), ::view-transition-old(*), ::view-transition-new(*) { animation: none !important; }
}
```

**The recipe: keep the CSS exit, cut it while a view transition runs** (shared with Dialog
10.3, where the reasoning and the per-engine evidence live; Dialog #46 review M2). When
`transition` is set, the view transition is the animation for every library-driven change and
the CSS exit of 10.1 stays for dismissals. They must not overlap: in Chromium a popover with the
`display` / `overlay` transition stays rendered through its fade after `hidePopover()`, so a
library-driven close's view transition captures the fading popup as a live
`::view-transition-new(…)` next to the `old` image, a double image (probed in Chromium 156 with
the docs recipe, same shape as Dialog's). `html:active-view-transition .popover { transition:
none; }` removes it: the box is `display: none` when the new snapshot is taken. The selector is
untyped on purpose, because a controlled close carries no types; the cost is that an unrelated
page view transition also cuts a dismissal's fade in progress. Firefox animates no CSS exit and
never had a new image; WebKit has the box `display: none` by `ready` either way. (The first
version of this paragraph recommended "at most a CSS exit for dismissals", which runs for
library closes too.) That combination runs exactly one document view transition per dismissal
(the notification commit) and one per library-driven close, with one image of the popup each;
the later `held` release is a normal update and starts none (browser row "a dismissal runs one
view transition, not two").

---

## 11. Async walkthroughs (library mode)

Notation: `C` = committed open, `O` = optimistic open, `P` = Root pending. Uncontrolled,
`defaultOpen={false}`, `keepMounted={false}`, no `transition` unless stated.

1. **Open with content that suspends.** Click Trigger → `preventDefault` (no native command)
   → dispatch `true`: `O=true`, `P=true`; Trigger `aria-expanded="true"`, `data-open`,
   `data-pending`; popup hidden. Action resolves → `setInternal(true)` (transition) → children
   render, `<FilterOptions>` suspends → React holds. Data arrives → commit: `C=true`, children in
   the DOM; apply effect writes `autofocus` on the `initialFocus` target, `showPopover({ source:
   trigger })` with `opening` set (the `beforetoggle` listener lets it pass) → top layer,
   anchored, focus inside. `toggle(open)` a task later: `O` and `C` agree, nothing to do. `P=false`.
2. **Escape, sync notification.** `C=true`. Escape → close watcher → `beforetoggle(closed)`
   (sync: `awaitingClose=true`, `focusWasInside` recorded) → hidden; platform restores focus to
   the Trigger → `toggle(closed)` (a task later): `awaitingClose=false`; focus is on the Trigger,
   no fallback; `getAnimations()` finds the fade (Chromium/Safari) → `held=true` (urgent) →
   `notifyClosed`: `intended()` is `true`, so dispatch `false` with `{ reason: "dismiss", event:
   toggleEvent }`: `O=false`, `P=true`, Trigger `data-pending`, no `data-open`. Action resolves →
   `C=false` commits with children kept (`held`) → fade ends → `held=false` (a normal update) →
   children unmount. Firefox: no animations, children unmount with the `C=false` commit.
3. **Trigger click while open (library-driven close), `transition` set.** `C=true`, `O=true`.
   Click → `preventDefault` → `intended()` is `true` → dispatch `false` with `"activate"` and the
   `MouseEvent`: `O=false` (Trigger loses `data-open`, `aria-expanded="false"`), `P=true`. Action
   resolves → `C=false` commits: React starts a view transition (the boundary's subtree changed),
   captures the popup's box with its content as `old`, unmounts the children, runs the apply
   effect's `hidePopover()` inside the update callback (`beforetoggle` sets `awaitingClose`;
   `focusWasInside` false, focus is on the Trigger), the `new` snapshot has no box → the exit
   animation plays in every engine. `toggle(closed)`: `intended()` is `false` → echo, no
   dispatch; `getAnimations()` ignored (no `held` with `transition`). `P=false`. Had the close
   come from a `Popover.Close` inside the popup activated with the keyboard, the unmount would
   have moved focus to `<body>` before the hide; `wrapContent`'s probe records that, and the
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
   rejection is surfaced by the shared hook (conventions 2.4). The Trigger shows `data-pending`
   from click 1 until action 2 settles.
8. **Dismissal during a pending part-initiated close.** As 3 with a slow action: `O=false`,
   `P=true`, `C=true`, popup still open. Escape → browser hides → `toggle(closed)`: `intended()`
   is `false` → no dispatch (the user's intent is already "close"; one `openChangeAction(false)`,
   not two); `held` may be set for the fade. Action resolves → `C=false` → apply effect: popup
   already hidden → nothing. Focus returned to the Trigger by the platform at the Escape.
9. **Pre-hydration click, then hydration.** Server HTML: Trigger with `toggle-popover` and
   `aria-expanded="false"`, empty `<dialog popover>`. Click → native open, anchored, focus on the
   popup element (nothing focusable inside), Chromium sets its implicit expanded state.
   Hydration → the Popup's mount effect finds `:popover-open` and `C=false` → dispatch `true`
   with `{ reason: "platform", event: undefined }` → `O=true` (Trigger `aria-expanded="true"`,
   `data-open`, `data-pending`) → action resolves → `C=true` → children mount into the open
   popup; the apply effect sees it open → nothing. Focus stays where the platform put it. If the
   parent refuses or the action rejects: after settle `C=false`, popup open → `hidePopover()`
   (echo), focus returns to the Trigger, no notification.
10. **Nested popover, Escape in the inner.** Outer `C=true`; inner Trigger (inside the outer
    Popup) clicked → inner dispatch → inner `showPopover({ source: innerTrigger })`: both open,
    inner anchored beside its Trigger, focus inside the inner. Escape → inner hides (the outer
    stays); platform restores nothing (second in stack) → inner `beforetoggle` recorded
    `focusWasInside=true` → inner `toggle(closed)`: `activeElement` is `<body>` → the library
    focuses the inner Trigger (connected, inside the still-open outer popup) → inner notification
    `"dismiss"`. A second Escape closes the outer; the platform returns focus to the outer Trigger.
11. **Nested popover, click outside.** Both close (`"dismiss"` to each Root). Inner
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

<Popover.Root open={open} openChangeAction={(next) => { setOpen(next); }}>
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

<Popover.Root open={open} openChangeAction={(next) => { setOpen(next); }}>
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

### 13.1 jsdom shim additions (`src/__tests__/popover-shim.ts`)

The shim from the Tooltip implementation covers `showPopover` / `hidePopover` / `togglePopover`,
a synchronous `beforetoggle`, a coalesced, task-queued `toggle`, and `:popover-open`. Popover
needs these additions, each mirroring the platform: `beforetoggle` for an **open** honours
`preventDefault()` (the popover stays hidden; a close's `beforetoggle` stays non-cancelable);
`showPopover({ source })` records the source so a test can assert it (no anchoring in jsdom);
a document-level `click` emulation for `button[commandfor]` with `show-popover`,
`hide-popover` and `toggle-popover` that dispatches a cancelable `command` event on the target
and runs the command unless prevented (shared with the dialog shim in `invoker-shim.ts`);
**the popover focusing steps** run by `showPopover()` once shown (a `<dialog>`: the `autofocus`
descendant, else the first sequentially focusable descendant, else the dialog itself, which jsdom
focuses only with a borrowed `tabindex="-1"` for the call; any other popover: itself with
`autofocus`, else an `autofocus` descendant), so the jsdom focus rows assert what the browsers
do without a library fallback (6.1); and **every shown popover made `display: block`**
(`data-popover-shim-open` plus a `!important` rule), because jsdom's UA sheet hides
`[popover]:not(:popover-open)` and `dialog:not([open])`, its `:popover-open` never matches, and
jsdom refuses to focus anything under `display: none`. Escape and light dismiss are not simulable (no close watcher): the
dismiss path is driven by calling `popup.hidePopover()` and asserting the `"dismiss"`
notification. `getAnimations` is absent; the shim returns `[]`, so the deferred-unmount path is a
browser-mode test. The `<dialog>` popup needs nothing from the dialog shim (`showModal` is never
called).

### 13.2 Coverage against conventions 10.1 (jsdom)

"both" = `describe.each` over uncontrolled and controlled wrappers (controlled follows
update-on-success). Library mode unless stated.

| Row | Popover tests |
| --- | --- |
| Roles and ARIA | Default elements `button[type=button][commandfor][command=toggle-popover][aria-expanded=false]`, `dialog[id][popover=auto][role=dialog][aria-modal=false][aria-labelledby][aria-describedby][data-side=bottom][data-align=center]`, `h2[id]`, `p[id]`, `button[command=hide-popover]`; ids resolve; consumer `aria-describedby="x"` becomes `"x <id>"`; consumer `role="region"` wins; `aria-haspopup` passes through; `open` is never rendered; `render={<div />}` keeps `role`, `aria-modal`, `popover`, ids. |
| Keyboard | Enter / Space on the Trigger (user-event clicks) dispatch; Escape is not simulable (13.1). |
| Sync action (both) | Trigger click → `openChangeAction(true, details)`: `details.event` is the native `MouseEvent`, `reason: "activate"`, `defaultPrevented` true (the command was cancelled); click while optimistically open → `openChangeAction(false)` with `"activate"`; disabled Trigger never dispatches; a `beforetoggle` for an open dispatched on the popup by a test (foreign open) is cancelled and dispatches `true` with that event; a `command` event with `hide-popover` records an `"activate"` intent that the following `hidePopover()` + `toggle` consumes. |
| Async action (both) | `deferred()` open: `aria-expanded="true"`, `data-open`, `data-pending` on the Trigger, `showPopover` spy not called, children not rendered; resolve: `showPopover` called once with `{ source: trigger }`, children rendered, attributes settled. Part-initiated close with a `deferred()`: popup still open and `:popover-open` while pending, `data-pending` on the Trigger, no `data-open`; resolve: `hidePopover` called once. Dismissal: `hidePopover()` then flush `toggle` → `openChangeAction(false, { reason: "dismiss" })` with the `toggle` event; Trigger pending meanwhile. |
| Rejection (both) | Open rejects: `ErrorCatcher` receives it, `showPopover` never called, no `data-open`. Part-initiated close rejects: catcher above Root receives it, `hidePopover` never called by the library. Dismissal notification rejects: catcher receives it (component replaced). Controlled refusal of a dismissal → `showPopover` called again once settled; controlled refusal of a part-initiated close → `hidePopover` never called, `data-open` back. Caught-inside variants commit. |
| Overlap | Walkthrough 11.7 with two `deferred()`s resolved out of order: `openChangeAction` called twice, `showPopover` never called, final `aria-expanded="false"`. And 11.8: a `hidePopover()` + `toggle` during a pending part-initiated close dispatches nothing more. |
| Superseded rejection (both) | Older dispatch rejects after and while the newer is pending; the catcher gets it; the newer outcome unaffected. |
| Suspending content (both) | Children mount `<Suspender>` on open: `showPopover` not called, Trigger pending, no fallback from the boundary above; resolve: `showPopover` called, content present. `keepMounted`: Suspender mounts hidden inside `<Activity>` at page render. |
| Function props | `className` / `style` / `children` / `render` on every part receive the documented state; JS-free mode passes `open: false`, `pending: false`. |
| `render` element | `render={<div className="x" />}` on Popup keeps the library attributes and listeners; `render={<a href />}` on Trigger in library mode dispatches through the click handler and gets no `type`; a non-button Trigger in JS-free mode warns. |
| Post-await rule | Controlled parent updating after `await` inside `startTransition`, end to end, for an open and for a part-initiated close. |
| Directive | Every file under `src/popover/` except `index.ts` begins with `"use client"`. |
| Platform path | Mount with the popup already `:popover-open` (shim state set before `hydrateRoot`): one dispatch with `reason: "platform"`, `event: undefined`, StrictMode still one; parent accepts → children mount and `showPopover` not called again; parent refuses → `hidePopover` called and no notification. Controlled `open` flipping programmatically calls `showPopover` / `hidePopover` and the resulting `toggle` does not dispatch (echo). JS-free mode: a native-style open (shim `showPopover` + `toggle`) writes `aria-expanded="true"` on the Trigger element, a close writes `"false"`, and no React state changes (render count). |
| Close part | Without `action` in JS-free mode: `command="hide-popover"`, no handler. In library mode: click default-prevented and `openChangeAction(false, "activate")` dispatched; with `action`: `data-pending` on the Close while the deferred action runs, dispatch after resolve, nothing on reject (error in the catcher inside the popup). JS-free mode with `action`: `hidePopover` called directly after resolve. Dismissed and re-opened while the action runs: the stale close is dropped (3.4; the re-open click is entangled with the Close's pending async transition in jsdom and commits with it). |
| Focus | `initialFocus` ref / selector: the element has `autofocus=""` when `showPopover` is called (spy inspects the DOM) and not afterwards; missing target warns. Shim focusing steps: after a library open focus is on the `initialFocus` target, else the first focusable, else the popup. Nested focus return: with focus inside the popup, `hidePopover()` (shim: focus untouched) + `toggle` → the Trigger is focused; with focus on an outside button before the hide → focus untouched; with the Trigger unmounted → `blur()`. Unmounted content (6.2, H1): a Close / Trigger-inside / controlled close activated with focus inside and `transition` set returns focus to the Trigger (jsdom moves focus to `<body>` on removal, as browsers do); with `keepMounted` likewise. |
| Positioning | `side` / `align` matrix produces the `position-area` values and the fallbacks string (shared helper tests; the six-row matrix of conventions 13.1 since wave 11); `side={null}` emits neither style nor `data-side`; consumer `style.positionArea` wins. |
| Resolved placement (wave 11) | As Tooltip 13: requested values in jsdom; with `getComputedStyle` stubbed to a flipped `position-area` and the shim's `toggle(open)`, `data-side` / `data-align` and the function-prop state are the resolved pair (library mode and JS-free mode alike); `toggle(closed)` restores the requested ones; no extra render when the stub returns the requested keywords; `side="inline-end"` renders `self-x-end` inline and `data-side="inline-end"` while closed. |
| Mode guard | Changing Root from JS-free to library mode after mount warns; `transition` / `keepMounted={false}` in JS-free mode warn. |
| `transition` smoke | Popup renders with and without `transition`; with `transition` absent a part-initiated close keeps the children through the close commit (`held`) and unmounts after `toggle` (fake timers); with `transition` set the children are gone in the close commit. |

### 13.3 Browser mode (`popover.browser.test.tsx`, Chromium, Firefox, WebKit)

Only what jsdom cannot observe, branching on `src/__tests__/engine.ts` where engines differ and
asserting the documented degraded behaviour rather than skipping:

| Row | Assertion | Engine branches |
| --- | --- | --- |
| JS-free command path | A real `toggle-popover` click opens and closes the popup; `aria-expanded` on the Trigger follows; `hide-popover` on Close closes. | none |
| Library interception | The Trigger's click goes through the library (`details.event` is a `MouseEvent`); a foreign `<button commandfor command="show-popover">` is cancelled at `beforetoggle` and dispatches with a `ToggleEvent` whose `source` is that button; the popup is anchored below the Trigger (`getBoundingClientRect`: top edge equals the Trigger's bottom edge). | none |
| Escape and light dismiss | Escape closes and `openChangeAction(false, { reason: "dismiss" })` fires; a `user.click` on an outside element closes and focus is on that element; a click on the Trigger while open closes through the library (`"activate"`) and does not reopen. | none |
| Initial focus and return | A raw platform probe (no library) asserts that `showPopover()` on a `<dialog>` moves focus inside, in every engine. With the `<dialog>` default, focus is inside the popup after a library open (`initialFocus` target, else first focusable, else the popup); Escape returns focus to the Trigger. With `render={<div />}`, focus stays on the Trigger and Tab enters the popup. A `Popover.Close` activated from the keyboard with `transition="pop"` (content unmounted in the close commit) returns focus to the Trigger (6.2, H1). | None for focus: WebKit verified (CI run 39006036945). Tab-into-popup is asserted only with a DOM-adjacent Popup (Safari WPT gap). |
| Nested popovers | Opening the inner keeps the outer open; Escape closes the inner only and **the library** focuses the inner Trigger (every engine: the platform restores nothing for a nested popover); an outside click closes both and leaves focus alone; a second Escape closes the outer and the platform focuses the outer Trigger. | None for placement since 6e48fe6 (issue #56): the inner Popup uses an inline `side` with its `flip-inline` fallback on all three engines and the fallback-flip assertion (inner popup near the viewport edge flips to the other side) runs on WebKit too. WebKit 302008 (`position-try-fallbacks` on a nested popover hangs / spins) did not bite on CI; the Menu suite keeps the named WebKit guard row for it, and a hang here fails the row under the test timeout. |
| Exit animation and deferred unmount | With the 10.1 CSS and no `transition`: after a part-initiated close the children stay mounted until `getAnimations()` settle, and after a dismissal likewise; `held` clears. | Firefox has no CSS exit: branch on `popup.getAnimations({ subtree: true }).length === 0` right after the hide and assert the children unmount with the close commit. |
| ViewTransition | With `transition="pop"`: a library open calls `document.startViewTransition` once and the popup is `:popover-open` when the update callback has run; a part-initiated close calls it once and the old snapshot exists (`document.getAnimations()` includes a `::view-transition-old(…)` pseudo during the transition); a dismissal calls it only for the notification commit with the popup already hidden; **`transition="pop"` plus the 10.1 CSS exit: a dismissal calls it once, not twice** (the `held` release is a normal update; fails without the M1 fix in Chromium, Firefox animates no exit). Without `transition`: zero calls for an open and a close. A `Popover.Root` inserted by a transition with `transition="none"` calls it once (conventions 10.1 mount row); a plain open with `"none"` calls it zero times. **`transition="pop"` plus the 10.1 CSS exit, a part-initiated close** (`it.each` over the recipe): with `html:active-view-transition .fade { transition: none }` the popup is `display: none` at `ready` and only the old image of its group exists; the characterisation variant without the recipe has a live new image of the fading popup in Chromium (pseudo-element names read from `document.getAnimations()` at `ready`, reported in the failure message). | None for the mechanism: the old-snapshot row passes on all three engines (WebKit on CI). The recipe rows branch per engine: the live new image exists in Chromium only (Firefox animates no exit; WebKit has the box `display: none` by `ready`, and its pseudo-element names are unreliable, so it asserts `display` only, as Dialog 13.3). |
| Stack interactions | A Tooltip (`manual`, and `hint` where `supportsPopoverHint`) opened inside the popup does not close it; a modal Dialog opened from inside keeps it open and Escape closes the Dialog first; opening an unrelated `auto` popover closes it with `"dismiss"`. | `supportsPopoverHint` for the hint variant (Safari 27.0 maps it to `manual`; same assertion). |
| Accessibility | `aria-modal="false"` and `role="dialog"` present on the `<dialog>` (attribute assertions; no AX tree access in vitest browser mode, Chromium's `modal=true` exposure without the attribute is #44). | none |
| Resolved side (wave 11) | A Trigger at the bottom of the viewport with the default `side="bottom"`: once shown, `data-side="top"` and the section 10 gap sits between the popup's bottom edge and the Trigger (`getBoundingClientRect`); a Trigger in the middle: `data-side="bottom"`. Inside a scrollable container, scrolling the Trigger to the container's bottom edge and waiting two frames: `data-side` equals the side the popup box is on (the geometry invariant of conventions 13.2; this row accepts either side and is **not** pinned on the `topLayerAnchorReChoosesOnScroll` probe: Chromium re-chooses in every run of this row, locally and on CI, although the probe says it keeps the option, for a reason not yet found (noted in #92; the row pre-scrolls the container, opens through the library, 160 × 120 popup, bottom overflow); Tooltip's scroll row is the pinned one); Escape then re-open in the middle: `bottom`. JS-free mode (a `commandfor` click) reports the resolved side the same way. | none (WebKit's computed-style behaviour is from source; this row is one of its first real checks) |
| Direction (wave 11) | `align="start"` under `document.documentElement.dir = "rtl"`: the popup's right edge meets the Trigger's right edge, `data-align="start"`; `side="inline-end"`: the popup sits left of the Trigger with `data-side="left"`. The same inside a `dir="rtl"` wrapper in an LTR document. | Container case: `anchorPositionHonoursParentDirection` true: mirrored; false (Firefox, Mozilla 2019601): the inline edges meet neither Trigger edge, asserted with the bug named. Page case: none. |

---

## 14. Implementation notes

```
packages/ui/src/popover/
  index.ts                 # no directive: namespace + type re-exports; imports platform-attributes for side effects
  popover-context.ts       # "use client": PopoverContext
  popover-root.tsx         # "use client": usePopoverRoot + context
  popover-trigger.tsx      # "use client"
  popover-popup.tsx        # "use client": <dialog popover>, usePopoverPopup
  popover-close.tsx        # "use client"
  popover-title.tsx        # "use client"
  popover-description.tsx  # "use client"
  popover.test.tsx
  popover.browser.test.tsx
packages/ui/src/internal/
  anchor-position.ts       # positionArea(side, align), POSITION_TRY_FALLBACKS (from tooltip-popup.tsx)
  use-popover-root.ts      # "use client": section 14.1; shared with Menu
  use-popover-popup.ts     # "use client": section 14.2; shared with Menu
  use-popover-trigger.ts   # "use client": section 14.3; shared with Menu
  use-exit-animation.ts    # "use client": the `held` logic of 4.4 (Dialog's `exiting` may move here)
packages/ui/src/__tests__/popover-shim.ts   # additions, 13.1
```

- **Every part file is `"use client"`** (context for ids, mode and dispatch), as Dialog and
  Tooltip. `index.ts` is directive-free. Add `src/popover/index.ts` to the tsdown `entry` list.
- **Context** (`PopoverContextValue` = `PopoverRootValue`): `{ mode, ids: { popup, title,
  description }, committed, optimistic, pending, intended(), openGeneration(),
  nextOpenGeneration(), requestOpen(event, reason), requestClose(event, reason),
  notifyClosed(event, reason), latestInFlight, triggerRef, popupRef, recordCloseIntent,
  takeCloseIntent }`. Root recomputes the object every render (Dialog does the same). The
  Popup's state (`{ open: committed, side, align }`) is **not** on the Root context: the Popup
  publishes it through a second context (`PopoverPopupContext`) that Title and Description read;
  outside a Popup (which `aria-labelledby` allows) they fall back to `{ open: committed, side:
  "bottom", align: "center" }`. Better than Root carrying `side` / `align` it does not own
  (review, deviation 2).

### 14.1 `usePopoverRoot(options)` (shared)

The Root's logic without the public props: mode detection once (`useState` initialiser; warn on
change), `useControllableAction<boolean, Details>` with `transitionTypes(component, next ?
"open" : "close")` where `component` is `"popover"` or `"menu"`, `useId`, `triggerRef`,
`popupRef`, the close-intent ref with `clearLater`, and:

- `intended()` = `latestInFlight()?.next ?? committedOptimistic` (a boolean, so `??` is safe
  here), where `committedOptimistic` is a ref of the optimistic value of the **last commit**,
  not the render closure: a Close action's continuation runs after an `await` with the closure
  of the click's render and could otherwise dispatch a second `false` after a dismissal had
  settled. The ref is written in **`useInsertionEffect`** (mutation phase), so it is current for
  every layout effect of the same commit, a child's included (review L2; a Root layout effect
  would run after the children's). Valid from handlers and effects, not during render.
- `openGeneration()` / `nextOpenGeneration()`: a counter bumped by every `send(true)` and by the
  Popup's `beforetoggle(open)` (foreign and pre-hydration opens included). A part whose close
  runs after an `await` records it first and drops the close when it changed (3.4).
- `requestOpen(event, reason)`: library mode and `!intended()` → `dispatch(true, details)`.
- `requestClose(event, reason)`: library mode and `intended()` → `dispatch(false, details)`.
  This is the library-driven close Menu's item activation calls after the item's action.
- `notifyClosed(event, reason)`: library mode and `intended()` → `dispatch(false, details)`
  (same guard as `requestClose`; separate name because callers mean different things and Menu
  may add bookkeeping to one of them).
- `details` are built with `createActionDetails(event, { reason })`; a component with more
  fields (Menu) passes a `details` factory, which must itself call `createActionDetails` (its
  Proxy keeps `event` non-enumerable so the details survive a Server Function boundary; a plain
  object literal breaks that).
- Menu's extension points (menu.md 14, landed with #40): `mode: "library"` forces library mode
  whatever the props, and `onDispatch(next, details)` runs synchronously before every dispatch
  (open-cause record, hover-timer cancellation).

### 14.2 `usePopoverPopup(ctx, options)` (shared)

Everything in the Popup except rendering. `options`: `{ part, initialFocus, resolveInitialFocus?,
keepMounted, transition, onBeforeToggle?, onToggle? }` (the optional hooks are for Menu:
`resolveInitialFocus(popup)` replaces `initialFocus` with a function called right before each
library open, no `cause` argument since the open cause is Menu's own ref; it returns an element,
`null`, or a `QuietFocusTarget` `{ element, focusVisible: false }` that is focused with
`focus({ focusVisible: false })` after `showPopover()` where the option is implemented (6.1);
`onToggle` closes the stack on Tab-out). Returns `{ setElement (callback ref), visible, wrapContent }`; nothing with a
ref inside the returned object (React Compiler's ref inference would flag every member once one
is passed as `ref`; consumers destructure). Effects and listeners:

1. **Mount reconciliation** (layout effect, once): `:popover-open` and library mode →
   `requestOpen(undefined, "platform")`. JS-free mode: write `aria-expanded` on the Trigger from
   `:popover-open`.
2. **Apply effect** (layout effect, every commit; section 2.5), with `opening` and
   `awaitingClose` refs; `showPopover({ source })` wrapped in the `autofocus` write / removal;
   the focus return right after `hidePopover()` when `focusWasInside` (6.2); the `held` release
   rule (4.4); `contentHadFocus` cleared when the popup is committed open and shown.
3. **Native listeners**, attached in the callback ref (`setElement`; the cleanup removes them),
   so they exist from the commit that mounts the element: no passive-effect window in which a
   close's `beforetoggle` could be missed, and no extra render through element state (review
   L5). The listeners call the latest render's handlers through a `handlers` ref published in a
   `useInsertionEffect` (calling `useEffectEvent` functions from a ref callback is a
   rules-of-hooks error). Each filtered on `event.target === popup` because React 19.3.1 emulates
   `toggle` bubbling:
   - `beforetoggle`: `newState === "open"` in library mode and not `opening` →
     `preventDefault()` + `requestOpen(event, "activate")`; otherwise (the library's own open,
     or any open in JS-free mode) → `nextOpenGeneration()`. Either way `contentHadFocus` is
     cleared. `newState === "closed"` → `awaitingClose = true`, `focusWasInside =
     popup.contains(activeElement) || contentHadFocus`, then `contentHadFocus = false`.
   - `toggle`: `awaitingClose = false`; JS-free: write `aria-expanded` on the Trigger from
     `:popover-open`; closed → focus fallback (6.2), then library mode → the `getAnimations`
     read of 4.4 (sets `held` for a dismissal's CSS exit; for a library-driven close `held` is
     already set by the render, and this read decides when to clear it), then
     `notifyClosed(intent?.event ?? event, intent?.reason ?? "dismiss")`.
   - `command`: `hide-popover`, or `toggle-popover` while open → `recordCloseIntent({ reason:
     "activate", event })`; `show-popover` / `toggle-popover` while closed need nothing (the
     open is caught at `beforetoggle`).
4. **`held`** (4.4, `use-exit-animation.ts`: `{ held, holdUntil, release, holdDuringRender,
   waiting }`): the previous-committed derivation during render when `transition === undefined`;
   the `getAnimations` read in `toggle(closed)`; `allSettled(...).then(() => setHeld(false))` as
   a normal update with a generation counter; `release()` from `toggle(closed)` with no
   animations and from the apply effect's release rule.
5. **`wrapContent(children)`** (6.2, H1): wraps the children in `ContentFocusProbe`, a component
   whose layout-effect cleanup sets `contentHadFocus` when `popup.contains(activeElement)`.
6. **JS-free `initialFocus`**: the callback ref writes `autofocus` on the resolved target and
   keeps it while mounted (the browser runs the command; there is no "right before
   `showPopover()`"), as Dialog. The Trigger's callback ref also syncs `aria-expanded` for a
   Trigger that mounts after the Popup.
7. **Dev warnings** (section 9).

### 14.3 `usePopoverTrigger(ctx, { disabled, render })` (shared)

Returns `{ state, libraryProps, ref }`: `type` via `rendersButton`, `commandfor`, `command:
"toggle-popover"`, `disabled` (owned), `aria-expanded` (library: `optimistic`; JS-free:
`false`), `onClick` only in library mode (`preventDefault()`; `disabled` → return;
`dispatch(!intended())` through `requestOpen` / `requestClose`), `data-open`, `data-pending`,
`data-disabled`; the callback ref writes `triggerRef` and warns for a non-button in JS-free mode.
Menu adds `aria-haspopup="menu"` and its own `onKeyDown` (ArrowDown / ArrowUp open with the
first / last item focused) on top.

### 14.4 Rendering (Popup)

```tsx
const element = useRender<ComponentPropsWithRef<"dialog">, PopoverPopupState>({
  defaultElement: "dialog",
  render, state, className,
  style: side === null ? style : (s) => ({ positionArea: positionArea(side, align), positionTryFallbacks: POSITION_TRY_FALLBACKS, ...resolveStateValue(style, s) }),
  children: content,                       // wrapped in <PopoverPopupContext value={state}>; static → children; keepMounted → <Activity mode={visible ? "visible" : "hidden"}>{wrapContent(children)}</Activity>; default → visible ? wrapContent(children) : null
  props: { role: "dialog", ...rest },      // `role` is a default the consumer's `rest` overrides
  libraryProps: { id, popover: "auto", open: undefined, "aria-modal": "false", "aria-labelledby": ids.title, "aria-describedby": ids.description, ...(side !== null && { "data-side": side, "data-align": align }) },
  ref: setElement,
});
return useTransitionBoundary("Popover.Popup", isLibrary ? transition : undefined, element);
```

`popover="auto"` is typed in `@types/react`; `command="hide-popover"` / `"toggle-popover"` are in
`platform-attributes.ts` already. `aria-modal` on a `<dialog>` is typed. No new augmentation.

### 14.5 Implementation checks (example app, three engines)

Done on the first WebKit CI run (39006036945): `<dialog popover>` initial focus in WebKit (6.1,
verified, contingency closed) and the view-transition capture of a library-driven close in WebKit
(10.2, the old-snapshot row passes). Still open: that `showPopover({ source })` with a `<div>` or
`<a>` source anchors and nests in every engine; that `aria-modal="false"` makes Chromium expose
the popup as non-modal (CDP, manual); screen-reader pass (NVDA, JAWS, VoiceOver) for the
`<dialog>` popup and the `<div>` variant.

---

## 15. What Menu (#39) reuses, and what is Menu's own

Reused as is, through the internal hooks of section 14:

- The two modes and the Root state (`usePopoverRoot` with `component: "menu"`), including
  `intended()`, `requestOpen` / `requestClose` / `notifyClosed`, close intents, and the
  `"activate"` / `"dismiss"` / `"platform"` reasons.
- The Popup machinery (`usePopoverPopup`): apply effect with `showPopover({ source })` and the
  `autofocus` write, or the quiet `focus({ focusVisible: false })` for a `QuietFocusTarget`
  (Menu passes `resolveInitialFocus(popup)`, returning its first or last item from the open
  cause in its own ref, quiet for a pointer open), `beforetoggle` open interception, `toggle` notification,
  `awaitingClose`, the `held` deferred unmount, the JS-free `aria-expanded` sync, the
  **nested focus-return rule** (6.2), which is exactly "focus the parent item when a submenu
  closes", and `wrapContent`, which Menu.Popup must render its items through so that an item
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

## Conventions feedback

All applied to `design/conventions.md` (items 1 and 2 with the proposal, items 3 to 8 at
acceptance). Kept for the record:

1. **3.5 / 5.1: the boundary wraps the top-layer element itself.** A library-driven open or close
   of a top-layer element (`showPopover()` / `hidePopover()` in a layout effect of a transition
   commit) is animatable by `<ViewTransition>` when the boundary wraps the element, in every
   engine; browser-initiated opens and closes still are not.
2. **8: `focusGroup` detection** (issue #43), with the developer's `useSyncExternalStore` form
   and the Tabs native-path markup.

3. **4.1 `open` row.** Add Popover: Trigger emits optimistic `data-open` and `aria-expanded` in
   library mode, `aria-expanded` DOM-synced in JS-free mode; the Popup emits none
   (`:popover-open`).
4. **5.3 types.** `Popover`: `fsui-popover`, `fsui-popover-open`, `fsui-popover-close`.
5. **3.5 ownership table.** A third shape next to Dialog's "library-owned open, browser-owned
   close": Popover's "library-owned for parts, browser-owned for dismissals". Suggested sentence
   under the table: "Where the platform's close is cancelable without an anti-abuse rule
   (popovers), a component may own the closes its parts initiate and leave dismissals to the
   browser; the component doc lists which is which."
6. **2.2 `"dismiss"` row.** Add "script `hidePopover()` or another top-layer element hiding the
   popover" to the examples; the `toggle` event is the platform event there.
7. **1.5 / 3.2.** `aria-expanded` is the first ARIA state attribute the library keeps current
   through a DOM write outside React (JS-free Popover). If accepted (question 3), 7.4's table
   gets a row: "ARIA state the platform changes for browser-owned state and AT needs explicitly:
   write it on the DOM from the platform event through the ref; never React state."
8. **1.1 part vocabulary.** `Popup`'s default element reads `div[popover]`; Popover's is
   `dialog[popover]`. Suggest "`div[popover]` or `dialog[popover]`".

---

## Follow-ups (not part of this design)

- **Dialog: view transition on the library-driven close.** `Dialog.Close action` calls
  `dialog.close()` from the action's continuation, outside any commit, so `transition` never
  animates it, and Dialog 10.3 says "never the close". With the amended convention, Dialog could
  route the post-action close through the Root (`dispatch(false)`, then `close()` in the apply
  effect) and get a view-transition exit in every engine. It changes `openChangeAction(false)`
  from a notification to an awaited call for that one path. Filed as issue #46; not changed
  here.
- `internal/anchor-position.ts` shared by Tooltip, Popover and Menu; Tooltip's design names the
  helper locally.
- `Popover.Form`, an `anchor` prop, hover-to-open ("hover to preview, click to pin" with
  `interestfor`), a `manual` pinned variant, and a `returnFocus` prop: each when a consumer case
  appears. Context menus: #45.
- Human upstream reports collected in #44: Chromium `<dialog popover>` exposed as modal; WebKit
  302008 / 317926.

---

## Review corrections (2026-10-17)

From `memo/reviewer/popover.md` (review of the implementation, #40) and the developer's fix
notes in `memo/developer/popover.md`; code in commit 35e57e1, docs in a55c86c and 2225079. Each
item is folded into the section named; this list is the audit trail.

| Item | Correction | Section |
| --- | --- | --- |
| H1 | Focus-return rule 1 also counts focus that was inside the content when the close commit unmounted it, recorded by `wrapContent`'s layout-cleanup probe; the apply effect returns focus right after `hidePopover()`. Required for every library-driven close with `transition` and the default mounting, Menu's item activation included. | 6.2, 2.5, 11.3, 14.2, 14.4, 15 |
| M1 | `held` → `false` is a normal update, never a transition: one document view transition per dismissal with `transition` plus a CSS exit. | 4.4, 10.2, 11.2, 11.4, 14.2 |
| L1 | WebKit runs the dialog focusing steps for `<dialog popover>`; the 6.1 contingency is closed and the up-front fallback removed. The jsdom shim emulates the focusing steps and shows every open popover. | 6.1, 13.1, 13.3, 14.5, decision 1 |
| L2 | `intended()` reads the last commit's optimistic value from a ref written in `useInsertionEffect`, current for every layout effect of the commit. | 14.1 |
| L3 | A `Popover.Close` action's close is dropped when the popover was dismissed and re-opened meanwhile (open-generation guard; product-owner decision). `openGeneration` / `nextOpenGeneration` on the Root value. | 3.4, 11.5, 13.2, 14.1, 14.2 |
| L4 | The Popup hook returns no ref-bearing member (`focusWasInside` dropped); consumers destructure. | 14.2 |
| L5 | Native listeners attach in the callback ref through a handlers ref published in an insertion effect; no element state, no passive-effect window. | 14.2 |
| L6 | `defaultOpen` renders the content and the Trigger's `aria-expanded="true"` / `data-open` into the server HTML; only the showing waits for hydration. | 2.4, 2.5, 3.1 |
| L7 | `initialFocus` recommended over `autoFocus` in JS-free mode: React writes `autofocus` into server-rendered HTML only. | 2.1, 6.1, 12.1 |
| Deviation 2 | Title / Description state comes from a Popup context, not from `side` / `align` on the Root context. | 14 |
| Deviation 4 | The apply-effect release rule for `held`. | 4.4, 2.5 |
| Deviation 7 | The no-name warning checks `dialog`, `alertdialog` and `menu` roles only. | 9 |
| Deviation 8 | `resolveInitialFocus(popup)` takes no `cause`; Menu's `details` factory uses `createActionDetails`. | 14.1, 14.2, 15, menu.md 14 |
| M2 | `Popover.Close` dropped a superseded rejection (`useTransition` keeps the newest thenable). Closed by the shared `useActionTrigger` (ac7064e, #41; conventions 3.4), which also carries the open-generation guard; one jsdom row fails without it. | 3.4 (closed 2026-10-17) |

From the Dialog #46 review (`memo/reviewer/dialog-46.md` M2, 2026-10-18; code, docs and the
browser row in 5dcce5f, the WebKit correction in bcdb7e1):

| Item | Correction | Section |
| --- | --- | --- |
| Dialog #46 M2 | With `transition` plus the 10.1 CSS exit, Chromium captures a library-closed popup, still rendered through its fade, as a live `::view-transition-new` next to the `old` image (a double image; probed with the docs recipe). The recipe keeps the CSS exit and adds `html:active-view-transition .popover { transition: none; }` (untyped: a controlled close carries no types; cost: an unrelated page view transition also cuts a fade). Replaces "at most a CSS exit for dismissals"; the dismissal row's "nothing visible to animate" was wrong for a CSS exit. Chromium only: Firefox has no CSS exit, WebKit has the box `display: none` by `ready`. Docs `popover.css` / PopoverPage and the playground carry the rule. | 10.2, 13.3 |

---

## Decisions recorded (product owner, 2026-10-17)

All eight accepted as recommended:

1. **`<dialog popover>` as the default element, focus moving in** (decision 4, section 6.1),
   with `render={<div />}` as the disclosure-style variant that keeps focus on the trigger.
   Alternative: `<div popover role="dialog">` everywhere with a JS "first focusable" choice,
   which avoids the Chromium AX bug and the WebKit unknown at the cost of the research verdict
   and a small focus algorithm in JS. Decision: `<dialog>`, with the WebKit contingency as an
   implementation check (closed at review: WebKit runs the focusing steps; no fallback, 6.1).
2. **Part-initiated closes are library-owned** (decision 3): Trigger toggle and Close await
   `openChangeAction(false)` and hide in the commit, so `<ViewTransition>` can animate the exit
   and a controlled parent can veto them; dismissals stay browser-owned notifications. This
   differs from Dialog's "close is always browser-owned" and is what Menu builds on. Decision:
   accepted; the Dialog follow-up is issue #46.
3. **JS-free mode keeps `aria-expanded` current with a DOM write** from the popup's `toggle`
   listener (section 9), the first owned attribute the library writes outside React.
   Alternative: a React state write per toggle in Root (one render per open and close), which
   Tooltip rejected for hover but is cheap for a click-driven popover; or no `aria-expanded` in
   JS-free mode (Chromium's implicit mapping only). Decision: the DOM write (conventions 7.4).
4. **No `Popover.Form` and no `lightDismiss` in v0** (section 1). Decision: accepted; the
   controlled "submit, then close" shape is documented (12.4).
5. **`role` is an overridable default, not an owned key** (3.3), so a `<div>` popup can be a
   `region` or `group`. Decision: accepted.
6. **Nested focus-return rule** (6.2): the library focuses the Trigger only when focus was inside
   the popup at the hide and the platform left it on `<body>` or inside. Decision: accepted;
   Menu's submenus depend on it.
7. **Default placement `bottom` / `center`** (section 8) versus Tooltip's `top`. Decision:
   accepted.
8. **Trigger-less controlled popovers have no anchor** (2.7; `anchor` prop deferred). Decision:
   accepted for v0.

---

## Amendment: resolved side and direction (wave 11, 2026-10-23, issues #20 and #53)

Status: **accepted** (product owner, 2026-10-23, with Tooltip's amendment: same name for the
resolved value, inline-relative `align` and the new sides, Firefox 2019601 unworked-around and
tracked as #89); the cross-component rules are conventions 13 and the reasoning is in
Tooltip's amendment (same mechanism, same hook). Edited in place: decision 10, 3.3, 4, 8, 10,
13.2, 13.3.

| | v0 (as accepted) | Wave 11 |
| --- | --- | --- |
| `data-side` / `data-align`, `state.side` / `state.align` | the requested props | the resolved placement while shown (both modes), the requested props otherwise |
| Section 10 gap after a flip | on the wrong side | on the side facing the Trigger |
| `side` values | four physical | plus `inline-start` / `inline-end` |
| `align` `start` / `end` on `top` / `bottom` | physical | inline-relative (identical in LTR, mirrored in RTL); container `dir="rtl"` followed in Chromium and WebKit, Firefox misplaced (Mozilla 2019601, asserted) |
| Files | | `usePopoverPopup` is unchanged; `Popover.Popup` merges `useResolvedPlacement`'s `ref` with `setElement` |

Migration: as conventions 13.5. `PopoverSide` widens by two members; a stylesheet that keyed
the gap on `data-side` now follows flips. The Popover docs page's props and data-attribute
tables and `popover.css` ("the gap on the requested side") change wording.

Questions for the product owner: Tooltip's amendment questions 3 to 5 cover Popover (same name
for the resolved value; inline-relative `align` and the two new `side` values; Firefox
unworked-around). Nothing Popover-specific.

Implementation deviations of Part A (d3d0359) folded on 2026-10-23: the section 10 gap recipe
is symmetric (`margin-block` / `margin-inline`: a flip swaps the popup's own margins) and the
scroll row asserts the geometry invariant rather than a flip; the list is in Tooltip's
amendment ("Implementation deviations folded") and conventions 13.2.
