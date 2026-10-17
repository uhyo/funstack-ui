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

## Review fold, 2026-10-17

Folded the implementation-review fixes (commits 0ce1e8f, 0a563af, ad2853f, 63d35f1;
`memo/developer/dialog.md` "Review fixes") into `design/components/dialog.md`, checking each
claim against `packages/ui/src/dialog/*.tsx` and the tests:

- 4.2: `trigger.pending = root.pending` (the old `&& optimistic !== committed` hid the re-open
  window, where both are `true`). Kept the old rule as history in the section.
- 3.5 / 8.1 / 14: `closeOnSettle` (default `true`; with `false` the Form records no intent at
  all, it returns before `recordCloseIntent`) and the `closedSinceSubmit` flag: a dialog `close`
  after the last `submit` blocks the settle close, also after a re-open. `method` is a declared
  prop (base omitted, re-declared) applied only with a string `action`.
- 7 / 9 / 2.6 / 14: press-and-click light dismiss (keyboard-synthesised clicks never dismiss;
  `::backdrop` is unreachable by keyboard anyway). Non-modal Escape is left alone while an inner
  layer owns it: target inside an open nested dialog or open auto/hint popover, **or any** open
  auto/hint popover inside the dialog; `manual` (and `hint` mapped to manual, read through the
  `popover` IDL) does not take Escape. Note: this only concerns the non-modal JS listener; for
  modal dialogs the platform's close-watcher stack already does it.
- 11.10 / 12.5: the nested confirm is a JS-free inner Root whose Trigger is "Discard…"; the
  "Discard" Close action awaits the discard then `startTransition(() => setOpen(false))`; the
  outer close is the parent's controlled close, so the outer `openChangeAction(false)` is not
  called and `returnValue` is `""`. Outer parts must sit outside the inner Root (nearest-context
  binding). The `setTimeout` alternative from the review is recorded as rejected.
- Close props `Omit` now includes `value` (re-declared), matching the code.

Not changed, worth knowing: the Popup's `transition` prop is typed `ViewTransitionClass` in the
code (the design's prose says `TransitionProp`); same shape in practice. Issue #35 (a mounting
`<ViewTransition>` starts a document view transition even with `"none"`) is referenced from the
code's JSDoc, not from this design.

Follow-up the same day: `transition` is typed `ViewTransitionClass` (the design had invented a
`TransitionProp` alias that types.ts never had); the #35 mount cost is now in the 3.3 doc comment,
in 2.6 (nested dialogs) and in 12.5 (the JS-free inner Root pays nothing), on top of 10.3.

## Amendment for #46: library-owned part-initiated closes, 2026-10-17

Written against the code as of 842af81 (`packages/ui/src/dialog/*`, `src/internal/use-popover-*.ts`,
`use-exit-animation.ts`, `use-action-trigger.ts`) and `popover.md` 2.3 / 4.4 / 10.2 / 14.

What I checked in the code before deciding:

- `DialogRoot.intended()` reads the render closure's `optimistic`, not a ref: a Close action's
  continuation (after an `await`) would see its click's value. Popover fixed this with
  `committedOptimistic` in `useInsertionEffect` (review L2); the amendment requires the same.
- The apply effect's close branch calls `element.close()` with no value; a library-owned close
  needs the part's `value` there, hence the Root's pending-return-value ref, cleared whenever
  optimistic is `true` again (veto, re-open) so it cannot go stale.
- `exiting` is set only in the `close` listener and released with `startTransition`: a
  controlled close without `transition` unmounts the content in the commit, shows an empty CSS
  fade, and then `exiting=true` re-mounts it (fresh state) into the fading box; with
  `transition` set the release starts a second, invisible view transition (Popover review M1).
  Both go away by adopting `useExitAnimation` (`held`) and the Popover 4.4 shape.
- The `command` listener already intercepts a foreign `show-modal`; intercepting
  `request-close` / `close` is the same branch, and `Dialog.Close` renders that markup.
- The `submit` listener sits on the dialog, which runs *before* React's root `onSubmit`. To keep
  a consumer's `preventDefault()` working (it blocks the native close today), the interception
  must observe `defaultPrevented` after React ran: a document-level bubble listener.
- Generation counting: `requestOpen` and the Popup's `beforetoggle(open)` both bump, so a
  library open counts twice. Harmless (equality only). Kept at `beforetoggle` per 03ab818; the
  design now explains why the guard matters in library mode too (the re-open is the latest
  intent when the continuation runs, so `requestClose` would dispatch against it).
- Modal `close()` restores focus unconditionally (HTML "close the dialog", `wasModal`); non-modal
  only when focus is inside. So the Popover content probe matters for non-modal dialogs with
  `transition` and the default mounting; for modal ones it is a no-op.

Decisions I went back and forth on:

- **`method="dialog"` interception.** Leaving it browser-owned was simpler and closer to "the
  platform's form idiom", but an OK submit button and a Dialog.Close in the same form would then
  differ in animation and vetoability. Chose to intercept, opt-out by `stopPropagation()` in
  `onSubmit` (then native close + `"dismiss"`). Escalated as question 1.
- **Foreign close invokers.** Popover leaves foreign `hide-popover` browser-owned; Dialog
  intercepts because it already intercepts foreign `show-modal`. Escalated as question 2.
- **Trigger as a toggle for non-modal dialogs.** Tempting for parity with Popover, but there is no
  `toggle` command for dialogs and the modal Trigger is inert while open. Left open-only.
- **`requestClose()` vs `close()` in the apply effect.** `requestClose()` would let a consumer's
  `onCancel` veto, but the anti-abuse rule makes that veto hold once and the effect would re-run
  it; the veto point is `openChangeAction` now. `close()`.
- **Form: open-generation guard vs `closedSinceSubmit`.** Kept `closedSinceSubmit`; it already
  reads the `close` event the Form listens to and covers the re-open.

Not touched: the docs site and the example app (the running code is what they show); listed
for the developer in the amendment section.
