# Reviewer memo: Tooltip (#13), 2026-10-16

Reviewed master at 2997d8a (Tooltip from 9138c0e, a0be197) against `design/conventions.md`,
`design/components/tooltip.md`, `docs/research/popover-anchor-tooltip.md` and the prior review
standard. `pnpm build`, `pnpm typecheck` (uncached), `pnpm lint`, `pnpm format:check` pass;
`vitest run` 393 tests x3, no flakes (tooltip: 75 jsdom + 8 Chromium). Chromium under test is
HeadlessChrome 153 (Playwright 1.63, `interestForElement` present). Firefox/WebKit binaries for
this Playwright are not installed: cross-engine behaviour and Safari's hint->manual degradation
are unverified.

dist: all five tooltip part files start with "use client", `tooltip/index.mjs` does not; `./tooltip`
in exports; `internal/platform-attributes.d.mts` emitted (ends `export {}`), imported from every
entry `.d.mts`, no runtime import. Consumer scratch file in packages/example: `<button
interestfor="x">`, `<a interestfor>`, `style={{ interestDelayStart }}` typecheck; `interestfor={1}`
rejected; `<Tooltip.Root open>` and `<Tooltip.Popup popover>` rejected.

Verdict: **acceptable with minor fixes**.

## Probes (scratch Chromium tests + Playwright on the built example; all deleted)

1. Escape inside a modal `<dialog>` (JS path, manual and hint): one Escape closes tooltip AND
   dialog. Same inside an open `popover="auto"` menu: menu closes too. A native hint opened by
   `showPopover` on hover, with no JS keydown handler, closes alone -> on the hint path the
   library's bubbling handler hides first and the close request falls through to the next close
   watcher. `hidePopover(); event.preventDefault()` in the same document keydown handler keeps the
   dialog / menu open (second Escape closes the dialog). Works for manual and hint.
2. Native path (interestfor + hint): Escape closes the hint AND the enclosing modal dialog in
   Chromium 153, with or without user activation in the dialog. A hint opened by `popovertarget`
   click closes alone. Library attaches nothing here, so it cannot prevent it.
3. Native path, `disabled` flipped true while open: `interestfor` removed, popup stays open after
   the pointer leaves (no effect cleanup on the native path).
4. `toggle` is async in Chromium: `showPopover()` then a pointerdown in the same task leaves the
   popup open (the `open` closure variable and the document listeners lag one task).
5. Trigger -> popup across an 8px margin keeps it open; leaving both closes. pointerdown outside
   closes. Click during pending delay cancels; click focus is not :focus-visible. Flag on/off after
   mount switches paths correctly (0 / 1 showPopover calls). Popup removed while open: no errors,
   both document listeners removed. Keyboard-opened tooltip closes after hover-leave while focus
   stays: same on the native path (parity, not a finding).
6. Example (vite preview, Playwright): baseline and both-flags runs behave (names Bold/Italic,
   delays, Escape, keyboard open, Save description, placement matrix incl. side=null). With flags
   on, clicking Save does NOT close the tooltip (invoker click is not light dismiss), contradicting
   the demo copy and the JS path. No console errors.

## Accepted deviations

- React.CSSProperties instead of `declare module "csstype"`: works for consumers. Caveat: objects
  typed as csstype `Properties` directly do not get the keys. Fix conventions 7.4 / design 6, 9.
- side={null}: data-side/data-align omitted (not owned). Consistent with "a part that does not own
  a key in some mode omits it".
- `globalThis.jest` shim: scoped, removed in afterEach; the known vitest workaround for RTL's
  asyncWrapper. `shouldAdvanceTime` would be non-deterministic. Move `setupTimers` to helpers when
  reused.
- `:focus-visible` stub: acceptable; real behaviour covered in Chromium.
- Pending-open cancellation on trigger pointerdown/Escape, interestForRequested re-detect,
  console.error for dev warnings.

## Design / conventions text proven wrong

- conventions resolved Q11: Tooltip default does not switch to "name" automatically; explicit
  `provides`, default "description".
- conventions 7.4 rule of thumb (`declare module "csstype"`); tooltip.md 6 and 9 likewise.
- tooltip.md 2.3: baseline "Never closes auto popovers" (Escape does, until preventDefault);
  hint row "JS hide calls are no-ops when already closed" (keydown runs before the close request).
- tooltip.md 2.1 / 2.2: native path also closes an enclosing modal dialog on Escape, and does not
  close on a click on the trigger -> flags change visible behaviour.
- tooltip.md 13 Disabled row holds on the JS path only; Directive row says six files (five, no Arrow);
  12.5 says console.warn.
