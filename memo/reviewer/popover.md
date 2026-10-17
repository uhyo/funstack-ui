# Reviewer memo: Popover (#40), 2026-10-17

Reviewed 670db7b..c9c82db on master: `packages/ui/src/popover/`, the shared hooks
(`internal/use-popover-{root,popup,trigger}.ts`, `use-exit-animation.ts`, `anchor-position.ts`),
the shims, the example and docs pages. Design: `design/components/popover.md` (accepted).

Verdict: **acceptable with fixes.** H1 must land before Menu (#41) relies on `requestClose` with
`transition`; M1 is small and in the same hook. The rest are minor or doc corrections.

CI run 39006036945 (head c9c82db): all green, WebKit included. WebKit popover rows: 27, 1 skipped
(nested flip, WebKit 302008, design-sanctioned). Raw probe: `[webkit] <dialog popover> focusing
steps move focus inside: true`. The VT old-snapshot row, `ToggleEvent.source` and Tab into a
`<div>` popup all pass on WebKit. Tooltip did not regress (helper moved verbatim; its rows pass).

## Findings

### H1. Focus drops to <body> after a library-driven close started from inside the popup when the content unmounts in the close commit
- Where: `use-popover-popup.ts:134-137` (no hold with `transition`, which is correct for the VT),
  `:273-275` (`focusWasInside` read in `beforetoggle`, after React already removed the focused
  node), `:286-300` (the fallback then sees `wasInside=false`).
- Scenario: `transition` set, `keepMounted` false (the docs example `PopoverActions` and design
  12.2). Keyboard user activates "Rename" (a `Popover.Close`) -> close commit unmounts the
  children, including the focused button -> focus goes to `<body>` -> `hidePopover()` in the apply
  effect: the platform restores focus only when focus is inside the popover, so it does not ->
  `toggle`: `wasInside` false -> no fallback. Focus ends on `<body>`. Probed with a temporary
  browser test (removed): Chromium and Firefox fail for `transition="pop"` and `"none"` with
  keepMounted false; pass without `transition` (held) and with keepMounted (Activity does not
  blur synchronously). Same for a controlled `open={false}` from a submit inside the popup
  (12.4 with `transition`) and Menu item activation -> `requestClose` (#41).
- Fix: snapshot focus before the DOM removal. Wrap the library-mode content in a tiny internal
  component whose `useLayoutEffect` cleanup records `popup.contains(activeElement)` (React runs a
  deleted function component's layout cleanups before removing its host nodes); OR it into
  `focusWasInside` in `beforetoggle`; then, right after `hidePopover()` in the apply effect (or in
  `toggle`), focus the Trigger when active is `<body>`. Alternative: record it in
  `requestClose`. Tests: a browser row "Close with `transition="pop"` returns focus to the
  Trigger" (all engines) and a jsdom row (jsdom also moves focus to body on removal).
- Design: 6.2 rule 1 needs "or focus was inside when the content unmounted in the close commit".

### M1. A dismissal with `transition` and a CSS exit runs two document view transitions
- Where: `use-exit-animation.ts:419` and `:426` (`startTransition(() => setHeld(false))`).
- Scenario (probed in Chromium): `transition="pop"` plus the 10.1 CSS fade (what docs and design
  10.2 recommend: "keep, at most, a CSS exit for dismissals"). Escape -> `toggle` holds for the
  fade -> notification commit (VT #1, as designed) -> fade ends -> `held=false` in a transition
  -> children unmount under the boundary -> VT #2. Two root cross-fades and two windows without
  pointer events for one Escape (#35).
- Fix: release `held` with a non-transition update (the popup is already `display: none`;
  nothing visible changes, and only transition commits start view transitions). At least when
  `transition` is set. Update design 4.4 / 10.2 ("held -> false: transition, no types").

### M2. `Popover.Close` drops a superseded rejection
- Where: `popover-close.tsx:113-117` (`useTransition` keeps only the newest thenable).
- Scenario: click Close (action A, slow, rejects), click again (action B resolves): A's error is
  lost, contrary to conventions 2.4. Same known gap as `Dialog.Close`; menu.md 14 plans
  `use-action-trigger.ts`. Make sure #41 migrates Popover.Close onto it.

### L1. The 6.1 focus fallback is dead code now (deviation 1)
- `use-popover-popup.ts:57-90,199`. WebKit runs the dialog focusing steps (CI 39006036945), so
  `ensureDialogFocus` is a no-op in all three engines and only drives the jsdom tests
  (`popover.test.tsx` "focus on open (design 6.1 fallback ...)"). It also writes a permanent
  `tabindex="-1"` and its `firstTabbable` heuristic diverges from the platform (inert, shadow DOM).
- Fix: remove it; emulate the dialog focusing steps in `popover-shim.ts` instead; make the WebKit
  branch of the raw probe assert `true`; drop the stale comments
  (`popover.browser.test.tsx:15-17,281-283`) and the docs sentence "Where an engine does not move
  focus in, the library does the same" (`PopoverPage.tsx` ~453). Close design 6.1 / 14.5 check.

### L2. `intended()` and effect order (deviation 3)
- `use-popover-root.ts:173-176`: correct and needed (a Close continuation after an `await`). But
  the ref is written in the Root's layout effect, which runs after every child's layout effect,
  so a child layout effect calling `intended()` / `requestClose` in the same commit reads the
  previous commit. No caller does today; Menu might. `useInsertionEffect` (mutation phase) would
  publish before any layout effect; or document "handlers and later commits only".

### L3. A Close action's continuation can close a re-opened popover
- `popover-close.tsx:113-117`: action pending -> Escape dismisses -> user re-opens -> action
  resolves -> `requestClose` sees `intended()===true` and closes the new open. Guard with an open
  generation captured at click (or document "the first hide wins" includes this).

### L4. Lint warning `use-popover-hooks.test.tsx:60`
- Not a real ref read: React Compiler's ref inference taints an object once one of its members is
  passed as `ref` (`popup.setElement`, `trigger.ref`), so `popup.visible` is flagged. Verified:
  destructuring both hook results lints clean. Fix the test that way and tell Menu to destructure.
  Also drop `focusWasInside` from `PopoverPopupHook` (no consumer; a ref in a returned object
  invites the same warning).

### L5. Listeners attach in a passive effect through `setPopup` state
- `use-popover-popup.ts:141-157,334-345`: an extra render per mount, and a window between the
  commit and passive effects where a close's `beforetoggle` (`awaitingClose`) would be missed.
  Attaching in the callback ref (cleanup removes) avoids both.

### L6. `defaultOpen` and the server HTML (deviation 6)
- Accept (Dialog parity). But before hydration the Trigger says `aria-expanded="true"` while the
  popup is hidden. Correct design 2.5 / 3.1 wording ("never in the server HTML" means the showing,
  not content and Trigger state) and the docs "content is not in the HTML yet" bullet.

### L7. Docs: `autoFocus` in JS-free mode only works for server-rendered markup
- React writes `autofocus` in SSR, not on client render (client navigation of an RSC page), so
  recommend `initialFocus` (written after mount in JS-free mode). Same for Dialog.

## Deviation judgements
1. Focus fallback up front: was reasonable without WebKit; now verified unnecessary -> L1, remove.
2. Title/Description state from a Popup context: accept; better than Root carrying side/align.
   Design 14 "Context" correction. (Outside a Popup the fallback reports `side: "bottom"`; fine.)
3. `intended()` from a committed-optimistic ref: accept (L2 note).
4. `held` release rule in the apply effect: accept; traced dismissal / library close / refused
   dismissal / re-open during a wait, all correct. Add to design 4.4. Pair with M1.
5. jsdom shim forcing shown `<dialog popover>` visible: accept (test-only, documented).
6. `defaultOpen` content and `aria-expanded=true` in server HTML: accept with doc fixes (L6).
7. No-name warning only for dialog / alertdialog / menu: accept; design 9 wording.
8. Menu extension points: accept. `resolveInitialFocus(popup)` has no `cause` (menu.md 14 says
   `(popup, cause)`; the cause is Menu's ref) -> update menu.md. Menu's `details` factory must use
   `createActionDetails` or Server Functions break (the Proxy keeps `event` non-enumerable).
9. ViewTransition rows outside act: accept; matches transition-boundary precedent, polls rather
   than fixed sleeps.

## Async React / a11y / SSR checks that passed
- Every user-triggered change is a Root transition; open awaited and keyed on committed state;
  part closes awaited and hidden in the commit; dismissals notified; optimistic rollback and
  controlled veto / refusal tested both ways; overlap 11.7 / 11.8 tested; Server-Function-safe
  details tested (`Object.keys(details)`).
- `aria-modal="false"`, explicit `role`, `aria-expanded` both modes (JS-free DOM write reading
  `:popover-open`), labelledby/describedby merge, nested focus return (browser rows), Trigger
  inside a hidden popover not focused.
- Pre-hydration open reconciliation (StrictMode once, refusal hides), JS-free aria sync on
  hydration.
- Nested: Escape innermost + library focus return, outside click closes stack, click in outer
  closes inner only, Dialog from inside, Tooltip hint/manual, unrelated auto popover.
