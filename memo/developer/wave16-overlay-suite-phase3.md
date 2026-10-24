# Wave 16, overlay open-state suite, phase 3 (#106, tracker #100)

Branch `wave16/overlay-suite`. Audit `memo/reviewer/refactor-audit-tests.md` T8, T16 leftovers
(Dialog's history-named sections, long titles), T7.

New shared modules (`packages/ui/src/__tests__/`):
- `overlay-open-state-suite.tsx`: `createOverlayHarness` (the controlled/uncontrolled/static parity
  harness every overlay file had a copy of) and `describeOverlayOpenState(config)`, the suite. The
  driver: `isOpen`, `spyOpen` / `spyClose`, `dismiss(value?)` (the platform close), `partClose(user)`
  (a library-owned close by a click), the details shape (`detailsKeys`, `returnValue`), flags
  (`triggerToggles`, `ariaExpanded`), `foreignOpen`, `openBeforeHydration`, the call arguments of
  the library's open / close, and `closeIntents` (the stale-intent probe, JS-free components only).
- `dialog-harness.tsx`: the Dialog harness and queries, shared by the dialog*.test.tsx files.

## T20 guard rail: titles removed or renamed, and where they are now

Lists from the JSON reporter (`titles.mjs` in my scratchpad): file > full name. `S:` below stands
for `<Component> open state (shared overlay suite)`. Where a suite row runs in both modes the
`(uncontrolled)` / `(controlled)` pair maps one to one.

### Commit 1: suite + Dialog (dialog.test.tsx 183 -> 187 tests)

| Removed (Dialog > ...) | Now (Dialog S: ...) |
| --- | --- |
| sync action (both) a Trigger click dispatches (true, details) with the native click, cancelled | sync action (both) same title |
| sync action (both) a disabled Trigger never dispatches | sync action (both) same title |
| sync action (both) a click while optimistically open never dispatches | sync action (both) same title (`triggerToggles: false`) |
| sync action (both) a foreign show-modal command is cancelled and dispatched with the CommandEvent | sync action (both) a foreign open is cancelled and dispatched with its event (driver `foreignOpen` = the show-modal command) |
| async action (both) open: pending Trigger, dialog closed and content unmounted until it resolves | async action (both) open: pending Trigger, popup closed and content unmounted until it resolves (+ `showModal` called with no args) |
| async action (both) close: a dismiss notifies (false, { reason: 'dismiss', returnValue }) and shows pending | async action (both) dismissal: notified as (false, 'dismiss') with the platform's event; pending meanwhile |
| async action (both) close: the Close part is library-owned: openChangeAction(false) awaited, then close(value) | async action (both) part-initiated close: library-owned, open while openChangeAction(false) runs, closed on resolve (+ the pending state re-checked after two tasks, content gone after the close) |
| async action (both) a commit between the native close and its `close` event does not re-open | async action (both) a commit between the platform's close and its event does not re-open (the close is `requestClose()` now, was `close("x")`: both are platform closes the library did not start) |
| async action (both) a Close part's close is not a close request ... | stays (same title); its tail "a later dismissal is labelled as one" moved to S: close intents > a part-initiated close, then a dismissal (both) > the dismissal is reported as 'dismiss' (no stale intent from the part's close) (dismissal by `requestClose()`, was `close()`) |
| rejection (both) open rejects: the boundary gets it, the dialog never opened, no data-open | rejection (both) open rejects: the boundary gets it, the popup never opened, no data-open |
| rejection (both) open rejects, caught inside: resolves, commits, opens | rejection (both) open rejects, caught inside: resolves and commits (uncontrolled opens) |
| rejection (both) close notification rejects: the boundary gets it (the dialog was already closed) | rejection (both) dismissal notification rejects: the boundary gets it (the popup was already closed) |
| rejection (both) close notification rejects, caught inside: commits false in uncontrolled mode | rejection (both) dismissal notification rejects, caught inside: uncontrolled stays closed, controlled re-opens |
| library-owned part-initiated closes (#46) > Close part (both) openChangeAction(false) rejects uncaught: the boundary above Root gets it, close() never ran | rejection (both) part-initiated close rejects: the boundary gets it, the library never closed the popup |
| library-owned part-initiated closes (#46) > Close part (both) a dismissal during a pending part-initiated close notifies nothing more (walkthrough 11.13) | async action (both) same title |
| library-owned part-initiated closes (#46) > a controlled parent that keeps `open` vetoes a part's close: snap-back, nothing closed (11.14) | controlled refusal and veto > a refused part-initiated close is a real veto: never closed, data-open snaps back (11.14) |
| refused close (controlled) > re-opens the dialog after the notification settles; not a veto | controlled refusal and veto > a refused dismissal re-opens the popup once the notification settles; not a veto |
| refused close (controlled) > a vetoed open snaps back and the dialog never opens | controlled refusal and veto > a vetoed open snaps back and the popup never opens |
| overlap (walkthrough 11.8) > close pending, user re-opens (both) both actions run; the latest intent wins | overlap > dismissal notification pending, the user re-opens (walkthrough 11.8) (both) same title |
| superseded rejection (both) the older dispatch rejects after the newer resolved / while the newer is pending | superseded rejection > a dismissal, then a re-open (both) same titles |
| suspending content (both) keeps the dialog closed and the Trigger pending until the content is ready | suspending content (both) keeps the popup closed and the Trigger pending until the content is ready |
| suspending content (both) keepMounted: content is pre-rendered hidden inside <Activity> | suspending content (both) same title |
| platform path > pre-hydration open (both) one dispatch with reason 'platform' ...; StrictMode still dispatches once; rejected: the dialog is closed again and no close notification follows | platform path > pre-hydration open (both) same titles ("the popup is closed again"); the spies are now created after the native pre-open, right before hydration |
| platform path > controlled parent refusing the pre-hydration open closes the dialog | platform path > a controlled parent refusing the pre-hydration open closes it, with no notification |
| platform path > a controlled `open` flipped programmatically calls showModal / close, no echo dispatch | platform path > a controlled `open` flipped programmatically opens and closes, no echo dispatch (+ `showModal` called with no args) |
| platform path > defaultOpen opens after mount | platform path > defaultOpen opens after mount |
| JS-free mode > a close intent is dropped a task later while the dialog stays open, kept once closed | close intents > an intent is dropped a task later while the popup stays open, kept once closed (the close is `requestClose()`, was `close()`; + `isOpen` false asserted) |

New for Dialog (rows Popover had): rejection (both) part-initiated close rejects, caught inside:
uncontrolled closes, controlled stays; close intents (both) as above (split from the Close row).

Mutations (library source edited in the worktree, run, reverted with `git checkout`):
1. dialog-popup.tsx: a dismissal without intent reported as `"activate"`: 11 failures, including S:
   dismissal (both) and S: close intents (both).
2. use-controllable-action.ts: the uncontrolled latest-dispatch guard dropped: 3 failures, including
   S: overlap (uncontrolled).
3. use-overlay-root.ts: a stale intent never cleared: S: close intents > an intent is dropped ...
   fails (only that row).
4. dialog-root.tsx: `details` without `returnValue`: 31 failures, including S: sync action (both)
   (details keys), part-initiated close (both), dismissal (both).
5. dialog-close.tsx: the Close part closes the dialog before openChangeAction(false) settles (no
   revert possible): 15 failures, including S: part-initiated close (both), 11.13 (both), part close
   rejects (both) and the 11.14 veto row.
(Tried first: removing the apply effect's `openDialog` branch: 108 failures, too broad to tell
anything; replaced by 5.)

### Commit 2: Popover (popover.test.tsx 164 -> 177 tests)

Driver: `partClose` = a Trigger click while open (as the old rows), `dismiss` = `hidePopover()`,
`foreignOpen` = a script's `showPopover()` (the dispatched event is the cancelled `beforetoggle`),
`triggerToggles: true`, `ariaExpanded: true`. The harness is `createOverlayHarness` now; the foreign
show/hide invoker rows, the hide-popover-without-close row and "JS-free mode syncs aria-expanded for
a pre-hydration open" stay in the file.

| Removed (Popover > ...) | Now (Popover S: ...) |
| --- | --- |
| sync action (both) a Trigger click dispatches (true, details) with the native click, cancelled | sync action (both) same title (keys now compared sorted; one key) |
| sync action (both) a click while open dispatches (false, 'activate'): a library-owned close | sync action (both) same title |
| sync action (both) a disabled Trigger never dispatches | sync action (both) same title |
| sync action (both) a foreign open (script showPopover) is cancelled at beforetoggle and dispatched | sync action (both) a foreign open is cancelled and dispatched with its event |
| async action (both) open: pending Trigger, popup hidden and content unmounted until it resolves | async action (both) open: pending Trigger, popup closed and content unmounted until it resolves |
| async action (both) part-initiated close: the popup stays open while pending, hides on resolve | async action (both) part-initiated close: library-owned, open while openChangeAction(false) runs, closed on resolve (+ the details checked, state also checked before the two tasks, committed "false", focus on the Trigger) |
| async action (both) dismissal: notified as (false, 'dismiss') with the toggle event; pending meanwhile | async action (both) dismissal: notified as (false, 'dismiss') with the platform's event; pending meanwhile (the end state is now asserted right after the resolve, without the two extra tasks) |
| async action (both) a commit between the native hide and its `toggle` event does not re-open | async action (both) a commit between the platform's close and its event does not re-open |
| rejection (both) open rejects: ...; open rejects, caught inside: ...; part-initiated close rejects, caught inside: ... | rejection (both) same titles |
| rejection (both) part-initiated close rejects: the boundary gets it, the library never hid the popup | rejection (both) part-initiated close rejects: the boundary gets it, the library never closed the popup (+ error-catcher present) |
| rejection (both) dismissal notification rejects: the boundary gets it (the popup was already hidden) | rejection (both) dismissal notification rejects: the boundary gets it (the popup was already closed) |
| controlled refusal and veto > a refused dismissal re-opens ...; a vetoed open snaps back ... | controlled refusal and veto > same titles |
| controlled refusal and veto > a refused part-initiated close is a real veto: never hidden, data-open snaps back | controlled refusal and veto > a refused part-initiated close is a real veto: never closed, data-open snaps back (11.14) (+ no re-open call, not pending) |
| overlap > second click during a pending open (walkthrough 11.7) (both) both actions run, the popup never opens, the latest intent wins | overlap > same describe and title (+ no data-open) |
| overlap > dismissal during a pending part-initiated close (walkthrough 11.8) (both) dispatches nothing more; one openChangeAction(false) | async action (both) a dismissal during a pending part-initiated close notifies nothing more (walkthrough 11.13) (Popover's design numbers it 11.8, Dialog's 11.13; the suite uses Dialog's number) |
| superseded rejection (both) the older dispatch rejects after the newer resolved / while the newer is pending | superseded rejection > an open, then a close click (both) same titles |
| suspending content (both) keeps the popup hidden and the Trigger pending until the content is ready | suspending content (both) keeps the popup closed and the Trigger pending until the content is ready |
| suspending content (both) keepMounted: ... | suspending content (both) same title |
| platform path > pre-hydration open (both) one dispatch ...; StrictMode still dispatches once | platform path > pre-hydration open (both) same titles (the spy is created after the native pre-open instead of `mockClear()` after hydration: it now also covers the hydration itself) |
| platform path > a controlled parent refusing the pre-hydration open hides it, with no notification | platform path > a controlled parent refusing the pre-hydration open closes it, with no notification |
| platform path > a controlled `open` flipped programmatically calls showPopover / hidePopover, no echo dispatch | platform path > a controlled `open` flipped programmatically opens and closes, no echo dispatch (+ `hidePopover` called with no args) |
| platform path > defaultOpen opens after mount | platform path > same title |

New for Popover (rows Dialog had): rejection (both) dismissal notification rejects, caught inside;
overlap > dismissal notification pending, the user re-opens (both); superseded rejection > a
dismissal, then a re-open (both x2); platform path > pre-hydration open (both) rejected: the popup is
closed again and no close notification follows; close intents (both) the dismissal is reported as
'dismiss'; close intents > an intent is dropped a task later ... (on the Popover context). All pass:
no Popover bug found by the new rows.

Mutations:
1. use-popover-popup.ts: a dismissal without intent reported as `"activate"`: 7 failures, including
   S: dismissal (both) and S: close intents (both).
2. use-controllable-action.ts: latest-dispatch guard dropped: S: overlap 11.8 (uncontrolled) and S:
   overlap 11.7 (uncontrolled) fail.
3. use-overlay-root.ts: a stale intent never cleared: S: close intents > an intent is dropped ...
   and the two local hide-popover-without-close rows fail.
4. use-popover-trigger.ts: the Trigger's close hides at once, before openChangeAction(false)
   settles: 9 failures, including S: part-initiated close (both), 11.13 (both), part close rejects
   (both) and the 11.14 veto row.

### Commit 3: Menu (menu.test.tsx 107 -> 168 tests, nothing removed)

Menu had almost no `openChangeAction` rows of its own (no rejection, refusal, overlap or superseded
rows for the Root). It fits the suite with one difference: the part-initiated close is an action-
less item's activation, not a Trigger click. A Trigger click while the menu is open moves focus to
the Trigger first, and the root Popup's `focusout` hides the menu at once (design/components/menu.md
2.2: "the one place Menu closes the way Dialog does"), so the menu is not open while
`openChangeAction(false)` runs. Not a bug; the suite's Trigger-toggle rows (11.7, the open-then-close
superseded rows, "a click while open dispatches (false, 'activate')") still run for Menu and pass.
The item's click is not cancelled (no native command to replace): new suite parameter
`partCloseCancelsClick` (Dialog, Popover `true`). The stale-intent row renders `<Menu.Root
defaultOpen>` with the probe as a Root child (library mode cancels a native open; the popup's
content mounts only while open): `closeIntents.open` became optional.

No Menu row removed: the existing Root rows ("a controlled open flip ...", "mount with the popup
already open ...", "items that suspend hold the open ...") also pin the autofocus target, Menu's
own concern; they stay.

Mutations (run on menu.test.tsx):
1. menu-item.tsx: the item's close hides the popup at once, before openChangeAction(false)
   settles: 7 failures, all suite rows (part-initiated close (both), 11.13 (both), part close
   rejects (both), the 11.14 veto). Before this commit no Menu row caught it.
2. use-popover-popup.ts: a dismissal reported as `"activate"`: 7 failures, including S: dismissal
   (both), S: close intents (both).
3. use-controllable-action.ts: latest-dispatch guard dropped: S: overlap 11.8 and 11.7
   (uncontrolled) and the RadioGroup overlap row fail.
4. use-overlay-root.ts: a stale intent never cleared: S: close intents > an intent is dropped ...
   fails. Before this commit no Menu row caught it.

### Commit 4: dialog.test.tsx split, history-named sections regrouped (187 -> 187 jsdom tests; browser 38 -> 38 per engine)

Files: dialog.test.tsx (101: suite, ARIA, JS-free mode, keyboard, function props, render element,
post-await, light dismiss, focus, nested confirm, warnings, smoke), dialog-close.test.tsx (41: Close
part, library-owned closes, the 11.14 veto parent, foreign close commands, held content, focus
return), dialog-form.test.tsx (24: Form part, closeOnSettle, `method="dialog"` submits),
dialog-disabled.test.tsx (21). Harness in `src/__tests__/dialog-harness.tsx` (commit 1). 110 full
names are unchanged (only the file moved). Review ids moved from titles into a comment above the
row (`// review M1 (memo/reviewer/dialog-46.md).`). Renamed (Dialog > ...):

| Old | New |
| --- | --- |
| Close part > open-generation guard (review M2) (both) ... | Close part > open-generation guard (both) same row title |
| async action (both) a Close part's close is not a close request: ... | library-owned closes > Close part (both) same row title |
| library-owned part-initiated closes (#46) > Close part (both) with action: openChangeAction(false) runs after the action; the Close stays pending until the close commits | library-owned closes > Close part (both) with action: openChangeAction(false) runs after it; the Close is pending until the close commits |
| library-owned part-initiated closes (#46) > a vetoed close's returnValue ...; JS-free: a Close action closes ...; a render={<a href />} Close ... | library-owned closes > same titles |
| ... > review of #46 > L4: a re-open between the library's close() and its close event is not superseded | library-owned closes > a re-open between ... (same, no "L4: ") |
| ... > review of #46 > walkthrough 11.16: ... | library-owned closes > same title |
| ... > review of #46 > re-open during a pending part close (P2) > non-modal: ... | library-owned closes > re-open during a pending part close > same title |
| ... > review of #46 > M1: an Escape during a pending part close that is then vetoed is notified, not undone | a controlled parent that vetoes the Close part's close (walkthrough 11.14) > an Escape during the pending close, then the veto: the dismissal is notified, not undone |
| ... > review of #46 > M1: the dismissal is superseded by a re-open through the Trigger | a controlled parent that vetoes ... > an Escape during the pending close, then a re-open through the Trigger: superseded |
| ... > review of #46 > a Close action plus a controlled veto: the action runs, the close is vetoed, no blink | a controlled parent that vetoes ... > with a Close action: the action runs, the close is vetoed, no blink |
| library-owned part-initiated closes (#46) > foreign close command (both) ...; a foreign close command without a source ...; JS-free: a foreign request-close invoker ... | foreign close commands > same titles |
| library-owned part-initiated closes (#46) > held content (design 4.4) > ... (#64) and 5 others | held content (design 4.4) > same titles ("(#64)" dropped) |
| library-owned part-initiated closes (#46) > focus return: ... (4 rows) | focus return: ... (same) |
| async action (both) close: a method='dialog' submit is 'activate' with the submitter's value | method='dialog' submits > method='dialog' submit (both) is 'activate' with the submitter's value |
| library-owned part-initiated closes (#46) > method='dialog' submit (both) ... (2 rows); a plain <form method='dialog'> ...; stopPropagation() in onSubmit ...; Form action settle close (both) ... | method='dialog' submits > same titles |
| ... > review of #46 > M3: stopPropagation() from a document listener that runs first (React root on the document) opts out | method='dialog' submits > a document listener that runs first and stops propagation opts out (React root on the document) |
| ... > review of #46 > L1: a method='dialog' submit inside a shadow root goes through the Root | method='dialog' submits > a method='dialog' submit inside a shadow root goes through the Root |
| ... > review of #46 > nested dialogs and the shared submit listener > (2 rows) | method='dialog' submits > nested dialogs and the shared submit listener > same |
| review fixes > re-open while a close notification is pending (L2) (both) Escape during a Form save, then the Trigger: pending meanwhile, opens after the save, no extra close | method='dialog' submits > re-open while a dismissal's notification waits for a Form save (both) Escape, then the Trigger: pending until the save settles, then open; no extra close |
| review fixes > Dialog.Form closeOnSettle (M3) > (2 rows) | Form part > closeOnSettle > same titles |
| review fixes > Dialog.Form keeps `method` with a string action; owns it otherwise (L4) | Form part > keeps `method` with a string action; owns it otherwise |
| review fixes > Root state.pending is true during the re-open window (L2) | function props > Root state.pending is true while a re-open waits for a dismissal's notification |
| review fixes > non-modal: Escape is left to an open popover inside the dialog (M2) | keyboard > same without "(M2)" |
| review fixes > nested confirm (H1) > the recommended pattern ... | nested confirm dialog > same title |
| review fixes > nested confirm (H1) > characterisation: an action that awaits input arriving through a transition holds every transition | nested confirm dialog > characterisation: awaiting input that arrives through a transition holds every transition |
| review fixes > disabled is owned: a render element cannot re-enable Trigger or Close (L1) | disabled on link and component renders (design/components/button.md 17.3) > same without "(L1)" |
| disabled on link and component renders (#83, design/components/button.md 17.3) > 17 rows | disabled on link and component renders (design/components/button.md 17.3) > same titles, except "... (review M1)" x2 and "... (fold W8)" x3 lose the suffix |
| light dismiss (baseline) > modal / non-modal: a drag from inside ... does not close (M1) | same without "(M1)" |

Browser (dialog.browser.test.tsx, per engine): "review rows (browser)" dissolved: `... drag from
inside ... (M1)` -> light dismiss (browser) > same without "(M1)"; `non-modal: Escape inside a
popover closes the popover only (M2)` -> library mode (browser) > same without "(M2)"; `nested
confirm: the inner dialog opens at once; the outer closes after the confirm (H1)` -> nested confirm
(browser) > the inner dialog opens at once; the outer closes after the confirm. "ViewTransition
(browser, #46)" -> "ViewTransition (browser)" (13 rows, same titles; one shortened: "transition="pop"
plus a CSS exit and the recipe: an Escape runs one view transition, no new image of the dialog" ->
"transition="pop", a CSS exit and the recipe: an Escape runs one view transition, no new dialog
image").

Not renamed: "re-entry (#81, design/components/button.md 16.4)" and its D1-D6 ids (design test-plan
ids, not review ids).

### Commit 5: T7, the browser late-mount ViewTransition row

`src/__tests__/view-transition-mount.tsx`: `countLateMountViewTransitions(transition, config)` and
`itStartsNoViewTransitionOnMount({ late, wrap?, mounted })` (a new module, not browser-helpers.ts,
which the parallel value-suite work may touch). Converted: button.browser and toolbar.browser
(same counts per engine).

| Old | New |
| --- | --- |
| button.browser > ViewTransition (row 25) > a mount in a transition: none without `transition`, one with `none` | same describe > a mount in a transition starts no view transition without `transition`, one with `none` |
| toolbar.browser > Button view transitions in a Toolbar (row 23) > without `transition` a mount starts no view transition; with `none` it does | same describe > a mount in a transition starts no view transition without `transition`, one with `none` |

Left for the value-suite developer (their files): toggle-group.browser (row 23, `mountItem`),
checkbox-group.browser ("view transitions", `mountItem`; it asserts `> 0` for `none`, the shared row
asserts exactly 1: check all three engines when converting) and select.browser (its `Late` is a
different shape: an option list). The "never starts a document view transition" rows of slider,
number-field, progress, toast and select drive component-specific interactions; not the same row,
left as they are.

Mutations (transition-boundary.tsx, browser project, Chromium + Firefox):
1. Always wrap in `<ViewTransition default={transition ?? "none"}>`: both converted rows fail on
   both engines (4 failures).
2. Never wrap: both converted rows fail (plus Button's `transition="auto"` settle row), 6 failures.
