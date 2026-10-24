# Review: #115 / #116 (branch `fix/115-116-trigger-close`, cc8631e + 29c4d64)

Verdict: **#115 acceptable with minor fixes; #116 needs a small rework / architect decision
(F1, F2) before merge.** Library-mode behaviour of #116 is correct; the gaps are JS-free mode
and the pending-close edge, where the amendment's claims do not hold.

Checked on Chromium and Firefox (WebKit not run). Branch tests green (jsdom 672 in
dialog/popover/menu, browser 176), lint / format / typecheck green, production-bundle test
green (the new strings sit in `useElementCheck` args, so they are collected and stripped).

## Findings

### F1 (medium, #116) JS-free non-modal `lightDismiss`: Trigger click closes and re-opens
`packages/ui/src/dialog/dialog-popup.tsx:483-486` + `packages/ui/src/dialog/dialog-trigger.tsx:122-129`.
The "no re-open" argument (amendment, 13.1 row) only holds in library mode (`intended()`).
In JS-free mode the Trigger's handler checks `!dialog.open`, which is already false after the
JS capture-phase `requestClose()`, so it calls `show()` again. Probe (`<Dialog.Root modal={false}>`,
no flag): every Trigger click while open fires `close` then `toggle:open`; dialog stays open.
Master: nothing happens. (With the flag, native `closedby="any"` already did this on master.)
So "a dismissal on every path" / "does not re-open" (dialog.md 13.1, amendment, DialogPage
`lightDismiss` row, JSDoc dialog-popup.tsx:66-67) is false for JS-free mode, and a consumer's
`onClose` now sees a spurious close. Untested (all #116 rows are library mode).
Suggested fix: JS-free Trigger records `dialog.open` at `pointerdown` and skips `show()` on that
click if it was open, making the outcome "closed" on every path (also fixes the flag path).
Or document it. Add a jsdom/browser row either way.

### F2 (medium, #116) Trigger click during a pending part close now ends closed
Amendment (dialog.md "#116" edge) says the dismissal comes first and the click's `requestOpen`
is last, so the open wins. Actual order: the click's `requestOpen` dispatches during the click,
the `close` event (queued) dispatches `(false, "dismiss")` after it, so the last dispatch is the
dismissal. Probe (non-modal, lightDismiss, async Close pending, Trigger click): calls
`[true act][false act][true act][false dismiss]`, dialog ends closed, both with and without
the flag. Master JS path: `[true][false][true]`, stays open (row "Re-open during a pending part
close" outcome). Native path matched the branch already. Architect: accept "ends closed"
(consistent with the platform) and fix the amendment text, or not; either way add a test row
with `lightDismiss`.

### F3 (low, #115) `Menu.SubmenuTrigger` non-button warning text is wrong for it
`packages/ui/src/internal/use-popover-trigger.ts:87-102`. Probe: `render={<div />}`
SubmenuTrigger, click while its submenu is open -> submenu closes with `(false, "dismiss")`,
focus on the trigger. A `<button>` SubmenuTrigger keeps it open and moves focus into it. So
the issue is "the click closes the submenu at all", not "the close is not awaited / no veto".
The developer memo's "the click then re-opens" is also wrong. Recommend tailoring now (cheap:
branch on `activate !== undefined`, e.g. "a press while the submenu is open dismisses it
instead of moving focus into it. Render a <button>.") and a menu.md note.

### F4 (low, #115) `commandfor` / `command` on a non-button Trigger
`use-popover-trigger.ts:161-162`, same on `dialog-trigger.tsx:111-121` and
`use-overlay-close.ts:92-93`. Fix is cheap per call site: `invoker && rendersButton(render)`
(component renders keep the attributes, JS-free mode unaffected; a host `<a>` never ran the
command). Probe: with that change in usePopoverTrigger all jsdom (3157) and Chromium
menu/popover browser tests pass. Two traps:
- do **not** fold it into `disabledButton().invoker`: `use-overlay-close.ts:98` derives
  `aria-disabled` from `!invoker`, so a non-button Close would become `aria-disabled="true"`
  (no test catches that; jsdom still all green with the central change).
- `menu/menu-gestures.ts:60-63` (`inSubmenuOf`) reads the SubmenuTrigger's `commandfor` to find
  its submenu during a press-drag; a non-button SubmenuTrigger would lose that. Give it the id
  another way (e.g. through `registerSubmenuHover`).
Also update the comment "It carries `commandfor`" in popover.browser.test.tsx.
Fine to do now if those two are handled; otherwise a follow-up issue.

### F5 (low, design, architect) stale dialog.md 2.6
dialog.md:499 ("a click while open is a no-op") and 505-509 ("**ignoring the Trigger**
(otherwise ... re-open ...)") contradict the amendment, which lists only 13.1, section 13 and
the 14 row as edited.

## Verified OK
- Library mode, no re-open: uncontrolled (branch rows) and controlled + async action, with and
  without the flag: dialog closes at once (dismissal), `[true][false dismiss]`, no `true`
  after, `data-open` cleared while pending. Controlled parent ignoring the dismissal re-shows
  (as for any dismissal).
- Modal unaffected: `isOutside` is only used by the non-modal document listeners.
- Focus: ends on the Trigger (Chromium/Firefox focus the pressed button). WebKit unverified.
- Mutations: re-adding the Trigger exclusion fails both jsdom rows and the browser "without
  flag" row on Chromium and Firefox; dropping the library-mode warning branch fails the
  popover and menu jsdom rows.
- Docs: PopoverPage Trigger note accurate; DialogPage / JSDoc accurate for library mode only
  (F1).
