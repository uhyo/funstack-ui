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
