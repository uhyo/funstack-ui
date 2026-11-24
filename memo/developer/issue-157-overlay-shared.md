# #157 phase 2: overlay safe steps

Branch `refactor/157-overlay-shared` (not merged), from master 7ec703e. Internal only; no test
was weakened or removed. Source: memo/architect/refactor-audit.md candidates rank 1 and rank 9,
rule map rows 7, 8, 9, 11, 29.

## What changed

1. `internal/overlay-show.ts` (new, directive-free):
   - `createPopupFlags()`: `awaitingClose()` / `beginClose()` / `endClose()`,
     `markLibraryClose()` / `takeLibraryClose()` (the echo: `libraryHide` in the popover hook,
     `libraryClose` in Dialog), `markFact()` / `factAdopted()` / `takeRefused()`
     (`refusedFact`). A Popup keeps one with `useState(createPopupFlags)` (stable object, plain
     closure variables; same lifetime as the three `useRef`s it replaces).
   - `showWithFocus(element, { refused, autofocus, show })`: `inert` while `refused` (unless
     the consumer set it), `autofocus` on the target (unless already there), `show()`, both
     undone in `finally`.
   - Callers keep what differs: Dialog's `takeRefused() && !modal` (modal re-open is a normal
     open), the popover hook's `opening` flag, `source`, the quiet focus after the show.
   - Every operation is called at exactly the place the old ref write/read was, in the same
     order (I kept fine-grained operations instead of a combined "close event arrived" call
     because Dialog's `close` handler focuses the Trigger between clearing `awaitingClose` and
     consuming the echo, and a focus handler can flush a sync React commit there).
2. `dialog/dialog-dismiss.ts` (new, directive-free): `listenDialogDismiss(dialog, { modal,
   lightDismiss })` returning a cleanup, with `closestDialog`, `isOpenLightPopover`,
   `escapeBelongsToInnerLayer`, `onBackdrop` moved verbatim. Dialog.Popup's listener effect
   calls it unless native `closedby` is in use. Listener order on the dialog is unchanged
   (command, submit on the root node, close, beforetoggle, then keydown / pointerdown / click /
   toggle); the document capture listeners attach a few statements later than before (other
   target, no ordering consequence).
3. Docs: conventions 9.1 lists `overlay-show.ts`; design/CHANGELOG.md entry; the header of
   `overlay-popup.tsx` now says what is still written twice. `directives.test.ts` lists both new
   files as directive-free.

## Line counts

| File | Before | After cb1c823 | After 42faa07 |
| --- | --- | --- | --- |
| internal/use-popover-popup.ts | 482 | 465 | 465 |
| dialog/dialog-popup.tsx | 625 | 611 | 473 |
| internal/overlay-popup.tsx | 175 | 178 | 178 |
| internal/overlay-show.ts | - | 112 | 112 |
| dialog/dialog-dismiss.ts | - | - | 166 |
| internal/overlay-show.test.ts | - | 120 | 120 |
| dialog/dialog-dismiss.test.ts | - | - | 64 |

Source lines in the two Popups: 1107 -> 938. The new modules are mostly doc comments; the code
itself is about 40 lines (flags + wrapper) and 120 (dismiss, moved verbatim).

## Commits

- cb1c823 `refactor(ui): share the popup flags and the show wrapper of the two Popups (#157)`
  (with conventions 9.1 + design/CHANGELOG.md entry, directives.test.ts entry)
- 42faa07 `refactor(ui): split Dialog's JS Escape and light-dismiss baseline into dialog-dismiss.ts (#157)`

## Test runs (each commit)

At both cb1c823 and 42faa07: `pnpm typecheck`, `pnpm lint` (two pre-existing warnings in
menu-submenu-trigger.tsx and toast.test.tsx, no errors; design refs resolve), `pnpm format:check`,
`pnpm build`, `pnpm test:jsdom` (cb1c823: 73 files; 42faa07: 74 files, 3790 tests) and
`FUNSTACK_BROWSERS=chromium,firefox pnpm test:browser` (54 files, 1049 passed, 39 skipped) all
green. WebKit not run locally.

## Mutation check (the safety net catches reverts)

Run with the jsdom projects, each reverted afterwards (script in the session scratchpad):

| Mutation | Killed by existing rows |
| --- | --- |
| `showWithFocus` never sets `inert` | 4 (Dialog #156 x2, Popover #156 x2) |
| `showWithFocus` never writes `autofocus` | 33 (Dialog, Menu, ContextTrigger, hooks) |
| `takeRefused` does not clear | none; only the new unit row. Near-equivalent: every later show is preceded by a fact (sets it again) or a committed `false` (clears it) |
| `factAdopted` no-op | 3 (Menu hover intent, Popover interestfor x2) |
| echo never marked | 35 |
| `endClose` no-op | 171 |
| `beginClose` no-op | 13 |
| dismiss: no Escape listener | 4 |
| dismiss: inner-layer check removed | 2 |
| dismiss: press not required | 2 |
| dismiss: cleanup keeps the document listeners | none before; the new `dialog-dismiss.test.ts` row kills it |

## Assessment of candidate #6 (one popup core with a platform driver)

What is still duplicated after these steps, and how it differs:

- **Apply effect** (about 25 lines each). Identical skeleton: `factAdopted` on committed
  `false`; nothing in flight; committed && !shown && !awaitingClose -> show; !committed && shown
  -> `recordCloseIntent(undefined)`, `markLibraryClose()`, cut + hide, focus fallback; forget
  the probe while shown; `releaseIfIdle`. Differences: `isShown` (`isPopoverOpen` vs
  `el.open`), the show (popover: focus resolution with quiet target, `source`, `opening`;
  Dialog: modal vs non-modal, the modal exception to the refused rule), the hide
  (`hidePopover()` vs `close(takeCloseReturnValue())`), and the focus fallback after the hide
  (popover: `focusWasInside` recorded at `beforetoggle`; Dialog: `contentProbe.hadFocus()` and
  `forget()`).
- **Close event** (`toggle` vs `close`). Same bookkeeping steps, but in a different order and
  with more differences than shared lines: the popover reads lost interest, mirrors `shown`
  (or syncs `data-open` in JS-free mode), consumes the echo before the focus return and runs
  `whileShown`; Dialog returns focus when focus is still inside, consumes the echo after
  `takeCloseIntent`, returns early in JS-free mode, drops a pending `returnValue` and reports
  `returnValue` with the fact.
- **`beforetoggle`**. Popover routes foreign opens through the Root here (`preventDefault` +
  `requestOpen`) and records the `popovertarget` close intent; Dialog routes foreign opens at
  `command`, and only counts the open generation here. Shared: `beginClose` +
  `recordBaseline` on a close, `nextOpenGeneration` + `forget` on an open.
- **Mount reconciliation**: popover also syncs `data-open` in JS-free mode; Dialog only
  requests the open.
- **Listener attachment** (row 29): callback ref + `useLatest` vs `useState` element +
  `useEffect` + `useEffectEvent`. Dialog needs the element in state anyway
  (`useModalRegistration`, `useShownNameWarning`) and attaches `submit` on the root node and
  the dismiss listeners keyed on `modal` / `lightDismiss` / `closedBy`.

A driver for the full merge (apply effect + the three event handlers + reconciliation) would
need about nine members:

```ts
interface PopupDriver {
  isShown(el): boolean;                          // isPopoverOpen / el.open
  show(el, refused: boolean): void;              // focus resolution, source/modal, opening flag
  refusedApplies: boolean;                       // Dialog: !modal (or fold into show)
  hide(el): void;                                // hidePopover / close(returnValue)
  focusAfterLibraryHide(el): void;               // focusWasInside vs contentProbe
  focusAfterClose(el, lostInterest): void;       // the close-event focus rule
  factDetails(): string | undefined;             // Dialog's returnValue (+ dropping a pending one)
  onCloseEvent?(el): void;                       // shown mirror / data-open / whileShown / interest
  onBeforeOpen?(event): boolean;                 // popover: route foreign opens; Dialog: none
}
```

That is above the audit's own stop line (about six), and several members are "the order of
steps in an event handler", which reads worse behind an interface than inline. My
recommendation:

- **Worth doing (S/M, low-medium risk):** share only the apply effect, as
  `useApplyOpenState(ctx, { flags, exit, probe, isShown, show, hide })` where `hide` includes
  the focus fallback: three driver members (`isShown`, `show`, `hide`). It is the most
  timing-sensitive part (#147, #148, #155, #156 all touched it) and the part that is truly the
  same algorithm. Mount reconciliation could ride along with one more member (`jsFreeSync`), or
  stay.
- **Not worth it:** merging the `toggle` / `close` and `beforetoggle` handlers. They share the
  flag calls (now one-liners through `PopupFlags`) and differ in order and content.
- **Separately (row 29):** moving Dialog's listeners to a callback ref is independent of #6. It
  removes one render per Dialog mount (profiler-observable) and closes the `beforetoggle` gap at
  `defaultOpen` mount; it should be its own step with the full browser suite.
