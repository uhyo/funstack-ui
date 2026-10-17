# Popover / Menu probes (2026-10-17, issue #37)

Run from this directory with `node <probe>.mjs`. Chromium 156.0.8078.4 and Firefox 157.0 (Playwright
1.64.1); WebKit still cannot launch locally. Each `*.output.txt` is the recorded output.

- `platform.mjs` - features, auto-popover nesting (DOM child vs invoker-nested vs script with/without
  `source`), focus (Tab order, Escape/hidePopover focus return, light dismiss, autofocus),
  `ToggleEvent.source` / cancelable `command`, implicit-anchor positions, `startViewTransition`
  around `showPopover`/`hidePopover`.
- `ax-and-interest.mjs` - Chromium AX tree for `popovertarget`/`commandfor` invokers, a first
  (state-carrying, superseded) interestfor run, `focusgroup="menu"` behaviour and AX.
- `interest-clean.mjs` - interestfor as a hover-submenu trigger, one fresh page per case.
- `dialog-popover.mjs` - `<dialog popover>` vs `<div popover role=dialog>`: initial focus, Escape,
  focus return; Chromium AX `modal` exposure (appended runs isolate the aria-modal bug).
- `submenu-focus.mjs` - Escape in a submenu: focus is NOT returned (spec: only the first popover in
  a stack restores focus).
- `vt-popover.browser.test.tsx` - React 19.3.1 `<ViewTransition>` with library-driven
  `showPopover`/`hidePopover` in a layout effect (vitest browser mode; copy into
  `packages/ui/src/__tests__/` to run, delete afterwards).
