# Reviewer memo: Dialog (#29), 2026-10-16

Reviewed master at 0fd1642 (merge aed025c) in a clean scratch worktree, against
`design/components/dialog.md`, `design/conventions.md`, `docs/research/dialog.md` and
`docs/research/view-transition-mount-cost.md`. During the review fc5c90f landed: the conditional
ViewTransition boundary from #35 in the design docs. The Dialog code still renders the boundary
unconditionally.

Checks: `pnpm build`, `pnpm typecheck`, `pnpm lint` pass. `pnpm test:run` with
`FUNSTACK_BROWSERS=chromium,firefox` had one failure, the known Accordion flake. The Dialog
suites ran three more times, 133/133 each time: jsdom 97, browser 18 per engine. WebKit was not
run. dist: all eight part modules start with "use client" and `index.mjs` does not. `./dialog`
is in exports, and `index.d.mts` imports platform-attributes.

Verdict: **component code acceptable with minor fixes** (M1, M2, L1-L3; implement the #35
boundary). **The nested-confirm pattern (design 11.10 / 12.5, example "Nested") needs rework**
(H1). It deadlocks every transition in the app.

## Probes (scratch vitest browser tests in Chromium 156 and Firefox 157; Playwright on the example; all deleted)

| # | Probe | Result |
| --- | --- | --- |
| 1 | `startViewTransition` calls on a plain open | 0 for the default, 0 for `keepMounted`, 1 for `transition="auto"`, in both engines. Second opens also 0. |
| 2 | Nested dialogs | Outer open makes 1 call because the inner Popup's boundary mounts with the outer content. Inner click-to-open takes 265 ms in both engines. |
| 3 | Dialog.Root inserted by `startTransition` at the top of a subtree | 1 call, in both JS-free and library mode. Wrapped in a new `<div>`: 0. |
| 4 | Pre-hydration click, then `hydrateRoot` (real browser) | One dispatch `(true, platform, event undefined)` and the content mounts. Focus stays on the dialog, no console errors. Escape then reports `(false, dismiss, "")` and focus returns to the Trigger. |
| 5 | AX tree through CDP in the example | `alertdialog` / `dialog`, named by the Title, described by the Description, `modal: true`. Page content behind is ignored. |
| 6 | `getAnimations({ subtree: true })` at `close` with the documented CSS | Chromium lists display, opacity, overlay and `opacity@::backdrop`. Firefox lists nothing. This resolves the design 4.4 / 14 check. |
| 7 | Exit with `keepMounted` | Chromium: content still `display: inline` 60 ms into the fade, then hidden. Firefox: instant. |
| 8 | Infinite spinner animation | Content unmounted 14 ms after Escape. |
| 9 | Re-open during the exit fade | Re-opens. Reasons are activate, dismiss, activate. |
| 10 | Opener removed, no Trigger | Focus lands on body after close. |
| 11 | Example in headless Chromium | JS-free section works: returnValues delete and cancel, focus return, scroll lock. Load-on-open: Trigger pending and open for about 1.2 s, then focus on Close and wheel scroll blocked. Form: spinner, then close with `save`. Rejecting save keeps the dialog open with the inline error. Dismiss toggles work: `closedby` any / closerequest, non-modal outside click, non-modal Escape with focus inside. |
| 12 | Example "Nested" section | Broken. See H1. |

## Findings

### H1. An awaited Close action that waits on a nested dialog deadlocks (design 11.10, 12.5; example)

`packages/example/src/dialog-demo.tsx:294-300` sets `confirming` in `startTransition` inside the
outer `Dialog.Close` action and awaits the inner answer. React 19.3 puts every transition started
while an async action is pending into that action's lane (`docs/research/react-async-apis.md`,
"still entangled" item 2). So the inner open cannot commit until the outer action settles, and
the outer action waits for the inner dialog.

- The inner dialog never opens, in both engines. The Close button stays "Waiting for
  confirmation…".
- Escape closes the outer dialog natively, but its notification never commits.
- Every other transition in the app stalls. An unrelated Order dialog stayed `data-pending`
  forever, and in vitest a later test on the same page could not open a dialog.
- The library's own inner Trigger dispatch would hit the same wall.

Verified fix: open the inner dialog with an urgent update outside the action scope, such as
`setTimeout(() => setConfirming(true))`. It works in both engines and closes the outer dialog
with `returnValue: "discard"`. Another option is a pattern where no action awaits user input:
Discard is a plain Trigger for the confirm dialog, whose Close action closes the outer dialog.
Rewrite design 11.10 / 12.5 and the demo, and add a browser test.

### M1. JS light dismiss closes on a drag that ends on the backdrop

`packages/ui/src/dialog/dialog-popup.tsx:359-377` treats any `click` that targets the dialog
outside its rect as a backdrop click. When a user selects text in an input and releases over the
backdrop, Chromium fires `click` on the common ancestor, the dialog, and the dialog closes. It
verified closed in both vitest and the example with `page.mouse`. Native `closedby="any"` stays
open, and Firefox stayed open. The same applies to the non-modal document listener at lines
341-350. Without the flag the default Chromium path is the JS one, and losing a half-filled form
is the reason `lightDismiss` defaults to `false`. Fix: record `pointerdown` and dismiss only when
both the down and the click were outside.

### M2. Non-modal Escape listener steals Escape from nested popovers

`packages/ui/src/dialog/dialog-popup.tsx:324-338` handles `keydown` with `preventDefault()` and
`requestClose()` for any target whose closest dialog is this one. Escape inside a `popover="auto"`
in a non-modal dialog closes the dialog, in both engines. A modal dialog closes only the
popover. This breaks design 9 ("closes the innermost one only"), and a Tooltip or Menu inside a
non-modal dialog will hit it. Fix: skip when the target is inside an open popover within the
dialog.

### M3. Dialog.Form closes on any non-throwing result

An action that reports validation errors, the `useActionState` style, closes the dialog. This
was verified. Design 8.1 only covers throwing. Document "throw to keep it open", or design an
opt-out.

### M4. ViewTransition boundary: implement fc5c90f and correct the Dialog claims

`dialog-popup.tsx:452-454` always renders `<ViewTransition>`, also in JS-free mode, where
conventions 5.1 says browser-owned parts render none. Probe 3 measured that cost. The design
text is wrong about where the Dialog pays (probes 1-3). The list is in "Text proven wrong".

### L1. `disabled` not owned on Trigger and Close

`dialog-trigger.tsx:373` and `dialog-close.tsx:120` pass `disabled` through `props`.
`<Dialog.Trigger disabled render={<button disabled={false} />}>` renders an enabled button. In
JS-free mode it opens the dialog, verified in both engines. This breaks conventions 1.2. Move
`disabled` into `libraryProps`.

### L2. Re-open while a close is still settling

After a native close with the notification still pending, committed is `true` and optimistic is
`false`. A Trigger click sets optimistic to `true`, so the Trigger shows `data-open` but no
`data-pending` while it waits (walkthrough 11.8; design 4.2 misses this case).

Form variant, verified in both engines:

1. The user presses Escape while a `Dialog.Form` action is pending.
2. The user clicks the Trigger again. The re-open is entangled and held, with no pending shown.
3. When the save settles, the dialog opens.
4. In the same commit's passive effect the watcher closes it again.
5. The watcher reports `(false, "activate", "save")` for a dialog the user dismissed.

Fix (`dialog-form.tsx:223-230`): the watcher closes only if no `close` event has happened since
the submit.

### L3. Tests

- `dialog.browser.test.tsx` uses raw `userEvent` and logs 216 act warnings per run. Use `user`
  from `src/__tests__/browser-user.ts`.
- Missing browser rows: nested confirm (would have caught H1), light-dismiss drag, popover Escape
  in a non-modal dialog, and the #35 zero-`startViewTransition` row.
- Shim, nits:
  - `dialog-shim.ts:167` throws `InvalidStateError` for `show-modal` on a non-modally open
    dialog. The platform treats that as an invalid command and fires no event.
  - The shim fires `command` for invalid commands, such as request-close on a closed dialog.

### L4. Nit: `method` omitted for string `action`

`DialogFormProps` omits `method` even for a string `action`, so a navigating form cannot POST
(`dialog-form.tsx:140-143`).

## Text proven wrong

- **dialog.md 11.10 and 12.5:** the nested confirm through an awaited Close action deadlocks
  (H1).
- **conventions 5.1:** "265 to 280 ms of added latency per … dialog open". The 5.1 table row
  (about line 957) says "Dialog's Popup children pay the page cross-fade on every mount".
  Measured: a plain open never starts a view transition. Children mount under the `<dialog>`
  host, which shields them, and the Popup's boundary mounts once with the page. With
  `transition` set, an open runs a view transition because of the boundary *update* with a
  non-`"none"` class, not a mount.
- **conventions 10.1 (about line 1355) and dialog.md 13.2 "transition smoke" row:** "with
  `transition="none"` it is called (once per open)" is false for a Dialog open. An explicit
  `"none"` boundary is exactly today's default path, which measured 0. The row can only be
  observed with a mounting Popup, such as a nested inner dialog.
- **dialog.md 10.3:** "starts the browser's root cross-fade on every open". Only true for nested
  or transition-inserted Popups.
- **dialog.md 9:** the "Escape inside a nested popover … innermost only" row is false for
  non-modal dialogs on the JS path (M2).
- **dialog.md 4.4 / 14:** the `::backdrop` in `getAnimations` check is resolved; Chromium lists
  it.
