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

## Review fold-in (2026-10-18)

Sources: `memo/reviewer/toast.md` (2805959), fixes eeacdbf + docs 906702d, the developer's
"Review fixes" section. Folded into `design/components/toast.md`: status header, decisions 3 /
7 / 10 / 12 / 13, anatomy, 3.1, 3.4, 3.5, 4.3, 5, 6, 7, 8, 9.1, 10.2, 11, 12, 13, 14 (items 10,
11, 14-17), 16.1, 16.2, 17, new section 20 (audit table) and 21 (`fallback` proposal).

### Verdict on the developer's six choices: all agreed, none corrected

- **Batch order.** The only reading of "order is preserved" that is honest; the alternative
  (dismissals last) silently kills the Gmail-undo toast. The replaced-id pair (`dismiss(id);
  toast({ id })`) reusing the keyed Root while still running the old `closeAction` is the right
  split: the consumer's bookkeeping sees a close, the DOM sees no flash.
- **Exit baseline by identity.** Checked the developer's `startTime` argument: a paused
  animation (`animation-play-state: paused` from the start, or paused before its first frame)
  has `startTime === null` and `pending` can be false in both cases, so there is no timeline
  predicate that separates "paused progress bar" from "transition the ending style just
  started". Identity is the only reliable one. The retargeted-transition point (new
  `CSSTransition` object) means the baseline cannot swallow a real exit. Cost (a style flush in
  the closing handler) is one `getAnimations()` per close, fine.
- **Host `div` moved by the library.** The right fix: React has no way to re-parent a portal
  without remounting (`updatePortal` compares `containerInfo`). Keeping action-pending in the
  Viewport instead would have patched one symptom and left `useActionTrigger`'s in-flight state
  behind. `display: contents` on a role-less `div` has no a11y cost (the `display: contents`
  button/table bugs are about elements with roles). The hydration dance (inline hydration render,
  then portal) is the honest price of SSR without portals, and the empty-queue argument holds
  because the subscription is a passive effect.
- **Throwing `success` / `error` rejects.** Agreed: settling with `error` would say "archive
  failed" for an archive that succeeded. The thrown value, not the original reason, is what the
  promise rejects with: it is the consumer's bug and should read as one.
- **Title / Description report commit.** Agreed; the microtask coalescing keeps "one text per
  reveal". The `announcedOnce` gate makes the first commit the Root's own effect's business, so
  no double announcement at mount.
- **Hotkey rejects unlisted modifiers.** Agreed; stricter than Radix, and the right call for a
  key that doubles as a browser/OS chord with modifiers.

### The `fallback` proposal (section 21)

Wrote it as the developer suggested: `fallback?: ReactNode` on `Toast.Root`, rendered by the
library's own guard. Key points I settled while writing: `ReactNode` not `StateValue` (parity
with React's `Suspense`, nothing in the state changes during the fallback); parts inside the
fallback allowed but gate nothing; an urgent `update` that suspends re-shows the fallback (React's
rule for non-transition updates of a mounted boundary), which is already the invisible guard's
behaviour. Alternative (b), gating the timer on `contentCommitted`, fails for a toast with no
Title/Description: same wall as the render-phase flag. Marked proposed; needs the PO, and it is a
conventions 6 change ("no `fallback` props in v0").

### Suggested convention changes (not applied; for the PO)

1. Conventions 4.1, `ending` row: says "until its exit animations finish (`useExitAnimation`)".
   Toast uses `exitAnimations` + a baseline in a plain layout effect, and the rule is now "the
   animations the ending state started". Wording fix only.
2. Question, not Toast's: `useExitAnimation` (Popover, Dialog) waits for every finite animation
   in the subtree, so a finite animation that was already running inside a popup (a progress bar,
   a one-shot highlight) would hold that exit too. The baseline trick is general; worth deciding
   whether the shared hook takes it, in its own issue.
3. Conventions 3.5: "a library-owned `display: contents` host moved by DOM `append`" is a
   reusable shape for relocating a portal without a remount. One sentence, if a second component
   ever needs it; not needed now.
4. Conventions 6: only if section 21 is accepted ("`fallback` exists only where the library
   owns the boundary, which is Toast alone").

## 21.3 wording fix (2026-10-18)

The developer's `fallback` implementation (memo/developer/toast.md, end) found that a Title
inside the fallback names the toast only on mount: on an update that re-suspends, React hides
the committed content with `display: none` but keeps it in the DOM, so the hidden previous Title
keeps `ids.title` and comes first; the toast keeps its old name until the reveal. 21.3 now says
so (issue #63). Not worth a code change: renaming to "Loading…" mid-update would be the odd
behaviour, and the old name is still true of the toast.
