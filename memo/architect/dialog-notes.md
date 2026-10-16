# Architect notes: Dialog (#26), 2026-10-16

Working notes behind `design/components/dialog.md`. Not a spec; the design doc is.

## Facts checked while writing

1. **jsdom 30.1.3 `<dialog>`** (probed in `packages/ui`): `HTMLDialogElement` exists, `open`
   reflects the attribute, `:open` matches it, `:modal` parses but never matches. **Missing:**
   `show`, `showModal`, `close`, `requestClose`, `returnValue`, `closedBy`, `CommandEvent`,
   `commandForElement`, `ToggleEvent`; no `toggle` / `close` / `cancel` events for dialogs.
   `form.method` reflects `"dialog"`; `submitter.formMethod` undefined. Hence the dialog shim in
   the test plan and "drive commands by dispatching `command` events, Escape by `requestClose()`".
2. **TypeScript 7.0.2 `lib.dom.d.ts`** (pnpm store, `@typescript/typescript-linux-x64`) types
   `CommandEvent` (`command`, `source`), `HTMLButtonElement.commandForElement`,
   `HTMLDialogElement.closedBy` and `requestClose(returnValue?)`. No local typing needed.
   `@types/react` 19.3.0 types `closedby`, `onCancel`, `onClose` on `DialogHTMLAttributes`.
   `command` / `commandfor` are already in `src/internal/platform-attributes.ts`.
3. **Research probes reused** (`memo/platform-researcher/probes/04-dialog/`): `command` event is
   cancelable with `source` = invoker; deferred `showModal()` still focuses inside and returns
   focus to the invoker on Escape; hydrated `<dialog>` fires `onCancel` / `onClose` but never
   `onToggle` / `onBeforeToggle`; a function form action leaves the dialog open; `autoFocus` is
   dropped on client render (focus lands on the first button) and kept on hydration;
   `closedby="none"` blocks Escape but not `requestClose()` / `request-close`.
4. **Invoker Commands have no `show` command** (only `show-modal`, `close`, `request-close` for
   dialogs). So a non-modal dialog always needs a click handler; "JS-free" is modal-only.
5. **Button activation**: the command invocation runs after `click` dispatch, only if the event
   was not cancelled, and only in the Button state (a `type="submit"` button with `command` does
   not invoke). So `click.preventDefault()` in the Trigger cancels the command, and a submit
   button cannot double as a Close invoker.
6. **Accessible name with a dangling `aria-labelledby`**: accname 2B needs "at least one valid
   IDREF" to use `aria-labelledby`; otherwise it falls through to `aria-label`. So always emitting
   the Title id is safe when the consumer names the dialog with `aria-label` instead.

## Decisions I went back and forth on

- **Where to intercept the open.** Dialog `command` listener only (one site, but no path for a
  non-button `render` and not drivable from a jsdom click) vs Trigger `click` (prop form, like
  Accordion; `details.event` is a `MouseEvent` as the conventions describe; testable in jsdom).
  Chose Trigger click as primary and the `command` listener as the catch-all for foreign
  invokers.
- **`commandfor` in library mode.** Kept, so the markup is identical in both modes and a
  pre-hydration click still opens the dialog (empty, filled on reconciliation). The "dead
  button until hydration" alternative is worse UX and the "always render content" alternative
  is JS-free mode.
- **Close ownership.** Fully library-owned close was rejected per the research: the anti-abuse
  rule makes any gate unreliable, and `close()` from a form is not cancelable at all.
- **Refused close.** Re-open (conventions re-apply rule, Accordion precedent) vs document as
  unsupported. Chose re-open and said loudly that it is not a veto; escalated.
- **Exit animation vs unmount.** Deferring the `false` dispatch until animations end would keep
  `data-open` on the Trigger during the fade and delay the consumer's state; keeping children
  mounted via a local `exiting` flag is contained in the Popup. The `setExiting(true)` write is
  urgent (sync lane) by necessity: it must land before the notification's commit.
- **`Dialog.Form` wrapping the action.** Wrapping a Server Function in a client closure loses
  React's progressive enhancement (the server HTML would get the throwing `javascript:` action).
  A `useFormStatus` watcher child keeps the action unwrapped and observes completion, at the cost
  of being effect-driven (true → false edge).
- **`Dialog.Close action` in addition to `Dialog.Form`.** Kept both; escalated as question 6.
- **`keepMounted` with `<Activity>` vs plain mounting.** Plain mounting would put the content in
  the server HTML (nice for pre-hydration opens) but deviates from conventions 3.7 and runs
  effects in a closed dialog. Followed 3.7; JS-free mode is the "content in HTML" answer.
- **`lightDismiss` default.** `false`, against Radix/Base UI, because of forms and because the
  JS-free mode cannot do it without a handler.
- **`initialFocus` type.** Ref or selector string; the string form exists so a Server Component
  can use it. Considered a marker part (`<Dialog.InitialFocus>`): one more part for one
  attribute, rejected.
- **`data-pending` without a Root element.** Trigger only, plus `state.pending` on Root.
  Considered making Root render a `div` (rejected: trigger layout) and putting `data-pending` on
  the dialog (rejected: content region, and it is hidden during the only pending open).

## Things to raise later

- `closedby="none"` as an experimental value once the "disable Escape" demand is real.
- Rendering `open` for the non-modal initial render (question 3).
- `returnFocus` / `finalFocus` prop if consumers ask; today the platform's restore plus the
  Trigger fallback.
- A `Popover` component will reuse: the `command` listener pattern, `"dismiss"`, the
  no-portal rule, and the Tooltip-style browser-owned open with notification.
- Known gap: overlapping `Dialog.Close action` clicks do not surface a superseded rejection
  (no shared hook there). Fix if a case appears.
