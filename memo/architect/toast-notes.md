# Architect notes: Toast (#54), 2026-10-17

Working notes behind `design/components/toast.md`. Not a spec; the design doc is.

## Facts checked while writing

1. **A Suspense reveal inside an urgently mounted toast commits while an unrelated async action
   is pending** (`probes/toast-suspense-reveal.mjs`, React 19.3.1, jsdom). The retry lane is not
   entangled with the action scope. What looked like a block at first was React's 300 ms
   fallback throttle (`FALLBACK_THROTTLE_MS`): the reveal landed ~300 ms after the fallback
   committed, with the action still pending. The "no action" control behaves the same. This is
   what makes the per-toast Suspense guard honest: a suspending toast fills in on its own.
2. **Researcher's probes reused** (`memo/platform-researcher/probes/12-toast/`): a `setState`
   from a microtask queued inside `startTransition` commits at once while an unrelated action is
   pending, a synchronous one is held (`toast-lanes`); `hidePopover(); showPopover()` on a
   manual region keeps focus and leaves an open auto menu open (`reshow-focus`, Chromium and
   Firefox).
3. **`useActionTrigger`** already has everything `Toast.Action` needs (pending, superseded
   rejection, `then` after resolve, unmounted path through `reportError`). `exitAnimations` /
   `useExitAnimation` cover the `data-ending` hold.

## Decisions I went back and forth on

- **Imperative vs declarative.** Radix's declarative `<Toast.Root open>` was the only shape
  that would have kept every input a prop. Rejected because the producer is an action body and
  the toast outlives it; the rendering half stays declarative. Wrote section 2 to make the
  argument against the vision explicit rather than assumed.
- **`toast.promise` return value.** Three options: the id (Sonner), a promise mirroring the
  input (always rejects on failure), or "mirrors, but resolves when `error` was given". Chose
  the third: it lets `action={() => toast.promise(...)}` feed the item's own pending state, and
  the swallow is only on request (an `error` renderer is a handler). Type `Promise<T | undefined>`
  is the honest price.
- **Suspense for the promise toast** (content `use()`s the promise, reveal on settle). Elegant
  and the retry lane would even allow a view transition, but a rejection needs an error
  boundary inside the toast, and the research's point about announcing on settle stands.
  `update` on settle is simpler; recorded the alternative in 10.3 so it is not re-derived.
- **Per-toast Suspense guard.** Conventions 6 says the library never wraps children in Suspense.
  Without a guard, one suspending toast blanks the Viewport's nearest boundary (often the app
  shell) because the mount is urgent. Kept the guard with an invisible fallback; flagged as the
  explicit exception.
- **`"timeout"` as a new `ChangeReason`** vs a Toast-local union vs folding into `"dismiss"`.
  Took the conventions change; the Undo-window pattern needs "acted on content" vs everything
  else, and analytics want timeout vs dismiss. Also made `Toast.Close` `"dismiss"` (not
  `"activate"` as Dialog.Close): flagged.
- **Default duration for action toasts.** Persistent (research, WCAG 2.2.1) vs timed. Went with
  persistent and flagged it as the most likely override.
- **Roles.** List items vs focusable `dialog` / `alertdialog`. Focusable dialogs because the
  hotkey and arrow keys need a focus target that reads the toast. Dropped the `<ol>` since
  `dialog` overrides `listitem` anyway.
- **Timers in the manager vs the Viewport.** Viewport: pause is a DOM fact of the region, and the
  manager must stay React- and DOM-free so `toast.ts` can be directive-free.
- **Portal into the modal dialog** vs accepting inertness. Portal, via a module-level registry
  Dialog writes to; foreign dialogs undetected in v1 (flagged).
- **Re-raise on every add** vs only when covered. Every add, with a browser row checking the
  enter animation does not replay; `elementFromPoint` fallback recorded.
- **No Provider.** With a module-level manager nothing needs context above the app; the
  Viewport owns the queue. `manager` prop for isolation.

## Open for the developer

- Whether `hidePopover(); showPopover()` with no style flush between replays `@starting-style`
  on existing toasts in WebKit; 4.2 names the fallback.
- jsdom shim for `showPopover` / `hidePopover` on the region: reuse the Popover tests' shim.
- `ariaNotify` is absent in jsdom: stub on `document`.
