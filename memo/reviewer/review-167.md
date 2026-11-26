# Review #167 AlertDialog (feat/167-alert-dialog @ ee08bd92)

Verdict: merge after minor fixes (none blocking).

Ran: jsdom + jsdom-isolated 4449/4449 pass (after a ui build; directives.test needs dist).
Browser (Chromium, Firefox) for src/alert-dialog, src/dialog, src/popover: 268 pass, 10 skipped
(engine checks). WebKit not installed locally; the developer's CI run was green on all three.

## Conformance checked (OK)
- Escape: platform close request -> onOpenChange(false, dismiss, ""); no prop to turn off.
- No light dismiss: lightDismiss / experimental_closedBy typed out and forced false at
  alert-dialog-popup.tsx:90; no closedby rendered.
- Action with action: nativeCommand false -> no commandfor/command (use-overlay-close.ts:111-114);
  without action keeps the native command. Resolve -> requestClose; reject -> nothing dispatched.
- whilePending default "ignore" via useOverlayClose's defaultWhilePending.
- role owned (dialog-popup.tsx:505-506, libraryProps win); aria-labelledby/-describedby wired.
- Initial focus: library mode via defaultInitialFocus resolved right before showModal, bypassing
  useInitialFocusTarget's warning; JS-free via autoFocus (SSR) + ref-written attribute.
- React 19.3.1 source read: hydration never runs commitMount for autoFocus (only
  client-created host instances get the update flag), so a JS-free dialog opened before
  hydration does not have its focus taken at hydration.
- Dialog refactor: message texts identical once concatenated (Form.Root warning, Trigger
  JS-free warning, "no Popup" warning, "must be rendered inside a Dialog.Root" via rootPartOf +
  a/an). defaultInitialFocus/wrapChildren/role undefined for Dialog -> old paths. No Dialog or
  Popover test changed; all pass. Body hooks not re-exported from dialog/index.ts.

## Findings
M1 Walkthrough 4 UX (alert-dialog.md 7.4; docs AlertDialogPage.tsx:120-127). Correct per React
  (conventions 2.3 item 5: every transition is entangled with a pending async action), and
  documented. But the only pending signal is data-pending on the Trigger, which sits under the
  modal backdrop; Cancel without action shows nothing. A Cancel click looks dead for the whole
  action. Options:
  a) keep + document (current); point at the 9.3 recipe more prominently;
  b) feedback: Cancel (and/or Popup) gets data-pending while a close it requested is held
     (Root pending and the held request came from this part). No convention change; cheap;
  c) Cancel in library mode closes through the platform (dialog.close("")) = a fact on
     onOpenChange. Closes at once but breaks "Cancel is a request" (no veto, no VT exit), and
     the channel would depend on timing if done only while pending. Not recommended;
  d) apply closes from the optimistic open (O=false) instead of the settled one: instant, keeps
     the request, but changes Dialog-wide semantics (veto becomes snap-back reopen, VT exit
     timing). Design-level, out of scope;
  e) library disables Cancel while an Action is pending: contradicts user decision 4.
  Recommend (a) now + (b) as a follow-up issue.
L1 alert-dialog-cancel.tsx:47-68: on a client mount into an open JS-free dialog React's
  autoFocus calls .focus() on each enabled Cancel in mount order, so with two Cancels the last
  one wins (rule says first), and a Cancel remounting (Suspense reveal, key change) takes focus
  from the user. Edge case; document, or limit the autoFocus prop to the server/hydration render
  (useSyncExternalStore server snapshot) and keep the ref write.
L2 alert-dialog-popup.tsx:68-85: hand-rolled once-per-instance warning; console.error arg has a
  redundant `isDev &&` (line 80); runs useRef/useEffect in production; false positive when the
  Description sits in a suspended boundary at first show. Prefer a shared helper next to
  useShownNameWarning (use-name-warning.ts), a no-op in production.
L3 dialog-popup.tsx:411 `role?: string` -> `"alertdialog"` (only caller).
L4 SKILL.md pure-trigger list and "Close parts ignore" defaults do not name AlertDialog.Cancel /
  Action; add them.
L5 Tests: no case for walkthrough 3's rejection after Escape (owner-gone -> reportError); jsdom
  Escape uses popup().requestClose() (browser file covers the key). Add the rejection row.
L6 Docs example AlertDialogDeleteProject.tsx: success unmounts the Root, focus drops to body;
  focus the Restore button or keep the Root mounted.

## Deviations (developer's list)
- Popup provides the Cancel context: right (initialFocus is the Popup's); design 8 amended.
- Ref writes autofocus on client render: needed (React does not write it); fine.
- autoFocus only on an enabled Cancel: matches "first enabled"; engines skip disabled anyway.
- Docs example cannot call a Server Function on a static site: acceptable, code block shows it.

## Follow-up: ee08bd92..35c1d668 (5cc855e2 review fixes, 35c1d668 #182)

Verdict: merge. jsdom 4463/4463; Chromium + Firefox for alert-dialog/dialog/popover 268 pass,
10 skipped; the developer's CI run green on all three engines.

Findings fixed:
- M1: option (a) taken; walkthrough 4, docs Callout and skill now say the Cancel click shows
  nothing and point at the 9.3 recipe; option (b) recorded as a separate issue. OK.
- L1: autoFocus prop only in the server / hydration render (useHydratedMount server snapshot);
  the ref writes the attribute always. Client mounts and remounts take no focus; tests for two
  Cancels, a key remount, and hydration followed by a re-render. OK (design 3.4 amended).
- L2: useShownDescriptionWarning in use-name-warning.ts, a no-op in production, added to the
  production-bundle DEV_CALLEES. OK.
- L3: role?: "alertdialog". L4: skill lists the AlertDialog parts. L5: rejection after Escape
  -> reportError test. L6: Restore button autoFocus. All OK.

New description-warning timing: armed on the dialog's `toggle` (open), MutationObserver until
a describedby target exists, logged at the first `close` if never found. It does not warn
falsely when the content unmounts before `close`: a Description seen at the open, or any time
during the showing, sets done. Dialog `toggle` events: Chrome 132, Firefox 133, Safari 26 (BCD),
within the latest-stable policy. Notes, not blocking:
- N1 (use-name-warning.ts, effect deps [element, message]): listeners are attached once to the
  element seen at mount; a remounted <dialog> (#159, a `transition` change) is not observed.
  Dev only.
- N2: a JS-free alert dialog that is never closed (navigation while open) never warns; accepted
  by the "end of the first showing" rule.

#182: correct and complete.
- useOverlayClose now derives nativeCommand from `action === undefined`, so Dialog.Close,
  Popover.Close, AlertDialog.Cancel and AlertDialog.Action all follow; nativeCommand option
  gone. A source search finds no other part rendering commandfor/command for closing (Menu.Item and
  Toast.Action render none; Button with a consumer `command` stays the consumer's markup).
- Library mode loses nothing: the click was already cancelled there, so the command never ran.
- Shared suite overlay-close-part-suite.tsx adds markup rows for both modes and a
  pre-hydration click test (action Close does nothing, plain Close closes natively) for every
  part that uses it; the one Popover test edit is the intended change.
- Conventions 7.3 rule, dialog.md / popover.md, Dialog and Popover pages, Roadmap (breaking
  note, [command] selectors), skill, CHANGELOG entry, `fix(ui)!` commit: all present.
