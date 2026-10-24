# Architect notes: Popover (#38), 2026-10-17

Working notes behind `design/components/popover.md`. Not a spec; the design doc is.

## Facts relied on (from the research and the code, not re-probed)

1. `docs/research/popover-menu.md` probes (Chromium 156, Firefox 157; WebKit not launched):
   `beforetoggle(open)` is cancelable, `beforetoggle(closed)` is not; `command` is cancelable and
   `preventDefault()` keeps the popover closed; `toggle` is a task later; `showPopover({ source })`
   nests and anchors like `commandfor`; a nested auto popover does not restore focus (spec:
   first popover in a stack only); light dismiss on empty space leaves focus where mousedown put
   it; an auto popover stays open when focus Tabs out; `<dialog popover>` runs the dialog focusing
   steps and Chromium exposes it `modal=true` without `aria-modal="false"`; wrapping the popover
   element itself in `<ViewTransition>` with `showPopover()` / `hidePopover()` in a layout effect
   animates enter and exit in both engines, content-only boundaries get no enter.
2. `vt-popover` probe detail worth remembering: the `vt-wraps-popover` variant had **static**
   content and React still started a view transition for the open and the close commits. So a
   commit with no host mutation inside the boundary still animates. I did not build the design on
   this (the default Popup mounts children on open anyway) but it matters for `keepMounted` with
   unchanged content.
3. `<dialog popover>`: `showPopover()` does **not** set the `open` attribute, so `dialog.open` is
   false while shown, `dialog.close()` is a no-op, `method="dialog"` forms do not close it, and no
   `cancel` / `close` events fire. Only `beforetoggle` / `toggle`. Hence no `Popover.Form` in v0
   and `command="hide-popover"` on Close.
4. jsdom shim (`popover-shim.ts`): `beforetoggle` is dispatched but `preventDefault()` on it is
   ignored today; no `command` emulation for popover commands; `showPopover` ignores `source`.
   The test plan lists the additions.
5. Chromium's light-dismiss skips the invoker (`"invokerToggle": "m -> (none)"`), and the
   invoker set by `showPopover({ source })` counts the same way per spec, so a Trigger click
   while open in library mode is a cancellable command, not a light dismiss.

## Decisions I went back and forth on

- **`<dialog popover>` vs `<div popover role="dialog">`.** The research verdict is Adopt for
  `<dialog popover aria-modal="false">`, and verdicts are binding. The `<div>` variant would have
  avoided the Chromium AX bug and the WebKit unknown but needs a JS "first focusable" choice.
  Kept `<dialog>`; `render={<div />}` is the documented way to keep focus on the trigger; WebKit
  contingency recorded as an implementation check, not designed in.
- **Which closes are library-owned.** Dialog drew the line "open vs close". Popover draws it
  "parts vs dismissals": Trigger toggle, Close and controlled `open={false}` go through the
  Root's transition and `hidePopover()` in the apply effect (so `<ViewTransition>` can animate the
  exit, Firefox included); Escape, light dismiss and foreign `hide-popover` invokers are the
  browser's and are notified. Reason: popover commands are freely cancelable (no anti-abuse
  rule, no non-cancelable `close()` from a form), and Menu needs "action, then close in the
  commit" anyway. Escalated as question 2.
- **Trigger click while optimistically open.** Dialog's Trigger is open-only (no-op while open).
  A popover trigger is a toggle (`toggle-popover`), so the click dispatches `!optimistic`. A
  second click during a pending open therefore cancels it (latest intent). Walkthrough 11.7.
- **`aria-expanded` in JS-free mode.** Tooltip refused `data-open` to avoid a React render per
  hover. Popover needs `aria-expanded` (APG) and JS-free mode has no React state: the Popup's
  `toggle` listener writes the attribute on the Trigger element through the ref. A DOM write
  outside React, confined to one owned attribute whose React value never changes in that mode.
  Escalated as question 3.
- **Deferred unmount for library-driven closes.** Dialog sets `exiting` from the `close` event
  before the notification commit, so the children survive it. A library-driven close commits
  first and hides in the layout effect, so the children would be gone before the CSS fade. The
  `held` flag set during render (prev-committed pattern) when `transition` is absent solves it;
  with `transition` set the unmount stays in the close commit so the view transition captures
  the content and no second (invisible, 250 ms) view transition runs for the unmount.
- **Focus-return fallback rule.** "focus was inside the popup at `beforetoggle(closed)` and is
  on `<body>` or inside the popup after the hide" rather than "is on body". The latter would
  steal focus after a light dismiss on empty space (platform leaves it on body) and, for an
  outside click that closes a stack, would focus a Trigger inside a now-hidden outer popup.
- **`lightDismiss` prop.** None. `auto` is the point of Popover; `manual` is a different
  component (pinned panel / toast). Dialog's `false` default came from forms; a popover with a
  form that must survive stray clicks is a Dialog.
- **`Popover.Form`.** Dropped for v0 (fact 3). `<form action>` inside the Popup plus controlled
  `open` or a `Popover.Close action` covers "submit, then close".
- **`anchor` prop for Trigger-less popovers.** Deferred; `showPopover()` without `source` has no
  anchor and the UA centres the popover. Context menus (#45) will need pointer anchoring.
- **`role` ownership.** Rendered as a default (`"dialog"`) that a consumer `role` overrides,
  as Dialog lets `alertdialog` through; needed explicitly because WebKit has no minimum role
  for `[popover]` and `render={<div />}` must keep it.

## Prior art borrowed / rejected

- Base UI Popover: `initialFocus` / `finalFocus` names (only `initialFocus` kept, shared with
  Dialog), `role="dialog"` on the popup, `Title` / `Description`. Rejected `Positioner`,
  `Portal`, `Backdrop`, `modal` prop.
- Radix Popover: `side` / `align` vocabulary (already in Tooltip); rejected `Portal`,
  `onOpenAutoFocus` / `onCloseAutoFocus` handlers (no handlers), `modal`.
- React Aria Popover: `isNonModal`, `shouldCloseOnInteractOutside`; rejected, the platform's
  `auto` semantics are the behaviour.
- Headless UI Popover: `Panel focus` prop (default false, focus stays on the button) is the
  disclosure reading; here it is `render={<div />}`.

## Things to raise later

- Dialog: route `Dialog.Close action` and the controlled close through the apply effect so the
  library-driven close gets a view transition (follow-up issue; conventions now permit it).
- Tooltip and Popover share `positionArea()`: move it to `internal/anchor-position.ts` when
  Popover is implemented; the Tooltip design still names it locally.
- `Popover.Form` once `<dialog popover>` + `method="dialog"` is specified, or as a plain
  "submit then `requestClose`" form if consumers ask.
- `anchor` (ref) and a pointer anchor for #45.
- Hover-to-open (`interestfor` + `commandfor` "hover to preview, click to pin"): #39 decides
  hover intent for submenus; Popover has no hover open in v0.

## Review corrections folded in (2026-10-17)

Source: `memo/reviewer/popover.md` ("Design-doc corrections"), `memo/developer/popover.md`
("Review fixes"), commits 35e57e1 / a55c86c / 2225079. Code read as ground truth:
`use-popover-root.ts`, `use-popover-popup.ts`, `use-exit-animation.ts`, `popover-close.tsx`,
`popover-popup.tsx`, `popover-context.ts`, `popover-shim.ts`.

What changed in the design and why I wrote it the way I did:

- **6.2 rule 1** now reads "focus inside at `beforetoggle(closed)` OR focus inside the content
  when the close commit unmounted it". The mechanism (`wrapContent` → `ContentFocusProbe`
  layout cleanup) is in 6.2 and 14.2; the call-site obligation ("render through `wrapContent`
  in both mounting shapes") is in 14.4 and in menu.md 14, because it is easy to forget and
  silently loses keyboard focus. The apply effect returning focus right after `hidePopover()`
  (not in `toggle`) is in the 2.5 snippet.
- **4.4**: the `held` release is a normal update. I kept the reason (only transition commits start
  document view transitions) next to the rule, and added the apply-effect release rule as a
  named paragraph, since it was decided in code (developer item 2) and the reviewer traced it.
- **6.1**: contingency closed; the removed fallback is described in one sentence so nobody
  re-adds it. The jsdom shim now does the focusing steps (13.1).
- **3.4 / 14.1**: the open generation. I wrote it as a Root concept (bumped by `send(true)` and
  the Popup's `beforetoggle(open)`), not a Close concept, because Menu's item activation needs
  it too. The 2.3 snippet in menu.md got the guard inline so the call site shows it.
- **2.5 / 3.1 `defaultOpen`**: "never in the server HTML" was wrong about content and
  `aria-expanded`; only the showing waits. Wrote a dedicated paragraph in 2.5.
- **L7**: dropped `autoFocus` from the 2.1 example (first focusable element does it) and moved
  12.1 to `initialFocus="[name=reason]"`. dialog.md 6.1 already recommended `initialFocus`;
  I only added the "server-rendered only" qualifier and fixed the 3.1 `defaultOpen` comment.
- **14 Context**: Popup context for Title/Description; Root value lists `openGeneration` /
  `nextOpenGeneration`; `committedOptimistic` in `useInsertionEffect`; listeners in the callback
  ref via a handlers ref.
- A "Review corrections" table at the end of popover.md maps every item to its sections.

Open (not design changes): M2 superseded rejection in `Popover.Close` until `useActionTrigger`
(#41); the still-open 14.5 checks (`source` on `<div>`/`<a>`, Chromium AX exposure, screen
readers).

## #127: lost interest never hides a library-mode Popover (2026-10-25)

Decision: supported; the library hides by proxy. Amendment at the end of popover.md.

- Cause read in Chromium source (`element.cc` `InterestGained` / `InterestLost`,
  `html_element.cc` `InvokePopover`, `ShowPopoverInternal`): lost interest hides only a popover
  whose `invokedVia == kInterest`, set after a successful interest show; our cancel-and-reshow
  leaves `kNone`. No script API can set `kInterest`, so handing the hide back to the platform is
  impossible; the alternative "pass the interest button as `source` on the re-show" would not
  help either (`invokedVia` stays `kNone`) and would change the anchor.
- Probes: `probes/127-interestfor/`. Surprises: (1) Chromium fires `loseinterest` from inside
  *every* hide of an interest-targeted popup (Escape, script), before the state flips, so a
  listener sees `:popover-open` true; (2) `hidePopover()` synchronously inside `loseinterest`
  loses the `toggle` event entirely (nested hide), so the hide must be deferred by a task, not a
  microtask (a microtask still runs inside the platform's `InterestLost`). `queueMicrotask`
  reshow right inside the cancelled `beforetoggle` also fails silently (not relevant to the
  library, which re-shows in a later commit).
- Rejected: hiding on any `loseinterest` regardless of how the popup opened. One ref
  (`interestOpen`) keeps the platform rule, with a stated staleness (Trigger click cancelling
  a pending interest open).
- Not done here: a hover-to-open prop (follow-ups), Firefox/WebKit (attribute inert), ARIA of the
  interest relationship (the platform's, as for Tooltip's native path).
