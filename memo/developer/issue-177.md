# #177: non-modal Dialog Escape vs inner manual popovers

- Cause: `listenDialogDismiss` listened on the `<dialog>` (bubble), so it ran before the
  document Escape listeners of HoverCard and Tooltip; `manual` popovers were skipped by the
  inner-layer check, so the dialog closed first (and HoverCard then stood down because the event
  was prevented).
- Fix: the non-modal Escape listener is on `doc.defaultView` (window, bubble), after every
  element and document listener; it ignores a prevented keydown (same as the platform close
  watcher of a modal dialog). Inner-layer check moved from `target.closest()` to
  `composedPath()` (at window, target is retargeted out of shadow roots).
- Rejected: "any open popover inside counts" (HoverCard's own rule). A consumer manual popover
  without an Escape handler would make Escape dead; the existing jsdom "toast" row pins that
  such a popover leaves Escape to the dialog.
- Side effect: React `onKeyDown` preventing Escape inside the dialog now keeps a non-modal
  dialog open (React's root listener runs before window). Also `stopPropagation()` on Escape
  inside the dialog now blocks it (did not before).
- Modal Dialog / AlertDialog / modal Drawer: platform close watcher, already respects the
  prevented keydown; covered by the new browser rows (modal x manual/hint).
- WebKit is not runnable locally (missing host libs); relied on CI for it.
