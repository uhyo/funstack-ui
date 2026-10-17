# Reviewer memo: Dialog #46, library-owned part-initiated closes (2026-10-18)

Reviewed commits 4e6b9f2..7258b53 (merge 97effd1). Checked against design/components/dialog.md
(2.3, 3.4, 4.4, 8.1, 10.3, 11.11-11.16, 13, 14, "Amendment"), conventions 3.5 and
memo/developer/dialog.md "#46".

Checks: jsdom `src/dialog` + `src/internal` 345/345. Browser `src/dialog` 66/66 on Chromium 156
and Firefox 157 (`FUNSTACK_BROWSERS=chromium,firefox`). WebKit cannot run on this machine. CI on
97effd1 is green, and CI runs the WebKit job.

Verdict: **acceptable with minor fixes.** The code follows the amendment closely. Focus return,
the open generation, returnValue clearing on a veto, the held content and JS-free mode are all
correct and tested. M1 needs an architect decision. M2 is a design/docs change. M3 is a one-line
fix.

## Probes (scratch tests, all deleted)

| # | Probe | Result |
| --- | --- | --- |
| P1 | jsdom, controlled. A Close is pending (`openChangeAction(false)` deferred), then Escape, then the parent vetoes the Close | Calls `[[true,activate],[false,activate]]`. The dialog **re-opens** (`showModal` called again). The dismissal is never notified. |
| P2 | jsdom, non-modal. A Close is pending, then the Trigger re-opens | Calls `[true, false(cancel), true]`. The dialog stays open, no `close()`, `data-open` back. Correct. |
| P3 | jsdom, controlled. `setOpen(false)` while a Close action runs (11.16) | One `openChangeAction(false)`, the dialog closed, returnValue `v`. Matches the design note. |
| P4 | Browser. CSS exit (10.1) on the box plus `transition`, at `ready` | Chromium: a Close **and an Escape** both have `::view-transition-new(_t_N_)` (live, fading dialog, `display:block`, opacity about 0.89) next to `::view-transition-old(_t_N_)`. Firefox: old only. |
| P5 | Same, with `html:active-view-transition-type(fsui-dialog-close) .fade { transition: none }` | Close: old only, `display:none` at `ready`. Escape: the fade is cut and the root old snapshot (dialog mid-fade) cross-fades out. **A controlled close is not covered** because it carries no types: the new image is still there. |
| P6 | Same, with `html:active-view-transition .fade { transition: none }` | A controlled close has old only in Chromium and Firefox. Covers every kind of close. |
| P7 | Two `submit` bubble listeners on `document`, the first calls `stopPropagation()` | The second still runs and sees `cancelBubble === true`. |
| P8 | jsdom. `Dialog.Form action={fn} closeOnSettle={false}` with a `formMethod="dialog"` submitter | Re-runs the action and does not close, because React prevents the submit for a function action. |

## Findings

### M1. An Escape during a pending part close is undone by a controlled veto, and never notified

Where: `dialog-root.tsx:199-205` (`notifyClosed` skips because `false` is intended) and
`dialog-popup.tsx:328-330` (the apply effect re-opens: committed `true`, dialog closed).

Scenario: the controlled parent follows 11.14's "veto Cancel while dirty". The user clicks Cancel
and the action is slow. The user then presses Escape, and the dialog closes at once (11.13). The
action resolves and the parent keeps `open`. Optimistic snaps back to `true`, and the apply effect
calls `showModal()`. The user saw the dialog close and come back, and focus was pulled back in.
The parent was only ever asked about the Cancel. It never got the `"dismiss"`, which the docs tell
it to adopt unconditionally. Design 11.13 skips the second notification on purpose, but it does
not consider the veto variant (11.14), so 11.13 and 11.14 together give this result (P1).

Options for the architect:
- (a) In the `close` listener, when `false` is intended by an in-flight dispatch (not the
  library's own echo), set a "dismissed while pending" flag. When that dispatch settles with
  committed `true` and the dialog closed, the apply effect dispatches the `"dismiss"`
  notification instead of calling `showModal()`.
- (b) Accept the behaviour and document it in 11.13 and in the `openChangeAction` comment.

Either way, add the jsdom row.

### M2. CSS exit plus `transition`: the developer's finding is real, also affects dismissals, and the design should change (docs and recipe, no API change)

Where: design 10.3 table row "Dismissal ... nothing visible to animate" and the paragraph
recommending "at most, a CSS exit for dismissals". Docs `DialogPage.tsx:470-477`.

P4: in Chromium, with the 10.1 CSS exit on the box, every `transition` close has a live
`::view-transition-new` of the fading dialog. The consumer's `::view-transition-old(.x)`
animation and the UA (or consumer) `new` fade-in then play together, so the user sees a double
image. This happens for a part close, and for an Escape whenever the notification commit lands
inside the fade (an action that is instant or does nothing, the common case). WebKit is likely
the same (it animates the exit), but I did not verify it.

The docs' answer ("drop the CSS `display` / `overlay` transition") avoids the artifact. But then,
with `transition`, a dismissal has no exit animation at all in any engine, which contradicts the
bullet's own "dismissals animate with CSS only".

Recommended design change for 10.3 and the docs:
1. Recipe: keep the CSS exit and add
   `html:active-view-transition .dialog { transition: none; }`.
   - P6 shows this removes the new image for part closes and for controlled closes.
   - For an Escape it hands the rest of the fade to the root old snapshot (P5).
   - The typed form `:active-view-transition-type(fsui-dialog-close)` misses a controlled close,
     because a controlled close has no types.
   - Cost: an unrelated page view transition also cuts a dialog fade in progress.
   - Verify in WebKit (`:active-view-transition` is Safari 18.2+).
2. Correct the 10.3 row: with a CSS exit, a dismissal's notification commit does capture the
   dialog when it lands inside the fade.
3. Make the browser row "transition=pop plus a CSS exit: an Escape runs one view transition"
   also assert the image. It currently counts calls only and passes with the double image. Add a
   Close variant that uses the recipe and asserts no `::view-transition-new(<dialog group>)`.
4. Popover's docs recipe keeps its fade with `transition`. It probably has the same artifact;
   check it there.

### M3. The documented `stopPropagation()` opt-out does not work when React's root is the document (FUNSTACK Static)

Where: `dialog-popup.tsx:388-408, 471`. Docs `DialogPage.tsx:650-654`, design 8.1, Amendment
"Trade-offs".

`@funstack/static` calls `hydrateRoot(document, …)` (`dist/client/entry.mjs:39,57`). React
therefore registers its `submit` listener on `document` at hydration, before the Popup's
listener. `stopPropagation()` does not stop other listeners on the same node (P7).

Scenario: on a FUNSTACK Static page (this repo's docs site included), a consumer follows the docs
and calls `e.stopPropagation()` in `onSubmit`. The library still cancels the submit and closes
through the Root with `"activate"`. The opt-out silently does nothing.

Fix: after the `defaultPrevented` check, `if (event.cancelBubble) return;`. P7 confirms
`cancelBubble` reads `true` there. Add a test that registers a document listener calling
`stopPropagation()` before mounting.

### L1. Shadow DOM: the document-level submit listener never sees the submit

Where: `dialog-popup.tsx:464,471`. `submit` is not composed. Inside a shadow root, the event never
reaches `document`, so a `method="dialog"` submit closes natively and is notified as `"dismiss"`.
Listening on `dialog.getRootNode()` fixes it (Tabs already uses `getRootNode()`) and keeps "after
React's root listener", because the React container is inside that root.

### L2. The `closeOnSettle` doc suggests a submitter that cannot close

Where: `dialog-form.tsx:190-192`, design 3.5 and 8.1. "a submitter with `formMethod="dialog"`"
inside a function-action Form re-runs the action and never closes (P8): React prevents every
submit of a function-action form. The text is older than #46, but it was carried through the
#46 edits. Drop the suggestion or say "in a separate `method="dialog"` form".

### L3. A dismissal during a pending part close, with `transition`, is not held

Where: `dialog-popup.tsx:431-442`. `echo` is true (`false` intended) and `transition` is set, so
the animation read is skipped. If the action settles during the CSS fade, the close commit
unmounts the content inside the fading box. This is moot once the M2 recipe is applied. Otherwise,
compute `echo` as "the library's own `close()`" (see L4) and not `!intended()`.

### L4. Echo detection is by intent, not by source

Where: `dialog-popup.tsx:335,431,444`. The apply effect records `undefined` and relies on
`!intended()`. Scenario: if a re-open becomes intended between the library's own `close()` and
its `close` event, which is one task later (for example a non-modal Trigger click in that task
gap), the event is taken for a dismissal. `notifyClosed` then dispatches `false` and supersedes
the user's re-open. The window is narrow.

Related: a returnValue stored by `requestClose` is never taken when the dismissal in 11.13 made
the apply effect skip `close()`. It is cleared at the next optimistic `true`, so it does no harm
today.

A single sentinel intent for "library close" (consumed in `close`) fixes both L3 and L4.

### L5. Test gaps

There are no rows for:
- P2: a re-open during a pending part close.
- P3: walkthrough 11.16.
- M1: a dismissal plus a veto.
- A Close with `action` plus a controlled veto.
- Several or nested dialogs and the shared document `submit` listener: an inner library or
  JS-free Root inside an outer library Popup, where the outer listener must ignore the inner
  form. The `closest("dialog") !== element` filter makes this correct by reading, but nothing
  guards it.

Browser negative assertions use `sleep(50)`. A sleep can only make those tests pass wrongly, not
flake, so this is acceptable.

## Checked and fine

- Async React:
  - Every part close goes through `dispatch` (transition, optimistic `false`, Trigger pending).
  - The Close's `isPending` is entangled until the close commits (asserted).
  - A rejection reaches the boundary and `close()` never runs.
  - A veto snaps back with no blink (11.14 test).
  - After a veto, the returnValue does not leak into a later controlled close (test).
- Re-open during a pending close (P2): the insertion effect clears the stale returnValue. The
  open generation is bumped at dispatch and at `beforetoggle`, so a stale Close continuation is
  dropped (test at `dialog.test.tsx:1269`).
- Focus:
  - Modal: the platform restore.
  - Non-modal with `transition` and default or `keepMounted` mounting: the content probe plus
    `returnFocus`, tested in jsdom and in the browser on Chromium and Firefox (WebKit in CI).
  - `forget()` on every open and while open.
- AT: `aria-modal` comes from `showModal()`. Nothing new is exposed during a pending close apart
  from `data-pending`, which is consistent with Popover.
- JS-free and pre-hydration: the markup is unchanged (`command="request-close"`,
  `method="dialog"`), so a pre-hydration click closes natively and committed `false` agrees.
  The static Close action closes directly (test).
- Nested dialogs and several dialogs: each Popup's document listener filters on
  `form.closest("dialog") === dialog`. An inner JS-free Root records its own intent and the
  outer ignores it. This is correct by reading but untested (L5).
- The `useContentFocusProbe` extraction does not change Popover or Menu (their suites pass).
