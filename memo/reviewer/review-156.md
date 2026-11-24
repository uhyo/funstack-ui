# Review: #156 refused re-open shown `inert` (branch `fix/156-inert-reshow`, 130c09a + ee87a5c)

2026-11-24. Decision: option (d) of memo/architect/156-refused-reopen-focus.md (issue comment).

**Verdict: mergeable, with minor fixes (docs wording). No code change required.**

## Verified

- jsdom popover/menu/combobox: 5 files, 808 passed. Browser popover/menu/combobox on Chromium +
  Firefox: 448 passed, 16 skipped. Typecheck, lint (only existing warnings), format:check clean.
- Mutation `inerted = false`: the 2 jsdom rows (default `<dialog>`, `<div>` + consumer autofocus)
  and the 2 dialog browser rows (refused Escape, refused light dismiss) fail on Chromium and
  Firefox. Mutation "always write/remove inert" fails the consumer-`inert` row only. Mutation
  "never remove inert" fails the jsdom rows. The tests pin the fix.
- `use-popover-popup.ts` `showPopup`: `inert` is set before the `try`, but between that and the
  `try` only `resolveFocusTarget` (skipped when refused) and the `autofocus` write (null when
  refused) run, so nothing can throw there; `options.source()` and `showPopover()` are inside the
  `try`, and `finally` removes `inert`. A `beforetoggle` `preventDefault()` also leaves no `inert`.
- `refusedFact` is consumed before the write and cleared on every `committed` false commit, so a
  non-refused open (and the Menu "adopted Escape then keyboard open" row) still gets initial
  focus. `reshow()` (Menu's move) needs an open popup, so it never meets `refusedFact`.
- `toggle` is async, so `toggle` listeners and `whileShown` never see `inert`. Anchor positioning
  is unaffected (inert is not layout). No ViewTransition on this path (urgent commit). The CSS
  cut (#147) is independent of the `inert` write.
- Consumer `inert`: written only when absent, so a React `inert` prop is never touched and React
  stays in sync with the DOM (React diffs props, and the library's write is undone within the
  call). React cannot commit in the window.
- Focus return after a later adopted close: unchanged from before. The platform's previously
  focused element is the one focused at the re-show (the clicked field, or the Trigger after a
  refused Escape); `returnFocusToTrigger` only acts when focus is on `<body>` or inside, so after
  a Tab into the popup and an adopted Escape focus goes back to the clicked field (light dismiss
  case) or the Trigger (Escape case). That was already the `<div>` behaviour under #155.
- Spec: inert elements are not focusable areas; focusing steps return for an inert DOM anchor;
  the autofocus delegate and dialog focus delegate skip non-focusable areas, and the dialog
  itself as fallback is inert. So the platform focuses nothing, in every engine that follows the
  spec.

## Findings

### Low

1. Non-modal Dialog has the same #156 symptom and the docs give a reason that only fits the
   modal one. `dialog-popup.tsx:278-279` re-shows with `show()` for `modal={false}`, which runs
   the dialog focusing steps; a non-modal Dialog with `lightDismiss` refused by a controlled
   parent takes focus back from the clicked element. `design/components/overlay-open-change.md`
   2.4 says "Dialog is not covered: `showModal()` must hold focus, and outside content is inert
   there anyway", and `BrowserOwnedStatePage.tsx` says "A modal Dialog still gets the browser's
   dialog focusing steps" (implying a non-modal one does not). Out of the decision's scope, but
   the text should say "Dialog (modal or not) is not covered" and the non-modal case is worth a
   follow-up issue in this repo (the same `inert` write would apply to `show()`).
2. `overlay-open-change.md` 2.4: "With a CSS exit in flight the browser reverses it." now follows
   the Dialog sentence, so "it" reads as the Dialog; it meant the popup's CSS exit transition on
   the re-show. Move it before the Dialog sentence or name the subject.
3. The `inert` window is observable and undocumented in the public docs: a consumer's
   `beforetoggle` listener on the Popup sees `inert`, a `MutationObserver` gets two records, and
   a consumer `[inert]` rule with a transition could start a transition if the focusing steps
   flush style (the architect memo notes this). Also a consumer who sets `inert` imperatively
   inside their own `beforetoggle` listener during a refused re-show has it removed by the
   `finally`. All exotic; one sentence in design popover.md 6.1 would cover it.
4. No test for `showPopover()` throwing during a refused re-show (inert removal is evident from
   the `finally`, so low value). No browser row for a `<div>` popup with a consumer `autofocus`
   child (jsdom covers it through the shim; spec behaviour is the same autofocus-delegate rule).

### Nits

5. `popover.test.tsx` new row: the comment "A later show (not a re-open of a refused fact) is not
   inert" sits above `inner.focus()`, which checks the attribute is gone, not a later show.
6. `BrowserOwnedStatePage.tsx`: "cannot trap the keyboard or the pointer in it" - "pointer" is
   loose (nothing traps the pointer; the old behaviour stole focus from the clicked field).

## WebKit (not run; spec-based)

- `inert` is supported since Safari 15.5. WebKit implements inertness through computed style;
  if its focus-delegate search reads stale style it could pick the inner input, but `focus()`
  updates style and refuses an inert target, so focus should still not move. The refused-Escape
  row and the light-dismiss row run on WebKit in CI; per the decision, a WebKit failure falls
  back to asserting the old behaviour there (option (a)), not to `.focus()`.
- The light-dismiss row's selection check (`setSelectionRange` at `click`) and event order
  (`inner:blur, outside:focus`) should hold in WebKit, which focuses an input on mousedown.

## Follow-up: 4218f0a (non-modal Dialog, wording fixes), 2026-11-24

**Verdict: mergeable.** One low test gap, optional.

Ran: jsdom dialog + popover 507 passed; browser dialog + popover on Chromium + Firefox 247 passed,
9 skipped; typecheck, lint (no errors), format:check clean.

### Flag lifecycle (`dialog-popup.tsx` `refusedFact`)

Mirrors `usePopoverPopup`: set in `onClose` after the `echo` return (so neither the library's own
`close()` nor JS-free mode sets it), cleared by any apply-effect run with `committed` false,
consumed (always, also when modal) by `openDialog`. Checked with scratch jsdom rows (not
committed), all passing on the branch:

- adopted dismissal, then a controlled `open={true}`: initial focus target focused;
- refused non-modal dismissal (focus stays outside), then controlled close and open: initial
  focus again;
- modal refused re-open consumes the flag (focus moves inside, as before), and a later
  non-modal open after a close focuses normally: a `modal` prop change cannot leave a stale flag;
- library Close (`openChangeAction` adopts): next open focuses.

`form method=dialog`: the library path cancels the native close and closes with its own
`close()` (echo, no flag); a consumer's `stopPropagation()` opt-out lets the browser close it,
which is a fact by design, so a refused re-open of that is inert like any other fact. Correct.
Modal path: `refused` is `false` whenever `modal`, so `showModal()` runs exactly as before (the
modal row asserts `inert` was absent during the call and the target got focus). `inert` removal
is in the same `finally` as `autofocus`.

### Tests

- Mutation "never set the flag": the branch's non-modal row fails. Good.
- **Low:** mutation "never clear the flag on `committed` false" fails none of the branch's
  tests (only my scratch rows), so the "adopted dismissal, then a new open gets initial focus"
  path is unpinned for Dialog (Menu has the equivalent browser row for usePopoverPopup). A jsdom
  row like the first scratch row above would pin it.
- **Low:** no browser row for the non-modal Dialog re-show; jsdom only, through the shim. The
  platform mechanism (dialog focusing steps skip an inert dialog) is the one the Popover browser
  rows already exercise, so the risk is small.

### Docs

Findings 1-3 and nits 5-6 addressed. overlay-open-change.md 2.4, dialog.md, popover.md 6.1,
BrowserOwnedStatePage and DialogPage now match the code: modal is the default and is the only
exception; non-modal re-show leaves focus where the dismissal put it; the CSS-exit sentence names
its subject. No inaccuracies found.
