# #167 AlertDialog (developer notes)

Branch `feat/167-alert-dialog`, from `design/167-alert-dialog` (2f9ec4a0) + master.

## Shape of the code

- Dialog part files export body hooks (`useDialogRoot`, `useDialogTrigger`, `useDialogPopup`,
  `useDialogTitle`, `useDialogDescription`, `useDialogClose`, `useDialogForm`) taking the
  namespace / part name; `Dialog.*` call them with "Dialog". Messages use the namespace.
- `useDialogPopup` options: `role` (owned), `defaultInitialFocus` (used only without
  `initialFocus`, no warning), `wrapChildren` (the Cancel context provider).
- `useOverlayClose` gained `nativeCommand` (default true). Action passes
  `action === undefined`.
- `alert-dialog-context.ts`: `AlertDialogCancelContext` { defaultFocus, register } provided by
  the Popup (not the Root as the design said: initialFocus is the Popup's). `firstEnabledCancel`
  sorts by DOM order, skips `:disabled` / `aria-disabled="true"` and Cancels of a nested dialog.
- Cancel in JS-free mode: owned `autoFocus` (only when enabled + default target) for the server
  HTML, and its ref writes / removes the attribute on the client.

## Findings

- Cancel during a pending Action in library mode does NOT close at once: the Root's close
  transition is entangled with the Action's async action (conventions 2.3 item 5). Closes when
  the action settles. Design walkthrough 4 amended. JS-free Cancel (native command) and Escape
  close at once.
- React hydration with `autoFocus` inside a closed dialog: no focus moved, no hydration warning.
- oxlint `react(refs)` flags any access to a destructured/`props.ref` passed to a hook in the
  same component, and then flags other `props.x` reads too. Destructure `{ disabled, ref, ...rest }`
  and use `useMergedRefs`.
- The jsdom dialog shim's focusing steps take the first `[autofocus]` even inside a closed nested
  dialog: nested-confirm focus rows belong in the browser file.
- Shared overlay suites hard-code `"x"` as the part value: the harness Action uses value "x".

## Verification (browser)

- Local: Chromium + Firefox pass (`FUNSTACK_BROWSERS=chromium,firefox`); WebKit lacks host libs
  locally, run through branch CI (`gh workflow run ci.yml --ref feat/167-alert-dialog`):
  run 45770030438 green on all jobs (ci, chromium, firefox, webkit).
- Disabled `autofocus` skipped -> next `autofocus`, else first focusable.
- React `autoFocus` on a Cancel mounting into an open JS-free dialog takes focus.

## Docs

- `/components/alert-dialog` page, examples `AlertDialogDeleteProject.tsx` (client, can fail)
  and `AlertDialogServerConfirm.tsx` (Server Component; the static site has no Server Functions,
  so the live form is `method="dialog"` and the Server Function shape is a code block).
