# Architect notes: AlertDialog (#167), 2026-11-26

Working notes behind `design/components/alert-dialog.md`. Not a spec.

## What I read

- #167, #162 (wave 24), vision, conventions (2.1, 2.4, 2.5.1, 3.9 in overlay-open-state.md,
  5.3, 9), dialog.md whole, `docs/research/dialog.md` (close requests, `closedby`, anti-abuse,
  accessibility), `packages/ui/src/dialog/*`, `internal/overlay/use-overlay-close.ts`,
  `useInitialFocusTarget` in `internal/overlay/overlay-popup.tsx`.
- APG "Alert and Message Dialogs" (fetched 2026-11-26): keyboard section is one line, "see the
  modal dialog pattern". Roles: `alertdialog`, `aria-modal`, label, **`aria-describedby` to the
  alert message**. Nothing on Escape or focus of its own.
- Radix AlertDialog docs: Root, Trigger, Portal, Overlay, Content, Title, Description, Cancel,
  Action; Esc closes and returns focus to the Trigger; `onEscapeKeyDown` on Content.
- Base UI AlertDialog docs: Root, Trigger, Portal, Backdrop, Viewport, Popup, Title,
  Description, Close (no Cancel / Action); default `initialFocus` is the first tabbable. The
  page does not state the Escape / outside-press defaults, so Base UI is left out of the
  design's Escape table. Radix not closing on an outside click is from memory of its source.
- No new probes.

## Findings in the code

- `DialogClose` is a 30-line caller of `useOverlayClose`; Cancel and Action are the same call.
- `useOverlayClose` renders `commandfor` / `command` whether or not `action` is set. So a
  JS-free `Dialog.Close action={…}` clicked before hydration closes natively and skips the
  action. Tolerable for a Close, wrong for a confirm. One new option on the hook.
- In library mode the Popup's children are not in the server HTML, so the pre-hydration
  question exists in JS-free mode only.
- The non-modal branches of the Popup and of `dialog-dismiss.ts` are dead for an alert dialog;
  `lightDismiss: false` + `modal: true` already attaches no dismiss listener at all.
- A modal dialog without `closedby` is `closerequest` everywhere: "no light dismiss" is free.
- `useInitialFocusTarget` warns when the target resolves to nothing. The Cancel default needs a
  silent variant (a one-button message dialog is legitimate).
- The parts read only `DialogContext`, so AlertDialog parts and Dialog parts interoperate
  inside either Root for free. Kept as a stated fact, not advertised.

## Decisions I went back and forth on

1. **Namespace vs preset.** A `variant="alert"` on `Dialog.Root` is less surface but the Root
   would have to tell the Popup (role, dismissal) and one Close (focus), and the invalid
   combinations stay typed. Namespace wins; cost is thin files.
2. **Escape.** Looked for a reason to block it (Radix lets `onEscapeKeyDown` prevent). APG
   keeps it, and the platform cannot hold it in Safari. `closedby="none"` as the default would
   be a two-engine behaviour and against dialog.md decision 8. Escape = Cancel through the
   fact channel.
3. **How the Popup finds the Cancel.** Options: a marker attribute + selector, a ref registry
   in a context, or `autoFocus` on the Cancel. Ended with: registry (or selector, the
   developer's choice) for library mode and for the post-hydration write, plus rendered
   `autoFocus` in JS-free mode so the server HTML is right. The Popup tells Cancels through
   context whether `initialFocus` was given, so there are never two candidates.
4. **Should Action require `action`?** No: without it the part is a Close with a `value`, and
   the `returnValue` flow of dialog.md 8.2 keeps working. But the doc says to prefer `action`.
5. **Cancel during a pending Action.** A library rule (ignore + `aria-disabled`) is tempting,
   since "Cancel" reads as "abort". But Escape cannot be held, so the dialog can leave anyway;
   a rule for one of two paths is half a promise. Left to the consumer (`useOptimistic`
   example). Listed for the user.
6. **Inline error after a failed confirm.** A caught error resolves, a resolved action closes.
   My first example threw a dummy error after setting state, which still goes to the boundary:
   removed. The honest answers are a boundary inside the Popup or the Form + `Form.Root` shape.
   Recorded as a gap in the changelog entry.
7. **Transition types.** `fsui-alert-dialog*` would need a `component` option through
   `useOverlayRoot`; cheap, but then one stylesheet no longer covers both. Kept Dialog's.
8. **State types.** Aliases of Dialog's, `modal: true` kept, so render functions are shared.

## Not verified (said so in the changelog entry)

- React `autoFocus` on a Cancel mounting into an already open JS-free dialog.
- A disabled `autofocus` button being skipped by the dialog focusing steps in all engines.
- Screen-reader announcement of the description.

## For the developer

- Extract part bodies from the Dialog files with a `part` name; keep public Dialog components
  as callers. `scripts/check-design-refs.mjs` will want real file names once they exist: the
  design names only the folder until then.
- Add the `alert-dialog` entry to the tsdown entry list and the root `index.ts`.
- Tests worth writing first: focus on Cancel (library mode, JS-free after hydration, server
  HTML has `autofocus`), no close on backdrop click (browser test, three engines), Escape is a
  fact, Action pending / reject / resolve, Action with `action` has no `command` attribute,
  `role` cannot be overridden, the Description warning.
