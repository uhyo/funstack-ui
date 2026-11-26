# Review: Drawer (#168), branch feat/168-drawer @ d7db3304

Verdict: **merge after fixes** (no blocker; two doc fixes, one small robustness fix, the rest
optional).

Checked: issue #168 decisions, drawer.md, the two CHANGELOG entries, memo/developer/issue-168.md,
the full diff. Ran: `pnpm build`, jsdom (99 files, 4675 tests pass), browser Drawer/Dialog/
AlertDialog files on Chromium + Firefox (pass; WebKit lacks host libraries here, branch CI green),
full browser suite on Chromium + Firefox, lint (design refs + internal layering pass), typecheck,
format:check.

## Conformance (all OK)

- Swipe close is a fact: `dismiss(event)` in dialog-popup.tsx:497-506 records
  `{ reason: "dismiss", event: pointerup }` and calls `requestClose()`; the slide is finished first
  (drawer-swipe.ts:170-193, baseline taken before the write). onCancel veto slides back.
- `lightDismiss ?? ctx.modal` (drawer-popup.tsx:138). Transition types via
  `useDialogRoot({ component: "drawer" })`; Dialog and AlertDialog pass `"dialog"`: unchanged.
- Tracker: slop + axis (strict `along > across`), threshold 25%, velocity over 100 ms with the
  press as sample 0 and the pointerup as last sample, reversal before flick; capture on the
  dialog only at start; selection snapshot/removal for mouse; capturedElsewhere through
  `gotpointercapture` (touch implicit capture excluded); second primary press cancels.
- beforetoggle(closed) cancels a drag but keeps the offset for the closing frame; `close` clears;
  beforetoggle(open) clears stale values. RTL read per press from computed `direction`.
- Reduced motion: no animations -> `close()` synchronously. Correct, but untested in a browser.
- `ownProps` spread after Dialog's owned keys, before `suppressHydrationWarning`; Drawer only.
- internal/ layering: swipe.ts and swipe-arithmetic.ts flat, directive-free, no dialog imports.
- Props tables match the types (DialogPopupProps fields, DrawerPopupState, Root props).

## Findings

1. Medium, docs: the "stiff" recipe is broken (DrawerPage.tsx, "Using the swipe variables").
   `.drawer.stiff:open { translate: calc(var(--drawer-swipe-*) * .8) }` also scales the release
   write (offset = full extent), so a dismissed drawer stops 20% on screen, then closes: a jump in
   Firefox, a two-stage slide elsewhere. Fix: scope it to the drag,
   `.drawer.stiff[data-swiping] { ... }` (0,3,0 beats `:open`), so the release and the return use
   the unscaled rule.
2. Medium, docs/design: the side-drawer list recipe `touch-action: pan-y` (drawer.md 5.1,
   DrawerPage "Scroll inside the drawer", developer memo device check 4) drops pinch zoom inside
   the list, while the Popup itself keeps `pinch-zoom`. Fix: `touch-action: pan-y pinch-zoom`.
3. Low, robustness: stale dismissal (drawer-swipe.ts:181-192). `close()` only checks
   `dialog.open`. If the dialog is closed another way during the slide (Escape) and re-opened
   before the awaited animation settles (it settles at once only when the close replaced the
   transition, which depends on the consumer's CSS), the old gesture closes the new showing and
   reports a stale `pointerup`; `closing` also refuses presses of the new showing. Fix: an
   open-generation counter bumped in `onBeforeToggle` (newState "open"); `close()` and the
   `closing` reset compare it.
4. Low, "costs nothing in production" is not quite true (dialog-close.tsx:136-143). Every
   Dialog/AlertDialog/Drawer Close now runs `use(DialogCloseRegistry)`, a `useCallback` and a
   merged ref in production, and a consumer `ref` is always wrapped by `mergeRefs`. Behaviour is
   unchanged (mergeRefs keeps cleanups). Fix (optional): `useMergedRefs(ref, isDev ? reportClose :
   undefined)` with a module `isDev`, so production passes the consumer ref through untouched.
5. Low, tests missing: unmount or `side` change during a drag and during the release wait; a
   press during the wait starts nothing; reduced motion in a browser
   (`commands.emulateReducedMotion` exists: release closes in the same task, return in one frame).
6. Low, design text: 4.1 "Not a start ... dragging over text selects" is effectively dead for a
   drag along the axis (the CHANGELOG admits it). The browser test "a mouse drag moves and does
   not select text" pins the opposite of what the row's parenthesis promises. Reword the row
   ("rarely applies; a drag along the axis moves, a drag across selects").
7. Low, skill/docs: the opt-out `onPointerDown={(e) => e.preventDefault()}` (SKILL.md, docs
   table) also suppresses the compatibility `mousedown`, so a mouse press in that region no longer
   focuses or starts a selection. Say so, or recommend it only on non-focusable regions. The skill
   also lacks the side-drawer list recipe (gap 4).
8. Nit: the dev "no Close" check never resets `closeSeen` per showing (drawer-popup.tsx:101-111),
   while drawer.md 7 / CHANGELOG say "a showing during which none was mounted". Harmless (warns
   once anyway); align the wording.

## Browser-test infrastructure (sound)

- `mouseFlick` and `mouse.up(..., steps)`: one Playwright command, so no RPC gap before the
  release; `up` defaults to `steps = 1`, identical to the old behaviour for every other caller.
- `strictInputTiming` via vitest `provide` (true when `CI`) with up to 5 attempts: each attempt
  asserts the drawer agrees with the arithmetic applied to the events the engine really
  delivered (recorded at document capture, the same stream the tracker sees; the up sample and
  the extent are computed the same way). A wrong decision fails in any attempt; a missing fast
  gesture fails in CI. It cannot hide a tracker bug, only skip the "is this a flick" coverage
  locally, which the fake-clock jsdom rows cover. Suggest a one-line mention in CLAUDE.md's
  Browser tests section so the next author of a timing row reuses it.

## Gap 4: a vertical list in a side drawer does not drag

Cause: computed `overflow-y: auto` makes `overflow-x` compute `auto`, so the list is a
horizontal scroll container by the rule (and for touch, the touch-action chain ends at it with
`auto`, so the browser claims a horizontal pan and fires `pointercancel`). Options:

- A. Keep the rule and the recipe (current). Correct for every pointer type, one rule. Cost: the
  common layout (header + scrolling list + footer) silently loses the swipe on most of its area.
- B. Use the amount of overflow on the drawer's axis (`scrollWidth > clientWidth`). Fixes mouse
  and pen only: by touch the child scroller still ends the touch-action chain and the browser
  takes the pan, so touch and mouse would disagree (the reason 5.1 ignores the amount). Reject.
- C. The library writes `touch-action` / overflow on descendant scrollers. Writes on consumer
  elements; against the "places nothing" rule. Reject.
- D. A (keep the rule) plus a development warning, once per instance: a press refused by a
  scroller in a side drawer whose `overflow-x` is `auto`, whose `overflow-y` is not `visible`, and
  which has no horizontal overflow (`scrollWidth <= clientWidth`), pointing at the recipe
  (`overflow-x: hidden; touch-action: pan-y pinch-zoom`). Put the recipe in the starter
  stylesheet and the skill too.

Recommendation: D. The rule is right; the failure is silent, and a press-time dev hint is cheap
and has no production cost. Not a merge blocker; can be a follow-up issue.
